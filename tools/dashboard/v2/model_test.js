// Unit tests for the data layer: bill-based estimate and serial line validation.
// Usage: node tools/dashboard/v2/model_test.js   (no browser, no hardware)
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname, "../../..");
for (const f of ["tools/twin/pn_core.js", "tools/dashboard/sim.js", "tools/dashboard/v2/model.js"]) vm.runInThisContext(fs.readFileSync(path.join(root, f), "utf8"), { filename: f });
const M = globalThis.PNM;
const R = []; const ok = (n, c, i = "") => R.push(`${c ? "PASS" : "FAIL"}  ${n}${i !== "" ? "  [" + i + "]" : ""}`);
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

/* ---------- bill estimate ---------- */
let r = M.billEstimate({ bill: 250000, pct: 10 });
ok("10 % of ₹2,50,000: monthly ₹25,000", r.ok && near(r.monthly, 25000), r.monthly);
ok("annual gross = 12 × monthly", near(r.annualGross, 300000), r.annualGross);
ok("range across 5–30 % shown", near(r.range[0], 150000) && near(r.range[1], 900000), r.range.join(" – "));
ok("no installation cost: no payback figure", r.payback === undefined && r.paybackNet === undefined && r.annualNet === undefined);
r = M.billEstimate({ bill: 250000, pct: 10, install: 450000 });
ok("simple payback = cost / annual gross (1.5 y)", near(r.payback, 1.5), r.payback);
r = M.billEstimate({ bill: 250000, pct: 10, install: 450000, maint: 60000 });
ok("annual net = gross − maintenance", near(r.annualNet, 240000), r.annualNet);
ok("net payback = cost / net (1.875 y)", near(r.paybackNet, 1.875) && !r.neverPays, r.paybackNet);
r = M.billEstimate({ bill: 200000, pct: 5, install: 100000, maint: 150000 });
ok("maintenance ≥ saving: does not pay back", r.neverPays === true && r.paybackNet === undefined && r.annualNet === -30000, r.annualNet);
r = M.billEstimate({ bill: 200000, pct: 5, install: 100000, maint: 120000 });
ok("maintenance exactly equal to saving: does not pay back", r.neverPays === true && r.annualNet === 0);
r = M.billEstimate({ bill: 300000, pct: 30, install: "", maint: "" });
ok("upper bounds accepted (₹3,00,000, 30 %)", r.ok && near(r.annualGross, 1080000));
ok("empty strings count as not entered", r.payback === undefined && r.annualNet === undefined);
r = M.billEstimate({ bill: 199999, pct: 10 }); ok("bill below ₹2,00,000 rejected", !r.ok && !!r.err.bill && r.monthly === undefined);
r = M.billEstimate({ bill: 300001, pct: 10 }); ok("bill above ₹3,00,000 rejected", !r.ok && !!r.err.bill);
r = M.billEstimate({ bill: 250000, pct: 4 }); ok("saving below 5 % rejected", !r.ok && !!r.err.pct);
r = M.billEstimate({ bill: 250000, pct: 31 }); ok("saving above 30 % rejected", !r.ok && !!r.err.pct);
r = M.billEstimate({ bill: "abc", pct: 10 }); ok("non-numeric bill rejected", !r.ok && !!r.err.bill);
r = M.billEstimate({ bill: 250000, pct: 10, install: -5 }); ok("negative installation cost flagged, no payback", r.ok && !!r.err.install && r.payback === undefined);
r = M.billEstimate({ bill: 250000, pct: 10, install: 0 }); ok("zero installation cost gives no payback figure", r.ok && r.payback === undefined);
r = M.billEstimate({ bill: 250000, pct: 25 }); ok("25 % flagged as the target scenario", r.target === true);
r = M.billEstimate({ bill: 250000, pct: 10 }); ok("10 % is not the target", r.target === false);
r = M.billEstimate({ bill: 250000, pct: 25, share: 40 }); ok("25 % of bill with 40 % share needs 62.5 % cut", near(r.implied, 62.5) && !r.impossible, r.implied);
r = M.billEstimate({ bill: 250000, pct: 25, share: 20 }); ok("25 % of bill with 20 % share is impossible", r.impossible === true && near(r.implied, 125), r.implied);
r = M.billEstimate({ bill: 250000, pct: 25, share: 0 }); ok("share of 0 % rejected", !!r.err.share && r.implied === undefined);
r = M.billEstimate({ bill: 250000, pct: 25, share: 101 }); ok("share above 100 % rejected", !!r.err.share);
// separation: the estimate does not change when the simulation changes
const before = JSON.stringify(M.billEstimate({ bill: 260000, pct: 12, install: 300000, maint: 20000 }));
M.st.A.allowCooling = !M.st.A.allowCooling; M.st.day = 3; M.data();
ok("estimate independent of simulation state", JSON.stringify(M.billEstimate({ bill: 260000, pct: 12, install: 300000, maint: 20000 })) === before);
M.st.A.allowCooling = !M.st.A.allowCooling; M.st.day = 0;

/* ---------- serial line validation (formats from firmware/nest_node/src/app.cpp) ---------- */
const P = M.parseSerialLine;
const L0 = "L,123456,1,4,865,0,0,0,2,0,0,0,0,0,0,0,0";
let q = P(L0);
ok("valid L line parsed", q.type === "L" && q.t === 123456 && q.act === true && q.n === 4 && near(q.O, 0.865) && q.s.join("") === "0002", JSON.stringify(q).slice(0, 80));
ok("CRLF tolerated", P(L0 + "\r").type === "L");
ok("L with 16 fields rejected", P("L,1,0,0,0,0,0,0,2,0,0,0,0,0,0,0").type === "bad");
ok("L with 18 fields rejected", P(L0 + ",5").type === "bad");
ok("L act = 2 rejected", P("L,1,2,4,865,0,0,0,2,0,0,0,0,0,0,0,0").type === "bad");
ok("L n = 31 rejected", P("L,1,0,31,865,0,0,0,2,0,0,0,0,0,0,0,0").type === "bad");
ok("L O_milli = 1001 rejected", P("L,1,0,4,1001,0,0,0,2,0,0,0,0,0,0,0,0").type === "bad");
ok("L state 3 rejected", P("L,1,0,4,865,3,0,0,2,0,0,0,0,0,0,0,0").type === "bad");
ok("L W_milli = 1500 rejected", P("L,1,0,4,865,0,0,0,2,1500,0,0,0,0,0,0,0").type === "bad");
ok("L negative tau rejected", P("L,1,0,4,865,0,0,0,2,0,0,0,0,-1,0,0,0").type === "bad");
ok("L tau 'nan' rejected", P("L,1,0,4,865,0,0,0,2,0,0,0,0,nan,0,0,0").type === "bad");
ok("L act=1 with n=0 rejected", P("L,1,1,0,0,0,0,0,2,0,0,0,0,0,0,0,0").type === "bad");
ok("L non-numeric time rejected", P("L,abc,0,4,865,0,0,0,2,0,0,0,0,0,0,0,0").type === "bad");
q = P("P,5000,1,0"); ok("valid P line", q.type === "P" && q.pir.join() === "1,0");
ok("P level 2 rejected", P("P,5000,2,0").type === "bad");
q = P("S,60000,3,0.777,0.000,0.777,27.40,61.0,1234,1,0000,0002,0,201234");
ok("valid S line with temperature", q.type === "S" && near(q.T, 27.4) && near(q.RH, 61) && q.tzFresh);
q = P("S,60000,3,0.777,0.000,0.777,nan,nan,-1,0,0000,0002,4,201234");
ok("S line with nan DHT values accepted, T null", q.type === "S" && q.T === null && q.RH === null && q.dhtErr === 4);
ok("S line with bad coils rejected", P("S,60000,3,0.777,0.000,0.777,27.40,61.0,1234,1,0020,0002,0,201234").type === "bad");
q = P("B,412,reset_reason=1,dry_run=1"); ok("boot line: dry run read", q.type === "B" && q.dry === true && q.reset === 1);
ok("boot line dry_run=0 read", P("B,412,reset_reason=12,dry_run=0").dry === false);
ok("E line parsed", P("E,90000,0,switched_off,0.900,0.800,320,0.000").type === "E");
ok("profile header", P("# profile=room").profile === "room" && P("# profile=bench").profile === "bench");
ok("other # lines are comments", P("# serial only: L,t_ms,...").type === "comment");
ok("boot ROM text is 'other', not an error", P("rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)").type === "other");
ok("replacement characters flagged as garbled", P("\uFFFD\uFFFDx\uFFFD").type === "garbled");
ok("very long line rejected", P("L," + "1,".repeat(200)).type === "bad");
ok("empty line ignored", P("   ").type === "empty");

/* ---------- ingest: state transitions without a port ---------- */
M.st.live = M.freshLive(); M.st.live.state = "waiting";
M.ingestLine("rst:0x1 (POWERON_RESET)"); M.ingestLine("B,400,reset_reason=1,dry_run=1"); M.ingestLine("# profile=room");
ok("still waiting after header lines", M.st.live.state === "waiting" && M.liveOK() === null && M.st.live.dry === true && M.st.live.profile === "room");
M.ingestLine("L,10400,1,1,393,0,0,0,2,0,0,0,0,0,0,0,0");
ok("first valid L line -> receiving", M.st.live.state === "receiving" && !!M.liveOK());
const zi = M.S.HW_ZONE; M.data();
let zn = M.zoneNow(zi); ok("twin back zone uses board data while receiving", zn.live === true && zn.n === 1);
M.ingestLine("L,20400,0,1,393,0,0,0,9,0,0,0,0,0,0,0,0");
ok("invalid L counted, last valid kept", M.st.live.bad === 1 && M.st.live.L.t === 10400 && /s3/.test(M.st.live.lastBad.why), M.st.live.lastBad.why);
M.st.live.lastMs = Date.now() - 30000; M.st.live.state = "stale"; // what checkStale does after 25 s
zn = M.zoneNow(zi); ok("stale data not used by the twin", !zn.live && M.liveOK() === null);
M.ingestLine("L,30400,0,1,393,0,0,0,2,0,0,0,0,10,10,10,0");
ok("new valid L after stale -> receiving", M.st.live.state === "receiving");
M.ingestLine("B,380,reset_reason=1,dry_run=1");
ok("boot line after data counts a restart and waits for fresh data", M.st.live.restarts === 1 && M.st.live.state === "waiting" && M.st.live.L === null);
M.ingestLine("L,10380,0,0,0,0,0,0,2,0,0,0,0,10,10,10,0"); M.ingestLine("L,500,0,0,0,0,0,0,2,0,0,0,0,10,10,10,0");
ok("node clock going backwards counts a restart", M.st.live.restarts === 2, M.st.live.restarts);
for (let i = 0; i < 40; i++) M.ingestLine("P," + (1000 + i) + ",0,1");
ok("raw log capped", M.st.live.log.length === M.SER.LOG_N, M.st.live.log.length);
ok("PIR levels from P line", M.st.live.pir.join() === "0,1");
M.st.live = null;

console.log(R.join("\n")); const F = R.filter((x) => x.startsWith("FAIL")).length; console.log("CHECKS", R.length, "FAILS", F); process.exit(F ? 1 : 0);
