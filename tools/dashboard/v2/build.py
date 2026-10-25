"""Assembles the NEST console v2 into self-contained HTML.
Usage: python3 -I tools/dashboard/v2/build.py <repo_root> <out.html>
Writes <out.html> (artifact body, no doctype) and <out>_local.html (standalone document
for presenting from a laptop: Web Serial and Print work when opened in Chrome or Edge).
"""
import os, sys

root, out = sys.argv[1:3]
rd = lambda *p: open(os.path.join(root, *p), encoding="utf-8").read()
html = (rd("tools", "dashboard", "v2", "template.html")
        .replace("/*__PN_CORE__*/", rd("tools", "twin", "pn_core.js"))
        .replace("/*__SIM__*/", rd("tools", "dashboard", "sim.js"))
        .replace("/*__MODEL__*/", rd("tools", "dashboard", "v2", "model.js"))
        .replace("/*__COST__*/", rd("tools", "dashboard", "v2", "cost.js"))
        .replace("/*__UI__*/", rd("tools", "dashboard", "v2", "ui.js")))
assert "/*__" not in html, "unreplaced placeholder"
open(out, "w", encoding="utf-8").write(html)
local = out[:-5] + "_local.html"
doc = ('<!doctype html>\n<html lang="en"><head><meta charset="utf-8">'
       '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n'
       + html + '\n</body></html>\n')
open(local, "w", encoding="utf-8").write(doc)
print(out, len(html), "bytes;", local, len(doc), "bytes")
