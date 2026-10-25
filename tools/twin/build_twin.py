"""Assembles the self-contained room twin page from the template, the JS decision
core and the compact replay day.
Usage: python3 -I tools/twin/build_twin.py <repo_root> <out.html>
"""
import json, os, sys

root, out = sys.argv[1:3]
tw = os.path.join(root, "tools", "twin")
tpl = open(os.path.join(tw, "room_twin.template.html"), encoding="utf-8").read()
core = open(os.path.join(tw, "pn_core.js"), encoding="utf-8").read()
d = json.load(open(os.path.join(root, "results", "twin", "replay_day.json")))
emb = {"source": d["source"], "day": d["day"], "slot_s": d["slot_s"], "act": d["act"], "occ": d["occ"],
       "Tz": d["Tz"], "RH": d["RH"], "cpp_states": d["s"]}
html = tpl.replace("/*__PN_CORE__*/", core).replace("/*__REPLAY__*/null", json.dumps(emb, separators=(",", ":")))
open(out, "w", encoding="utf-8").write(html)
print(out, len(html), "bytes")
