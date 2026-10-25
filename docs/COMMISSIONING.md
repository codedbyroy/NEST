# Safe commissioning checklist and bench measurements

Do the steps in order. Record every result in `results/bench/` (a CSV or photo per step).
Steps marked **[paper]** produce the physical measurements the paper still lacks.

## A. Before power-up
- [ ] A1. Read the module marking on the ESP32 board (e.g. ESP32-WROOM-32) and note it.
- [ ] A2. Read the rating printed on each relay (e.g. "10A 250VAC 10A 30VDC"). The 5 V fan is far below it; no other load is connected in this phase.
- [ ] A3. Check the relay board for a JD-VCC jumper and opto-couplers; photograph the board.
- [ ] A4. Inline fuse in the fan's supply line; manual bypass switch across relay CH1 NC/COM (open during tests).

## B. Dry-run firmware (default build: relay pins never driven)
- [ ] B1. Flash the default build. Serial at 115200 shows `# chip=... flash=... dry_run=1`. **[paper]** record chip model, flash, PSRAM.
- [ ] B2. `bench` command: **[paper]** record `node_step_us_mean`, `env_model_us_mean`, `heap_free`, `min_heap` (repeat 5×).
- [ ] B3. Wave at each PIR: OLED shows the PIR level toggling; `status` shows active slots rising. Record the HC-SR501 hold time you observe (stopwatch on the OLED level).
- [ ] B4. Cover the LDR / shine a lamp: `status` ldr_raw changes. With a lux meter (phone app acceptable only if labelled as such), record 5 raw/lux pairs **[paper]**.
- [ ] B5. Unplug DHT22 for 2 min: OLED shows "DHT22 stale/err", red LED blinks, `dht_errors` rises; reconnect and confirm recovery.
- [ ] B6. Leave the room (or cover both PIRs) for 11 min: a `warning_started` event at ~600 s, buzzer, then `switched_off` 30 s later (logged only). Wave during a second warning: `warning_canceled`.
- [ ] B7. `dump` the log and keep it as the first bench log **[paper]**.

## C. Relay polarity (still no load)
- [ ] C1. Build with `-DPN_DRY_RUN=0`. Disconnect the fan. Power-cycle 20 times while watching the relay LEDs: **[paper]** count any clicks/flashes during boot (target 0).
- [ ] C2. Force a switch-off (cover PIRs 11 min). Relay CH1 LED must turn ON (coil energized) at `switched_off` and OFF at `restored_occupancy`.
- [ ] C3. If the relay does not fully release (LED dim or relay stays on) with open-drain drive, power the board's VCC from 3.3 V and JD-VCC from 5 V (remove the jumper), or set `RELAY_OPEN_DRAIN 0`, and repeat C1–C2.
- [ ] C4. With a multimeter in continuity mode on CH1 NC–COM: closed when de-energized, open when energized.

## D. Low-voltage load (5 V fan only)
- [ ] D1. Connect the fan through CH1 NC/COM with the fuse. Repeat B6: the fan stops at `switched_off` and restarts on motion.
- [ ] D2. **[paper]** End-to-end latency: film the OLED and the fan with a phone at 60 fps while a PIR triggers; restore latency = frames between PIR LED and fan spin-up. Expect up to one 10 s slot by design; report the measured distribution over 20 trials.
- [ ] D3. **[paper]** Power: USB power meter on the node supply with all relays off (`P_node`), then with CH1 energized (`P_coil` = difference). Fan current with a multimeter (`P_load`).
- [ ] D4. 24 h soak: confirm no watchdog resets (`B,` lines in the log) and continuous logging.

## E. Before any mains load (not part of this phase)
- [ ] E1. Faculty / lab-staff sign-off; enclosure with screw terminals; no breadboard; earth continuity.
- [ ] E2. Load current measured below 50% of the relay rating; fuse sized to the load.
- [ ] E3. Manual bypass tested with the node unpowered.
