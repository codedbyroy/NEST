// NEST building simulation (scale-up scenario).
// A placeholder DKM block: rooms split into zones, one NEST node per zone running
// the firmware decision core (pn_core.js, verified against the C++). Occupancy comes from a
// seeded timetable model; PIR events are synthetic. Everything here is SIMULATED.
(function (root) {
  "use strict";
  const PN = root.PN || (typeof require !== "undefined" ? require("../twin/pn_core.js") : null);
  const SLOT = 10, SPD = 8640, SPM = 6, MIN = 1440, BKT = 5, NB = MIN / BKT; // 5-min buckets
  const CLS = ["lights", "fans", "ac", "plugs"];
  const CLS_NAME = { lights: "Lighting", fans: "Fans", ac: "Air conditioning", plugs: "Plug loads" };

  // ---------- assumptions (all editable from the page) ----------
  const DEFAULT_ASSUMPTIONS = {
    W_light: 36, W_fan: 60, W_ac: 1500, ac_duty: 0.7, W_pc: 90,
    tariff_grid: 8.0, tariff_dg: 26.0, ef_grid: 0.727, ef_dg: 0.90,
    pv_kwp: 25, pv_cloud: 0.85, outage_start_min: 15 * 60, outage_len_min: 30,
    allowCooling: false, baseline: "manual", p_left_on: 0.35, p_lunch_on: 0.5,
  };

  // ---------- placeholder building ----------
  // x,y,w,d in metres on a 62 m x 18 m floor plate; corridor y 7.6..10.4.
  function room(id, name, type, x, side, w, extra) {
    const d = 7.6, y = side === "N" ? 0 : 10.4;
    return Object.assign({ id, name, type, x, y, w, d, side }, extra);
  }
  const C = (id, x, side, ac) => room(id, "Classroom", "class", x, side, 9.6, { cap: 60, zones: 2, lights: 8, fans: 4, acs: ac, pcs: 0 });
  const FLOORS = [
    { id: "G", name: "Ground floor", rooms: [
      room("DKM-G01", "Seminar hall", "seminar", 0, "N", 19.2, { cap: 120, zones: 3, lights: 18, fans: 9, acs: 4, pcs: 2 }),
      C("DKM-G02", 19.2, "N", 0), room("DKM-G03", "Department office", "office", 28.8, "N", 7.2, { cap: 6, zones: 1, lights: 4, fans: 2, acs: 1, pcs: 4 }),
      room("DKM-G04", "Faculty room", "staff", 36, "N", 12, { cap: 16, zones: 2, lights: 8, fans: 4, acs: 1, pcs: 6 }),
      room("DKM-G05", "HOD cabin", "cabin", 48, "N", 6, { cap: 3, zones: 1, lights: 2, fans: 1, acs: 1, pcs: 1 }),
      C("DKM-G06", 0, "S", 0), C("DKM-G07", 9.6, "S", 0),
      room("DKM-G08", "Reading room", "library", 19.2, "S", 14.4, { cap: 40, zones: 2, lights: 10, fans: 6, acs: 2, pcs: 2 }),
    ] },
    { id: "1", name: "First floor", rooms: [
      C("DKM-101", 0, "N", 0), C("DKM-102", 9.6, "N", 0), C("DKM-103", 19.2, "N", 0), C("DKM-104", 28.8, "N", 2),
      room("DKM-105", "Computer lab 1", "lab", 38.4, "N", 14.4, { cap: 36, zones: 2, lights: 12, fans: 6, acs: 2, pcs: 36 }),
      C("DKM-106", 0, "S", 0), C("DKM-107", 9.6, "S", 0), C("DKM-108", 19.2, "S", 0),
    ] },
    { id: "2", name: "Second floor", rooms: [
      C("DKM-201", 0, "N", 2), C("DKM-202", 9.6, "N", 2), C("DKM-203", 19.2, "N", 0),
      room("DKM-204", "Computer lab 2", "lab", 28.8, "N", 14.4, { cap: 36, zones: 2, lights: 12, fans: 6, acs: 2, pcs: 36 }),
      C("DKM-205", 0, "S", 0), C("DKM-206", 9.6, "S", 0),
      room("DKM-207", "IoT & embedded lab", "lab", 19.2, "S", 14.4, { cap: 30, zones: 2, lights: 10, fans: 6, acs: 2, pcs: 12 }),
    ] },
    { id: "3", name: "Third floor", rooms: [
      C("DKM-301", 0, "N", 2), C("DKM-302", 9.6, "N", 2),
      room("DKM-303", "Project lab", "lab", 19.2, "N", 14.4, { cap: 30, zones: 2, lights: 10, fans: 6, acs: 2, pcs: 16 }),
      C("DKM-304", 0, "S", 0), C("DKM-305", 9.6, "S", 0),
      room("DKM-306", "Research cell", "staff", 19.2, "S", 9.6, { cap: 10, zones: 1, lights: 6, fans: 3, acs: 1, pcs: 6 }),
    ] },
  ];
  // corridors as their own one-zone "rooms" (lights only)
  FLOORS.forEach((f) => f.rooms.push(room(`DKM-${f.id}C`, "Corridor", "corridor", 0, "N", 54, { y: 7.6, d: 2.8, cap: 0, zones: 2, lights: 12, fans: 0, acs: 0, pcs: 0 })));
  FLOORS.forEach((f) => f.rooms.forEach((r) => (r.floor = f.id)));
  const ROOMS = FLOORS.flatMap((f) => f.rooms);
  const PLATE = { W: 54, D: 18 };
  const ZONE_NAMES = { 1: ["Whole room"], 2: ["Front", "Back"], 3: ["Front", "Middle", "Back"] };
  const ZONES = [];
  ROOMS.forEach((r) => {
    r.zoneIdx = [];
    for (let z = 0; z < r.zones; z++) {
      const share = (n) => Math.floor(n / r.zones) + (z < n % r.zones ? 1 : 0);
      const zn = { id: `${r.id}/${z}`, room: r, z, name: r.type === "corridor" ? (z ? "East" : "West") : ZONE_NAMES[r.zones][z],
                   lights: share(r.lights), fans: share(r.fans), acs: share(r.acs), pcs: share(r.pcs), cap: Math.ceil(r.cap / r.zones) };
      r.zoneIdx.push(ZONES.length); ZONES.push(zn);
    }
  });
  const HW_ZONE = ZONES.findIndex((z) => z.id === "DKM-104/1"); // where the prototype node would sit

  // ---------- RNG ----------
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hm = (h, m) => h * 60 + m;
  const PERIODS = [[hm(9, 0), hm(9, 55)], [hm(9, 55), hm(10, 50)], [hm(11, 5), hm(12, 0)], [hm(12, 0), hm(12, 55)], [hm(13, 45), hm(14, 40)], [hm(14, 40), hm(15, 35)], [hm(15, 35), hm(16, 30)]];
  const LAB_BLOCKS = [[hm(9, 0), hm(10, 50)], [hm(11, 5), hm(12, 55)], [hm(13, 45), hm(16, 30)]];
  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // ---------- occupancy model: people count per zone per minute + "movement" flag ----------
  function roomOccupancy(r, day, R) {
    const Z = r.zones, cnt = Array.from({ length: Z }, () => new Uint8Array(MIN)), mov = Array.from({ length: Z }, () => new Uint8Array(MIN));
    const sat = day === 5, sun = day === 6;
    const fill = (from, to, n, frontFirst) => {         // n people in [from,to) with staggered arrival/departure
      const per = Math.ceil(r.cap / Z);
      for (let k = 0; k < n; k++) {
        const z = frontFirst ? Math.min(Z - 1, Math.floor(k / per)) : k % Z;
        const a = Math.max(0, from - 5 + Math.floor(R() * 10)), b = Math.min(MIN, to - 1 + Math.floor(R() * 6));
        for (let m = a; m < b; m++) cnt[z][m]++;
        mov[z][a] = 1; if (b < MIN) mov[z][Math.min(MIN - 1, b)] = 1;
        if (R() < 0.08) { const e = a + 5 + Math.floor(R() * (b - a - 10)); if (e > a && e < b) for (let m = e; m < Math.min(b, e + 3); m++) mov[z][m] = 1; }
      }
    };
    if (sun) return { cnt, mov };
    const lastHour = sat ? hm(13, 0) : MIN;
    if (r.type === "class") {
      PERIODS.forEach(([a, b]) => {
        if (b > lastHour || R() > (sat ? 0.35 : 0.78)) return;
        const n = Math.round(r.cap * (0.3 + 0.65 * R()));
        fill(a, b, n, true);
        if (R() < 0.2) fill(b, b + 10 + Math.floor(R() * 20), 2 + Math.floor(R() * 3), true); // stay-backs
      });
    } else if (r.type === "lab") {
      LAB_BLOCKS.forEach(([a, b]) => { if (b > lastHour || R() > (sat ? 0.3 : 0.7)) return; fill(a, b, Math.round(r.cap * (0.45 + 0.5 * R())), true); });
    } else if (r.type === "seminar") {
      if (R() < (sat ? 0.2 : 0.45)) { const s = [hm(10, 0), hm(11, 30), hm(14, 0)][Math.floor(R() * 3)]; fill(s, s + 90 + Math.floor(R() * 60), Math.round(r.cap * (0.3 + 0.6 * R())), true); }
    } else if (r.type === "staff" || r.type === "office" || r.type === "library" || r.type === "cabin") {
      const open = r.type === "library" ? [hm(9, 0), sat ? hm(13, 0) : hm(17, 0)] : [hm(8, 45), sat ? hm(13, 0) : hm(17, 15)];
      for (let m = open[0]; m < open[1]; m += 30) {
        const base = r.type === "cabin" ? (R() < 0.65 ? 1 : 0) : Math.round(r.cap * (r.type === "library" ? 0.1 + 0.5 * R() : 0.15 + 0.5 * R()));
        if (m >= hm(13, 0) && m < hm(13, 45) && R() < 0.6) continue; // lunch
        if (base > 0) fill(m + 5, Math.min(open[1], m + 30) + 5, base, false);
      }
    }
    return { cnt, mov };
  }

  // PIR synthesis per zone slot (seated: 15 % per person per slot, movement: always, false alarm 5e-4)
  function zonePir(cnt, mov, R, corridor, day) {
    const act = new Uint8Array(SPD), occ = new Uint8Array(SPD);
    if (corridor) {
      for (let s = 0; s < SPD; s++) {
        const m = Math.floor(s / SPM);
        const work = day < 6 && m >= hm(8, 30) && m < (day === 5 ? hm(13, 30) : hm(17, 30));
        const change = PERIODS.some(([a, b]) => Math.abs(m - a) < 4 || Math.abs(m - b) < 4);
        const p = !work ? 0.002 : change ? 0.9 : 0.12;
        const hit = R() < p; act[s] = hit; occ[s] = hit ? 1 : 0;
      }
      return { act, occ };
    }
    for (let s = 0; s < SPD; s++) {
      const m = Math.floor(s / SPM), n = cnt[m];
      occ[s] = n;
      if (n === 0) act[s] = R() < 5e-4 ? 1 : 0;
      else if (mov[m] && (s % SPM) < 3) act[s] = 1;
      else act[s] = R() < 1 - Math.pow(0.85, Math.min(n, 30)) ? 1 : 0;
    }
    return { act, occ };
  }

  // ---------- one simulated day ----------
  function simulateDay(day, A, occOverrides) {
    A = A || DEFAULT_ASSUMPTIONS;
    const zones = [];
    ROOMS.forEach((r, ri) => {
      const R = rng(day * 7919 + ri * 104729 + 17);
      const { cnt, mov } = roomOccupancy(r, day, R);
      r.zoneIdx.forEach((zi, z) => {
        let c = cnt[z], mv = mov[z];
        const ov = occOverrides && occOverrides[zi];
        if (ov && ov.length) { c = c.slice(); mv = mv.slice(); for (const o of ov) for (let m = o.from; m < Math.min(MIN, o.to); m++) { c[m] = o.n; if (m === o.from || m === o.to - 1) mv[m] = 1; } }
        const { act, occ } = zonePir(c, mv, R, r.type === "corridor", day);
        zones.push(runZone(zi, act, occ, A));
      });
    });
    baselines(zones, A, day);
    return { day, zones, A };
  }

  function runZone(zi, act, occ, A) {
    const node = PN.makeNode({ allowCooling: A.allowCooling });
    node.reset(0, true);
    const st = new Uint8Array(SPD * 3), O = new Uint16Array(SPD), ev = [];
    for (let s = 0; s < SPD; s++) {
      const o = node.step((s + 1) * SLOT * 1000, act[s] === 1);
      O[s] = Math.round(o.O * 1000);
      for (let k = 0; k < 3; k++) { const L = o.loads[k]; st[s * 3 + k] = L.state; if (L.ev && L.ev !== PN.EV.VetoCycle && L.ev !== PN.EV.VetoThermal) ev.push([s, k, L.ev]); }
    }
    return { zi, act, occ, st, O, ev };
  }

  // Baselines: "manual" = each room's loads switched by hand, all zones together: on 5 min before a use,
  // off 10 min after it; gaps under 60 min (and the lunch gap with probability p_lunch_on) stay on; with
  // probability p_left_on the room is left on after its last use until the 18:30 round. Corridors
  // 08:30-18:00 on working days. "timeout" = one room-level sensor with a fixed 15-min timeout.
  function baselines(zones, A, day) {
    ROOMS.forEach((r, ri) => {
      const R = rng(day * 131 + ri * 977 + 3);
      const zs = r.zoneIdx.map((zi) => zones.find((x) => x.zi === zi));
      const man = new Uint8Array(SPD), tmo = new Uint8Array(SPD);
      let first = -1, last = -1;
      for (let s = 0; s < SPD; s++) if (zs.some((z) => z.occ[s] > 0)) { if (first < 0) first = s; last = s; }
      if (r.type === "corridor") { const anyUse = first >= 0; if (anyUse) for (let s = hm(8, 30) * SPM; s < hm(18, 0) * SPM; s++) man[s] = 1; }
      else if (first >= 0) {
        const used = new Uint8Array(SPD);
        for (let s = 0; s < SPD; s++) if (zs.some((z) => z.occ[s] > 0)) used[s] = 1;
        const lunchOn = R() < A.p_lunch_on;
        let prevEnd = -1;
        for (let s = 0; s < SPD; s++) {
          if (!used[s]) continue;
          let e = s; while (e + 1 < SPD && (used[e + 1] || (e + 1 - s) < 0)) e++;
          // merge with previous block when the gap is short (or lunch, if left on)
          const gap = prevEnd < 0 ? Infinity : s - prevEnd;
          const isLunch = prevEnd >= 0 && prevEnd / SPM < hm(13, 30) && s / SPM > hm(13, 20);
          const from = gap < 60 * SPM || (isLunch && lunchOn && gap < 75 * SPM) ? prevEnd : Math.max(0, s - 5 * SPM);
          for (let k = from; k <= Math.min(SPD - 1, e + 10 * SPM); k++) man[k] = 1;
          prevEnd = e; s = e;
        }
        if (R() < A.p_left_on) for (let k = last; k < Math.max(last, hm(18, 30) * SPM); k++) man[k] = 1;
      }
      let lastAct = -1e9;
      for (let s = 0; s < SPD; s++) { if (zs.some((z) => z.act[s])) lastAct = s; tmo[s] = s - lastAct <= 15 * SPM ? 1 : 0; }
      zs.forEach((z) => { z.man = man; z.tmo = tmo; });
    });
  }

  // ---------- energy aggregation (Wh per 5-min bucket, per zone per class) ----------
  function zoneWatts(zn, A) { return { lights: zn.lights * A.W_light, fans: zn.fans * A.W_fan, ac: zn.acs * A.W_ac * A.ac_duty, plugs: zn.pcs * A.W_pc }; }
  // overrides: { "<zi>:<k>": [{from_slot, to_slot, mode:'on'|'off'}] }
  function stateAfter(z, k, s, ovr) {
    const list = ovr && ovr[z.zi + ":" + k];
    if (list) for (let i = list.length - 1; i >= 0; i--) { const o = list[i]; if (s >= o.from && s < o.to) return o.mode === "on" ? 1 : 0; }
    return z.st[s * 3 + k] !== 2 ? 1 : 0;
  }
  // With the deployed policy the node never switches cooling off, so the AC follows the manual behaviour
  // unchanged (a dashboard override still applies).
  function acHeld(z, s, ovr, on0) {
    const list = ovr && ovr[z.zi + ":2"];
    if (list) for (let i = list.length - 1; i >= 0; i--) { const o = list[i]; if (s >= o.from && s < o.to) return o.mode === "on" ? 1 : 0; }
    return on0;
  }
  function aggregate(sim, ovr) {
    const A = sim.A, base = A.baseline === "timeout" ? "tmo" : "man";
    const out = sim.zones.map((z) => {
      const zn = ZONES[z.zi], w = zoneWatts(zn, A);
      const after = { lights: new Float32Array(NB), fans: new Float32Array(NB), ac: new Float32Array(NB), plugs: new Float32Array(NB) };
      const before = { lights: new Float32Array(NB), fans: new Float32Array(NB), ac: new Float32Array(NB), plugs: new Float32Array(NB) };
      const waste = { before: new Float32Array(NB), after: new Float32Array(NB) }, occ = new Float32Array(NB), people = new Float32Array(NB);
      const dt = SLOT / 3600;
      for (let s = 0; s < SPD; s++) {
        const b = Math.floor(s / (BKT * SPM)), on0 = z[base][s], empty = z.occ[s] === 0;
        const a = [stateAfter(z, 0, s, ovr), stateAfter(z, 1, s, ovr), A.allowCooling ? stateAfter(z, 2, s, ovr) : acHeld(z, s, ovr, on0)];
        // plugs: lab PCs on while the room's baseline says the room is in use (not controlled by the node)
        const plugOn = zn.room.type === "lab" || zn.room.type === "office" || zn.room.type === "staff" || zn.room.type === "cabin" || zn.room.type === "seminar" || zn.room.type === "library" ? z.man[s] : 0;
        before.lights[b] += on0 * w.lights * dt; before.fans[b] += on0 * w.fans * dt; before.ac[b] += on0 * w.ac * dt; before.plugs[b] += plugOn * w.plugs * dt;
        after.lights[b] += a[0] * w.lights * dt; after.fans[b] += a[1] * w.fans * dt; after.ac[b] += a[2] * w.ac * dt; after.plugs[b] += plugOn * w.plugs * dt;
        if (empty) { waste.before[b] += on0 * (w.lights + w.fans + w.ac) * dt; waste.after[b] += (a[0] * w.lights + a[1] * w.fans + a[2] * w.ac) * dt; }
        occ[b] += z.occ[s] > 0 ? 1 / (BKT * SPM) : 0; people[b] += z.occ[s] / (BKT * SPM);
      }
      return { zi: z.zi, before, after, waste, occ, people };
    });
    return out;
  }
  const sumArr = (arrs, upto) => { let t = 0; for (const a of arrs) for (let i = 0; i < Math.min(upto ?? a.length, a.length); i++) t += a[i]; return t; };

  // ---------- supply side: PV, grid, DG (all assumed) ----------
  function supply(loadKW, A, day) {
    const R = rng(day * 31 + 5), pv = new Float32Array(NB), grid = new Float32Array(NB), dg = new Float32Array(NB), exp = new Float32Array(NB);
    const cloud = A.pv_cloud * (0.8 + 0.4 * R());
    for (let b = 0; b < NB; b++) {
      const h = (b * BKT + BKT / 2) / 60, x = (h - 12.5) / 6.2;
      const clear = Math.abs(x) < 1 ? Math.pow(Math.cos(x * Math.PI / 2), 1.6) : 0;
      pv[b] = A.pv_kwp * 0.82 * clear * Math.min(1, cloud * (0.75 + 0.5 * R()));
      const m = b * BKT, out = m >= A.outage_start_min && m < A.outage_start_min + A.outage_len_min && day < 6;
      const used = Math.min(pv[b], loadKW[b]);
      exp[b] = pv[b] - used;
      if (out) { dg[b] = loadKW[b] - used; grid[b] = 0; exp[b] = 0; } else grid[b] = loadKW[b] - used;
      pv[b] = used;
    }
    return { pv, grid, dg, exp };
  }

  root.PNSIM = { FLOORS, PLATE, ROOMS, ZONES, HW_ZONE, CLS, CLS_NAME, DAYS, PERIODS, SLOT, SPD, SPM, NB, BKT,
                 DEFAULT_ASSUMPTIONS, simulateDay, aggregate, acHeld, supply, sumArr, zoneWatts, stateAfter };
  if (typeof module !== "undefined") module.exports = root.PNSIM;
})(typeof globalThis !== "undefined" ? globalThis : this);
