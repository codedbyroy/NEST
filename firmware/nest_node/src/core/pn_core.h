// NEST portable control core. No Arduino dependencies: the same code is
// compiled into the ESP32 firmware, the host unit tests and the replay simulator.
#pragma once
#include <stdint.h>
#include <math.h>
#include "pn_config.h"

namespace pn {

// ----------------------------------------------------------------- PIR estimator
class PirEstimator {
 public:
  explicit PirEstimator(const Config& c);
  // Close the current slot. `active` = an edge was latched or the output was high
  // at any time during the slot (either PIR).
  void close_slot(bool active, uint64_t t_ms);
  int active_slots() const { return n_active_; }
  float p_pir() const;
  bool any_activity_ever() const { return last_active_ms_ != UINT64_MAX; }
  uint64_t last_active_ms() const { return last_active_ms_; }
  bool last_slot_active() const { return last_slot_active_; }
 private:
  const Config& c_;
  bool ring_[64] = {false};
  uint32_t head_ = 0;
  int n_active_ = 0;
  bool last_slot_active_ = false;
  uint64_t last_active_ms_ = UINT64_MAX;
};

float fuse_occupancy(float p_pir, float p_env, float beta);

// ----------------------------------------------------------------- Waste score
float waste_z0(const Config& c);  // z0 = z_at_trigger - ln(W/(1-W))/gamma
float waste_z(const Config& c, bool load_on, float O, float tau_u_s, float grace_s, float d);
float waste_W(const Config& c, float z);
float daylight_term(const Config& c, float L_lux, bool light_on, bool ldr_valid);
float thermal_context_term(const Config& c, float Tz, float Tamb, bool valid);

// ----------------------------------------------------------------- Sensor validity
struct Reading {
  float value;
  uint64_t t_ms;
  bool valid;
  Reading() : value(NAN), t_ms(0), valid(false) {}
  Reading(float v, uint64_t t, bool ok) : value(v), t_ms(t), valid(ok) {}
};
bool is_fresh(const Reading& r, uint64_t now_ms, uint32_t stale_s);

// Median of the last three valid temperature samples (robust to single glitches).
class Median3 {
 public:
  void push(float v);
  bool ready() const { return n_ >= 1; }
  float value() const;
 private:
  float b_[3] = {NAN, NAN, NAN};
  int n_ = 0, i_ = 0;
};

// ----------------------------------------------------------------- Thermal screen
struct ThermalParams {
  float th1, th2, th3, th4;  // Eq. (7); th1 in (0,1), th4 >= 0
  bool valid;                // set only if validation beat persistence
  ThermalParams() : th1(0), th2(0), th3(0), th4(0), valid(false) {}
  ThermalParams(float a, float b, float c, float d, bool ok) : th1(a), th2(b), th3(c), th4(d), valid(ok) {}
};
// Returns true if a cooling switch-off must be vetoed. Conservative: missing or
// stale inputs or invalid parameters -> veto.
bool thermal_veto(const Config& c, const ThermalParams& p, bool Tz_ok, float Tz,
                  bool Tamb_ok, float Tamb, float O);
float thermal_predict(const ThermalParams& p, float Tz, float Tamb, float O, int uc, int steps);

// ----------------------------------------------------------------- Per-load controller
enum class LoadState : uint8_t { On = 0, Warning = 1, Off = 2 };
enum class Reason : uint8_t {
  None = 0, Proposed, VetoCycle, VetoThermal, WarningStarted, WarningCanceled,
  SwitchedOff, RestoredOccupancy, Startup
};
const char* reason_name(Reason r);

struct StepInput {
  uint64_t t_ms = 0;
  float O = 0;                 // fused occupancy estimate
  bool pir_active_now = false; // the slot just closed was active
  float d = 0;                 // context term for this load (daylight or thermal)
  bool cooling_veto = false;   // result of thermal_veto(); used only for Cooling loads
};

struct StepOutput {
  LoadState state = LoadState::On;
  bool load_on = true;         // desired physical state of the load
  bool warning = false;
  float z = 0, W = 0, tau_u_s = 0;
  Reason event = Reason::None; // non-None when something happened this step
};

class LoadController {
 public:
  LoadController(const Config& c, const LoadConfig& lc);
  void reset(uint64_t t_ms);                       // startup: load on (NC default)
  StepOutput step(const StepInput& in);
  LoadState state() const { return state_; }
 private:
  const Config& c_;
  const LoadConfig& lc_;
  LoadState state_ = LoadState::On;
  uint64_t last_presence_ms_ = 0;   // later of O >= threshold and last active PIR slot
  uint64_t on_since_ms_ = 0;
  uint64_t warning_since_ms_ = 0;
};

// Fixed-timeout reference controller (the paper's baseline): off after T seconds
// without PIR activity, back on at the first active slot.
class FixedTimeoutController {
 public:
  explicit FixedTimeoutController(uint32_t timeout_s) : timeout_s_(timeout_s) {}
  void reset(uint64_t t_ms) { last_ms_ = t_ms; on_ = true; }
  bool step(uint64_t t_ms, bool pir_active_now);
 private:
  uint32_t timeout_s_;
  uint64_t last_ms_ = 0;
  bool on_ = true;
};

// Relay coil level for a desired load state (NC wiring: coil energized = load off).
inline bool coil_energized(Wiring w, bool load_on) {
  return w == Wiring::NormallyClosed ? !load_on : load_on;
}

}  // namespace pn
