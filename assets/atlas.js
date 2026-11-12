(async () => {
try {
/* One map over several collections. view.json, beside the page, lists them and where their files are (root): the main
   atlas (atlas/) shows one month from every collection, only the episodes dated in that month of that year (view
   month), across the series span; a full-year atlas (<year>/atlas/) shows one whole collection. Each collection's
   episodes load the first time it is shown, and the base map (1910 counties) is one shared file. */
const get = url => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.json(); });
/* view.json is always revalidated; a year's files carry its export id, so a browser never pairs new code with an
   older export it has cached (GitHub Pages lets browsers cache for ten minutes) */
const V = await fetch("view.json", {cache: "no-cache"}).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for view.json`); return r.json(); });
const YEARS = V.years.slice().sort((a, b) => a.year - b.year), BY = Object.fromEntries(YEARS.map(y => [y.year, y]));
const ROOT = V.root, ONE = YEARS.length === 1;
const NS = "http://www.w3.org/2000/svg";
const CATS = [
 {k:"lyn", label:"Lynchings: completed, attempted, threatened", short:"Lynching", v:"--s1", test:e=>e.type==="lynching"},
 {k:"mob", label:"Mob, night-rider and community violence", short:"Mob or community", v:"--s2", test:e=>!["lynching","police_violence","posse_killing"].includes(e.type)},
 {k:"pol", label:"Police and posse violence", short:"Police or posse", v:"--s3", test:e=>["police_violence","posse_killing"].includes(e.type)}];
const TYPE = {lynching:"Lynching", mob_assault:"Mob assault", police_violence:"Police violence", posse_killing:"Posse killing",
 whitecapping:"Whitecapping", expulsion:"Expulsion", labor:"Labor conflict", intimidation:"Intimidation",
 community_attack:"Attack on a community", arson_bombing:"Arson or bombing", peonage:"Peonage", insufficient:"Unclassified",
 other:"Other"};
const SEC = {lead:"", background:"Background", events:"What happened", aftermath:"Aftermath", press:"Press coverage",
 disputed:"Disputed points", legacy:"Legacy"};
const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const el = (n, a = {}, p) => { const x = document.createElementNS(NS, n); for (const k in a) x.setAttribute(k, a[k]); if (p) p.appendChild(x); return x; };
const states = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",IT:"Indian Territory"};

/* a year's episodes, with dates kept at the precision the record gives: "~" or prec "approx" reads "about",
   a missing month stays unknown */
const loaded = {};
function prep(y, ep) {
  const raw = ep.date || "", approx = raw.startsWith("~") || ep.prec === "approx";
  let [yr, m, d] = raw.replace("~", "").split("-").map(Number);
  if (!yr) yr = y;
  if (!m) m = d = undefined;
  const prec = !m ? "year" : ep.prec === "week" && d ? "week" : d && ep.prec !== "month" ? "day" : "month";
  let t0, t1, t;
  if (prec === "day") { t = Date.UTC(yr, m - 1, d); t0 = t1 = t; }
  else if (prec === "week") { t = Date.UTC(yr, m - 1, d); t0 = t - 3 * 864e5; t1 = t + 3 * 864e5; }
  else if (prec === "month") { t0 = Date.UTC(yr, m - 1, 1); t1 = Date.UTC(yr, m, 0); t = (t0 + t1) / 2; }
  else { t0 = Date.UTC(yr, 0, 1); t1 = Date.UTC(yr, 11, 31); t = t1 + 864e5; }
  const base = prec === "day" ? `${MON[m - 1]} ${d}, ${yr}` : prec === "week" ? `week of ${MON[m - 1]} ${d}, ${yr}`
    : prec === "month" ? `${MON[m - 1]} ${yr}` : `${yr}, month unknown`;
  return {...ep, coll: y, key: `${y}:${ep.dir}`, t, t0, t1, prec, yr, m, d, cat: CATS.find(c => c.test(ep)),
    when: (approx && prec !== "year" ? "about " : "") + base, place: [ep.city, ep.state].filter(Boolean).join(", ") || ep.state};
}
/* in the series, a slice keeps the episodes whose stated date (approximate or not) falls in its month; the build
   counts them with the same rule */
function load(y) {
  return loaded[y] ||= get(`${ROOT}${y}/atlas/data.json?v=${BY[y].export_id}`).then(g => {
    const E = g.episodes.map(ep => prep(y, ep));
    return {...g, E: V.month ? E.filter(e => e.yr === y && e.m === V.month) : E};
  });
}
const first = await load(YEARS[YEARS.length - 1].year);
const G = await get(`${V.basemaps}basemap-${first.basemap}.json`);

/* controls: year, search, state, month */
const controls = document.createElement("div");
controls.className = "filters";
controls.innerHTML = `<label${ONE ? " hidden" : ""}>Year<select id="year-filter"><option value="all">All years</option>${YEARS.map(y => `<option value="${y.year}">${esc(y.label)}</option>`).join("")}</select></label>
<label class="grow">Search cases<input id="case-search" type="search" placeholder="Name, place, or keyword" autocomplete="off"></label>
<label>State<select id="state-filter"></select></label>
<label id="month-wrap">Month<select id="month-filter"></select></label>
<button id="clear-filters" type="button">Clear filters</button><span id="filter-count" role="status" aria-live="polite"></span>`;
document.getElementById("legend").before(controls);
const yearSel = controls.querySelector("#year-filter"), search = controls.querySelector("#case-search"),
  stateFilter = controls.querySelector("#state-filter"), monthFilter = controls.querySelector("#month-filter");
const on = new Set(CATS.map(c => c.k));
let E = [], sel = null, cur = null;
function matches(e) {
  const q = search.value.trim().toLocaleLowerCase();
  return on.has(e.cat.k) && (!stateFilter.value || e.state === stateFilter.value) && (!monthFilter.value || e.m === Number(monthFilter.value)) &&
    (!q || [e.title,e.city,e.state,states[e.state],e.county,e.summary].filter(Boolean).join(" ").toLocaleLowerCase().includes(q));
}
[search,stateFilter,monthFilter].forEach(x => x.addEventListener(x === search ? "input" : "change", applyFilter));
yearSel.addEventListener("change", () => { history.pushState(null, "", `#year=${yearSel.value}`); route(); });
const listHash = () => ONE ? location.pathname + location.search : `#year=${sel}`;
function resetFilters() {
  search.value = stateFilter.value = monthFilter.value = "";
  CATS.forEach(c => on.add(c.k));
  leg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", "true"));
}
controls.querySelector("#clear-filters").onclick = () => { resetFilters(); applyFilter(); };

/* legend */
const leg = document.getElementById("legend");
CATS.forEach(c => {
  const b = document.createElement("button");
  b.type = "button"; b.setAttribute("aria-pressed", "true"); c.btn = b;
  b.onclick = () => { on.has(c.k) ? on.delete(c.k) : on.add(c.k); b.setAttribute("aria-pressed", on.has(c.k)); applyFilter(); };
  leg.appendChild(b);
});
leg.insertAdjacentHTML("beforeend", `<span class="key"><span class="solid"></span>a Black person killed <span class="ring"></span>no one killed</span>`);

/* marks share one drawing rule */
function mark(g, e, x, y, r) {
  const col = `var(${e.cat.v})`;
  if (e.killed > 0) r += 1.25; /* a ring's stroke sits half outside its radius: match the filled dot's visible size */
  return el("circle", {cx: x, cy: y, r, "data-r": r, fill: e.killed > 0 ? col : "var(--sheet)", stroke: e.killed > 0 ? "none" : col,
    "stroke-width": e.killed > 0 ? 0 : 2.5}, g);
}
let hooks = new Map(); // episode key -> [g elements]
function wire(g, e) {
  g.classList.add("mk"); g.setAttribute("tabindex", "0"); g.setAttribute("role", "button");
  g.setAttribute("aria-label", `${e.title}, ${e.when}, ${e.place}`);
  g.addEventListener("pointerenter", () => { clearTimeout(tipT); hover(e); anchorTip(g); });
  g.addEventListener("pointerleave", () => hideSoon());
  g.addEventListener("focus", () => { clearTimeout(tipT); hover(e); anchorTip(g); });
  g.addEventListener("blur", () => hover(null));
  g.addEventListener("click", () => openEp(e));
  g.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openEp(e); } });
  (hooks.get(e.key) || hooks.set(e.key, []).get(e.key)).push(g);
}

/* map: the base layers are drawn once; the press shading and the marks change with the year */
const W = G.w, H = G.h;
const ms = el("svg", {viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Map of the United States with 1910 county lines and the episodes"});
const mapEl = document.getElementById("map");
mapEl.appendChild(ms);
const NSS = {"vector-effect": "non-scaling-stroke"}; /* lines keep their width when zoomed */
el("path", {d: G.nation, fill: "var(--land)", stroke: "none"}, ms);
const pressPath = el("path", {d: "", fill: "var(--press)", stroke: "none"}, ms);
el("path", {d: Object.values(G.counties).join(""), fill: "none", stroke: "var(--county)", "stroke-width": .4, ...NSS}, ms);
el("path", {d: G.states, fill: "none", stroke: "var(--state)", "stroke-width": .8, "stroke-linejoin": "round", ...NSS}, ms);
const hov = el("path", {d: "", fill: "var(--hl)", stroke: "var(--ink)", "stroke-width": 1.2, ...NSS}, ms);
const mg = el("g", {}, ms);

/* pan and zoom: move the viewBox; sizeMarks keeps the marks the same size on screen */
const vb = {x: 0, y: 0, w: W, h: H}, ZMAX = 16;
const zc = document.createElement("div"); zc.className = "zoom";
zc.innerHTML = `<button type="button" aria-label="Zoom in">+</button><button type="button" aria-label="Zoom out">&minus;</button>`
  + `<button type="button" aria-label="Show the whole map" title="Whole map">&#x2922;</button>`;
mapEl.appendChild(zc);
const [zin, zout, zall] = zc.querySelectorAll("button");
function clampV(v) {
  const w = Math.min(W, Math.max(W / ZMAX, v.w)), h = w * H / W;
  return {x: Math.min(W - w, Math.max(0, v.x)), y: Math.min(H - h, Math.max(0, v.y)), w, h};
}
let lastW = W;
function setVB() {
  Object.assign(vb, clampV(vb));
  ms.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  const z = tgt.w < W - .01; mapEl.classList.toggle("zoomed", vb.w < W - .01);
  zout.disabled = zall.disabled = !z; zin.disabled = tgt.w <= W / ZMAX + .01;
  if (Math.abs(vb.w - lastW) > 1e-6) { lastW = vb.w; sizeMarks(); }
}
/* zooms glide: each frame moves the view part way to the target (width in log space, x/y in step so the point under
   the cursor stays put); drags and pinches set both and draw on the next frame */
let tgt = {...vb}, raf = 0;
const still = matchMedia("(prefers-reduced-motion:reduce)");
function frame() {
  raf = 0;
  const a = still.matches ? 1 : .2, dw = tgt.w - vb.w;
  const w = Math.abs(dw) < 1e-3 ? tgt.w : Math.exp(Math.log(vb.w) + (Math.log(tgt.w) - Math.log(vb.w)) * a);
  const lam = Math.abs(dw) < 1e-3 ? a : (w - vb.w) / dw;
  vb.x += (tgt.x - vb.x) * lam; vb.y += (tgt.y - vb.y) * lam; vb.w = w;
  if (Math.abs(tgt.w - vb.w) < .01 && Math.abs(tgt.x - vb.x) < .05 && Math.abs(tgt.y - vb.y) < .05) Object.assign(vb, tgt);
  setVB();
  if (vb.w !== tgt.w || vb.x !== tgt.x || vb.y !== tgt.y) raf = requestAnimationFrame(frame);
}
const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
function jump(v) { tgt = clampV(v); Object.assign(vb, tgt); kick(); }
function toUser(cx, cy, b = vb) { const r = ms.getBoundingClientRect(); return [b.x + (cx - r.left) / r.width * b.w, b.y + (cy - r.top) / r.height * b.h]; }
function zoomAt(f, cx, cy) { /* f > 1 zooms in, around the screen point (cx, cy); repeated calls build on the target */
  const r = ms.getBoundingClientRect(), fx = cx == null ? .5 : (cx - r.left) / r.width, fy = cy == null ? .5 : (cy - r.top) / r.height;
  const ux = tgt.x + fx * tgt.w, uy = tgt.y + fy * tgt.h, w = Math.min(W, Math.max(W / ZMAX, tgt.w / f));
  tgt = clampV({x: ux - fx * w, y: uy - fy * (w * H / W), w}); kick();
}
zin.onclick = () => zoomAt(2);
zout.onclick = () => zoomAt(.5);
zall.onclick = () => { tgt = {x: 0, y: 0, w: W, h: H}; kick(); };
ms.addEventListener("wheel", ev => {
  if (!ev.ctrlKey && !ev.metaKey) return; /* plain scrolling still scrolls the page; trackpad pinches arrive with ctrlKey */
  ev.preventDefault(); hover(null);
  zoomAt(Math.min(2, Math.max(.5, Math.exp(-ev.deltaY * (ev.deltaMode ? .05 : .006)))), ev.clientX, ev.clientY);
}, {passive: false});
ms.addEventListener("dblclick", ev => { ev.preventDefault(); zoomAt(ev.shiftKey ? .5 : 2, ev.clientX, ev.clientY); });
const ptrs = new Map();
let pan = null, pinch = null, moved = false;
const mid = () => { const p = [...ptrs.values()]; return [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2, Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1])]; };
function startGesture() {
  pan = pinch = null;
  if (ptrs.size === 1) { const [x, y] = [...ptrs.values()][0]; pan = {x, y, vb: {...vb}}; }
  if (ptrs.size === 2) { const [mx, my, d] = mid(); pinch = {d: Math.max(d, 1), vb: {...vb}, u: toUser(mx, my)}; }
}
ms.addEventListener("pointerdown", ev => {
  if (ev.pointerType === "mouse" && ev.button !== 0) return;
  ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]); if (ptrs.size === 1) moved = false; tgt = {...vb}; startGesture();
});
ms.addEventListener("pointermove", ev => {
  if (!ptrs.has(ev.pointerId)) return;
  ptrs.set(ev.pointerId, [ev.clientX, ev.clientY]);
  const r = ms.getBoundingClientRect();
  if (pinch && ptrs.size === 2) {
    const [mx, my, d] = mid(); moved = true; hover(null);
    const w = Math.min(W, Math.max(W / ZMAX, pinch.vb.w * pinch.d / Math.max(d, 1))), h = w * H / W;
    jump({x: pinch.u[0] - (mx - r.left) / r.width * w, y: pinch.u[1] - (my - r.top) / r.height * h, w});
  } else if (pan && ptrs.size === 1) {
    const dx = ev.clientX - pan.x, dy = ev.clientY - pan.y;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    if (!moved) { moved = true; hover(null); ms.classList.add("drag"); ms.setPointerCapture(ev.pointerId); }
    jump({x: pan.vb.x - dx / r.width * pan.vb.w, y: pan.vb.y - dy / r.height * pan.vb.h, w: pan.vb.w});
  }
});
function endPtr(ev) { if (!ptrs.delete(ev.pointerId)) return; ms.classList.remove("drag"); startGesture(); }
ms.addEventListener("pointerup", endPtr); ms.addEventListener("pointercancel", endPtr);
ms.addEventListener("click", ev => { if (moved) { ev.stopPropagation(); ev.preventDefault(); moved = false; } }, true);

/* keep map marks a readable, tappable size when the map is drawn small (phones) */
function sizeMarks() {
  const k = Math.max(1, Math.min(2.6, W / Math.max(1, ms.clientWidth) * 0.55)) * vb.w / W;
  E.forEach(e => { const h = e.mapHit, c = e.mapMark; if (!c) return; const rr = 5.5 * k + (e.killed > 0 ? 1.25 * Math.min(k, 1.6) : 0);
    h.setAttribute("r", 11 * k); c.setAttribute("r", rr); c.dataset.r = rr;
    if (e.killed <= 0) c.setAttribute("stroke-width", 2.5 * Math.min(k, 1.6)); });
}
addEventListener("resize", sizeMarks);

/* timeline. One year: a column per covered month (other years and months fold into the end columns), plus one for
   episodes whose month is unknown; a one-month slice gets a column per day, plus one for episodes known only to the
   month. All years: a column per collection, or, when the view has a span (the series), each collection's column at
   its year on an axis across the span, so years not yet collected show as gaps. Each episode is one dot, stacked in a
   small grid by type, then date; when a column would need too many rows, columns show stacked bars by type instead
   (select a bar to open that year). */
const tlEl = document.getElementById("tl"), tlCap = document.getElementById("tlcap");
function drawTimeline() {
  tlEl.textContent = "";
  const TW = 960, L = 8, R = 8, AW = TW - L - R, DS = 13;
  let cols, byC, pick = null, xs = null, CW, ticks = null, unit = "month";
  if (sel === "all") {
    unit = "year";
    cols = YEARS.map(y => ({label: y.label, short: String(y.year)})); byC = YEARS.map(y => E.filter(e => e.coll === y.year));
    pick = i => { history.pushState(null, "", `#year=${YEARS[i].year}`); route(); };
    if (V.span) {
      const [S0, S1] = V.span, py = AW / (S1 - S0 + 1);
      CW = py * Math.min(5, ...YEARS.slice(1).map((y, i) => y.year - YEARS[i].year));
      xs = YEARS.map(y => L + (y.year - S0 + .5) * py - CW / 2);
      ticks = [];
      for (let t = Math.ceil(S0 / 10) * 10; t <= S1; t += 10) ticks.push([L + (t - S0 + .5) * py, t]);
    }
  } else {
    const [M0, M1] = BY[sel].months || [1, 12];
    if (M0 === M1) {
      unit = "day";
      const nd = new Date(Date.UTC(sel, M0, 0)).getUTCDate(), noDay = E.some(e => e.prec !== "day" && e.prec !== "week");
      cols = Array.from({length: nd}, (_, i) => ({label: `${MON[M0 - 1].slice(0, 3)} ${i + 1}`, short: String(i + 1)}))
        .concat(noDay ? [{label: "Day unknown", short: "?"}] : []);
      byC = cols.map(() => []);
      E.forEach(e => byC[e.prec === "day" || e.prec === "week" ? Math.min(nd, e.d) - 1 : cols.length - 1].push(e));
    } else {
      const undated = E.some(e => e.prec === "year"), NM = M1 - M0 + 1;
      cols = Array.from({length: NM}, (_, i) => MON[M0 - 1 + i].slice(0, 3)).concat(undated ? ["Month unknown"] : []).map(c => ({label: c, short: c.slice(-2)}));
      byC = cols.map(() => []);
      E.forEach(e => byC[e.prec === "year" ? cols.length - 1 : e.yr < sel ? 0 : e.yr > sel ? NM - 1 : Math.min(NM - 1, Math.max(0, e.m - M0))].push(e));
    }
  }
  const NC = cols.length;
  if (!xs) { CW = AW / NC; xs = cols.map((_, c) => L + c * CW); }
  const PER = Math.max(1, Math.floor((CW - 8) / DS));
  const catIx = c => CATS.indexOf(c);
  byC.forEach(list => list.sort((a, b) => catIx(a.cat) - catIx(b.cat) || a.t - b.t));
  const dotRows = Math.max(1, ...byC.map(list => Math.ceil(list.length / PER))), bars = dotRows > 40;
  const nRows = bars ? 12 : dotRows, PADT = ticks ? 24 : 12, TH = PADT + nRows * DS + 34, base = PADT + nRows * DS + 2;
  const ts = el("svg", {viewBox: `0 0 ${TW} ${TH}`, role: "img", "aria-label": sel === "all" ? "Episodes by year"
    : `Episodes by ${unit}, ${BY[sel].label}`});
  tlEl.appendChild(ts);
  const small = NC > 16, label = (x, y, t, size, fill = "var(--muted)") => {
    const tx = el("text", {x, y, "text-anchor": "middle", fill, "font-size": size}, ts); tx.textContent = t; };
  if (ticks) {
    ticks.forEach(([x, t]) => { el("line", {x1: x, x2: x, y1: PADT - 8, y2: base + 6, stroke: "var(--rule)", "stroke-width": 1}, ts);
      label(x, base + 18, t, 12); });
  } else {
    for (let c = 0; c <= NC; c++) {
      const x = L + c * CW;
      el("line", {x1: x, x2: x, y1: PADT - 8, y2: base + 22, stroke: "var(--rule)", "stroke-width": 1}, ts);
      if (c < NC) label(x + CW / 2, base + 18, small ? cols[c].short : `${cols[c].label} ${byC[c].length}`, small ? 10 : 13);
    }
  }
  el("line", {x1: L, x2: TW - R, y1: base, y2: base, stroke: "var(--state)", "stroke-width": 1}, ts);
  const scale = bars ? (nRows * DS - 4) / Math.max(...byC.map(l => l.length)) : 0;
  /* on the span axis each column is labelled above its stack: the year and its count */
  if (ticks) byC.forEach((list, c) => label(xs[c] + CW / 2, base - (bars ? list.length * scale : Math.ceil(list.length / PER) * DS) - 6,
    `${cols[c].short}: ${list.length}`, 11, "var(--ink)"));
  if (bars) {
    byC.forEach((list, c) => {
      let y = base; const g = el("g", {class: "mk", tabindex: "0", role: "button", "aria-label": `${cols[c].label}: ${list.length} episodes`}, ts);
      CATS.forEach(cat => { const n = list.filter(e => e.cat === cat).length, hgt = n * scale; y -= hgt;
        if (n) el("rect", {x: xs[c] + 3, y, width: Math.max(1, CW - 6), height: hgt, fill: `var(${cat.v})`}, g); });
      if (pick) { g.addEventListener("click", () => pick(c)); g.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(c); } }); }
    });
    tlCap.textContent = `Episodes per ${unit}, stacked by type; select a ${unit === "year" ? "year" : "bar"} to see its episodes one by one.`
      + (ticks ? ` Years with no bar have not been collected yet.` : "");
    return;
  }
  byC.forEach((list, c) => {
    const x0 = xs[c] + (CW - PER * DS) / 2 + DS / 2;
    list.forEach((e, i) => {
      const x = x0 + (i % PER) * DS, y = base - DS / 2 - 1 - Math.floor(i / PER) * DS, g = el("g", {}, ts);
      el("rect", {x: x - DS / 2, y: y - DS / 2, width: DS, height: DS, fill: "transparent"}, g);
      mark(g, e, x, y, 4.5); wire(g, e); e.tlG = g;
    });
  });
  tlCap.innerHTML = sel === "all"
    ? (ticks ? "Each dot is an episode, in its year&rsquo;s column on the axis, grouped by type; years with no column have not been collected yet."
      : "Each dot is an episode, in its collection&rsquo;s column, grouped by type; the number is the collection&rsquo;s total.")
    : unit === "day" ? "Each dot is an episode, on the day it happened, grouped by type; episodes dated only to the month are in the last column."
    : "Each dot is an episode, in the month it happened, grouped by type; the number is the month&rsquo;s total.";
}

/* show a year (or all): marks, shading, filters, header, timeline */
const titleEl = document.getElementById("title"), dekEl = document.getElementById("dek");
async function showYear(y) {
  if (sel === y) return;
  const ys = y === "all" ? YEARS.map(x => x.year) : [y];
  const data = await Promise.all(ys.map(load));
  sel = y; yearSel.value = String(y); cur = null; hover(null);
  E = data.flatMap(d => d.E).sort((a, b) => a.t - b.t);
  hooks = new Map(); mg.textContent = "";
  [...E].sort((a, b) => b.killed - a.killed).forEach(e => {
    const g = el("g", {}, mg); el("circle", {cx: e.x, cy: e.y, r: 11, fill: "transparent"}, g);
    e.mapHit = g.firstChild; e.mapMark = mark(g, e, e.x, e.y, 5.5); wire(g, e); e.mapG = g; e.tlG = null;
  });
  const press = y === "all" ? [] : data[0].papers || [];
  pressPath.setAttribute("d", press.map(k => G.counties[k] || "").join(""));
  const st = [...new Set(E.map(e => e.state).filter(Boolean))].sort((a, b) => (states[a] || a).localeCompare(states[b] || b));
  stateFilter.innerHTML = `<option value="">All states</option>` + st.map(s => `<option value="${esc(s)}">${esc(states[s] || s)}</option>`).join("");
  const [M0, M1] = y === "all" ? [1, 12] : BY[y].months || [1, 12];
  const allLabel = V.all_label || "all years";
  monthFilter.innerHTML = `<option value="">All months</option>` + MON.map((m, i) => i + 1 >= M0 && i + 1 <= M1 ? `<option value="${i + 1}">${m}</option>` : "").join("");
  document.getElementById("month-wrap").hidden = y === "all" || M0 === M1;
  resetFilters();
  CATS.forEach(c => { c.btn.innerHTML = `<span class="dot" style="background:var(${c.v})"></span>${esc(c.label)} <span class="muted">${E.filter(e => e.cat === c).length}</span>`; });
  titleEl.textContent = `Atlas of Anti-Black Violence, ${y === "all" ? allLabel : BY[y].label}`;
  document.title = titleEl.textContent;
  dekEl.innerHTML = y === "all" ? V.all_dek || "" : BY[y].atlas_dek || "";
  const nEl = document.getElementById("n"); if (nEl) nEl.textContent = E.length;
  const nCentre = E.filter(e => e.loc !== "place").length;
  document.getElementById("mapcap").innerHTML = `County lines as of 1910 (Atlas of Historical County Boundaries). The county under a selected episode is outlined. `
    + (press.length ? `<span class="swatch"></span> The ${press.length} slightly darker counties had a ${y} paper in our sources (Chronicling America, American Stories or the Dangerous Press). `
      : y === "all" ? "Choose a year to shade the counties with a paper in our sources. " : `Counties with a ${y} paper in our sources are not shaded for this year yet. `)
    + `${E.length - nCentre} episodes sit at their town; ${nCentre} whose town is not in the gazetteers sit at the centre of their 1910 county. `
    + `Drag to pan; zoom with the buttons, a double-click, a pinch, or Ctrl/⌘ and the scroll wheel.`;
  drawTimeline(); sizeMarks();
}

/* tooltip + linked highlight */
const tip = document.getElementById("tip");
/* the tip stays put beside its mark and stays open while the pointer is on it, so it can be clicked */
let tipE = null, tipT = 0, highlighted = null;
function hideSoon() { clearTimeout(tipT); tipT = setTimeout(() => hover(null), 350); }
tip.addEventListener("pointerenter", () => clearTimeout(tipT));
tip.addEventListener("pointerleave", () => hideSoon());
tip.addEventListener("click", () => { if (tipE) { const e = tipE; hover(null); openEp(e); } });
function anchorTip(g) { const r = g.getBoundingClientRect(); placeTip(r.right - 4, r.top + r.height / 2 - 12, r); }
function hover(e) {
  tipE = e;
  if (highlighted) (hooks.get(highlighted.key) || []).forEach(g => { const c = g.querySelector("circle[data-r]"); c.setAttribute("r", c.dataset.r); });
  if (e) (hooks.get(e.key) || []).forEach(g => { const c = g.querySelector("circle[data-r]"); c.setAttribute("r", +c.dataset.r * 1.5); });
  highlighted = e;
  const selected = e || cur;
  hov.setAttribute("d", selected && G.counties[selected.ahcb] ? G.counties[selected.ahcb] : "");
  if (e && e.mapG) mg.appendChild(e.mapG);
  if (!e) { tip.hidden = true; return; }
  tip.innerHTML = `<b>${esc(e.title)}</b><div class="m">${esc(e.when)} · ${esc(e.place)}${e.county ? ` · ${esc(e.county)} Co.` : ""}</div>${esc(e.summary)}`;
  tip.hidden = false;
}
function placeTip(x, y, r) {
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let l = x + 4, t = y;
  if (l + w > innerWidth - 8) l = (r ? r.left + 4 : x) - w - 4;
  if (t + h > innerHeight - 8) t = innerHeight - h - 8;
  tip.style.left = Math.max(8, l) + "px"; tip.style.top = Math.max(8, t) + "px";
}

/* side panel */
const side = document.getElementById("sidein");
const marks = e => [e.mapG, e.tlG].filter(Boolean);
const caseHash = e => `#${ONE ? "" : `year=${e.coll}&`}case=${encodeURIComponent(e.dir)}`;
function showList(updateUrl = true) {
  if (cur) marks(cur).forEach(g => g.classList.remove("selected"));
  cur = null; hov.setAttribute("d", "");
  if (updateUrl) history.pushState(null, "", listHash());
  const many = sel === "all";
  side.innerHTML = `<p class="eyebrow">Episodes by date</p><h2>${E.length} episodes, ${esc(many ? V.all_label || "all years" : BY[sel].label)}</h2>
   <p class="cap">Select one to read its account.</p><ul class="list" id="list"></ul>`;
  const ul = side.querySelector("#list");
  E.forEach(e => {
    const li = document.createElement("li"); li.dataset.cat = e.cat.k; e.listItem = li;
    const sw = e.killed > 0 ? `<span class="dot" style="background:var(${e.cat.v})"></span>` : `<span class="ring2" style="border-color:var(${e.cat.v})"></span>`;
    const dl = e.prec === "day" || e.prec === "week" ? MON[e.m - 1].slice(0, 3) + " " + e.d : e.prec === "month" ? MON[e.m - 1].slice(0, 3) + " (mo.)" : "(date?)";
    li.innerHTML = `<button type="button">${sw}<span class="d">${dl}${many ? ` ${e.yr}` : ""}</span><span>${esc(e.title)}<br><span class="d">${esc(e.place)}</span></span></button>`;
    const b = li.firstChild;
    b.onclick = () => openEp(e); b.onmouseenter = () => { clearTimeout(tipT); hover(e); const g = (hooks.get(e.key) || [])[0]; if (g) anchorTip(g); }; b.onmouseleave = () => hideSoon();
    b.onfocus = () => hov.setAttribute("d", G.counties[e.ahcb] || ""); b.onblur = () => hov.setAttribute("d", "");
    ul.appendChild(li);
  });
  const empty = document.createElement("p"); empty.id = "no-results"; empty.className = "cap"; empty.textContent = "No episodes match these filters."; side.appendChild(empty);
  applyFilter();
}
async function openEp(e, updateUrl = true) {
  if (cur) marks(cur).forEach(g => g.classList.remove("selected"));
  cur = e; hover(null);
  marks(e).forEach(g => g.classList.add("selected"));
  if (updateUrl && location.hash !== caseHash(e)) history.pushState(null, "", caseHash(e));
  side.innerHTML = `<button class="back" type="button" id="back">← All episodes</button><p>Loading account…</p>`;
  side.querySelector("#back").onclick = () => showList();
  if (matchMedia("(max-width:1040px)").matches) document.getElementById("side").scrollIntoView({block: "start"});
  try {
    const response = await fetch(`${ROOT}${e.coll}/cases/${encodeURIComponent(e.dir)}.json?v=${BY[e.coll].export_id}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const detail = await response.json();
    if (cur !== e) return;
    e.text = detail.atlas?.text || [];
  } catch (error) {
    if (cur !== e) return;
    side.innerHTML = `<button class="back" type="button" id="back">← All episodes</button><p role="alert">Could not load this account. Please try again.</p><button type="button" id="retry">Retry</button>`;
    side.querySelector("#back").onclick = () => showList();
    side.querySelector("#retry").onclick = () => openEp(e);
    return;
  }
  const facts = [["Date", e.when], ["Place", e.place], ["1910 county", e.county ? `${e.county} County, ${e.county_state || e.state}` + (e.fips && e.fips[0] ? ` (FIPS ${e.fips[0].fips})` : "") : "not assigned"],
    ["Type", (TYPE[e.type] || String(e.type || "unknown").replace(/_/g, " ")) + (e.stage ? `, ${e.stage}` : "")], ["Black people killed", e.killed ?? "unknown"], ["Evidence", (e.evidence || "").replace(/_/g, " ")]]
    .concat(e.lists ? [["On existing lists", e.lists]] : []).concat(sel === "all" ? [["Collection", BY[e.coll].label]] : []);
  const text = (e.text || []).map(s => (SEC[s.section] === "" ? "" : `<h3>${esc(SEC[s.section] || s.section.replace(/_/g, " "))}</h3>`)
    + s.paras.map(p => `<p>${esc(p)}</p>`).join("")).join("");
  side.innerHTML = `<button class="back" type="button" id="back">← All episodes</button>
   <p class="eyebrow">${esc(e.cat.short)}${e.killed > 0 ? " · killing" : ""}</p><h2>${esc(e.title)}</h2>
   <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
   ${e.doubt ? `<div class="doubt"><b>Doubt noted:</b> ${esc(e.doubt)}</div>` : ""}
   ${text}
   <p><a class="more" href="${caseHash(e)}">Link to this case</a></p>
   <p><a class="more" href="${ROOT}${e.coll}/reader/#${encodeURIComponent(e.dir)}" target="_blank" rel="noopener">Clippings and sources in the dossier reader ↗</a></p>`;
  side.querySelector("#back").onclick = () => { showList(); };
  document.getElementById("side").scrollTop = 0;
  if (matchMedia("(max-width:1040px)").matches) document.getElementById("side").scrollIntoView({behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "start"});
  else side.querySelector("#back").focus({preventScroll: true});
  hov.setAttribute("d", G.counties[e.ahcb] || "");
}
function applyFilter() {
  let count = 0;
  E.forEach(e => {
    const visible = matches(e); if (visible) count++;
    marks(e).forEach(g => { g.classList.toggle("dim", !visible); g.setAttribute("tabindex", visible ? "0" : "-1"); g.setAttribute("aria-hidden", visible ? "false" : "true"); });
    if (e.listItem) e.listItem.hidden = !visible;
  });
  controls.querySelector("#filter-count").textContent = `${count} of ${E.length} episodes`;
  const empty = document.getElementById("no-results"); if (empty) empty.hidden = count !== 0;
  if (cur && !matches(cur)) showList();
}
/* #year=<year|all>[&case=<id>]; without a year, the default from view.json. A case outside the series month goes to
   its year's full atlas when there is one. */
async function route() {
  const params = new URLSearchParams(location.hash.slice(1));
  const last = YEARS[YEARS.length - 1].year, want = params.get("year") || String(V.default || last);
  const y = want === "all" ? "all" : BY[+want] ? +want : last;
  const changed = sel !== y;
  await showYear(y);
  const id = params.get("case");
  const e = id && E.find(item => item.dir === id && (sel === "all" || item.coll === sel));
  if (id && !e && sel !== "all" && BY[sel].full) { location.replace(`${BY[sel].full}#case=${encodeURIComponent(id)}`); return; }
  if (e) {
    if (!matches(e)) { resetFilters(); applyFilter(); }
    if (changed || !side.querySelector("#list") && !cur) showList(false);
    openEp(e, false);
    const width = W / 2; tgt = clampV({x:e.x-width/2, y:e.y-(width*H/W)/2, w:width}); kick();
  } else showList(false);
}
addEventListener("popstate", route);
addEventListener("hashchange", route);
setVB();
await route();

} catch (error) {
console.error(error);
const notice = document.createElement("p");
notice.setAttribute("role", "alert");
notice.textContent = `The page data could not be loaded (${error.message}). Please reload; if it persists, serve this site over HTTP.`;
document.body.prepend(notice);
}
})();
