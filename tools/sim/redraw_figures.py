"""Redraws the simulation figures (E2 trade-off, E3 PIR sensitivity) from the saved
metrics.csv files, without re-running the simulation. Same data, styling and layout as
run_simulations.py. Usage: python3 -I tools/sim/redraw_figures.py <repo_root>
"""
import os, sys
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

root = sys.argv[1]
SIMS = os.path.join(root, "results", "simulations")
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#6250d6"]
INK, MUTED = "#0b0b0b", "#52514e"

def style(ax, title, xl, yl):
    ax.set_title(title, color=INK, fontsize=10, loc="left")
    ax.set_xlabel(xl, color=MUTED, fontsize=9); ax.set_ylabel(yl, color=MUTED, fontsize=9)
    ax.grid(True, color="#e6e5e0", linewidth=0.6); ax.set_axisbelow(True)
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    for s in ("left", "bottom"): ax.spines[s].set_color("#bdbcb6")
    ax.tick_params(colors=MUTED, labelsize=8)

# E2: unoccupied-on time vs miss time
d = os.path.join(SIMS, "E2_tradeoff"); t2 = pd.read_csv(os.path.join(d, "metrics.csv"))
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

# E3: PIR sensitivity
d = os.path.join(SIMS, "E3_pir_sensitivity"); t3 = pd.read_csv(os.path.join(d, "metrics.csv"))
fig, axs = plt.subplots(1, 2, figsize=(7.0, 2.9), dpi=200)
for j, (metric, yl) in enumerate([("miss", "Miss time (min/day)"), ("uot", "Unoccupied-on time (min/day)")]):
    ax = axs[j]
    for i, c in enumerate(["baseline_10min", "nest_pir_only_fan"]):
        g = t3[(t3.controller == c) & (t3.p_fa == 0.0005)].sort_values("f_still")
        ax.plot(g.f_still, g[metric], "-o", color=SERIES[i], lw=2, ms=4, label="Fixed timeout 10 min" if i == 0 else "NEST PIR-only (600 s)")
    style(ax, ("a" if j == 0 else "b") + ") vs still-occupant fraction (p_fa = 5e-4)", "Fraction of occupied time still", yl)
axs[0].legend(fontsize=7, frameon=False)
fig.tight_layout(); fig.savefig(os.path.join(d, "pir_sensitivity.png")); fig.savefig(os.path.join(d, "pir_sensitivity.pdf")); plt.close(fig)
print("redrew E2 and E3 figures in", SIMS)
