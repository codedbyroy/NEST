// NEST cost estimator: prototype cost, installation cost for the modelled building, annual
// operating cost and simple payback. No DOM; used by the dashboard (window.NESTCOST) and by
// tools/dashboard/v2/cost_test.js in Node.
//
// Every price below is either a recorded team purchase, an online retail listing checked on the
// date given, a statutory minimum wage, or a provisional engineering estimate. None of it is a
// contractor quotation. Final pricing needs a verified campus inventory and an electrician's survey.
(function (root) {
  "use strict";
  const CHECKED = "2026-10-21";
  // status: recorded = team purchase list (15 Oct 2026); listing = online retail listing, GST included;
  // regulation = statutory minimum wage; provisional = engineering estimate, no reliable price found.
  // "high +30 %" marks a high value derived from the typical one where no higher listing was found.
  const PRICES = {
    esp32: { label: "ESP32 38-pin development board", unit: "board", low: 425, typ: 449, high: 499, status: "listing",
      basis: "Robocraze ₹445 and Probots ₹499 incl. GST, Robu ₹449; team purchase ₹425",
      src: ["https://robocraze.com/products/esp32-wifi-bluetooth-development-board", "https://probots.co.in/esp32-wroom-32-nodemcu-38-pin-micro-usb-development-board.html", "https://robu.in/product/esp32-38pin-development-board-wifibluetooth-ultra-low-power-consumption-dual-core"] },
    cue: { label: "Warning buzzer + 3-colour LED module", unit: "set", low: 56, typ: 56, high: 73, status: "recorded",
      basis: "Team purchase ₹27 + ₹29; high +30 %. Needed: the firmware gives a 30 s warning before every switch-off." },
    pir: { label: "HC-SR501 PIR motion sensor", unit: "sensor", low: 54, typ: 69, high: 90, status: "listing",
      basis: "Thingbits ₹54.28 incl. GST; team purchase ₹69 each; high +30 %", src: ["https://www.thingbits.in/products/hc-sr501-pir-passive-infrared-motion-sensor"] },
    relay4: { label: "4-channel 5 V relay board, opto-isolated, 10 A 250 V AC contacts", unit: "board", low: 168, typ: 189, high: 246, status: "listing",
      basis: "Robocraze ₹189 incl. GST; team purchase ₹168; high +30 %", src: ["https://robocraze.com/products/5v-4-channel-relay-module-for-arduino-microcontrollers"] },
    contactor: { label: "Modular contactor, 20 A, 2-pole, 230 V coil (one per switched circuit)", unit: "contactor", low: 777, typ: 777, high: 2477, status: "listing",
      basis: "Chint NCH8-20/02 ₹777 incl. GST (Moglix); Chint NCH8/Z-20 2NO ₹2,477 incl. GST (IndustryBuying) as high. The 2NO variant used here was not priced in India.",
      src: ["https://www.moglix.com/chint-nch8-20-02-20a-2p-2nc-240v-modular-contactor-256160/mp/msn8klpxewyr5v", "https://www.industrybuying.com/ac-contactors-chint-IND.ACC.745589874"] },
    bypass: { label: "Manual bypass switch per switched circuit (commissioning step E3)", unit: "switch", low: 80, typ: 120, high: 200, status: "provisional", basis: "No listing checked" },
    dbbox: { label: "4-way SPN distribution box for the contactors and MCB", unit: "box", low: 1044, typ: 1044, high: 1665, status: "listing",
      basis: "Havells SPN 4-way DD DB ₹1,044 (MRP ₹1,665) on havells.com", src: ["https://havells.com/spn-4-way-dd-db-drdpshodow04.html"] },
    enclosure: { label: "IP65 ABS enclosure for the low-voltage electronics", unit: "box", low: 300, typ: 600, high: 899, status: "listing",
      basis: "IndiaMART ABS IP65 boxes ₹300–600 per piece; Robu VS-127 200×120×75 mm IP65 ₹899 incl. GST", src: ["https://aws.robu.in/product/abs-encosure-vs-127-120x200x75mm", "https://m.indiamart.com/city/gurgaon/junction-boxes.html"] },
    mcb: { label: "6 A single-pole C-curve MCB (node supply)", unit: "MCB", low: 106, typ: 126, high: 164, status: "listing",
      basis: "Havells REO ₹126 incl. GST (₹106 + GST) on Moglix; high +30 %", src: ["https://www.moglix.com/havells-reo-6a-single-pole-c-curve-mcb-dhmxcspz006/mp/msn4k6z2mo33kq"] },
    fuse: { label: "Fuse and holder on the 5 V module input", unit: "set", low: 39, typ: 39, high: 51, status: "recorded", basis: "Team purchase ₹39 (6×30 mm holder); high +30 %" },
    gland: { label: "Cable gland", unit: "gland", low: 20, typ: 40, high: 98, status: "provisional", basis: "Probots PG7 brass ₹98 incl. GST used as high; nylon glands assumed cheaper (not checked)", src: ["https://probots.co.in/nickel-plated-brass-metal-cable-gland-gland-size-pg-7.html"] },
    psu: { label: "Isolated 5 V supply for the node", unit: "supply", low: 195, typ: 195, high: 1299, status: "listing",
      basis: "Hi-Link HLK-PM01 5 V 3 W ₹195 incl. GST (Hubtronics); high = Mean Well HDR-15-5 DIN-rail ₹1,299 (Hubtronics)",
      src: ["https://hubtronics.in/hi-link/hlk-pm01-5v-3w-power-supply-module", "https://hubtronics.in/mean-well"] },
    terminal: { label: "Screw terminal block", unit: "block", low: 19, typ: 19, high: 25, status: "recorded", basis: "Team purchase ₹57 for 3; high +30 %" },
    wire: { label: "1.5 mm² FR copper wire", unit: "m", low: 25, typ: 29, high: 38, status: "listing",
      basis: "Polycab Optima 1.5 mm² 90 m coil ₹2,610 incl. taxes (McCoy Mart) = ₹29/m; low −15 %, high +30 %",
      src: ["https://mccoymart.com/buy/polycab-optima-15-sq-mm-frlf-pvc-insulated-single-core-copper-electric-wire-90-meter-black"] },
    sensorcable: { label: "Sensor cable, 4-core 0.5 mm² (or CAT6)", unit: "m", low: 15, typ: 25, high: 35, status: "provisional", basis: "No listing price could be read when checked" },
    casing: { label: "PVC casing-capping, 25 mm", unit: "m", low: 12, typ: 15, high: 25, status: "listing", basis: "IndiaMART: ₹24 per 2 m length (25 mm); ₹12–25 per m across listings", src: ["https://m.indiamart.com/impcat/pvc-casings.html"] },
    sundries: { label: "Screws, plugs, cable ties, sleeves, labels", unit: "node", low: 50, typ: 100, high: 150, status: "provisional", basis: "Provisional allowance per node" },
    electrician: { label: "Electrician", unit: "day (8 h)", low: 1197, typ: 1500, high: 2000, status: "regulation",
      basis: "Low = Karnataka minimum wage, skilled, Zone 1: ₹31,114.02 per month from 22 May 2026 ÷ 26 days. Typical and high are provisional contractor rates. A 2026 market guide lists ₹750–1,000 per day in metros, below the new minimum.",
      src: ["https://www.india-briefing.com/news/karnataka-minimum-wage-overhaul-2026-rates-zones-compliance-mandates-45289.html", "https://aecord.com/blog/labour-rates-for-house-construction-india-2026"] },
    technician: { label: "Technician (firmware set-up, commissioning, testing)", unit: "day (8 h)", low: 1316, typ: 2000, high: 3000, status: "regulation",
      basis: "Low = Karnataka minimum wage, highly skilled, Zone 1: ₹34,225.42 per month ÷ 26 days. Typical and high are provisional.",
      src: ["https://www.india-briefing.com/news/karnataka-minimum-wage-overhaul-2026-rates-zones-compliance-mandates-45289.html"] },
    pzem: { label: "PZEM-004T energy meter with current transformer", unit: "meter", low: 549, typ: 549, high: 714, status: "listing", basis: "Robu ₹549 incl. GST (out of stock when checked); high +30 %", src: ["https://aws.robu.in/?p=2201485"] },
  };

  // Documented design and quantity rules. "Provisional" values are engineering assumptions to be
  // replaced with the electrician's survey.
  const DESIGN = {
    buildings: 1,              // number of buildings like the modelled DKM block
    includeCorridors: true,
    contactors: true,          // modular contactor per switched circuit (recommended for fixed mains wiring)
    bypass: true,              // manual bypass switch per switched circuit
    pirPerNode: 2,             // the firmware reads two PIR inputs
    pirCoverage_m2: 30,        // provisional effective floor area per HC-SR501 for seated occupants
    relayChannels: 4,
    relayRating_A: 10,         // relay contact rating printed on the board
    relayUse: 0.5,             // docs/COMMISSIONING.md E2: load current below 50 % of the relay rating
    V: 230, pf: 0.9,
    mainsRunPerCircuit_m: 12,  // provisional: 4 conductors × 3 m between the existing switchboard and the node
    supplyRun_m: 9,            // provisional: L, N, E × 3 m for the node supply
    sensorDrop_m: 3,           // provisional: vertical run to the ceiling
    casingExtra_m: 3,          // provisional: casing for the mains run per node
    terminalsPerNode: 6, glandsPerNode: 4,
    h_node: 2, h_circuit: 1, h_sensor: 0.75, accessPerFloor: 0.05, // provisional electrician hours; +5 % per floor above ground
    h_firmware: 1, h_commission: 0.5, h_test: 0.5, handoverDays: 2,    // provisional technician hours
    contingencyPct: { low: 10, typ: 15, high: 20 },
    sparesPct: { low: 2, typ: 3, high: 5 },          // provisional, % of hardware per year
    inspection_h: { low: 0.25, typ: 0.25, high: 0.5 }, // technician hours per node per year
    P_node_W: 1.0,             // provisional: ESP32 + supply standby, to be measured (COMMISSIONING D3)
    P_relayCoil_W: 0.36,       // relay coil while energised (firmware uses NC wiring: energised while a load is held off)
    P_contactorCoil_W: 2.0,    // provisional: contactor coil while the load is on (2NO contactor fed through the relay's NC contact)
    weeksPerYear: 40,          // provisional: academic weeks (~220 working days); other weeks the rooms stay empty
  };

  // Recorded prototype purchase list (hardware-inventory-and-measurable-scope.md, 15 Oct 2026).
  const PROTOTYPE = [
    ["ESP32 38-pin NodeMCU (Wi-Fi + BLE)", 1, 425], ["HC-SR501 PIR motion sensor", 2, 138], ["DHT22 / AM2302 temperature & humidity", 1, 129],
    ["LM393 LDR light sensor module", 1, 29], ["4-channel 5 V relay board", 1, 168], ["0.96\" OLED (I2C/SPI)", 1, 169], ["Active buzzer module", 1, 27],
    ["SMD 3-colour LED module", 1, 29], ["5 V 4010 DC fan", 1, 49], ["5 V 2 A adapter + micro-USB cable", 1, 195], ["USB-A to micro-USB cable", 1, 36],
    ["MB102 830-point breadboard", 1, 68], ["Jumper wire sets", 2, 164], ["Resistor kit (150 pcs)", 1, 44], ["2-pin screw terminal blocks", 3, 57],
    ["6×30 mm fuse holder", 1, 39], ["Heat-shrink tube (1 m)", 1, 25],
  ].map(([label, qty, price]) => ({ label, qty, price }));
  const PROTOTYPE_RECORDED_TOTAL = 1791;
  // Items the prototype still needs for the stated goals. Nothing already purchased is repeated here.
  const PROTOTYPE_EXTRA = [
    { key: "enclosure", label: "Enclosure to mount the node in a room for the demonstration", qty: 1, why: "The kit is on a breadboard with no enclosure", optional: false },
    { key: "sundries", label: "Mounting sundries (screws, ties, labels)", qty: 1, why: "Wall or desk mounting", optional: false },
    { key: "pzem", label: "Energy meter on the switched load (PZEM-004T)", qty: 1, why: "Only needed to produce measured kWh; the kit cannot measure energy", optional: true },
  ];

  const CATS = [
    ["ctrl", "Controllers and communication hardware", "hw"], ["sens", "PIR sensors", "hw"], ["switch", "Relays and switching hardware", "hw"],
    ["prot", "Enclosures and protective components", "hw"], ["power", "Power supplies and connectors", "hw"], ["wiring", "Wiring, conduit, mounting and materials", "wire"],
    ["labour", "Electrician labour", "lab"], ["fw", "Firmware configuration and commissioning", "lab"], ["test", "Testing and handover", "lab"],
  ];
  const SCEN = ["low", "typ", "high"];
  const r0 = (v) => Math.round(v);

  function price(key, ov) {
    const p = PRICES[key], o = ov && ov[key];
    if (o !== undefined && o !== null && o !== "" && isFinite(o) && o >= 0) return { low: +o, typ: +o, high: +o, status: "quote" };
    return { low: p.low, typ: p.typ, high: p.high, status: p.status };
  }
  function design(opts) {
    const d = JSON.parse(JSON.stringify(DESIGN));
    if (opts) for (const k of Object.keys(opts)) if (k in d && typeof d[k] === typeof opts[k] && typeof opts[k] !== "object") d[k] = opts[k];
    d.buildings = Math.max(1, Math.min(50, Math.round(d.buildings)));
    return d;
  }

  // Quantities from the building model (PNSIM: FLOORS, ZONES) and the simulation's fixture wattages.
  function quantities(S, A, opts) {
    const D = design(opts), floorIdx = Object.fromEntries(S.FLOORS.map((f, i) => [f.id, i]));
    const q = { nodes: 0, pir: 0, circuits: 0, lightCircuits: 0, fanCircuits: 0, acUnitsExcluded: 0, relayBoards: 0, channelsUsed: 0, contactors: 0, bypass: 0,
      wire_m: 0, sensor_m: 0, casing_m: 0, elec_h: 0, tech_h: 0, rooms: new Set(), floors: S.FLOORS.length, maxCircuitA: 0,
      flags: { coverage: [], overRelay: [], channels: [] } };
    S.ZONES.forEach((zn) => {
      const r = zn.room;
      if (r.type === "corridor" && !D.includeCorridors) return;
      const circuits = (zn.lights > 0 ? 1 : 0) + (zn.fans > 0 ? 1 : 0);
      q.acUnitsExcluded += zn.acs;
      if (!circuits) return;
      const width = r.w / r.zones, area = width * r.d;
      q.nodes++; q.rooms.add(r.id); q.circuits += circuits; q.lightCircuits += zn.lights > 0 ? 1 : 0; q.fanCircuits += zn.fans > 0 ? 1 : 0;
      q.pir += D.pirPerNode; q.relayBoards++; q.channelsUsed += circuits;
      if (circuits > D.relayChannels) q.flags.channels.push(zn.id);
      if (area > D.pirPerNode * D.pirCoverage_m2) q.flags.coverage.push({ id: zn.id, area });
      [[zn.lights, A.W_light], [zn.fans, A.W_fan]].forEach(([n, w]) => {
        if (!n) return; const amps = (n * w) / (D.V * D.pf); q.maxCircuitA = Math.max(q.maxCircuitA, amps);
        if (amps > D.relayRating_A * D.relayUse) q.flags.overRelay.push({ id: zn.id, amps });
      });
      if (D.contactors) q.contactors += circuits;
      if (D.bypass) q.bypass += circuits;
      const sensor = D.pirPerNode * (D.sensorDrop_m + width / 2);
      q.sensor_m += sensor; q.wire_m += circuits * D.mainsRunPerCircuit_m + D.supplyRun_m; q.casing_m += sensor + D.casingExtra_m;
      q.elec_h += (D.h_node + circuits * D.h_circuit + D.pirPerNode * D.h_sensor) * (1 + D.accessPerFloor * (floorIdx[r.floor] || 0));
    });
    q.rooms = q.rooms.size;
    const B = D.buildings;
    for (const k of ["nodes", "pir", "circuits", "lightCircuits", "fanCircuits", "acUnitsExcluded", "relayBoards", "channelsUsed", "contactors", "bypass", "wire_m", "sensor_m", "casing_m", "elec_h", "rooms"]) q[k] *= B;
    q.fw_h = q.nodes * (D.h_firmware + D.h_commission);
    q.test_h = q.nodes * D.h_test;
    q.handoverDays = D.handoverDays * B;
    q.design = D;
    return q;
  }

  // Itemised installation estimate. ov = optional {priceKey: quoted unit price}.
  function estimate(S, A, opts, ov) {
    const q = quantities(S, A, opts), D = q.design, lines = [];
    const add = (cat, key, qty, note) => { if (qty <= 0) return; const p = price(key, ov); lines.push({ cat, key, label: PRICES[key].label, unit: PRICES[key].unit, qty, unitPrice: p, status: p.status, note: note || "", low: qty * p.low, typ: qty * p.typ, high: qty * p.high }); };
    add("ctrl", "esp32", q.nodes, "one node per control zone");
    add("ctrl", "cue", q.nodes, "30 s warning before switch-off");
    add("sens", "pir", q.pir, `${D.pirPerNode} per node (two PIR inputs in the firmware)`);
    add("switch", "relay4", q.relayBoards, `${q.channelsUsed} of ${q.relayBoards * D.relayChannels} channels used`);
    if (D.contactors) add("switch", "contactor", q.contactors, "one per switched lights or fans circuit");
    if (D.bypass) add("switch", "bypass", q.bypass, "lets staff restore a circuit if the node fails");
    add("prot", "enclosure", q.nodes);
    if (D.contactors) add("prot", "dbbox", q.nodes);
    add("prot", "mcb", q.nodes);
    add("prot", "fuse", q.nodes);
    add("prot", "gland", q.nodes * D.glandsPerNode);
    add("power", "psu", q.nodes);
    add("power", "terminal", q.nodes * D.terminalsPerNode);
    add("wiring", "wire", Math.ceil(q.wire_m), "taps the existing switch circuits at the switchboard; no new room wiring assumed");
    add("wiring", "sensorcable", Math.ceil(q.sensor_m), "from the node to each sensor");
    add("wiring", "casing", Math.ceil(q.casing_m));
    add("wiring", "sundries", q.nodes);
    add("labour", "electrician", +(q.elec_h / 8).toFixed(2), `${r0(q.elec_h)} h: mounting, circuit connection, sensors; +${Math.round(D.accessPerFloor * 100)} % per floor above ground`);
    add("fw", "technician", +(q.fw_h / 8).toFixed(2), `${r0(q.fw_h)} h: flashing, configuration, on-site commissioning`);
    add("test", "technician", +((q.test_h + q.handoverDays * 8) / 8).toFixed(2), `${r0(q.test_h)} h acceptance tests + ${q.handoverDays} days handover and documentation`);
    const sub = (grp) => Object.fromEntries(SCEN.map((s) => [s, lines.filter((l) => CATS.find((c) => c[0] === l.cat)[2] === grp).reduce((a, l) => a + l[s], 0)]));
    const hw = sub("hw"), wire = sub("wire"), lab = sub("lab");
    const byCat = CATS.map(([id, label, grp]) => ({ id, label, grp, ...Object.fromEntries(SCEN.map((s) => [s, lines.filter((l) => l.cat === id).reduce((a, l) => a + l[s], 0)])) }));
    const total = {}, contingency = {}, beforeCont = {};
    SCEN.forEach((s) => { beforeCont[s] = hw[s] + wire[s] + lab[s]; contingency[s] = (beforeCont[s] * D.contingencyPct[s]) / 100; total[s] = beforeCont[s] + contingency[s]; });
    return { q, D, ov: ov || {}, lines, byCat, hw, wire, lab, beforeCont, contingency, total, perNode: Object.fromEntries(SCEN.map((s) => [s, q.nodes ? total[s] / q.nodes : 0])) };
  }

  // Annual operating cost. sim = {offH, onH}: average hours per switched circuit per simulated week
  // that NEST holds the load off / keeps it on (from the simulation). Outside the academic weeks the
  // rooms are taken as empty with the supply on, so the relay coils stay energised (NC wiring).
  function operating(est, sim, tariff) {
    const D = est.D, q = est.q, wk = 365 / 7, off = Math.max(0, wk - D.weeksPerYear);
    const haveSim = sim && isFinite(sim.offH) && isFinite(sim.onH);
    const relayH = haveSim ? sim.offH * D.weeksPerYear + off * 168 : null;
    const contH = haveSim ? sim.onH * D.weeksPerYear : null;
    const kwhNode = (q.nodes * D.P_node_W * 8760) / 1000;
    const kwhRelay = haveSim ? (q.circuits * D.P_relayCoil_W * relayH) / 1000 : null;
    const kwhCont = haveSim ? (D.contactors ? (q.contactors * D.P_contactorCoil_W * contH) / 1000 : 0) : null;
    const kwh = haveSim ? kwhNode + kwhRelay + kwhCont : null;
    const out = { haveSim, relayH, contH, kwhNode, kwhRelay, kwhCont, kwh, tariff };
    SCEN.forEach((s) => {
      const spares = (est.hw[s] * D.sparesPct[s]) / 100;
      const insp = ((q.nodes * D.inspection_h[s]) / 8) * price("technician", est.ov)[s];
      const energy = haveSim ? kwh * tariff : null;
      out[s] = { spares, inspection: insp, energy, total: haveSim ? spares + insp + energy : null };
    });
    return out;
  }

  // Simple payback per scenario: low install with low running cost, and so on.
  function payback(est, om, gross, omOverride) {
    const res = {};
    SCEN.forEach((s) => {
      const omv = omOverride !== undefined && omOverride !== null && omOverride !== "" && isFinite(omOverride) && omOverride >= 0 ? +omOverride : om[s].total;
      if (!(isFinite(gross) && gross >= 0) || omv === null || !isFinite(omv)) { res[s] = { missing: true }; return; }
      const net = gross - omv;
      res[s] = net > 0 ? { net, om: omv, years: est.total[s] / net } : { net, om: omv, none: true };
    });
    return res;
  }

  function prototype(ov) {
    const purchased = PROTOTYPE.reduce((a, x) => a + x.price, 0);
    const extra = PROTOTYPE_EXTRA.map((x) => { const p = price(x.key, ov); return { ...x, status: p.status, low: p.low * x.qty, typ: p.typ * x.qty, high: p.high * x.qty }; });
    const req = (s) => extra.filter((x) => !x.optional).reduce((a, x) => a + x[s], 0), opt = (s) => extra.filter((x) => x.optional).reduce((a, x) => a + x[s], 0);
    return { items: PROTOTYPE, purchased, recorded: PROTOTYPE_RECORDED_TOTAL, extra,
      required: Object.fromEntries(SCEN.map((s) => [s, req(s)])), optional: Object.fromEntries(SCEN.map((s) => [s, opt(s)])),
      totalRequired: Object.fromEntries(SCEN.map((s) => [s, purchased + req(s)])) };
  }

  const API = { CHECKED, PRICES, DESIGN, PROTOTYPE, PROTOTYPE_RECORDED_TOTAL, PROTOTYPE_EXTRA, CATS, SCEN, design, quantities, estimate, operating, payback, prototype, price };
  root.NESTCOST = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
