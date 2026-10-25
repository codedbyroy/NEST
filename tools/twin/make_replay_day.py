"""Builds the room twin's Replay data: one real day of occupancy labels from the
Candanedo-Feldheim dataset (Test 2, Monday 2015-02-16) with SYNTHETIC PIR events,
run through the firmware's NodeLogic (room profile) by build/room_trace.

Usage: python3 -I tools/twin/make_replay_day.py <data_dir> <room_trace_bin> <out_dir>
Writes replay_input.csv, replay_trace.csv and replay_day.json (compact, for the page).
"""
import json, os, subprocess, sys
import numpy as np, pandas as pd
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sim"))
from pir_model import synth_pir, DEFAULT_PIR, SLOTS_PER_MIN  # noqa: E402

DATA, BIN, OUT = sys.argv[1:4]
DAY, SEED = "2015-02-16", 0
os.makedirs(OUT, exist_ok=True)
d = pd.read_csv(os.path.join(DATA, "datatest2.txt")); d["date"] = pd.to_datetime(d["date"])
d = d[d["date"].dt.strftime("%Y-%m-%d") == DAY].sort_values("date").reset_index(drop=True)
occ = d["Occupancy"].values.astype(int)
act = synth_pir(occ, SEED, **DEFAULT_PIR)
n = len(act)
inp = pd.DataFrame({"t_s": np.arange(1, n + 1) * 10.0, "slot_active": act,
                    "Tz": np.repeat(d["Temperature"].values, SLOTS_PER_MIN),
                    "RH": np.repeat(d["Humidity"].values, SLOTS_PER_MIN),
                    "occ_true": np.repeat(occ, SLOTS_PER_MIN), "Tamb": 0.0})
in_path = os.path.join(OUT, "replay_input.csv"); inp.to_csv(in_path, index=False, float_format="%.4f")
tr_path = os.path.join(OUT, "replay_trace.csv")
with open(tr_path, "w") as f:
    subprocess.run([BIN, in_path], stdout=f, check=True)
t = pd.read_csv(tr_path)
compact = {
    "source": f"Candanedo-Feldheim Test 2, {DAY}: REAL occupancy labels, temperature and humidity; "
              f"SYNTHETIC PIR (seed {SEED}, {DEFAULT_PIR}); decisions by the firmware's NodeLogic (room profile).",
    "day": DAY, "start_clock": str(d["date"].iloc[0].time()), "slot_s": 10,
    "act": "".join(map(str, t["act"])), "occ": "".join(map(str, t["occ"])),
    "n": t["n"].tolist(), "O": t["O_milli"].tolist(),
    "s": ["".join(map(str, t[f"s{i}"])) for i in range(3)],
    "W": [t[f"W{i}_milli"].tolist() for i in range(3)],
    "tau": [t[f"tau{i}"].tolist() for i in range(3)],
    "e": [[int(i), int(c), int(v)] for c in range(3) for i, v in enumerate(t[f"e{c}"]) if v != 0],
    "Tz": [round(float(v), 2) for v in d["Temperature"].values],
    "RH": [round(float(v), 1) for v in d["Humidity"].values],
}
json.dump(compact, open(os.path.join(OUT, "replay_day.json"), "w"), separators=(",", ":"))
on = {c: float(np.mean(t[f"s{c}"] != 2)) for c in range(3)}
print("slots", n, "occupied min", int(occ.sum()), "fraction on per channel", on,
      "bytes", os.path.getsize(os.path.join(OUT, "replay_day.json")))
