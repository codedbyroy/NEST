// NEST node firmware (ESP32 + 2x HC-SR501 + DHT22 + LDR + 4-ch relay).
// All occupancy and switching decisions are made locally; no network is required.
// Build: arduino-cli compile --fqbn esp32:esp32:esp32 firmware/nest_node
// SAFETY: builds are dry-run by default (PN_DRY_RUN=1 in src/hw/board_config.h).

// The application code is in src/app.cpp (setup() and loop()).
