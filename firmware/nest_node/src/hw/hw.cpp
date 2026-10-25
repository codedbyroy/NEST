#include "hw.h"
#include <DHT.h>
#include <FS.h>
#include <LittleFS.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <esp_chip_info.h>
#include <esp_flash.h>

namespace hw {

// ------------------------------------------------------------------ PIR
static volatile bool s_edge[2] = {false, false};
static bool s_level_seen = false;
static void IRAM_ATTR isr_pir1() { s_edge[0] = true; }
static void IRAM_ATTR isr_pir2() { s_edge[1] = true; }

void pir_begin() {
  pinMode(PIN_PIR1, INPUT);           // GPIO 34/35 have no internal pulls; HC-SR501 drives the line
  pinMode(PIN_PIR2, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_PIR1), isr_pir1, RISING);
  attachInterrupt(digitalPinToInterrupt(PIN_PIR2), isr_pir2, RISING);
}

void pir_poll() {
  if (digitalRead(PIN_PIR1) == HIGH || digitalRead(PIN_PIR2) == HIGH) s_level_seen = true;
}

bool pir_take_slot() {
  noInterrupts();
  const bool edge = s_edge[0] || s_edge[1];
  s_edge[0] = s_edge[1] = false;
  interrupts();
  const bool active = edge || s_level_seen;
  s_level_seen = false;
  return active;
}

bool pir_level(int which) { return digitalRead(which == 0 ? PIN_PIR1 : PIN_PIR2) == HIGH; }

// ------------------------------------------------------------------ DHT22
static DHT s_dht(PIN_DHT, DHT22);
void dht_begin() { s_dht.begin(); }
bool dht_read(float* T, float* RH) {
  const float t = s_dht.readTemperature();
  const float h = s_dht.readHumidity();
  if (isnan(t) || isnan(h)) return false;
  *T = t; *RH = h;
  return true;
}

// ------------------------------------------------------------------ LDR
int ldr_read_raw() {
  long acc = 0;
  for (int i = 0; i < 8; ++i) acc += analogRead(PIN_LDR_AO);
  return static_cast<int>(acc / 8);
}

// ------------------------------------------------------------------ Relays
static bool s_coil[4] = {false, false, false, false};

static void drive_pin(int pin, bool energized) {
#if PN_DRY_RUN
  (void)pin; (void)energized;           // never touch relay pins in dry-run builds
#else
  const bool level_on = RELAY_ACTIVE_LOW ? LOW : HIGH;
  if (energized) {
    digitalWrite(pin, level_on);
    pinMode(pin, OUTPUT);
    digitalWrite(pin, level_on);
  } else if (RELAY_OPEN_DRAIN && RELAY_ACTIVE_LOW) {
    pinMode(pin, INPUT);                // high impedance: board pull-up keeps the coil off
  } else {
    digitalWrite(pin, !level_on);
    pinMode(pin, OUTPUT);
    digitalWrite(pin, !level_on);
  }
#endif
}

void relays_begin() {
  for (int ch = 0; ch < 4; ++ch) {
#if !PN_DRY_RUN
    pinMode(RELAY_PINS[ch], INPUT);     // stay high-impedance until the first decision
#endif
    s_coil[ch] = false;
    drive_pin(RELAY_PINS[ch], false);
  }
}

void relay_set_coil(int ch, bool energized) {
  if (ch < 0 || ch > 3) return;
  s_coil[ch] = energized;
  drive_pin(RELAY_PINS[ch], energized);
}

bool relay_coil_state(int ch) { return (ch >= 0 && ch < 4) ? s_coil[ch] : false; }

// ------------------------------------------------------------------ Indicators
static Adafruit_SSD1306 s_oled(128, 64, &Wire, -1);
static bool s_oled_ok = false;

static void led(bool r, bool g, bool b) {
  const int on = LED_ACTIVE_HIGH ? HIGH : LOW, off = LED_ACTIVE_HIGH ? LOW : HIGH;
  digitalWrite(PIN_LED_R, r ? on : off);
  digitalWrite(PIN_LED_G, g ? on : off);
  digitalWrite(PIN_LED_B, b ? on : off);
}

void ui_begin() {
  pinMode(PIN_BUZZER, OUTPUT); digitalWrite(PIN_BUZZER, LOW);
  pinMode(PIN_LED_R, OUTPUT); pinMode(PIN_LED_G, OUTPUT); pinMode(PIN_LED_B, OUTPUT);
  led(false, false, false);
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  s_oled_ok = s_oled.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR);
  if (s_oled_ok) { s_oled.clearDisplay(); s_oled.setTextSize(1); s_oled.setTextColor(SSD1306_WHITE); s_oled.display(); }
}

// Warning: buzzer 200 ms on / 800 ms off and red LED. Fault: red blinking.
// Occupied: green. Vacant (counting down): blue.
void ui_tick(uint64_t now_ms, bool warning, bool fault, bool occupied) {
  const uint32_t ph = static_cast<uint32_t>(now_ms % 1000ULL);
  digitalWrite(PIN_BUZZER, (warning && ph < 200) ? HIGH : LOW);
  if (warning) led(true, false, false);
  else if (fault) led(ph < 500, false, false);
  else if (occupied) led(false, true, false);
  else led(false, false, true);
}

void oled_show(const char* l1, const char* l2, const char* l3, const char* l4) {
  if (!s_oled_ok) return;
  s_oled.clearDisplay();
  s_oled.setCursor(0, 0);  s_oled.print(l1);
  s_oled.setCursor(0, 16); s_oled.print(l2);
  s_oled.setCursor(0, 32); s_oled.print(l3);
  s_oled.setCursor(0, 48); s_oled.print(l4);
  s_oled.display();
}

// ------------------------------------------------------------------ Log storage
static bool s_fs_ok = false;
bool log_begin() { s_fs_ok = LittleFS.begin(true); return s_fs_ok; }

void log_line(const char* line) {
  Serial.println(line);
  if (!s_fs_ok) return;
  File f = LittleFS.open("/log.csv", FILE_APPEND);
  if (!f) return;
  f.println(line);
  const size_t sz = f.size();
  f.close();
  if (sz > LOG_MAX_BYTES) {
    LittleFS.remove("/log_prev.csv");
    LittleFS.rename("/log.csv", "/log_prev.csv");
  }
}

static void dump_file(const char* path) {
  File f = LittleFS.open(path, FILE_READ);
  if (!f) return;
  Serial.printf("# ---- %s (%u bytes)\n", path, static_cast<unsigned>(f.size()));
  while (f.available()) Serial.write(f.read());
  f.close();
}
void log_dump() { if (s_fs_ok) { dump_file("/log_prev.csv"); dump_file("/log.csv"); } }
void log_clear() { if (s_fs_ok) { LittleFS.remove("/log.csv"); LittleFS.remove("/log_prev.csv"); } }

// ------------------------------------------------------------------ Board report
void print_board_info() {
  esp_chip_info_t info; esp_chip_info(&info);
  uint32_t flash = 0; esp_flash_get_size(nullptr, &flash);
  Serial.printf("# chip=%s rev=%d cores=%d flash=%u B psram=%u B heap_free=%u B sketch=%u B free_sketch=%u B sdk=%s\n",
                ESP.getChipModel(), info.revision, info.cores, flash, ESP.getPsramSize(),
                ESP.getFreeHeap(), ESP.getSketchSize(), ESP.getFreeSketchSpace(), ESP.getSdkVersion());
  Serial.printf("# dry_run=%d relay_active_low=%d open_drain=%d\n", PN_DRY_RUN, RELAY_ACTIVE_LOW, RELAY_OPEN_DRAIN);
}

}  // namespace hw
