// Unit tests for the cost, operating-cost and payback estimator (cost.js). Usage: node tools/dashboard/v2/cost_test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "../../..");
for (const f of ["tools/twin/pn_core.js", "tools/dashboard/sim.js", "tools/dashboard/v2/model.js", "tools/dashboard/v2/cost.js"]) vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f });
const M = globalThis.PNM, C = globalThis.NESTCOST, S = M.S, A = M.st.A;
const R = []; const ok = (n, c, i = "") => R.push(`${c ? "PASS" : "FAIL"}  ${n}${i !== "" ? "  [" + i + "]" : ""}`);
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

/* ---------- prices are documented ---------- */
const P = C.PRICES;
ok("every price has low ≤ typical ≤ high", Object.values(P).every((p) => p.low <= p.typ && p.typ <= p.high));
ok("every price has a status and a basis", Object.values(P).every((p) => ["recorded", "listing", "regulation", "provisional"].includes(p.status) && p.basis.length > 10));
ok("every listing or regulation price links a source", Object.values(P).filter((p) => p.status === "listing" || p.status === "regulation").every((p) => Array.isArray(p.src) && p.src.every((u) => /^https:\/\//.test(u))));
ok("check date recorded", C.CHECKED === "2026-10-21");

/* ---------- prototype ---------- */
const pr = C.prototype();
ok("prototype purchase lines add up to the recorded ₹1,791", pr.purchased === 1791 && pr.recorded === 1791, pr.purchased);
ok("no purchased component repeated in the extra items", pr.extra.every((x) => !/ESP32|PIR|relay|DHT22|LDR|OLED|buzzer|LED module|fan|adapter/i.test(x.label)));
ok("energy meter is optional and kept apart", pr.extra.find((x) => x.key === "pzem").optional && pr.optional.typ === 549 && pr.required.typ === 700, JSON.stringify(pr.required));

/* ---------- quantities from the building model ---------- */
let e = C.estimate(S, A, {});
const zonesWithLoads = S.ZONES.filter((z) => z.lights + z.fans > 0).length;
ok("one node per control zone with lights or fans", e.q.nodes === zonesWithLoads && e.q.nodes === 64, e.q.nodes);
ok("two PIR per node (firmware inputs)", e.q.pir === 2 * e.q.nodes);
const circ = S.ZONES.reduce((a, z) => a + (z.lights > 0) + (z.fans > 0), 0);
ok("switched circuits = lights + fans circuits, AC not switched", e.q.circuits === circ && e.q.circuits === 120 && e.q.acUnitsExcluded === S.ZONES.reduce((a, z) => a + z.acs, 0), `${e.q.circuits} circuits, ${e.q.acUnitsExcluded} AC units excluded`);
ok("one contactor per switched circuit when enabled", e.q.contactors === e.q.circuits);
ok("relay channels used fit on one 4-channel board per node", e.q.channelsUsed <= 4 * e.q.relayBoards && e.q.flags.channels.length === 0);
ok("largest circuit current is within the 50 % relay limit", e.q.maxCircuitA < 5 && e.q.flags.overRelay.length === 0, e.q.maxCircuitA.toFixed(2) + " A");
ok("large zones flagged for a coverage check (corridors, research cell)", e.q.flags.coverage.length === 9 && e.q.flags.coverage.every((f) => /C\/|306/.test(f.id)));
const e2 = C.estimate(S, A, { buildings: 2 });
ok("two buildings double nodes and hardware", e2.q.nodes === 128 && near(e2.hw.typ, 2 * e.hw.typ, 1e-6) && e2.total.typ > 1.9 * e.total.typ);
const enc = C.estimate(S, A, { includeCorridors: false });
ok("excluding corridors removes 8 nodes and 8 circuits", enc.q.nodes === 56 && enc.q.circuits === 112);
const ec = C.estimate(S, A, { contactors: false });
ok("without contactors: no contactor or distribution-box lines, lower total", !ec.lines.some((l) => l.key === "contactor" || l.key === "dbbox") && ec.total.typ < e.total.typ);
const hot = C.estimate(S, { ...A, W_light: 400 }, {});
ok("a 400 W-per-light circuit is flagged over the relay limit", hot.q.flags.overRelay.length > 0);

/* ---------- totals ---------- */
const sumLines = (s) => e.lines.reduce((a, l) => a + l[s], 0);
ok("hardware + wiring + labour = sum of lines", ["low", "typ", "high"].every((s) => near(e.hw[s] + e.wire[s] + e.lab[s], sumLines(s), 1e-6)));
ok("contingency is 10 / 15 / 20 % of the subtotal", near(e.contingency.low, e.beforeCont.low * 0.1) && near(e.contingency.typ, e.beforeCont.typ * 0.15) && near(e.contingency.high, e.beforeCont.high * 0.2));
ok("low < typical < high totals", e.total.low < e.total.typ && e.total.typ < e.total.high, [e.total.low, e.total.typ, e.total.high].map(Math.round).join(" / "));
ok("ten cost categories present (9 + contingency)", e.byCat.length === 9 && e.byCat.every((c) => c.typ > 0));
const q1 = C.estimate(S, A, {}, { esp32: 500 });
ok("a quoted unit price replaces low, typical and high", q1.lines.find((l) => l.key === "esp32").status === "quote" && near(q1.lines.find((l) => l.key === "esp32").low, 500 * 64));
const q0 = C.estimate(S, A, {}, { esp32: -5 });
ok("a negative quote is ignored", q0.lines.find((l) => l.key === "esp32").status === "listing");
ok("labour grows with floor level", (() => { const g = S.ZONES.filter((z) => z.room.floor === "G" && z.room.type === "class").length; return g > 0 && e.q.elec_h > e.q.nodes * 5.5; })());

/* ---------- operating cost and payback ---------- */
const om = C.operating(e, { offH: 134.7, onH: 33.3 }, 8);
ok("node electronics: 64 nodes × 1 W × 8,760 h", near(om.kwhNode, 64 * 8.76, 1e-6), om.kwhNode.toFixed(0) + " kWh");
ok("relay coils run while loads are held off, incl. non-term weeks", near(om.relayH, 134.7 * 40 + (365 / 7 - 40) * 168, 1e-6));
ok("contactor coils run only while loads are on", near(om.kwhCont, (120 * 2 * 33.3 * 40) / 1000, 1e-6));
ok("operating total = spares + inspection + energy", near(om.typ.total, om.typ.spares + om.typ.inspection + om.typ.energy, 1e-9));
const omMissing = C.operating(e, null, 8);
ok("without simulation hours the energy part is reported missing", omMissing.kwh === null && omMissing.typ.total === null);
let pb = C.payback(e, om, 300000);
ok("payback = install ÷ (gross − O&M)", near(pb.typ.years, e.total.typ / (300000 - om.typ.total), 1e-9), pb.typ.years.toFixed(2) + " y");
pb = C.payback(e, om, 1000);
ok("O&M above gross: no payback", pb.typ.none === true && pb.typ.net < 0);
pb = C.payback(e, om, om.typ.total);
ok("net exactly zero: no payback", pb.typ.none === true);
pb = C.payback(e, omMissing, 300000);
ok("missing O&M: payback reported missing", pb.typ.missing === true);
pb = C.payback(e, omMissing, 300000, 20000);
ok("an O&M override is used when given", near(pb.typ.years, e.total.typ / 280000, 1e-9));
pb = C.payback(e, om, NaN); ok("invalid gross: missing", pb.typ.missing === true);
pb = C.payback(e, om, 0); ok("zero gross: no payback", pb.typ.none === true);

/* ---------- design inputs are sanitised ---------- */
ok("buildings clamped to 1–50 and rounded", C.design({ buildings: 0 }).buildings === 1 && C.design({ buildings: 999 }).buildings === 50 && C.design({ buildings: 2.6 }).buildings === 3);
ok("wrong-typed options ignored", C.design({ contactors: "no" }).contactors === true);

/* ---------- week report feeds the estimator ---------- */
(async () => {
  const r = await M.computeReport({ period: "week", scope: "all", base: "manual" });
  ok("week report has per-circuit coil hours", r.coil.all.n === 120 && r.coil.noCorr.n === 112 && near((r.coil.all.on + r.coil.all.off) / r.coil.all.n, 168, 1e-6), (r.coil.all.off / r.coil.all.n).toFixed(1) + " h off per circuit-week");
  const elig = (r.cls.before.lights - r.cls.after.lights + r.cls.before.fans - r.cls.after.fans) / 1000;
  ok("eligible saving (lights + fans) equals the whole saving when AC is held", near(elig, r.saved / 1000, 1e-6), elig.toFixed(1) + " kWh/week");
  ok("corridor split is part of the totals", r.clsCorr.before.lights > 0 && r.clsCorr.before.lights < r.cls.before.lights && r.clsCorr.before.fans === 0);
  console.log(R.join("\n")); const F = R.filter((x) => x.startsWith("FAIL")).length; console.log("CHECKS", R.length, "FAILS", F); process.exit(F ? 1 : 0);
})();
