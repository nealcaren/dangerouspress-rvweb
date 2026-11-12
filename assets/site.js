/* Loaded by each year's reader (<year>/reader/): this year's manifest, the list of years, and the header links to the
   shared atlas and to the other years' readers. */
window.SITE = (() => {
  const get = url => fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`); return r.json(); });
  const manifest = fetch("../manifest.json", {cache: "no-cache"}).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} for manifest.json`); return r.json(); });
  const years = get("../../years.json").catch(() => ({years: []}));
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  Promise.all([manifest, years]).then(([m, y]) => {
    const nav = document.getElementById("years");
    if (!nav) return;
    const others = (y.years || []).length > 1 ? `<span class="lbl">Dossiers</span>` + y.years.map(x => x.year === m.year
      ? `<a aria-current="page">${esc(x.label)}</a>` : `<a href="../../${x.year}/reader/">${esc(x.label)}</a>`).join("") : "";
    nav.innerHTML = `<a href="../../atlas/#year=${m.year}">Map</a>` + others;
  }).catch(() => {});
  return {manifest, years};
})();
