/* The lynching-year page (lynching/): one year's lynchings and other episodes from our dossiers on the 1910 county map,
   month by month, set beside every inventory victim of the year (all races) with a field-by-field comparison.
   view.json, beside the page, names the collection folder (data), the base-map folder and the header texts; the
   collection holds the site export (manifest, atlas/data.json, cases/, reader/) and lynch_compare.json (research repo:
   scripts/events/year/lynch_compare.py). */
(async () => {
const get = url => fetch(url, {cache: "no-cache"}).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.json(); });
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const V = await get("view.json");
const DATA = V.data;
const [M, A, C] = await Promise.all([get(`${DATA}manifest.json`), get(`${DATA}atlas/data.json`), get(`${DATA}lynch_compare.json`)]);
const G = await get(`${V.basemaps}basemap-${A.basemap}.json`);
const W = G.w, H = G.h, Y = C.year;
document.title = V.title; document.getElementById("title").textContent = V.title;
document.getElementById("dek").innerHTML = V.dek || "";

/* ---------- the comparison model ---------- */
const STATUS = {
  agree:  {label: "In an inventory, facts agree", short: "Agrees", v: "--agree", cls: "v-agree"},
  differ: {label: "In an inventory, facts differ", short: "Differs", v: "--differ", cls: "v-differ"},
  found:  {label: "Found here only", short: "Found here", v: "--found", cls: "v-found"},
  inv:    {label: "Inventory only (not in our sources)", short: "Inventory only", v: "--inv", cls: "v-inv"},
  other:  {label: "Other episodes (not a completed lynching)", short: "Other episode", v: "--other", cls: "v-other"}};
const FIELDS = [["date","Date"],["state","State"],["county","County"],["name","Victim"],["race","Race"],["outcome","Outcome"],["method","Method"]];
const byEvent = {};                      /* our event id -> the inventory victims it matches */
C.victims.forEach(v => v.ours.forEach(o => (byEvent[o.id] = byEvent[o.id] || []).push(v)));
const foundIds = new Set(C.found.map(o => o.id));
const ourRec = {};                       /* our event id -> its compare record (ours fields) */
C.victims.forEach(v => v.ours.forEach(o => { ourRec[o.id] = o; }));
C.found.forEach(o => { ourRec[o.id] = o; });

/* a county's centre on the base map: the middle of its path's bounding box */
function centre(key) {
  const p = key != null && G.counties[String(key)];
  if (!p) return null;
  const n = p.match(/-?\d+(\.\d+)?/g).map(Number);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i + 1 < n.length; i += 2) { x0 = Math.min(x0, n[i]); x1 = Math.max(x1, n[i]); y0 = Math.min(y0, n[i + 1]); y1 = Math.max(y1, n[i + 1]); }
  return {x: (x0 + x1) / 2, y: (y0 + y1) / 2};
}
const month = d => { const m = /^\D*\d{4}-(\d{2})/.exec(d || ""); return m && +(/^\D*(\d{4})/.exec(d)[1]) === Y ? +m[1] : 0; };
function fmtDate(d, prec) {
  if (!d) return "undated";
  const approx = d.startsWith("~") || prec === "approx";
  const [y, m, dd] = d.replace("~", "").split("-");
  const s = m ? (dd && prec !== "month" ? `${MON[+m - 1]} ${+dd}, ${y}` : `${MONL[+m - 1]} ${y}`) : y;
  return (approx ? "about " : "") + s;
}
const placeOf = o => [o.city, o.county ? `${o.county} Co.` : "", o.state].filter(Boolean).join(", ");

const items = [], byKey = {};
function add(it) { items.push(it); byKey[it.key] = it; }
function eventStatus(id, isLynch) {
  const vs = byEvent[id];
  if (vs) return vs.some(v => v.verdict === "differ") ? "differ" : "agree";
  if (foundIds.has(id)) return "found";
  return "other";
}
A.episodes.forEach(e => {
  const st = eventStatus(e.id);
  add({key: e.id, kind: "event", status: st, title: e.title, date: e.date, prec: e.prec, place: placeOf(e),
       x: e.x, y: e.y, ep: e, rec: ourRec[e.id], vics: byEvent[e.id] || [], summary: e.summary, dir: e.dir});
});
Object.values(ourRec).forEach(o => {          /* matched or found events that have no mapped dossier */
  if (byKey[o.id]) return;
  const c = centre(o.county10) || {};
  add({key: o.id, kind: "event", status: eventStatus(o.id), title: o.title || `${(o.victims || []).join(", ") || "Unnamed"}, ${placeOf(o)}`,
       date: o.date, prec: o.prec, place: placeOf(o), x: c.x, y: c.y, rec: o, vics: byEvent[o.id] || [], summary: o.lead,
       dir: o.dossier, unmapped: true});
});
C.victims.filter(v => !v.ours.length).forEach(v => {
  const c = centre(v.county10) || {};
  add({key: "inv:" + v.key, kind: "inv", status: "inv", title: `${v.name || "Unnamed"} (${v.race || "race not given"})`,
       date: v.date ? (v.day_known ? v.date : v.date.slice(0, 7)) : null, prec: v.day_known ? "day" : "month",
       place: [v.place, v.county ? `${v.county} Co.` : "", v.state].filter(Boolean).join(", "), x: c.x, y: c.y, inv: v});
});
items.forEach(it => { it.m = month(it.date); });

/* ---------- header tally ---------- */
const n = s => items.filter(i => i.status === s).length;
document.getElementById("tally").innerHTML =
  `<span><b>${C.counts.standard_definition}</b> completed lynchings in our table</span>` +
  `<span><b>${C.counts.matched}</b> of <b>${C.counts.inventory_victims}</b> inventory victims matched</span>` +
  `<span><b>${C.counts.agree}</b> agree, <b>${C.counts.differ}</b> differ</span>` +
  `<span><b>${C.counts.found_here}</b> found here only</span><span><b>${C.counts.inventory_only}</b> inventory only</span>`;

/* ---------- legend ---------- */
const show = {agree: true, differ: true, found: true, inv: true, other: true};
const legend = document.getElementById("legend");
Object.entries(STATUS).forEach(([k, s]) => {
  const b = document.createElement("button");
  b.type = "button"; b.setAttribute("aria-pressed", "true");
  const sw = k === "inv" ? `<span class="ringd"></span>` : `<span class="dot" style="background:var(${s.v})"></span>`;
  b.innerHTML = `${sw}${esc(s.label)} <span class="d">${n(k)}</span>`;
  b.onclick = () => { show[k] = !show[k]; b.setAttribute("aria-pressed", String(show[k])); refresh(); };
  legend.appendChild(b);
});

/* ---------- map ---------- */
const mapBox = document.getElementById("map");
const svg = el("svg", {viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Map of ${Y} episodes and inventory victims on 1910 county lines`}, mapBox);
el("path", {d: G.nation, fill: "var(--land)", stroke: "none"}, svg);
const cg = el("g", {fill: "none", stroke: "var(--county)", "stroke-width": .35}, svg);
Object.values(G.counties).forEach(p => el("path", {d: p}, cg));
el("path", {d: G.states, fill: "none", stroke: "var(--state)", "stroke-width": .8}, svg);
const mg = el("g", {}, svg);
const ORDER = {other: 0, agree: 1, found: 2, differ: 3, inv: 4};
items.filter(i => i.x != null).sort((a, b) => ORDER[a.status] - ORDER[b.status]).forEach(it => {
  const g = el("g", {class: "mk", tabindex: 0, role: "button", "aria-label": `${it.title}, ${fmtDate(it.date, it.prec)}`}, mg);
  const r = it.status === "other" ? 3.2 : 5;
  if (it.status === "inv") el("circle", {cx: it.x, cy: it.y, r, fill: "var(--sheet)", stroke: "var(--inv)", "stroke-width": 2, "stroke-dasharray": "2.5 1.8"}, g);
  else el("circle", {cx: it.x, cy: it.y, r, fill: `var(${STATUS[it.status].v})`, stroke: "var(--sheet)", "stroke-width": .8, opacity: it.status === "other" ? .7 : 1}, g);
  it.mapG = g; wire(g, it);
});
/* zoom: buttons, wheel and drag move the viewBox */
let vb = {x: 0, y: 0, w: W, h: H};
const setVB = () => { vb.w = Math.min(W, Math.max(W / 12, vb.w)); vb.h = vb.w * H / W; vb.x = Math.min(W - vb.w, Math.max(0, vb.x)); vb.y = Math.min(H - vb.h, Math.max(0, vb.y));
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); mapBox.classList.toggle("zoomed", vb.w < W); };
const zoomAt = (f, cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2) => { const w = vb.w / f; vb = {x: cx - (cx - vb.x) / f, y: cy - (cy - vb.y) / f, w, h: w * H / W}; setVB(); };
const zc = document.createElement("div"); zc.className = "zoom";
zc.innerHTML = `<button type="button" aria-label="Zoom in">+</button><button type="button" aria-label="Zoom out">&minus;</button><button type="button" aria-label="Show the whole map" title="Whole map">&#x2922;</button>`;
mapBox.appendChild(zc);
const [zin, zout, zall] = zc.querySelectorAll("button");
zin.onclick = () => zoomAt(2); zout.onclick = () => zoomAt(.5); zall.onclick = () => { vb = {x: 0, y: 0, w: W, h: H}; setVB(); };
const toUser = (cx, cy) => { const r = svg.getBoundingClientRect(); return [vb.x + (cx - r.left) / r.width * vb.w, vb.y + (cy - r.top) / r.height * vb.h]; };
svg.addEventListener("wheel", ev => { if (!ev.ctrlKey && !ev.metaKey && vb.w === W && ev.deltaY > 0) return; ev.preventDefault(); const [x, y] = toUser(ev.clientX, ev.clientY); zoomAt(ev.deltaY < 0 ? 1.25 : .8, x, y); }, {passive: false});
let pan = null;
svg.addEventListener("pointerdown", ev => { if (ev.target.closest(".mk")) return; pan = {x: ev.clientX, y: ev.clientY, vb: {...vb}}; svg.classList.add("drag"); });
window.addEventListener("pointermove", ev => { if (!pan) return; const r = svg.getBoundingClientRect();
  vb.x = pan.vb.x - (ev.clientX - pan.x) / r.width * vb.w; vb.y = pan.vb.y - (ev.clientY - pan.y) / r.height * vb.h; setVB(); });
window.addEventListener("pointerup", () => { pan = null; svg.classList.remove("drag"); });
const unplaced = items.filter(i => i.x == null).length;
document.getElementById("mapcap").innerHTML = `Each mark is one of our episodes at its place or county (1910 county lines), or an inventory victim we did not match, at the inventory&rsquo;s county (dashed ring). Larger dots are completed lynchings.${unplaced ? ` ${unplaced} with no place are listed but not mapped.` : ""} Scroll or use + to zoom; drag to pan.`;

/* ---------- timeline: month columns ---------- */
const tl = document.getElementById("tl");
const cols = 13, TW = 960, cw = TW / cols, per = 8, cell = cw / (per + 1);
const colItems = Array.from({length: cols}, (_, i) => items.filter(it => (i === 12 ? it.m === 0 : it.m === i + 1)).sort((a, b) => ORDER[b.status] - ORDER[a.status] || (a.date || "").localeCompare(b.date || "")));
const rows = Math.max(...colItems.map(c => Math.ceil(c.length / per)));
const TH = rows * cell + 34;
const tsvg = el("svg", {viewBox: `0 0 ${TW} ${TH}`, role: "img", "aria-label": "Episodes by month"}, tl);
colItems.forEach((list, i) => {
  const x0 = i * cw;
  const t = el("text", {x: x0 + cw / 2, y: TH - 18, "text-anchor": "middle", "font-size": 12, fill: "var(--muted)"}, tsvg);
  t.textContent = i === 12 ? "No month" : MON[i];
  const t2 = el("text", {x: x0 + cw / 2, y: TH - 4, "text-anchor": "middle", "font-size": 11, fill: "var(--muted)"}, tsvg);
  t2.textContent = list.length;
  list.forEach((it, j) => {
    const cx = x0 + cell * (j % per + 1), cy = TH - 30 - cell * (Math.floor(j / per) + .5);
    const g = el("g", {class: "mk", tabindex: -1}, tsvg);
    if (it.status === "inv") el("circle", {cx, cy, r: cell * .36, fill: "var(--sheet)", stroke: "var(--inv)", "stroke-width": 1.6, "stroke-dasharray": "2 1.5"}, g);
    else el("circle", {cx, cy, r: cell * (it.status === "other" ? .3 : .4), fill: `var(${STATUS[it.status].v})`}, g);
    it.tlG = g; wire(g, it);
  });
});
document.getElementById("tlcap").textContent = "Each dot is one episode or unmatched inventory victim, in the month it happened, sorted by comparison; the number is the month’s total.";

/* ---------- hover tip and selection ---------- */
const tip = document.getElementById("tip");
function wire(g, it) {
  g.addEventListener("mouseenter", ev => { tip.hidden = false; tip.innerHTML = `<b>${esc(it.title)}</b><div class="m">${esc(fmtDate(it.date, it.prec))} · ${esc(it.place)} · ${esc(STATUS[it.status].short)}</div>${esc((it.summary || "").slice(0, 260))}${(it.summary || "").length > 260 ? "…" : ""}`; moveTip(ev); });
  g.addEventListener("mousemove", moveTip);
  g.addEventListener("mouseleave", () => { tip.hidden = true; });
  g.addEventListener("click", () => select(it));
  g.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); select(it); } });
}
function moveTip(ev) { const x = Math.min(ev.clientX + 14, innerWidth - 360), y = Math.min(ev.clientY + 14, innerHeight - tip.offsetHeight - 8); tip.style.left = x + "px"; tip.style.top = y + "px"; }

const side = document.getElementById("sidein");
let current = null, query = "";
function visible(it) {
  if (!show[it.status]) return false;
  if (!query) return true;
  const hay = [it.title, it.place, it.date, ...(it.rec?.victims || []), it.inv?.name, ...(it.vics || []).map(v => v.name)].join(" ").toLowerCase();
  return hay.includes(query);
}
function refresh() {
  items.forEach(it => { const on = visible(it); [it.mapG, it.tlG].forEach(g => g && g.classList.toggle("dim", !on)); });
  if (!current) listView();
  renderTable();
}
function listView() {
  current = null; history.replaceState(null, "", location.pathname + location.search);
  const vis = items.filter(visible).sort((a, b) => (a.date || "~9").replace("~", "").localeCompare((b.date || "~9").replace("~", "")));
  side.innerHTML = `<div class="filters"><label class="grow">Search<input id="q" type="search" placeholder="Name, place or month" value="${esc(query)}" autocomplete="off"></label></div>
   <p class="cap" style="margin:8px 0">${vis.length} shown. Select one to compare it with the inventories.</p><ul class="list" id="lst"></ul>`;
  const ul = side.querySelector("#lst");
  vis.forEach(it => {
    const li = document.createElement("li");
    const sw = it.status === "inv" ? `<span class="ringd"></span>` : `<span class="dot" style="background:var(${STATUS[it.status].v})"></span>`;
    li.innerHTML = `<button type="button">${sw}<span class="d">${esc(fmtDate(it.date, it.prec).replace("about ", "~").replace(`, ${Y}`, "").replace(` ${Y}`, ""))}</span><span>${esc(it.title)}<br><span class="d">${esc(it.place)}</span></span></button>`;
    li.firstChild.onclick = () => select(it);
    ul.appendChild(li);
  });
  const q = side.querySelector("#q");
  q.oninput = () => { query = q.value.trim().toLowerCase(); const pos = q.selectionStart; refresh(); const q2 = side.querySelector("#q"); if (q2) { q2.focus(); q2.setSelectionRange(pos, pos); } };
}

const gradeChip = g => g ? `<span class="chip g-${g}">${g === "unstated" ? "race unstated" : g}</span>` : "";
const invDate = r => r.month ? `${MONL[+r.month - 1]}${r.day ? " " + r.day : ""}` : "no date";
function compareTable(v, o) {
  const rows = v.rows, g = o ? o.grade : {};
  const invs = f => rows.map(f).filter((x, i, a) => x && a.indexOf(x) === i).join(" / ") || "—";
  const ourVictims = o ? (o.victims || []).join("; ") || "unnamed" : "";
  const outcome = o ? [o.type ? o.type.replace(/_/g, " ") : "", o.stage, o.lynch_def].filter(Boolean).join(", ") : "";
  const lines = [
    ["date", "Date", o ? fmtDate(o.date, o.prec) : "", invs(invDate)],
    ["state", "State", o ? o.state : "", invs(r => r.state)],
    ["county", "County", o ? o.county : "", invs(r => r.county)],
    ["name", "Victim", ourVictims, invs(r => [r.name, r.alt].filter(Boolean).join(" (also ") + (r.alt ? ")" : ""))],
    ["race", "Race", o ? (o.race || "not stated in our sources") : "", invs(r => r.race)],
    ["outcome", "Outcome", outcome, invs(r => r.status)],
    ["method", "Method", o ? (o.method || []).join(", ") : "", invs(r => r.method)],
    [null, "Accusation", o ? o.accusation : "", invs(r => r.accusation)]];
  return `<table class="cmp"><thead><tr><th></th><th>Ours</th><th>Inventory</th><th></th></tr></thead><tbody>` +
    lines.map(([k, lab, ours, inv]) => `<tr class="${k && g[k] === "differ" ? "row-differ" : ""}"><th>${lab}</th><td>${esc(ours)}</td><td>${esc(inv)}</td><td class="g">${k ? gradeChip(g[k]) : ""}</td></tr>`).join("") +
    `</tbody></table>`;
}
const rowsLine = v => `<p class="rows">${v.rows.map(r => `${esc(C.lists[r.list] || r.list)} ${esc(r.row)}`).join(" · ")}${v.match ? ` · matched by ${esc(v.match === "linked" ? "inventory link" : v.match)}` : ""}</p>`;

function select(it) {
  current = it; tip.hidden = true;
  history.replaceState(null, "", "#case=" + encodeURIComponent(it.key));
  items.forEach(x => x.mapG && x.mapG.classList.toggle("selected", x === it));
  const back = `<button class="back" type="button" id="back">← All entries</button>`;
  let h = `${back}<p class="eyebrow">${esc(STATUS[it.status].short)}</p><h2>${esc(it.title)}</h2>`;
  if (it.kind === "inv") {
    const v = it.inv;
    h += `<dl class="facts"><dt>Date</dt><dd>${esc(fmtDate(it.date, it.prec))}</dd><dt>Place</dt><dd>${esc(it.place)}</dd><dt>Status</dt><dd>${esc(v.status)}</dd><dt>Accusation</dt><dd>${esc(v.accusation || "—")}</dd>${v.method ? `<dt>Method</dt><dd>${esc(v.method)}</dd>` : ""}</dl>`;
    h += rowsLine(v) + `<p class="doubt">No event in our ${Y} sources matched this victim (same state within a month and a close surname, or the inventory&rsquo;s place for an unnamed victim).</p>`;
    h += compareTable(v, null);
  } else {
    const o = it.rec || {}, e = it.ep || {};
    const victims = (o.victims && o.victims.length ? o.victims : []).join("; ");
    h += `<dl class="facts"><dt>Date</dt><dd>${esc(fmtDate(it.date, it.prec))}</dd><dt>Place</dt><dd>${esc(it.place) || "unknown"}</dd>` +
      `<dt>Type</dt><dd>${esc([(e.type || o.type || "").replace(/_/g, " "), e.stage || o.stage, o.lynch_def].filter(Boolean).join(", "))}</dd>` +
      (victims ? `<dt>Victims</dt><dd>${esc(victims)}</dd>` : "") + (o.race ? `<dt>Race (our sources)</dt><dd>${esc(o.race)}</dd>` : "") +
      ((e.evidence || o.evidence) ? `<dt>Evidence</dt><dd>${esc((e.evidence || o.evidence).replace(/_/g, " "))}</dd>` : "") +
      (o.inventory ? `<dt>Linked row</dt><dd>${esc(o.inventory)}</dd>` : "") + `</dl>`;
    if (it.vics.length) {
      it.vics.forEach(v => { const oo = v.ours.find(x => x.id === it.key); h += `<h3>Compared with ${esc(v.name || "an unnamed victim")}</h3>${rowsLine(v)}${compareTable(v, oo)}`; });
    } else if (it.status === "found") {
      h += `<p class="doubt">A completed lynching in our sources that no inventory lists (Beck&ndash;Tolnay, Seguin&ndash;Rigby, Monroe Work Today).</p>`;
    }
    if (it.summary) h += `<h3>Summary</h3><p>${esc(it.summary)}</p>`;
    if (it.dir) h += `<p><button class="readbtn" type="button" id="readit">Read the dossier here</button> <a class="more" href="${DATA}reader/#${encodeURIComponent(it.dir)}" target="_blank" rel="noopener">Clippings and sources ↗</a></p><div class="dossier-text" id="dtext"></div>`;
    else h += `<p class="cap">No dossier for this event yet.</p>`;
  }
  side.innerHTML = h;
  side.parentElement.scrollTop = 0;
  side.querySelector("#back").onclick = () => { items.forEach(x => x.mapG && x.mapG.classList.remove("selected")); listView(); };
  const rb = side.querySelector("#readit");
  if (rb) rb.onclick = async () => {
    rb.disabled = true; rb.textContent = "Loading…";
    const box = side.querySelector("#dtext");
    try {
      const c = await get(`${DATA}cases/${encodeURIComponent(it.dir)}.json?v=${M.export_id}`);
      const secs = (c.atlas && c.atlas.text) || [];
      box.innerHTML = secs.map(s => `<h4>${esc(s.section)}</h4>` + s.paras.map(p => `<p>${esc(p)}</p>`).join("")).join("") ||
        `<p>${esc((c.reader.summary || []).map(s => s.text).join(" "))}</p>`;
      rb.remove();
    } catch (err) { box.innerHTML = `<p role="alert">Could not load the dossier. Try again.</p>`; rb.disabled = false; rb.textContent = "Read the dossier here"; }
  };
}

/* ---------- the comparison table ---------- */
const TF = [["all", "All"], ["agree", "Agree"], ["differ", "Differ"], ["found", "Found here only"], ["inv", "Inventory only"]];
let tfilter = "all";
const tf = document.getElementById("ct-filters");
tf.innerHTML = TF.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${k === "all"}">${l}</button>`).join("") +
  `<label class="grow">Field differs<select id="ct-field"><option value="">any field</option>${FIELDS.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label>`;
tf.querySelectorAll("button").forEach(b => b.onclick = () => { tfilter = b.dataset.k; tf.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); renderTable(); });
const fsel = tf.querySelector("#ct-field"); fsel.onchange = renderTable;
const trows = [];
C.victims.forEach(v => {
  const o = v.ours[0];
  trows.push({status: v.ours.length ? v.verdict : "inv", date: v.date, v, o, key: o ? o.id : "inv:" + v.key});
});
C.found.forEach(o => trows.push({status: "found", date: (o.date || "").replace("~", ""), v: null, o, key: o.id}));
trows.sort((a, b) => (a.date || "9").localeCompare(b.date || "9"));
document.querySelector("#ct thead").innerHTML = `<tr><th>Date</th><th>Inventory victim</th><th>Our record</th><th></th>${FIELDS.map(([, l]) => `<th>${l}</th>`).join("")}</tr>`;
document.getElementById("ct-cap").textContent = `One row per inventory victim (rows naming the same person in more than one inventory are joined), then the completed lynchings found only in our sources. Grades compare our record with the inventory: date within a day agrees, within a week is close; race is graded only where our sources state it. Select a row to see it on the map with the full comparison.`;
function renderTable() {
  const tb = document.querySelector("#ct tbody"), f = fsel.value;
  const list = trows.filter(r => (tfilter === "all" || r.status === tfilter) && (!f || (r.o && r.o.grade && r.o.grade[f] === "differ")) &&
    (!query || [r.v?.name, ...(r.o?.victims || []), r.o?.city, r.v?.place, r.v?.county].join(" ").toLowerCase().includes(query)));
  tb.innerHTML = list.map(r => {
    const v = r.v, o = r.o, s = STATUS[r.status];
    const inv = v ? `${esc(v.name || "Unnamed")}<div class="sub">${esc([v.place, v.county, v.state].filter(Boolean).join(", "))} · ${esc(v.rows.map(x => x.row).join(", "))}</div>` : `<span class="sub">—</span>`;
    const ours = o ? `${esc((o.victims || []).join("; ") || o.title || "unnamed")}<div class="sub">${esc(fmtDate(o.date, o.prec))} · ${esc(placeOf(o))}</div>` : `<span class="sub">not in our sources</span>`;
    const g = o && o.grade ? FIELDS.map(([k]) => `<td>${gradeChip(o.grade[k])}</td>`).join("") : FIELDS.map(() => "<td></td>").join("");
    return `<tr tabindex="0" data-key="${esc(r.key)}"><td class="d">${esc(r.date ? r.date.slice(5) : "—")}</td><td>${inv}</td><td>${ours}</td><td><span class="vchip ${s.cls}">${esc(s.short)}</span></td>${g}</tr>`;
  }).join("");
  tb.querySelectorAll("tr").forEach(tr => { const go = () => { const it = byKey[tr.dataset.key]; if (it) { select(it); document.getElementById("side").scrollIntoView({behavior: "smooth", block: "nearest"}); } };
    tr.onclick = go; tr.onkeydown = ev => { if (ev.key === "Enter") go(); }; });
}

/* ---------- start ---------- */
const want = new URLSearchParams(location.hash.slice(1)).get("case");   /* read before the list view resets the hash */
refresh();
if (want && byKey[want]) select(byKey[want]);
})().catch(err => { document.getElementById("sidein").innerHTML = `<p role="alert">Could not load the page: ${String(err.message || err).replace(/</g, "&lt;")}</p>`; });
