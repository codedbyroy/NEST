# Occupancy strategy: selection and evidence

**Decision: the deployed controller uses a deterministic PIR slot estimator (β = 0).**
The environmental model is kept as an optional, disabled module for future retraining.

| Option | Inputs on this node | Evidence | Verdict |
| --- | --- | --- | --- |
| 1. Deterministic PIR estimator | 2× HC-SR501 | Unit tests; dataset replay with synthetic PIR (E1–E3) | **Selected.** Implementable, no training data needed, behaviour fully specified |
| 2. Quantized model on node features | DHT22 T and RH, LDR light | Offline (Table V of the paper): with light, F1 0.945/0.950 but light is circular for a node that switches its own lights and the LDR is uncalibrated; without light, F1 0.687/0.551 | Rejected as primary estimator |
| 3. Hybrid PIR + environment (β = 0.5) | Both | Replay E1/E2: switch-offs almost never happen (unoccupied-on time ≈ 856 min/day vs 58 for the baseline). Cause: with no context term (d = 0) the score triggers only at O = 0, and the model keeps O > 0 in 92–100% of vacant minutes (it exceeds 6/11 in only 6–17%) | Rejected; kept behind `Config::beta` (default 0). Usable only after re-parameterizing the score on room data |

## Why the public dataset cannot do more

The Candanedo–Feldheim data contain no PIR channel and were recorded in a different
office with different sensors. They are used only for (a) the offline classifier study
and (b) real occupancy timelines and indoor temperature/humidity in replay. Every PIR
event in replay is synthetic and labelled as such.

## Optional model artifacts (disabled by default)

* Model: no-light MLP 3-32-16-2, seed 0, FP32 (`ml/` export from `nolight_seed0_fp32.tflite`).
* Preprocessing: features `[T_z (degC), RH (%), T(now) - T(5 min ago) (K)]`, standardized with the training split's mean and sample SD (values in `pn_env_weights.h`).
* Output: softmax probability of "occupied", `p_env ∈ [0, 1]`.
* Deployment path: plain C++ (`pn_env_model.cpp`), no TensorFlow Lite Micro; FP32 on the ESP32's FPU.
* Host consistency (not an ESP32 test): `results/host_tests/env_model_consistency.json` — max |Δp| 4.4×10⁻⁶ on 12,407 rows, 100% decision agreement with the TFLite FP32 model.
* On-device timing: run the serial `bench` command; it reports mean µs per decision step and per model inference. Not yet measured.

## INT8 quantization and clipping

The INT8 TFLite models remain an offline result (paper Table V). Verification of
rounding (ties away from zero) and clipping is in the paper package
(`verify_all.py`, `verification.json`). The firmware does not use them.
