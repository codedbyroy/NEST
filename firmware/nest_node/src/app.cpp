// NEST application: setup() and loop() live here so that the .ino needs
// no generated prototypes (works with any Arduino builder).
#include <esp_task_wdt.h>
#include <rom/rtc.h>
#include <Arduino.h>
#include "core/pn_node.h"
#include "hw/hw.h"

// PN_ROOM_PROFILE=1 selects the classroom profile (CH1 lights, CH2 fans, CH3 AC) used
// by the room twin; still dry-run unless PN_DRY_RUN=0.
#ifndef PN_ROOM_PROFILE
#define PN_ROOM_PROFILE 0
#endif
static pn::Config g_cfg = PN_ROOM_PROFILE ? pn::room_profile_config() : pn::default_config();
static int g_pir_prev[2] = {-1, -1};
static pn::NodeLogic* g_node = nullptr;
static pn::SlotInputs g_in;
static pn::SlotOutputs g_last;
static uint64_t g_next_slot_ms = 0, g_next_dht_ms = 0, g_next_status_ms = 0, g_next_ui_ms = 0;
static uint32_t g_dht_errors = 0;
static int g_ldr_raw = -1;
static bool g_inject_pir = false;   // serial "pir" command (dry-run builds only)

static uint64_t now_ms() { return static_cast<uint64_t>(esp_timer_get_time() / 1000LL); }

static void log_status(uint64_t t) {
  char b[200];
  snprintf(b, sizeof b, "S,%llu,%d,%.3f,%.3f,%.3f,%.2f,%.1f,%d,%d,%d%d%d%d,%d%d%d%d,%u,%u",
           static_cast<unsigned long long>(t), g_last.active_slots, g_last.p_pir, g_last.p_env, g_last.O,
           g_in.Tz.valid ? g_in.Tz.value : NAN, g_in.RH.valid ? g_in.RH.value : NAN, g_ldr_raw,
           g_last.Tz_fresh ? 1 : 0, hw::relay_coil_state(0), hw::relay_coil_state(1), hw::relay_coil_state(2),
           hw::relay_coil_state(3), static_cast<int>(g_last.load[0].state), static_cast<int>(g_last.load[1].state),
           static_cast<int>(g_last.load[2].state), static_cast<int>(g_last.load[3].state), g_dht_errors,
           ESP.getFreeHeap());
  hw::log_line(b);
}

static void run_benchmark() {
  // On-device timing of the decision step and the optional model; prints raw numbers.
  pn::Config c = pn::default_config();
  pn::NodeLogic n(c);
  n.reset(0);
  pn::SlotInputs in;
  const int N = 1000;
  uint64_t t0 = esp_timer_get_time();
  for (int i = 0; i < N; ++i) { in.t_ms = (i + 1) * 10000ULL; in.slot_active = (i % 7) == 0; n.step(in); }
  uint64_t t1 = esp_timer_get_time();
  volatile float sink = 0;
  for (int i = 0; i < N; ++i) sink += pn::env_model_predict({22.0f + 0.001f * i, 40.0f, 0.05f});
  uint64_t t2 = esp_timer_get_time();
  Serial.printf("# bench node_step_us_mean=%.2f env_model_us_mean=%.2f n=%d heap_free=%u min_heap=%u sink=%.3f\n",
                (t1 - t0) / static_cast<double>(N), (t2 - t1) / static_cast<double>(N), N,
                ESP.getFreeHeap(), ESP.getMinFreeHeap(), static_cast<double>(sink));
}

static void handle_serial() {
  if (!Serial.available()) return;
  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  if (cmd == "status") log_status(now_ms());
  else if (cmd == "dump") hw::log_dump();
  else if (cmd == "clear") { hw::log_clear(); Serial.println("# log cleared"); }
  else if (cmd == "board") hw::print_board_info();
  else if (cmd == "bench") run_benchmark();
#if PN_DRY_RUN
  else if (cmd == "pir") { g_inject_pir = true; Serial.println("# injected PIR activity (dry run)"); }
#endif
  else Serial.println("# commands: status dump clear board bench"
#if PN_DRY_RUN
                      " pir"
#endif
                      );
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(200);
  hw::relays_begin();                 // first: keep every coil de-energized (loads in conventional state)
  hw::ui_begin();
  hw::pir_begin();
  hw::dht_begin();
  analogReadResolution(12);
  hw::log_begin();
  hw::print_board_info();
  char b[96];
  snprintf(b, sizeof b, "B,%llu,reset_reason=%d,dry_run=%d", static_cast<unsigned long long>(now_ms()),
           static_cast<int>(rtc_get_reset_reason(0)), PN_DRY_RUN);
  hw::log_line(b);
  hw::log_line("# S,t_ms,active_slots,p_pir,p_env,O,Tz,RH,ldr_raw,tz_fresh,coils,states,dht_errors,heap");
  hw::log_line("# E,t_ms,channel,event,z,W,tau_u_s,O");
  Serial.println("# serial only: L,t_ms,act,n,O_milli,s0..s3,W0..W3_milli,tau0..tau3 per slot; P,t_ms,pir1,pir2 on PIR change");
  Serial.printf("# profile=%s\n", PN_ROOM_PROFILE ? "room" : "bench");

  esp_task_wdt_init(WDT_TIMEOUT_S, true);  // panic + reboot if loop() stalls
  esp_task_wdt_add(nullptr);

  g_node = new pn::NodeLogic(g_cfg);
  const uint64_t t = now_ms();
  g_node->reset(t);
  g_next_slot_ms = t + g_cfg.slot_s * 1000ULL;
  g_next_dht_ms = t + 2000;            // DHT22 needs ~2 s after power-up
  g_next_status_ms = t + 60000;
}

void loop() {
  esp_task_wdt_reset();
  const uint64_t t = now_ms();
  hw::pir_poll();
  for (int k = 0; k < 2; ++k) {               // live PIR levels for the room twin (serial only)
    const int lv = hw::pir_level(k) ? 1 : 0;
    if (lv != g_pir_prev[k]) {
      g_pir_prev[k] = lv;
      Serial.printf("P,%llu,%d,%d\n", static_cast<unsigned long long>(t), g_pir_prev[0] < 0 ? 0 : g_pir_prev[0],
                    g_pir_prev[1] < 0 ? 0 : g_pir_prev[1]);
    }
  }
  handle_serial();

  if (t >= g_next_dht_ms) {
    g_next_dht_ms = t + g_cfg.dht_period_s * 1000ULL;
    float T, RH;
    if (hw::dht_read(&T, &RH)) { g_in.Tz = {T, t, true}; g_in.RH = {RH, t, true}; }
    else ++g_dht_errors;              // keep the last values; NodeLogic marks them stale after 60 s
    g_ldr_raw = hw::ldr_read_raw();   // logged for later lux calibration; not used for decisions
  }

  if (t >= g_next_slot_ms) {
    g_next_slot_ms += g_cfg.slot_s * 1000ULL;
    g_in.t_ms = t;
    g_in.slot_active = hw::pir_take_slot() || g_inject_pir;
    g_inject_pir = false;
    g_last = g_node->step(g_in);
    {                                           // per-slot decision line (serial only, not stored)
      const pn::StepOutput* L = g_last.load;
      Serial.printf("L,%llu,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%d,%.0f,%.0f,%.0f,%.0f\n",
                    static_cast<unsigned long long>(t), g_in.slot_active ? 1 : 0, g_last.active_slots,
                    static_cast<int>(g_last.O * 1000.0f + 0.5f), static_cast<int>(L[0].state), static_cast<int>(L[1].state),
                    static_cast<int>(L[2].state), static_cast<int>(L[3].state), static_cast<int>(L[0].W * 1000.0f + 0.5f),
                    static_cast<int>(L[1].W * 1000.0f + 0.5f), static_cast<int>(L[2].W * 1000.0f + 0.5f),
                    static_cast<int>(L[3].W * 1000.0f + 0.5f), L[0].tau_u_s, L[1].tau_u_s, L[2].tau_u_s, L[3].tau_u_s);
    }
    for (int ch = 0; ch < pn::kMaxLoads; ++ch) {
      const pn::StepOutput& o = g_last.load[ch];
      if (g_cfg.loads[ch].cls == pn::LoadClass::Unused) continue;
      const bool coil = pn::coil_energized(g_cfg.wiring, o.load_on);
      if (coil != hw::relay_coil_state(ch)) hw::relay_set_coil(ch, coil);
      if (o.event != pn::Reason::None && o.event != pn::Reason::VetoCycle) {
        char b[120];
        snprintf(b, sizeof b, "E,%llu,%d,%s,%.3f,%.3f,%.0f,%.3f", static_cast<unsigned long long>(t), ch,
                 pn::reason_name(o.event), o.z, o.W, o.tau_u_s, g_last.O);
        hw::log_line(b);
      }
    }
  }

  if (t >= g_next_status_ms) { g_next_status_ms = t + 60000; log_status(t); }

  if (t >= g_next_ui_ms) {
    g_next_ui_ms = t + 250;
    bool warning = false;
    for (int ch = 0; ch < pn::kMaxLoads; ++ch) warning |= g_last.load[ch].warning;
    const bool fault = !g_last.Tz_fresh;
    hw::ui_tick(t, warning, fault, g_last.O >= g_cfg.occupied_threshold || g_last.active_slots > 0);
    char l1[24], l2[24], l3[24], l4[24];
    snprintf(l1, sizeof l1, "PIR %d%d slots %d", hw::pir_level(0), hw::pir_level(1), g_last.active_slots);
    snprintf(l2, sizeof l2, "O=%.2f %s", g_last.O, warning ? "WARNING" : "");
    if (g_last.Tz_fresh) snprintf(l3, sizeof l3, "T %.1fC RH %.0f%%", g_in.Tz.value, g_in.RH.value);
    else snprintf(l3, sizeof l3, "DHT22 stale/err");
    snprintf(l4, sizeof l4, "CH1 %s tau %.0fs%s", g_last.load[0].load_on ? "ON " : "OFF",
             g_last.load[0].tau_u_s, PN_DRY_RUN ? " DRY" : "");
    hw::oled_show(l1, l2, l3, l4);
  }
}
