"""Independent re-verification of every offline number in the manuscript.

Re-trains all configurations with the same procedure as train_occupancy.py,
saves per-seed models and confusion matrices, and evaluates INT8 models two ways:
  (a) 'orig'  : the original evaluation code (np.round, no clipping)
  (b) 'tflite': TFLite-conformant input quantization (round half away from zero,
                then clip to [-128, 127]).
Usage: python3 -I verify_all.py <data_dir> <out_dir>
"""
import json, os, sys, hashlib
import numpy as np, pandas as pd
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import tensorflow as tf
from sklearn.metrics import confusion_matrix

DATA, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
LAG = 5

def load(name):
    df = pd.read_csv(os.path.join(DATA, name))
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values("date").reset_index(drop=True)
    raw = len(df)
    df["dT"] = df["Temperature"].diff(LAG)
    df["dL"] = df["Light"].diff(LAG)
    return df.dropna().reset_index(drop=True), raw

(tr, ntr), (te1, nte1), (te2, nte2) = load("datatraining.txt"), load("datatest.txt"), load("datatest2.txt")
FULL = ["Temperature", "Humidity", "Light", "dT", "dL"]
NOLIGHT = ["Temperature", "Humidity", "dT"]
NODELTA = ["Temperature", "Humidity", "Light"]

def cm(y, p):
    tn, fp, fn, tp = confusion_matrix(y, p, labels=[0, 1]).ravel()
    return dict(tp=int(tp), fp=int(fp), fn=int(fn), tn=int(tn))

def scores(c):
    tp, fp, fn, tn = c["tp"], c["fp"], c["fn"], c["tn"]
    acc = (tp + tn) / (tp + fp + fn + tn); prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0; f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return dict(acc=acc, prec=prec, rec=rec, f1=f1)

def build(n_in, seed):
    tf.keras.utils.set_random_seed(seed)
    m = tf.keras.Sequential([tf.keras.Input(shape=(n_in,)),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dense(16, activation="relu"),
        tf.keras.layers.Dense(2, activation="softmax")])
    m.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy")
    return m

def round_half_away(x):
    return np.sign(x) * np.floor(np.abs(x) + 0.5)

def predict(blob, X, mode):
    it = tf.lite.Interpreter(model_content=blob); it.allocate_tensors()
    i, o = it.get_input_details()[0], it.get_output_details()[0]
    s, z = i["quantization"]
    out, n_clip = [], 0
    for x in X:
        x = x[None, :].astype(np.float32)
        if mode == "orig":
            xq = np.round(x / s + z).astype(np.int8)          # original code path
        elif mode == "tflite":
            v = round_half_away(x / s) + z
            n_clip += int(np.any((v < -128) | (v > 127)))
            xq = np.clip(v, -128, 127).astype(np.int8)
        else:
            xq = x
        it.set_tensor(i["index"], xq); it.invoke()
        out.append(int(np.argmax(it.get_tensor(o["index"])[0])))
    return np.array(out), n_clip

def run(feats, seed, tag):
    mu, sd = tr[feats].mean().values, tr[feats].std().values
    Xtr = ((tr[feats].values - mu) / sd).astype(np.float32); ytr = tr["Occupancy"].values
    m = build(len(feats), seed)
    m.fit(Xtr, ytr, epochs=40, batch_size=64, verbose=0)
    fp32 = tf.lite.TFLiteConverter.from_keras_model(m).convert()
    conv = tf.lite.TFLiteConverter.from_keras_model(m)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    rng = np.random.default_rng(seed)
    rep = Xtr[rng.choice(len(Xtr), 500, replace=False)]
    conv.representative_dataset = lambda: ([r[None, :]] for r in rep)
    conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    conv.inference_input_type = tf.int8; conv.inference_output_type = tf.int8
    int8 = conv.convert()
    for name, blob in (("fp32", fp32), ("int8", int8)):
        open(os.path.join(OUT, f"{tag}_seed{seed}_{name}.tflite"), "wb").write(blob)
    res = {"fp32_bytes": len(fp32), "int8_bytes": len(int8), "params": int(m.count_params()),
           "int8_sha256": hashlib.sha256(int8).hexdigest()[:16]}
    for name, d in (("test1", te1), ("test2", te2)):
        X = ((d[feats].values - mu) / sd).astype(np.float32); y = d["Occupancy"].values
        p, _ = predict(fp32, X, "fp32"); res[f"{name}_fp32"] = cm(y, p)
        p, _ = predict(int8, X, "orig"); res[f"{name}_int8_orig"] = cm(y, p)
        p, nclip = predict(int8, X, "tflite"); res[f"{name}_int8_tflite"] = cm(y, p)
        res[f"{name}_n_out_of_range"] = nclip
    return res

def agg(runs, key):
    sc = [scores(r[key]) for r in runs]
    return {k: [float(np.mean([s[k] for s in sc])), float(np.std([s[k] for s in sc], ddof=0))] for k in sc[0]}

def light_threshold():
    cands = np.unique(np.round(tr["Light"], 0))
    best = max(cands, key=lambda t: ((tr["Light"] > t).astype(int) == tr["Occupancy"]).mean())
    out = {"threshold": float(best), "n_candidates": int(len(cands))}
    for name, d in (("test1", te1), ("test2", te2)):
        out[name] = cm(d["Occupancy"].values, (d["Light"] > best).astype(int).values)
    return out

summary = {"splits": {}}
for name, (d, raw) in (("train", (tr, ntr)), ("test1", (te1, nte1)), ("test2", (te2, nte2))):
    summary["splits"][name] = {"raw_rows": raw, "rows_after_lag": len(d), "first": str(d["date"].min()),
                               "last": str(d["date"].max()), "occupied_frac": float(d["Occupancy"].mean())}
summary["timestamp_overlap"] = {f"{a}-{b}": len(set(A["date"]) & set(B["date"]))
                                for a, A, b, B in (("train", tr, "test1", te1), ("train", tr, "test2", te2), ("test1", te1, "test2", te2))}
summary["light_threshold"] = light_threshold()
for tag, feats in (("full", FULL), ("nolight", NOLIGHT), ("nodelta", NODELTA)):
    runs = [run(feats, s, tag) for s in range(5)]
    summary[tag] = {"per_seed": runs,
                    "agg": {k: agg(runs, k) for k in runs[0] if k.startswith("test") and not k.endswith("range")}}
json.dump(summary, open(os.path.join(OUT, "verification.json"), "w"), indent=1)
print("done")
