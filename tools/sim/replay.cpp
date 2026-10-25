// Host replay simulator. Drives the firmware's NodeLogic (or the fixed-timeout
// baseline) with a slot-by-slot input file and reports metrics as one JSON line.
// This is a SIMULATION: occupancy/temperature come from a dataset, PIR events are
// synthetic, and in --thermal mode the room temperature is simulated.
//
// Input CSV (header line skipped): t_s,slot_active,Tz,RH,occ_true,Tamb
// Usage: replay <input.csv> key=value ...   (see parse_args)
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include "../../firmware/nest_node/src/core/pn_node.h"

using namespace pn;

struct Args {
  std::string mode = "nest";   // nest | baseline
  int baseline_timeout_s = 600;
  float beta = 0.0f, kappa = 2.0f;
  int grace_s = 600;
  std::string load = "fan";        // fan | lighting | cooling
  int warning_s = 30, min_on_s = 180;
  // thermal mode (simulated room; all parameters ASSUMED)
  bool thermal = false;
  bool screen = true;              // false = ablation: cooling switch-offs never vetoed
  float tau_h = 3.0f;              // true room time constant R*C (hours)
  float tau_model_scale = 1.0f;    // screen model's tau relative to the true one
  float A_K = 1.0f, B_K = 2.0f, Cc_K = 12.0f;  // R*q0, R*q1, R*Qc in kelvin
  float setpoint_C = 24.0f, hyst_K = 1.0f, T_comfort = 26.0f;
};

static Args parse_args(int argc, char** argv) {
  Args a;
  for (int i = 2; i < argc; ++i) {
    const char* kv = argv[i]; const char* eq = strchr(kv, '=');
    if (!eq) continue;
    std::string k(kv, eq - kv); const char* v = eq + 1;
    if (k == "mode") a.mode = v; else if (k == "timeout") a.baseline_timeout_s = atoi(v);
    else if (k == "beta") a.beta = atof(v); else if (k == "kappa") a.kappa = atof(v);
    else if (k == "grace") a.grace_s = atoi(v); else if (k == "load") a.load = v;
    else if (k == "warning") a.warning_s = atoi(v); else if (k == "min_on") a.min_on_s = atoi(v);
    else if (k == "thermal") a.thermal = atoi(v) != 0; else if (k == "screen") a.screen = atoi(v) != 0;
    else if (k == "tau_h") a.tau_h = atof(v); else if (k == "tau_model_scale") a.tau_model_scale = atof(v);
    else if (k == "Cc_K") a.Cc_K = atof(v);
    else { fprintf(stderr, "unknown arg %s\n", k.c_str()); exit(2); }
  }
  return a;
}

struct Row { double t_s; int act; float Tz, RH; int occ; float Tamb; };

int main(int argc, char** argv) {
  if (argc < 2) { fprintf(stderr, "usage: replay input.csv k=v...\n"); return 2; }
  Args a = parse_args(argc, argv);
  std::vector<Row> rows;
  {
    FILE* f = fopen(argv[1], "r"); if (!f) { perror("open"); return 2; }
    char line[256]; if (!fgets(line, sizeof line, f)) { fclose(f); return 2; }
    Row r;
    while (fscanf(f, "%lf,%d,%f,%f,%d,%f", &r.t_s, &r.act, &r.Tz, &r.RH, &r.occ, &r.Tamb) == 6) rows.push_back(r);
    fclose(f);
  }
  if (rows.empty()) { fprintf(stderr, "no rows\n"); return 2; }

  Config c = default_config();
  c.beta = a.beta; c.kappa_slots = a.kappa; c.warning_s = a.warning_s; c.min_on_before_off_s = a.min_on_s;
  LoadClass cls = a.load == "lighting" ? LoadClass::Lighting : a.load == "cooling" ? LoadClass::Cooling : LoadClass::Fan;
  c.loads[0].cls = cls; c.loads[0].grace_s = a.grace_s; c.loads[0].name = "sim";
  if (a.thermal) {
    c.thermal_enabled = a.screen;
    c.sim_allow_cooling_without_model = !a.screen;
  }
  NodeLogic node(c);
  // Screen model parameters at h = 15 min derived from the (possibly mis-specified) tau.
  {
    const float tau_s = a.tau_h * 3600.0f * a.tau_model_scale;
    const float th1 = 1.0f - expf(-900.0f / tau_s);
    node.thermal = ThermalParams(th1, th1 * a.A_K, th1 * a.B_K, th1 * a.Cc_K, true);
  }
  FixedTimeoutController base(a.baseline_timeout_s);

  const uint64_t t0 = static_cast<uint64_t>(rows[0].t_s * 1000.0);
  node.reset(t0); base.reset(t0);

  double dt = 10.0, uot = 0, mt = 0, on = 0, occ_s = 0, comfort_exceed = 0, compressor_s = 0;
  long switch_offs = 0, restores = 0, warnings = 0, canceled = 0, vetoes_thermal = 0;
  bool prev_on = true;
  float Troom = a.setpoint_C; bool comp = false;
  const float tau_true_s = a.tau_h * 3600.0f;
  for (size_t k = 0; k < rows.size(); ++k) {
    const Row& r = rows[k];
    const uint64_t t = static_cast<uint64_t>(r.t_s * 1000.0);
    bool on_now;
    if (a.mode == "baseline") {
      on_now = base.step(t, r.act != 0);
    } else {
      SlotInputs in; in.t_ms = t; in.slot_active = r.act != 0;
      float Tz = a.thermal ? roundf(Troom * 10.0f) / 10.0f : r.Tz;   // DHT22 0.1 degC resolution
      in.Tz = Reading(Tz, t, true); in.RH = Reading(r.RH, t, true);
      if (a.thermal) in.Tamb = Reading(r.Tamb, t, true);
      SlotOutputs o = node.step(in);
      on_now = o.load[0].load_on;
      switch (o.load[0].event) {
        case Reason::SwitchedOff: ++switch_offs; break;
        case Reason::RestoredOccupancy: ++restores; break;
        case Reason::WarningStarted: ++warnings; break;
        case Reason::WarningCanceled: ++canceled; break;
        case Reason::VetoThermal: ++vetoes_thermal; break;
        default: break;
      }
    }
    if (a.mode == "baseline" && prev_on && !on_now) ++switch_offs;
    if (a.mode == "baseline" && !prev_on && on_now) ++restores;
    prev_on = on_now;
    if (on_now) on += dt;
    if (on_now && !r.occ) uot += dt;
    if (!on_now && r.occ) mt += dt;
    if (r.occ) occ_s += dt;
    if (a.thermal) {
      // Thermostat inside the AC: runs only while the load is enabled.
      if (!on_now) comp = false;
      else if (Troom > a.setpoint_C + a.hyst_K) comp = true;
      else if (Troom < a.setpoint_C - a.hyst_K) comp = false;
      if (comp) compressor_s += dt;
      const float target = r.Tamb + a.A_K + a.B_K * r.occ - (comp ? a.Cc_K : 0.0f);
      Troom += (1.0f - expf(-static_cast<float>(dt) / tau_true_s)) * (target - Troom);
      if (r.occ && Troom > a.T_comfort) comfort_exceed += dt;
    }
  }
  const double days = rows.size() * dt / 86400.0;
  printf("{\"slots\":%zu,\"days\":%.4f,\"occupied_min\":%.1f,\"on_min\":%.1f,\"uot_min\":%.1f,\"miss_min\":%.1f,"
         "\"switch_offs\":%ld,\"restores\":%ld,\"warnings\":%ld,\"warnings_canceled\":%ld,\"thermal_vetoes\":%ld,"
         "\"compressor_min\":%.1f,\"comfort_exceed_min\":%.1f}\n",
         rows.size(), days, occ_s / 60, on / 60, uot / 60, mt / 60, switch_offs, restores, warnings, canceled,
         vetoes_thermal, compressor_s / 60, comfort_exceed / 60);
  return 0;
}
