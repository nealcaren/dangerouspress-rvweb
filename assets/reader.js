(async () => {
try {
const M = await SITE.manifest;
const V = `?v=${M.export_id}`; /* the export id keeps a browser from mixing cached files from different exports */
const response = await fetch(`data.json${V}`);
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const DATA = await response.json();
const L = DATA.labels, E = DATA.episodes;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const col = i => i == null ? "var(--other)" : `var(--k${i % 7})`;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = d => { const [y, m, dd] = d.split("-"); return `${+dd} ${MONTHS[+m - 1]} ${y}`; };
let cur = null, active = null;

function scopeChips(ch) {
  return (ch || []).map(([t, c], i) => `<span class="chip ${c}">${i === 0 ? `<b>${esc(t)}</b>` : esc(t)}</span>`).join("");
}

function cites(ep, ks, ext) {
  const by = Object.fromEntries(ep.sources.map(s => [s.k, s]));
  const links = (ext || []).filter(k => by[k]).map(k => `<a class="cite ext" href="${by[k].url}" target="_blank" rel="noopener"
    title="No clipping shown; opens the full page">[${esc(by[k].paper)}, ${fmt(by[k].date)} ↗]</a>`).join("");
  return links + (ks || []).filter(k => by[k] && by[k].n).sort((a, b) => by[a].n - by[b].n)
    .map(k => `<button class="cite" data-k="${k}" aria-label="Clipping ${by[k].n}">[${by[k].n}]</button>`).join("");
}

function renderIndex() {
  routeRequest++;
  cur = null; pager(null);
  document.querySelectorAll("#eps a").forEach(a => a.getAttribute("href") === "#overview"
    ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  document.getElementById("main").innerHTML = `<section class="index">
  ${M.reader_intro || ""}
  ${E.map(ep => {
    const lead = ep.lead;
    const nThis = ep.n_this;
    const papers = ep.n_papers;
    return `<a class="card" href="#${ep.id}"><p class="eyebrow">${esc([ep.city, ep.state].filter(Boolean).join(", "))} · ${esc(ep.when)}</p>
    <h3>${esc(ep.title)}</h3><p>${esc(lead)}</p><p class="chips">${scopeChips(ep.chips)}</p>
    <p class="stats">${nThis} articles in ${papers} papers · ${ep.n_clips} clippings · ${ep.n_accounts} accounts</p></a>`;
  }).join("")}</section>`;
  window.scrollTo(0, 0);
}

function timeline(ep) {
  const ds = ep.sources.map(s => s.date).sort();
  const t0 = Date.parse(ds[0]), t1 = Date.parse(ds[ds.length - 1]), span = Math.max(t1 - t0, 864e5 * 7);
  const week = 864e5 * 7, stack = {};
  let maxh = 0;
  const dots = ep.sources.slice().sort((a, b) => (a.n ? 1 : 0) - (b.n ? 1 : 0)).map(s => {
    const t = Date.parse(s.date), b = Math.floor((t - t0) / week);
    const h = stack[b] = (stack[b] || 0) + (s.n ? 18 : 10);
    maxh = Math.max(maxh, h);
    const left = ((t - t0) / span) * 100;
    const acc = s.acc != null ? ep.accounts[s.acc]?.label : "Other coverage";
    return `<button class="${s.n ? "sel" : ""}" data-k="${s.k}" style="left:calc(${left}% - ${left / 100 * 8}px);bottom:${h - (s.n ? 16 : 8)}px;background:${col(s.acc)}"
      data-tip="${esc(`${s.paper}, ${fmt(s.date)}, p. ${s.page} · ${acc}${s.n ? ` · clipping ${s.n}` : ""}`)}"
      aria-label="${esc(`${s.paper}, ${fmt(s.date)}`)}">${s.n || ""}</button>`;
  }).join("");
  // month ticks, at most 6 labels
  const ticks = [];
  const d0 = new Date(t0), months = [];
  for (let d = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() + 1, 1)); d.getTime() < t1; d.setUTCMonth(d.getUTCMonth() + 1)) months.push(new Date(d));
  const step = Math.ceil(months.length / 4) || 1;
  months.forEach((d, i) => { if (i % step === 0) ticks.push([((d - t0) / span) * 100, `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`]); });
  const axis = [[0, fmt(ds[0])], ...ticks.filter(([p]) => p > 12 && p < 88), [100, fmt(ds[ds.length - 1])]];
  const used = [...new Set(ep.sources.map(s => s.acc))].sort((a, b) => (a ?? 99) - (b ?? 99));
  return `<div class="timeline"><p class="eyebrow">Coverage · ${ep.sources.length} articles, ${fmt(ds[0])} to ${fmt(ds[ds.length - 1])}</p>
  <div class="tl" style="height:${maxh + 6}px">${dots}</div>
  <div class="axis">${axis.map(([p, l]) => `<span style="left:${p}%">${esc(l)}</span>`).join("")}</div>
  <p class="legend">${used.map(i => `<span><i style="background:${col(i)}"></i>${esc(i == null ? "Other coverage" : ep.accounts[i].label)}</span>`).join("")}
  <span>Numbered dots are the clippings shown</span></p></div>`;
}

async function renderEpisode(id, key) {
  const entry = E.find(e => e.id === id);
  if (!entry) return renderIndex();
  const request = ++routeRequest;
  cur = null; pager(entry);
  document.getElementById("main").innerHTML = '<p role="status">Loading dossier…</p>';
  let ep;
  try {
    const response = await fetch(`../cases/${encodeURIComponent(id)}.json${V}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    ep = (await response.json()).reader;
    if (!ep) throw new Error("Dossier missing");
  } catch (error) {
    if (request !== routeRequest) return;
    document.getElementById("main").innerHTML = '<p role="alert">Could not load this dossier. <button type="button" id="retry">Try again</button></p>';
    document.getElementById("retry").onclick = () => renderEpisode(id, key);
    return;
  }
  if (request !== routeRequest) return;
  cur = ep; pager(ep);
  document.querySelectorAll("#eps a").forEach(a => a.getAttribute("href") === "#" + id
    ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
  const secs = {};
  ep.summary.forEach(s => {
    const t = L.section[s.section] ?? s.section;
    ((secs[t] ||= {})[s.para || 1] ||= []).push(esc(s.text) + cites(ep, s.cites, s.ext));
  });
  const order = ["", "Background", "Events", "Aftermath", "Press coverage and reaction", "Disputed accounts", "Coverage"];
  let body = "";
  for (const t of order) if (secs[t]) {
    let paras = Object.keys(secs[t]).sort((a, b) => a - b).map(p => `<p>${secs[t][p].join(" ")}</p>`);
    if (t === "") { const ti = esc(ep.title); paras[0] = paras[0].replace(ti, `<b>${ti}</b>`); body += `<div class="lead">${paras.join("")}</div>`; continue; }
    body += `<h2>${t}</h2>${paras.join("")}`;
  }
  const leadEnd = body.indexOf("</div>") + 6;
  const facts = ep.info.length ? `<dl class="facts">${ep.info.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : "";
  body = body.slice(0, leadEnd) + facts + timeline(ep) + body.slice(leadEnd);
  const accts = ep.accounts.length > 1 ? `<h2>Competing accounts</h2><div class="accounts">${ep.accounts.map((a, i) =>
    `<div class="acct" style="border-top-color:${col(i)}"><h3><span>${esc(a.label)}</span><span class="chip">${esc((a.origin || "").replace("_", " "))}</span></h3>
     <p>${esc(a.gist)}${cites(ep, a.cites, a.ext)}</p></div>`).join("")}</div>` : "";
  const pc = null, police = "";
  const scope = `<h2>Classification</h2><p class="chips">${scopeChips(ep.chips)}</p>
    ${ep.bases.map(b => `<p class="small muted">${esc(b)}</p>`).join("")}`;
  const framing = ep.framing.length ? `<h2>How the papers framed it</h2><div class="tablewrap"><table><thead><tr><th>Press</th><th>Stance</th><th>Detail</th></tr></thead><tbody>
    ${ep.framing.map(f => `<tr><td>${esc(f.press)}</td><td>${esc((f.stance || "").replace("_", " "))}</td><td>${esc(f.detail)}${cites(ep, f.cites, f.ext)}</td></tr>`).join("")}</tbody></table></div>` : "";
  const recchk = ep.record_check.length ? `<details class="all"><summary>Corrections to our first-pass record (${ep.record_check.length})</summary><div class="tablewrap"><table><thead><tr><th>Field</th><th>Record</th><th>Papers</th></tr></thead><tbody>
    ${ep.record_check.map(r => `<tr><td>${esc(r.field)}</td><td>${esc(typeof r.record === "string" ? r.record : JSON.stringify(r.record))}</td><td>${esc(r.dossier)}</td></tr>`).join("")}</tbody></table></div></details>` : "";
  const rest = ep.sources.slice().sort((a, b) => a.date.localeCompare(b.date));
  const all = `<details class="all"><summary>All ${ep.sources.length} articles in the coverage</summary><ol class="srclist">
    ${rest.map(s => `<li><span class="n">${s.n ? `<button class="cite" data-k="${s.k}">[${s.n}]</button>` : ""}</span>
      <span class="d"><span class="sw" style="background:${col(s.acc)}"></span><span class="chip">${s.press}</span> <a href="${s.url}" target="_blank" rel="noopener">${esc(s.paper)}</a>, ${fmt(s.date)}${s.rel === "passing" ? " · passing" : ""}</span>
      <span class="d muted">${esc(s.note)}</span></li>`).join("")}</ol>
    ${ep.set_aside.length ? `<p class="small muted">Also read and set aside: ${ep.set_aside.length} articles (${esc([...new Set(ep.set_aside.map(r => r[1]))].join(", "))}). ${ep.searches} searches.</p>` : ""}</details>`;
  const clips = ep.sources.filter(s => s.n).sort((a, b) => a.n - b.n);
  document.getElementById("main").innerHTML = `<div class="ep"><article class="article">
    <p class="eyebrow">${esc([ep.city, ep.state].filter(Boolean).join(", "))} · ${esc(ep.when)}</p>
    <h1 tabindex="-1">${esc(ep.title)}</h1><p class="chips">${scopeChips(ep.chips)}</p>
    <div class="text">${body}</div>${accts}${framing}${scope}${recchk}<h2>Sources</h2>${all}
    ${ep.uncovered.length ? `<p class="small muted">${ep.uncovered.length} statements cite an article beyond the ${ep.n_clips} clippings; their grey links open the full page.</p>` : ""}
    </article>
    <aside class="desk" aria-label="Clippings"><div class="tabs" role="tablist">${clips.map(s =>
      `<button role="tab" data-k="${s.k}" aria-selected="false" title="${esc(`${s.paper}, ${fmt(s.date)}`)}"><span class="sw" style="background:${col(s.acc)}"></span>${s.n}</button>`).join("")}</div>
    <div class="clip" id="clip" role="tabpanel"></div></aside></div>`;
  show(key && ep.sources.find(s => s.k === key && s.n) ? key : clips[0]?.k, false);
  window.scrollTo(0, 0);
  if (routed) document.querySelector(".article h1")?.focus({preventScroll: true});
}

function claimsFor(ep, k) {
  const out = [];
  ep.summary.forEach(s => { if ((s.cites || []).includes(k)) out.push(s.text); });
  ep.accounts.forEach(a => { if ((a.cites || []).includes(k)) out.push(`${a.label} (account)`); });
  return out;
}

/* article text lives in text/tNN.json (shard ep.tx), fetched the first time an episode's clipping is shown */
const TX = {};
function textOf(ep, k) {
  const t = TX[ep.tx];
  return t && !(t instanceof Promise) ? ((t[ep.id] || {})[k] || "") : null;
}
function show(k, scroll = true) {
  const ep = cur; if (!ep || !k) return;
  if (!(ep.tx in TX)) {
    TX[ep.tx] = fetch(`text/t${String(ep.tx).padStart(2, "0")}.json${V}`).then(r => r.ok ? r.json() : {}).catch(() => ({}))
      .then(j => { TX[ep.tx] = j; if (cur === ep && active) show(active, false); });
  }
  const s = ep.sources.find(x => x.k === k);
  if (!s) return;
  active = k;
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.k === k));
  document.querySelectorAll("button.cite, .tl button").forEach(b => b.classList.toggle("on", b.dataset.k === k));
  const by = Object.fromEntries(ep.sources.map(x => [x.k, x]));
  const parts = (s.group || [k]).map(g => by[g]).filter(Boolean);
  const imgs = parts.map(p => p.img ? `<figure><img src="${p.img}" alt="Clipping from the ${esc(p.paper)}, ${fmt(p.date)}, page ${p.page}">${parts.length > 1 || p.press === "white" ? `<figcaption>${parts.length > 1 ? `p. ${p.page}` : ""}${p.press === "white" ? `${parts.length > 1 ? " · " : ""}Cut from the Library of Congress page scan` : ""}</figcaption>` : ""}</figure>` :
    (p.n && p.press === "white" ? `<div class="wtext"><p class="small muted">White-press article: text as read (${esc(p.label || "OCR")}); open the page for the scan.</p><pre>${esc(textOf(ep, p.k) ?? "Loading text…")}</pre></div>` :
     p.n ? `<p class="small muted">Clipping unavailable (${esc(p.err || "not cropped")}); open the page.</p>` : "")).join("");
  const acc = s.acc != null ? ep.accounts[s.acc].label : null;
  const cl = claimsFor(ep, k);
  document.getElementById("clip").innerHTML = `<header><span class="src"><i>${esc(s.paper)}</i>, ${fmt(s.date)}, p. ${s.page}</span>
    ${acc ? `<span class="chip"><span class="sw" style="background:${col(s.acc)}"></span>${esc(acc)}</span>` : ""}
    ${s.found ? `<span class="chip warn">found by search</span>` : ""}
    <span class="chip">${s.press} press</span>
    <a href="${s.url}" target="_blank" rel="noopener">${s.press === "white" ? "Page on Chronicling America" : "Full page on Dangerous Press"} ↗</a></header>
    <p class="note">${esc(s.note)}</p>${s.quotes.map(q => `<blockquote>${esc(q)}</blockquote>`).join("")}${imgs}
    ${s.press === "white" && !s.img ? "" : `<details><summary>${s.press === "white" ? `Text as read (${esc(s.label || "OCR")})` : "OCR text"}</summary><pre>${esc(parts.map(p => textOf(ep, p.k) ?? "Loading text…").join("\n\n"))}</pre></details>`}
    ${cl.length ? `<div class="claimlist">Backs ${cl.length} statement${cl.length > 1 ? "s" : ""}:<ul>${cl.slice(0, 8).map(t => `<li>${esc(t)}</li>`).join("")}${cl.length > 8 ? `<li>and ${cl.length - 8} more</li>` : ""}</ul></div>` : ""}`;
  document.getElementById("clip").scrollTop = 0;
  if (scroll && matchMedia("(max-width:980px)").matches) document.querySelector(".desk").scrollIntoView({block: "start"});
}

/* compact header: prev / n of N / next, and a finder over titles, places and dates */
const label = ep => `${ep.title} · ${[ep.city, ep.state].filter(Boolean).join(", ")} · ${ep.when}`;
document.getElementById("eplist").innerHTML = E.map(ep => `<option value="${esc(label(ep))}"></option>`).join("");
const find = document.getElementById("find");
function jump() {
  const v = find.value.trim().toLowerCase(); if (!v) return;
  const ep = E.find(e => label(e).toLowerCase() === v) || E.find(e => label(e).toLowerCase().includes(v));
  if (ep) { location.hash = ep.id; find.value = ""; find.blur(); }
}
find.addEventListener("change", jump);
find.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) jump(); });
function pager(ep) {
  const el = document.getElementById("pager");
  if (!ep) { el.innerHTML = `${E.length} episodes`; return; }
  const i = E.findIndex(e => e.id === ep.id), a = E[i - 1], b = E[i + 1];
  el.innerHTML = `<a href="#overview">All episodes</a>${a ? `<a href="#${a.id}" title="${esc(a.title)}">&larr; Previous</a>` : ""}`
    + `<span>${i + 1} of ${E.length}</span>${b ? `<a href="#${b.id}" title="${esc(b.title)}">Next &rarr;</a>` : ""}`;
}
document.addEventListener("click", e => {
  const b = e.target.closest("button[data-k]");
  if (!b || !cur) return;
  const s = cur.sources.find(x => x.k === b.dataset.k);
  if (s && s.n) show(s.k);
  else if (s) window.open?.(s.url, "_blank", "noopener");
});
const tip = document.getElementById("tip");
document.addEventListener("pointerover", e => {
  const b = e.target.closest("[data-tip]");
  if (!b) return void (tip.hidden = true);
  tip.textContent = b.dataset.tip; tip.hidden = false;
  const r = b.getBoundingClientRect();
  tip.style.left = Math.min(r.left, innerWidth - 300) + "px"; tip.style.top = (r.top - 40) + "px";
});
document.addEventListener("focusin", e => { const b = e.target.closest("[data-tip]"); if (!b) tip.hidden = true; });
function route() {
  const h = location.hash.slice(1);
  const m = h.match(/^([a-z0-9-]+?)(?:-(A\d+))?$/);
  if (m && !E.some(e => e.id === m[1])) { const e2 = E.find(e => e.id === h); if (e2) return renderEpisode(h); }
  m ? renderEpisode(m[1], m[2]) : renderIndex();
}
let routed = false, routeRequest = 0;
addEventListener("hashchange", () => {
  routed = true;
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(route);
  else route();
});
route();

} catch (error) {
console.error(error);
const notice = document.createElement("p");
notice.setAttribute("role", "alert");
notice.textContent = `The page data could not be loaded (${error.message}). Please reload; if it persists, serve this site over HTTP.`;
document.body.prepend(notice);
}
})();
