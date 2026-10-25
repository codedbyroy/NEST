"""NEST simulation suite (host computer; NOT hardware measurements).

What is real and what is synthetic:
  * REAL: occupancy labels, temperature and humidity of the Candanedo-Feldheim
    office dataset (test splits only; 1-min samples).
  * SYNTHETIC: PIR slot activity (generated from the real labels with a stated
    detection model), outdoor temperature (assumed diurnal profile), simulated room
    temperature in the thermal experiment, and all load powers.
  * CONTROL LOGIC: the firmware's own C++ NodeLogic via build/replay.

Usage: python3 -I tools/sim/run_simulations.py <data_dir> <replay_bin> <out_dir>
"""
import json, os, subprocess, sys, itertools
from concurrent.futures import ThreadPoolExecutor
import numpy as np, pandas as pd
import matplotlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pir_model import synth_pir  # noqa: E402
matplotlib.use("Agg")
import matplotlib.pyplot as plt

DATA, REPLAY, OUT = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)
TMP = os.path.join(OUT, "_inputs"); os.makedirs(TMP, exist_ok=True)
SLOTS_PER_MIN = 6
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#6250d6"]   # validated reference palette, fixed order
INK, MUTED = "#0b0b0b", "#52514e"

# --------------------------------------------------------------------------- inputs
def load_split(name):
    d = pd.read_csv(os.path.join(DATA, name)); d["date"] = pd.to_datetime(d["date"])
    d = d.sort_values("date").reset_index(drop=True)
    return d

SPLITS = {"test1": load_split("datatest.txt"), "test2": load_split("datatest2.txt")}

DEFAULT_PIR = dict(p_move=0.6, f_still=0.3, bout_min=10.0, p_still=0.02, p_fa=0.0005)

def tamb_profile(dates):
    """ASSUMED outdoor temperature: 27 +/- 5 degC sinusoid, peak at 15:00."""
    h = dates.dt.hour + dates.dt.minute / 60.0
    return 27.0 + 5.0 * np.cos(2 * np.pi * (h - 15.0) / 24.0)

def write_input(split, seed, pir):
    d = SPLITS[split]
    occ = d["Occupancy"].values.astype(int)
    act = synth_pir(occ, seed, **pir)
    n = len(act)
    df = pd.DataFrame({
        "t_s": np.arange(1, n + 1) * 10.0,
        "slot_active": act,
        "Tz": np.repeat(d["Temperature"].values, SLOTS_PER_MIN),
        "RH": np.repeat(d["Humidity"].values, SLOTS_PER_MIN),
        "occ_true": np.repeat(occ, SLOTS_PER_MIN),
        "Tamb": np.repeat(tamb_profile(d["date"]).values, SLOTS_PER_MIN),
    })
    key = f"{split}_s{seed}_" + "_".join(f"{k}{v}" for k, v in sorted(pir.items()))
    path = os.path.join(TMP, key + ".csv")
    if not os.path.exists(path):
        df.to_csv(path, index=False, float_format="%.4f")
    return path

def replay(path, **kw):
    args = [REPLAY, path] + [f"{k}={v}" for k, v in kw.items()]
    return json.loads(subprocess.run(args, capture_output=True, text=True, check=True).stdout)

def run_both_splits(seed, pir, **kw):
    tot = None
    for split in SPLITS:
        r = replay(write_input(split, seed, pir), **kw)
        tot = r if tot is None else {k: tot[k] + r[k] for k in r}
    days = tot["days"]
    per_day = {k: tot[k] / days for k in tot if k not in ("slots", "days")}
    per_day["days"] = days
    return per_day

def agg(rows):
    keys = rows[0].keys()
    return {k: (float(np.mean([r[k] for r in rows])), float(np.std([r[k] for r in rows]))) for k in keys}

def save(exp, config, table, notes):
    d = os.path.join(OUT, exp); os.makedirs(d, exist_ok=True)
    json.dump({"config": config, "notes": notes}, open(os.path.join(d, "config.json"), "w"), indent=1)
    pd.DataFrame(table).to_csv(os.path.join(d, "metrics.csv"), index=False)
    return d

def style(ax, title, xl, yl):
    ax.set_title(title, color=INK, fontsize=10, loc="left")
    ax.set_xlabel(xl, color=MUTED, fontsize=9); ax.set_ylabel(yl, color=MUTED, fontsize=9)
    ax.grid(True, color="#e6e5e0", linewidth=0.6); ax.set_axisbelow(True)
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    for s in ("left", "bottom"): ax.spines[s].set_color("#bdbcb6")
    ax.tick_params(colors=MUTED, labelsize=8)

SEEDS = list(range(10))
pool = ThreadPoolExecutor(max_workers=8)

def many(pir, **kw):
    return agg(list(pool.map(lambda s: run_both_splits(s, pir, **kw), SEEDS)))

# --------------------------------------------------------------------------- E1 replay vs baseline
controllers = {
    "Fixed timeout 10 min (baseline)": dict(mode="baseline", timeout=600),
    "NEST PIR-only, fan (600 s)": dict(mode="nest", load="fan", grace=600),
    "NEST PIR-only, lighting (180 s)": dict(mode="nest", load="lighting", grace=180),
    "NEST hybrid beta=0.5, fan": dict(mode="nest", load="fan", grace=600, beta=0.5),
}
e1 = []
for name, kw in controllers.items():
    m = many(DEFAULT_PIR, **kw)
    e1.append({"controller": name, **{f"{k}_mean": v[0] for k, v in m.items()}, **{f"{k}_sd": v[1] for k, v in m.items()}})
save("E1_replay_vs_baseline", {"pir_model": DEFAULT_PIR, "seeds": SEEDS, "controllers": controllers}, e1,
     "Real occupancy/T/RH (test1+test2, 8.62 days); synthetic PIR; per-day means and SD across 10 PIR seeds.")

# --------------------------------------------------------------------------- E2 trade-off curves
e2 = []
for T in [120, 300, 420, 600, 900, 1200]:
    m = many(DEFAULT_PIR, mode="baseline", timeout=T)
    e2.append({"controller": "baseline", "param_s": T, "uot": m["uot_min"][0], "miss": m["miss_min"][0], "offs": m["switch_offs"][0]})
for G in [60, 180, 300, 600, 900, 1200]:
    m = many(DEFAULT_PIR, mode="nest", load="fan", grace=G)
    e2.append({"controller": "nest_pir_only", "param_s": G, "uot": m["uot_min"][0], "miss": m["miss_min"][0], "offs": m["switch_offs"][0]})
    m = many(DEFAULT_PIR, mode="nest", load="fan", grace=G, beta=0.5)
    e2.append({"controller": "nest_hybrid", "param_s": G, "uot": m["uot_min"][0], "miss": m["miss_min"][0], "offs": m["switch_offs"][0]})
d = save("E2_tradeoff", {"pir_model": DEFAULT_PIR, "seeds": SEEDS}, e2,
         "Baseline swept over timeout; NEST swept over grace period (window 5 min, warning 30 s).")
t2 = pd.DataFrame(e2)
fig, ax = plt.subplots(figsize=(4.6, 3.2), dpi=200)
labels = {"baseline": "Fixed timeout", "nest_pir_only": "NEST PIR-only", "nest_hybrid": "NEST hybrid (beta=0.5)"}
for i, (c, g) in enumerate(t2[t2.controller != "nest_hybrid"].groupby("controller", sort=False)):   # hybrid (~910 min/day) reported in text
    g = g.sort_values("param_s")
    ax.plot(g["miss"], g["uot"], "-o", color=SERIES[i], lw=2, ms=4, label=labels[c])
    for _, pt in g.iloc[[0, -1]].iterrows():
        ax.annotate(f"{pt.param_s/60:g} min", (pt.miss, pt.uot), textcoords="offset points", xytext=(4, 2), fontsize=7, color=MUTED)
style(ax, "Unoccupied-on time vs miss time (simulation)", "Miss time (min/day)", "Unoccupied-on time (min/day)")
ax.legend(fontsize=7, frameon=False)
fig.tight_layout(); fig.savefig(os.path.join(d, "tradeoff.png")); fig.savefig(os.path.join(d, "tradeoff.pdf")); plt.close(fig)

# --------------------------------------------------------------------------- E3 PIR sensitivity
e3 = []
for f_still, p_fa in itertools.product([0.0, 0.3, 0.6, 0.8], [0.0, 0.0005, 0.002, 0.01]):
    pir = dict(DEFAULT_PIR, f_still=f_still, p_fa=p_fa)
    for name, kw in [("baseline_10min", dict(mode="baseline", timeout=600)),
                     ("nest_pir_only_fan", dict(mode="nest", load="fan", grace=600))]:
        m = many(pir, **kw)
        e3.append({"controller": name, "f_still": f_still, "p_fa": p_fa, "uot": m["uot_min"][0], "uot_sd": m["uot_min"][1],
                   "miss": m["miss_min"][0], "miss_sd": m["miss_min"][1], "offs": m["switch_offs"][0]})
d = save("E3_pir_sensitivity", {"base_pir_model": DEFAULT_PIR, "seeds": SEEDS}, e3,
         "f_still = long-run fraction of occupied time spent in still bouts (slot detection prob 0.02); p_fa = false-trigger prob per vacant 10 s slot. Both synthetic.")
t3 = pd.DataFrame(e3)
fig, axs = plt.subplots(1, 2, figsize=(7.0, 2.9), dpi=200)
for j, (metric, yl) in enumerate([("miss", "Miss time (min/day)"), ("uot", "Unoccupied-on time (min/day)")]):
    ax = axs[j]
    for i, c in enumerate(["baseline_10min", "nest_pir_only_fan"]):
        g = t3[(t3.controller == c) & (t3.p_fa == 0.0005)].sort_values("f_still")
        ax.plot(g.f_still, g[metric], "-o", color=SERIES[i], lw=2, ms=4,
                label="Fixed timeout 10 min" if i == 0 else "NEST PIR-only (600 s)")
    style(ax, ("a" if j == 0 else "b") + ") vs still-occupant fraction (p_fa = 5e-4)", "Fraction of occupied time still", yl)
axs[0].legend(fontsize=7, frameon=False)
fig.tight_layout(); fig.savefig(os.path.join(d, "pir_sensitivity.png")); fig.savefig(os.path.join(d, "pir_sensitivity.pdf")); plt.close(fig)

# --------------------------------------------------------------------------- E4 thermal veto
e4 = []
pir = DEFAULT_PIR
for tau in [1.0, 3.0, 6.0]:
    for screen, scale in [(0, 1.0), (1, 0.7), (1, 1.0), (1, 1.3)]:
        rows = []
        for s in SEEDS[:5]:
            r = replay(write_input("test2", s, pir), mode="nest", load="cooling", grace=600, thermal=1,
                       screen=screen, tau_h=tau, tau_model_scale=scale)
            days = r["days"]
            rows.append({k: r[k] / days for k in ("compressor_min", "comfort_exceed_min", "thermal_vetoes", "switch_offs", "uot_min", "miss_min")})
        m = agg(rows)
        e4.append({"tau_h": tau, "screen": screen, "model_tau_scale": scale,
                   **{f"{k}": v[0] for k, v in m.items()}, **{f"{k}_sd": v[1] for k, v in m.items()}})
d = save("E4_thermal_veto", {"pir_model": pir, "seeds": SEEDS[:5], "room": "1R-1C, ASSUMED: R*q0=1 K, R*q1=2 K/occupied, R*Qc=12 K, setpoint 24+/-1 degC, comfort 26 degC",
                              "outdoor": "ASSUMED 27+/-5 degC diurnal, peak 15:00", "occupancy": "real labels, test2 (6.77 days)"}, e4,
         "Simulated room and assumed parameters; screen=0 is an ablation in which cooling switch-offs are never vetoed.")

# --------------------------------------------------------------------------- E5 energy scenarios
loads = {"Bench 5 V fan (assumed 1 W)": 1.0, "Lighting 8 x 18 W LED (assumed)": 144.0, "4 ceiling fans x 60 W (assumed)": 240.0}
P_COIL = 0.36   # W per energized channel: ASSUMED typical 5 V relay coil (72 mA); must be measured
e5 = []
for r in e1:
    on_h = r["on_min_mean"] / 60.0
    off_h = 24.0 - on_h
    for lname, P in loads.items():
        e5.append({"controller": r["controller"], "load": lname, "load_kWh_day": on_h * P / 1000.0,
                   "coil_kWh_day": off_h * P_COIL / 1000.0, "always_on_kWh_day": 24.0 * P / 1000.0})
save("E5_energy_scenarios", {"load_powers_W": loads, "P_coil_W": P_COIL, "source_metrics": "E1 on-time"}, e5,
     "Estimated energy = on-time x assumed power; coil overhead under NC wiring = off-time x assumed coil power. Not measured.")
print("done")
