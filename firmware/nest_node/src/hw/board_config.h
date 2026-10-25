// Board-level configuration: GPIO map, relay polarity, safety switches.
// Target: ESP32-WROOM-32 class 38-pin dev board (verify the module marking; the
// firmware prints chip model, flash and PSRAM size at boot).
//
// Pin choices avoid: GPIO 6-11 (internal flash), strapping pins 0, 2, 5, 12, 15,
// GPIO 16/17 (PSRAM on WROVER modules), and GPIO 36/39 (spurious-interrupt erratum
// when Wi-Fi/ADC are active). GPIO 34/35 are input-only (fine for PIR outputs, which
// are driven push-pull by the HC-SR501). The LDR uses ADC1 (GPIO 32), which keeps
// working when Wi-Fi is on, unlike ADC2.
#pragma once

// ---------------- SAFETY ----------------
// PN_DRY_RUN = 1 (default): relay pins are NEVER configured as outputs; the firmware
// logs what it would do. Set to 0 only after the bench commissioning checklist
// (docs/COMMISSIONING.md) is complete, and only with the 5 V fan as the load.
#ifndef PN_DRY_RUN
#define PN_DRY_RUN 1
#endif

// ---------------- Sensors ----------------
#define PIN_PIR1 35          // HC-SR501 OUT (seating area)
#define PIN_PIR2 34          // HC-SR501 OUT (entrance)
#define PIN_DHT 4            // DHT22 data (module with pull-up, or add 10 kOhm to 3.3 V)
#define PIN_LDR_AO 32        // LM393 LDR module analog output (ADC1_CH4)
#define PIN_I2C_SDA 21       // OLED SSD1306
#define PIN_I2C_SCL 22
#define OLED_I2C_ADDR 0x3C   // most 0.96" modules; some use 0x3D (check the module)

// ---------------- Indicators ----------------
#define PIN_BUZZER 33        // active buzzer module (HIGH = on; check module polarity)
#define PIN_LED_R 18         // 3-colour LED module
#define PIN_LED_G 19
#define PIN_LED_B 13
#define LED_ACTIVE_HIGH 1    // set 0 for a common-anode module

// ---------------- Relays (4-channel 5 V board) ----------------
static const int RELAY_PINS[4] = {23, 25, 26, 27};
// Most of these boards are ACTIVE-LOW (IN = LOW energizes the coil). Confirm with
// test step C3 before enabling outputs. With RELAY_OPEN_DRAIN = 1 the coil is
// de-energized by switching the pin to high impedance, so the board's own pull-up
// on IN holds it off. This avoids the partial turn-on that can occur when a 3.3 V
// GPIO drives a 5 V opto input HIGH.
#define RELAY_ACTIVE_LOW 1
#define RELAY_OPEN_DRAIN 1

// ---------------- Logging ----------------
#define LOG_MAX_BYTES (256 * 1024)   // rotate /log.csv -> /log_prev.csv at this size
#define SERIAL_BAUD 115200
#define WDT_TIMEOUT_S 10
