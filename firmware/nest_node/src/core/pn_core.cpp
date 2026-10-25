#include "pn_core.h"

namespace pn {

static inline float clamp01(float x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

Config default_config() {
  Config c;
  // Bench inventory: channel 1 switches the 5 V 4010 DC fan (low-voltage test load).
  // Channels 2-4 stay unused until a load is wired AND its rating has been checked.
  c.loads[0].cls = LoadClass::Fan;
  c.loads[0].name = "test_fan_5V";
  c.loads[0].grace_s = 600;
  c.loads[0].rated_w = 0.0f;  // unknown until measured; estimates use scenario files
  for (int i = 1; i < kMaxLoads; ++i) c.loads[i] = LoadConfig{};
  return c;
}

Config room_profile_config() {
  Config c;
  c.loads[0].cls = LoadClass::Lighting; c.loads[0].name = "lights"; c.loads[0].grace_s = 180;
  c.loads[1].cls = LoadClass::Fan;      c.loads[1].name = "fans";   c.loads[1].grace_s = 600;
  c.loads[2].cls = LoadClass::Cooling;  c.loads[2].name = "ac";     c.loads[2].grace_s = 600;
  c.loads[3] = LoadConfig{};
  return c;
}

// ------------------------------------------------------------ PirEstimator
PirEstimator::PirEstimator(const Config& c) : c_(c) {}

void PirEstimator::close_slot(bool active, uint64_t t_ms) {
  const uint32_t w = c_.window_slots > 64 ? 64 : (c_.window_slots == 0 ? 1 : c_.window_slots);
  if (ring_[head_]) --n_active_;      // slot leaving the window
  ring_[head_] = active;
  if (active) { ++n_active_; last_active_ms_ = t_ms; }
  head_ = (head_ + 1) % w;
  last_slot_active_ = active;
}

float PirEstimator::p_pir() const {
  if (c_.kappa_slots <= 0) return n_active_ > 0 ? 1.0f : 0.0f;
  return 1.0f - expf(-static_cast<float>(n_active_) / c_.kappa_slots);
}

float fuse_occupancy(float p_pir, float p_env, float beta) {
  p_pir = clamp01(p_pir); p_env = clamp01(p_env); beta = clamp01(beta);
  return 1.0f - (1.0f - p_pir) * (1.0f - beta * p_env);
}

// ------------------------------------------------------------ Waste score
float waste_z0(const Config& c) {
  const float W = c.trigger_W;
  return c.z_at_trigger - logf(W / (1.0f - W)) / c.gamma;
}

float waste_z(const Config& c, bool load_on, float O, float tau_u_s, float grace_s, float d) {
  const float timer = grace_s > 0 ? clamp01(tau_u_s / grace_s) : 1.0f;
  return c.w1 * (load_on ? 1.0f : 0.0f) * (1.0f - clamp01(O)) + c.w2 * timer + c.w3 * clamp01(d);
}

float waste_W(const Config& c, float z) {
  return 1.0f / (1.0f + expf(-c.gamma * (z - waste_z0(c))));
}

float daylight_term(const Config& c, float L_lux, bool light_on, bool ldr_valid) {
  if (!ldr_valid || c.L_lum_lux < 0 || !(L_lux == L_lux) || c.L_ref_lux <= 0) return 0.0f;
  float Lday = L_lux - (light_on ? c.L_lum_lux : 0.0f);
  if (Lday < 0) Lday = 0;
  return clamp01(Lday / c.L_ref_lux);
}

float thermal_context_term(const Config& c, float Tz, float Tamb, bool valid) {
  if (!valid || c.dT_ref_K <= 0) return 0.0f;
  return clamp01(fabsf(Tz - Tamb) / c.dT_ref_K);
}

// ------------------------------------------------------------ Sensors
bool is_fresh(const Reading& r, uint64_t now_ms, uint32_t stale_s) {
  if (!r.valid || now_ms < r.t_ms) return false;
  return (now_ms - r.t_ms) <= static_cast<uint64_t>(stale_s) * 1000ULL;
}

void Median3::push(float v) {
  b_[i_] = v; i_ = (i_ + 1) % 3; if (n_ < 3) ++n_;
}

float Median3::value() const {
  if (n_ == 0) return NAN;
  if (n_ == 1) return b_[(i_ + 2) % 3];
  if (n_ == 2) return 0.5f * (b_[(i_ + 1) % 3] + b_[(i_ + 2) % 3]);
  float a = b_[0], b = b_[1], c = b_[2];
  if (a > b) { float t = a; a = b; b = t; }
  if (b > c) { float t = b; b = c; c = t; }
  if (a > b) { float t = a; a = b; b = t; }
  return b;
}

// ------------------------------------------------------------ Thermal screen
float thermal_predict(const ThermalParams& p, float Tz, float Tamb, float O, int uc, int steps) {
  float T = Tz;
  for (int j = 0; j < steps; ++j) T += p.th1 * (Tamb - T) + p.th2 + p.th3 * O - p.th4 * uc;
  return T;
}

bool thermal_veto(const Config& c, const ThermalParams& p, bool Tz_ok, float Tz,
                  bool Tamb_ok, float Tamb, float O) {
  const bool params_ok = p.valid && p.th1 > 0 && p.th1 < 1 && p.th4 >= 0;
  if (!params_ok || !Tz_ok || !Tamb_ok) return true;   // conservative
  float T = Tz;
  for (int j = 0; j < c.horizon_steps; ++j) {
    T += p.th1 * (Tamb - T) + p.th2 + p.th3 * O;        // u_c = 0 (proposed switch-off)
    if (T > c.T_comfort_max_C) return true;
  }
  return false;
}

// ------------------------------------------------------------ LoadController
const char* reason_name(Reason r) {
  switch (r) {
    case Reason::None: return "none";
    case Reason::Proposed: return "proposed";
    case Reason::VetoCycle: return "veto_cycle";
    case Reason::VetoThermal: return "veto_thermal";
    case Reason::WarningStarted: return "warning_started";
    case Reason::WarningCanceled: return "warning_canceled";
    case Reason::SwitchedOff: return "switched_off";
    case Reason::RestoredOccupancy: return "restored_occupancy";
    case Reason::Startup: return "startup";
  }
  return "?";
}

LoadController::LoadController(const Config& c, const LoadConfig& lc) : c_(c), lc_(lc) {}

void LoadController::reset(uint64_t t_ms) {
  state_ = LoadState::On;
  last_presence_ms_ = t_ms;   // startup counts as presence: no switch-off before a full grace period
  on_since_ms_ = t_ms;
  warning_since_ms_ = 0;
}

StepOutput LoadController::step(const StepInput& in) {
  StepOutput out;
  const bool presence = (in.O >= c_.occupied_threshold) || in.pir_active_now;
  if (presence) last_presence_ms_ = in.t_ms;
  const float tau_u = in.t_ms >= last_presence_ms_ ? (in.t_ms - last_presence_ms_) / 1000.0f : 0.0f;

  if (lc_.cls == LoadClass::Unused) {
    out.state = state_; out.load_on = true; return out;   // never switched
  }

  switch (state_) {
    case LoadState::On: {
      out.z = waste_z(c_, true, in.O, tau_u, static_cast<float>(lc_.grace_s), in.d);
      out.W = waste_W(c_, out.z);
      // W >= trigger_W  <=>  z >= z_at_trigger (sigma is increasing). Comparing z with a
      // 1e-6 tolerance makes the boundary identical in float (ESP32) and double (twin).
      if (out.z >= c_.z_at_trigger - 1e-6f) {
        const uint64_t on_for = in.t_ms - on_since_ms_;
        if (on_for < static_cast<uint64_t>(c_.min_on_before_off_s) * 1000ULL) {
          out.event = Reason::VetoCycle;
        } else if (lc_.cls == LoadClass::Cooling && in.cooling_veto) {
          out.event = Reason::VetoThermal;
        } else {
          state_ = LoadState::Warning;
          warning_since_ms_ = in.t_ms;
          out.event = Reason::WarningStarted;
        }
      }
      break;
    }
    case LoadState::Warning: {
      out.z = waste_z(c_, true, in.O, tau_u, static_cast<float>(lc_.grace_s), in.d);
      out.W = waste_W(c_, out.z);
      if (presence) {
        state_ = LoadState::On;
        out.event = Reason::WarningCanceled;
      } else if (in.t_ms - warning_since_ms_ >= static_cast<uint64_t>(c_.warning_s) * 1000ULL) {
        state_ = LoadState::Off;
        out.event = Reason::SwitchedOff;
      }
      break;
    }
    case LoadState::Off: {
      out.z = waste_z(c_, false, in.O, tau_u, static_cast<float>(lc_.grace_s), in.d);
      out.W = waste_W(c_, out.z);
      if (presence) {
        state_ = LoadState::On;
        on_since_ms_ = in.t_ms;
        out.event = Reason::RestoredOccupancy;
      }
      break;
    }
  }
  out.state = state_;
  out.load_on = state_ != LoadState::Off;
  out.warning = state_ == LoadState::Warning;
  out.tau_u_s = tau_u;
  return out;
}

// ------------------------------------------------------------ Baseline
bool FixedTimeoutController::step(uint64_t t_ms, bool pir_active_now) {
  if (pir_active_now) { last_ms_ = t_ms; on_ = true; }
  else if (t_ms - last_ms_ >= static_cast<uint64_t>(timeout_s_) * 1000ULL) on_ = false;
  return on_;
}

}  // namespace pn
