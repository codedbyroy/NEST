# NEST: installation cost, savings and payback (dashboard "Savings & cost" page)

Status: estimate only. Prices checked online on 21 Oct 2026; nothing here is a contractor quotation, a measurement or an approval. Source of truth for every number: `tools/dashboard/v2/cost.js` (prices, design rules) and `NEST_Dashboard.html` → Savings & cost.

## Three kinds of result (never added together)
- **Simulation**: modelled DKM block (placeholder layout, synthetic occupancy, assumed wattages: light 36 W, fan 60 W), firmware decision logic, compared with manual switching.
- **Estimate**: (a) bill scenario = assumed monthly bill (₹2–3 lakh) × chosen percentage (5–30 %, 25 % = illustrative target); (b) installation cost from documented unit prices and quantity rules.
- **Measured**: none. The kit has no energy meter; measured kWh needs a PZEM-004T or clamp meter per switched circuit, before/after with the same timetable.

## Design used for the estimate
- One node per control zone (as in the firmware): ESP32 + 2 × HC-SR501 + 4-channel relay board + buzzer/LED warning. DHT22, LDR and OLED left out (not used for lights/fans decisions).
- Switched circuits: lights and fans of each zone, one relay channel each. AC is not switched (no validated thermal model).
- Default: one 20 A 2-pole modular contactor per circuit in a 4-way DB box, coil fed through the relay's NC contact (loads stay on if a node loses power), plus a manual bypass switch per circuit. Option: relay board only (cheaper; electrician must accept it).
- Per node: IP65 ABS enclosure, 6 A MCB, fuse on the 5 V module, HLK-PM01 5 V supply, glands, terminals. Existing room wiring kept; nodes tap the switch circuits at the switchboard.
- Relay use limited to 50 % of the 10 A rating (COMMISSIONING E2). Largest circuit in the model ≈ 1.04 A.
- Coverage check: 2 PIR × 30 m² per zone (provisional); 9 zones per building flagged (corridors, research cell 306).
- Modelled block: 64 nodes, 128 PIR, 120 switched circuits, 33 rooms, 4 floors.

## Unit prices (incl. GST where listed; checked 21 Oct 2026)
| Item | Low / typical / high (₹) | Basis |
|---|---|---|
| ESP32 38-pin board | 425 / 449 / 499 | Robocraze ₹445, Robu ₹449, Probots ₹499; team purchase ₹425 |
| HC-SR501 PIR | 54 / 69 / 90 | Thingbits ₹54.28; team purchase ₹69 |
| 4-ch relay board (10 A) | 168 / 189 / 246 | Robocraze ₹189; team purchase ₹168 |
| Modular contactor 20 A 2P | 777 / 777 / 2,477 | Chint NCH8-20/02 ₹777 (Moglix); NCH8/Z-20 ₹2,477 (IndustryBuying) |
| 4-way SPN DB box | 1,044 / 1,044 / 1,665 | Havells ₹1,044 (MRP ₹1,665) |
| IP65 ABS enclosure | 300 / 600 / 899 | IndiaMART ₹300–600; Robu VS-127 ₹899 |
| 6 A SP MCB | 106 / 126 / 164 | Havells REO ₹126 (Moglix) |
| 5 V supply | 195 / 195 / 1,299 | HLK-PM01 ₹195; Mean Well HDR-15-5 ₹1,299 (Hubtronics) |
| 1.5 mm² FR wire | 25 / 29 / 38 per m | Polycab Optima 90 m ₹2,610 (McCoy Mart) |
| PVC casing 25 mm | 12 / 15 / 25 per m | IndiaMART listings |
| Electrician (8 h day) | 1,197 / 1,500 / 2,000 | Low = Karnataka minimum wage, skilled, Zone 1 (₹31,114.02/month from 22 May 2026 ÷ 26); typical/high provisional |
| Technician (8 h day) | 1,316 / 2,000 / 3,000 | Low = Karnataka minimum wage, highly skilled, Zone 1 (₹34,225.42/month ÷ 26); typical/high provisional |
| Provisional (no listing read) | — | sensor cable ₹15/25/35 per m, bypass switch ₹80/120/200, glands ₹20/40/98, sundries ₹50/100/150 per node |
Contingency 10 / 15 / 20 %. Labour rules: electrician 2 h/node + 1 h/circuit + 0.75 h/sensor, +5 % per floor above ground; technician 1.5 h/node (firmware, commissioning) + 0.5 h/node testing + 2 days handover.

## Results for one modelled block (defaults)
- Installation: low ₹4.74 lakh · **typical ₹5.93 lakh** · high ₹11.67 lakh (₹9,267 per node). Relay-board-only option: typical ₹4.09 lakh.
- Running cost (typical): ₹22,809/yr = spares 3 % of hardware + inspection 0.25 h/node + the nodes' own electricity (≈1,200 kWh/yr: 1 W per node always on, 0.36 W relay coil while a load is held off, 2 W contactor coil while a load is on; coil hours from the simulated week; non-term weeks taken as empty with supply on).
- Simulation, eligible loads (lights + fans) vs manual switching: 124.2 kWh per simulated week → 4,969 kWh/yr over 40 academic weeks → ₹39,750/yr at ₹8/kWh (assumed). Payback: low 21 years 5 months, typical 35 years, high no payback. Relay-board-only: typical 16.8 years.
- Bill scenario, 10 % of ₹2,50,000/month: ₹3,00,000/yr gross; typical payback ≈ 2 years 2 months against one block's installation. Caveat shown on the page: the percentage is of the whole bill (which includes loads NEST does not switch and other buildings), so this is optimistic. The simulation's eligible saving is ≈ 1.3 % of that bill.
- The 2-year payback goal is reported (met / not met), not forced.

## Data still needed
College energy charge (₹/kWh) and 12 months of bills; fixture survey (wattage, circuit grouping); verified room inventory; electrician's survey and quotations at quantity; measured node power, relay-coil and contactor-coil power (COMMISSIONING D3); measured before/after kWh on real rooms.
