"""Host-side consistency test: the firmware's C model vs TFLite FP32 on both test splits.
This runs on the host computer; it is NOT an ESP32 test.
Usage: python3 -I check_env_model.py <data dir> <fp32.tflite> <env_model_cli binary> <out.json>
"""
import json, os, subprocess, sys
import numpy as np, pandas as pd
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import tensorflow as tf

data, model, cli, out = sys.argv[1:5]
F = ["Temperature", "Humidity", "dT"]

def load(n):
    d = pd.read_csv(os.path.join(data, n)); d["date"] = pd.to_datetime(d["date"]); d = d.sort_values("date")
    d["dT"] = d["Temperature"].diff(5); return d.dropna()

tr = load("datatraining.txt"); mu, sd = tr[F].mean().values, tr[F].std().values
it = tf.lite.Interpreter(model_path=model); it.allocate_tensors()
i, o = it.get_input_details()[0], it.get_output_details()[0]
res = {}
for name in ["datatest.txt", "datatest2.txt"]:
    d = load(name)
    X = ((d[F].values - mu) / sd).astype(np.float32)
    ref = []
    for x in X:
        it.set_tensor(i["index"], x[None, :]); it.invoke(); ref.append(float(it.get_tensor(o["index"])[0][1]))
    ref = np.array(ref)
    inp = "\n".join(f"{a:.9g},{b:.9g},{c:.9g}" for a, b, c in d[F].values) + "\n"
    c = np.array([float(v) for v in subprocess.run([cli], input=inp, capture_output=True, text=True, check=True).stdout.split()])
    y = d["Occupancy"].values
    res[name] = {"n": int(len(ref)), "max_abs_diff": float(np.max(np.abs(c - ref))),
                 "decision_agreement": float(np.mean((c >= 0.5) == (ref >= 0.5))),
                 "block_agreement_p_gt_6_11": float(np.mean((c > 6 / 11) == (ref > 6 / 11))),
                 "c_model_accuracy": float(np.mean((c >= 0.5) == (y == 1)))}
json.dump(res, open(out, "w"), indent=1)
print(json.dumps(res, indent=1))
