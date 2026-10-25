// Animation behaviour tests (Playwright, headless Chromium): animations follow state, stay within
// limits, stop under reduced motion, with the Motion switch and while the tab is hidden, and the page
// makes no network requests. Usage: node tools/dashboard/v2/motion_test.js
const { chromium } = require("playwright");
const path = require("path");
const URL = process.env.NEST_URL || "file://" + path.resolve(__dirname, "../../../results/nest/NEST_Dashboard.html");
const EXE = process.env.PW_CHROMIUM || undefined; // optional path to a Chromium binary
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const R = [], errs = [], ext = []; const ok = (n, c, i = "") => R.push(`${c ? "PASS" : "FAIL"}  ${n}${i !== "" ? "  [" + String(i).slice(0, 110) + "]" : ""}`);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: "no-preference" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  p.on("request", (r) => { if (!/^(file|data|blob):/.test(r.url())) ext.push(r.url()); });
  const E = (f, a) => p.evaluate(f, a), wait = (ms) => p.waitForTimeout(ms);
  await p.goto(URL + "#overview"); await E(() => { try { localStorage.removeItem("nest_motion"); } catch (e) {} }); await p.reload(); await wait(300);
  ok("page transition runs", (await E(() => getComputedStyle(document.querySelector(".page")).animationName)) === "pageIn");
  ok("charts draw in when built", (await E(() => document.querySelectorAll("#ovTl path.draw").length)) >= 1);
  await E(() => { PNM.st.playing = false; PNM.st.min = 640; }); await wait(1400);
  const kw = await E(() => [document.querySelector("#kKw .n").textContent, PNM.IN(PNM.snapshot().kw, 1)]);
  ok("number transition settles on the exact value", kw[0] === kw[1], kw.join(" vs "));
  const lit = await E(() => { const s = PNM.slotNow(); let n = 0; PNM.S.ZONES.forEach((z, zi) => { if (z.room.side === "S" && z.room.type !== "corridor" && z.lights && PNM.circ(zi, 0, s).on) n++; }); return [document.querySelectorAll("#ovIso .iwin.lit").length, n]; });
  ok("lit windows match the lights that are on (south side)", lit[0] === lit[1] && lit[0] > 0, lit.join(" = "));
  ok("light sweep animates", (await E(() => getComputedStyle(document.querySelector("#ovIso .sweep")).animationName)) === "sweep");
  ok("KPI sparklines drawn", (await E(() => [...document.querySelectorAll(".kpi .spark .sl")].filter((x) => (x.getAttribute("d") || "").length > 20).length)) === 4);
  await E(() => { PNM.st.speed = 5; PNM.st.playing = true; }); await wait(3500);
  const pulses = await E(() => [document.querySelectorAll("#ovIso .pulse.go").length, document.querySelectorAll("#ovIso .pulse.hw").length]);
  ok("PIR waves follow simulated motion (cyan, none marked ESP32)", pulses[0] > 0 && pulses[1] === 0, pulses.join(" / "));
  ok("waves are throttled (at most two rings per zone)", pulses[0] <= 2 * 64);
  // warning and manual states visible on the building
  const wv = await E(() => { const ev = PNM.events().find((e) => e.e === "warning" && e.k === 0 && e.sl > PNM.slotNow()); if (!ev) return null; PNM.st.playing = false; PNM.st.min = (ev.sl + 1) / PNM.S.SPM; return ev.zi; });
  await wait(700);
  ok("30 s warning shown as an amber outline", wv !== null && (await E(() => document.querySelectorAll("#ovIso .cell.warn").length)) >= 1);
  await E(() => { const s = PNM.slotNow(); const zi = PNM.S.ZONES.findIndex((z, i) => z.lights && z.room.type !== "corridor" && PNM.SIM.zones[i].occ[s] === 0); PNM.setMode(zi, 0, "on"); PNM.data(); }); await wait(600);
  ok("manual override shown as a dashed cyan outline", (await E(() => document.querySelectorAll("#ovIso .cell.man").length)) >= 1);
  await E(() => { Object.keys(PNM.st.ovr).forEach((k) => delete PNM.st.ovr[k]); PNM.st.ovrV++; });
  // simulated node event -> one toast
  await E(() => { const ev = PNM.events().find((e) => e.sl > PNM.slotNow() + 30); PNM.st.min = ev.sl / PNM.S.SPM - 0.4; PNM.st.speed = 1; PNM.st.playing = true; });
  await wait(2600);
  ok("simulated event raises a 'sim' toast", /sim/.test(await E(() => document.getElementById("toasts").textContent)));
  // energy flow
  await p.goto(URL + "#sources"); await E(() => { PNM.st.playing = false; PNM.st.min = 640; }); await wait(1500);
  const parts = await E(() => document.querySelectorAll("#flow circle[r='3']").length);
  ok("energy-flow dots run, capped at 42", parts > 0 && parts <= 42, parts);
  const moved = await E(async () => { const c = document.querySelector("#flow circle[r='3']"); const a = c.getAttribute("cx"); await new Promise((r) => setTimeout(r, 300)); return a !== c.getAttribute("cx"); });
  ok("dots move along the lines", moved);
  ok("dots use the source and load colours", await E(() => new Set([...document.querySelectorAll("#flow circle[r='3']")].map((c) => c.getAttribute("fill"))).size >= 3));
  // hidden tab: loops stop doing work
  await E(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); }); await wait(400);
  ok("hidden tab: flow dots removed", (await E(() => document.querySelectorAll("#flow circle[r='3']").length)) === 0);
  await E(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); }); await wait(400);
  ok("visible again: dots come back", (await E(() => document.querySelectorAll("#flow circle[r='3']").length)) > 0);
  // fans coast down when switched off
  await p.goto(URL + "#building"); await E(() => { PNM.st.playing = false; PNM.st.min = 9 * 60 + 30; PNM.st.room = "DKM-104"; PNM.st.floor = "1"; }); await p.goto(URL + "#map"); await wait(1500);
  const ang = () => E(() => { const g = document.querySelector("#twStage .blade"); return g ? g.getAttribute("transform") : null; });
  const a0 = await ang(); await wait(300); const a1 = await ang();
  ok("fans rotate while on", a0 !== null && a0 !== a1);
  await E(() => { PNM.ROOM["DKM-104"].zoneIdx.forEach((zi) => PNM.setMode(zi, 1, "off")); PNM.data(); }); await wait(350);
  const b0 = await ang(); await wait(250); const b1 = await ang(); await wait(2600); const b2 = await ang(); await wait(300); const b3 = await ang();
  ok("fans coast down after switch-off, then stop", b0 !== b1 && b2 === b3, [b0, b1, b2, b3].map((x) => (x || "").replace(/rotate\(|\)/g, "").slice(0, 6)).join(" → "));
  await E(() => { Object.keys(PNM.st.ovr).forEach((k) => delete PNM.st.ovr[k]); PNM.st.ovrV++; });
  // Motion switch
  await p.click("#motionBtn"); await wait(300);
  ok("Motion switch off: page marked nomotion", await E(() => document.documentElement.classList.contains("nomotion")) && /off/.test(await p.textContent("#motionBtn")));
  await p.goto(URL + "#sources"); await wait(1200);
  ok("Motion off: no flow dots, no chart draw-in", (await E(() => document.querySelectorAll("#flow circle[r='3']").length)) === 0 && (await E(() => document.querySelectorAll("path.draw").length)) === 0);
  ok("Motion off: hub value exact at once", (await E(() => [...document.querySelectorAll("#flow text")].some((t) => t.textContent === PNM.IN(PNM.snapshot().kw, 1)))));
  await p.reload(); await wait(500);
  ok("Motion setting remembered in this browser", await E(() => document.documentElement.classList.contains("nomotion")));
  await p.click("#motionBtn"); await wait(200);
  ok("Motion back on", !(await E(() => document.documentElement.classList.contains("nomotion"))));
  // system reduced motion
  const c2 = await b.newContext({ viewport: { width: 1440, height: 950 }, reducedMotion: "reduce" }); const q = await c2.newPage(); q.on("pageerror", (e) => errs.push(e.message));
  await q.goto(URL + "#sources"); await q.waitForTimeout(1500);
  ok("reduced motion: no dots, no draw-in, nomotion class", (await q.evaluate(() => document.querySelectorAll("#flow circle[r='3']").length + document.querySelectorAll("path.draw").length)) === 0 && (await q.evaluate(() => document.documentElement.classList.contains("nomotion"))));
  await q.goto(URL + "#overview"); await q.evaluate(() => { PNM.st.speed = 15; }); await q.waitForTimeout(2500);
  ok("reduced motion: no PIR wave animations", (await q.evaluate(() => document.querySelectorAll(".pulse.go").length)) === 0);
  ok("reduced motion: simulation still runs", (await q.evaluate(() => PNM.st.min)) > 10 * 60 + 25);
  await c2.close();
  // all pages, offline
  for (const pg of ["overview", "building", "energy", "sources", "controls", "insights", "savings"]) { await p.goto(URL + "#" + pg); await wait(pg === "insights" || pg === "savings" ? 3500 : 900); }
  ok("no network requests on any page (works offline)", ext.length === 0, ext.slice(0, 3).join(" "));
  console.log(R.join("\n")); const F = R.filter((x) => x.startsWith("FAIL")).length; console.log("CHECKS", R.length, "FAILS", F, "| page errors", JSON.stringify(errs));
  await b.close(); process.exit(F || errs.length ? 1 : 0);
})();
