// NodeLogic: one decision step per PIR slot. Shared verbatim by the ESP32 firmware
// and the host replay simulator, so simulations exercise the deployed logic.
#pragma once
#include "pn_core.h"
#include "pn_env_model.h"

namespace pn {

struct SlotInputs {
  uint64_t t_ms = 0;
  bool slot_active = false;       // either PIR produced an edge or was high in this slot
  Reading Tz, RH;                 // latest DHT22 values (Reading.valid false on error)
  Reading light_lux;              // calibrated lux; invalid until LDR calibration exists
  Reading Tamb;                   // outdoor temperature (optional; usually invalid offline)
};

struct SlotOutputs {
  float p_pir = 0, p_env = 0, O = 0;
  int active_slots = 0;
  bool env_used = false, Tz_fresh = false;
  StepOutput load[kMaxLoads];
};

class NodeLogic {
 public:
  explicit NodeLogic(const Config& c);
  void reset(uint64_t t_ms);
  SlotOutputs step(const SlotInputs& in);
  ThermalParams thermal;           // set by the backend after validation; invalid by default
 private:
  const Config& c_;
  PirEstimator pir_;
  LoadController ctl_[kMaxLoads];
  EnvHistory env_hist_;
  Median3 tz_med_;
  uint64_t last_minute_ms_ = 0;
  uint64_t last_tz_t_ms_ = 0;
};

}  // namespace pn
