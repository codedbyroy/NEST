// Compares the JavaScript port with the firmware C++ trace slot by slot.
// Usage: node tools/twin/verify_js_port.js results/twin/replay_trace.csv
"use strict";
const fs = require("fs");
const PN = require("./pn_core.js");
const rows = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").slice(1).map((l) => l.split(",").map(Number));
const node = PN.makeNode();
node.reset(rows[0][0] * 1000 - 10000);
let mism = 0, wMax = 0, checked = 0;
for (const r of rows) {
  const [t, act, , n, Om, s0, s1, s2, W0, W1, W2, ta0, ta1, ta2, e0, e1, e2] = r;
  const o = node.step(t * 1000, act === 1);
  const want = [[s0, W0, ta0, e0], [s1, W1, ta1, e1], [s2, W2, ta2, e2]];
  if (o.n !== n || Math.round(o.O * 1000) !== Om) mism++;
  o.loads.forEach((L, i) => {
    checked++;
    if (L.state !== want[i][0] || L.ev !== want[i][3] || Math.round(L.tau) !== want[i][2]) mism++;
    wMax = Math.max(wMax, Math.abs(Math.round(L.W * 1000) - want[i][1]));
  });
}
const res = { slots: rows.length, load_steps: checked, mismatches: mism, max_W_milli_diff: wMax };
console.log(JSON.stringify(res));
process.exit(mism === 0 ? 0 : 1);
