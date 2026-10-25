// JavaScript port of the firmware decision core (pn_core.cpp / pn_node.cpp), room
// profile only, beta = 0 (PIR-only), no daylight or outdoor data, thermal screen
// disabled (cooling switch-offs vetoed). Verified slot-by-slot against the C++ trace
// by tools/twin/verify_js_port.js. Keep both implementations in step.
(function (root) {
  "use strict";
  const CFG = {
    slot_s: 10, window_slots: 30, kappa: 2.0, occupied_threshold: 0.5,
    w1: 0.55, w2: 0.30, w3: 0.15, gamma: 10.0, trigger_W: 0.72, z_at_trigger: 0.85,
    warning_s: 30, min_on_before_off_s: 180,
    loads: [
      { cls: "lighting", name: "Lights", grace_s: 180 },
      { cls: "fan", name: "Fans", grace_s: 600 },
      { cls: "cooling", name: "AC", grace_s: 600 },
    ],
  };
  const ST = { On: 0, Warning: 1, Off: 2 };
  const EV = { None: 0, Proposed: 1, VetoCycle: 2, VetoThermal: 3, WarningStarted: 4,
               WarningCanceled: 5, SwitchedOff: 6, RestoredOccupancy: 7, Startup: 8 };
  const EV_NAME = ["none", "proposed", "veto_cycle", "veto_thermal", "warning_started",
                   "warning_canceled", "switched_off", "restored_occupancy", "startup"];
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const z0 = CFG.z_at_trigger - Math.log(CFG.trigger_W / (1 - CFG.trigger_W)) / CFG.gamma;
  const W_of = (z) => 1 / (1 + Math.exp(-CFG.gamma * (z - z0)));

  // opts.allowCooling: simulation-only switch for the scale-up scenario; models a node
  // whose thermal screen has a validated room model. The deployed firmware default is false.
  function makeNode(opts) {
    const allowCooling = !!(opts && opts.allowCooling);
    const ring = new Array(CFG.window_slots).fill(false);
    let head = 0, n = 0;
    const loads = CFG.loads.map((lc) => ({ lc, state: ST.On, lastPresence: 0, onSince: 0, warnSince: 0 }));
    return {
      reset(t_ms, startOff) { for (const L of loads) { L.state = startOff ? ST.Off : ST.On; L.lastPresence = t_ms; L.onSince = t_ms; L.warnSince = 0; } },
      step(t_ms, active) {
        if (ring[head]) n--;
        ring[head] = active; if (active) n++;
        head = (head + 1) % CFG.window_slots;
        const p_pir = 1 - Math.exp(-n / CFG.kappa);
        const O = p_pir;  // beta = 0
        const presence = O >= CFG.occupied_threshold || active;
        const out = { n, O, loads: [] };
        for (const L of loads) {
          if (presence) L.lastPresence = t_ms;
          const tau = (t_ms - L.lastPresence) / 1000;
          const timer = clamp01(tau / L.lc.grace_s);
          let ev = EV.None, z, W;
          if (L.state === ST.On) {
            z = CFG.w1 * (1 - O) + CFG.w2 * timer; W = W_of(z);
            if (z >= CFG.z_at_trigger - 1e-6) {
              if (t_ms - L.onSince < CFG.min_on_before_off_s * 1000) ev = EV.VetoCycle;
              else if (L.lc.cls === "cooling" && !allowCooling) ev = EV.VetoThermal;   // no validated thermal model
              else { L.state = ST.Warning; L.warnSince = t_ms; ev = EV.WarningStarted; }
            }
          } else if (L.state === ST.Warning) {
            z = CFG.w1 * (1 - O) + CFG.w2 * timer; W = W_of(z);
            if (presence) { L.state = ST.On; ev = EV.WarningCanceled; }
            else if (t_ms - L.warnSince >= CFG.warning_s * 1000) { L.state = ST.Off; ev = EV.SwitchedOff; }
          } else {
            z = CFG.w2 * timer; W = W_of(z);
            if (presence) { L.state = ST.On; L.onSince = t_ms; ev = EV.RestoredOccupancy; }
          }
          out.loads.push({ state: L.state, on: L.state !== ST.Off, warning: L.state === ST.Warning, z, W, tau, ev });
        }
        return out;
      },
    };
  }
  root.PN = { CFG, ST, EV, EV_NAME, makeNode, z0 };
  if (typeof module !== "undefined") module.exports = root.PN;
})(typeof globalThis !== "undefined" ? globalThis : this);
