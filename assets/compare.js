/* The inventory comparison page (compare/): reads compare/view.json (scripts/build_site.py, from each year's
   compare.json joined with its published reader and atlas) and draws, one sampled year at a time, the inventory lynchings of
   Black victims in the series month beside our records, then the completed lynchings found only in our sources. */
(() => {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const MON = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
  const REASON = {
    race_unstated: "no report gives the victim's race", non_black_victim: "the victim was not Black",
    routine_arrest: "a routine arrest or custody case", no_black_harm: "no Black person was hurt",
    no_racial_motive: "no racial motive, or Black attackers", duplicate: "a duplicate of another entry",
    other_year: "it took place in another year", disputed: "a source disputes it", no_force: "no force or threat",
  };
  const reason = r => REASON[r] || String(r || "").replace(/_/g, " ");
  // "1885-08-09" -> "Aug. 9"; "~1885-08" or a day not known -> "Aug." (about)
  const when = (d, dayKnown = true) => {
    const m = /(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(d || "");
    if (!m) return "date unknown";
    const approx = (d || "").startsWith("~");
    return (approx ? "about " : "") + MON[+m[2] - 1] + (m[3] && dayKnown ? " " + +m[3] : "");
  };
  // a ruling's note, unless it only restates the reason ("derived", or the same opening words)
  const extra = r => r.basis && r.basis !== "derived"
    && !r.basis.toLowerCase().startsWith(reason(r.reason).toLowerCase().split(" ").slice(0, 2).join(" "));
  const place = o => [o.place || o.city, o.county && `${o.county} Co.`, o.state].filter(Boolean).map(esc).join(", ");
  const kind = o => {
    const d = o.lynch_def;
    if (d === "lynching") return "Lynching";
    if (d === "probable lynching") return "Probable lynching";
    if (d === "not a lynching") return "Not a lynching (our check)";
    if (d) return d[0].toUpperCase() + d.slice(1);
    if (o.type === "lynching") return {completed: "Lynching", attempted: "Attempted lynching", threatened: "Threatened lynching"}[o.stage] || "Lynching";
    return (o.type || "event").replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
  };

  function ours(o, y, root, brief = false) {
    const t = o.title || (o.victims || []).join(", ") || "Untitled event";
    let head;
    if (o.published) {
      head = `<a class="t" href="${root}${y}/reader/#${encodeURIComponent(o.dossier)}">${esc(t)}</a>`
        + (o.map ? ` <span class="sub">· <a href="${root}atlas/#year=${y}&case=${encodeURIComponent(o.dossier)}">map</a></span>` : "");
    } else head = `<span class="name">${esc(t)}</span>`;
    const bits = brief ? [esc(kind(o))] : [esc(kind(o)), esc(when(o.date)), place(o)].filter(Boolean);
    let status = "";
    if (o.set_aside) status = `<span class="flag">set aside</span>Dossier set aside: ${esc(reason(o.set_aside.reason))}`
      + (extra(o.set_aside) ? ` (${esc(o.set_aside.basis)})` : "") + ".";
    else if (o.screened) status = `<span class="flag">no dossier</span>Left out before a dossier: ${esc(reason(o.screened.reason))}`
      + (extra(o.screened) ? ` (${esc(o.screened.basis)})` : "") + ".";
    else if (o.held) status = `<span class="flag">held</span>Held for the ${esc(o.held)} run.`;
    else if (!o.published) status = `<span class="flag">no dossier</span>No published dossier yet.`;
    const match = o.match === "name" ? `<div class="sub">Same victim by name; our table links this event to another inventory row.</div>` : "";
    return `<div class="ours">${head}<div class="sub">${bits.join(" · ")}</div>${match}${status ? `<div class="sub">${status}</div>` : ""}</div>`;
  }

  function year(Y, lists, root, mname) {
    const y = Y.year, inv = Y.inventory, found = Y.found;
    const hit = inv.filter(v => v.ours.length).length;
    const linked = inv.filter(v => v.ours.some(o => o.published)).length;
    const listLabel = r => esc(lists[r.list] || r.list) + (r.list === "HAL" ? "" : ` ${esc(r.row)}`);
    const rows = inv.map(v => `<tr>
      <td class="d" data-l="Date">${esc(when(v.date, v.day_known))}</td>
      <td data-l="Victim"><span class="name">${esc(v.name || "Unnamed")}</span>${v.status && v.status !== "Lynching" ? `<div class="sub">${esc(v.status)}</div>` : ""}</td>
      <td data-l="Place">${place(v)}${v.accusation && !/^unknown$/i.test(v.accusation) ? `<div class="sub">Accused of: ${esc(v.accusation)}</div>` : ""}</td>
      <td data-l="Inventories">${v.rows.map(r => `<div>${listLabel(r)}</div>`).join("")}</td>
      <td data-l="Our record">${v.ours.length ? v.ours.map(o => ours(o, y, root)).join("") : `<span class="flag miss">not found</span><span class="empty">Not in our ${esc(mname)} ${y} table.</span>`}</td>
    </tr>`).join("");
    const frows = found.map(o => `<tr>
      <td class="d" data-l="Date">${esc(when(o.date))}</td>
      <td data-l="Our record">${ours(o, y, root, true)}</td>
      <td data-l="Place">${place(o)}</td>
      <td data-l="Victim's race">${o.victim_race === "Black" ? "Black" : "Not stated in the reports"}</td>
    </tr>`).join("");
    return `<section id="y${y}">
      <h2>${esc(mname)} ${y}</h2>
      <p class="sum">The inventories list ${inv.length} Black ${inv.length === 1 ? "victim" : "victims"} of lynching in ${esc(mname)} ${y}.
       ${hit} ${hit === 1 ? "is" : "are"} in our event table${linked < hit ? ` (${linked} with a published dossier)` : linked ? ", each with a dossier" : ""}${inv.length - hit ? `; ${inv.length - hit} ${inv.length - hit === 1 ? "is" : "are"} not` : ""}.
       Our sources add ${found.length} completed ${found.length === 1 ? "lynching" : "lynchings"} that no inventory lists.</p>
      <h3>In the inventories</h3>
      ${inv.length ? `<table><thead><tr><th>Date</th><th>Victim</th><th>Place</th><th>Inventories</th><th>Our record</th></tr></thead><tbody>${rows}</tbody></table>`
        : `<p class="empty">None.</p>`}
      <h3>Found only in our sources</h3>
      ${found.length ? `<table><thead><tr><th>Date</th><th>Our record</th><th>Place</th><th>Victim's race</th></tr></thead><tbody>${frows}</tbody></table>`
        : `<p class="empty">None.</p>`}
    </section>`;
  }

  fetch("view.json", {cache: "no-cache"}).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then(V => {
    document.getElementById("dek").innerHTML = V.dek;
    document.getElementById("years").innerHTML = V.years.map(Y => `<a href="#y${Y.year}">${esc(V.month)} ${Y.year}</a>`).join("");
    document.getElementById("main").innerHTML = V.years.map(Y => year(Y, V.lists, V.root, V.month)).join("");
    // one year at a time: the hash (#y1903) picks the year, the first year by default
    const show = () => {
      const want = V.years.some(Y => location.hash === `#y${Y.year}`) ? location.hash.slice(1) : `y${V.years[0].year}`;
      document.querySelectorAll("#main > section").forEach(s => { s.hidden = s.id !== want; });
      document.querySelectorAll("#years a").forEach(a => {
        if (a.getAttribute("href") === `#${want}`) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      });
    };
    addEventListener("hashchange", () => { show(); scrollTo(0, 0); });
    show();
  }).catch(e => { document.getElementById("main").innerHTML = `<p class="empty">Could not load the comparison (${esc(e.message)}).</p>`; });
})();
