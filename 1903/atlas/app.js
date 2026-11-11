(async () => {
try {
const response = await fetch("data.json");
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const G = await response.json();
const READER = "../reader/", YEAR = 1903;
const NS = "http://www.w3.org/2000/svg";
const CATS = [
 {k:"lyn", label:"Lynchings: completed, attempted, threatened", short:"Lynching", v:"--s1", test:e=>e.type==="lynching"},
 {k:"mob", label:"Mob, night-rider and community violence", short:"Mob or community", v:"--s2", test:e=>!["lynching","police_violence","posse_killing"].includes(e.type)},
 {k:"pol", label:"Police and posse violence", short:"Police or posse", v:"--s3", test:e=>["police_violence","posse_killing"].includes(e.type)}];
const TYPE = {lynching:"Lynching", mob_assault:"Mob assault", police_violence:"Police violence", posse_killing:"Posse killing",
 whitecapping:"Whitecapping", expulsion:"Expulsion", labor:"Labor conflict", intimidation:"Intimidation",
 community_attack:"Attack on a community", arson_bombing:"Arson or bombing", other:"Other"};
const SEC = {lead:"", background:"Background", events:"What happened", aftermath:"Aftermath", press:"Press coverage",
 disputed:"Disputed points", legacy:"Legacy"};
const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const el = (n, a = {}, p) => { const x = document.createElementNS(NS, n); for (const k in a) x.setAttribute(k, a[k]); if (p) p.appendChild(x); return x; };

const E = G.episodes.map(e => {
  const raw = (e.date || "").replace("~", "");
  const [yr, m, d] = raw.split("-").map(Number);
  const prec = e.prec || (d ? "day" : "month");
  let t0, t1, t;
  if (prec === "day" && d) { t = Date.UTC(yr, m - 1, d); t0 = t1 = t; }
  else if (prec === "week" && d) { t = Date.UTC(yr, m - 1, d); t0 = t - 3 * 864e5; t1 = t + 3 * 864e5; }
  else { t0 = Date.UTC(yr, m - 1, 1); t1 = Date.UTC(yr, m, 0); t = (t0 + t1) / 2; }
  const cat = CATS.find(c => c.test(e));
  return {...e, t, t0, t1, prec, cat, yr, m, d,
    when: prec === "day" && d ? `${MON[m - 1]} ${d}, ${yr}` : prec === "week" && d ? `week of ${MON[m - 1]} ${d}, ${yr}` : `${MON[m - 1]} ${yr}`,
    place: [e.city, e.state].filter(Boolean).join(", ") || e.state};
}).sort((a, b) => a.t - b.t);
document.getElementById("n").textContent = E.length;
const on = new Set(CATS.map(c => c.k));
let cur = null;
const states = {AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming"};
const controls = document.createElement("div");
controls.className = "filters";
controls.innerHTML = `<label>Search cases<input id="case-search" type="search" placeholder="Name, place, or keyword" autocomplete="off"></label>
<label>State<select id="state-filter"><option value="">All states</option>${[...new Set(E.map(e => e.state).filter(Boolean))].sort((a,b) => (states[a] || a).localeCompare(states[b] || b)).map(st => `<option value="${esc(st)}">${esc(states[st] || st)}</option>`).join("")}</select></label>
<label>Month<select id="month-filter"><option value="">All months</option>${MON.map((m,i) => `<option value="${i+1}">${m}</option>`).join("")}</select></label>
<button id="clear-filters" type="button">Clear filters</button><span id="filter-count" role="status" aria-live="polite"></span>`;
document.getElementById("legend").before(controls);
const search = controls.querySelector("#case-search"), stateFilter = controls.querySelector("#state-filter"), monthFilter = controls.querySelector("#month-filter");
function matches(e) {
  const q = search.value.trim().toLocaleLowerCase();
  return on.has(e.cat.k) && (!stateFilter.value || e.state === stateFilter.value) && (!monthFilter.value || e.m === Number(monthFilter.value)) &&
    (!q || [e.title,e.city,e.state,states[e.state],e.county,e.summary].filter(Boolean).join(" ").toLocaleLowerCase().includes(q));
}
[search,stateFilter,monthFilter].forEach(el => el.addEventListener(el === search ? "input" : "change", applyFilter));
controls.querySelector("#clear-filters").onclick = () => {
  search.value = stateFilter.value = monthFilter.value = "";
  CATS.forEach(c => on.add(c.k));
  leg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", "true"));
  applyFilter();
};

/* legend */
const leg = document.getElementById("legend");
CATS.forEach(c => {
  const b = document.createElement("button");
  b.type = "button"; b.setAttribute("aria-pressed", "true");
  b.innerHTML = `<span class="dot" style="background:var(${c.v})"></span>${esc(c.label)} <span class="muted">${E.filter(e => e.cat === c).length}</span>`;
  b.onclick = () => { on.has(c.k) ? on.delete(c.k) : on.add(c.k); b.setAttribute("aria-pressed", on.has(c.k)); applyFilter(); };
  leg.appendChild(b);
});
leg.insertAdjacentHTML("beforeend", `<span class="key"><span class="solid"></span>a Black person killed <span class="ring"></span>no one killed</span>`);

/* marks share one drawing rule */
function mark(g, e, x, y, r) {
  const col = `var(${e.cat.v})`;
  if (e.killed > 0) r += 1.25; /* a ring's stroke sits half outside its radius: match the filled dot's visible size */
  const c = el("circle", {cx: x, cy: y, r, "data-r": r, fill: e.killed > 0 ? col : "var(--sheet)", stroke: e.killed > 0 ? "none" : col,
    "stroke-width": e.killed > 0 ? 0 : 2.5}, g);
  return c;
}
const hooks = new Map(); // id -> [g elements]
function wire(g, e) {
  g.classList.add("mk"); g.setAttribute("tabindex", "0"); g.setAttribute("role", "button");
  g.setAttribute("aria-label", `${e.title}, ${e.when}, ${e.place}`);
  g.addEventListener("pointerenter", () => { clearTimeout(tipT); hover(e); anchorTip(g); });
  g.addEventListener("pointerleave", () => hideSoon());
  g.addEventListener("focus", () => { clearTimeout(tipT); hover(e); anchorTip(g); });
  g.addEventListener("blur", () => hover(null));
  g.addEventListener("click", () => openEp(e));
  g.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openEp(e); } });
  (hooks.get(e.id) || hooks.set(e.id, []).get(e.id)).push(g);
}

/* map */
const W = G.w, H = G.h;
const ms = el("svg", {viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Map of the United States with 1910 county lines and the episodes"});
const mapEl = document.getElementById("map");
mapEl.appendChild(ms);
const NSS = {"vector-effect": "non-scaling-stroke"}; /* lines keep their width when zoomed */
el("path", {d: G.nation, fill: "var(--land)", stroke: "none"}, ms);
const press = G.papers || [];
el("path", {d: press.map(k => G.counties[k] || "").join(""), fill: "var(--press)", stroke: "none"}, ms);
el("path", {d: Object.values(G.counties).join(""), fill: "none", stroke: "var(--county)", "stroke-width": .4, ...NSS}, ms);
el("path", {d: G.states, fill: "none", stroke: "var(--state)", "stroke-width": .8, "stroke-linejoin": "round", ...NSS}, ms);
const hov = el("path", {d: "", fill: "var(--hl)", stroke: "var(--ink)", "stroke-width": 1.2, ...NSS}, ms);
const mg = el("g", {}, ms);
[...E].sort((a, b) => b.killed - a.killed).forEach(e => {
  const g = el("g", {}, mg); el("circle", {cx: e.x, cy: e.y, r: 11, fill: "transparent"}, g);
  e.mapHit = g.firstChild; e.mapMark = mark(g, e, e.x, e.y, 5.5); wire(g, e); e.mapG = g;
});
const nCentre = E.filter(e => e.loc !== "place").length;
document.getElementById("mapcap").innerHTML = `County lines as of 1910 (Atlas of Historical County Boundaries). The county under a selected episode is outlined. `
  + (press.length ? `<span class="swatch"></span> The ${press.length} slightly darker counties had a ${YEAR} paper in our sources (Chronicling America, American Stories or the Dangerous Press). ` : "")
  + `${E.length - nCentre} episodes sit at their town; ${nCentre} whose town is not in the gazetteers sit at the centre of their 1910 county. `
  + `Drag to pan; zoom with the buttons, a double-click, a pinch, or Ctrl/⌘ and the scroll wheel.`;

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

/* timeline: twelve month columns; each episode is one dot, stacked in a small grid by type, then date */
const TW = 960, L = 8, R = 8, CW = (TW - L - R) / 12, DS = 13, PER = Math.max(1, Math.floor((CW - 8) / DS));
const catIx = c => CATS.indexOf(c);
const byM = Array.from({length: 12}, () => []);
E.forEach(e => byM[e.yr < YEAR ? 0 : e.yr > YEAR ? 11 : e.m - 1].push(e));
byM.forEach(list => list.sort((a, b) => catIx(a.cat) - catIx(b.cat) || a.t - b.t));
const nRows = Math.max(1, ...byM.map(list => Math.ceil(list.length / PER)));
const PADT = 12, TH = PADT + nRows * DS + 34, base = PADT + nRows * DS + 2;
const ts = el("svg", {viewBox: `0 0 ${TW} ${TH}`, role: "img", "aria-label": `Episodes by month across ${YEAR}`});
document.getElementById("tl").appendChild(ts);
for (let m = 0; m <= 12; m++) {
  const x = L + m * CW;
  el("line", {x1: x, x2: x, y1: PADT - 8, y2: base + 22, stroke: "var(--rule)", "stroke-width": 1}, ts);
  if (m < 12) { const tx = el("text", {x: x + CW / 2, y: base + 18, "text-anchor": "middle", fill: "var(--muted)", "font-size": 13}, ts);
    tx.textContent = `${MON[m].slice(0, 3)} ${byM[m].length}`; }
}
el("line", {x1: L, x2: TW - R, y1: base, y2: base, stroke: "var(--state)", "stroke-width": 1}, ts);
byM.forEach((list, m) => {
  const x0 = L + m * CW + (CW - PER * DS) / 2 + DS / 2;
  list.forEach((e, i) => {
    const x = x0 + (i % PER) * DS, y = base - DS / 2 - 1 - Math.floor(i / PER) * DS, g = el("g", {}, ts);
    el("rect", {x: x - DS / 2, y: y - DS / 2, width: DS, height: DS, fill: "transparent"}, g);
    mark(g, e, x, y, 4.5); wire(g, e); e.tlG = g;
  });
});

/* keep map marks a readable, tappable size when the map is drawn small (phones) */
function sizeMarks() {
  const k = Math.max(1, Math.min(2.6, W / Math.max(1, ms.clientWidth) * 0.55)) * vb.w / W;
  E.forEach(e => { const h = e.mapHit, c = e.mapMark; const rr = 5.5 * k + (e.killed > 0 ? 1.25 * Math.min(k, 1.6) : 0);
    h.setAttribute("r", 11 * k); c.setAttribute("r", rr); c.dataset.r = rr;
    if (e.killed <= 0) c.setAttribute("stroke-width", 2.5 * Math.min(k, 1.6)); });
}
setVB(); sizeMarks(); addEventListener("resize", sizeMarks);

/* tooltip + linked highlight */
const tip = document.getElementById("tip");
/* the tip stays put beside its mark and stays open while the pointer is on it, so it can be clicked */
let tipE = null, tipT = 0, highlighted = null;
function hideSoon() { clearTimeout(tipT); tipT = setTimeout(() => hover(null), 350); }
tip.addEventListener("pointerenter", () => clearTimeout(tipT));
tip.addEventListener("pointerleave", () => hideSoon());
tip.addEventListener("click", () => { if (tipE) { const e = tipE; hover(null); openEp(e); } });
function anchorTip(g) { const r = g.getBoundingClientRect(); placeTip(r.right - 4, r.top + r.height / 2 - 12, r); }
function hover(e, ev) {
  tipE = e;
  if (highlighted) (hooks.get(highlighted.id) || []).forEach(g => { const c = g.querySelector("circle[data-r]"); c.setAttribute("r", c.dataset.r); });
  if (e) (hooks.get(e.id) || []).forEach(g => { const c = g.querySelector("circle[data-r]"); c.setAttribute("r", +c.dataset.r * 1.5); });
  highlighted = e;
  const selected = e || cur;
  hov.setAttribute("d", selected && G.counties[selected.ahcb] ? G.counties[selected.ahcb] : "");
  if (e) { mg.appendChild(e.mapG); }
  if (!e) { tip.hidden = true; return; }
  tip.innerHTML = `<b>${esc(e.title)}</b><div class="m">${esc(e.when)} · ${esc(e.place)}${e.county ? ` · ${esc(e.county)} Co.` : ""}</div>${esc(e.summary)}<div class="h">Click to read the full account</div>`;
  tip.hidden = false; if (ev) moveTip(ev);
}
function moveTip(ev) { placeTip(ev.clientX, ev.clientY); }
function placeTip(x, y, r) {
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let l = x + 4, t = y;
  if (l + w > innerWidth - 8) l = (r ? r.left + 4 : x) - w - 4;
  if (t + h > innerHeight - 8) t = innerHeight - h - 8;
  tip.style.left = Math.max(8, l) + "px"; tip.style.top = Math.max(8, t) + "px";
}

/* side panel */
const side = document.getElementById("sidein");
function showList(updateUrl = true) {
  if (cur) [cur.mapG, cur.tlG].forEach(g => g.classList.remove("selected"));
  cur = null; hov.setAttribute("d", "");
  if (updateUrl && location.hash) history.pushState(null, "", location.pathname + location.search);
  side.innerHTML = `<p class="eyebrow">Episodes by date</p><h2>${E.length} episodes, ${YEAR}</h2>
   <p class="cap">Select one to read its account.</p><ul class="list" id="list"></ul>`;
  const ul = side.querySelector("#list");
  E.forEach(e => {
    const li = document.createElement("li"); li.dataset.cat = e.cat.k; e.listItem = li;
    const sw = e.killed > 0 ? `<span class="dot" style="background:var(${e.cat.v})"></span>` : `<span class="ring2" style="border-color:var(${e.cat.v})"></span>`;
    li.innerHTML = `<button type="button">${sw}<span class="d">${e.prec === "day" && e.d ? MON[e.m - 1].slice(0, 3) + " " + e.d : MON[e.m - 1].slice(0, 3) + " (mo.)"}</span><span>${esc(e.title)}<br><span class="d">${esc(e.place)}</span></span></button>`;
    const b = li.firstChild;
    b.onclick = () => openEp(e); b.onmouseenter = () => { clearTimeout(tipT); hover(e); const g = (hooks.get(e.id) || [])[0]; if (g) anchorTip(g); }; b.onmouseleave = () => hideSoon();
    b.onfocus = () => hov.setAttribute("d", G.counties[e.ahcb] || ""); b.onblur = () => hov.setAttribute("d", "");
    ul.appendChild(li);
  });
  const empty = document.createElement("p"); empty.id = "no-results"; empty.className = "cap"; empty.textContent = "No episodes match these filters."; side.appendChild(empty);
  applyFilter();
}
async function openEp(e, updateUrl = true) {
  if (cur) [cur.mapG, cur.tlG].forEach(g => g.classList.remove("selected"));
  cur = e; hover(null);
  [e.mapG, e.tlG].forEach(g => g.classList.add("selected"));
  if (updateUrl && location.hash !== `#case=${encodeURIComponent(e.dir)}`) history.pushState(null, "", `#case=${encodeURIComponent(e.dir)}`);
  side.innerHTML = `<button class="back" type="button" id="back">← All episodes</button><p>Loading account…</p>`;
  side.querySelector("#back").onclick = () => showList();
  if (matchMedia("(max-width:1040px)").matches) document.getElementById("side").scrollIntoView({block: "start"});
  try {
    const response = await fetch(`../cases/${encodeURIComponent(e.dir)}.json`);
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
    ["Type", TYPE[e.type] + (e.stage ? `, ${e.stage}` : "")], ["Black people killed", e.killed], ["Evidence", (e.evidence || "").replace(/_/g, " ")]]
    .concat(e.lists ? [["On existing lists", e.lists]] : []);
  const text = (e.text || []).map(s => (SEC[s.section] === "" ? "" : `<h3>${esc(SEC[s.section] || s.section.replace(/_/g, " "))}</h3>`)
    + s.paras.map(p => `<p>${esc(p)}</p>`).join("")).join("");
  side.innerHTML = `<button class="back" type="button" id="back">← All episodes</button>
   <p class="eyebrow">${esc(e.cat.short)}${e.killed > 0 ? " · killing" : ""}</p><h2>${esc(e.title)}</h2>
   <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
   ${e.doubt ? `<div class="doubt"><b>Doubt noted:</b> ${esc(e.doubt)}</div>` : ""}
   ${text}
   <p><a class="more" href="#case=${encodeURIComponent(e.dir)}">Link to this case</a></p>
   <p><a class="more" href="${READER}#${encodeURIComponent(e.dir)}" target="_blank" rel="noopener">Clippings and sources in the dossier reader ↗</a></p>`;
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
    [e.mapG, e.tlG].forEach(g => { g.classList.toggle("dim", !visible); g.setAttribute("tabindex", visible ? "0" : "-1"); g.setAttribute("aria-hidden", visible ? "false" : "true"); });
    if (e.listItem) e.listItem.hidden = !visible;
  });
  controls.querySelector("#filter-count").textContent = `${count} of ${E.length} episodes`;
  const empty = document.getElementById("no-results"); if (empty) empty.hidden = count !== 0;
  if (cur && !matches(cur)) showList();
}
function route() {
  const params = new URLSearchParams(location.hash.slice(1));
  const id = params.get("case");
  const e = id && E.find(item => item.dir === id);
  if (e) {
    if (!matches(e)) {
      search.value = stateFilter.value = monthFilter.value = "";
      CATS.forEach(c => on.add(c.k)); leg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", "true"));
      applyFilter();
    }
    openEp(e, false);
    const width = W / 2; tgt = clampV({x:e.x-width/2, y:e.y-(width*H/W)/2, w:width}); kick();
  } else showList(false);
}
addEventListener("popstate", route);
addEventListener("hashchange", route);
applyFilter();
route();

} catch (error) {
console.error(error);
const notice = document.createElement("p");
notice.setAttribute("role", "alert");
notice.textContent = "The page data could not be loaded. Please reload or serve this site over HTTP.";
document.body.prepend(notice);
}
})();
