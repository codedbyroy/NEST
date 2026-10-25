# Wiring map (bench configuration)

All logic runs at 3.3 V on the ESP32 except where noted. Power the board from the 5 V 2 A
adapter through its USB port. **No mains wiring on the breadboard.**

| Component | Pin on module | ESP32 GPIO | Notes |
| --- | --- | --- | --- |
| PIR 1 (seating) HC-SR501 | OUT | 35 | VCC 5 V, GND. Output is ~3.3 V push-pull. GPIO 35 is input-only (no pulls needed). Record the trigger-mode jumper (H/L) and both potentiometer settings |
| PIR 2 (entrance) HC-SR501 | OUT | 34 | Same as PIR 1 |
| DHT22 (AM2302) | DATA | 4 | VCC 3.3 V. Add 10 kΩ DATA→3.3 V if the module has no pull-up |
| LM393 LDR module | AO | 32 | VCC 3.3 V (keeps AO within the ADC range). DO unused |
| OLED 0.96" SSD1306 | SDA / SCL | 21 / 22 | VCC 3.3 V; I2C address 0x3C (some modules 0x3D) |
| Active buzzer module | I/O | 33 | VCC 3.3 V; check whether the module is active-high |
| 3-colour LED module | R / G / B | 18 / 19 / 13 | Common pin to GND (set `LED_ACTIVE_HIGH 0` if common-anode) |
| 4-ch relay board | IN1 / IN2 / IN3 / IN4 | 23 / 25 / 26 / 27 | VCC 5 V, GND common with ESP32. If the board has a JD-VCC jumper, see commissioning step C3 |
| 5 V 4010 fan (test load) | + / − | via relay CH1 | Fan + from the 5 V supply through CH1 **NC** and COM; fan − to GND; fuse in series |

Pins avoided: 0, 2, 5, 12, 15 (strapping), 6–11 (flash), 16/17 (PSRAM on WROVER), 36/39 (interrupt erratum).

Normally-closed wiring means: relay de-energized → fan ON (conventional state); the
controller energizes the coil to switch the fan OFF. A powered-down or rebooting node
therefore leaves the load ON.
