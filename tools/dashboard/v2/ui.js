"use strict";
// NEST console v2, presentation layer. Every number and animation here is read from
// window.PNM (model.js), which wraps the simulation (sim.js) and the firmware decision core (pn_core.js),
// and window.NESTCOST (cost.js). Animations only follow state: nothing moves unless the simulation,
// the estimate or valid ESP32 telemetry changed. Motion is off under prefers-reduced-motion, with the
// sidebar Motion switch, and while the tab is hidden.
(() => {
const M = PNM, S = M.S, st = M.st, $ = (id) => document.getElementById(id), NS = "http://www.w3.org/2000/svg";
const { IN, kwh, pct, hhmm, esc } = M;
const RM = matchMedia("(prefers-reduced-motion: reduce)");
let userMotion = true; try { userMotion = localStorage.getItem("nest_motion") !== "off"; } catch (e) {}
const motionOn = () => !RM.matches && userMotion;
const motion = () => motionOn() && !document.hidden;
const applyMotion = () => { document.documentElement.classList.toggle("nomotion", !motionOn()); const b = document.getElementById("motionBtn"); if (b) { b.setAttribute("aria-pressed", String(motionOn())); b.querySelector(".sl-t").textContent = "Motion: " + (RM.matches ? "reduced (system)" : userMotion ? "on" : "off"); } };
const sv = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

/* ---------------- icons ---------------- */
const ICONS = {
  overview: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  building: "M4 21V7l8-4 8 4v14M2 21h20M9.5 21v-4h5v4M8.5 9.5h1M14.5 9.5h1M8.5 13h1M14.5 13h1",
  energy: "M13 2 4.5 13.5H11L10 22l8.5-11.5H12z",
  sun: "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  controls: "M5 4v16M12 4v16M19 4v16M3 8h4M10 15h4M17 10h4",
  insights: "M4 20V10M10 20V4M16 20v-7M21 20H3",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2h5c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3z",
  fan: "M12 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zM12 10.6C10.8 6.2 12 3 14.6 3c2.6 0 2.4 3.8-2.6 7.6zM13.4 12c4.4-1.2 7.6 0 7.6 2.6 0 2.6-3.8 2.4-7.6-2.6zM12 13.4c1.2 4.4 0 7.6-2.6 7.6-2.6 0-2.4-3.8 2.6-7.6zM10.6 12C6.2 13.2 3 12 3 9.4 3 6.8 6.8 7 10.6 12z",
  snow: "M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2.5L15 4M9 20l3-2.5 3 2.5",
  plug: "M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4",
  person: "M12 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM5 21c.5-4 3.4-6.5 7-6.5s6.5 2.5 7 6.5",
  personPlus: "M10 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM3 21c.5-4 3.4-6.5 7-6.5 1.6 0 3 .5 4.2 1.4M18 14v6M15 17h6",
  personOff: "M10 4a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM3 21c.5-4 3.4-6.5 7-6.5 1.6 0 3 .5 4.2 1.4M15.5 15.5l5 5M20.5 15.5l-5 5",
  reset: "M4 12a8 8 0 1 0 2.3-5.7M4 4v4.5h4.5",
  pir: "M12 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8",
  play: "M8 5.5v13l11-6.5z", pause: "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 7.5v.5",
  chev: "M6 9l6 6 6-6",
  pylon: "M8.5 22 12 2l3.5 20M10 15h4M10.8 9h2.4M5 6h14M3.5 11h17",
  dg: "M3 8h18v11H3zM6.5 8V5h5v3M6.5 13.5h4M15 11l-2 3.2h3l-2 3.3",
  leaf: "M5 19C5 11 10 5 20 5c0 10-6 15-14 15M5 19l7-7",
  rupee: "M7 4h10M7 8.5h10M8 4c4.5 0 7 1.4 7 4.3S12.5 13 8 13l7 7",
  warn: "M12 3.5 2.5 20h19zM12 10v4.5M12 17.2v.3",
  check: "M5 12.5 9.5 17 19 7.5",
  power: "M12 3v8M6.3 6.6a8 8 0 1 0 11.4 0",
  usb: "M12 3v13M9 6l3-3 3 3M7.5 10v2.5L12 15M16.5 9v3L12 15M12 16.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3.5 2",
  layers: "M12 3 2 8l10 5 10-5zM2 12.5l10 5 10-5M2 17l10 5 10-5",
  print: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z",
  zone: "M4 5h16v14H4zM12 5v14",
  arrow: "M5 12h14M13 6l6 6-6 6",
};
const ic = (n, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;
// one sprite so SVG scenes can <use> the same icons
(() => { const sp = sv("svg", { width: 0, height: 0, style: "position:absolute", "aria-hidden": "true" }); const d = sv("defs", {}, sp);
  ["bulb", "fan", "snow", "person", "plug", "pir", "sun", "pylon", "dg"].forEach((n) => { const s = sv("symbol", { id: "s-" + n, viewBox: "0 0 24 24" }, d); sv("path", { d: ICONS[n], fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }, s); });
  document.body.appendChild(sp); })();
const useIcon = (parent, n, x, y, size, attrs = {}) => sv("use", { href: "#s-" + n, x, y, width: size, height: size, ...attrs }, parent);

/* ---------------- tooltip ---------------- */
const tip = $("tip");
function placeTip(x, y) { const r = tip.getBoundingClientRect(), p = 14; let L = x + p, T = y + p; if (L + r.width > innerWidth - 8) L = x - r.width - p; if (T + r.height > innerHeight - 8) T = y - r.height - p; tip.style.left = Math.max(8, L) + "px"; tip.style.top = Math.max(8, T) + "px"; }
function showTip(ev, html) { tip.innerHTML = html; tip.classList.add("show"); placeTip(ev.clientX, ev.clientY); }
function hideTip() { tip.classList.remove("show"); }
const tipRow = (color, name, val) => `<div class="row"><span><i style="background:${color}"></i>${esc(name)}</span><span>${val}</span></div>`;
document.addEventListener("pointerover", (e) => { const t = e.target.closest && e.target.closest("[data-tip]"); if (t) showTip(e, esc(t.dataset.tip)); });
document.addEventListener("pointermove", (e) => { if (tip.classList.contains("show") && e.target.closest && e.target.closest("[data-tip]")) placeTip(e.clientX, e.clientY); });
document.addEventListener("pointerout", (e) => { const t = e.target.closest && e.target.closest("[data-tip]"); if (t && !t.contains(e.relatedTarget)) hideTip(); });
document.addEventListener("focusin", (e) => { const t = e.target.closest && e.target.closest("[data-tip]"); if (t) { const r = t.getBoundingClientRect(); tip.innerHTML = esc(t.dataset.tip); tip.classList.add("show"); placeTip(r.left, r.bottom); } });
document.addEventListener("focusout", hideTip);
document.addEventListener("scroll", hideTip, { passive: true, capture: true });

/* ---------------- animation helpers ---------------- */
// Number transition that retargets smoothly: a new value continues from what is on screen
// instead of restarting. Unchanged values do nothing; without motion the value is written at once.
function num(el, v, d = 0, fmt) {
  if (!el) return; fmt = fmt || ((x) => IN(x, d));
  if (el._t === v && el._f === fmt.toString()) return; el._t = v; el._f = fmt.toString(); el._v = v;
  const from = el._d ?? 0;
  if (!motion() || !isFinite(from) || Math.abs(v - from) < Math.pow(10, -d) / 2) { cancelAnimationFrame(el._raf); el._d = v; el.textContent = fmt(v); return; }
  const t0 = performance.now(), dur = el._seen ? 420 : 850; el._seen = true;
  cancelAnimationFrame(el._raf);
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el._d = k < 1 ? from + (v - from) * e : v; el.textContent = fmt(el._d); if (k < 1) el._raf = requestAnimationFrame(step); };
  el._raf = requestAnimationFrame(step);
}
// brief highlight when a device or card changes state
const flash = (el) => { if (!el || !motion()) return; el.classList.remove("chg"); void el.offsetWidth; el.classList.add("chg"); };
// fan icons: spin while on, spin down once when switched off
function fanIcon(svgEl, on) {
  if (!svgEl) return; const was = svgEl.classList.contains("spin");
  if (on && motion()) { svgEl.classList.remove("spindown"); svgEl.classList.add("spin"); }
  else { svgEl.classList.remove("spin"); if (was && motion()) { svgEl.classList.remove("spindown"); void svgEl.getBoundingClientRect(); svgEl.classList.add("spindown"); } }
}
/* ---------------- toasts (state changes only) ---------------- */
const toastBox = $("toasts");
let lastToast = 0;
function toast(html, kind = "sim", ms = 4200) {
  if (!toastBox) return;
  while (toastBox.children.length >= 3) toastBox.firstChild.remove();
  const t = document.createElement("div"); t.className = "toast " + kind; t.setAttribute("role", "status");
  t.innerHTML = `<span class="tk">${kind === "hw" ? "ESP32" : kind === "est" ? "estimate" : "sim"}</span><span>${html}</span>`;
  toastBox.appendChild(t); requestAnimationFrame(() => t.classList.add("in"));
  setTimeout(() => { t.classList.remove("in"); t.classList.add("out"); setTimeout(() => t.remove(), motion() ? 350 : 0); }, ms);
}
const RAMP = ["--o0", "--o1", "--o2", "--o3", "--o4", "--o5", "--o6", "--o7"];
const rampColor = (v) => (v <= 0 ? "var(--o0)" : `var(${RAMP[Math.min(7, 1 + Math.floor(v * 6.999))]})`);
const rampHTML = (a, b) => `<span class="ramp">${a}<span class="bar2">${RAMP.map((r) => `<i style="background:var(${r})"></i>`).join("")}</span>${b}</span>`;
const stPill = (c, held) => { if (!c) return ""; if (c.manual) return `<span class="st man">${c.on ? "Manual on" : "Manual off"}</span>`; if (c.held || held) return `<span class="st user" data-tip="AC follows the users: the deployed node never switches cooling off without a validated thermal model.">${c.on ? "On · user" : "Off · user"}</span>`; return c.state === "warn" ? `<span class="st warn">Warning</span>` : c.on ? `<span class="st on">On</span>` : `<span class="st off">Off</span>`; };
const fmtDur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, "0")}s` : `${Math.round(s)}s`);
const short = (id) => id.replace("DKM-", "");
function ringSVG(size, stroke, color) { const r = (size - stroke) / 2, c = 2 * Math.PI * r; return { html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ring" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="${stroke}"/><circle class="rv" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}"/></svg>`, c }; }
const setRing = (root, frac, c) => { const e = root.querySelector(".rv"); if (e) e.style.strokeDashoffset = c * (1 - Math.max(0, Math.min(1, frac))); };

/* ---------------- charts ---------------- */
const ro = new ResizeObserver((ents) => { for (const e of ents) { const c = e.target._chart; if (c && Math.abs(e.contentRect.width - c.w) > 30) c.redraw(false); } });
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
// charts animate when built or when their data changes; a resize redraws without animation
function mount(host, draw) { const c = { host, w: 0, redraw(anim = true) { c.w = host.clientWidth || 600; host.innerHTML = ""; c.api = draw(c.w, anim && motion()); } }; host._chart = c; host.classList.add("chart"); ro.observe(host); c.redraw(true); return c; }
function drawIn(path, anim, delay = 0) { if (!anim) return; const L = path.getTotalLength(); path.style.setProperty("--len", L); path.style.animationDelay = delay + "ms"; path.classList.add("draw"); }
// time-of-day chart over 5-min buckets
function tsChart(host, cfg) {
  return mount(host, (W, anim) => {
    const H = cfg.height || 240, ml = cfg.unit ? 58 : cfg.compact ? 34 : 44, mr = 10, mt = 14, mb = 24, n = cfg.series[0].values.length, pw = W - ml - mr, ph = H - mt - mb;
    const stack = cfg.stacked ? cfg.series.filter((s) => !s.overlay) : [];
    const cum = []; if (cfg.stacked) { let acc = new Float64Array(n); stack.forEach((s) => { const top = Float64Array.from(acc, (v, i) => v + s.values[i]); cum.push([acc, top]); acc = top; }); }
    let max = 0; cfg.series.forEach((s) => { for (const v of s.values) max = Math.max(max, v); }); if (cum.length) for (const v of cum[cum.length - 1][1]) max = Math.max(max, v);
    max = niceMax(max * 1.05);
    const x = (i) => ml + (pw * (i + 0.5)) / n, y = (v) => mt + ph * (1 - v / max);
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": cfg.label || "chart" }, host);
    for (let g = 0; g <= 4; g++) { const v = (max * g) / 4, yy = y(v); sv("line", { x1: ml, x2: W - mr, y1: yy, y2: yy, class: "gl" }, svg); if (g % (cfg.compact ? 2 : 1) === 0) sv("text", { x: ml - 8, y: yy + 3.5, "text-anchor": "end", class: "ax" }, svg).textContent = IN(v, max < 10 ? 1 : 0) + (g === 4 && cfg.unit ? " " + cfg.unit : ""); }
    for (let hr = 0; hr <= 24; hr += cfg.compact ? 6 : 3) { const xx = ml + (pw * hr) / 24; sv("text", { x: xx, y: H - 6, "text-anchor": hr === 0 ? "start" : hr === 24 ? "end" : "middle", class: "ax" }, svg).textContent = String(hr).padStart(2, "0") + ":00"; }
    if (cfg.band) cfg.band.forEach((b) => sv("rect", { x: ml + (pw * b.from) / 1440, y: mt, width: (pw * (b.to - b.from)) / 1440, height: ph, fill: "rgba(250,178,25,.08)", rx: 4 }, svg));
    const pathOf = (vals, base) => { let d = ""; for (let i = 0; i < n; i++) d += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(vals[i]).toFixed(1); if (base) { for (let i = n - 1; i >= 0; i--) d += "L" + x(i).toFixed(1) + " " + y(base[i]).toFixed(1); d += "Z"; } return d; };
    const defs = sv("defs", {}, svg), uid = "g" + Math.random().toString(36).slice(2, 8);
    const grad = (id, color) => { const g = sv("linearGradient", { id, x1: 0, x2: 0, y1: 0, y2: 1 }, defs); sv("stop", { offset: 0, "stop-color": color, "stop-opacity": 0.32 }, g); sv("stop", { offset: 1, "stop-color": color, "stop-opacity": 0.02 }, g); return `url(#${id})`; };
    if (cfg.stacked) stack.forEach((s, j) => { const p = sv("path", { d: pathOf(cum[j][1], cum[j][0]), fill: `var(${s.color})`, "fill-opacity": 0.78, stroke: "var(--card)", "stroke-width": 1 }, svg); if (anim) { p.classList.add("rise"); p.style.animationDelay = j * 90 + "ms"; } });
    cfg.series.forEach((s, j) => {
      if (cfg.stacked && !s.overlay) return;
      if (s.area) { const a = sv("path", { d: pathOf(s.values, new Float64Array(n)), fill: grad(uid + j, cssVar(s.color)) }, svg); if (anim) a.classList.add("fadein"); }
      const p = sv("path", { d: pathOf(s.values), fill: "none", stroke: `var(${s.color})`, "stroke-width": s.width || 2.1, "stroke-dasharray": s.dash ? "5 5" : null, "stroke-linejoin": "round", "stroke-linecap": "round" }, svg);
      if (!s.dash) drawIn(p, anim, j * 140);
    });
    sv("line", { x1: ml, x2: W - mr, y1: H - mb, y2: H - mb, stroke: "var(--line2)" }, svg);
    const past = sv("rect", { x: ml, y: mt, height: ph, fill: "rgba(255,255,255,.025)" }, svg);
    const nowL = sv("line", { y1: mt - 4, y2: H - mb, stroke: "var(--text2)", "stroke-width": 1.2, "stroke-dasharray": "3 3" }, svg);
    const nowD = sv("circle", { r: 4, fill: "var(--text)", stroke: "var(--card)", "stroke-width": 2 }, svg);
    const cross = sv("line", { y1: mt, y2: H - mb, stroke: "var(--line3)", visibility: "hidden" }, svg);
    const dots = cfg.series.map((s) => sv("circle", { r: 4, fill: `var(${s.color})`, stroke: "var(--card)", "stroke-width": 2, visibility: "hidden" }, svg));
    const hit = sv("rect", { x: ml, y: mt, width: pw, height: ph, fill: "transparent", style: cfg.onSeek ? "cursor:pointer" : "" }, svg);
    const idxAt = (ev) => { const r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W; return Math.max(0, Math.min(n - 1, Math.floor(((px - ml) / pw) * n))); };
    const lead = cfg.series.find((s) => !s.overlay && !s.dash) || cfg.series[0];
    const setNow = (m) => {
      const vis = m >= 0 ? "visible" : "hidden"; [nowL, nowD, past].forEach((e) => e.setAttribute("visibility", vis)); if (m < 0) return;
      const xx = ml + (pw * m) / 1440, i = Math.min(n - 1, Math.floor(m / S.BKT));
      nowL.setAttribute("x1", xx); nowL.setAttribute("x2", xx); past.setAttribute("width", Math.max(0, xx - ml));
      const top = cfg.stacked ? cum[cum.length - 1][1][i] : lead.values[i]; nowD.setAttribute("cx", xx); nowD.setAttribute("cy", y(top));
    };
    let dragging = false;
    hit.addEventListener("pointerdown", (ev) => { if (!cfg.onSeek) return; dragging = true; hit.setPointerCapture(ev.pointerId); cfg.onSeek(idxAt(ev) * S.BKT); });
    hit.addEventListener("pointerup", () => (dragging = false));
    hit.addEventListener("pointermove", (ev) => {
      const i = idxAt(ev); if (dragging && cfg.onSeek) cfg.onSeek(i * S.BKT);
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
      let html = `<b>${hhmm(i * S.BKT)}–${hhmm((i + 1) * S.BKT)}</b>`;
      cfg.series.forEach((s, j) => { const top = cfg.stacked && !s.overlay ? cum[stack.indexOf(s)][1][i] : s.values[i]; dots[j].setAttribute("cx", x(i)); dots[j].setAttribute("cy", y(top)); dots[j].setAttribute("visibility", "visible"); html += tipRow(`var(${s.color})`, s.name, IN(s.values[i], 1) + " " + (cfg.unit || "")); });
      if (cfg.extraTip) html += cfg.extraTip(i);
      showTip(ev, html);
    });
    hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); dots.forEach((d) => d.setAttribute("visibility", "hidden")); hideTip(); });
    setNow(cfg.now ?? st.min);
    return { setNow };
  });
}
const cssVar = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || v;
function donut(host, parts, cfg = {}) {
  const size = cfg.size || 190, r = 74, w = 24, c = 2 * Math.PI * r, tot = parts.reduce((a, p) => a + p.v, 0) || 1, gap = 3;
  host.innerHTML = `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${esc(cfg.label || "breakdown")}" style="display:block;overflow:visible"><g transform="rotate(-90 ${size / 2} ${size / 2})"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="${w}"/></g><text x="${size / 2}" y="${size / 2 - 2}" text-anchor="middle" style="font:700 26px var(--f-body);fill:var(--text)" class="dv">0</text><text x="${size / 2}" y="${size / 2 + 20}" text-anchor="middle" class="ax">${esc(cfg.unit || "")}</text></svg>`;
  const g = host.querySelector("g"); let off = 0;
  const anim = motion();
  parts.forEach((p, i) => {
    const len = Math.max(0, (p.v / tot) * c - gap);
    const seg = sv("circle", { cx: size / 2, cy: size / 2, r, fill: "none", stroke: `var(${p.color})`, "stroke-width": w, "stroke-dasharray": `${anim ? 0 : len} ${c}`, "stroke-dashoffset": -off, style: `transition:stroke-dasharray .9s ${i * 0.08}s var(--ease),stroke-width .2s;cursor:default` }, g);
    if (anim) requestAnimationFrame(() => requestAnimationFrame(() => seg.setAttribute("stroke-dasharray", `${len} ${c}`)));
    seg.addEventListener("pointermove", (ev) => { seg.setAttribute("stroke-width", w + 5); showTip(ev, `<b>${esc(p.name)}</b>${tipRow(`var(${p.color})`, "Energy", cfg.fmt(p.v))}<div class="row"><span>Share</span><span>${IN((100 * p.v) / tot, 0)} %</span></div>`); });
    seg.addEventListener("pointerleave", () => { seg.setAttribute("stroke-width", w); hideTip(); });
    off += (p.v / tot) * c;
  });
  num(host.querySelector(".dv"), cfg.center ?? tot, cfg.cd ?? 0);
}
function weekBars(host, cfg) {
  return mount(host, (W, anim) => {
    const H = cfg.height || 240, ml = cfg.unit ? 62 : 40, mr = 8, mt = 16, mb = 28, pw = W - ml - mr, ph = H - mt - mb, nc = cfg.cats.length, ns = cfg.series.length;
    let max = 0; cfg.series.forEach((s) => s.values.forEach((v) => (max = Math.max(max, v)))); max = niceMax(max * 1.08);
    const y = (v) => mt + ph * (1 - v / max), band = pw / nc, bw = Math.min(30, (band * 0.66) / ns);
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": cfg.label || "bars" }, host);
    for (let g = 0; g <= 4; g++) { const v = (max * g) / 4; sv("line", { x1: ml, x2: W - mr, y1: y(v), y2: y(v), class: "gl" }, svg); sv("text", { x: ml - 8, y: y(v) + 3.5, "text-anchor": "end", class: "ax" }, svg).textContent = IN(v, 0) + (g === 4 && cfg.unit ? " " + cfg.unit : ""); }
    cfg.cats.forEach((c, i) => {
      const cx = ml + band * (i + 0.5), x0 = cx - (bw * ns + 3 * (ns - 1)) / 2;
      const grp = sv("g", {}, svg);
      cfg.series.forEach((s, j) => {
        const v = s.values[i], top = y(v), bx = x0 + j * (bw + 3), hgt = H - mb - top, r = Math.min(3, hgt, bw / 2);
        const p = sv("path", { d: `M${bx} ${H - mb} V${top + r} Q${bx} ${top} ${bx + r} ${top} H${bx + bw - r} Q${bx + bw} ${top} ${bx + bw} ${top + r} V${H - mb} Z`, fill: `var(${s.color})` }, grp);
        if (anim) { p.classList.add("grow"); p.style.animationDelay = i * 55 + j * 30 + "ms"; }
      });
      const hitR = sv("rect", { x: cx - band / 2, y: mt, width: band, height: ph, fill: "transparent" }, svg);
      hitR.addEventListener("pointermove", (ev) => { grp.style.opacity = 0.8; showTip(ev, `<b>${esc(cfg.full ? cfg.full[i] : c)}</b>` + cfg.series.map((q) => tipRow(`var(${q.color})`, q.name, IN(q.values[i], 1) + " " + (cfg.unit || ""))).join("") + (cfg.extraTip ? cfg.extraTip(i) : "")); });
      hitR.addEventListener("pointerleave", () => { grp.style.opacity = 1; hideTip(); });
      sv("text", { x: cx, y: H - 9, "text-anchor": "middle", class: "ax", style: "font-size:11.5px" }, svg).textContent = c;
    });
    sv("line", { x1: ml, x2: W - mr, y1: H - mb, y2: H - mb, stroke: "var(--line2)" }, svg);
    return {};
  });
}
function heatGrid(host, cfg) {
  return mount(host, (W, anim) => {
    const ml = cfg.ml || 46, mt = 18, nC = cfg.cols, cw = (W - ml - 4) / nC, ch = cfg.ch || 18, H = mt + cfg.rows.length * (ch + 3) + 4;
    const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, height: H, role: "img", "aria-label": cfg.label }, host);
    for (let c = 0; c < nC; c += cfg.tickEvery || 3) sv("text", { x: ml + cw * c, y: 11, class: "ax" }, svg).textContent = cfg.colLabel(c);
    cfg.rows.forEach((r, i) => {
      const yy = mt + i * (ch + 3);
      sv("text", { x: 0, y: yy + ch / 2 + 4, class: "ax", style: "fill:var(--text2);font-size:11.5px" }, svg).textContent = r.label;
      r.values.forEach((v, c) => {
        const k = v <= 0 ? 0 : v / cfg.max;
        const cell = sv("rect", { x: ml + cw * c + 1.5, y: yy, width: Math.max(1, cw - 3), height: ch, rx: 3, fill: cfg.color ? cfg.color(k) : rampColor(k) }, svg);
        if (anim) { cell.classList.add("cellin"); cell.style.animationDelay = Math.min(900, c * 14 + i * 26) + "ms"; }
        cell.addEventListener("pointermove", (ev) => showTip(ev, `<b>${esc(r.label)} · ${cfg.colLabel(c)}</b><div class="row"><span>${esc(cfg.what)}</span><span>${cfg.fmt(v)}</span></div>`));
        cell.addEventListener("pointerleave", hideTip);
      });
    });
    return {};
  });
}

/* ---------------- sparklines (KPI cards) ---------------- */
function sparkPath(vals, upto, W, H) { const n = vals.length, m = Math.max(1e-9, ...vals); let d = ""; for (let i = 0; i <= Math.min(upto, n - 1); i++) d += (i ? "L" : "M") + ((W * i) / (n - 1)).toFixed(1) + " " + (H - 2 - ((H - 6) * vals[i]) / m).toFixed(1); return d; }
function sparkSVG(color) { const id = "sp" + Math.random().toString(36).slice(2, 7); return `<svg class="spark" viewBox="0 0 200 46" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".3"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path class="sf" fill="none" stroke="${color}" stroke-opacity=".25" stroke-width="1.2" vector-effect="non-scaling-stroke"/><path class="sa" fill="url(#${id})"/><path class="sl" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke"/></svg>`; }
function setSpark(svgEl, vals, upto) { if (!svgEl) return; if (svgEl._vals !== vals) { svgEl._vals = vals; svgEl.querySelector(".sf").setAttribute("d", sparkPath(vals, vals.length, 200, 46)); } if (svgEl._upto === upto) return; svgEl._upto = upto; const l = sparkPath(vals, upto, 200, 46); svgEl.querySelector(".sl").setAttribute("d", l); const lastX = (200 * Math.min(upto, vals.length - 1)) / (vals.length - 1); svgEl.querySelector(".sa").setAttribute("d", l ? l + `L${lastX} 46L0 46Z` : ""); }

/* ---------------- derived per-day series (cached on data key) ---------------- */
let dsKey = "", DS = null;
function daySeries() {
  const D = M.data(), key = [st.day, st.A.allowCooling, st.A.baseline, st.ovrV, st.occV, st.A.p_left_on, st.A.p_lunch_on].join("|");
  if (key === dsKey) return DS;
  const SIM = M.SIM, NB = S.NB, act = new Float64Array(NB), saved = new Float64Array(NB);
  for (let b = 0; b < NB; b++) { const s = b * S.BKT * S.SPM; let n = 0; S.ZONES.forEach((zn, zi) => { if (zn.room.type !== "corridor" && M.presence(zi, s)) n++; }); act[b] = n; }
  const bb = D.series(D.bld, "before"), aa = D.series(D.bld, "after"); let acc = 0; for (let b = 0; b < NB; b++) { acc += bb[b] - aa[b]; saved[b] = Math.max(0, acc / 1000); }
  DS = { people: D.bld.people, kw: D.kw.after, kwB: D.kw.before, act, saved }; dsKey = key; void SIM; return DS;
}

/* ---------------- shell: nav, bar, routing ---------------- */
const PAGES = [
  { id: "overview", label: "Overview", icon: "overview" }, { id: "building", label: "Building", icon: "building" }, { id: "energy", label: "Energy", icon: "energy" },
  { id: "sources", label: "Sources", icon: "sun" }, { id: "controls", label: "Controls", icon: "controls" }, { id: "insights", label: "Insights", icon: "insights" },
  { id: "savings", label: "Savings & cost", short: "Savings", icon: "rupee" },
];
// the savings page mixes no simulation controls into its estimates: the bar hides them there
const EST_PAGES = new Set(["savings"]);
const LEGACY = { map: "building", twin: "building", hardware: "building", consumption: "energy", control: "controls", reports: "insights", estimate: "savings", bill: "savings", cost: "savings", planner: "savings", deployment: "savings", campus: "savings", present: "overview", faculty: "overview" };
const navBtn = (p, tab) => `<button type="button" data-page="${p.id}">${ic(p.icon)}<span>${tab && p.short ? p.short : p.label}</span></button>`;
$("nav").innerHTML = PAGES.map((p) => navBtn(p)).join("");
$("tabbar").innerHTML = PAGES.map((p) => navBtn(p, true)).join("");
[$("nav"), $("tabbar")].forEach((n) => n.addEventListener("click", (e) => { const b = e.target.closest("button[data-page]"); if (b) location.hash = b.dataset.page; }));
const VIEWS = {}; let cur = null;
function go(page) {
  const want = page; page = LEGACY[page] || page; if (!VIEWS[page]) page = "overview";
  st.page = page; hideTip();
  if (cur && cur.destroy) cur.destroy();
  document.querySelectorAll("#nav button,#tabbar button").forEach((b) => b.setAttribute("aria-current", b.dataset.page === page ? "page" : "false"));
  $("pageTitle").textContent = PAGES.find((p) => p.id === page).label;
  document.querySelector(".shell").classList.toggle("mode-est", EST_PAGES.has(page));
  const v = $("view"); v.innerHTML = ""; const el = document.createElement("div"); el.className = "page"; v.appendChild(el);
  M.data(); cur = VIEWS[page](el) || {}; if (cur.update) cur.update(true);
  if (want === "hardware" && cur.openHw) cur.openHw(); else window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}
window.addEventListener("hashchange", () => go(location.hash.slice(1)));
const rebuild = () => { dsKey = ""; buildScrub(); go(st.page); };

// bar controls
$("daySel").innerHTML = S.DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join("");
$("daySel").addEventListener("change", (e) => { st.day = +e.target.value; st.ovr = {}; st.occOv = {}; st.ovrV++; st.occV++; rebuild(); });
const syncPlay = () => { $("playBtn").innerHTML = ic(st.playing ? "pause" : "play", "fill lg"); $("playBtn").setAttribute("aria-label", st.playing ? "Pause simulation" : "Play simulation"); };
$("playBtn").addEventListener("click", () => { if (!st.playing && st.min >= 1439.5) st.min = 0; st.playing = !st.playing; syncPlay(); flash($("playBtn")); });
const syncSpeed = () => $("speedSeg").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.v === st.speed)));
$("speedSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { st.speed = +b.dataset.v; syncSpeed(); } });
$("scrubIn").addEventListener("input", (e) => { st.min = +e.target.value; tick(true); });
const pop = $("scenPop");
const syncScen = () => { $("baseSel").value = st.A.baseline; $("acSeg").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.ac === "switch") === st.A.allowCooling))); $("scenTxt").textContent = `vs ${st.A.baseline === "timeout" ? "timeout" : "manual"} · AC ${st.A.allowCooling ? "switch" : "hold"}`; };
$("scenBtn").addEventListener("click", (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; $("scenBtn").setAttribute("aria-expanded", String(!pop.hidden)); if (!pop.hidden) flash(pop); });
document.addEventListener("click", (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== $("scenBtn")) { pop.hidden = true; $("scenBtn").setAttribute("aria-expanded", "false"); } });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) { pop.hidden = true; $("scenBtn").focus(); } });
$("baseSel").addEventListener("change", (e) => { st.A.baseline = e.target.value; M.saveA(); syncScen(); rebuild(); });
$("acSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; st.A.allowCooling = b.dataset.ac === "switch"; M.saveA(); syncScen(); rebuild(); });
let scrubEls = null;
function buildScrub() {
  const svg = $("scrubSvg"), ds = daySeries(); svg.setAttribute("viewBox", "0 0 1440 100"); svg.innerHTML = "";
  const n = ds.kw.length, mx = Math.max(...ds.kwB, ...ds.kw) || 1, X = (i) => (1440 * (i + 0.5)) / n, Y = (v) => 94 - (80 * v) / mx;
  for (let h = 3; h < 24; h += 3) sv("line", { x1: h * 60, x2: h * 60, y1: 0, y2: 100, stroke: "rgba(148,177,214,.08)", "vector-effect": "non-scaling-stroke" }, svg);
  let d = "", db = ""; for (let i = 0; i < n; i++) { d += (i ? "L" : "M") + X(i) + " " + Y(ds.kw[i]); db += (i ? "L" : "M") + X(i) + " " + Y(ds.kwB[i]); }
  sv("path", { d: d + "L1440 100L0 100Z", fill: "rgba(31,168,116,.22)" }, svg);
  sv("path", { d: db, fill: "none", stroke: "var(--without)", "stroke-opacity": 0.6, "stroke-width": 1.2, "vector-effect": "non-scaling-stroke" }, svg);
  sv("path", { d, fill: "none", stroke: "var(--with)", "stroke-width": 1.6, "vector-effect": "non-scaling-stroke" }, svg);
  const past = sv("rect", { x: 0, y: 0, height: 100, fill: "rgba(255,255,255,.04)" }, svg);
  const head = sv("line", { y1: 0, y2: 100, stroke: "var(--accent)", "stroke-width": 2, "vector-effect": "non-scaling-stroke" }, svg);
  scrubEls = { past, head };
}
function updateBar() {
  const m = st.min; $("clock").firstChild.nodeValue = hhmm(m); $("dayLbl").textContent = S.DAYS[st.day]; $("scrubIn").value = Math.floor(m); $("daySel").value = st.day;
  if (scrubEls) { scrubEls.past.setAttribute("width", m); scrubEls.head.setAttribute("x1", m); scrubEls.head.setAttribute("x2", m); }
  const h = hwStatus();
  $("hwDot").className = "dot" + (h.dot ? " " + h.dot : ""); $("hwText").textContent = h.side;
}
// one wording for the link state, used by the sidebar and the hardware panel
function hwStatus() {
  const L = st.live, now = Date.now(), ago = (ms) => fmtDur(Math.max(0, (now - ms) / 1000));
  if (!L) return { key: "off", dot: "", side: "Hardware: not linked", title: "Not linked", sub: "Every device on these pages is simulated." };
  if (L.state === "connecting") return { key: "connecting", dot: "wait", side: "ESP32: opening port", title: "Opening the port…", sub: "Chrome or Edge is opening the serial port at " + M.SER.BAUD + " baud." };
  if (L.state === "waiting") return { key: "waiting", dot: "wait", side: "ESP32: waiting for data", title: "Connected · waiting for valid data", sub: `Port open ${ago(L.openedMs)}. ${L.lines ? L.lines + " line(s) received, none of them a valid L line yet." : "Nothing received yet."}` };
  if (L.state === "receiving" && L.confirm < 2) return { key: "receiving1", dot: "live", side: "ESP32: receiving data", title: "Receiving telemetry · confirming", sub: `1 valid L line so far (${ago(L.lastMs)} ago). The next one, about 10 s later with an advancing node clock, confirms the readings are updating.` };
  if (L.state === "receiving") return { key: "receiving", dot: "live", side: "ESP32: receiving data", title: "Receiving valid telemetry", sub: `Readings updating: ${L.confirm} consecutive L lines · last ${ago(L.lastMs)} ago · node clock ${fmtDur(L.nodeMs / 1000)}` };
  if (L.state === "stale") return { key: "stale", dot: "wait", side: "ESP32: data stale", title: "Data stale", sub: `No valid L line for ${ago(L.lastMs)} (one is expected every 10 s). The twin is back on simulated values.` };
  return { key: "error", dot: "err", side: "ESP32: connection error", title: "Connection error", sub: L.err || "Unknown error." };
}
$("hwLine").addEventListener("click", () => { if (st.page === "building" && cur && cur.openHw) cur.openHw(); else location.hash = "hardware"; });
let hwKeySeen = "off";
M.onLive(() => {
  updateBar(); if (cur && cur.onLive) cur.onLive();
  const h = hwStatus(), k = h.key === "receiving1" ? "receiving1" : h.key;
  if (k !== hwKeySeen) { const prev = hwKeySeen; hwKeySeen = k;
    const msg = { connecting: "Opening the serial port…", waiting: prev === "off" || prev === "connecting" || prev === "error" ? "Port open · waiting for valid data" : "Back to waiting: the node restarted", receiving1: "First valid reading received", receiving: "Readings confirmed: the node is updating", stale: "Data stale: no reading for " + Math.round(M.SER.STALE_MS / 1000) + " s", error: "Connection error", off: "ESP32 disconnected" }[k];
    if (msg && !(k === "off" && prev === "off")) toast(esc(msg), "hw"); }
});
$("motionBtn").addEventListener("click", () => { userMotion = !userMotion; try { localStorage.setItem("nest_motion", userMotion ? "on" : "off"); } catch (e) {} applyMotion(); go(st.page); });
RM.addEventListener && RM.addEventListener("change", applyMotion);
applyMotion();

/* ---------------- building geometry shared by views ---------------- */
const zoneOccFrac = (zi, s) => { const z = M.SIM.zones[zi], zn = S.ZONES[zi]; return zn.room.type === "corridor" ? (z.act[s] ? 0.45 : 0) : Math.min(1, z.occ[s] / Math.max(1, zn.cap)); };
function roomTip(r, s) {
  let ppl = 0, kw = 0; r.zoneIdx.forEach((zi) => { ppl += M.SIM.zones[zi].occ[s]; kw += M.zoneKW(zi, s); });
  const D = M.D, t = D.rooms[r.id], b = D.tot(t, "before"), a = D.tot(t, "after");
  return `<b>${esc(short(r.id))} · ${esc(r.name)}</b><div class="row"><span>${r.type === "corridor" ? "Movement" : "People"}</span><span>${r.type === "corridor" ? (r.zoneIdx.some((zi) => M.SIM.zones[zi].act[s]) ? "yes" : "none") : ppl}</span></div><div class="row"><span>Demand</span><span>${IN(kw, 2)} kW</span></div><div class="row"><span>Saved today</span><span>${IN(pct(a, b), 0)} %</span></div><div style="color:var(--text3);font-size:11px;margin-top:4px">Simulated</div>`;
}
// What a zone tile should show: board values for the hardware zone while valid telemetry arrives,
// otherwise the simulation.
function zoneVis(zi, s) {
  const zn = S.ZONES[zi], lv = M.liveOK();
  if (lv && lv.zi === zi) { const q = M.zoneNow(zi, s); return { live: true, frac: q.O, l: zn.lights ? q.c[0] : null, f: zn.fans ? q.c[1] : null }; }
  return { live: false, frac: zoneOccFrac(zi, s), l: zn.lights ? M.circ(zi, 0, s) : null, f: zn.fans ? M.circ(zi, 1, s) : null, act: M.SIM.zones[zi].act[s] };
}
// PIR wave: two rings. Simulated motion is cyan; motion reported by the ESP32 is green.
function wave(c, kind) {
  if (!motion()) return;
  [c.pulse, c.pulse2].forEach((p) => { if (!p) return; p.classList.remove("go", "hw"); void p.getBoundingClientRect(); if (kind === "hw") p.classList.add("hw"); p.classList.add("go"); });
}
// one shared rule for when a tile pulses: rising edge of simulated motion, at most every 5 s per tile;
// for the hardware zone, only when the board itself reports motion
function pulseTile(c, v, now) {
  const lv = M.liveOK();
  if (v.live) { if (lv.pulses !== c.hwSeen) { if (c.hwSeen !== undefined) wave(c, "hw"); c.hwSeen = lv.pulses; } return; }
  if (v.act && !c.prevAct && now - (c.lastPulse || 0) > 5000) { wave(c, "sim"); c.lastPulse = now; }
  c.prevAct = v.act;
}
// stacked axonometric of all floors: slabs with lit window bands, a glass envelope, a ground
// shadow and a slow light sweep
function buildIso(host, onPick) {
  host.innerHTML = "";
  const W = 900, k = 11.2, kx = 0.46, ky = 0.3, FH = 104, ox = 50, SL = 13, top = 64, base = top + 3 * FH + Math.ceil(S.PLATE.D * k * ky) + 18;
  const P = (x, y, li) => { const yy = S.PLATE.D - y; return [ox + x * k + yy * k * kx, base - li * FH - yy * k * ky]; };
  const pt = (a) => a.map((v) => v.toFixed(1)).join(" ");
  const svg = sv("svg", { viewBox: `0 0 ${W} ${base + SL + 24}`, role: "img", "aria-label": "Axonometric view of the simulated DKM block" }, host);
  const defs = sv("defs", {}, svg), uid = "iso" + Math.random().toString(36).slice(2, 6);
  const gl = sv("linearGradient", { id: uid + "g", x1: 0, x2: 0, y1: 0, y2: 1 }, defs); sv("stop", { offset: 0, "stop-color": "#7fb3d9", "stop-opacity": 0.1 }, gl); sv("stop", { offset: 1, "stop-color": "#7fb3d9", "stop-opacity": 0.02 }, gl);
  const sw = sv("linearGradient", { id: uid + "s", x1: 0, x2: 1, y1: 0, y2: 0 }, defs); [[0, 0], [0.5, 0.09], [1, 0]].forEach(([o, a]) => sv("stop", { offset: o, "stop-color": "#ffffff", "stop-opacity": a }, sw));
  const sh = sv("linearGradient", { id: uid + "h", x1: 0, x2: 0, y1: 0, y2: 1 }, defs); sv("stop", { offset: 0, "stop-color": "#000", "stop-opacity": 0.45 }, sh); sv("stop", { offset: 1, "stop-color": "#000", "stop-opacity": 0 }, sh);
  // silhouette, used for the shadow and to clip the light sweep
  const hull = [P(0, S.PLATE.D, 0), P(S.PLATE.W, S.PLATE.D, 0), P(S.PLATE.W, 0, 0), P(S.PLATE.W, 0, 3.7), P(0, 0, 3.7), P(0, S.PLATE.D, 3.7)];
  hull[0] = [hull[0][0], hull[0][1] + SL]; hull[1] = [hull[1][0], hull[1][1] + SL]; hull[2] = [hull[2][0], hull[2][1] + SL];
  const shadow = [P(0, 0, 0), P(S.PLATE.W, 0, 0), P(S.PLATE.W, S.PLATE.D, 0), P(0, S.PLATE.D, 0)].map(([x, y]) => [x + 16, y + SL + 10]);
  sv("path", { d: "M" + shadow.map(pt).join(" L") + " Z", fill: `url(#${uid}h)` }, svg);
  // glass envelope: right face and roof frame (drawn behind the floors, translucent)
  const env = sv("g", { "pointer-events": "none" }, svg);
  for (let li = 0; li < 4; li++) {
    const h1 = li + (li === 3 ? 0.7 : 1);
    const face = [P(S.PLATE.W, S.PLATE.D, li), P(S.PLATE.W, 0, li), P(S.PLATE.W, 0, h1), P(S.PLATE.W, S.PLATE.D, h1)];
    sv("path", { d: "M" + face.map(pt).join(" L") + " Z", fill: `url(#${uid}g)`, stroke: "rgba(148,177,214,.14)" }, env);
    for (let y = 3; y < S.PLATE.D; y += 3) { const a = P(S.PLATE.W, y, li), b2 = P(S.PLATE.W, y, h1); sv("line", { x1: a[0], y1: a[1], x2: b2[0], y2: b2[1], stroke: "rgba(148,177,214,.08)" }, env); }
  }
  [[0, S.PLATE.D], [S.PLATE.W, S.PLATE.D], [S.PLATE.W, 0], [0, 0]].forEach(([x, y]) => { const a = P(x, y, 0), b2 = P(x, y, 3.7); sv("line", { x1: a[0], y1: a[1], x2: b2[0], y2: b2[1], stroke: "rgba(148,177,214,.16)", "stroke-width": 1.2 }, env); });
  const roof = [P(0, 0, 3.7), P(S.PLATE.W, 0, 3.7), P(S.PLATE.W, S.PLATE.D, 3.7), P(0, S.PLATE.D, 3.7)];
  sv("path", { d: "M" + roof.map(pt).join(" L") + " Z", fill: "rgba(127,179,217,.035)", stroke: "rgba(148,177,214,.2)" }, env);
  const cells = [], floors = [];
  S.FLOORS.forEach((f, li) => {
    const g = sv("g", { class: "floorg", "data-floor": f.id }, svg);
    const f0 = P(0, S.PLATE.D, li), f1 = P(S.PLATE.W, S.PLATE.D, li), r1 = P(S.PLATE.W, 0, li);
    // slab: front face (window band) and right face
    sv("path", { d: `M${pt(f0)} L${pt(f1)} L${f1[0]} ${f1[1] + SL} L${f0[0]} ${f0[1] + SL} Z`, fill: "#1b2a42" }, g);
    sv("path", { d: `M${pt(f1)} L${pt(r1)} L${r1[0]} ${r1[1] + SL} L${f1[0]} ${f1[1] + SL} Z`, fill: "#16233a" }, g);
    const plate = [P(0, 0, li), P(S.PLATE.W, 0, li), P(S.PLATE.W, S.PLATE.D, li), P(0, S.PLATE.D, li)];
    sv("path", { d: "M" + plate.map(pt).join(" L") + " Z", fill: "#152238", stroke: "rgba(148,177,214,.24)", "stroke-width": 1 }, g);
    f.rooms.forEach((r) => {
      r.zoneIdx.forEach((zi, z) => {
        const zw = r.w / r.zones, x0 = r.x + z * zw, pad = 0.18;
        const pts = [P(x0 + pad, r.y + pad, li), P(x0 + zw - pad, r.y + pad, li), P(x0 + zw - pad, r.y + r.d - pad, li), P(x0 + pad, r.y + r.d - pad, li)];
        const poly = sv("path", { d: "M" + pts.map(pt).join(" L") + " Z", class: "cell", fill: "var(--o0)", style: "cursor:pointer" }, g);
        const c = P(x0 + zw / 2, r.y + r.d / 2, li);
        const pulse = sv("ellipse", { cx: c[0], cy: c[1], rx: 10, ry: 5.5, class: "pulse" }, g);
        const pulse2 = sv("ellipse", { cx: c[0], cy: c[1], rx: 10, ry: 5.5, class: "pulse p2" }, g);
        const lamp = sv("circle", { cx: c[0] + (r.type === "corridor" ? 0 : 7), cy: c[1] - 1, r: 2.4, fill: "var(--lamp)", class: "lampdot", opacity: 0 }, g);
        // south-side zones face the viewer: one window per zone on the slab band
        let win = null;
        if (r.side === "S" && r.type !== "corridor") { const a = P(x0 + 0.5, S.PLATE.D, li), b2 = P(x0 + zw - 0.5, S.PLATE.D, li); win = sv("rect", { x: a[0], y: a[1] + 3, width: Math.max(2, b2[0] - a[0]), height: SL - 6, rx: 1.5, class: "iwin" }, g); }
        poly.addEventListener("pointermove", (ev) => showTip(ev, roomTip(r, M.slotNow())));
        poly.addEventListener("pointerleave", hideTip);
        poly.addEventListener("click", (ev) => { ev.stopPropagation(); onPick(f.id, r.id); });
        cells.push({ zi, poly, pulse, pulse2, lamp, win });
      });
    });
    const lp = P(0, S.PLATE.D, li);
    sv("text", { x: lp[0] - 12, y: lp[1] + 9, "text-anchor": "end", style: "font:700 16px var(--f-display);fill:var(--text2)" }, g).textContent = f.id === "G" ? "G" : "F" + f.id;
    g.addEventListener("click", () => onPick(f.id, null));
    floors.push({ id: f.id, g });
  });
  // slow light sweep across the building (decorative, motion only)
  const cp = sv("clipPath", { id: uid + "c" }, defs); sv("path", { d: "M" + hull.map(pt).join(" L") + " Z" }, cp);
  const swg = sv("g", { "clip-path": `url(#${uid}c)`, "pointer-events": "none" }, svg);
  sv("rect", { x: -160, y: 0, width: 160, height: base + SL, fill: `url(#${uid}s)`, class: "sweep" }, swg);
  const hwTag = sv("g", { "pointer-events": "none", opacity: 0, class: "hwtag" }, svg);
  return {
    update(s) {
      const now = performance.now();
      cells.forEach((c) => {
        const v = zoneVis(c.zi, s), warn = (v.l && v.l.state === "warn") || (v.f && v.f.state === "warn"), man = (v.l && v.l.manual) || (v.f && v.f.manual);
        c.poly.setAttribute("fill", rampColor(v.frac));
        c.poly.classList.toggle("warn", !!warn); c.poly.classList.toggle("man", !!man && !warn); c.poly.classList.toggle("hw", v.live);
        c.lamp.setAttribute("opacity", v.l && v.l.on ? 0.95 : 0);
        if (c.win) { c.win.classList.toggle("lit", !!(v.l && v.l.on)); c.win.classList.toggle("warn", !!(v.l && v.l.state === "warn")); }
        pulseTile(c, v, now);
        if (v.live && !hwTag.firstChild) { const bb = c.poly.getBBox(); sv("rect", { x: bb.x + bb.width / 2 - 24, y: bb.y - 20, width: 48, height: 15, rx: 7.5, fill: "var(--hwc)" }, hwTag); sv("text", { x: bb.x + bb.width / 2, y: bb.y - 9.5, "text-anchor": "middle", style: "font:800 9.5px var(--f-body);letter-spacing:.08em;fill:#04261a" }, hwTag).textContent = "ESP32"; }
      });
      hwTag.setAttribute("opacity", M.liveOK() ? 1 : 0);
    },
    floors,
  };
}

function eventToast(e) {
  const now = performance.now(); if (!st.playing || st.speed > 15 || now - lastToast < 2500) return; lastToast = now;
  const zn = S.ZONES[e.zi], lab = { off: "switched off", on: "back on", warning: "30 s warning", cancel: "warning cancelled" };
  toast(`<b>${esc(short(zn.room.id))} ${esc(zn.name)}</b> · ${["lights", "fans", "AC"][e.k]} ${lab[e.e]}`, "sim");
}
/* ======================= OVERVIEW ======================= */
VIEWS.overview = (el) => {
  el.classList.add("ov");
  el.innerHTML = `
  <section class="card hero">
    <div class="ch"><div><div class="eyebrow">DKM block · 4 floors · ${S.ZONES.length} zones</div><h2 class="big">Occupancy and lights, by zone</h2></div>
      <div class="r">${rampHTML("empty", "full")}<button class="info" type="button" data-tip="One tile per control zone: an ESP32 node with two PIR sensors and a 4-channel relay. Colour = simulated occupancy. Cyan ripple = simulated PIR motion; green ripple = motion reported by a linked ESP32. Amber window or dot = lights on; amber outline = 30 s warning; cyan dashed outline = manual override. Placeholder layout, not the verified DKM floor plan.">${ic("info", "sm")}</button></div></div>
    <div class="iso" id="ovIso"></div>
    <div class="foot" id="ovFloors"></div>
  </section>
  <div class="k4">
    ${[["People", "person", "", "kPpl", "--cyan", "Simulated people in rooms (timetable model)"], ["Demand now", "energy", "", "kKw", "--cyan", "Estimated block demand at the clock time, from assumed fixture wattages"], ["Active zones", "pir", "", "kAct", "--cyan", "Zones whose node detects presence now (O ≥ 0.5 or motion in this slot), corridors included"], ["Saved today", "leaf", "g", "kSav", "--accent", "Simulated full day: baseline minus zone control, same occupancy. \"So far\" counts up to the clock; it can dip below zero early in the morning when a PIR false-trigger switches loads on at night."]].map(([l, i, c, id, col, t]) => `
      <div class="card kpi hov" id="${id}" data-tip="${esc(t)}"><div class="top"><span class="ico ${c}">${ic(i)}</span><span class="lab">${l}</span></div><div class="v num"><span class="n">0</span><small class="u"></small></div><div class="d"></div>${sparkSVG(cssVar(col))}</div>`).join("")}
  </div>
  <section class="card loads"><div class="loadrow" id="ovLoads"></div></section>
  <section class="card tl"><div class="ch"><h2>Today's demand</h2><div class="legend"><span><i class="ln" style="background:var(--without)"></i>Without</span><span><i class="ln" style="background:var(--with)"></i>With NEST</span></div><div class="r"><span class="muted" style="font-size:12px">tap to jump</span><button class="info" type="button" data-tip="Estimated block demand in kW (5-min average) for the same simulated occupancy, with and without zone control. Baseline and AC policy are set under Scenario.">${ic("info", "sm")}</button></div></div><div style="padding:4px 14px 14px" id="ovTl"></div></section>
  <section class="card feed"><div class="ch"><h2>Node activity</h2><div class="r"><span class="simtag mini">sim</span></div></div><ul class="feedlist" id="ovFeed"></ul></section>`;
  const iso = buildIso(el.querySelector("#ovIso"), (f, r) => { st.floor = f; if (r) st.room = r; location.hash = "building"; });
  const LOADS = [["lights", "bulb", "Lights", "--c-lights", ""], ["fans", "fan", "Fans", "--c-fans", "fan"], ["ac", "snow", "AC", "--c-ac", "ac"], ["plugs", "plug", "Plug loads", "--c-plugs", "plug"], ["pir", "pir", "Sensors", "--cyan", "pir"]];
  el.querySelector("#ovLoads").innerHTML = LOADS.map(([k, i, l, c, cls]) => `<div class="load" id="ld-${k}" data-tip="${k === "pir" ? "Zone nodes whose PIR saw motion in this 10 s slot" : k === "plugs" ? "Lab PCs and office equipment. Not switched by the node." : `${l} circuits on now, across all zones`}"><div class="lic ${cls}">${ic(i, "lg")}</div><div style="flex:1;min-width:0"><div class="lv num"><span class="a">0</span><small> / <span class="b">0</span></small></div><div class="ll">${l} · <span class="kw">0</span>${k === "pir" ? "" : " kW"}</div><div class="meter"><b style="background:var(${c});width:0"></b></div></div></div>`).join("");
  const D = M.data();
  let chipsKey = "";
  const tl = tsChart(el.querySelector("#ovTl"), { height: 300, unit: "kW", compact: true, label: "Block demand today", series: [{ name: "Without", color: "--without", values: D.kw.before, width: 1.6 }, { name: "With", color: "--with", values: D.kw.after, area: true }], onSeek: (m) => { st.min = m; tick(true); } });
  let feedKey = "";
  function update() {
    const s = M.slotNow(), b = M.bktNow(), snap = M.snapshot(s), D = M.data(), d = daySeries();
    iso.update(s);
    // floor chips (rebuilt only when a figure changes)
    const chips = S.FLOORS.slice().reverse().map((f) => { let p = 0, kw = 0; f.rooms.forEach((r) => r.zoneIdx.forEach((zi) => { if (r.type !== "corridor") p += M.SIM.zones[zi].occ[s]; kw += M.zoneKW(zi, s); })); return `<button class="fchip" type="button" data-f="${f.id}">${ic("layers", "sm")}${f.id === "G" ? "Ground" : "Floor " + f.id}<b>${p}</b>${ic("person", "sm")}<b>${IN(kw, 1)}</b>kW</button>`; }).join("");
    if (chips !== chipsKey) { chipsKey = chips; el.querySelector("#ovFloors").innerHTML = chips + `<span class="simtag mini" style="margin-left:auto" data-tip="Room numbers, layout and fixture counts are placeholders until replaced with the real DKM block plan.">placeholder layout</span>`; }
    // KPIs
    const k = (id, v, dec, unit, sub, series, upto) => { const c = el.querySelector("#" + id); num(c.querySelector(".n"), v, dec); c.querySelector(".u").textContent = unit; const dd = c.querySelector(".d"); if (dd._h !== sub) { dd._h = sub; dd.innerHTML = sub; } setSpark(c.querySelector(".spark"), series, upto); };
    const bs = D.tot(D.bld, "before", b + 1), as = D.tot(D.bld, "after", b + 1);
    k("kPpl", snap.people, 0, "", `${snap.occZones} of ${snap.zones} zones occupied`, d.people, b);
    k("kKw", snap.kw, 1, "kW", `<span>est. · without: ${IN(D.kw.before[b], 1)} kW</span>`, d.kw, b);
    k("kAct", snap.present, 0, `/ ${S.ZONES.length}`, snap.wasteCircuits ? `${snap.wasteCircuits} circuits on in empty zones` : "no circuits on in empty zones", d.act, b);
    const bf = D.tot(D.bld, "before"), af = D.tot(D.bld, "after");
    k("kSav", (bf - af) / 1000, 1, "kWh", `<b>${IN(pct(af, bf), 1)} %</b> full day · so far ${IN((bs - as) / 1000, 1)}`, d.saved, b);
    // loads
    LOADS.forEach(([key]) => {
      const c = el.querySelector("#ld-" + key); const o = key === "pir" ? { on: snap.pir, n: S.ZONES.length, kw: null } : snap.cls[key];
      num(c.querySelector(".a"), o.on); c.querySelector(".b").textContent = o.n; c.querySelector(".kw").textContent = key === "pir" ? "active nodes" : IN(o.kw, 1);
      c.querySelector(".meter b").style.width = (100 * o.on) / Math.max(1, o.n) + "%";
      const lic = c.querySelector(".lic"), was = lic.classList.contains("on"); lic.classList.toggle("on", o.on > 0); if (was !== o.on > 0) flash(lic);
      if (key === "fans") fanIcon(lic.querySelector("svg"), o.on > 0);
    });
    tl.api.setNow(st.min);
    // feed
    const evs = M.eventsUpTo(s, 7), fk = evs.map((e) => e.sl + ":" + e.zi + ":" + e.k).join(",");
    if (fk !== feedKey) {
      const prevTop = feedKey.split(",")[0]; feedKey = fk; const isNew = prevTop && evs[0] && prevTop !== fk.split(",")[0];
      const lab = { off: "off", on: "back on", warning: "warning", cancel: "warning cancelled" }, icn = { off: "power", on: "check", warning: "warn", cancel: "pir" };
      if (isNew) eventToast(evs[0]);
      el.querySelector("#ovFeed").innerHTML = evs.map((e) => { const zn = S.ZONES[e.zi]; return `<li class="${isNew && e === evs[0] ? "new" : ""}"><span class="fi ${e.e}">${ic(icn[e.e], "sm")}</span><div><div class="ft">${short(zn.room.id)} ${esc(zn.name)} · ${["lights", "fans", "AC"][e.k]} ${lab[e.e]}</div><div class="fs">${esc(zn.room.name)}</div></div><time>${hhmm((e.sl * S.SLOT) / 60)}</time></li>`; }).join("") || `<li><span class="fi on">${ic("clock", "sm")}</span><div class="ft">No node events yet today</div><time></time></li>`;
    }
  }
  el.querySelector("#ovFloors").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) { st.floor = b.dataset.f; location.hash = "building"; } });
  return { update };
};

/* ======================= BUILDING (+ room twin) ======================= */
VIEWS.building = (el) => {
  el.classList.add("bldwrap");
  el.innerHTML = `
    <section class="card floors" id="flBtns" aria-label="Floors"></section>
    <section class="card">
      <div class="ch"><h2 id="fpTitle"></h2><span class="simtag mini" data-tip="Placeholder layout and room numbers. Not the verified DKM block floor plan.">placeholder</span>
        <div class="r"><div class="seg" id="metricSeg"><button type="button" data-m="occ">Occupancy</button><button type="button" data-m="kw">Power</button><button type="button" data-m="waste" data-tip="Loads still on in a zone with nobody in it">Idle-on</button></div></div></div>
      <div class="planwrap" id="plan"></div>
      <div class="ch" style="padding:0 18px 16px"><div class="legend" id="planLeg"></div><div class="r"><span class="legend"><span>${ic("bulb", "sm")}Lights</span><span>${ic("fan", "sm")}Fans</span><span>${ic("snow", "sm")}AC</span><span><svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="var(--cyan)" stroke-width="2"/></svg>PIR motion (sim)</span><span><svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="var(--hwc)" stroke-width="2"/></svg>ESP32 motion</span></span></div></div>
    </section>
  <div class="g bld2">
  <div class="rcwrap"><section class="card rc" id="rc"></section></div>
  <section class="card" id="twinCard">
    <div class="ch"><div><div class="eyebrow">Room twin</div><h2 id="twTitle" style="font-size:20px"></h2></div>
      <div class="r"><span id="twTag"></span><button class="btns" id="halfBtn" type="button" data-tip="A class of half the room's capacity sits at the front for 50 minutes from now. Watch the back zone switch off.">${ic("zone", "sm")}Half-filled class</button><button class="info" type="button" data-tip="Each zone has its own node: it counts 10 s slots with PIR motion in the last 5 min (n of 30), estimates occupancy O = 1 − e^(−n/2), and after the grace time with no presence (lights 3 min, fans 10 min) gives a 30 s warning and opens only that zone's relay. Any motion restores the load.">${ic("info", "sm")}</button></div></div>
    <div class="twin"><div class="stage" id="twStage"></div><div class="zcards" id="twZones"></div></div>
    <details class="more"><summary>${ic("clock", "sm")}Node events in this room<svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body"><ul class="feedlist" id="twLog" style="padding:0;max-height:300px;overflow:auto"></ul></div></details>
    <details class="more" id="hwDet"><summary>${ic("usb", "sm")}Hardware link · ESP32 over USB<span id="hwSum" class="muted" style="font-weight:600;font-size:12px"></span><svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body" id="hwBody"></div></details>
  </section>
  </div>`;
  const syncMetric = () => el.querySelectorAll("#metricSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === st.metric)));
  el.querySelector("#metricSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { st.metric = b.dataset.m; syncMetric(); legend(); update(); } });
  syncMetric();
  const legend = () => { el.querySelector("#planLeg").innerHTML = { occ: rampHTML("empty", "full"), kw: rampHTML("0", "40 W/m²"), waste: rampHTML("none", "3 loads idle-on") }[st.metric]; };
  legend();
  // floor buttons
  const flb = el.querySelector("#flBtns");
  flb.innerHTML = S.FLOORS.slice().reverse().map((f) => `<button class="floorbtn" type="button" data-f="${f.id}" aria-pressed="${f.id === st.floor}"><div class="fh"><b>${f.id === "G" ? "G" : "F" + f.id}</b><span>${esc(f.name)}</span></div><div class="mini">${f.rooms.flatMap((r) => r.zoneIdx).map((zi) => `<i data-zi="${zi}"></i>`).join("")}</div><div class="fs"><span>${ic("person", "sm")}<b class="fp">0</b></span><span>${ic("energy", "sm")}<b class="fk">0</b> kW</span></div></button>`).join("");
  let planDir = 0;
  flb.addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (!b || b.dataset.f === st.floor) return; const ix = (id) => S.FLOORS.findIndex((x) => x.id === id); planDir = ix(b.dataset.f) > ix(st.floor) ? -1 : 1; st.floor = b.dataset.f; flb.querySelectorAll(".floorbtn").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.f === st.floor))); const f = S.FLOORS.find((x) => x.id === st.floor); if (!f.rooms.some((r) => r.id === st.room)) st.room = f.rooms.find((r) => r.type !== "corridor").id; buildPlan(); buildTwin(); update(); });
  if (!S.FLOORS.find((f) => f.id === st.floor).rooms.some((r) => r.id === st.room)) st.room = S.FLOORS.find((f) => f.id === st.floor).rooms[0].id;
  // ---- floor plan ----
  let cells = [], rooms = [];
  function buildPlan() {
    const host = el.querySelector("#plan"); host.innerHTML = ""; cells = []; rooms = [];
    const f = S.FLOORS.find((x) => x.id === st.floor), k = 20, W = S.PLATE.W * k, H = S.PLATE.D * k;
    el.querySelector("#fpTitle").textContent = f.name;
    const svg = sv("svg", { viewBox: `-8 -8 ${W + 16} ${H + 16}`, role: "img", "aria-label": f.name + " plan (placeholder)" }, host);
    if (motion()) { svg.style.setProperty("--dir", planDir); svg.classList.add("planin"); } planDir = 0;
    const defs = sv("defs", {}, svg);
    sv("rect", { x: -4, y: -4, width: W + 8, height: H + 8, rx: 18, fill: "#0d1828", stroke: "rgba(148,177,214,.14)" }, svg);
    f.rooms.forEach((r) => {
      const pad = 0.22, rx = (r.x + pad) * k, ry = (r.y + pad) * k, rw = (r.w - 2 * pad) * k, rh = (r.d - 2 * pad) * k;
      const cid = "rc" + r.id.replace(/\W/g, ""), cp = sv("clipPath", { id: cid }, defs); sv("rect", { x: rx, y: ry, width: rw, height: rh, rx: 12 }, cp);
      const g = sv("g", { style: "cursor:pointer", tabindex: 0, role: "button", "aria-label": `${r.id} ${r.name}` }, svg);
      const zg = sv("g", { "clip-path": `url(#${cid})` }, g);
      const zr = [];
      r.zoneIdx.forEach((zi, z) => {
        const zw = (r.w / r.zones) * k, x = r.x * k + z * zw;
        const cell = sv("rect", { x, y: ry, width: zw, height: rh, class: "cell", fill: "var(--o0)" }, zg);
        if (z > 0) sv("line", { x1: x, x2: x, y1: ry + 6, y2: ry + rh - 6, stroke: "rgba(10,17,29,.7)", "stroke-width": 2, "stroke-dasharray": "5 5" }, zg);
        const cx = x + zw / 2, cy = ry + rh / 2;
        const pulse = sv("circle", { cx, cy, r: Math.min(zw, rh) * 0.28, class: "pulse" }, g);
        const pulse2 = sv("circle", { cx, cy, r: Math.min(zw, rh) * 0.28, class: "pulse p2" }, g);
        zr.push({ zi, cell, pulse, pulse2 });
        cells.push(zr[zr.length - 1]);
      });
      const out = sv("rect", { x: rx, y: ry, width: rw, height: rh, rx: 12, fill: "none", stroke: "rgba(148,177,214,.22)", "stroke-width": 1.2, class: "roomr" }, g);
      const glow = sv("rect", { x: rx - 3, y: ry - 3, width: rw + 6, height: rh + 6, rx: 15, fill: "none", stroke: "var(--accent)", "stroke-width": 2.5, opacity: r.id === st.room ? 1 : 0, class: "rglow" }, g);
      let lab = null, ppl = null, devs = [];
      if (r.type !== "corridor") {
        lab = sv("text", { x: rx + 12, y: ry + 22, style: "font:700 15px var(--f-display);fill:var(--text);paint-order:stroke;stroke:#0b1525;stroke-width:3px;stroke-linejoin:round" }, g); lab.textContent = short(r.id);
        sv("text", { x: rx + 12, y: ry + 38, style: "font:700 11px var(--f-body);fill:#dbe6f2;paint-order:stroke;stroke:#0b1525;stroke-width:3px;stroke-linejoin:round" }, g).textContent = r.name.length > 18 && rw < 220 ? r.name.split(" ")[0] : r.name;
        // devices bottom-left
        [["bulb", r.lights], ["fan", r.fans], ["snow", r.acs]].forEach(([n, cnt], i) => { if (!cnt) return; const u = useIcon(g, n, rx + 10 + devs.length * 22, ry + rh - 28, 18, { class: "devico", style: "color:rgba(255,255,255,.25)" }); devs.push({ k: i, u }); });
        const pg = sv("g", {}, g); useIcon(pg, "person", rx + rw - 46, ry + rh - 27, 15, { style: "color:var(--text2)" }); ppl = sv("text", { x: rx + rw - 12, y: ry + rh - 15, "text-anchor": "end", style: "font:800 14px var(--f-body);fill:var(--text);paint-order:stroke;stroke:#0b1525;stroke-width:3px;stroke-linejoin:round" }, pg);
      } else sv("text", { x: W / 2, y: ry + rh / 2 + 4, "text-anchor": "middle", style: "font:700 10.5px var(--f-body);letter-spacing:.2em;fill:var(--text3)" }, g).textContent = "CORRIDOR";
      g.addEventListener("pointermove", (ev) => showTip(ev, roomTip(r, M.slotNow())));
      g.addEventListener("pointerleave", hideTip);
      const pick = () => { st.room = r.id; rooms.forEach((x) => x.glow.setAttribute("opacity", x.r.id === st.room ? 1 : 0)); buildTwin(); update(); };
      g.addEventListener("click", pick); g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
      rooms.push({ r, g, out, glow, ppl, devs, zr });
    });
    // services
    const used = f.rooms.filter((r) => r.type !== "corridor");
    ["N", "S"].forEach((side) => { const rs = used.filter((r) => r.side === side); const end = Math.max(0, ...rs.map((r) => r.x + r.w)); if (end < S.PLATE.W - 0.5) { const y = side === "N" ? 0 : 10.4; sv("rect", { x: (end + 0.22) * k, y: (y + 0.22) * k, width: (S.PLATE.W - end - 0.44) * k, height: 7.16 * k, rx: 12, fill: "none", stroke: "rgba(148,177,214,.14)", "stroke-dasharray": "6 6" }, svg); sv("text", { x: (end + (S.PLATE.W - end) / 2) * k, y: (y + 3.9) * k, "text-anchor": "middle", style: "font:600 11px var(--f-body);fill:var(--text3)" }, svg).textContent = "Stairs · services"; } });
  }
  const metricOf = (zi, s) => { const zn = S.ZONES[zi]; if (st.metric === "occ") return zoneVis(zi, s).frac; if (st.metric === "kw") { const area = (zn.room.w / zn.room.zones) * zn.room.d; return Math.min(1, (M.zoneKW(zi, s) * 1000) / area / 40); } return zn.room.type === "corridor" ? 0 : M.wasteNow(zi, s) / 3; };
  // ---- room card ----
  const rcEl = el.querySelector("#rc");
  const ring = ringSVG(112, 12, "var(--cyan)");
  function buildRoomCard() {
    const r = M.ROOM[st.room];
    rcEl.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px"><div><div class="rid">${esc(short(r.id))}</div><div class="rname">${esc(r.name)} · ${esc(M.FLOOR_NAME[r.floor])}</div></div><span class="simtag mini" style="margin-left:auto">sim</span></div>
      <div class="gauge"><div style="position:relative;width:112px;height:112px">${ring.html}<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div class="num" style="font:800 28px/1 var(--f-body)" id="rcP">0</div><div class="muted" style="font-size:11.5px;font-weight:700">${r.type === "corridor" ? "movement" : "of " + r.cap}</div></div></div></div>
        <div style="display:flex;flex-direction:column;gap:6px"><div class="eyebrow">Demand now</div><div class="num" style="font:800 26px/1 var(--f-body)"><span id="rcKw">0</span><small class="muted" style="font-size:13px"> kW</small></div><div class="muted" style="font-size:12px;font-weight:700">${r.zones} zone${r.zones > 1 ? "s" : ""} · ${r.w.toFixed(1)} × ${r.d.toFixed(1)} m</div></div></div>
      <div class="devs">${[["l", "bulb", "Lights", r.lights], ["f", "fan", "Fans", r.fans], ["a", "snow", "AC", r.acs]].map(([c, i, n, cnt]) => `<div class="dev ${c}" id="rcd-${c}" ${cnt ? "" : 'style="opacity:.35"'}>${ic(i, "lg")}<span>${n}</span><span class="n">${cnt ? `<b class="on">0</b>/${cnt}` : "—"}</span></div>`).join("")}</div>
      <div class="cmp"><div class="eyebrow">Energy today</div>
        <div class="row"><span>Without</span><span class="tr"><b id="rcB" style="background:var(--without);width:0"></b></span><span id="rcBv">0</span></div>
        <div class="row"><span>With</span><span class="tr"><b id="rcA" style="background:var(--with);width:0"></b></span><span id="rcAv">0</span></div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-top:4px"><span class="num up" style="font:800 24px/1 var(--f-body)" id="rcS">0</span><span class="muted" style="font-size:12px;font-weight:700">% saved · full day, kWh est.</span></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btnp" type="button" id="rcTwin">${ic("zone", "sm")}Room twin</button><button class="btns" type="button" id="rcCtl">${ic("controls", "sm")}Controls</button></div>`;
    rcEl.querySelector("#rcTwin").addEventListener("click", () => el.querySelector("#twinCard").scrollIntoView({ block: "start" }));
    rcEl.querySelector("#rcCtl").addEventListener("click", () => { st.ctlFloor = r.floor; location.hash = "controls"; });
  }
  // ---- twin ----
  let TW = null;
  function buildTwin() {
    buildRoomCard();
    const R = M.ROOM[st.room]; el.querySelector("#twTitle").textContent = `${short(R.id)} · ${R.name}`;
    el.querySelector("#halfBtn").hidden = !["class", "seminar", "lab"].includes(R.type);
    const host = el.querySelector("#twStage"); host.innerHTML = "";
    const k = R.type === "corridor" ? 18 : Math.min(80, 1000 / R.w), Mg = 34, W = R.w * k, H = R.d * k;
    const svg = sv("svg", { viewBox: `${-Mg} ${-Mg} ${W + 2 * Mg} ${H + 2 * Mg}`, role: "img", "aria-label": `Room twin for ${R.id}` }, host);
    const defs = sv("defs", {}, svg); const rg = sv("radialGradient", { id: "lglow" }, defs); sv("stop", { offset: 0, "stop-color": "rgba(255,194,74,.55)" }, rg); sv("stop", { offset: 1, "stop-color": "rgba(255,194,74,0)" }, rg);
    sv("rect", { x: -Mg + 4, y: -Mg + 4, width: W + 2 * Mg - 8, height: H + 2 * Mg - 8, rx: 18, fill: "#0b1525" }, svg);
    sv("rect", { x: 0, y: 0, width: W, height: H, rx: 10, fill: "#111e31" }, svg);
    const teach = ["class", "seminar", "lab"].includes(R.type), seats = R.zoneIdx.map(() => []);
    if (teach || R.type === "library" || R.type === "staff") {
      const colGap = R.type === "lab" ? 1.6 : 1.05, x0 = teach ? 1.9 : 0.9;
      for (let x = x0; x < R.w - 0.6; x += colGap) for (let y = 0.7; y + 1.4 < R.d - 0.25; y += 1.6) {
        sv("rect", { x: x * k, y: y * k, width: 0.42 * k, height: 1.5 * k, rx: 4, fill: "#1a2a42" }, svg);
        const z = Math.min(R.zones - 1, Math.floor(x / (R.w / R.zones))); seats[z].push({ x: x + 0.66, y: y + 0.27 }, { x: x + 0.66, y: y + 0.75 }, { x: x + 0.66, y: y + 1.23 });
      }
    } else if (R.type !== "corridor") {
      for (let i = 0; i < Math.max(2, R.cap); i++) { const x = 0.9 + (i % 3) * 1.6, y = 1 + Math.floor(i / 3) * 1.6; if (y > R.d - 1) break; sv("rect", { x: (x - 0.5) * k, y: (y - 0.4) * k, width: 1.2 * k, height: 0.7 * k, rx: 4, fill: "#1a2a42" }, svg); seats[0].push({ x: x + 0.1, y: y + 0.6 }); }
    }
    if (teach) { sv("rect", { x: 6, y: H * 0.22, width: 7, height: H * 0.56, rx: 3, fill: "#5b6f8c" }, svg); }
    const zones = [];
    R.zoneIdx.forEach((zi, z) => {
      const zn = S.ZONES[zi], zw = R.w / R.zones, x0 = z * zw;
      if (z > 0) sv("line", { x1: x0 * k, x2: x0 * k, y1: 8, y2: H - 8, stroke: "rgba(148,177,214,.35)", "stroke-dasharray": "8 7", "stroke-width": 1.5 }, svg);
      sv("text", { x: (x0 + zw / 2) * k, y: -12, "text-anchor": "middle", style: "font:700 12px var(--f-body);letter-spacing:.16em;fill:var(--text2)" }, svg).textContent = (zn.name + " zone").toUpperCase();
      const cx = (x0 + zw / 2) * k, cy = H / 2, rr = Math.min(zw / 2 + 0.6, 4.2) * k;
      const cov = sv("circle", { cx, cy, r: rr, fill: "rgba(56,198,217,.05)", stroke: "rgba(56,198,217,.35)", "stroke-dasharray": "4 6" }, svg);
      const grid = (n, padx, pady) => { const out = []; if (!n) return out; const cols = Math.max(1, Math.round(Math.sqrt((n * zw) / R.d))), rows = Math.ceil(n / cols); let c = 0; for (let j = 0; j < rows; j++) for (let i = 0; i < cols && c < n; i++, c++) out.push({ x: x0 + padx + ((zw - 2 * padx) * (i + 0.5)) / cols, y: pady + ((R.d - 2 * pady) * (j + 0.5)) / rows }); return out; };
      const glowG = sv("g", { "pointer-events": "none" }, svg);
      const lights = grid(zn.lights, 0.6, 0.9).map((p) => ({ glow: sv("circle", { cx: p.x * k, cy: p.y * k, r: 1.8 * k, fill: "url(#lglow)", opacity: 0, class: "tglow" }, glowG), r: sv("rect", { x: p.x * k - 0.6 * k, y: p.y * k - 4, width: 1.2 * k, height: 8, rx: 4, fill: "#2a3a55", class: "tdev" }, svg) }));
      const fans = grid(zn.fans, 1.2, 1.9).map((p) => { const g = sv("g", { transform: `translate(${p.x * k} ${p.y * k})` }, svg); const bl = sv("g", { class: "blade" }, g); for (let q = 0; q < 3; q++) sv("path", { d: `M0 -4 C ${0.18 * k} ${-0.3 * k}, ${0.12 * k} ${-0.55 * k}, 0 ${-0.6 * k} C ${-0.12 * k} ${-0.55 * k}, ${-0.18 * k} ${-0.3 * k}, 0 -4 Z`, transform: `rotate(${q * 120})`, fill: "#2a3a55", class: "tdev" }, bl); sv("circle", { r: 5, fill: "#0b1525", stroke: "#3b4e6c" }, g); return { bl, a: Math.random() * 360, v: 0, on: false }; });
      const acs = []; for (let i = 0; i < zn.acs; i++) { const x = x0 + (zw * (i + 1)) / (zn.acs + 1); acs.push(sv("rect", { x: x * k - 0.55 * k, y: 4, width: 1.1 * k, height: 12, rx: 5, fill: "#2a3a55", class: "tdev" }, svg)); }
      const node = sv("g", { transform: `translate(${cx} ${cy})` }, svg);
      const pr = sv("circle", { r: 26, class: "pulse" }, node), pr2 = sv("circle", { r: 26, class: "pulse p2" }, node);
      const ring = sv("circle", { r: 12, fill: "#0b1525", stroke: "var(--cyan)", "stroke-width": 2.5, class: "tnode" }, node);
      const nd = sv("circle", { r: 4.5, fill: "var(--cyan)", class: "tnode" }, node);
      zones.push({ zi, cov, pr, pr2, ring, nd, lights, fans, acs, seats: seats[z].sort((a, b) => a.x - b.x || a.y - b.y), people: [], tile: { pulse: pr, pulse2: pr2 } });
    });
    if (R.type !== "corridor") sv("rect", { x: (R.w - 1.6) * k, y: (R.side === "N" ? R.d : 0) * k - 4, width: 1.0 * k, height: 8, rx: 3, fill: "var(--accent)", opacity: 0.6 }, svg);
    sv("rect", { x: 0, y: 0, width: W, height: H, rx: 10, fill: "none", stroke: "#4a5d7a", "stroke-width": 5 }, svg);
    const pg = sv("g", {}, svg);
    const door = { x: R.w - 1.1, y: R.side === "N" ? R.d + 0.4 : -0.4 };
    TW = { R, k, zones, pg, door, logKey: "" };
    renderHw();
  }
  function updateTwin(s) {
    if (!TW) return; const { R, k, zones, pg, door } = TW, now = performance.now();
    const lv = M.liveOK(), live = lv && R.zoneIdx.includes(lv.zi);
    el.querySelector("#twTag").innerHTML = live ? `<span class="st on" data-tip="The back zone shows values from the linked ESP32 (valid L lines). The other zones stay simulated.">ESP32 data · back zone</span>` : `<span class="simtag mini">sim</span>`;
    const zs = R.zoneIdx.map((zi) => M.zoneNow(zi, s));
    void k;
    zones.forEach((Z, z) => {
      const q = zs[z];
      // people: walk in from the door / out to it
      const want = R.type === "corridor" ? (q.act ? 2 : 0) : Math.min(q.people ?? 0, Z.seats.length || 60);
      // people walk in from the door and leave through it (simulated occupants only)
      while (Z.people.length < want) { const i = Z.people.length, p = Z.seats[i] || { x: (R.w / R.zones) * (z + 0.2 + 0.6 * Math.random()), y: R.d * (0.25 + 0.5 * Math.random()) }; const mv = motion(); const g = sv("g", { class: "person", transform: mv ? `translate(${door.x * k} ${door.y * k})` : `translate(${p.x * k} ${p.y * k})`, opacity: mv ? 0 : 1 }, pg); sv("circle", { r: 0.13 * k, fill: "#c7d5e6", stroke: "#0b1525", "stroke-width": 1.5 }, g); Z.people.push(g); if (mv) requestAnimationFrame(() => requestAnimationFrame(() => { g.setAttribute("transform", `translate(${p.x * k} ${p.y * k})`); g.setAttribute("opacity", 1); })); }
      while (Z.people.length > want) { const g = Z.people.pop(); if (!motion()) { g.remove(); continue; } g.setAttribute("transform", `translate(${door.x * k} ${door.y * k})`); g.setAttribute("opacity", 0); setTimeout(() => g.remove(), 1100); }
      const live = !!q.live;
      Z.cov.setAttribute("fill", q.act ? (live ? "rgba(52,211,153,.13)" : "rgba(56,198,217,.12)") : "rgba(56,198,217,.04)");
      Z.nd.setAttribute("opacity", q.act ? 1 : 0.25); Z.ring.classList.toggle("hw", live); Z.nd.classList.toggle("hw", live);
      pulseTile(Z.tile, { live, act: q.act }, now);
      const col = (c, on) => (c.on ? (c.state === "warn" ? "var(--warn)" : on) : "#2a3a55");
      Z.lights.forEach((L) => { L.r.setAttribute("fill", col(q.c[0], "var(--lamp)")); L.r.classList.toggle("warnpulse", q.c[0].state === "warn"); L.glow.setAttribute("opacity", q.c[0].on ? (q.c[0].state === "warn" ? 0.55 : 1) : 0); });
      Z.fans.forEach((F) => { F.on = q.c[1].on; F.bl.querySelectorAll("path").forEach((p) => { p.setAttribute("fill", col(q.c[1], "var(--c-fans)")); p.classList.toggle("warnpulse", q.c[1].state === "warn"); }); if (!motion() && !F.on) F.v = 0; });
      Z.acs.forEach((a) => a.setAttribute("fill", col(q.c[2], "var(--c-ac)")));
    });
    // zone cards
    const zc = el.querySelector("#twZones");
    if (zc.dataset.room !== R.id) {
      zc.dataset.room = R.id;
      zc.innerHTML = zs.map((q, z) => { const zn = S.ZONES[R.zoneIdx[z]], isHW = R.zoneIdx[z] === S.HW_ZONE;
        const rows = [["bulb", "Lights", zn.lights, 0, "--c-lights"], ["fan", "Fans", zn.fans, 1, "--c-fans"], ["snow", "AC", zn.acs, 2, "--c-ac"]].filter((x) => x[2]).map(([i, n, cnt, kk, c]) => `<div class="zrow" data-k="${kk}"><span style="color:var(${c})">${ic(i, "sm")}</span><div><div>${n} ×${cnt}</div><div class="tr" data-tip="Time with no presence vs this load's ${PN.CFG.loads[kk].grace_s / 60}-min grace"><b style="background:var(${c});width:0"></b></div></div><span class="sp"></span></div>`).join("");
        return `<div class="zc${isHW ? " hw" : ""}" data-z="${z}"><div class="zh"><b>${esc(zn.name)}</b>${isHW ? `<span class="st user" style="font-size:10px" data-tip="Where the prototype node would sit. Shows ESP32 data only while valid telemetry is arriving from a linked board.">prototype spot</span>` : ""}<div class="r"><span class="muted" style="display:inline-flex;gap:5px;align-items:center;font-weight:800">${ic("person", "sm")}<span class="pp num">0</span></span></div></div>
          <div class="win" data-tip="PIR window: the last 30 slots of 10 s (5 min). Cyan = motion seen.">${"<i></i>".repeat(30)}</div>
          <div style="display:flex;align-items:center;gap:10px;font-size:12.5px;font-weight:700;color:var(--text2)"><span data-tip="Occupancy estimate O = 1 − e^(−n/2), n = active slots">O <b class="oo num" style="color:var(--text)">0.00</b></span><span class="pres"></span></div>
          ${rows}
          ${R.type !== "corridor" ? `<div class="zact"><button class="iconbtn" type="button" data-a="add" data-tip="Add 10 people here for 45 min" aria-label="Add 10 people">${ic("personPlus", "sm")}</button><button class="iconbtn" type="button" data-a="empty" data-tip="Everyone leaves this zone for 45 min" aria-label="Empty zone">${ic("personOff", "sm")}</button><button class="iconbtn" type="button" data-a="reset" data-tip="Back to the timetable" aria-label="Back to timetable">${ic("reset", "sm")}</button></div>` : ""}</div>`; }).join("");
    }
    zs.forEach((q, z) => {
      const card = zc.querySelector(`[data-z="${z}"]`); if (!card) return;
      num(card.querySelector(".pp"), R.type === "corridor" ? (q.act ? 1 : 0) : q.people ?? 0);
      card.querySelectorAll(".win i").forEach((c, j) => c.classList.toggle("on", !!q.win[j]));
      card.querySelector(".oo").textContent = q.O.toFixed(2);
      card.querySelector(".pres").innerHTML = q.O >= 0.5 || q.act ? `<span class="st on">presence</span>` : `<span class="st off">empty ${fmtDur(q.tau[0])}</span>`;
      card.querySelectorAll(".zrow").forEach((row) => { const kk = +row.dataset.k, g = PN.CFG.loads[kk].grace_s; row.querySelector(".tr b").style.width = Math.min(100, (q.tau[kk] / g) * 100) + "%"; const pill = stPill(q.c[kk]); if (row._p !== pill) { if (row._p !== undefined) flash(row); row._p = pill; row.querySelector(".sp").innerHTML = pill; } });
    });
    // room log
    const evs = M.eventsUpTo(s, 40, R.zoneIdx), lk = evs.length ? evs[0].sl + ":" + evs.length : "0";
    if (lk !== TW.logKey) { TW.logKey = lk; const lab = { off: "switched off", on: "restored", warning: "30 s warning", cancel: "warning cancelled" }, icn = { off: "power", on: "check", warning: "warn", cancel: "pir" };
      el.querySelector("#twLog").innerHTML = evs.map((e) => `<li><span class="fi ${e.e}">${ic(icn[e.e], "sm")}</span><div class="ft">${esc(S.ZONES[e.zi].name)} · ${["lights", "fans", "AC"][e.k]} ${lab[e.e]}</div><time>${hhmm((e.sl * S.SLOT) / 60)}</time></li>`).join("") || `<li><span class="fi on">${ic("clock", "sm")}</span><div class="ft">No events yet today</div><time></time></li>`; }
  }
  el.querySelector("#twZones").addEventListener("click", (e) => { const b = e.target.closest("button[data-a]"); if (!b) return; const z = +b.closest("[data-z]").dataset.z; M.zoneOcc(TW.R.zoneIdx[z], b.dataset.a); M.data(); dsKey = ""; update(); });
  el.querySelector("#halfBtn").addEventListener("click", () => { M.scenarioHalf(st.room); M.data(); dsKey = ""; if (st.speed > 5) { st.speed = 5; syncSpeed(); } st.playing = true; syncPlay(); update(); });
  // ---- hardware link panel: state, readings, instructions, diagnostics ----
  let hwKey = "";
  function renderHw() {
    const L = st.live, body = el.querySelector("#hwBody"), h = hwStatus(), sup = M.serialSupport();
    el.querySelector("#hwSum").textContent = " · " + h.side.replace(/^ESP32: |^Hardware: /, "");
    const linked = L && ["connecting", "waiting", "receiving", "stale"].includes(L.state);
    // rebuild the static part only when the state changes; refresh the numbers in place
    const key = sup + "|" + h.key + "|" + (L ? L.profile + "|" + L.dry + "|" + !!L.L + "|" + L.restarts : "");
    if (key !== hwKey) {
      hwKey = key;
      const btn = sup !== "ok" ? "" : linked ? `<button class="btns" type="button" id="hwOff">${ic("power", "sm")}Disconnect</button>` : `<button class="btnp" type="button" id="hwOn">${ic("usb", "sm")}${L ? "Try again" : "Link ESP32"}</button>`;
      const supMsg = sup === "unsupported" ? "This browser has no Web Serial. Use Chrome or Edge on a laptop or desktop (not a phone, not Firefox or Safari)." : sup === "blocked" ? "USB access is blocked inside the published page. Download the HTML file and open it from your computer in Chrome or Edge." : "";
      body.innerHTML = `
        <div class="banner" style="margin-bottom:12px">${ic("info")}<span>Reads a NEST ESP32 over USB and shows it as <b>DKM-104 · Back</b>. Read-only: the page never sends commands and cannot switch anything. This link has not yet been tested with a real board; until valid data arrives, every device on this page is simulated.</span></div>
        <div class="hwst" id="hwSt"><i class="dot ${h.dot}"></i><span id="hwTitle">${esc(h.title)}</span><span class="sub" id="hwSub"></span><span style="margin-left:auto;display:flex;gap:8px">${btn}</span></div>
        ${supMsg ? `<p class="note" style="margin:10px 0 0">${esc(supMsg)}</p>` : ""}
        <p class="note" id="hwMsg" style="margin:10px 0 0"${st.liveMsg ? "" : " hidden"}></p>
        ${L && L.state !== "error" ? `<div class="hwgrid" style="margin-top:12px">
          <div class="hwk"><div class="eyebrow">Occupancy n / O</div><div class="v" id="hwNO">—</div></div>
          <div class="hwk"><div class="eyebrow">PIR 1 · PIR 2</div><div class="v" id="hwPir">—</div></div>
          <div class="hwk"><div class="eyebrow">Decision per channel</div><div class="v sm" id="hwCh">—</div></div>
          <div class="hwk"><div class="eyebrow">Room (DHT22)</div><div class="v" id="hwEnv">—</div></div>
          <div class="hwk"><div class="eyebrow">Firmware</div><div class="v sm" id="hwFw">—</div></div>
          <div class="hwk"><div class="eyebrow">Lines</div><div class="v sm" id="hwCnt">—</div></div>
        </div>` : ""}
        <div class="hwcols" style="margin-top:14px">
          <div><h4 style="margin:0 0 8px;font-size:14px">Connect</h4><ol class="steps">
            <li>Flash the node with the room profile; it stays dry-run (relays not driven): <code>arduino-cli compile --fqbn esp32:esp32:esp32 --build-property "compiler.cpp.extra_flags=-DPN_ROOM_PROFILE=1" firmware/nest_node</code>. Keep mains loads disconnected.</li>
            <li>Close the Arduino or PlatformIO serial monitor. Only one program can hold the port.</li>
            <li>Open this HTML file from your computer in <b>Chrome or Edge</b> on a laptop or desktop.</li>
            <li>Click <b>Link ESP32</b> and pick the board's port (often "CP210x", "USB-SERIAL CH340" or "USB JTAG/serial debug unit").</li>
            <li>Wait up to 10 s: the node prints one <code>L,…</code> line per 10 s slot at ${M.SER.BAUD} baud. Treat the link as working only after the status reads "Receiving valid telemetry" (two lines with an advancing node clock) and the readings change when you wave at a PIR.</li></ol>
            <p class="note" style="margin:8px 0 0">First time? Check the board in the Arduino Serial Monitor at ${M.SER.BAUD} baud: lines starting <code>L,</code> should appear every 10 s. Then close the monitor before linking here.</p></div>
          <div><h4 style="margin:0 0 8px;font-size:14px">If it does not work</h4><ol class="steps">
            <li><b>No port in the list:</b> use a data USB cable (some are charge-only), install the CP210x or CH340 driver, check the board is powered.</li>
            <li><b>Could not open the port:</b> another program has it open. Close it, or unplug and replug the board.</li>
            <li><b>Connected, no valid data after 15 s:</b> press EN/RST once (the node prints <code># profile=…</code> at boot). Check the firmware is the NEST node build.</li>
            <li><b>Garbled or invalid lines:</b> garbled text means a baud mismatch (the firmware uses ${M.SER.BAUD}). Invalid L lines mean the firmware and this page disagree on the format (17 fields expected).</li>
            <li><b>Data stale:</b> the board reset, lost USB power or stopped printing. Watch the restart count and the raw lines below.</li></ol></div>
        </div>
        <div class="banner danger" style="margin-top:14px">${ic("warn")}<span><b>Mains safety.</b> Keep the prototype on the 5 V fan. Lights and fans run on 230 V: a hobby relay board's 10 A marking is not an approval for fixed wiring. Switched circuits need rated contactors, MCB protection, a closed enclosure with the 230 V side separated from the low-voltage side, earthing, and installation and inspection by a qualified electrician (see docs/COMMISSIONING.md, section E). This page cannot switch anything and is not a safety review.</span></div>
        ${L ? `<details style="margin-top:12px"><summary class="muted" style="cursor:pointer;font-size:12.5px;font-weight:700">Raw serial lines (last ${M.SER.LOG_N})</summary><pre class="rawlog" id="hwLog" style="margin-top:8px"></pre></details>` : ""}`;
      const on = body.querySelector("#hwOn"), off = body.querySelector("#hwOff");
      if (on) on.addEventListener("click", () => { M.clearLiveError(); M.connectSerial(); });
      if (off) off.addEventListener("click", () => M.disconnectSerial());
    }
    // live text
    body.querySelector("#hwSub").textContent = h.sub;
    const msg = body.querySelector("#hwMsg"); if (msg) { msg.hidden = !st.liveMsg || !!L; msg.textContent = st.liveMsg || ""; }
    if (!L || L.state === "error") return;
    const q = L.L, chName = L.profile === "bench" ? ["CH1", "CH2", "CH3", "CH4"] : ["Lights", "Fans", "AC", "CH4"];
    const set = (id, v) => { const e = body.querySelector("#" + id); if (e) e.innerHTML = v; };
    set("hwNO", q ? `${q.n}/30 · O ${q.O.toFixed(2)}` : "—");
    set("hwPir", L.pir ? L.pir.join(" · ") : `<span class="muted" style="font-size:12.5px">no P line yet</span>`);
    set("hwCh", q ? q.s.slice(0, L.profile === "bench" ? 4 : 3).map((v, i) => `${chName[i]}: ${["on", "warning", "off"][v]}`).join("<br>") : "—");
    set("hwEnv", L.env ? (L.env.T !== null ? `${IN(L.env.T, 1)} °C · ${L.env.RH !== null ? IN(L.env.RH, 0) + " %" : "RH —"}` : `<span class="muted" style="font-size:12.5px">sensor not read</span>`) : `<span class="muted" style="font-size:12.5px">S line every 60 s</span>`);
    set("hwFw", `${L.profile ? "Profile: " + L.profile : "Profile: not seen"}${L.profile === "bench" ? ` <span style="color:var(--warn)">(channels differ from the room twin)</span>` : ""}<br>${L.dry === true ? "Dry run: relays not driven" : L.dry === false ? `<span style="color:var(--warn)">dry_run=0: relays are driven</span>` : "Dry run: unknown (sent at boot)"}${L.info ? "<br>" + esc(L.info) : ""}`);
    set("hwCnt", `${L.valid} valid · ${L.bad} invalid · ${L.garbled} garbled · ${L.other} other${L.restarts ? `<br><span style="color:var(--warn)">node restarted ${L.restarts}×</span>` : ""}${L.lastBad ? `<br><span style="color:var(--crit)">last invalid: ${esc(L.lastBad.why)}</span>` : ""}`);
    const log = body.querySelector("#hwLog"); if (log) log.innerHTML = L.log.map((x) => `<span class="${x.cls}">${esc(x.line)}</span>`).join("\n") || "(nothing yet)";
  }
  const openHw = () => { const d = el.querySelector("#hwDet"); d.open = true; d.scrollIntoView({ block: "start" }); };
  function update() {
    const s = M.slotNow();
    const now = performance.now();
    cells.forEach((c) => { const v = zoneVis(c.zi, s), warn = (v.l && v.l.state === "warn") || (v.f && v.f.state === "warn"), man = (v.l && v.l.manual) || (v.f && v.f.manual);
      c.cell.setAttribute("fill", rampColor(metricOf(c.zi, s))); c.cell.classList.toggle("warn", !!warn); c.cell.classList.toggle("man", !!man && !warn); c.cell.classList.toggle("hw", v.live); pulseTile(c, v, now); });
    rooms.forEach((x) => { if (x.ppl) x.ppl.textContent = x.r.zoneIdx.reduce((a, zi) => a + M.SIM.zones[zi].occ[s], 0); x.devs.forEach((d) => { const on = x.r.zoneIdx.some((zi) => [S.ZONES[zi].lights, S.ZONES[zi].fans, S.ZONES[zi].acs][d.k] && M.circ(zi, d.k, s).on); d.u.style.color = on ? ["var(--lamp)", "var(--c-fans)", "var(--c-ac)"][d.k] : "rgba(255,255,255,.22)"; }); });
    flb.querySelectorAll(".floorbtn").forEach((b) => { const f = S.FLOORS.find((x) => x.id === b.dataset.f); let p = 0, kw = 0; f.rooms.forEach((r) => r.zoneIdx.forEach((zi) => { if (r.type !== "corridor") p += M.SIM.zones[zi].occ[s]; kw += M.zoneKW(zi, s); })); num(b.querySelector(".fp"), p); b.querySelector(".fk").textContent = IN(kw, 1); b.querySelectorAll(".mini i").forEach((i) => (i.style.background = rampColor(zoneOccFrac(+i.dataset.zi, s)))); });
    // room card
    const r = M.ROOM[st.room], D = M.D, t = D.rooms[r.id], tb = D.tot(t, "before"), ta = D.tot(t, "after");
    let ppl = 0, kw = 0; r.zoneIdx.forEach((zi) => { ppl += M.SIM.zones[zi].occ[s]; kw += M.zoneKW(zi, s); });
    num(rcEl.querySelector("#rcP"), r.type === "corridor" ? r.zoneIdx.filter((zi) => M.SIM.zones[zi].act[s]).length : ppl);
    setRing(rcEl, r.type === "corridor" ? (r.zoneIdx.some((zi) => M.SIM.zones[zi].act[s]) ? 1 : 0) : ppl / Math.max(1, r.cap), ring.c);
    num(rcEl.querySelector("#rcKw"), kw, 2);
    [["l", 0, "lights"], ["f", 1, "fans"], ["a", 2, "acs"]].forEach(([c, kk, prop]) => { const d = rcEl.querySelector("#rcd-" + c); const zs = r.zoneIdx.filter((zi) => S.ZONES[zi][prop]); const on = zs.filter((zi) => M.circ(zi, kk, s).on).length; d.classList.toggle("on", on > 0); const b = d.querySelector(".on"); if (b) b.textContent = on; if (kk === 1) fanIcon(d.querySelector("svg"), on > 0); if (d.querySelector(".n") && zs.length) d.querySelector(".n").lastChild.nodeValue = "/" + zs.length; });
    const mx = Math.max(tb, ta, 1); rcEl.querySelector("#rcB").style.width = (100 * tb) / mx + "%"; rcEl.querySelector("#rcA").style.width = (100 * ta) / mx + "%";
    rcEl.querySelector("#rcBv").textContent = kwh(tb); rcEl.querySelector("#rcAv").textContent = kwh(ta); num(rcEl.querySelector("#rcS"), pct(ta, tb), 0);
    updateTwin(s);
  }
  buildPlan(); buildTwin();
  // fans spin up over ~0.6 s and coast down over ~1.5 s, following the circuit state
  return { update, onLive: renderHw, openHw, anim(dt) { if (!TW || !motion()) return; TW.zones.forEach((Z) => Z.fans.forEach((F) => { const tgt = F.on ? 0.55 : 0; F.v += (tgt - F.v) * Math.min(1, dt / (F.on ? 220 : 520)); if (F.v < 0.002 && !F.on) F.v = 0; if (F.v > 0) { F.a = (F.a + dt * F.v) % 360; F.bl.setAttribute("transform", `rotate(${F.a})`); } })); } };
};

/* ======================= ENERGY ======================= */
VIEWS.energy = (el) => {
  el.innerHTML = `
  <div class="card pad" style="display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;padding:12px 16px">
    <div class="chips" id="scopeChips">${[["all", "Block"], ...S.FLOORS.map((f) => [f.id, f.id === "G" ? "Ground" : "Floor " + f.id])].map(([k, l]) => `<button class="chip" type="button" data-s="${k}">${l}</button>`).join("")}</div>
    <div style="margin-left:auto;display:flex;gap:10px;align-items:center"><div class="seg" id="spanSeg"><button type="button" data-v="sofar">So far</button><button type="button" data-v="full">Full day</button></div><span class="simtag" data-tip="Estimated from simulated occupancy and assumed fixture wattages. Not meter readings.">estimated</span></div>
  </div>
  <div class="en-top">
    <div class="card vs hov"><div class="eyebrow" style="display:flex;gap:8px;align-items:center"><i style="width:10px;height:10px;border-radius:3px;background:var(--without);display:inline-block"></i>Without</div><div class="v"><span id="eB">0</span><small>kWh</small></div><div class="muted" style="font-size:12.5px;font-weight:700" id="eBn"></div><div class="bar3"><b id="eBb" style="background:var(--without);width:0"></b></div></div>
    <div class="card vs hov"><div class="eyebrow" style="display:flex;gap:8px;align-items:center"><i style="width:10px;height:10px;border-radius:3px;background:var(--with);display:inline-block"></i>With NEST</div><div class="v"><span id="eA">0</span><small>kWh</small></div><div class="muted" style="font-size:12.5px;font-weight:700">zone-by-zone control</div><div class="bar3"><b id="eAb" style="background:var(--with);width:0"></b></div></div>
    <div class="card saveCard hov" id="eRing"><div style="position:relative;width:104px;height:104px" id="eRingS"></div><div><div class="eyebrow">Saved</div><div class="num" style="font:700 28px/1.1 var(--f-body)"><span id="eS">0</span><small class="muted" style="font-size:14px"> kWh</small></div><div class="muted" style="font-size:12.5px;font-weight:700">controllable loads <b class="up" id="eC">0</b>%</div></div></div>
    <div class="card pad hov" style="display:flex;flex-direction:column;gap:14px;justify-content:center">
      <div style="display:flex;align-items:center;gap:12px"><span class="kpi"><span class="ico g" style="width:38px;height:38px">${ic("rupee")}</span></span><div><div class="num" style="font:800 24px/1 var(--f-body)">₹<span id="eR">0</span></div><div class="muted" style="font-size:12px;font-weight:700">cost avoided <button class="info" type="button" data-tip="At the assumed grid tariff (set under Sources). Not a bill.">${ic("info", "sm")}</button></div></div></div>
      <div style="display:flex;align-items:center;gap:12px"><span class="kpi"><span class="ico g" style="width:38px;height:38px">${ic("leaf")}</span></span><div><div class="num" style="font:800 24px/1 var(--f-body)"><span id="eCo">0</span><small class="muted" style="font-size:13px"> kg CO₂</small></div><div class="muted" style="font-size:12px;font-weight:700">avoided <button class="info" type="button" data-tip="Grid factor 0.727 kg CO₂/kWh (CEA CO₂ Baseline Database v20.0, FY 2023-24).">${ic("info", "sm")}</button></div></div></div>
    </div>
  </div>
  <section class="card"><div class="ch"><h2>Through the day</h2><div class="legend"><span><i class="ln" style="background:var(--without)"></i>Without</span><span><i class="ln" style="background:var(--with)"></i>With</span></div><div class="r"><span class="muted" style="font-size:12px" id="dpSub"></span></div></div><div style="padding:4px 14px 14px" id="eChart"></div></section>
  <div class="en-mid">
    <section class="card"><div class="ch"><h2>Where it goes</h2><div class="r"><div class="seg" id="euSeg"><button type="button" data-v="after">With</button><button type="button" data-v="before">Without</button></div></div></div><div class="donutwrap"><div id="donut"></div><div class="dleg" id="dleg"></div></div></section>
    <section class="card"><div class="ch"><h2 id="byT">By floor</h2><div class="legend"><span><i style="background:var(--without)"></i>Without</span><span><i style="background:var(--with)"></i>With</span></div><div class="r"><span class="muted" style="font-size:12px">saved %</span></div></div><div class="hb" id="byF"></div></section>
  </div>
  <details class="card more" style="border-top:1px solid var(--line)"><summary>${ic("doc", "sm")}Room-by-room table<svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body tw" id="rTable"></div></details>
  <details class="card more" style="border-top:1px solid var(--line)"><summary>${ic("clock", "sm")}Energy used while zones were empty<svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body"><div class="seg" id="heatSeg" style="margin-bottom:12px"><button type="button" data-v="before">Without</button><button type="button" data-v="after">With</button></div><div id="eHeat"></div><p class="note" style="margin-top:10px">Wh per hour for lights, fans and AC in zones with nobody in them. With zone control what remains is mostly grace and warning time, plus brief switch-ons when a PIR false-triggers at night (the node restores loads on any motion; the manual baseline does not model this).</p></div></details>
  <details class="card more" style="border-top:1px solid var(--line)"><summary>${ic("info", "sm")}How these numbers are made<svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body"><p class="note" id="method"></p></div></details>`;
  let heat = "before", eu = "after";
  const scopeObj = () => (st.scope === "all" ? M.D.bld : M.D.floors[st.scope]);
  const scopeRooms = () => S.ROOMS.filter((r) => st.scope === "all" || r.floor === st.scope);
  const sync = () => { el.querySelectorAll("#scopeChips .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === st.scope))); el.querySelectorAll("#spanSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === (st.energySpan === "full" ? "full" : "sofar")))); el.querySelectorAll("#euSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === eu))); el.querySelectorAll("#heatSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === heat))); };
  el.querySelector("#scopeChips").addEventListener("click", (e) => { const b = e.target.closest("[data-s]"); if (b) { st.scope = b.dataset.s; sync(); build(); } });
  el.querySelector("#spanSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { st.energySpan = b.dataset.v === "full" ? "full" : "sofar"; sync(); update(true); } });
  el.querySelector("#euSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { eu = b.dataset.v; sync(); buildDonut(); } });
  el.querySelector("#heatSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { heat = b.dataset.v; sync(); buildHeat(); } });
  const ring = ringSVG(104, 12, "var(--with)"); el.querySelector("#eRingS").innerHTML = ring.html + `<div style="position:absolute;inset:0;display:grid;place-items:center"><div class="num" style="font:800 22px var(--f-body)"><span id="eP">0</span><small class="muted" style="font-size:12px">%</small></div></div>`;
  let chart;
  const LBL = { lights: ["bulb", "Lighting"], fans: ["fan", "Fans"], ac: ["snow", "AC"], plugs: ["plug", "Plug loads"] };
  const CV = { lights: "--c-lights", fans: "--c-fans", ac: "--c-ac", plugs: "--c-plugs" };
  function buildDonut() {
    const o = scopeObj(), parts = S.CLS.map((c) => ({ name: LBL[c][1], color: CV[c], v: M.D.tot(o, eu, undefined, [c]) }));
    donut(el.querySelector("#donut"), parts, { label: "End-use split", unit: "kWh " + (eu === "after" ? "with" : "without"), fmt: (v) => kwh(v) + " kWh", center: parts.reduce((a, p) => a + p.v, 0) / 1000 });
    const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
    el.querySelector("#dleg").innerHTML = S.CLS.map((c, i) => { const b = M.D.tot(o, "before", undefined, [c]), a = M.D.tot(o, "after", undefined, [c]); return `<div class="row"><span style="color:var(${CV[c]})">${ic(LBL[c][0])}</span><span>${LBL[c][1]}</span><span class="kv">${kwh(parts[i].v)}</span><span class="pc">${c === "plugs" ? "—" : (c === "ac" && !st.A.allowCooling ? `<span data-tip="AC held under the deployed policy">held</span>` : `<span class="up">−${IN(pct(a, b), 0)}%</span>`)}</span></div>`; }).join("") + `<div class="muted" style="font-size:11.5px;font-weight:700">share of ${eu === "after" ? "with" : "without"} · ${IN((100 * parts[2].v) / tot, 0)} % is AC</div>`;
  }
  function buildBy() {
    const D = M.D, host = el.querySelector("#byF");
    let items;
    if (st.scope === "all") { el.querySelector("#byT").textContent = "By floor"; items = S.FLOORS.map((f) => ({ id: f.id, label: f.id === "G" ? "Ground" : "Floor " + f.id, b: D.tot(D.floors[f.id], "before"), a: D.tot(D.floors[f.id], "after"), click: () => { st.scope = f.id; sync(); build(); } })); }
    else { el.querySelector("#byT").textContent = "By room"; items = scopeRooms().filter((r) => r.type !== "corridor").map((r) => ({ id: r.id, label: short(r.id), b: D.tot(D.rooms[r.id], "before"), a: D.tot(D.rooms[r.id], "after"), name: r.name, click: () => { st.room = r.id; st.floor = r.floor; location.hash = "building"; } })).sort((x, y) => y.b - x.b); }
    const mx = Math.max(...items.map((x) => x.b), 1);
    host.innerHTML = items.map((x, i) => `<div class="row" style="cursor:pointer" data-i="${i}" data-tip="${esc((x.name ? x.name + " · " : "") + kwh(x.b) + " → " + kwh(x.a) + " kWh")}"><span>${esc(x.label)}</span><div class="bars"><b style="background:var(--without);width:0" data-w="${(100 * x.b) / mx}"></b><b style="background:var(--with);width:0" data-w="${(100 * x.a) / mx}"></b></div><span class="sv">−${IN(pct(x.a, x.b), 0)}%</span></div>`).join("");
    host.querySelectorAll(".row").forEach((r) => r.addEventListener("click", () => items[+r.dataset.i].click()));
    requestAnimationFrame(() => requestAnimationFrame(() => host.querySelectorAll("b[data-w]").forEach((b) => (b.style.width = b.dataset.w + "%"))));
  }
  function buildTable() {
    const D = M.D, rows = scopeRooms().map((r) => { const t = D.rooms[r.id], b = D.tot(t, "before"), a = D.tot(t, "after"); let wb = 0, wa = 0; for (let i = 0; i < S.NB; i++) { wb += t.waste.before[i]; wa += t.waste.after[i]; } return { r, b, a, saved: b - a, p: pct(a, b), wb, wa }; });
    const key = { room: (x) => x.r.id, before: (x) => x.b, after: (x) => x.a, saved: (x) => x.saved, p: (x) => x.p, wb: (x) => x.wb }[st.sortK] || ((x) => x.saved);
    rows.sort((x, y) => (key(x) > key(y) ? 1 : key(x) < key(y) ? -1 : 0) * st.sortD);
    const th = (k, l, n) => `<th class="sort ${n ? "n" : ""}" data-k="${k}" tabindex="0">${l}${st.sortK === k ? (st.sortD > 0 ? " ▲" : " ▼") : ""}</th>`;
    el.querySelector("#rTable").innerHTML = `<table><thead><tr>${th("room", "Room")}<th>Use</th>${th("before", "Without kWh", 1)}${th("after", "With kWh", 1)}${th("saved", "Saved kWh", 1)}${th("p", "Saved %", 1)}${th("wb", "Empty-zone kWh", 1)}</tr></thead><tbody>${rows.map((x) => `<tr class="click" data-r="${x.r.id}"><td><b>${short(x.r.id)}</b></td><td>${esc(x.r.name)}</td><td class="n">${kwh(x.b)}</td><td class="n">${kwh(x.a)}</td><td class="n">${kwh(x.saved)}</td><td class="n">${IN(x.p, 0)}</td><td class="n">${kwh(x.wb)} → ${kwh(x.wa)}</td></tr>`).join("")}</tbody></table>`;
    el.querySelectorAll("#rTable th.sort").forEach((t) => { const f = () => { if (st.sortK === t.dataset.k) st.sortD *= -1; else { st.sortK = t.dataset.k; st.sortD = -1; } buildTable(); }; t.addEventListener("click", f); t.addEventListener("keydown", (e) => { if (e.key === "Enter") f(); }); });
    el.querySelectorAll("#rTable tr.click").forEach((t) => t.addEventListener("click", () => { st.room = t.dataset.r; st.floor = M.ROOM[t.dataset.r].floor; location.hash = "building"; }));
  }
  function buildHeat() {
    const rs = scopeRooms(), per = 60 / S.BKT;
    const rows = rs.map((r) => ({ label: short(r.id), values: Array.from({ length: 24 }, (_, h) => { let t = 0; for (let i = h * per; i < (h + 1) * per; i++) t += M.D.rooms[r.id].waste[heat][i]; return t; }) }));
    const all = rs.flatMap((r) => Array.from({ length: 24 }, (_, h) => { let t = 0; for (let i = h * per; i < (h + 1) * per; i++) t += M.D.rooms[r.id].waste.before[i]; return t; }));
    heatGrid(el.querySelector("#eHeat"), { rows, cols: 24, max: Math.max(1, ...all), colLabel: (c) => String(c).padStart(2, "0") + ":00", what: "Used while empty", fmt: (v) => IN(v, 0) + " Wh", label: "Energy in empty zones by room and hour", ch: 15, color: (k) => (k <= 0 ? "rgba(255,255,255,.035)" : `rgba(217,119,63,${0.15 + 0.85 * Math.min(1, k)})`) });
  }
  function build() {
    M.data(); const o = scopeObj();
    el.querySelector("#dpSub").textContent = `${st.scope === "all" ? "DKM block" : M.FLOOR_NAME[st.scope]} · kW · ${S.DAYS[st.day]}`;
    chart = tsChart(el.querySelector("#eChart"), { height: 280, unit: "kW", label: "Demand with and without", series: [{ name: "Without", color: "--without", values: M.D.toKW(M.D.series(o, "before")), width: 1.8 }, { name: "With", color: "--with", values: M.D.toKW(M.D.series(o, "after")), area: true }], onSeek: (m) => { st.min = m; tick(true); }, extraTip: (i) => { const b = M.D.series(o, "before")[i], a = M.D.series(o, "after")[i]; return `<div class="row" style="margin-top:3px"><span>Saved</span><span>${IN(b - a, 0)} Wh</span></div>`; } });
    buildDonut(); buildBy(); buildTable(); buildHeat();
    el.querySelector("#method").innerHTML = `Same simulated occupancy in both columns; only the switching differs. <b>Without</b> = ${M.baseName()}${st.A.baseline === "manual" ? " (room switched as a whole: on 5 min before use, off 10 min after, gaps under 60 min left on, lunch gap left on with p = " + st.A.p_lunch_on + ", room left on until 18:30 with p = " + st.A.p_left_on + ")" : " (one room-level sensor, 15-min timeout)"}. <b>With</b> = one NEST node per zone using the firmware decision logic. Fixture power: light ${st.A.W_light} W, fan ${st.A.W_fan} W, AC ${st.A.W_ac} W at ${Math.round(st.A.ac_duty * 100)} % duty, PC ${st.A.W_pc} W. AC is ${st.A.allowCooling ? "switched off by the node in this scenario, which assumes a validated thermal model" : "held (left to users) as in the deployed firmware"}. Plug loads are not switched by the node.`;
    update(true);
  }
  function update(force) {
    const o = scopeObj(), b = M.bktNow(), sofar = st.energySpan !== "full", upto = sofar ? b + 1 : undefined;
    const bv = M.D.tot(o, "before", upto), av = M.D.tot(o, "after", upto), ctlB = M.D.tot(o, "before", upto, ["lights", "fans", "ac"]), ctlA = M.D.tot(o, "after", upto, ["lights", "fans", "ac"]);
    num(el.querySelector("#eB"), bv / 1000, 1); num(el.querySelector("#eA"), av / 1000, 1); num(el.querySelector("#eS"), (bv - av) / 1000, 1);
    num(el.querySelector("#eP"), pct(av, bv), 1); el.querySelector("#eC").textContent = IN(pct(ctlA, ctlB), 1);
    setRing(el.querySelector("#eRingS"), pct(av, bv) / 100, ring.c);
    el.querySelector("#eBn").textContent = M.baseName();
    const mx = Math.max(bv, av, 1); el.querySelector("#eBb").style.width = (100 * bv) / mx + "%"; el.querySelector("#eAb").style.width = (100 * av) / mx + "%";
    num(el.querySelector("#eR"), ((bv - av) / 1000) * st.A.tariff_grid, 0); num(el.querySelector("#eCo"), ((bv - av) / 1000) * st.A.ef_grid, 1);
    if (chart && chart.api) chart.api.setNow(st.min);
    void force;
  }
  sync(); build();
  return { update };
};

/* ======================= SOURCES ======================= */
VIEWS.sources = (el) => {
  el.innerHTML = `
  <section class="card flow"><div class="ch"><h2>Energy flow · right now</h2><div class="r"><span class="muted" style="font-size:12px">calculated, not metered</span><span class="simtag" data-tip="Rooftop PV size, sky clarity, the outage and tariffs are assumptions. Demand is the simulated block with zone control. Line width and dot speed follow the calculated kW; nothing here is a meter reading.">assumed supply</span></div></div><div style="padding:6px 10px 14px" id="flow"></div></section>
  <div class="src" id="srcCards"></div>
  <section class="card"><div class="ch"><h2>Supply through the day</h2><div class="legend"><span><i style="background:var(--c-grid)"></i>Grid</span><span><i style="background:var(--c-pv)"></i>Solar used</span><span><i style="background:var(--c-dg)"></i>DG</span><span><i class="ln" style="background:var(--text2)"></i>Solar available</span></div></div><div style="padding:4px 14px 14px" id="supChart"></div></section>
  <details class="card more"><summary>${ic("controls", "sm")}Supply assumptions<span class="muted" style="font-weight:600;font-size:12px">· saved in this browser</span><svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body">
    <form class="form" id="supForm">
      <label>Rooftop PV (kWp)<input class="inp" type="number" id="a_pv" min="0" max="500" step="1"></label>
      <label>Sky clarity (0–1)<input class="inp" type="number" id="a_cloud" min="0" max="1" step="0.05"></label>
      <label>Outage start<input class="inp" type="text" id="a_os" placeholder="15:00"></label>
      <label>Outage length (min)<input class="inp" type="number" id="a_ol" min="0" max="600" step="5"></label>
      <label>Grid tariff (₹/kWh)<input class="inp" type="number" id="a_tg" min="0" step="0.1"></label>
      <label>DG cost (₹/kWh)<input class="inp" type="number" id="a_td" min="0" step="0.5"></label>
      <label>Grid CO₂ (kg/kWh)<input class="inp" type="number" id="a_eg" min="0" step="0.001"></label>
      <label>DG CO₂ (kg/kWh)<input class="inp" type="number" id="a_ed" min="0" step="0.01"></label>
      <label>&nbsp;<button class="btnp" type="submit">Apply</button></label>
    </form><p class="note" style="margin-top:12px">Grid factor 0.727 kg CO₂/kWh is the CEA CO₂ Baseline Database v20.0 (FY 2023-24) weighted average used in the paper. PV size, tariffs and DG figures are placeholders, not the campus's figures.</p></div></details>`;
  const A = st.A;
  const fill = () => { $("a_pv").value = A.pv_kwp; $("a_cloud").value = A.pv_cloud; $("a_os").value = hhmm(A.outage_start_min); $("a_ol").value = A.outage_len_min; $("a_tg").value = A.tariff_grid; $("a_td").value = A.tariff_dg; $("a_eg").value = A.ef_grid; $("a_ed").value = A.ef_dg; };
  fill();
  el.querySelector("#supForm").addEventListener("submit", (e) => {
    e.preventDefault(); const n = (id, d) => { const v = parseFloat($(id).value); return isFinite(v) && v >= 0 ? v : d; }; const t = /^(\d{1,2}):(\d{2})$/.exec($("a_os").value.trim());
    Object.assign(A, { pv_kwp: n("a_pv", A.pv_kwp), pv_cloud: Math.min(1, n("a_cloud", A.pv_cloud)), outage_start_min: t ? Math.min(1439, +t[1] * 60 + +t[2]) : A.outage_start_min, outage_len_min: n("a_ol", A.outage_len_min), tariff_grid: n("a_tg", A.tariff_grid), tariff_dg: n("a_td", A.tariff_dg), ef_grid: n("a_eg", A.ef_grid), ef_dg: n("a_ed", A.ef_dg) });
    M.saveA(); fill(); build();
  });
  // ---- flow diagram ----
  const W = 1000, H = 430, svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Energy flow from grid, solar and DG to the block and its loads" }, el.querySelector("#flow"));
  const SRC = [{ id: "pv", name: "Rooftop solar", icon: "sun", color: "--c-pv", y: 95 }, { id: "grid", name: "Grid", icon: "pylon", color: "--c-grid", y: 215 }, { id: "dg", name: "DG set", icon: "dg", color: "--c-dg", y: 335 }];
  const USE = [{ id: "lights", name: "Lights", icon: "bulb", y: 70 }, { id: "fans", name: "Fans", icon: "fan", y: 165 }, { id: "ac", name: "AC", icon: "snow", y: 260 }, { id: "plugs", name: "Plug loads", icon: "plug", y: 355 }];
  const hub = { x: 500, y: 215 }, sx = 170, ux = 830;
  const links = [];
  const mkPath = (x0, y0, x1, y1) => `M${x0} ${y0} C${(x0 + x1) / 2} ${y0} ${(x0 + x1) / 2} ${y1} ${x1} ${y1}`;
  const pathG = sv("g", {}, svg), partG = sv("g", { "pointer-events": "none" }, svg), nodeG = sv("g", {}, svg);
  const UCOL = { lights: "--c-lights", fans: "--c-fans", ac: "--c-ac", plugs: "--c-plugs" };
  SRC.forEach((s) => { const p = sv("path", { d: mkPath(sx + 44, s.y, hub.x - 80, hub.y + (s.y - hub.y) * 0.3), class: "flowpath", stroke: `var(${s.color})`, "stroke-opacity": 0.25 }, pathG); links.push({ kind: "src", id: s.id, p, color: s.color, len: p.getTotalLength(), parts: [] }); });
  USE.forEach((u) => { const p = sv("path", { d: mkPath(hub.x + 80, hub.y + (u.y - hub.y) * 0.3, ux - 40, u.y), class: "flowpath", stroke: `var(${UCOL[u.id]})`, "stroke-opacity": 0.25 }, pathG); links.push({ kind: "use", id: u.id, p, color: UCOL[u.id], len: p.getTotalLength(), parts: [] }); });
  const node = (x, y, r, icon, color, name, side) => { const g = sv("g", { transform: `translate(${x} ${y})` }, nodeG); sv("circle", { r, fill: "var(--card2)", stroke: `var(${color})`, "stroke-width": 2, "stroke-opacity": 0.7 }, g); useIcon(g, icon, -14, -14, 28, { style: `color:var(${color === "--text3" ? "--text2" : color})` }); const tx = side * (r + 14), an = side < 0 ? "end" : "start"; const t = sv("text", { x: tx, y: -3, "text-anchor": an, style: "font:700 12.5px var(--f-body);fill:var(--text2)" }, g); t.textContent = name; const v = sv("text", { x: tx, y: 16, "text-anchor": an, style: "font:800 16px var(--f-body);fill:var(--text)" }, g); return { g, v }; };
  const srcN = SRC.map((s) => ({ ...s, ...node(sx, s.y, 40, s.icon, s.color, s.name, -1) }));
  const useN = USE.map((u) => ({ ...u, ...node(ux, u.y, 30, u.icon, "--text3", u.name, 1) }));
  const hg = sv("g", { transform: `translate(${hub.x} ${hub.y})` }, nodeG);
  sv("circle", { r: 70, fill: "var(--card2)", stroke: "var(--accent)", "stroke-width": 2 }, hg);
  sv("text", { y: -24, "text-anchor": "middle", style: "font:800 11px var(--f-body);letter-spacing:.14em;fill:var(--text3)" }, hg).textContent = "DKM BLOCK";
  const hubRing = sv("circle", { r: 70, fill: "none", stroke: "var(--accent)", "stroke-width": 2, class: "hubring" }, hg);
  const hubV = sv("text", { y: 12, "text-anchor": "middle", style: "font:700 28px var(--f-body);fill:var(--text)" }, hg);
  const hubD = sv("text", { y: 54, "text-anchor": "middle", class: "hubdelta" }, hg);
  sv("text", { y: 32, "text-anchor": "middle", style: "font:700 12px var(--f-body);fill:var(--text3)" }, hg).textContent = "kW now";
  const outageT = sv("text", { x: sx, y: 418, "text-anchor": "middle", style: "font:800 11px var(--f-body);letter-spacing:.1em;fill:var(--warn)" }, svg);
  let flows = {}, lastKw = null, lastBkt = -1;
  function setFlows() {
    const SUP = M.SUP, b = M.bktNow(), s = M.slotNow(), snap = M.snapshot(s);
    flows = { pv: SUP.pv[b], grid: SUP.grid[b], dg: SUP.dg[b], lights: snap.cls.lights.kw, fans: snap.cls.fans.kw, ac: snap.cls.ac.kw, plugs: snap.cls.plugs.kw };
    const mx = Math.max(10, ...M.D.kw.after);
    // line width is proportional to kW; dashed = nothing flowing
    links.forEach((L) => { const v = flows[L.id] || 0; L.v = v; L.p.style.strokeWidth = v > 0.05 ? 2 + (16 * v) / mx : 1.5; L.p.style.strokeOpacity = v > 0.05 ? 0.42 : 0.14; L.p.setAttribute("stroke-dasharray", v > 0.05 ? "none" : "4 6"); });
    // when demand drops (a load switched off) or rises, show the change at the hub for a moment
    if (lastKw !== null && b !== lastBkt && Math.abs(snap.kw - lastKw) >= 0.15) { const dn = snap.kw < lastKw; hubD.textContent = `${dn ? "▼" : "▲"} ${IN(Math.abs(snap.kw - lastKw), 1)} kW`; hubD.setAttribute("class", "hubdelta " + (dn ? "dn" : "up")); void hubD.getBoundingClientRect(); hubD.classList.add("show"); if (dn) flash(hubRing); }
    if (b !== lastBkt) { lastKw = snap.kw; lastBkt = b; }
    srcN.forEach((n) => num(n.v, flows[n.id], 1, (x) => IN(x, 1) + " kW")); useN.forEach((n) => num(n.v, flows[n.id], 1, (x) => IN(x, 1) + " kW"));
    num(hubV, snap.kw, 1);
    const out = st.day < 6 && st.A.outage_len_min > 0 && st.min >= st.A.outage_start_min && st.min < st.A.outage_start_min + st.A.outage_len_min;
    outageT.textContent = out ? "GRID OUTAGE · DG RUNNING" : "";
  }
  // ---- cards + chart ----
  let chart;
  function build() {
    M.data(); const SUP = M.SUP, e = (arr) => arr.reduce((a, v) => a + v, 0) * (S.BKT / 60);
    const g = e(SUP.grid), p = e(SUP.pv), d = e(SUP.dg), x = e(SUP.exp), L = g + p + d || 1;
    el.querySelector("#srcCards").innerHTML = [["pv", "sun", "Rooftop solar", "--c-pv", p, `${IN((100 * p) / L, 0)} % of demand`, `${IN(x, 1)} kWh surplus`, `${A.pv_kwp} kWp assumed`], ["grid", "pylon", "Grid · BESCOM", "--c-grid", g, `${IN((100 * g) / L, 0)} % of demand`, `₹${IN(g * A.tariff_grid, 0)} est.`, `${IN(g * A.ef_grid, 0)} kg CO₂`], ["dg", "dg", "DG set", "--c-dg", d, d > 0 ? `${A.outage_len_min}-min outage` : "no outage today", `₹${IN(d * A.tariff_dg, 0)} est.`, `${IN(d * A.ef_dg, 0)} kg CO₂`]]
      .map(([id, i, n, c, v, a, b2, c2]) => `<div class="card srcc hov"><div class="hd"><span class="si" style="background:color-mix(in srgb,var(${c}) 16%,transparent);color:var(${c})">${ic(i, "lg")}</span><div><div style="font-weight:800">${n}</div><div class="muted" style="font-size:12px;font-weight:700">today</div></div><span class="simtag mini" style="margin-left:auto">assumed</span></div><div class="v"><span class="sn" data-v="${v}">0</span><small>kWh</small></div><div class="sub"><span><b>${a}</b></span><span>${b2}</span><span>${c2}</span></div></div>`).join("");
    el.querySelectorAll("#srcCards .sn").forEach((n) => num(n, +n.dataset.v, 1));
    const pvAvail = Float64Array.from(SUP.pv, (v, i) => v + SUP.exp[i]);
    chart = tsChart(el.querySelector("#supChart"), { height: 250, unit: "kW", stacked: true, label: "Supply by source", band: st.day < 6 && A.outage_len_min > 0 ? [{ from: A.outage_start_min, to: A.outage_start_min + A.outage_len_min }] : null, onSeek: (m) => { st.min = m; tick(true); },
      series: [{ name: "Grid", color: "--c-grid", values: SUP.grid }, { name: "Solar used", color: "--c-pv", values: SUP.pv }, { name: "DG", color: "--c-dg", values: SUP.dg }, { name: "Solar available", color: "--text2", values: pvAvail, overlay: true, dash: true, width: 1.4 }] });
    update();
  }
  function update() { setFlows(); if (chart && chart.api) chart.api.setNow(st.min); }
  // dots along each line: count and speed follow the calculated kW, capped at 6 per line (42 total)
  function anim(dt) {
    if (!motion()) { links.forEach((L) => { while (L.parts.length) L.parts.pop().c.remove(); }); return; }
    links.forEach((L) => {
      const want = L.v > 0.05 ? Math.min(6, 1 + Math.round(L.v / 4)) : 0;
      while (L.parts.length < want) { const c = sv("circle", { r: 3, fill: `var(${L.color})` }, partG); L.parts.push({ c, o: Math.random() }); }
      while (L.parts.length > want) L.parts.pop().c.remove();
      const speed = (0.16 + Math.min(0.3, L.v / 90)) * (dt / 1000);
      L.parts.forEach((q) => { q.o = (q.o + speed) % 1; const pt = L.p.getPointAtLength(q.o * L.len); q.c.setAttribute("cx", pt.x.toFixed(1)); q.c.setAttribute("cy", pt.y.toFixed(1)); q.c.setAttribute("opacity", Math.sin(q.o * Math.PI).toFixed(2)); });
    });
  }
  build();
  return { update, anim };
};

/* ======================= CONTROLS ======================= */
VIEWS.controls = (el) => {
  el.innerHTML = `
  <div class="banner">${ic("warn")}<span><b>Simulated controls.</b> Overrides change the simulated building only; no hardware is switched and nothing is sent to an ESP32.</span><button class="info" type="button" style="margin-left:auto" data-tip="The prototype firmware does not yet accept remote commands. A serial or Wi-Fi override command is the planned next step. Overrides last from the current clock time to the end of the day.">${ic("info", "sm")}</button></div>
  <section class="card"><div class="ctlbar">
    <div class="chips" id="cfChips">${S.FLOORS.map((f) => `<button class="chip" type="button" data-f="${f.id}">${f.id === "G" ? "Ground" : "Floor " + f.id}</button>`).join("")}</div>
    <button class="toggle" type="button" role="switch" id="onlyW" aria-checked="false"><span class="tk"></span>Idle-on only</button>
    <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btns" type="button" data-bulk="auto" data-tip="Return every circuit on this floor to node control">${ic("reset", "sm")}All auto</button>
      <button class="btns danger" type="button" data-bulk="lightsoff" data-tip="Turn off lights in every empty zone on this floor">${ic("bulb", "sm")}Lights off · empty</button>
      <button class="btns danger" type="button" data-bulk="alloff" data-tip="Force every circuit on this floor off until the end of the day">${ic("power", "sm")}All off</button>
    </div></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));border-top:1px solid var(--line)">
      ${[["cOn", "On now", "power"], ["cMan", "Manual overrides", "controls"], ["cWaste", "Idle-on", "warn"], ["cKw", "Floor demand", "energy"]].map(([id, l, i]) => `<div class="kpi" style="border-right:1px solid var(--line)"><div class="top"><span class="ico ${i === "warn" ? "w" : ""}" style="width:30px;height:30px">${ic(i, "sm")}</span><span class="lab">${l}</span></div><div class="v num" style="font-size:28px"><span id="${id}">0</span><small id="${id}u"></small></div></div>`).join("")}
    </div></section>
  <div id="rooms" class="g"></div>
  <details class="card more"><summary>${ic("clock", "sm")}Override log<span class="muted" id="logN" style="font-weight:600;font-size:12px"></span><svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body"><ul class="ovlog" id="ovlog"></ul></div></details>`;
  const syncF = () => el.querySelectorAll("#cfChips .chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.f === st.ctlFloor)));
  el.querySelector("#cfChips").addEventListener("click", (e) => { const b = e.target.closest("[data-f]"); if (b) { st.ctlFloor = b.dataset.f; syncF(); sig = ""; update(); } });
  const ow = el.querySelector("#onlyW"); ow.setAttribute("aria-checked", String(st.ctlOnlyWaste));
  ow.addEventListener("click", () => { st.ctlOnlyWaste = !st.ctlOnlyWaste; ow.setAttribute("aria-checked", String(st.ctlOnlyWaste)); sig = ""; update(); });
  el.querySelectorAll("[data-bulk]").forEach((b) => b.addEventListener("click", () => { M.bulk(st.ctlFloor, b.dataset.bulk); M.data(); sig = ""; update(); }));
  el.querySelector("#rooms").addEventListener("click", (e) => { const b = e.target.closest("button[data-zi]"); if (!b) return; M.setMode(+b.dataset.zi, +b.dataset.k, b.dataset.mode); M.data(); update(); });
  syncF();
  let sig = "";
  const DEV = [["l", "bulb", "Lights", "lights"], ["f", "fan", "Fans", "fans"], ["a", "snow", "AC", "acs"]];
  function list(s) {
    const f = S.FLOORS.find((x) => x.id === st.ctlFloor), out = [];
    f.rooms.forEach((r) => { const items = []; r.zoneIdx.forEach((zi) => { const zn = S.ZONES[zi], empty = M.SIM.zones[zi].occ[s] === 0 && r.type !== "corridor";
      DEV.forEach(([c, i, n, prop], k) => { if (!zn[prop]) return; if (st.ctlOnlyWaste && !(empty && M.circ(zi, k, s).on)) return; items.push({ zi, k, c, i, n, cnt: zn[prop] }); });
      if (zn.pcs && M.PLUG_TYPES.has(r.type) && !st.ctlOnlyWaste) items.push({ zi, k: 3, c: "p", i: "plug", n: "Plug loads", cnt: zn.pcs }); });
      if (items.length) out.push({ r, items }); });
    return out;
  }
  function render(L) {
    el.querySelector("#rooms").innerHTML = L.map(({ r, items }) => `<section class="roomgrp"><header><b>${short(r.id)}</b><span>${esc(r.name)}</span><span>${ic("person", "sm")}<b class="rp" data-r="${r.id}" style="color:var(--text)">0</b></span><span>${ic("energy", "sm")}<b class="rk" data-r="${r.id}" style="color:var(--text)">0</b> kW</span></header><div class="devgrid">${items.map((it) => {
      const zn = S.ZONES[it.zi], w = S.zoneWatts(zn, st.A), watts = [w.lights, w.fans, w.ac, w.plugs][it.k];
      return `<div class="card dc hov" data-zi="${it.zi}" data-k="${it.k}"><div class="dt"><span class="di ${it.c}">${ic(it.i, "lg")}</span><div style="min-width:0"><div class="nm">${it.n}</div><div class="meta">${esc(zn.name)} · ×${it.cnt} · ${watts >= 1000 ? IN(watts / 1000, 2) + " kW" : IN(watts, 0) + " W"}</div></div><span class="simtag mini" style="margin-left:auto">sim</span></div>
        <div class="bt"><span class="stp"></span>${it.k === 3 ? `<span class="muted" style="font-size:11.5px;font-weight:700" data-tip="Lab PCs and office equipment are outside the node's control in this design">not node-controlled</span>` : `<div class="seg" role="group" aria-label="${esc(r.id + " " + zn.name + " " + it.n)} mode">${["auto", "on", "off"].map((m) => `<button type="button" data-zi="${it.zi}" data-k="${it.k}" data-mode="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join("")}</div>`}</div>
        <div class="meta occ"></div></div>`; }).join("")}</div></section>`).join("") || `<div class="card pad" style="text-align:center;color:var(--text2)">${ic("check", "lg")}<div style="margin-top:8px;font-weight:700">Nothing is on in an empty zone on this floor.</div></div>`;
  }
  function update() {
    const s = M.slotNow(), L = list(s), ns = st.ctlFloor + "|" + st.ctlOnlyWaste + "|" + L.map((x) => x.r.id + ":" + x.items.map((i) => i.zi + "." + i.k).join(",")).join(";");
    if (ns !== sig) { sig = ns; render(L); }
    let on = 0, n = 0, man = 0, wst = 0, kw = 0; const f = S.FLOORS.find((x) => x.id === st.ctlFloor);
    f.rooms.forEach((r) => r.zoneIdx.forEach((zi) => { kw += M.zoneKW(zi, s); DEV.forEach(([, , , prop], k) => { if (!S.ZONES[zi][prop]) return; n++; const c = M.circ(zi, k, s); if (c.on) on++; if (c.manual) man++; if (c.on && r.type !== "corridor" && M.SIM.zones[zi].occ[s] === 0) wst++; }); }));
    num($("cOn"), on); $("cOnu").textContent = ` / ${n}`; num($("cMan"), man); num($("cWaste"), wst); num($("cKw"), kw, 1); $("cKwu").textContent = " kW";
    el.querySelectorAll(".dc").forEach((card) => {
      const zi = +card.dataset.zi, k = +card.dataset.k, z = M.SIM.zones[zi];
      let c; if (k === 3) { const p = M.plugKW(zi, s); c = { on: p > 0, state: p > 0 ? "on" : "off" }; } else c = M.circ(zi, k, s);
      const sig2 = c.on + ":" + c.state + ":" + !!c.manual; if (card._s !== undefined && card._s !== sig2) flash(card); card._s = sig2;
      card.classList.toggle("on", c.on); card.classList.toggle("warnc", c.state === "warn");
      if (k === 1) fanIcon(card.querySelector(".di svg"), c.on);
      card.querySelector(".stp").innerHTML = k === 3 ? (c.on ? `<span class="st on">On</span>` : `<span class="st off">Off</span>`) : stPill(c);
      if (k !== 3) { const mode = M.modeOf(zi, k); card.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode))); }
      card.querySelector(".occ").innerHTML = S.ZONES[zi].room.type === "corridor" ? (z.act[s] ? "movement" : "clear") : z.occ[s] ? `${z.occ[s]} people in zone` : `<span style="color:var(--warn)">zone empty</span>`;
    });
    el.querySelectorAll(".rp").forEach((b) => { const r = M.ROOM[b.dataset.r]; b.textContent = r.zoneIdx.reduce((a, zi) => a + M.SIM.zones[zi].occ[s], 0); });
    el.querySelectorAll(".rk").forEach((b) => { const r = M.ROOM[b.dataset.r]; b.textContent = IN(r.zoneIdx.reduce((a, zi) => a + M.zoneKW(zi, s), 0), 2); });
    el.querySelector("#logN").textContent = st.ovrLog.length ? `· ${st.ovrLog.length}` : "";
    el.querySelector("#ovlog").innerHTML = st.ovrLog.map((x) => `<li><time>${x.t}</time><span>${esc(x.what)}</span></li>`).join("") || `<li><time>—</time><span>No overrides yet</span></li>`;
  }
  return { update };
};

/* ======================= INSIGHTS ======================= */
VIEWS.insights = (el) => {
  el.innerHTML = `
  <div class="card pad" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:14px 18px"><div><div class="eyebrow">This week · Mon–Sun</div><div style="font:600 18px var(--f-display);margin-top:4px">Simulated week vs ${esc(M.baseName())}</div></div><span class="simtag" style="margin-left:auto">simulated</span></div>
  <div id="insBody" class="g"><div class="card pad"><div class="eyebrow" id="insStep">Simulating the week…</div><div class="progress" style="margin-top:10px"><b id="insProg" style="width:0"></b></div></div><div class="in-top">${"<div class='skel'></div>".repeat(4)}</div><div class="in-mid"><div class="skel" style="min-height:280px"></div><div class="skel" style="min-height:280px"></div></div></div>
  <details class="card more printable" id="repCard"><summary>${ic("doc", "sm")}Create a report<span class="muted" style="font-weight:600;font-size:12px">· day or week, block, floor or room · CSV export</span><svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body">
    <form class="form noprint" id="rf" style="margin-bottom:16px">
      <label>Period<select class="sel" id="rp"><option value="day">Selected day</option><option value="week">Full week</option></select></label>
      <label>Scope<select class="sel" id="rs"><option value="all">DKM block</option>${S.FLOORS.map((f) => `<option value="f:${f.id}">${f.name}</option>`).join("")}${S.ROOMS.filter((r) => r.type !== "corridor").map((r) => `<option value="r:${r.id}">${short(r.id)} · ${esc(r.name)}</option>`).join("")}</select></label>
      <label>Compared with<select class="sel" id="rb"><option value="manual">Manual switching</option><option value="timeout">15-min timeout sensor</option></select></label>
      <label>Prepared by<input class="inp" type="text" id="rby" placeholder="Team NEST"></label>
      <label>&nbsp;<button class="btnp" type="submit">${ic("doc", "sm")}Generate</button></label>
    </form><div id="repOut" class="paperhost"></div></div></details>`;
  $("rb").value = st.A.baseline;
  let alive = true;
  (async () => {
    const rep = await M.computeReport({ period: "week", scope: "all", base: st.A.baseline }, (f, d) => { if (!alive) return; const p = $("insProg"); if (p) p.style.width = 100 * f + "%"; const t = $("insStep"); if (t && d) t.textContent = "Simulating " + d + "…"; });
    if (alive) renderIns(rep);
  })();
  function renderIns(r) {
    const body = el.querySelector("#insBody"), A = r.A;
    const bestCls = ["lights", "fans", "ac"].map((c) => ({ c, p: pct(r.cls.after[c], r.cls.before[c]), kwh: (r.cls.before[c] - r.cls.after[c]) / 1000 })).sort((a, b) => b.kwh - a.kwh)[0];
    const topRoom = r.rows.filter((x) => x.r.type !== "corridor")[0];
    const acShare = (100 * r.cls.after.ac) / (r.TA || 1);
    const wasteB = r.rows.reduce((a, x) => a + x.wb, 0), wasteA = r.rows.reduce((a, x) => a + x.wa, 0);
    body.innerHTML = `
      <div class="in-top">
        ${[["Saved this week", "leaf", "g", r.saved / 1000, 0, "kWh", `${IN(pct(r.TA, r.TB), 1)} % of all load`], ["Controllable loads", "trend", "g", pct(r.ctlA, r.ctlB), 1, "%", "lights + fans + AC"], ["Cost avoided", "rupee", "", (r.saved / 1000) * A.tariff_grid, 0, "₹", `at ₹${IN(A.tariff_grid, 2)}/kWh assumed`], ["CO₂ avoided", "leaf", "", (r.saved / 1000) * A.ef_grid, 0, "kg", `${A.ef_grid} kg/kWh grid factor`]].map(([l, i, c, v, d, u, sub]) => `<div class="card kpi hov"><div class="top"><span class="ico ${c}">${ic(i)}</span><span class="lab">${l}</span><span class="tag simtag mini">sim</span></div><div class="v num">${u === "₹" ? "₹" : ""}<span class="cu" data-v="${v}" data-d="${d}">0</span>${u !== "₹" ? `<small>${u}</small>` : ""}</div><div class="d">${sub}</div></div>`).join("")}
      </div>
      <div class="in-mid">
        <section class="card"><div class="ch"><h2>Daily energy</h2><div class="legend"><span><i style="background:var(--without)"></i>Without</span><span><i style="background:var(--with)"></i>With</span></div></div><div style="padding:4px 14px 14px" id="wk"></div></section>
        <section class="card"><div class="ch"><h2>When people are in</h2><div class="r">${rampHTML("0", "peak")}</div></div><div style="padding:8px 14px 14px" id="occH"></div></section>
      </div>
      <div class="finds">
        <div class="card find hov"><span class="fic">${ic(bestCls.c === "lights" ? "bulb" : bestCls.c === "fans" ? "fan" : "snow")}</span><div class="fv">−${IN(bestCls.p, 0)} %</div><div class="ft">${{ lights: "Lighting", fans: "Fans", ac: "AC" }[bestCls.c]} saves the most: ${IN(bestCls.kwh, 0)} kWh this week</div></div>
        <div class="card find hov"><span class="fic">${ic("building")}</span><div class="fv">${short(topRoom.r.id)}</div><div class="ft">Biggest saver: ${esc(topRoom.r.name.toLowerCase())}, −${IN(pct(topRoom.a, topRoom.b), 0)} % (${kwh(topRoom.b - topRoom.a)} kWh)</div></div>
        <div class="card find hov"><span class="fic" style="background:var(--cyan-soft);color:var(--cyan)">${ic("energy")}</span><div class="fv">${IN(r.peak.kw, 0)} kW</div><div class="ft">Peak demand, ${S.DAYS[r.peak.d]} ${hhmm(r.peak.b * S.BKT)}</div></div>
        <div class="card find hov"><span class="fic" style="background:rgba(250,178,25,.12);color:var(--warn)">${ic("snow")}</span><div class="fv">${IN(acShare, 0)} %</div><div class="ft">of energy is AC${A.allowCooling ? `; switching it per zone saves ${IN(pct(r.cls.after.ac, r.cls.before.ac), 0)} %` : ". Held in the deployed design; a validated thermal model is the next lever"}</div></div>
      </div>
      <section class="card"><div class="ch"><h2>Idle energy</h2><div class="r"><span class="muted" style="font-size:12px">loads on in empty zones, kWh this week</span></div></div><div style="padding:14px 18px 18px;display:grid;gap:10px">
        <div class="cmp"><div class="row" style="grid-template-columns:70px 1fr 80px"><span>Without</span><span class="tr"><b style="background:var(--without);width:0" data-w="100"></b></span><span>${kwh(wasteB, 0)}</span></div><div class="row" style="grid-template-columns:70px 1fr 80px"><span>With</span><span class="tr"><b style="background:var(--with);width:0" data-w="${(100 * wasteA) / (wasteB || 1)}"></b></span><span>${kwh(wasteA, 0)}</span></div></div></div></section>`;
    body.querySelectorAll(".cu").forEach((n) => num(n, +n.dataset.v, +n.dataset.d));
    requestAnimationFrame(() => requestAnimationFrame(() => body.querySelectorAll("b[data-w]").forEach((b) => (b.style.width = b.dataset.w + "%"))));
    weekBars(body.querySelector("#wk"), { unit: "kWh", height: 260, cats: r.perDay.map((x) => S.DAYS[x.d].slice(0, 3)), full: r.perDay.map((x) => S.DAYS[x.d]), series: [{ name: "Without", color: "--without", values: r.perDay.map((x) => x.b / 1000) }, { name: "With", color: "--with", values: r.perDay.map((x) => x.a / 1000) }], extraTip: (i) => `<div class="row" style="margin-top:3px"><span>Saved</span><span>${IN(pct(r.perDay[i].a, r.perDay[i].b), 1)} %</span></div>` });
    const mx = Math.max(1, ...r.occHour.flatMap((o) => Array.from(o.hrs)));
    heatGrid(body.querySelector("#occH"), { rows: r.occHour.map((o) => ({ label: S.DAYS[o.d].slice(0, 3), values: Array.from(o.hrs) })), cols: 24, max: mx, ch: 22, ml: 40, colLabel: (c) => String(c).padStart(2, "0"), what: "Avg people in block", fmt: (v) => IN(v, 0), label: "Average people in the block by day and hour", tickEvery: 3 });
  }
  el.querySelector("#rf").addEventListener("submit", async (e) => {
    e.preventDefault(); const out = $("repOut"); out.innerHTML = `<div class="card pad"><div class="eyebrow" id="rpS">Simulating…</div><div class="progress" style="margin-top:10px"><b id="rpP" style="width:0"></b></div></div>`;
    const rep = await M.computeReport({ period: $("rp").value, scope: $("rs").value, base: $("rb").value }, (f, d) => { const p = $("rpP"); if (p) p.style.width = 100 * f + "%"; const t = $("rpS"); if (t && d) t.textContent = "Simulating " + d + "…"; });
    renderReport(out, rep, $("rby").value.trim() || "Team NEST");
  });
  return { destroy() { alive = false; } };
};
function renderReport(out, r, by) {
  const A = r.A, today = new Date();
  out.innerHTML = `<div class="paper">
    <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end"><div><div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6b7684">NEST · energy report</div><h1>${esc(r.scopeName)}</h1></div><div style="margin-left:auto;text-align:right;font-size:12.5px;color:#3e4b5c"><b>${r.period === "week" ? "Week, Mon–Sun" : S.DAYS[st.day]}</b> · vs ${r.base === "timeout" ? "15-min timeout" : "manual switching"}<br>${esc(by)} · ${today.toLocaleDateString("en-IN")}</div></div>
    <div class="warnline"><b>Simulation, not metered data.</b> Placeholder building layout, fixture counts and wattages; timetable occupancy; synthetic PIR events. Switching decisions come from the NEST firmware logic (JavaScript port, checked slot-for-slot against the C++ build).</div>
    <div class="rk"><div><span>With</span><b>${kwh(r.TA)} kWh</b></div><div><span>Without</span><b>${kwh(r.TB)} kWh</b></div><div><span>Saved</span><b>${kwh(r.saved)} kWh</b></div><div><span>Saved, all load</span><b>${IN(pct(r.TA, r.TB), 1)} %</b></div><div><span>Controllable loads</span><b>${IN(pct(r.ctlA, r.ctlB), 1)} %</b></div><div><span>Cost avoided</span><b>₹${IN((r.saved / 1000) * A.tariff_grid, 0)}</b></div><div><span>CO₂ avoided</span><b>${IN((r.saved / 1000) * A.ef_grid, 1)} kg</b></div></div>
    <p>Zone control reduced lighting energy by <b>${IN(pct(r.cls.after.lights, r.cls.before.lights), 0)} %</b> and fan energy by <b>${IN(pct(r.cls.after.fans, r.cls.before.fans), 0)} %</b>. Air conditioning ${A.allowCooling ? `fell by <b>${IN(pct(r.cls.after.ac, r.cls.before.ac), 0)} %</b>, assuming each zone's thermal screen has a validated room model` : "was left to users, because the deployed node never switches cooling off without a validated thermal model"}. Plug loads are outside the node's control.</p>
    <h3>${r.period === "week" ? "Daily energy" : "Demand profile"}</h3><div id="rpc"></div>
    <h3>Rooms</h3><div class="tw"><table><thead><tr><th>Room</th><th>Use</th><th class="n">Without kWh</th><th class="n">With kWh</th><th class="n">Saved kWh</th><th class="n">Saved %</th><th class="n">Empty-zone kWh</th></tr></thead><tbody>${r.rows.map((x) => `<tr><td><b>${x.r.id}</b></td><td>${esc(x.r.name)}</td><td class="n">${kwh(x.b)}</td><td class="n">${kwh(x.a)}</td><td class="n">${kwh(x.b - x.a)}</td><td class="n">${IN(pct(x.a, x.b), 0)}</td><td class="n">${kwh(x.wb)} → ${kwh(x.wa)}</td></tr>`).join("")}</tbody></table></div>
    <h3>Energy sources</h3><p>With zone control the ${esc(r.scopeName)} drew an estimated <b>${IN(r.sup.grid, 1)} kWh</b> from the grid, <b>${IN(r.sup.pv, 1)} kWh</b> from rooftop solar (${A.pv_kwp} kWp assumed) and <b>${IN(r.sup.dg, 1)} kWh</b> from the DG set (${A.outage_len_min}-min outage assumed on working days).</p>
    <h3>Assumptions and method</h3><div class="tw"><table><tbody>
      <tr><td>Fixture power</td><td>Light ${A.W_light} W · fan ${A.W_fan} W · AC ${A.W_ac} W at ${Math.round(A.ac_duty * 100)} % duty · PC ${A.W_pc} W</td></tr>
      <tr><td>Manual baseline</td><td>Room switched as a whole; on 5 min before use, off 10 min after; gaps under 60 min stay on; lunch gap left on with p = ${A.p_lunch_on}; left on after the last use until 18:30 with p = ${A.p_left_on}</td></tr>
      <tr><td>Timeout baseline</td><td>One room-level motion sensor, all zones together, 15-min timeout</td></tr>
      <tr><td>Zone control</td><td>One node per zone: 30-slot PIR window (5 min), O = 1 − e^(−n/2), presence at O ≥ 0.5; grace lights 3 min, fans 10 min, AC 10 min; 30 s warning; 3 min minimum on-time; restore on presence</td></tr>
      <tr><td>PIR model</td><td>Seated person triggers in 15 % of 10 s slots, walking person always; false alarm 5 × 10⁻⁴ per slot</td></tr>
      <tr><td>Emission factor</td><td>Grid ${A.ef_grid} kg CO₂/kWh (CEA v20.0, FY 2023-24); DG ${A.ef_dg} kg/kWh (assumed)</td></tr>
      <tr><td>Tariff</td><td>Grid ₹${A.tariff_grid}/kWh, DG ₹${A.tariff_dg}/kWh (assumed)</td></tr></tbody></table></div>
    <div class="noprint" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="btnp" type="button" id="cpCsv">${ic("copy", "sm")}Copy table as CSV</button><button class="btns" type="button" id="cpTxt" style="color:#18222f;border-color:#cfd3cc">${ic("copy", "sm")}Copy summary</button>${M.LOCAL ? `<button class="btns" type="button" id="prt" style="color:#18222f;border-color:#cfd3cc">${ic("print", "sm")}Print / save as PDF</button>` : `<span style="font-size:12px;color:#6b7684">Save as PDF from the downloaded HTML file.</span>`}<span id="cpMsg" style="font-size:12px;color:#0b7a4b;font-weight:700"></span></div>
    <textarea id="cpBox" class="noprint" hidden style="width:100%;height:120px;font:11px ui-monospace,monospace"></textarea></div>`;
  const host = out.querySelector("#rpc");
  if (r.period === "week") weekBars(host, { unit: "kWh", height: 220, cats: r.perDay.map((x) => S.DAYS[x.d].slice(0, 3)), series: [{ name: "Without", color: "--without", values: r.perDay.map((x) => x.b / 1000) }, { name: "With", color: "--with", values: r.perDay.map((x) => x.a / 1000) }] });
  else tsChart(host, { height: 220, unit: "kW", now: -1, series: [{ name: "Without", color: "--without", values: Float64Array.from(r.profB, (v) => (v * 12) / 1000), width: 1.6 }, { name: "With", color: "--with", values: Float64Array.from(r.profA, (v) => (v * 12) / 1000), area: true }] });
  const copy = (text, label) => { const box = out.querySelector("#cpBox"), msg = out.querySelector("#cpMsg"); const fb = () => { box.hidden = false; box.value = text; box.select(); msg.textContent = "Clipboard blocked here. Text selected below; press Ctrl+C."; }; try { navigator.clipboard.writeText(text).then(() => (msg.textContent = label + " copied"), fb); } catch (e) { fb(); } };
  out.querySelector("#cpCsv").addEventListener("click", () => copy(M.csvText(r.csv), "CSV"));
  out.querySelector("#cpTxt").addEventListener("click", () => copy(`NEST energy report (SIMULATION) - ${r.scopeName}, ${r.period === "week" ? "week" : S.DAYS[st.day]}\nWith zone control: ${kwh(r.TA)} kWh; without (${r.base}): ${kwh(r.TB)} kWh; saved ${kwh(r.saved)} kWh (${IN(pct(r.TA, r.TB), 1)} %). Controllable loads: ${IN(pct(r.ctlA, r.ctlB), 1)} % saved. Cost avoided ~Rs ${IN((r.saved / 1000) * A.tariff_grid, 0)}; CO2 avoided ~${IN((r.saved / 1000) * A.ef_grid, 1)} kg.\nPlaceholder building, simulated occupancy, synthetic PIR; not metered data.`, "Summary"));
  const pb = out.querySelector("#prt"); if (pb) pb.addEventListener("click", () => { $("repCard").open = true; window.print(); });
}

/* ======================= SAVINGS & COST ======================= */
// Three kinds of result, never added together:
//   simulation  - eligible-load saving from the simulated DKM block (lights + fans only)
//   estimate    - bill-based scenario (assumed bill × chosen percentage) and the installation estimate
//   measured    - nothing yet: the prototype kit cannot measure energy
VIEWS.savings = (el) => {
  const C = window.NESTCOST, B = M.BILL, KEY = "nest_bill_v1", KEY2 = "nest_cost_v1";
  const inp = { bill: B.DEF, pct: B.PDEF, share: "", omOv: "" };
  const opt = { buildings: 1, includeCorridors: true, contactors: true, bypass: true, weeksPerYear: 40 };
  let quotes = {};
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); if (v) ["bill", "pct", "share", "omOv"].forEach((k) => { if (k in v) inp[k] = v[k]; }); } catch (e) {}
  try { const v = JSON.parse(localStorage.getItem(KEY2) || "null"); if (v) { if (v.opt) Object.keys(opt).forEach((k) => { if (typeof v.opt[k] === typeof opt[k]) opt[k] = v.opt[k]; }); if (v.quotes && typeof v.quotes === "object") quotes = v.quotes; } } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(inp)); localStorage.setItem(KEY2, JSON.stringify({ opt, quotes })); } catch (e) {} };
  const rs = (v) => (v < 0 ? "−₹" : "₹") + IN(Math.round(Math.abs(v)));
  const lakh = (v) => "₹" + IN(v / 1e5, 2) + " lakh";
  const money = (v) => (Math.abs(v) >= 1e5 ? lakh(v) : rs(v));
  const yrs = (y) => { if (!isFinite(y)) return "—"; if (y > 50) return "more than 50 years"; const m = Math.round(y * 12), a = Math.floor(m / 12), b = m % 12; return [a ? a + (a === 1 ? " year" : " years") : "", b ? b + (b === 1 ? " month" : " months") : ""].filter(Boolean).join(" ") || "under 1 month"; };
  const tag = (k) => ({ sim: `<span class="simtag mini">simulation</span>`, est: `<span class="kindtag est">estimate</span>`, meas: `<span class="kindtag meas">measured</span>` }[k]);
  const ST = { recorded: ["recorded", "Team purchase record"], listing: ["listing", "Online retail listing, checked " + C.CHECKED], regulation: ["minimum wage", "Statutory minimum wage (Karnataka, Zone 1)"], provisional: ["provisional", "Engineering estimate: no reliable price found"], quote: ["your quote", "Unit price entered on this page"] };
  const badge = (s) => `<span class="pst ${s}" data-tip="${esc(ST[s][1])}">${ST[s][0]}</span>`;
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\.|^m\.|^aws\./, ""); } catch (e) { return u; } };
  el.innerHTML = `
  <div class="banner est">${ic("info")}<span><b>Three kinds of result, never added together.</b> <b>Simulation</b>: the modelled DKM block with synthetic occupancy and assumed wattages. <b>Estimate</b>: your assumed bill times a percentage you choose, and an installation cost from documented unit prices. <b>Measured</b>: needs real meter readings; there are none yet.</span></div>
  <div class="kinds">
    <div class="card kind k-sim"><div class="kh">${tag("sim")}<span>Eligible-load saving · modelled block</span></div><div class="kv"><span id="kSim">…</span><small>/ year</small></div><div class="ks" id="kSimS">simulating the week…</div></div>
    <div class="card kind k-est"><div class="kh">${tag("est")}<span>Bill scenario</span></div><div class="kv"><span id="kEst">…</span><small>/ year gross</small></div><div class="ks" id="kEstS"></div></div>
    <div class="card kind k-meas"><div class="kh">${tag("meas")}<span>Measured saving</span></div><div class="kv"><span>No data yet</span></div><div class="ks">The prototype kit has no energy meter. Measured kWh needs a meter on the switched circuits.</div></div>
  </div>
  <section class="card" id="instCard">
    <div class="ch"><h2>Installation cost · automatic estimate</h2><div class="r">${tag("est")}<button class="info" type="button" data-tip="Quantities come from the building model (rooms, zones, floors, fixtures). Unit prices are listed below with their source and date. Not a contractor quotation: final pricing needs a verified campus inventory and an electrician's survey.">${ic("info", "sm")}</button></div></div>
    <div class="inst">
      <div class="ibig"><div class="eyebrow">Typical total, incl. contingency</div><div class="iv num" id="iTot">₹0</div><div class="ir" id="iRange"></div>
        <div class="ibar" id="iBar" role="img" aria-label="Installation cost by group"></div><div class="ileg" id="iLeg"></div></div>
      <div class="iopt">
        <div class="fld"><span class="fl">Buildings like the modelled block</span><div class="stepper"><button type="button" class="iconbtn" data-st="-1" aria-label="Fewer buildings">−</button><input class="inp r" id="oB" type="number" min="1" max="50" step="1" aria-label="Number of buildings"><button type="button" class="iconbtn" data-st="1" aria-label="More buildings">+</button></div></div>
        <button class="toggle" type="button" role="switch" id="oCont"><span class="tk"></span>Contactor per switched circuit (recommended)</button>
        <button class="toggle" type="button" role="switch" id="oByp"><span class="tk"></span>Manual bypass switch per circuit</button>
        <button class="toggle" type="button" role="switch" id="oCorr"><span class="tk"></span>Include corridor lighting</button>
        <div class="iqty" id="iQty"></div>
      </div>
    </div>
    <div class="iflags" id="iFlags"></div>
    <details class="more"><summary>${ic("doc", "sm")}Itemised breakdown and sources<span class="muted" style="font-weight:600;font-size:12px">· enter a quotation to replace a unit price</span><svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body tw" id="iTable"></div></details>
    <details class="more"><summary>${ic("controls", "sm")}Design and quantity rules<svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body" id="iDesign"></div></details>
    <details class="more"><summary>${ic("usb", "sm")}Student prototype cost<span class="muted" style="font-weight:600;font-size:12px">· recorded purchase ₹${IN(C.PROTOTYPE_RECORDED_TOTAL)}</span><svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body" id="iProto"></div></details>
  </section>
  <div class="sav2">
    <section class="card" id="simCard"><div class="ch"><h2>Savings from the simulation</h2><div class="r">${tag("sim")}</div></div>
      <div class="estin" style="padding-bottom:6px">
        <div class="sopts"><label class="fld"><span class="fl">Compared with</span><select class="sel" id="sBase"><option value="manual">Manual switching</option><option value="timeout">15-min timeout sensor</option></select></label>
          <label class="fld"><span class="fl">Academic weeks / year</span><input class="inp r" id="sWk" type="number" min="1" max="52" step="1"></label>
          <label class="fld"><span class="fl">Energy charge (₹/kWh)</span><input class="inp r" id="sTar" type="number" min="0.5" max="40" step="0.1"></label></div>
        <span class="hint">Only lights and fans count: AC is held (no validated thermal model) and plug loads are not switched. The tariff is an assumption; take the energy charge from the college's bill.</span></div>
      <div id="simOut"><div class="eo na"><span class="k">Simulating the week…</span><span class="v"><span class="progress" style="display:block;width:120px"><b id="sProg" style="width:0"></b></span></span></div></div>
      <details class="more"><summary>${ic("clock", "sm")}Running cost breakdown<svg class="ic sm chev" viewBox="0 0 24 24" style="margin-left:auto"><path d="${ICONS.chev}"/></svg></summary><div class="body" id="omOut"></div></details>
    </section>
    <section class="card" id="billCard"><div class="ch"><h2>Bill scenario</h2><div class="r">${tag("est")}</div></div>
      <form class="estin" id="estF" novalidate>
        <div class="fld"><label class="fl" for="bRng">Monthly electricity bill <span class="muted" style="font-weight:600">illustrative ₹2–3 lakh</span></label>
          <div class="rng"><input type="range" id="bRng" min="${B.MIN}" max="${B.MAX}" step="${B.STEP}" aria-label="Monthly bill slider"><input class="inp r" id="bNum" type="number" inputmode="numeric" min="${B.MIN}" max="${B.MAX}" step="1000" aria-label="Monthly bill in rupees"></div>
          <span class="err" id="eBill" hidden></span></div>
        <div class="fld"><label class="fl" for="pRng">Saving on the whole bill <span class="muted" style="font-weight:600">${B.PMIN}–${B.PMAX} %</span></label>
          <div class="rng"><input type="range" id="pRng" min="${B.PMIN}" max="${B.PMAX}" step="1" aria-label="Saving percentage slider"><input class="inp r" id="pNum" type="number" inputmode="numeric" min="${B.PMIN}" max="${B.PMAX}" step="1" aria-label="Saving in percent"></div>
          <div class="pre" id="pPre">${[5, 10, 15, 20].map((v) => `<button class="chip" type="button" data-p="${v}">${v} %</button>`).join("")}<button class="chip" type="button" data-p="${B.TARGET}" data-tip="The project's illustrative target. Not a measured or proven result.">${B.TARGET} % · target</button></div>
          <span class="err" id="ePct" hidden></span></div>
        <div class="fld"><label class="fl" for="sNum">Share of the bill from lights and fans NEST would switch (%)</label><input class="inp r" id="sNum" type="number" inputmode="decimal" min="1" max="100" step="1" placeholder="optional, if known">
          <span class="hint">AC, lab equipment, servers, pumps and lifts on the bill are outside NEST's control and cannot count as NEST savings. Use a sub-meter reading or a load survey.</span><span class="err" id="eShare" hidden></span></div>
        <div class="fld"><label class="fl" for="oNum">Annual running cost (₹, optional)</label><input class="inp r" id="oNum" type="number" inputmode="numeric" min="0" step="500" placeholder="automatic">
          <span class="hint">Leave empty to use the automatic estimate (spares, inspection, the nodes' own electricity).</span><span class="err" id="eOm" hidden></span></div>
      </form>
      <div id="estOut"></div>
    </section>
  </div>
  <section class="card" id="measCard"><div class="ch"><h2>Measured results</h2><div class="r">${tag("meas")}</div></div>
    <div class="body" style="padding:12px 18px 18px"><p class="note" style="margin:0">None yet. The kit (ESP32, two PIR, DHT22, LDR, relay board) cannot measure energy. To measure a saving: fit an energy meter such as a PZEM-004T (${rs(C.PRICES.pzem.typ)} listing) or use a clamp meter on each switched lights or fans circuit; log one to two weeks of normal switching, then the same weeks with NEST in control and the same timetable; compare kWh per circuit. Results go here only with the dates, rooms and meter used.</p></div></section>`;
  const $e = (id) => el.querySelector("#" + id);
  let rep = null, alive = true, tableKey = "";
  const sw = (id, on) => $e(id).setAttribute("aria-checked", String(!!on));
  function fillOpts() { $e("oB").value = opt.buildings; sw("oCont", opt.contactors); sw("oByp", opt.bypass); sw("oCorr", opt.includeCorridors); $e("sBase").value = st.A.baseline; $e("sWk").value = opt.weeksPerYear; $e("sTar").value = st.A.tariff_grid;
    $e("bRng").value = Math.min(B.MAX, Math.max(B.MIN, +inp.bill || B.DEF)); $e("bNum").value = inp.bill; $e("pRng").value = Math.min(B.PMAX, Math.max(B.PMIN, +inp.pct || B.PDEF)); $e("pNum").value = inp.pct; $e("sNum").value = inp.share; $e("oNum").value = inp.omOv; }
  const est = () => C.estimate(S, st.A, opt, quotes);
  const simHours = () => { if (!rep) return null; const g = opt.includeCorridors ? rep.coil.all : rep.coil.noCorr; return g.n ? { offH: g.off / g.n, onH: g.on / g.n } : null; };
  const eligibleWeek = () => { if (!rep) return null; const d = (c) => (rep.cls.before[c] - rep.cls.after[c] - (opt.includeCorridors ? 0 : rep.clsCorr.before[c] - rep.clsCorr.after[c])) / 1000; return { lights: d("lights"), fans: d("fans") }; };
  const pbCells = (pb, missing) => `<div class="pb3x">${["low", "typ", "high"].map((s) => { const x = pb[s]; const lab = { low: "Low cost", typ: "Typical", high: "High cost" }[s]; const v = x.missing ? `<span class="muted">${esc(missing)}</span>` : x.none ? `<span class="dn">No payback under current assumptions</span>` : yrs(x.years); return `<div class="${s === "typ" ? "sel" : ""}"><span class="eyebrow">${lab}</span><b>${v}</b>${x.missing || x.none ? "" : `<small>net ${rs(x.net)} / yr</small>`}</div>`; }).join("")}</div>`;
  const goal = (pb) => { const t = pb.typ; if (t.missing) return ""; const met = !t.none && t.years <= 2; return `<div class="goal ${met ? "met" : ""}">${ic(met ? "check" : "info", "sm")}<span>Project goal: recover the installation cost within 2 years. Typical scenario: <b>${met ? "met" : "not met"}</b> under these assumptions. The goal is not forced into the calculation.</span></div>`; };
  function renderInstall(E) {
    num($e("iTot"), E.total.typ, 0, (v) => money(v));
    $e("iRange").innerHTML = `Low ${money(E.total.low)} · High ${money(E.total.high)} · ${rs(E.perNode.typ)} per node`;
    const parts = [["Hardware", E.hw.typ, "--c-grid"], ["Wiring & materials", E.wire.typ, "--c-fans"], ["Labour & commissioning", E.lab.typ, "--c-ac"], [`Contingency ${E.D.contingencyPct.typ} %`, E.contingency.typ, "--text3"]], tot = E.total.typ || 1;
    const bar = $e("iBar"); if (!bar.children.length) bar.innerHTML = parts.map(() => `<i></i>`).join("");
    [...bar.children].forEach((b, i) => { b.style.width = (100 * parts[i][1]) / tot + "%"; b.style.background = `var(${parts[i][2]})`; b.dataset.tip = `${parts[i][0]}: ${money(parts[i][1])} (typical)`; });
    $e("iLeg").innerHTML = parts.map(([l, v, c]) => `<div><i style="background:var(${c})"></i><span>${esc(l)}</span><b>${money(v)}</b></div>`).join("");
    const q = E.q;
    $e("iQty").innerHTML = `<div><b>${IN(q.nodes)}</b><span>nodes (1 per zone)</span></div><div><b>${IN(q.pir)}</b><span>PIR sensors</span></div><div><b>${IN(q.circuits)}</b><span>switched circuits</span></div><div><b>${IN(q.rooms)}</b><span>rooms · ${q.floors} floors${opt.buildings > 1 ? " × " + opt.buildings : ""}</span></div>`;
    const fl = [];
    if (q.flags.coverage.length) fl.push(["warn", `${q.flags.coverage.length / opt.buildings} zone(s) per building are larger than two PIR sensors cover at ${E.D.pirCoverage_m2} m² each (corridors, ${[...new Set(q.flags.coverage.filter((f) => !/C\//.test(f.id)).map((f) => f.id.split("/")[0].replace("DKM-", "")))].join(", ") || "none"}). A survey may add nodes there; not included.`]);
    if (q.flags.overRelay.length) fl.push(["crit", `${q.flags.overRelay.length} circuit(s) draw more than ${E.D.relayRating_A * E.D.relayUse} A (50 % of the relay rating). ${opt.contactors ? "Covered by the contactors." : "Turn on contactors: the relay board must not switch these directly."}`]);
    else fl.push(["ok", `Largest switched circuit ≈ ${IN(q.maxCircuitA, 2)} A at the simulation's wattages (light ${st.A.W_light} W, fan ${st.A.W_fan} W), below the 5 A limit (50 % of the relay's 10 A, docs/COMMISSIONING.md E2).`]);
    fl.push(["info", `AC is not in this plan (${IN(q.acUnitsExcluded)} units left as they are): switching cooling needs a validated thermal model and its own safety design. No Wi-Fi gateway or server is included: the firmware controls each zone locally.`]);
    if (!opt.contactors) fl.push(["warn", "Without contactors the hobby relay board switches 230 V circuits directly. Its 10 A marking is not an approval for fixed wiring; an electrician must accept this before installation."]);
    $e("iFlags").innerHTML = fl.map(([k, t]) => `<div class="flag f-${k}">${ic(k === "ok" ? "check" : k === "info" ? "info" : "warn", "sm")}<span>${esc(t)}</span></div>`).join("");
    renderTable(E);
  }
  function renderTable(E) {
    const key = E.lines.map((l) => l.key + l.cat).join(",") + "|" + opt.buildings;
    const cell = (l) => `<td class="n" data-c="low">${rs(l.low)}</td><td class="n" data-c="typ"><b>${rs(l.typ)}</b></td><td class="n" data-c="high">${rs(l.high)}</td>`;
    if (key !== tableKey) {
      tableKey = key;
      let h = `<table class="ctab"><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Unit price (₹)</th><th class="n">Low</th><th class="n">Typical</th><th class="n">High</th><th>Basis</th></tr></thead><tbody>`;
      C.CATS.forEach(([id, label]) => {
        const ls = E.lines.filter((l) => l.cat === id); if (!ls.length) return; const c = E.byCat.find((x) => x.id === id);
        h += `<tr class="cat" data-cat="${id}"><td colspan="3">${esc(label)}</td><td class="n" data-c="low">${rs(c.low)}</td><td class="n" data-c="typ">${rs(c.typ)}</td><td class="n" data-c="high">${rs(c.high)}</td><td></td></tr>`;
        ls.forEach((l, i) => { const P = C.PRICES[l.key];
          h += `<tr data-line="${id}:${i}"><td>${esc(l.label)}${l.note ? `<div class="muted" style="font-size:11.5px">${esc(l.note)}</div>` : ""}</td><td class="n">${IN(l.qty, l.qty % 1 ? 1 : 0)} <span class="muted">${esc(l.unit)}</span></td>
            <td class="n"><input class="inp sm r qinp" type="number" min="0" step="1" data-k="${l.key}" value="${quotes[l.key] ?? ""}" placeholder="${P.typ}" aria-label="Quoted unit price for ${esc(l.label)}"><div class="muted" style="font-size:11px">${P.low === P.high ? rs(P.typ) : rs(P.low) + "–" + rs(P.high)}</div></td>${cell(l)}
            <td class="basis" data-b="${l.key}">${badge(l.status)} ${esc(P.basis)}${(P.src || []).map((u) => ` <a href="${esc(u)}" target="_blank" rel="noopener">${esc(host(u))}</a>`).join("")}</td></tr>`; });
      });
      h += `<tr class="sub"><td colspan="3">Subtotal before contingency</td><td class="n" data-t="bc-low"></td><td class="n" data-t="bc-typ"></td><td class="n" data-t="bc-high"></td><td></td></tr>
        <tr><td colspan="3">Contingency (${E.D.contingencyPct.low} / ${E.D.contingencyPct.typ} / ${E.D.contingencyPct.high} %) for unforeseen work</td><td class="n" data-t="ct-low"></td><td class="n" data-t="ct-typ"></td><td class="n" data-t="ct-high"></td><td>${badge("provisional")}</td></tr>
        <tr class="tot"><td colspan="3">Estimated installation cost</td><td class="n" data-t="t-low"></td><td class="n" data-t="t-typ"></td><td class="n" data-t="t-high"></td><td class="muted">Not a quotation. Prices include GST where listed.</td></tr></tbody></table>`;
      $e("iTable").innerHTML = h;
    }
    // refresh numbers in place (keeps focus in a quote box)
    C.CATS.forEach(([id]) => { const ls = E.lines.filter((l) => l.cat === id), c = E.byCat.find((x) => x.id === id), tr = $e("iTable").querySelector(`tr.cat[data-cat="${id}"]`);
      if (tr) ["low", "typ", "high"].forEach((s) => (tr.querySelector(`[data-c="${s}"]`).textContent = rs(c[s])));
      ls.forEach((l, i) => { const row = $e("iTable").querySelector(`tr[data-line="${id}:${i}"]`); if (!row) return; ["low", "typ", "high"].forEach((s) => { const td = row.querySelector(`[data-c="${s}"]`); td.innerHTML = s === "typ" ? `<b>${rs(l[s])}</b>` : rs(l[s]); }); const b = row.querySelector(".pst"); if (b && !b.classList.contains(l.status)) b.outerHTML = badge(l.status); }); });
    ["low", "typ", "high"].forEach((s) => { const t = (k) => $e("iTable").querySelector(`[data-t="${k}-${s}"]`); t("bc").textContent = rs(E.beforeCont[s]); t("ct").textContent = rs(E.contingency[s]); t("t").innerHTML = `<b>${rs(E.total[s])}</b>`; });
  }
  function renderDesign(E) {
    const D = E.D, rows = [
      ["Architecture", "One NEST node per control zone, as in the firmware: an ESP32 reads two PIR sensors and drives a 4-channel relay board (lights and fans on one channel each, two spare). Nodes run independently; there is no central controller."],
      ["Sensors", `${D.pirPerNode} HC-SR501 per node (the firmware's two PIR inputs). Zones larger than ${D.pirPerNode} × ${D.pirCoverage_m2} m² are flagged for a survey. DHT22, LDR and OLED are left out: they do not drive lights or fans in the current firmware.`],
      ["Switching", `${D.contactors ? "Each switched circuit gets a 20 A 2-pole modular contactor in a 4-way distribution box; the relay's NC contact feeds the contactor coil, so loads stay on if a node loses power (the firmware's NC wiring)." : "Relay board switches the circuits directly (only if the electrician accepts it)."} Relay use limited to ${D.relayUse * 100} % of its ${D.relayRating_A} A rating (docs/COMMISSIONING.md E2).${D.bypass ? " A manual bypass switch per circuit (E3)." : ""}`],
      ["Protection", "Each node: IP65 ABS enclosure for the low-voltage side, 6 A MCB on its supply, fuse on the 5 V module input, cable glands and screw terminals. 230 V and low-voltage wiring kept apart."],
      ["Wiring", `Existing room wiring is kept: each node taps the switch circuits at the room's switchboard (${D.mainsRunPerCircuit_m} m of 1.5 mm² per circuit, ${D.supplyRun_m} m for the node supply). Sensor cable: ${D.sensorDrop_m} m drop plus half the zone width per sensor, in 25 mm casing.`],
      ["Labour", `Electrician: ${D.h_node} h per node + ${D.h_circuit} h per circuit + ${D.h_sensor} h per sensor, +${D.accessPerFloor * 100} % per floor above ground. Technician: ${D.h_firmware + D.h_commission} h per node for firmware and commissioning, ${D.h_test} h per node testing, ${D.handoverDays} days handover. 8-hour days.`],
      ["Running cost", `Spares ${D.sparesPct.low}/${D.sparesPct.typ}/${D.sparesPct.high} % of hardware a year; inspection ${D.inspection_h.typ} h per node a year; node electronics ${D.P_node_W} W always on; relay coil ${D.P_relayCoil_W} W while a load is held off; ${D.contactors ? `contactor coil ${D.P_contactorCoil_W} W while a load is on` : "no contactors"}. Coil hours come from the simulated week; outside the ${opt.weeksPerYear} academic weeks the rooms are taken as empty with the supply on.`],
      ["Not included", "Wi-Fi gateway or server, AC control, new circuits, painting or civil work, permits, taxes on labour, and price changes after " + C.CHECKED + "."],
    ];
    $e("iDesign").innerHTML = `<ul class="slist">${rows.map(([k, v]) => `<li><b>${k}</b><span>${esc(v)}</span></li>`).join("")}</ul><p class="note" style="margin-top:10px">Values marked provisional are engineering assumptions. Replace them with the electrician's survey and vendor quotations before using the estimate in a proposal.</p>`;
  }
  function renderProto() {
    const pr = C.prototype(quotes);
    $e("iProto").innerHTML = `<div class="hwcols"><div><h4 style="margin:0 0 8px;font-size:14px">Already purchased ${badge("recorded")}</h4><div class="tw"><table class="mini2"><tbody>${pr.items.map((x) => `<tr><td>${esc(x.label)}</td><td class="n">${x.qty}</td><td class="n">${rs(x.price)}</td></tr>`).join("")}<tr class="tot"><td>Recorded purchase total</td><td></td><td class="n"><b>${rs(pr.recorded)}</b></td></tr></tbody></table></div>
      <p class="note" style="margin-top:8px">From the team's order records (15 Oct 2026), before shipping and tax. A recorded figure, not an independently checked market value.</p></div>
      <div><h4 style="margin:0 0 8px;font-size:14px">Still needed for the demonstration</h4><div class="tw"><table class="mini2"><tbody>${pr.extra.map((x) => `<tr><td>${esc(x.label)}${x.optional ? ` <span class="muted">(optional)</span>` : ""}<div class="muted" style="font-size:11.5px">${esc(x.why)}</div></td><td>${badge(x.status)}</td><td class="n">${x.low === x.high ? rs(x.typ) : rs(x.low) + "–" + rs(x.high)}</td></tr>`).join("")}</tbody></table></div>
      <div class="pb3x" style="margin-top:10px"><div><span class="eyebrow">Purchased</span><b>${rs(pr.purchased)}</b></div><div class="sel"><span class="eyebrow">+ required extras</span><b>${rs(pr.totalRequired.typ)}</b><small>${rs(pr.totalRequired.low)}–${rs(pr.totalRequired.high)}</small></div><div><span class="eyebrow">+ energy meter</span><b>${rs(pr.totalRequired.typ + pr.optional.typ)}</b></div></div>
      <p class="note" style="margin-top:8px">Nothing already bought is counted again. Assembly and bench validation (docs/COMMISSIONING.md) are not confirmed here; this page does not assume the prototype works.</p></div></div>`;
  }
  function renderSim(E, om) {
    const out = $e("simOut"), ew = eligibleWeek();
    if (!ew) return;
    const wkKwh = ew.lights + ew.fans, yrKwh = wkKwh * opt.weeksPerYear * opt.buildings, gross = yrKwh * st.A.tariff_grid, pb = C.payback(E, om, gross);
    num($e("kSim"), gross, 0, (v) => rs(v));
    $e("kSimS").innerHTML = `${IN(yrKwh, 0)} kWh/yr · lights + fans vs ${esc(M.baseName())} · payback ${pb.typ.none ? "none" : pb.typ.missing ? "—" : yrs(pb.typ.years)} (typical)`;
    const acNote = rep.A.allowCooling ? ` The Scenario setting "AC: switch off" adds ${IN((rep.cls.before.ac - rep.cls.after.ac) / 1000, 1)} kWh a week in the simulation; it is not counted.` : "";
    out.innerHTML = `
      <div class="eo"><span class="k">Saved in the simulated week</span><span class="v">${IN(wkKwh, 1)} kWh</span><span class="s">Lights ${IN(ew.lights, 1)} kWh · fans ${IN(ew.fans, 1)} kWh, modelled DKM block, synthetic occupancy, Mon–Sun.${acNote}</span></div>
      <div class="eo"><span class="k">Per year</span><span class="v">${IN(yrKwh, 0)} kWh</span><span class="s">× ${opt.weeksPerYear} academic weeks${opt.buildings > 1 ? ` × ${opt.buildings} buildings` : ""}; no saving assumed in vacation weeks</span></div>
      <div class="eo main"><span class="k">Gross saving</span><span class="v">${rs(gross)}</span><span class="s">at ₹${IN(st.A.tariff_grid, 2)}/kWh (assumed)</span></div>
      <div class="eo"><span class="k">Running cost (typical)</span><span class="v">${om.typ.total === null ? "—" : rs(om.typ.total)}</span><span class="s">spares, inspection and ${om.kwh === null ? "—" : IN(om.kwh, 0)} kWh/yr used by the nodes and coils</span></div>
      <div class="eo"><span class="k">Payback (installation ÷ net saving)</span><span class="v"></span>${pbCells(pb, "simulation not ready")}</div>
      ${goal(pb)}`;
    $e("omOut").innerHTML = om.typ.total === null ? `<p class="note">Waiting for the simulated week.</p>` : `<table class="mini2"><thead><tr><th></th><th class="n">Low</th><th class="n">Typical</th><th class="n">High</th></tr></thead><tbody>
      <tr><td>Spares and repairs (${E.D.sparesPct.low}/${E.D.sparesPct.typ}/${E.D.sparesPct.high} % of hardware)</td>${["low", "typ", "high"].map((s) => `<td class="n">${rs(om[s].spares)}</td>`).join("")}</tr>
      <tr><td>Inspection (${E.D.inspection_h.low}–${E.D.inspection_h.high} h per node a year)</td>${["low", "typ", "high"].map((s) => `<td class="n">${rs(om[s].inspection)}</td>`).join("")}</tr>
      <tr><td>Electricity used by NEST itself: ${IN(om.kwh, 0)} kWh/yr (nodes ${IN(om.kwhNode, 0)}, relay coils ${IN(om.kwhRelay, 0)}, contactor coils ${IN(om.kwhCont, 0)})</td>${["low", "typ", "high"].map((s) => `<td class="n">${rs(om[s].energy)}</td>`).join("")}</tr>
      <tr class="tot"><td>Total running cost a year</td>${["low", "typ", "high"].map((s) => `<td class="n"><b>${rs(om[s].total)}</b></td>`).join("")}</tr></tbody></table>
      <p class="note" style="margin-top:8px">Coil hours from the simulation: each switched circuit is held off ${IN(simHours().offH, 0)} h and on ${IN(simHours().onH, 0)} h in the simulated week. Node power ${E.D.P_node_W} W and contactor coil ${E.D.P_contactorCoil_W} W are provisional until measured (COMMISSIONING D3).</p>`;
  }
  function renderBill(E, om) {
    const r = M.billEstimate({ bill: inp.bill, pct: inp.pct, share: inp.share });
    const omBad = inp.omOv !== "" && !(isFinite(inp.omOv) && +inp.omOv >= 0);
    [["eBill", "bill", "bNum"], ["ePct", "pct", "pNum"], ["eShare", "share", "sNum"]].forEach(([id, k, inId]) => { const e = $e(id); e.hidden = !r.err[k]; e.textContent = r.err[k] || ""; $e(inId).setAttribute("aria-invalid", String(!!r.err[k])); });
    $e("eOm").hidden = !omBad; $e("eOm").textContent = omBad ? "Enter zero or a positive amount, or leave empty." : ""; $e("oNum").setAttribute("aria-invalid", String(omBad));
    el.querySelectorAll("#pPre .chip").forEach((c) => c.setAttribute("aria-pressed", String(+c.dataset.p === +inp.pct)));
    const out = $e("estOut");
    if (!r.ok) { out.innerHTML = `<div class="eo na"><span class="k">Bill scenario</span><span class="v">Fix the inputs</span><span class="s">The bill must be ₹2,00,000 to ₹3,00,000 a month and the saving 5 to 30 %.</span></div>`; $e("kEst").textContent = "—"; $e("kEstS").textContent = "inputs out of range"; return; }
    const ov = omBad || inp.omOv === "" ? undefined : +inp.omOv, pb = C.payback(E, om, r.annualGross, ov);
    num($e("kEst"), r.annualGross, 0, (v) => rs(v));
    $e("kEstS").innerHTML = `${IN(+inp.pct, 0)} % of ${rs(+inp.bill)}/month${r.target ? " · target scenario, not a proven outcome" : ""} · payback ${pb.typ.none ? "none" : pb.typ.missing ? "—" : yrs(pb.typ.years)} (typical)`;
    const ew = eligibleWeek(), simGross = ew ? (ew.lights + ew.fans) * opt.weeksPerYear * opt.buildings * st.A.tariff_grid : null;
    out.innerHTML = `
      <div class="eo main"><span class="k">Monthly gross saving</span><span class="v">${rs(r.monthly)}</span><span class="s">${IN(+inp.pct, 0)} % of ${rs(+inp.bill)}${r.target ? " · target scenario, not a proven outcome" : ""}</span></div>
      <div class="eo"><span class="k">Annual gross saving</span><span class="v">${rs(r.annualGross)}</span><span class="s">${lakh(r.annualGross)} · across 5–30 %: ${lakh(r.range[0])} to ${lakh(r.range[1])}</span></div>
      <div class="eo"><span class="k">Annual running cost</span><span class="v">${ov !== undefined ? rs(ov) : om.typ.total === null ? "—" : rs(om.typ.total)}</span><span class="s">${ov !== undefined ? "your figure" : "automatic estimate (typical), same as the simulation card"}</span></div>
      <div class="eo"><span class="k">Annual net saving (typical)</span><span class="v${pb.typ.net <= 0 ? " dn" : ""}">${pb.typ.missing ? "—" : rs(pb.typ.net)}</span><span class="s">gross − running cost</span></div>
      <div class="eo"><span class="k">Payback against the automatic installation estimate</span><span class="v"></span>${pbCells(pb, "running cost not ready")}<span class="s">The installation estimate covers ${opt.buildings} building(s) like the modelled block, while the percentage is taken of the whole bill. If the bill covers more buildings or loads NEST does not switch, this payback is too optimistic.</span></div>
      ${goal(pb)}
      ${r.implied !== undefined ? `<div class="eo"><span class="k">Cut needed in the switched loads</span><span class="v${r.impossible ? " dn" : ""}">${IN(r.implied, 0)} %</span><span class="s">${r.impossible ? `Not possible: ${IN(+inp.pct, 0)} % of the bill is more than the ${IN(+inp.share, 0)} % that lights and fans account for.` : `Lights and fans (${IN(+inp.share, 0)} % of the bill) would need to use ${IN(r.implied, 0)} % less energy. Check against measured room data.`}</span></div>` : ""}
      ${simGross !== null ? `<div class="cmpnote">${ic("info", "sm")}<span>For comparison only, on a different basis: the simulation's eligible saving for the covered building(s) is ${rs(simGross)} a year, ${IN((100 * simGross) / (+inp.bill * 12), 1)} % of this bill.</span></div>` : ""}`;
  }
  function renderAll() {
    const E = est(), om = C.operating(E, simHours(), st.A.tariff_grid);
    renderInstall(E); renderDesign(E); renderSim(E, om); renderBill(E, om);
  }
  async function loadWeek() {
    $e("kSimS").textContent = "simulating the week…";
    const r = await M.computeReport({ period: "week", scope: "all", base: st.A.baseline }, (f) => { const p = $e("sProg"); if (p) p.style.width = 100 * f + "%"; });
    if (!alive) return; rep = r; renderAll();
  }
  // inputs
  const setOpt = (k, v) => { opt[k] = v; save(); fillOpts(); renderAll(); };
  el.querySelector(".stepper").addEventListener("click", (e) => { const b = e.target.closest("[data-st]"); if (b) setOpt("buildings", C.design({ buildings: opt.buildings + +b.dataset.st }).buildings); });
  $e("oB").addEventListener("change", (e) => setOpt("buildings", C.design({ buildings: +e.target.value || 1 }).buildings));
  [["oCont", "contactors"], ["oByp", "bypass"], ["oCorr", "includeCorridors"]].forEach(([id, k]) => $e(id).addEventListener("click", () => setOpt(k, !opt[k])));
  $e("sWk").addEventListener("change", (e) => { const v = Math.round(+e.target.value); setOpt("weeksPerYear", v >= 1 && v <= 52 ? v : opt.weeksPerYear); });
  $e("sTar").addEventListener("change", (e) => { const v = +e.target.value; if (v > 0 && v <= 40) { st.A.tariff_grid = v; M.saveA(); } fillOpts(); renderAll(); });
  $e("sBase").addEventListener("change", (e) => { st.A.baseline = e.target.value; M.saveA(); syncScen(); rep = null; loadWeek(); });
  $e("iTable").addEventListener("change", (e) => { const t = e.target.closest(".qinp"); if (!t) return; const v = t.value.trim(); if (v === "" || !(+v >= 0)) delete quotes[t.dataset.k]; else quotes[t.dataset.k] = +v; el.querySelectorAll(`.qinp[data-k="${t.dataset.k}"]`).forEach((x) => { if (x !== t) x.value = quotes[t.dataset.k] ?? ""; }); save(); renderAll(); });
  const setB = (k, v) => { inp[k] = v; save(); const E = est(); renderBill(E, C.operating(E, simHours(), st.A.tariff_grid)); };
  const numOr = (v) => (v === "" ? "" : Number(v));
  $e("bRng").addEventListener("input", (e) => { $e("bNum").value = e.target.value; setB("bill", +e.target.value); });
  $e("bNum").addEventListener("input", (e) => { const v = numOr(e.target.value); if (v >= B.MIN && v <= B.MAX) $e("bRng").value = v; setB("bill", v); });
  $e("pRng").addEventListener("input", (e) => { $e("pNum").value = e.target.value; setB("pct", +e.target.value); });
  $e("pNum").addEventListener("input", (e) => { const v = numOr(e.target.value); if (v >= B.PMIN && v <= B.PMAX) $e("pRng").value = v; setB("pct", v); });
  $e("pPre").addEventListener("click", (e) => { const c = e.target.closest("[data-p]"); if (!c) return; $e("pRng").value = c.dataset.p; $e("pNum").value = c.dataset.p; setB("pct", +c.dataset.p); });
  $e("sNum").addEventListener("input", (e) => setB("share", numOr(e.target.value)));
  $e("oNum").addEventListener("input", (e) => setB("omOv", numOr(e.target.value)));
  $e("estF").addEventListener("submit", (e) => e.preventDefault());
  fillOpts(); renderProto(); renderAll(); loadWeek();
  return { destroy() { alive = false; } };
};

/* ---------------- loop ---------------- */
let last = performance.now(), lastUI = 0;
function tick(force) { updateBar(); if (cur && cur.update) cur.update(force); }
function frame(now) {
  const dt = Math.min(200, now - last); last = now;
  if (st.playing) { st.min += (dt / 1000) * st.speed; if (st.min >= 1439.9) { st.min = 1439.9; st.playing = false; syncPlay(); } }
  if (cur && cur.anim) cur.anim(dt);
  if (scrubEls && st.playing) { scrubEls.past.setAttribute("width", st.min); scrubEls.head.setAttribute("x1", st.min); scrubEls.head.setAttribute("x2", st.min); }
  const every = st.page === "insights" ? 1000 : st.page === "controls" ? 700 : 250;
  if (now - lastUI > every) { lastUI = now; if (st.page === "insights") updateBar(); else tick(); }
  requestAnimationFrame(frame);
}
RM.addEventListener && RM.addEventListener("change", () => go(st.page));
syncPlay(); syncSpeed(); syncScen(); buildScrub();
go((location.hash || "#overview").slice(1));
requestAnimationFrame(frame);
})();
