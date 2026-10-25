# NEST

Occupancy-based switching of classroom lights and fans. One ESP32 node per zone reads two
PIR sensors, estimates whether the zone is in use, and after a grace period gives a 30 s
warning before opening that zone's relay. Every decision is made on the node; no network
or cloud service is needed for control. A browser dashboard shows a simulated building,
estimates installation cost and payback, and can read a node over USB.

Final-year project, Department of ISE, Cambridge Institute of Technology.

## What exists and how it was checked

| Part | Where | Status |
| --- | --- | --- |
| Node firmware (ESP32, 2× HC-SR501, DHT22, LDR, 4-channel relay, OLED, buzzer, LED) | `firmware/nest_node/` | Compiled for `esp32:esp32:esp32` (Arduino core 2.0.17, build output 15 Oct 2026). **Dry-run by default**: relay pins are never driven unless built with `PN_DRY_RUN=0`. Bench validation on the assembled board is still to be done (`docs/COMMISSIONING.md`). |
| Portable decision core (C++) | `firmware/nest_node/src/core/` | Host unit tests: `tests/run_tests.sh` (ASan/UBSan) |
| JavaScript port of the core | `tools/twin/pn_core.js` | Checked slot by slot against the C++ trace (`tools/twin/verify_js_port.js`) |
| Simulations E1–E5 | `tools/sim/`, `results/simulations/` | Public occupancy dataset (Candanedo–Feldheim) with **synthetic** PIR events; not hardware measurements |
| Dashboard | `tools/dashboard/v2/` → `results/nest/NEST_Dashboard.html` | Placeholder DKM block, simulated occupancy; cost estimate with sourced prices; read-only Web Serial link |
| Optional environment model (disabled) | `ml/`, `pn_env_model.*` | Exported to C and checked against TFLite |

Nothing in this repository is a measured energy saving. The prototype kit has no energy
meter; measured kWh needs a meter on the switched circuits (see the dashboard's
*Savings & cost* page).

## Layout

```
firmware/nest_node/     ESP32 firmware (Arduino); src/core is plain C++ shared with tests and tools
tests/                  host unit and integration tests for the core
tools/sim/              replay simulator, simulation suite, figure redraw
tools/twin/             room twin: JS port of the core, replay day, port check
tools/host/             host CLI for the optional environment model
tools/dashboard/        building simulation (sim.js) and the v2 dashboard sources
ml/                     optional environment model export and offline checks
results/                simulation results, room twin page, built dashboard
docs/                   wiring, commissioning checklist, model selection, cost and savings
```

## Use

Dashboard: open `results/nest/NEST_Dashboard.html` in Chrome or Edge. It works offline.
The ESP32 link needs the file opened from your computer (not from inside another page) and
a node built with the room profile.

Rebuild the dashboard:
```
python3 -I tools/dashboard/v2/build.py . results/nest/nest_dashboard_artifact.html
cp results/nest/nest_dashboard_artifact_local.html results/nest/NEST_Dashboard.html
```

Tests:
```
tests/run_tests.sh                                   # C++ core (needs g++ with sanitizers)
node tools/dashboard/v2/model_test.js                # dashboard data layer
node tools/dashboard/v2/cost_test.js                 # cost, running cost and payback
node tools/dashboard/v2/ui_test.js                   # browser tests (Playwright); also
node tools/dashboard/v2/savings_serial_test.js       #   PW_CHROMIUM=/path/to/chromium if needed
node tools/dashboard/v2/motion_test.js
```

Firmware (room profile, still dry-run):
```
arduino-cli compile --fqbn esp32:esp32:esp32 \
  --build-property "compiler.cpp.extra_flags=-DPN_ROOM_PROFILE=1" firmware/nest_node
```
See `firmware/README.md` for libraries, serial commands and the log format.

## Safety

Keep the prototype on its 5 V fan. Lights and fans run on 230 V: switched circuits need rated
contactors, MCB protection, a closed enclosure with the mains side separated from the
low-voltage side, earthing, and installation and inspection by a qualified electrician.
Follow `docs/COMMISSIONING.md` before building with `PN_DRY_RUN=0`.
