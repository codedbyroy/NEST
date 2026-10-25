// Browser tests for the Savings & cost page and the Web Serial link (Playwright, headless Chromium).
// Usage: node tools/dashboard/v2/savings_serial_test.js
// The serial part runs against a MOCK navigator.serial that streams lines in the firmware's format.
// It checks the page logic only; it is not a hardware test and proves nothing about a real ESP32.
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs"), os = require("os");
const FILE = path.resolve(__dirname, "../../../results/nest/NEST_Dashboard.html");
const URL = process.env.NEST_URL || "file://" + FILE;
const EXE = process.env.PW_CHROMIUM || undefined; // optional path to a Chromium binary
const MOCK = () => {
  const enc = new TextEncoder();
  const S = (window.__serial = { mode: "ok", opened: 0, closed: 0, cancelled: 0, writeAccess: 0, lastOpts: null, ctrl: null });
  class FakePort extends EventTarget {
    constructor() { super(); this.readable = null; }
    get writable() { S.writeAccess++; return null; }
    getInfo() { return { usbVendorId: 0x10c4, usbProductId: 0xea60 }; }
    async open(o) {
      S.lastOpts = o;
      if (S.mode === "busy") { const e = new Error("Failed to open serial port."); e.name = "NetworkError"; throw e; }
      S.opened++;
      this.readable = new ReadableStream({ start: (c) => { S.ctrl = c; }, cancel: () => { S.cancelled++; } });
    }
    async close() { S.closed++; this.readable = null; }
  }
  const serial = { async requestPort() { if (S.mode === "cancel") { const e = new Error("No port selected by the user."); e.name = "NotFoundError"; throw e; } return new FakePort(); }, addEventListener() {} };
  Object.defineProperty(navigator, "serial", { value: serial, configurable: true });
  window.__send = (t) => S.ctrl.enqueue(enc.encode(t));
  window.__unplug = () => { const e = new Error("The device has been lost."); e.name = "NetworkError"; S.ctrl.error(e); };
};
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const R = [], errs = []; const ok = (n, c, i = "") => R.push(`${c ? "PASS" : "FAIL"}  ${n}${i !== "" ? "  [" + String(i).slice(0, 110) + "]" : ""}`);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: "reduce" }); await ctx.addInitScript(MOCK); // exact numbers: no count-up
  const p = await ctx.newPage(); p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  const E = (f, a) => p.evaluate(f, a), txt = (sel) => p.textContent(sel), wait = (ms) => p.waitForTimeout(ms);

  /* ---------------- savings & cost ---------------- */
  await p.goto(URL + "#savings"); await E(() => { localStorage.removeItem("nest_bill_v1"); localStorage.removeItem("nest_cost_v1"); }); await p.reload();
  await p.waitForFunction(() => /kWh/.test(document.getElementById("simOut").textContent), null, { timeout: 20000 });
  const simBefore = await E(() => PNM.D.tot(PNM.D.bld, "after"));
  const RS = (v) => E((x) => (x < 0 ? "−₹" : "₹") + PNM.IN(Math.round(Math.abs(x))), v);
  ok("savings page opens with its own title", (await txt("#pageTitle")) === "Savings & cost");
  ok("simulation controls hidden on the savings page", !(await p.isVisible("#daySel")) && !(await p.isVisible("#playBtn")) && (await p.isVisible(".esttag")));
  ok("three kinds of result shown apart", (await E(() => document.querySelectorAll(".kinds .kind").length)) === 3 && /simulation/i.test(await txt(".k-sim")) && /estimate/i.test(await txt(".k-est")) && /No data yet/.test(await txt(".k-meas")));
  ok("banner: never added together", /never added together/.test(await txt(".banner.est")));
  // installation estimate
  const ref = await E(() => { const e = NESTCOST.estimate(PNM.S, PNM.st.A, {}); return { typ: e.total.typ, low: e.total.low, high: e.total.high, nodes: e.q.nodes }; });
  const lakhOf = (t) => { const m = /₹([\d.,]+) lakh/.exec(t); return m ? +m[1].replace(/,/g, "") * 1e5 : NaN; };
  ok("installation total is computed automatically (typical)", Math.abs(lakhOf(await txt("#iTot")) - ref.typ) < 600, (await txt("#iTot")) + " vs " + Math.round(ref.typ));
  ok("low and high scenarios shown", Math.abs(lakhOf((await txt("#iRange")).split("·")[0]) - ref.low) < 600 && /High ₹/.test(await txt("#iRange")));
  ok("no installation price asked from the user", !(await p.$("#iNum")) && !(await p.$("#mNum")));
  ok("quantities from the building model", /64nodes/.test((await txt("#iQty")).replace(/\s/g, "")) && /128PIR/.test((await txt("#iQty")).replace(/\s/g, "")) && /120switched/.test((await txt("#iQty")).replace(/\s/g, "")));
  ok("AC kept out of the plan, with the reason", /AC is not in this plan/.test(await txt("#iFlags")) && /thermal model/.test(await txt("#iFlags")));
  ok("relay rating check shown", /below the 5 A limit/.test(await txt("#iFlags")));
  ok("group bar has 4 parts", (await E(() => document.querySelectorAll("#iBar i").length)) === 4);
  await p.click("#oCont"); await wait(150);
  const noCont = lakhOf(await txt("#iTot"));
  ok("turning contactors off lowers the total and adds a warning", noCont < ref.typ - 1e5 && /must accept this/.test(await txt("#iFlags")), Math.round(noCont));
  await p.click("#oCont"); await wait(150);
  await p.click('.stepper [data-st="1"]'); await wait(150);
  ok("two buildings: 128 nodes, total about doubles", /128nodes/.test((await txt("#iQty")).replace(/\s/g, "")) && lakhOf(await txt("#iTot")) > 1.9 * ref.typ);
  await p.click('.stepper [data-st="-1"]'); await wait(150);
  await p.click("#oCorr"); await wait(150);
  ok("without corridors: 56 nodes", /56nodes/.test((await txt("#iQty")).replace(/\s/g, "")));
  await p.click("#oCorr"); await wait(150);
  await p.click("#instCard details.more >> nth=0"); await wait(200);
  ok("itemised table: 9 categories, a basis badge on every line", (await E(() => document.querySelectorAll("#iTable tr.cat").length)) === 9 && (await E(() => [...document.querySelectorAll("#iTable tr[data-line]")].every((r) => r.querySelector(".pst")))));
  ok("listing prices link their source", await E(() => [...document.querySelectorAll("#iTable tr[data-line]")].filter((r) => r.querySelector(".pst.listing")).every((r) => r.querySelector(".basis a[href^='https://']"))));
  ok("table total matches the headline", Math.abs(+(await E(() => document.querySelector('[data-t="t-typ"]').textContent.replace(/[^\d]/g, ""))) - Math.round(ref.typ)) <= 1);
  await p.fill('.qinp[data-k="esp32"]', "500"); await p.press('.qinp[data-k="esp32"]', "Tab"); await wait(200);
  const withQuote = await E(() => NESTCOST.estimate(PNM.S, PNM.st.A, {}, { esp32: 500 }).total.typ);
  ok("a quotation replaces the unit price and updates the total", Math.abs(lakhOf(await txt("#iTot")) - withQuote) < 600 && /your quote/.test(await E(() => document.querySelector('.qinp[data-k="esp32"]').closest("tr").textContent)));
  await p.fill('.qinp[data-k="esp32"]', ""); await p.press('.qinp[data-k="esp32"]', "Tab"); await wait(200);
  ok("clearing the quotation restores the listing price", Math.abs(lakhOf(await txt("#iTot")) - ref.typ) < 600);
  await p.click("#instCard details.more >> nth=2"); await wait(200);
  ok("prototype: recorded ₹1,791, nothing counted twice, not assumed working", /₹1,791/.test(await txt("#iProto")) && /Nothing already bought is counted again/.test(await txt("#iProto")) && /not confirmed/.test(await txt("#iProto")));
  // simulation card
  const wk = await E(async () => { const r = await PNM.computeReport({ period: "week", scope: "all", base: PNM.st.A.baseline }); return (r.cls.before.lights - r.cls.after.lights + r.cls.before.fans - r.cls.after.fans) / 1000; });
  const simTxt = await txt("#simOut");
  ok("simulated week saving matches the week report (lights + fans)", simTxt.includes((await E((v) => PNM.IN(v, 1), wk)) + " kWh"), wk.toFixed(1));
  ok("gross = week × 40 weeks × ₹8/kWh", simTxt.includes(await RS(wk * 40 * 8)));
  ok("payback shown for low, typical and high cost", (await E(() => document.querySelectorAll("#simOut .pb3x > div").length)) === 3);
  ok("2-year goal reported, not forced", /Project goal/.test(simTxt) && /not forced/.test(simTxt));
  await p.fill("#sWk", "20"); await p.press("#sWk", "Tab"); await wait(200);
  ok("20 academic weeks halves the gross saving", (await txt("#simOut")).includes(await RS(wk * 20 * 8)));
  await p.fill("#sWk", "40"); await p.press("#sWk", "Tab"); await wait(200);
  await p.click("#simCard details.more"); await wait(150);
  ok("running cost breakdown lists the nodes' own electricity", /Electricity used by NEST itself/.test(await txt("#omOut")));
  // bill scenario
  const out = () => txt("#estOut");
  ok("defaults: ₹2,50,000 and 10 %", (await p.inputValue("#bNum")) === "250000" && (await p.inputValue("#pNum")) === "10");
  ok("monthly ₹25,000 and annual ₹3,00,000", /Monthly gross saving₹25,000/.test(await out()) && /Annual gross saving₹3,00,000/.test(await out()));
  const bp = await E(async () => { const r = await PNM.computeReport({ period: "week", scope: "all", base: PNM.st.A.baseline }); const e = NESTCOST.estimate(PNM.S, PNM.st.A, {}); const om = NESTCOST.operating(e, { offH: r.coil.all.off / r.coil.all.n, onH: r.coil.all.on / r.coil.all.n }, PNM.st.A.tariff_grid); return { om: om.typ.total, net: 300000 - om.typ.total }; });
  ok("running cost is the automatic estimate; net = gross − running cost", (await out()).includes(await RS(bp.om)) && (await out()).includes(await RS(bp.net)));
  await p.click('#pPre [data-p="25"]'); await wait(100);
  ok("25 % chip labelled as target scenario, not proven", /target scenario, not a proven outcome/.test(await out()) && (await p.inputValue("#pRng")) === "25");
  await p.fill("#oNum", "900000"); await wait(150);
  ok("running cost above the saving: no payback", /No payback under current assumptions/.test(await out()));
  await p.fill("#oNum", "-5"); await wait(150);
  ok("negative running cost rejected", !(await p.isHidden("#eOm")));
  await p.fill("#oNum", ""); await wait(150);
  await p.fill("#bNum", "150000"); await wait(100);
  ok("bill outside ₹2–3 lakh rejected", !(await p.isHidden("#eBill")) && /Fix the inputs/.test(await out()));
  await p.fill("#bNum", "250000"); await p.fill("#pNum", "35"); await wait(100);
  ok("saving above 30 % rejected", !(await p.isHidden("#ePct")) && /Fix the inputs/.test(await out()));
  await p.fill("#pNum", "25"); await p.fill("#sNum", "20"); await wait(100);
  ok("25 % of the bill with lights + fans at 20 % flagged as not possible", /Not possible/.test(await out()));
  ok("scope warning: whole bill vs covered buildings", /percentage is taken of the whole bill/.test(await out()));
  ok("comparison with the simulation labelled as a different basis", /For comparison only, on a different basis/.test(await out()));
  await p.fill("#sNum", "40"); await wait(100);
  await p.reload(); await p.waitForFunction(() => /kWh/.test(document.getElementById("simOut").textContent), null, { timeout: 20000 });
  ok("inputs kept in this browser after reload", (await p.inputValue("#pNum")) === "25" && (await p.inputValue("#sNum")) === "40");
  ok("simulation result untouched by the estimates", (await E(() => PNM.D.tot(PNM.D.bld, "after"))) === simBefore, (simBefore / 1000).toFixed(1) + " kWh");
  for (const [h, t] of [["estimate", "Savings & cost"], ["deployment", "Savings & cost"], ["present", "Overview"]]) { await p.goto(URL + "#" + h); await wait(300); ok(`old #${h} link opens ${t}`, (await txt("#pageTitle")) === t); }
  ok("no Deployment or Faculty pages in the nav", await E(() => ![...document.querySelectorAll("#nav button")].some((b) => /Deployment|Faculty/.test(b.textContent)) && document.querySelectorAll("#nav button").length === 7));
  await p.goto(URL + "#overview"); await wait(300);
  ok("simulation controls visible again on simulation pages", await p.isVisible("#daySel"));

  /* ---------------- Web Serial (mock port) ---------------- */
  await p.goto(URL + "#building"); await E(() => { PNM.st.playing = false; }); await wait(600);
  await p.click("#hwDet summary"); await wait(100);
  const title = () => txt("#hwTitle"), sub = () => txt("#hwSub"), side = () => txt("#hwText");
  ok("starts not linked", (await title()) === "Not linked" && (await side()) === "Hardware: not linked" && !!(await p.$("#hwOn")));
  ok("read-only notice and untested label present", /never sends commands/.test(await txt("#hwBody")) && /not yet been tested with a real board/.test(await txt("#hwBody")));
  ok("instructions mention Chrome or Edge, the monitor and EN/RST", /Chrome or Edge/.test(await txt("#hwBody")) && /serial monitor/.test(await txt("#hwBody")) && /EN\/RST/.test(await txt("#hwBody")));
  await E(() => (__serial.mode = "cancel")); await p.click("#hwOn"); await wait(200);
  ok("picker cancelled: stays not linked, says no port selected", (await title()) === "Not linked" && /No port selected/.test(await txt("#hwMsg")));
  await E(() => (__serial.mode = "busy")); await p.click("#hwOn"); await wait(200);
  ok("port busy: connection error with the close-the-monitor hint", (await title()) === "Connection error" && /another program/.test(await sub()) && (await side()) === "ESP32: connection error");
  ok("error state offers Try again", /Try again/.test(await txt("#hwOn")));
  await E(() => (__serial.mode = "ok")); await p.click("#hwOn"); await wait(200);
  ok("opened at 115200 baud", (await E(() => __serial.lastOpts.baudRate)) === 115200);
  ok("connected, waiting for data", (await title()) === "Connected · waiting for valid data" && (await side()) === "ESP32: waiting for data");
  ok("USB adapter identified", /10c4:ea60 · Silicon Labs CP210x/.test(await txt("#hwFw")));
  await E(() => __send("ets Jun  8 2016 00:22:57\r\nrst:0x1 (POWERON_RESET),boot:0x13\r\nB,412,reset_reason=1,dry_run=1\r\n# S,t_ms,active_slots,p_pir\r\n# profile=room\n")); await wait(300);
  ok("boot text and headers do not count as telemetry", (await title()) === "Connected · waiting for valid data" && /Dry run: relays not driven/.test(await txt("#hwFw")) && /Profile: room/.test(await txt("#hwFw")));
  ok("twin still simulated while waiting", /sim/i.test(await txt("#twTag")));
  await E(() => __send("L,10412,1,1,393,0,0,0,2,0,0,0,0,0,0,0,0\n")); await wait(300);
  ok("first valid L line: receiving, waiting to confirm updates", (await title()) === "Receiving telemetry · confirming" && (await side()) === "ESP32: receiving data");
  ok("hardware state change shown as an ESP32 toast", /ESP32/.test(await E(() => document.getElementById("toasts").textContent)) && /First valid reading/.test(await E(() => document.getElementById("toasts").textContent)));
  ok("readings shown: n/O", (await txt("#hwNO")) === "1/30 · O 0.39", await txt("#hwNO"));
  ok("twin back zone switches to board data", /ESP32 data/.test(await txt("#twTag")) && (await txt('#twZones [data-z="1"] .oo')) === "0.39");
  await E(() => __send("L,20412,1,1,393,0,0,0,2\n")); await wait(200);
  ok("short L line counted invalid with a reason", /1 invalid/.test(await txt("#hwCnt")) && /9 fields, expected 17/.test(await txt("#hwCnt")));
  await E(() => __send("L,20412,0,1,39")); await wait(50); await E(() => __send("3,0,0,0,2,0,0,0,0,10,10,10,0\nP,20500,0,1\n")); await wait(300);
  ok("line split across USB packets reassembled", /3 valid|4 valid/.test(await txt("#hwCnt")) && (await txt("#hwPir")) === "0 · 1", await txt("#hwCnt"));
  ok("second L line with an advancing clock confirms updates", (await title()) === "Receiving valid telemetry" && /Readings updating: 2/.test(await sub()));
  ok("hardware zone tile marked as ESP32 data on the plan", await E(() => !!document.querySelector("#plan .cell.hw")));
  await E(() => __send("S,25412,1,0.393,0.000,0.393,27.40,61.0,1234,1,0000,0002,0,201234\n")); await wait(200);
  ok("S line shows room temperature and humidity", /27\.4 °C · 61 %/.test(await txt("#hwEnv")));
  await E(() => (PNM.SER.STALE_MS = 1200)); await wait(2600);
  ok("no data for longer than the limit: stale", (await title()) === "Data stale" && (await side()) === "ESP32: data stale");
  ok("twin falls back to simulation when stale", /sim/i.test(await txt("#twTag")) && (await E(() => !document.querySelector("#plan .cell.hw"))));
  await E(() => __send("L,30412,0,1,393,0,0,0,2,0,0,0,0,20,20,20,0\n")); await wait(300);
  ok("fresh L line after stale: receiving again", (await title()) === "Receiving valid telemetry");
  await E(() => (PNM.SER.STALE_MS = 25000));
  await E(() => __send("B,380,reset_reason=1,dry_run=1\n")); await wait(200);
  ok("boot line after data: restart counted, back to waiting", /restarted 1×/.test(await txt("#hwCnt")) && (await title()) === "Connected · waiting for valid data");
  await E(() => __send("L,10380,0,0,0,0,0,0,2,0,0,0,0,10,10,10,0\n")); await wait(200);
  ok("raw lines visible", /L,10380/.test(await E(() => document.getElementById("hwLog").textContent)));
  await p.click("#hwOff"); await wait(400);
  ok("disconnect cancels the reader and closes the port", (await E(() => [__serial.cancelled, __serial.closed].join())) === "1,1", await E(() => [__serial.cancelled, __serial.closed].join()));
  ok("after disconnect: not linked, live data cleared", (await title()) === "Not linked" && (await E(() => PNM.st.live)) === null && /port is closed/.test(await txt("#hwMsg")));
  await p.click("#hwOn"); await wait(200); await E(() => __send("L,10412,1,1,393,0,0,0,2,0,0,0,0,0,0,0,0\n")); await wait(200);
  await E(() => __unplug()); await wait(400);
  ok("cable pulled: connection error, port closed", (await title()) === "Connection error" && /USB connection was lost/.test(await sub()) && (await E(() => __serial.closed)) === 2);
  ok("twin not using data after the error", /sim/i.test(await txt("#twTag")));
  ok("page never touched port.writable (read-only)", (await E(() => __serial.writeAccess)) === 0);
  ok("mains safety warning in the hardware panel", /Mains safety/.test(await txt("#hwBody")) && /qualified electrician/.test(await txt("#hwBody")));
  await p.goto(URL + "#overview"); await wait(300); await p.click("#hwLine"); await wait(500);
  ok("sidebar hardware line opens the hardware panel", (await txt("#pageTitle")) === "Building" && (await E(() => document.getElementById("hwDet").open)));

  /* ---------------- unsupported and blocked ---------------- */
  const c2 = await b.newContext(); await c2.addInitScript(() => Object.defineProperty(navigator, "serial", { value: undefined, configurable: true }));
  const q = await c2.newPage(); q.on("pageerror", (e) => errs.push(e.message)); await q.goto(URL + "#building"); await q.waitForTimeout(500); await q.click("#hwDet summary");
  ok("no Web Serial: says use Chrome or Edge, no link button", /no Web Serial/.test(await q.textContent("#hwBody")) && !(await q.$("#hwOn")));
  await c2.close();
  const wrap = path.join(os.tmpdir(), "nest_iframe_" + process.pid + ".html"); fs.writeFileSync(wrap, `<!doctype html><iframe src="${URL}#building" width="1300" height="900"></iframe>`);
  const c3 = await b.newContext(); await c3.addInitScript(MOCK); const w = await c3.newPage(); await w.goto("file://" + wrap); await w.waitForTimeout(1200);
  const fr = w.frames().find((f) => f.url().includes("NEST_Dashboard")); await fr.click("#hwDet summary");
  ok("inside a frame (published page): USB blocked, no link button", /blocked inside the published page/.test(await fr.textContent("#hwBody")) && !(await fr.$("#hwOn")));
  await c3.close(); fs.unlinkSync(wrap);

  /* ---------------- phone width ---------------- */
  const m = await b.newPage({ viewport: { width: 390, height: 844 } }); m.on("pageerror", (e) => errs.push(e.message));
  for (const pg of ["savings", "building", "sources", "insights"]) { await m.goto(URL + "#" + pg); await m.waitForTimeout(pg === "insights" || pg === "savings" ? 3500 : 700); const sw = await m.evaluate(() => document.documentElement.scrollWidth); ok(`390px ${pg}: no horizontal page scroll`, sw <= 390, sw); }
  await m.close();
  console.log(R.join("\n")); const F = R.filter((x) => x.startsWith("FAIL")).length; console.log("CHECKS", R.length, "FAILS", F, "| page errors", JSON.stringify(errs));
  await b.close(); process.exit(F || errs.length ? 1 : 0);
})();
