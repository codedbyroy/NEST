// Host unit and integration tests for the NEST control core.
// Build/run: tests/run_tests.sh   (these run on the host computer, not on the ESP32)
#include <cmath>
#include <cstdio>
#include <functional>
#include <string>
#include <vector>
#include "../firmware/nest_node/src/core/pn_core.h"
#include "../firmware/nest_node/src/core/pn_node.h"

using namespace pn;
static int g_fail = 0, g_checks = 0;
#define CHECK(cond) do { ++g_checks; if (!(cond)) { ++g_fail; std::printf("  FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); } } while (0)
#define NEAR(a, b, tol) CHECK(std::fabs((a) - (b)) <= (tol))
struct T { const char* name; std::function<void()> fn; };
static std::vector<T>& reg() { static std::vector<T> v; return v; }
#define TEST(n) static void n(); static int n##_r = (reg().push_back({#n, n}), 0); static void n()

static const uint64_t S = 1000;  // ms per second

static Config fan_cfg(uint32_t grace = 600) {
  Config c = default_config();
  c.loads[0].grace_s = grace;
  return c;
}

// Runs a load controller with vacancy (O = 0, no PIR) from t0 for `secs`, 10 s steps.
static std::vector<StepOutput> run_vacant(LoadController& k, uint64_t t0, int secs) {
  std::vector<StepOutput> v;
  for (int s = 10; s <= secs; s += 10) { StepInput in; in.t_ms = t0 + s * S; v.push_back(k.step(in)); }
  return v;
}

// ------------------------------------------------------------------ waste score
TEST(z0_gives_trigger_at_085) {
  Config c = default_config();
  NEAR(waste_z0(c), 0.75555, 1e-4);
  NEAR(waste_W(c, 0.85f), 0.72, 1e-5);
  CHECK(waste_W(c, 0.8499f) < 0.72f);
}
TEST(guard_O_above_3_11_never_triggers) {
  Config c = default_config();
  for (float O : {0.2728f, 0.3f, 0.5f, 1.0f})
    CHECK(waste_W(c, waste_z(c, true, O, 1e9f, 600, 1.0f)) < c.trigger_W);
  CHECK(waste_W(c, waste_z(c, true, 0.2726f, 1e9f, 600, 1.0f)) >= c.trigger_W);
}
TEST(load_off_never_triggers) {
  Config c = default_config();
  CHECK(waste_W(c, waste_z(c, false, 0.0f, 1e9f, 600, 1.0f)) < c.trigger_W);
}
TEST(grace_properties) {
  Config c = default_config();
  CHECK(waste_W(c, waste_z(c, true, 0, 599.0f, 600, 0)) < c.trigger_W);
  CHECK(waste_W(c, waste_z(c, true, 0, 600.0f, 600, 0)) >= c.trigger_W - 1e-6f);
  CHECK(waste_W(c, waste_z(c, true, 0, 300.0f, 600, 1.0f)) >= c.trigger_W - 1e-6f);  // d = 1 halves it
  CHECK(waste_W(c, waste_z(c, true, 0, 290.0f, 600, 1.0f)) < c.trigger_W);
}
TEST(nan_inputs_do_not_switch_off) {
  Config c = default_config();
  float W = waste_W(c, waste_z(c, true, NAN, 1e9f, 600, 0));
  CHECK(!(W >= c.trigger_W));
}

// ------------------------------------------------------------------ PIR estimator
TEST(pir_slot_window_and_probability) {
  Config c = default_config();
  PirEstimator p(c);
  p.close_slot(true, 10 * S);
  CHECK(p.active_slots() == 1);
  NEAR(p.p_pir(), 0.39347, 1e-4);
  p.close_slot(true, 20 * S);
  NEAR(p.p_pir(), 0.63212, 1e-4);
  for (int i = 0; i < 29; ++i) p.close_slot(false, (30 + 10 * i) * S);
  CHECK(p.active_slots() == 1);          // first active slot has left the 30-slot window
  p.close_slot(false, 400 * S);
  CHECK(p.active_slots() == 0);
  NEAR(p.p_pir(), 0.0, 1e-9);
}
TEST(fusion_noisy_or) {
  NEAR(fuse_occupancy(0, 1, 0.5f), 0.5, 1e-6);
  NEAR(fuse_occupancy(0, 255.0f / 256, 0.5f), 0.498047, 1e-5);
  NEAR(fuse_occupancy(0.393f, 0, 0.5f), 0.393, 1e-6);
  NEAR(fuse_occupancy(0, 1, 0.0f), 0.0, 1e-9);
}

// ------------------------------------------------------------------ controller sequences
TEST(vacancy_warning_then_off) {
  Config c = fan_cfg(600);
  LoadController k(c, c.loads[0]);
  k.reset(0);
  auto v = run_vacant(k, 0, 700);
  int warn_at = -1, off_at = -1;
  for (size_t i = 0; i < v.size(); ++i) {
    if (v[i].event == Reason::WarningStarted) warn_at = static_cast<int>((i + 1) * 10);
    if (v[i].event == Reason::SwitchedOff) off_at = static_cast<int>((i + 1) * 10);
  }
  CHECK(warn_at == 600);
  CHECK(off_at == 630);
  CHECK(!v.back().load_on);
}
TEST(pir_during_warning_cancels) {
  Config c = fan_cfg(600);
  LoadController k(c, c.loads[0]);
  k.reset(0);
  run_vacant(k, 0, 610);                       // warning active
  StepInput in; in.t_ms = 620 * S; in.pir_active_now = true; in.O = 0.39f;
  StepOutput o = k.step(in);
  CHECK(o.event == Reason::WarningCanceled);
  CHECK(o.load_on);
  auto v = run_vacant(k, 620 * S, 590);       // timer restarted: no warning before 600 s more
  bool warned = false; for (auto& s : v) warned |= s.event == Reason::WarningStarted;
  CHECK(!warned);
}
TEST(single_pir_slot_restarts_timer) {
  Config c = fan_cfg(600);
  LoadController k(c, c.loads[0]);
  k.reset(0);
  run_vacant(k, 0, 500);
  StepInput in; in.t_ms = 510 * S; in.pir_active_now = true; in.O = 0.39f;  // O < 0.5
  StepOutput o = k.step(in);
  NEAR(o.tau_u_s, 0.0, 1e-6);
}
TEST(restore_on_presence_after_off) {
  Config c = fan_cfg(600);
  LoadController k(c, c.loads[0]);
  k.reset(0);
  run_vacant(k, 0, 700);
  StepInput in; in.t_ms = 710 * S; in.pir_active_now = true;
  StepOutput o = k.step(in);
  CHECK(o.event == Reason::RestoredOccupancy);
  CHECK(o.load_on);
}
TEST(cycle_guard_blocks_early_switch_off) {
  Config c = fan_cfg(60);                      // grace shorter than the 180 s cycle guard
  LoadController k(c, c.loads[0]);
  k.reset(0);
  auto v = run_vacant(k, 0, 300);
  bool veto = false; int off_at = -1;
  for (size_t i = 0; i < v.size(); ++i) {
    veto |= v[i].event == Reason::VetoCycle;
    if (v[i].event == Reason::SwitchedOff) off_at = static_cast<int>((i + 1) * 10);
  }
  CHECK(veto);
  CHECK(off_at == 210);                        // warning at 180 s (guard), off 30 s later
}
TEST(startup_counts_as_presence) {
  Config c = fan_cfg(600);
  LoadController k(c, c.loads[0]);
  k.reset(1000 * S);
  auto v = run_vacant(k, 1000 * S, 590);
  for (auto& s : v) CHECK(s.load_on && !s.warning);
}
TEST(unused_channel_never_switches) {
  Config c = default_config();
  LoadController k(c, c.loads[1]);
  k.reset(0);
  auto v = run_vacant(k, 0, 5000);
  for (auto& s : v) CHECK(s.load_on);
}
TEST(timestamps_beyond_32bit_ms) {
  Config c = fan_cfg(600);
  LoadController k(c, c.loads[0]);
  const uint64_t t0 = 4294967296ULL - 300 * S;  // crosses 2^32 ms (49.7 days) mid-run
  k.reset(t0);
  auto v = run_vacant(k, t0, 700);
  CHECK(!v.back().load_on);
}

// ------------------------------------------------------------------ thermal screen
TEST(thermal_veto_rules) {
  Config c = default_config(); c.thermal_enabled = true;
  ThermalParams p;                             // invalid by default
  CHECK(thermal_veto(c, p, true, 24, true, 30, 0));
  p = {0.1f, 0.0f, 0.0f, 0.5f, true};
  CHECK(thermal_veto(c, p, false, 24, true, 30, 0));   // stale zone temperature
  CHECK(thermal_veto(c, p, true, 24, false, 30, 0));   // no outdoor temperature
  // T: 24 -> 24.6 -> 25.14 (< 26): allowed
  CHECK(!thermal_veto(c, p, true, 24, true, 30, 0));
  NEAR(thermal_predict(p, 24, 30, 0, 0, 2), 25.14, 1e-4);
  // Hotter outside: 25 -> 26.0 -> 26.9 > 26: vetoed
  CHECK(thermal_veto(c, p, true, 25, true, 35, 0));
  ThermalParams bad = {1.2f, 0, 0, 0.5f, true};        // theta1 outside (0,1)
  CHECK(thermal_veto(c, bad, true, 24, true, 30, 0));
}
TEST(cooling_switch_off_requires_valid_thermal_model) {
  Config c = default_config();
  c.loads[0].cls = LoadClass::Cooling; c.loads[0].grace_s = 600;
  NodeLogic n(c);
  n.reset(0);
  bool off = false;
  for (int s = 10; s <= 2000; s += 10) {
    SlotInputs in; in.t_ms = s * S;
    in.Tz = {24.0f, in.t_ms, true}; in.RH = {50.0f, in.t_ms, true};
    off |= !n.step(in).load[0].load_on;
  }
  CHECK(!off);                                 // thermal screen disabled -> always vetoed
}

// ------------------------------------------------------------------ daylight term
TEST(daylight_requires_measured_luminaire_offset) {
  Config c = default_config();
  NEAR(daylight_term(c, 800, true, true), 0.0, 1e-9);   // L_lum unmeasured
  c.L_lum_lux = 250;
  NEAR(daylight_term(c, 400, true, true), 0.5, 1e-6);   // (400-250)/300
  NEAR(daylight_term(c, 400, false, true), 1.0, 1e-6);
  NEAR(daylight_term(c, 400, true, false), 0.0, 1e-9);  // LDR invalid
}

// ------------------------------------------------------------------ sensors, faults, restarts
TEST(median3_and_freshness) {
  Median3 m; m.push(24.0f); m.push(80.0f); m.push(24.2f);
  NEAR(m.value(), 24.2, 1e-6);
  Reading r{24.0f, 1000, true};
  CHECK(is_fresh(r, 61000, 60)); CHECK(!is_fresh(r, 61001, 60));
  r.valid = false; CHECK(!is_fresh(r, 1000, 60));
}
TEST(dht_fault_blocks_switch_off_when_env_model_enabled) {
  Config c = fan_cfg(600); c.beta = 0.5f;
  NodeLogic n(c); n.reset(0);
  bool off = false;
  for (int s = 10; s <= 2000; s += 10) {
    SlotInputs in; in.t_ms = s * S;            // DHT never valid
    SlotOutputs o = n.step(in);
    NEAR(o.p_env, 1.0, 1e-9);
    off |= !o.load[0].load_on;
  }
  CHECK(!off);
}
TEST(out_of_range_temperature_is_not_fresh) {
  Config c = fan_cfg(600); c.beta = 0.5f;
  NodeLogic n(c); n.reset(0);
  SlotInputs in; in.t_ms = 10 * S; in.Tz = {85.0f, in.t_ms, true}; in.RH = {50, in.t_ms, true};
  SlotOutputs o = n.step(in);
  CHECK(!o.Tz_fresh);
  NEAR(o.p_env, 1.0, 1e-9);
}
TEST(pir_only_ignores_dht_and_network) {
  Config c = fan_cfg(600);                      // beta = 0, no Tamb ("Wi-Fi lost")
  NodeLogic n(c); n.reset(0);
  int off_at = -1;
  for (int s = 10; s <= 1000; s += 10) {
    SlotInputs in; in.t_ms = s * S;
    SlotOutputs o = n.step(in);
    if (!o.load[0].load_on && off_at < 0) off_at = s;
  }
  CHECK(off_at == 630);
}
TEST(restart_restores_conventional_state) {
  Config c = fan_cfg(600);
  NodeLogic n(c); n.reset(0);
  for (int s = 10; s <= 1000; s += 10) { SlotInputs in; in.t_ms = s * S; n.step(in); }
  NodeLogic n2(c); n2.reset(1000 * S);          // simulated reboot
  SlotInputs in; in.t_ms = 1010 * S;
  CHECK(n2.step(in).load[0].load_on);
}
TEST(coil_level_for_wiring) {
  CHECK(coil_energized(Wiring::NormallyClosed, false));
  CHECK(!coil_energized(Wiring::NormallyClosed, true));
  CHECK(coil_energized(Wiring::NormallyOpen, true));
}
TEST(env_model_output_range_and_history) {
  for (float T : {10.0f, 20.0f, 30.0f})
    for (float RH : {10.0f, 40.0f, 90.0f}) {
      float p = env_model_predict({T, RH, 0.1f});
      CHECK(p >= 0.0f && p <= 1.0f);
    }
  EnvHistory h;
  for (int i = 0; i < 6; ++i) h.push_minute(20.0f + 0.1f * i);
  CHECK(h.ready());
  NEAR(h.d5(), 0.5, 1e-5);
}
TEST(baseline_fixed_timeout) {
  FixedTimeoutController b(600);
  b.reset(0);
  CHECK(b.step(590 * S, false));
  CHECK(!b.step(600 * S, false));
  CHECK(b.step(610 * S, true));
}

int main() {
  for (auto& t : reg()) {
    int before = g_fail;
    t.fn();
    std::printf("%s %s\n", g_fail == before ? "PASS" : "FAIL", t.name);
  }
  std::printf("\n%zu tests, %d checks, %d failures\n", reg().size(), g_checks, g_fail);
  return g_fail ? 1 : 0;
}
