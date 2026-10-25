# NEST node firmware

Local occupancy control for one room on an ESP32 with 2× HC-SR501 PIR, DHT22, LM393 LDR,
a 4-channel 5 V relay board, 0.96" OLED, active buzzer and 3-colour LED. No network or
cloud service is needed for control.

**Safety: the default build is dry-run.** Relay pins are never configured as outputs
unless the build defines `PN_DRY_RUN=0`. Follow `docs/COMMISSIONING.md` before doing that,
and use only the 5 V fan as a load in this phase.

## Layout

```
firmware/nest_node/
  nest_node.ino          (empty sketch file; Arduino entry point)
  src/app.cpp                setup()/loop(): scheduler, logging, serial commands
  src/hw/board_config.h      GPIO map, relay polarity, dry-run switch, log size
  src/hw/hw.{h,cpp}          PIR, DHT22, LDR, relays, OLED/buzzer/LED, LittleFS log
  src/core/                  portable C++ (also compiled by the host tests and simulator)
    pn_config.h              all thresholds and timings (design defaults)
    pn_core.{h,cpp}          PIR estimator, waste score, load controller, thermal screen
    pn_node.{h,cpp}          NodeLogic: one decision per 10 s slot
    pn_env_model.*           optional environment model (disabled: beta = 0)
```

## Build and flash

Arduino IDE 2: install "esp32 by Espressif Systems" **2.0.17** and the libraries
DHT sensor library 1.4.6, Adafruit Unified Sensor 1.1.14, Adafruit SSD1306 2.5.13,
Adafruit GFX 1.11.11, Adafruit BusIO 1.16.2. Open `nest_node/nest_node.ino`,
select board "ESP32 Dev Module", upload.

arduino-cli:
```
arduino-cli compile --fqbn esp32:esp32:esp32 firmware/nest_node
arduino-cli upload  --fqbn esp32:esp32:esp32 -p /dev/ttyUSB0 firmware/nest_node
# relay-enabled build (only after commissioning steps A-B):
arduino-cli compile --fqbn esp32:esp32:esp32 --build-property "compiler.cpp.extra_flags=-DPN_DRY_RUN=0" firmware/nest_node
```
Build output on 2026-10-15 (host compile, not an on-device measurement): 353,965 bytes
of flash (27% of the 1,310,720-byte app partition), 23,052 bytes of static RAM.

## Behaviour (defaults in `pn_config.h`)

* Every 10 s slot is *active* if either PIR produced a rising edge or was high. `p_pir = 1 − exp(−n/2)` over the last 30 slots (5 min).
* A load is proposed for switch-off when its waste score `W ≥ 0.72`: in practice no active slot for 5 min **and** the grace period elapsed since the last presence (600 s for fans/cooling, 180 s for lighting; for lighting the 5-min window dominates).
* A 30 s buzzer/LED warning precedes every switch-off; any PIR activity cancels it.
* A load must have been on 180 s before it can be switched off (cycle guard). Restoring a load on presence is never delayed.
* Cooling loads are switched off only with a validated thermal model (`thermal_enabled`, off by default); otherwise vetoed.
* On boot every relay is de-energized; with NC wiring all loads are ON.

## Serial commands (115200 baud)

`status` · `dump` (print logs) · `clear` · `board` (chip/flash/PSRAM/heap) · `bench`
(on-device timing of the decision step and the optional model) · `pir` (dry-run builds
only: inject one active slot).

## Log format (`/log.csv` on LittleFS, rotated to `/log_prev.csv` at 256 KB)

```
B,t_ms,reset_reason=N,dry_run=D                              boot
S,t_ms,active_slots,p_pir,p_env,O,Tz,RH,ldr_raw,tz_fresh,coils,states,dht_errors,heap   every 60 s
E,t_ms,channel,event,z,W,tau_u_s,O                           every decision event
```
Events: `warning_started`, `warning_canceled`, `switched_off`, `restored_occupancy`, `veto_thermal`.
Together with the per-minute status lines these reconstruct each decision.

## Tests and simulations (host computer)

```
tests/run_tests.sh                                  # 26 test groups, ASan/UBSan
g++ -std=c++17 -O2 -o build/replay tools/sim/replay.cpp firmware/nest_node/src/core/*.cpp
python3 -I tools/sim/run_simulations.py <Occupancy-detection-data> build/replay results/simulations
```
Host tests and simulations are not ESP32 measurements.
