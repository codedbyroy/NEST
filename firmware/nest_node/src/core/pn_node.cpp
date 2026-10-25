#include "pn_node.h"

namespace pn {

NodeLogic::NodeLogic(const Config& c)
    : c_(c), pir_(c),
      ctl_{LoadController(c, c.loads[0]), LoadController(c, c.loads[1]),
           LoadController(c, c.loads[2]), LoadController(c, c.loads[3])} {}

void NodeLogic::reset(uint64_t t_ms) {
  for (auto& k : ctl_) k.reset(t_ms);
  last_minute_ms_ = t_ms;
}

SlotOutputs NodeLogic::step(const SlotInputs& in) {
  SlotOutputs out;
  pir_.close_slot(in.slot_active, in.t_ms);
  out.p_pir = pir_.p_pir();
  out.active_slots = pir_.active_slots();

  // Temperature: median of the last three distinct valid samples; stale -> not fresh.
  out.Tz_fresh = is_fresh(in.Tz, in.t_ms, c_.sensor_stale_s) &&
                 in.Tz.value >= c_.T_min_C && in.Tz.value <= c_.T_max_valid_C;
  if (out.Tz_fresh && in.Tz.t_ms != last_tz_t_ms_) { tz_med_.push(in.Tz.value); last_tz_t_ms_ = in.Tz.t_ms; }
  const float Tz = tz_med_.value();

  // 1-minute temperature history for the optional environmental model.
  if (in.t_ms - last_minute_ms_ >= 60000ULL) {
    last_minute_ms_ = in.t_ms;
    if (out.Tz_fresh) env_hist_.push_minute(Tz);
  }

  // Optional environmental evidence (beta > 0 only). Fault rule (d): invalid or
  // stale DHT22 data -> p_env = 1, which can only block switch-offs.
  if (c_.beta > 0.0f) {
    const bool rh_ok = is_fresh(in.RH, in.t_ms, c_.sensor_stale_s) && in.RH.value >= 0 && in.RH.value <= 100;
    if (!out.Tz_fresh || !rh_ok || !env_hist_.ready()) {
      out.p_env = 1.0f;
    } else {
      out.p_env = env_model_predict({Tz, in.RH.value, env_hist_.d5()});
      out.env_used = true;
    }
  }
  out.O = fuse_occupancy(out.p_pir, out.p_env, c_.beta);

  const bool tamb_ok = is_fresh(in.Tamb, in.t_ms, 3 * 3600);  // fault rule (c): older than 3 h -> unusable
  const bool ldr_ok = is_fresh(in.light_lux, in.t_ms, c_.sensor_stale_s);

  for (int i = 0; i < kMaxLoads; ++i) {
    const LoadConfig& lc = c_.loads[i];
    StepInput si;
    si.t_ms = in.t_ms;
    si.O = out.O;
    si.pir_active_now = in.slot_active;
    const bool on_now = ctl_[i].state() != LoadState::Off;
    if (lc.cls == LoadClass::Lighting) si.d = daylight_term(c_, in.light_lux.value, on_now, ldr_ok);
    else if (lc.cls == LoadClass::Fan || lc.cls == LoadClass::Cooling)
      si.d = thermal_context_term(c_, Tz, in.Tamb.value, out.Tz_fresh && tamb_ok);
    if (lc.cls == LoadClass::Cooling)
      si.cooling_veto = c_.thermal_enabled
                            ? thermal_veto(c_, thermal, out.Tz_fresh, Tz, tamb_ok, in.Tamb.value, out.O)
                            : !c_.sim_allow_cooling_without_model;
    out.load[i] = ctl_[i].step(si);
  }
  return out;
}

}  // namespace pn
