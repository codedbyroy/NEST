// ESP32 hardware layer: sensors, relays, indicators, log storage.
#pragma once
#include <Arduino.h>
#include "board_config.h"
#include "../core/pn_core.h"

namespace hw {

// ---- PIR: interrupt-latched rising edges plus level polling ----
void pir_begin();
void pir_poll();                    // call often (every loop): ORs the output level into the slot
bool pir_take_slot();               // returns and clears "active in this slot"
bool pir_level(int which);          // instantaneous output levels, for the display

// ---- DHT22 (>= 2 s between reads; we read every Config::dht_period_s) ----
void dht_begin();
bool dht_read(float* T, float* RH);  // false on checksum/timeout error or NaN

// ---- LDR raw ADC (0..4095), averaged; not calibrated to lux ----
int ldr_read_raw();

// ---- Relays ----
void relays_begin();                 // leaves every channel de-energized (high impedance)
void relay_set_coil(int ch, bool energized);
bool relay_coil_state(int ch);       // what the firmware has commanded

// ---- Indicators ----
void ui_begin();
void ui_tick(uint64_t now_ms, bool warning, bool fault, bool occupied);
void oled_show(const char* l1, const char* l2, const char* l3, const char* l4);

// ---- Log storage (LittleFS) ----
bool log_begin();
void log_line(const char* line);     // appends to /log.csv and mirrors to Serial
void log_dump();                     // prints both log files to Serial
void log_clear();

// ---- Board report ----
void print_board_info();

}  // namespace hw
