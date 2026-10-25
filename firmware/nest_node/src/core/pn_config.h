// NEST controller configuration.
// Every tunable parameter lives here. Values are DESIGN DEFAULTS, not calibrated
// on a real room; see firmware/README.md and docs/MODEL_SELECTION.md before changing them.
#pragma once
#include <stdint.h>

namespace pn {

enum class LoadClass : uint8_t { Lighting = 0, Fan = 1, Cooling = 2, Unused = 3 };
enum class Wiring : uint8_t { NormallyClosed = 0, NormallyOpen = 1 };

constexpr int kMaxLoads = 4;

struct LoadConfig {
  LoadClass cls = LoadClass::Unused;
  const char* name = "unused";
  uint32_t grace_s = 600;          // tau_th: 180 s lighting, 600 s fan/cooling
  float rated_w = 0.0f;            // nameplate or spot-measured load power (W), for estimates only
};

struct Config {
  // ---- PIR slot estimator (Sec. IV-B) ----
  uint32_t slot_s = 10;            // slot length; a slot is active if a PIR edge was latched or the output was high
  uint32_t window_slots = 30;      // 30 x 10 s = 5 min window
  float kappa_slots = 2.0f;        // p_pir = 1 - exp(-n / kappa)
  float beta = 0.0f;               // weight of the optional environmental model; 0 = PIR-only (default)
  float occupied_threshold = 0.5f; // O >= 0.5 -> occupied

  // ---- Waste score (Sec. IV-C) ----
  float w1 = 0.55f, w2 = 0.30f, w3 = 0.15f;
  float gamma = 10.0f;
  float trigger_W = 0.72f;         // z0 is derived so that W = trigger_W at z = z_at_trigger
  float z_at_trigger = 0.85f;
  float L_ref_lux = 300.0f;
  float L_lum_lux = -1.0f;         // luminaire contribution at the sensor; < 0 = not measured -> daylight term 0
  float dT_ref_K = 10.0f;

  // ---- Actuation ----
  uint32_t warning_s = 30;         // audible/visual warning before switch-off; any PIR activity cancels
  uint32_t min_on_before_off_s = 180;  // cycle guard: a load must have been on this long before a switch-off
  Wiring wiring = Wiring::NormallyClosed;

  // ---- Sensors ----
  uint32_t dht_period_s = 10;      // DHT22 needs >= 2 s between reads
  uint32_t sensor_stale_s = 60;    // reading older than this is stale
  float T_min_C = -10.0f, T_max_valid_C = 60.0f;

  // ---- Thermal screen (Sec. IV-D); only for Cooling loads ----
  bool thermal_enabled = false;    // no cooling load in the bench inventory
  bool sim_allow_cooling_without_model = false;  // SIMULATION ABLATION ONLY: never true in firmware
  float T_comfort_max_C = 26.0f;
  uint32_t model_step_s = 900;     // h = 15 min; horizon = 2 steps
  int horizon_steps = 2;

  LoadConfig loads[kMaxLoads];
};

// Default configuration for the bench inventory: channel 1 drives the 5 V fan test load.
Config default_config();

// Room profile used for the classroom demonstration and the room twin:
// CH1 lighting bank (180 s), CH2 ceiling-fan bank (600 s), CH3 air conditioner
// (cooling; vetoed until a validated thermal model exists), CH4 unused.
// Still dry-run unless the build sets PN_DRY_RUN=0.
Config room_profile_config();

}  // namespace pn
