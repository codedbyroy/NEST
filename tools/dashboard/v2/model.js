// NEST console, data layer (no DOM rendering here).
// State, cached simulation access, per-circuit state with overrides, Web Serial bridge and
// report computation. Carried over from tools/dashboard/app.js (v1) with the same behaviour;
// the v2 UI (ui.js) reads everything through window.PNM.
(function (root) {
  "use strict";
  const S = root.PNSIM, PN = root.PN;
  const IN = (v, d = 0) => Number(v).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
  const kwh = (wh, d = 1) => IN(wh / 1000, d);
  const pct = (a, b) => (b > 0 ? (100 * (b - a)) / b : 0);
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------------- state ---------------- */
  const st = {
    page: "overview", day: 0, min: 10 * 60 + 20, playing: true, speed: 5,
    A: { ...S.DEFAULT_ASSUMPTIONS }, ovr: {}, ovrV: 0, ovrLog: [], occOv: {}, occV: 0,
    floor: "1", room: "DKM-104", metric: "occ", scope: "all", sortK: "saved", sortD: -1,
    ctlFloor: "1", ctlOnlyWaste: false, live: null, liveMsg: "", energySpan: "full",
  };
  try { const a = JSON.parse(localStorage.getItem("pn_dash_A") || "null"); if (a) Object.assign(st.A, a); } catch (e) {}
  const saveA = () => { try { localStorage.setItem("pn_dash_A", JSON.stringify(st.A)); } catch (e) {} };
  const ROOM = Object.fromEntries(S.ROOMS.map((r) => [r.id, r]));
  const FLOOR_NAME = Object.fromEntries(S.FLOORS.map((f) => [f.id, f.name]));
  const PLUG_TYPES = new Set(["lab", "office", "staff", "cabin", "seminar", "library"]);
  const EVT = { 4: "warning", 5: "cancel", 6: "off", 7: "on" };

  /* ---------------- cached simulation ---------------- */
  let SIM = null, AGG = null, D = null, SUP = null, EVENTS = null, simKey = "", aggKey = "", supKey = "";
  function data() {
    const A = st.A;
    const k = [st.day, A.allowCooling, A.p_left_on, A.p_lunch_on, st.occV].join("|");
    if (k !== simKey) { SIM = S.simulateDay(st.day, { ...A }, st.occOv); simKey = k; aggKey = ""; EVENTS = null; }
    const ak = [simKey, st.ovrV, A.baseline, A.W_light, A.W_fan, A.W_ac, A.ac_duty, A.W_pc].join("|");
    if (ak !== aggKey) { SIM.A = { ...A }; AGG = S.aggregate(SIM, st.ovr); D = derive(SIM, AGG); aggKey = ak; supKey = ""; }
    const sk = [aggKey, A.pv_kwp, A.pv_cloud, A.outage_start_min, A.outage_len_min].join("|");
    if (sk !== supKey) { SUP = S.supply(D.kw.after, A, st.day); supKey = sk; }
    return D;
  }
  function derive(sim, agg) {
    const NB = S.NB, z0 = () => new Float64Array(NB);
    const mk = () => ({ before: { lights: z0(), fans: z0(), ac: z0(), plugs: z0() }, after: { lights: z0(), fans: z0(), ac: z0(), plugs: z0() }, waste: { before: z0(), after: z0() }, people: z0() });
    const bld = mk(), floors = {}, rooms = {};
    S.FLOORS.forEach((f) => (floors[f.id] = mk()));
    S.ROOMS.forEach((r) => (rooms[r.id] = mk()));
    agg.forEach((a) => {
      const zn = S.ZONES[a.zi], r = zn.room;
      for (const tgt of [bld, floors[r.floor], rooms[r.id]]) {
        for (const c of S.CLS) for (let b = 0; b < NB; b++) { tgt.before[c][b] += a.before[c][b]; tgt.after[c][b] += a.after[c][b]; }
        for (let b = 0; b < NB; b++) { tgt.waste.before[b] += a.waste.before[b]; tgt.waste.after[b] += a.waste.after[b]; if (r.type !== "corridor") tgt.people[b] += a.people[b]; }
      }
    });
    const tot = (o, which, upto, classes = S.CLS) => { let t = 0; for (const c of classes) { const a = o[which][c]; for (let b = 0; b < (upto ?? NB); b++) t += a[b]; } return t; };
    const series = (o, which) => { const s = z0(); for (const c of S.CLS) for (let b = 0; b < NB; b++) s[b] += o[which][c][b]; return s; };
    const toKW = (arr) => Float64Array.from(arr, (v) => (v * (60 / S.BKT)) / 1000);
    return { bld, floors, rooms, tot, series, kw: { before: toKW(series(bld, "before")), after: toKW(series(bld, "after")) }, toKW };
  }
  // every node event of the day for loads that exist, sorted by slot
  function events() {
    data();
    if (!EVENTS) {
      EVENTS = [];
      SIM.zones.forEach((z) => { const zn = S.ZONES[z.zi]; z.ev.forEach(([sl, k, e]) => { if (EVT[e] && [zn.lights, zn.fans, zn.acs][k]) EVENTS.push({ sl, zi: z.zi, k, e: EVT[e] }); }); });
      EVENTS.sort((a, b) => a.sl - b.sl);
    }
    return EVENTS;
  }
  function eventsUpTo(s, n, filterZones) {
    const E = events(); let lo = 0, hi = E.length; while (lo < hi) { const m = (lo + hi) >> 1; if (E[m].sl <= s) lo = m + 1; else hi = m; }
    const out = []; for (let i = lo - 1; i >= 0 && out.length < n; i--) if (!filterZones || filterZones.includes(E[i].zi)) out.push(E[i]);
    return out;
  }

  /* ---------------- circuit state now ---------------- */
  const slotNow = () => Math.min(S.SPD - 1, Math.floor(st.min * S.SPM));
  const bktNow = () => Math.min(S.NB - 1, Math.floor(st.min / S.BKT));
  const baseKey = () => (st.A.baseline === "timeout" ? "tmo" : "man");
  const baseName = () => (st.A.baseline === "timeout" ? "15-min timeout sensor" : "manual switching");
  function ovrAt(zi, k, s) { const L = st.ovr[zi + ":" + k]; if (L) for (let i = L.length - 1; i >= 0; i--) if (s >= L[i].from && s < L[i].to) return L[i]; return null; }
  // effective state of one zone circuit at slot s: {on, state:'on'|'warn'|'off', manual, held}
  function circ(zi, k, s) {
    const z = SIM.zones[zi], o = ovrAt(zi, k, s);
    if (o) return { on: o.mode === "on", state: o.mode === "on" ? "on" : "off", manual: true };
    if (k === 2 && !st.A.allowCooling) { const on = !!z[baseKey()][s]; return { on, state: on ? "on" : "off", held: true }; }
    const v = z.st[s * 3 + k];
    return v === 0 ? { on: true, state: "on" } : v === 1 ? { on: true, state: "warn" } : { on: false, state: "off" };
  }
  function zoneNow(zi, s = slotNow()) {
    const z = SIM.zones[zi], zn = S.ZONES[zi];
    const lv = liveOK();
    if (lv && lv.zi === zi) {
      const L = lv.L; const mk = (k) => { const v = L.s[k]; return v === 0 ? { on: true, state: "on" } : v === 1 ? { on: true, state: "warn" } : { on: false, state: "off" }; };
      return { zn, people: null, O: L.O, n: L.n, act: L.act, win: lv.win.slice(), c: [mk(0), mk(1), mk(2)], tau: L.tau, live: true };
    }
    const win = []; for (let j = s - 29; j <= s; j++) win.push(j >= 0 ? z.act[j] : 0);
    let tau = 0; for (let j = s; j >= 0 && j > s - 6 * 60 * 30; j--) { if (z.O[j] >= 500 || z.act[j]) break; tau += S.SLOT; }
    return { zn, people: z.occ[s], O: z.O[s] / 1000, n: win.reduce((a, b) => a + b, 0), act: z.act[s], win, c: [circ(zi, 0, s), circ(zi, 1, s), circ(zi, 2, s)], tau: [tau, tau, tau] };
  }
  function zoneKW(zi, s) {
    const zn = S.ZONES[zi], w = S.zoneWatts(zn, st.A), z = SIM.zones[zi];
    const c = [circ(zi, 0, s), circ(zi, 1, s), circ(zi, 2, s)];
    return (c[0].on * w.lights + c[1].on * w.fans + c[2].on * w.ac + plugKW(zi, s) * 1000) / 1000;
  }
  function plugKW(zi, s) { const zn = S.ZONES[zi], z = SIM.zones[zi]; return PLUG_TYPES.has(zn.room.type) && z.man[s] ? S.zoneWatts(zn, st.A).plugs / 1000 : 0; }
  function wasteNow(zi, s) { const z = SIM.zones[zi], zn = S.ZONES[zi]; if (z.occ[s] > 0) return 0; let n = 0; [zn.lights, zn.fans, zn.acs].forEach((cnt, k) => { if (cnt && circ(zi, k, s).on) n++; }); return n; }
  const presence = (zi, s) => { const z = SIM.zones[zi]; return z.O[s] >= 500 || z.act[s] === 1; };
  // block-wide snapshot at slot s
  function snapshot(s = slotNow()) {
    data();
    const out = { people: 0, kw: 0, occZones: 0, zones: 0, present: 0, wasteCircuits: 0, pir: 0,
      cls: { lights: { on: 0, n: 0, kw: 0 }, fans: { on: 0, n: 0, kw: 0 }, ac: { on: 0, n: 0, kw: 0 }, plugs: { on: 0, n: 0, kw: 0 } } };
    S.ZONES.forEach((zn, zi) => {
      const z = SIM.zones[zi], w = S.zoneWatts(zn, st.A);
      if (zn.room.type !== "corridor") { out.zones++; out.people += z.occ[s]; if (z.occ[s] > 0) out.occZones++; }
      if (presence(zi, s)) out.present++;
      if (z.act[s]) out.pir++;
      [["lights", zn.lights, w.lights], ["fans", zn.fans, w.fans], ["ac", zn.acs, w.ac]].forEach(([c, cnt, watt], k) => { if (!cnt) return; const on = circ(zi, k, s).on; out.cls[c].n++; if (on) { out.cls[c].on++; out.cls[c].kw += watt / 1000; } });
      if (zn.pcs && PLUG_TYPES.has(zn.room.type)) { out.cls.plugs.n++; const p = plugKW(zi, s); if (p) { out.cls.plugs.on++; out.cls.plugs.kw += p; } }
      out.wasteCircuits += zn.room.type === "corridor" ? 0 : wasteNow(zi, s);
    });
    out.kw = out.cls.lights.kw + out.cls.fans.kw + out.cls.ac.kw + out.cls.plugs.kw;
    return out;
  }

  /* ---------------- manual overrides ---------------- */
  function setMode(zi, k, mode, quiet) {
    const s = slotNow(), key = zi + ":" + k, L = (st.ovr[key] = st.ovr[key] || []);
    for (let i = L.length - 1; i >= 0; i--) { if (L[i].from >= s) L.splice(i, 1); else if (L[i].to > s) L[i].to = s; }
    if (mode !== "auto") L.push({ from: s, to: S.SPD, mode });
    if (!L.length) delete st.ovr[key];
    if (!quiet) { const zn = S.ZONES[zi]; logOvr(`${zn.room.id.replace("DKM-", "")} ${zn.name} ${["lights", "fans", "AC"][k]} → ${mode.toUpperCase()}`); st.ovrV++; }
  }
  function modeOf(zi, k) { const o = ovrAt(zi, k, slotNow()); return o ? o.mode : "auto"; }
  function logOvr(what) { st.ovrLog.unshift({ t: hhmm(st.min), what }); if (st.ovrLog.length > 80) st.ovrLog.pop(); }
  function bulk(floorId, action) {
    const s = slotNow(), f = S.FLOORS.find((x) => x.id === floorId); let n = 0;
    f.rooms.forEach((r) => r.zoneIdx.forEach((zi) => [0, 1, 2].forEach((k) => {
      const cnt = [S.ZONES[zi].lights, S.ZONES[zi].fans, S.ZONES[zi].acs][k]; if (!cnt) return;
      if (action === "auto") { if (st.ovr[zi + ":" + k]) { setMode(zi, k, "auto", true); n++; } }
      else if (action === "alloff") { setMode(zi, k, "off", true); n++; }
      else if (action === "lightsoff" && k === 0 && SIM.zones[zi].occ[s] === 0 && circ(zi, 0, s).on) { setMode(zi, 0, "off", true); n++; }
    })));
    logOvr(`${f.name}: ${{ auto: "all circuits to Auto", alloff: "everything off", lightsoff: "lights off in empty zones" }[action]} (${n})`);
    st.ovrV++; return n;
  }

  /* ---------------- occupancy scenarios (twin) ---------------- */
  function scenarioHalf(roomId) {
    const r = ROOM[roomId], m = Math.floor(st.min), half = Math.round(r.cap / 2), per = Math.ceil(r.cap / r.zones);
    r.zoneIdx.forEach((zi, z) => { const n = Math.max(0, Math.min(per, half - z * per)); (st.occOv[zi] = st.occOv[zi] || []).push({ from: m, to: m + 50, n }); });
    st.occV++;
  }
  function zoneOcc(zi, action) {
    const m = Math.floor(st.min), cnow = SIM.zones[zi].occ[slotNow()];
    if (action === "reset") delete st.occOv[zi];
    else (st.occOv[zi] = st.occOv[zi] || []).push({ from: m, to: m + 45, n: action === "add" ? Math.min(255, cnow + 10) : 0 });
    st.occV++;
  }

  /* ---------------- Web Serial bridge (local file, Chrome/Edge) ----------------
     Read-only. Parses the lines the node firmware already prints (firmware/nest_node/src/app.cpp,
     115200 baud) and never writes to the port, so it cannot switch anything. The twin uses the
     board's values only while valid L lines keep arriving; otherwise it falls back to the simulation. */
  const LOCAL = (() => { try { return window.self === window.top; } catch (e) { return false; } })();
  const SER = { BAUD: 115200, STALE_MS: 25000, WAIT_HINT_MS: 15000, LOG_N: 24, MAX_LINE: 240 };
  const USB_VENDOR = { 0x10c4: "Silicon Labs CP210x", 0x1a86: "WCH CH340 / CH9102", 0x0403: "FTDI", 0x303a: "Espressif native USB" };
  const listeners = new Set();
  const emit = () => listeners.forEach((f) => { try { f(); } catch (e) {} });
  const isInt = (v, lo, hi) => /^\d+$/.test(v) && +v >= lo && +v <= hi;
  const isNum = (v) => /^-?\d+(\.\d+)?$/.test(v) || /^-?nan$/i.test(v);
  // One line -> {type, ...}. type: L P S B E (valid telemetry), profile, comment, other (boot ROM text etc.),
  // garbled (unreadable bytes), bad (known tag but wrong shape or range), empty.
  function parseSerialLine(raw) {
    const l = String(raw).replace(/\r+$/, "").trim();
    if (!l) return { type: "empty" };
    if (l.length > SER.MAX_LINE) return { type: "bad", why: "line longer than " + SER.MAX_LINE + " characters" };
    if (/[\uFFFD\x00-\x08\x0e-\x1f]/.test(l)) return { type: "garbled", why: "unreadable bytes" };
    if (l[0] === "#") { const m = /^# profile=(room|bench)$/.exec(l); return m ? { type: "profile", profile: m[1] } : { type: "comment" }; }
    const f = l.split(","), tag = f[0];
    if (!["L", "P", "S", "B", "E"].includes(tag)) return { type: "other" };
    const bad = (why) => ({ type: "bad", tag, why });
    const want = { L: 17, P: 4, S: 14, B: 4, E: 8 }[tag];
    if (f.length !== want) return bad(`${tag} line has ${f.length} fields, expected ${want}`);
    if (!isInt(f[1], 0, Number.MAX_SAFE_INTEGER)) return bad("t_ms is not a whole number");
    const t = +f[1];
    if (tag === "L") {
      if (!isInt(f[2], 0, 1)) return bad("act must be 0 or 1");
      if (!isInt(f[3], 0, 30)) return bad("n must be 0 to 30");
      if (!isInt(f[4], 0, 1000)) return bad("O_milli must be 0 to 1000");
      for (let i = 5; i <= 8; i++) if (!isInt(f[i], 0, 2)) return bad(`s${i - 5} must be 0, 1 or 2`);
      for (let i = 9; i <= 12; i++) if (!isInt(f[i], 0, 1000)) return bad(`W${i - 9}_milli must be 0 to 1000`);
      for (let i = 13; i <= 16; i++) if (!isInt(f[i], 0, 1e9)) return bad(`tau${i - 13} must be a whole number of seconds`);
      if (f[2] === "1" && f[3] === "0") return bad("act is 1 but n is 0");
      return { type: "L", t, act: f[2] === "1", n: +f[3], O: +f[4] / 1000, s: f.slice(5, 9).map(Number), W: f.slice(9, 13).map((v) => v / 1000), tau: f.slice(13, 17).map(Number) };
    }
    if (tag === "P") {
      if (!isInt(f[2], 0, 1) || !isInt(f[3], 0, 1)) return bad("PIR levels must be 0 or 1");
      return { type: "P", t, pir: [+f[2], +f[3]] };
    }
    if (tag === "S") {
      if (!isInt(f[2], 0, 30) || ![3, 4, 5, 6, 7].every((i) => isNum(f[i])) || !/^-?\d+$/.test(f[8]) || !isInt(f[9], 0, 1) || !/^[01]{4}$/.test(f[10]) || !/^[012]{4}$/.test(f[11]) || !isInt(f[12], 0, 4294967295) || !isInt(f[13], 0, 4294967295)) return bad("status line fields out of range");
      const T = parseFloat(f[6]), RH = parseFloat(f[7]);
      return { type: "S", t, T: isFinite(T) && T > -20 && T < 70 ? T : null, RH: isFinite(RH) && RH >= 0 && RH <= 100 ? RH : null, tzFresh: f[9] === "1", dhtErr: +f[12] };
    }
    if (tag === "B") {
      const a = /^reset_reason=(\d+)$/.exec(f[2]), d = /^dry_run=([01])$/.exec(f[3]);
      if (!a || !d) return bad("boot line fields not recognised");
      return { type: "B", t, reset: +a[1], dry: d[1] === "1" };
    }
    if (!isInt(f[2], 0, 3) || !/^[a-z_]+$/.test(f[3])) return bad("event line fields not recognised");
    return { type: "E", t, ch: +f[2], ev: f[3] };
  }
  const freshLive = (info) => ({ state: "connecting", zi: S.HW_ZONE, L: null, win: new Array(30).fill(0), pir: null, profile: null, dry: null, env: null,
    lastMs: 0, lastAnyMs: 0, openedMs: Date.now(), nodeMs: -1, restarts: 0, lines: 0, valid: 0, bad: 0, garbled: 0, other: 0, lastBad: null, err: null, log: [], info: info || "",
    confirm: 0, pulses: 0 }); // confirm = consecutive L lines with an advancing node clock; pulses = motion seen by the board
  function ingestLine(raw) {
    const L = st.live; if (!L) return null;
    const q = parseSerialLine(raw); if (q.type === "empty") return q;
    const now = Date.now(); L.lines++; L.lastAnyMs = now;
    const okT = ["L", "P", "S", "B", "E"].includes(q.type);
    L.log.push({ at: now, line: String(raw).replace(/\r+$/, "").slice(0, 160), cls: okT || q.type === "profile" ? "ok" : q.type === "bad" || q.type === "garbled" ? "bad" : "" });
    if (L.log.length > SER.LOG_N) L.log.shift();
    if (q.type === "bad") { L.bad++; L.lastBad = { line: String(raw).slice(0, 120), why: q.why }; emit(); return q; }
    if (q.type === "garbled") { L.garbled++; emit(); return q; }
    if (q.type === "other" || q.type === "comment") { L.other++; return q; }
    if (q.type === "profile") { L.profile = q.profile; emit(); return q; }
    L.valid++;
    // node restart: a boot line after data, or the node clock going backwards
    if ((q.type === "B" && L.nodeMs >= 0) || (q.t !== undefined && L.nodeMs >= 0 && q.t + 1000 < L.nodeMs)) { L.restarts++; L.win.fill(0); L.L = null; L.confirm = 0; if (L.state === "receiving") L.state = "waiting"; }
    if (q.t !== undefined) L.nodeMs = q.t;
    if (q.type === "B") L.dry = q.dry;
    else if (q.type === "P") { if (L.pir && ((q.pir[0] && !L.pir[0]) || (q.pir[1] && !L.pir[1]))) L.pulses++; else if (!L.pir && (q.pir[0] || q.pir[1])) L.pulses++; L.pir = q.pir; }
    else if (q.type === "S") L.env = { T: q.T, RH: q.RH, tzFresh: q.tzFresh, dhtErr: q.dhtErr, at: now };
    else if (q.type === "L") { L.confirm = L.L && q.t > L.L.t ? L.confirm + 1 : 1; if (q.act) L.pulses++; L.win.shift(); L.win.push(q.act ? 1 : 0); L.L = q; L.lastMs = now; L.state = "receiving"; L.err = null; }
    emit(); return q;
  }
  // receiving -> stale when no valid L line for STALE_MS (the node prints one every 10 s slot)
  function checkStale() {
    const L = st.live; if (!L || !link) return;
    if (L.state === "receiving" && Date.now() - L.lastMs > SER.STALE_MS) L.state = "stale";
    emit(); // also refreshes the "last line Xs ago" text once a second
  }
  const liveOK = () => (st.live && st.live.state === "receiving" && st.live.L ? st.live : null);
  let link = null, serialHooked = false;
  function serialSupport() { if (typeof navigator === "undefined" || !navigator.serial) return "unsupported"; if (!LOCAL) return "blocked"; return "ok"; }
  function friendly(e, phase) {
    const n = (e && e.name) || "", m = (e && e.message) || String(e);
    if (phase === "pick" && n === "NotFoundError") return { cancel: true, msg: "No port selected." };
    if (n === "SecurityError") return { msg: "The browser blocked USB access here. Open the downloaded HTML file directly in Chrome or Edge." };
    if (phase === "open" && n === "InvalidStateError") return { msg: "That port is already open in this tab. Disconnect first, then link again." };
    if (phase === "open") return { msg: "Could not open the port (" + m + "). Usually another program has it open: close the Arduino or PlatformIO serial monitor and try again, or unplug and replug the board." };
    if (n === "NetworkError" || /lost|disconnect/i.test(m)) return { msg: "The USB connection was lost (" + m + "). Check the cable and that the board is powered, then link again." };
    return { msg: m };
  }
  async function connectSerial() {
    const sup = serialSupport();
    if (sup !== "ok" || link) return;
    if (!serialHooked) { serialHooked = true; try { navigator.serial.addEventListener("disconnect", (ev) => { if (link && ev.target === link.port) { link.unplugged = true; } }); } catch (e) {} }
    let port;
    try { port = await navigator.serial.requestPort(); }
    catch (e) { const f = friendly(e, "pick"); st.live = f.cancel ? null : { ...freshLive(), state: "error", err: f.msg }; st.liveMsg = f.cancel ? f.msg : ""; emit(); return; }
    let info = ""; try { const i = port.getInfo ? port.getInfo() : {}; if (i.usbVendorId !== undefined) info = `USB ${i.usbVendorId.toString(16).padStart(4, "0")}:${(i.usbProductId || 0).toString(16).padStart(4, "0")}${USB_VENDOR[i.usbVendorId] ? " · " + USB_VENDOR[i.usbVendorId] : ""}`; } catch (e) {}
    st.liveMsg = ""; st.live = freshLive(info); emit();
    try { await port.open({ baudRate: SER.BAUD }); }
    catch (e) { st.live.state = "error"; st.live.err = friendly(e, "open").msg; emit(); return; }
    st.live.state = "waiting"; st.live.openedMs = Date.now();
    const me = (link = { port, reader: null, keep: true, unplugged: false, timer: setInterval(checkStale, 1000) });
    emit();
    me.done = (async () => {
      const dec = new TextDecoder(); let buf = "", fatal = null;
      while (me.keep && port.readable) {
        me.reader = port.readable.getReader();
        try {
          for (;;) {
            const { value, done } = await me.reader.read(); if (done) break;
            buf += dec.decode(value, { stream: true });
            let i; while ((i = buf.indexOf("\n")) >= 0) { ingestLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
            if (buf.length > 4 * SER.MAX_LINE) { ingestLine(buf); buf = ""; } // no newline for a long time: flag it, drop it
          }
        } catch (e) {
          // framing, parity, break and overrun errors are recoverable: a new readable appears
          if (!["BreakError", "FramingError", "ParityError", "BufferOverrunError"].includes(e && e.name)) { fatal = e; me.keep = false; }
          else if (st.live) { st.live.garbled++; emit(); }
        } finally { try { me.reader.releaseLock(); } catch (e) {} me.reader = null; }
      }
      clearInterval(me.timer);
      try { await port.close(); } catch (e) {}
      if (link === me) link = null;
      if (fatal || me.unplugged) { if (st.live) { st.live.state = "error"; st.live.err = friendly(fatal || { name: "NetworkError", message: "device disconnected" }, "read").msg; } }
      else st.live = null;
      emit();
    })();
    return me.done;
  }
  async function disconnectSerial() {
    const me = link; if (!me) { if (st.live) { st.live = null; emit(); } return; }
    me.keep = false;
    try { if (me.reader) await me.reader.cancel(); } catch (e) {}
    try { await me.done; } catch (e) {}
    st.live = null; st.liveMsg = "Disconnected. The port is closed."; emit();
  }
  const clearLiveError = () => { if (st.live && st.live.state === "error" && !link) { st.live = null; emit(); } };
  try { window.addEventListener("pagehide", () => { if (link) { link.keep = false; try { link.reader && link.reader.cancel(); } catch (e) {} } }); } catch (e) {}

  /* ---------------- reports (async, yields between days) ---------------- */
  const repCache = new Map();
  async function computeReport(opt, onProgress) {
    const { period, scope, base } = opt;
    const key = JSON.stringify([period, scope, base, st.A, st.day, st.ovrV, st.occV]);
    if (repCache.has(key)) return repCache.get(key);
    const days = period === "week" ? [0, 1, 2, 3, 4, 5, 6] : [st.day];
    const inScope = (r) => scope === "all" || (scope.startsWith("f:") && r.floor === scope.slice(2)) || scope === "r:" + r.id;
    const scopeName = scope === "all" ? "DKM block" : scope.startsWith("f:") ? FLOOR_NAME[scope.slice(2)] : scope.slice(2) + " · " + ROOM[scope.slice(2)].name;
    const A = { ...st.A, baseline: base };
    const perDay = [], roomTot = {}, cls = { before: {}, after: {} }, clsCorr = { before: {}, after: {} };
    S.CLS.forEach((c) => { cls.before[c] = 0; cls.after[c] = 0; clsCorr.before[c] = 0; clsCorr.after[c] = 0; });
    // switched lights/fans circuits: hours NEST keeps each one on / holds it off (drives relay and contactor coil energy)
    const coil = { all: { on: 0, off: 0, n: 0 }, noCorr: { on: 0, off: 0, n: 0 } };
    const profB = new Float64Array(S.NB), profA = new Float64Array(S.NB), sup = { grid: 0, pv: 0, dg: 0 };
    const occHour = [], peak = { kw: 0, d: 0, b: 0 };
    const csv = [["day", "room", "name", "floor", "kwh_without", "kwh_with", "kwh_saved", "saved_pct", "kwh_empty_without", "kwh_empty_with"]];
    for (let di = 0; di < days.length; di++) {
      const d = days[di];
      onProgress && onProgress(di / days.length, S.DAYS[d]);
      await new Promise((r) => setTimeout(r, 0));
      const sim = S.simulateDay(d, A, d === st.day ? st.occOv : null); sim.A = A;
      const ag = S.aggregate(sim, d === st.day ? st.ovr : null), dd = derive(sim, ag);
      let b = 0, a = 0; const hrs = new Float64Array(24), kwA = new Float64Array(S.NB);
      S.ROOMS.filter(inScope).forEach((r) => {
        const t = dd.rooms[r.id], rb = dd.tot(t, "before"), ra = dd.tot(t, "after"); b += rb; a += ra;
        let wb = 0, wa = 0; for (let i = 0; i < S.NB; i++) { wb += t.waste.before[i]; wa += t.waste.after[i]; hrs[Math.floor((i * S.BKT) / 60)] += t.people[i] / (60 / S.BKT); }
        const x = (roomTot[r.id] = roomTot[r.id] || { r, b: 0, a: 0, wb: 0, wa: 0 }); x.b += rb; x.a += ra; x.wb += wb; x.wa += wa;
        S.CLS.forEach((c) => { const b1 = dd.tot(t, "before", undefined, [c]), a1 = dd.tot(t, "after", undefined, [c]); cls.before[c] += b1; cls.after[c] += a1; if (r.type === "corridor") { clsCorr.before[c] += b1; clsCorr.after[c] += a1; } });
        r.zoneIdx.forEach((zi) => { const zn = S.ZONES[zi], st3 = sim.zones[zi].st; [0, 1].forEach((k) => { if (![zn.lights, zn.fans][k]) return; let off = 0; for (let j = 0; j < S.SPD; j++) if (st3[j * 3 + k] === 2) off++;
          const offH = (off * S.SLOT) / 3600, onH = 24 - offH; for (const g of r.type === "corridor" ? [coil.all] : [coil.all, coil.noCorr]) { g.off += offH; g.on += onH; if (di === 0) g.n++; } }); });
        for (let i = 0; i < S.NB; i++) { const bi = S.CLS.reduce((u, c) => u + t.before[c][i], 0), ai = S.CLS.reduce((u, c) => u + t.after[c][i], 0); profB[i] += bi / days.length; profA[i] += ai / days.length; kwA[i] += (ai * 12) / 1000; }
        csv.push([S.DAYS[d], r.id, r.name, r.floor, (rb / 1000).toFixed(3), (ra / 1000).toFixed(3), ((rb - ra) / 1000).toFixed(3), pct(ra, rb).toFixed(1), (wb / 1000).toFixed(3), (wa / 1000).toFixed(3)]);
      });
      for (let i = 0; i < S.NB; i++) if (kwA[i] > peak.kw) { peak.kw = kwA[i]; peak.d = d; peak.b = i; }
      const sp = S.supply(dd.kw.after, A, d), e = (arr) => arr.reduce((u, v) => u + v, 0) * (S.BKT / 60), share = a / (dd.tot(dd.bld, "after") || 1);
      sup.grid += e(sp.grid) * share; sup.pv += e(sp.pv) * share; sup.dg += e(sp.dg) * share;
      perDay.push({ d, b, a }); occHour.push({ d, hrs });
    }
    onProgress && onProgress(1, "");
    const TB = perDay.reduce((u, x) => u + x.b, 0), TA = perDay.reduce((u, x) => u + x.a, 0);
    const ctlB = cls.before.lights + cls.before.fans + cls.before.ac, ctlA = cls.after.lights + cls.after.fans + cls.after.ac;
    const rows = Object.values(roomTot).sort((x, y) => y.b - y.a - (x.b - x.a));
    const rep = { period, scope, scopeName, base, A, days, perDay, TB, TA, saved: TB - TA, cls, clsCorr, coil, ctlB, ctlA, rows, sup, csv, profB, profA, occHour, peak };
    repCache.set(key, rep); if (repCache.size > 12) repCache.delete(repCache.keys().next().value);
    return rep;
  }
  /* ---------------- bill-based savings estimate (kept apart from the simulation) ----------------
     Plain arithmetic on what the user types: an assumed monthly bill times an assumed saving
     percentage. Nothing here reads the simulated building, so the two datasets never mix. */
  const BILL = { MIN: 200000, MAX: 300000, STEP: 5000, DEF: 250000, PMIN: 5, PMAX: 30, PDEF: 10, TARGET: 25 };
  function billEstimate(inp) {
    const val = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
    const bill = val(inp.bill), p = val(inp.pct), cost = val(inp.install), maint = val(inp.maint), share = val(inp.share);
    const err = {};
    if (!(bill >= BILL.MIN && bill <= BILL.MAX)) err.bill = `Enter a monthly bill between ₹${IN(BILL.MIN)} and ₹${IN(BILL.MAX)}.`;
    if (!(p >= BILL.PMIN && p <= BILL.PMAX)) err.pct = `Enter a saving between ${BILL.PMIN} % and ${BILL.PMAX} %.`;
    if (cost !== null && !(isFinite(cost) && cost >= 0)) err.install = "Enter zero or a positive amount.";
    if (maint !== null && !(isFinite(maint) && maint >= 0)) err.maint = "Enter zero or a positive amount.";
    if (share !== null && !(isFinite(share) && share > 0 && share <= 100)) err.share = "Enter a share above 0 and at most 100 %.";
    const out = { err, ok: !err.bill && !err.pct, target: p === BILL.TARGET };
    if (!out.ok) return out;
    out.monthly = (bill * p) / 100;
    out.annualGross = out.monthly * 12;
    out.range = [(bill * BILL.PMIN * 12) / 100, (bill * BILL.PMAX * 12) / 100];
    const hasCost = cost !== null && !err.install && cost > 0, hasMaint = maint !== null && !err.maint;
    if (hasCost) out.payback = cost / out.annualGross; // years
    if (hasMaint) { out.annualNet = out.annualGross - maint; out.neverPays = out.annualNet <= 0; if (hasCost && !out.neverPays) out.paybackNet = cost / out.annualNet; }
    if (share !== null && !err.share) { out.implied = (100 * p) / share; out.impossible = out.implied > 100; }
    return out;
  }

  const csvText = (rows) => rows.map((r) => r.map((v) => (/[,"]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",")).join("\n");

  root.PNM = {
    S, PN, st, saveA, ROOM, FLOOR_NAME, PLUG_TYPES, LOCAL,
    IN, kwh, pct, hhmm, esc,
    data, get SIM() { return SIM; }, get SUP() { return SUP; }, get D() { return D; },
    events, eventsUpTo, slotNow, bktNow, baseKey, baseName, ovrAt, circ, zoneNow, zoneKW, plugKW, wasteNow, presence, snapshot,
    setMode, modeOf, logOvr, bulk, scenarioHalf, zoneOcc,
    SER, serialSupport, connectSerial, disconnectSerial, clearLiveError, parseSerialLine, ingestLine, liveOK, freshLive, onLive: (f) => listeners.add(f),
    billEstimate, BILL,
    computeReport, csvText,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
