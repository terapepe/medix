/* MEDCORE OS — medical intelligence modules (real public data: NLM, openFDA, NCBI PubMed) */
(function () {
  const CFG = window.MEDIX_CONFIG;
  const D = CFG.data;
  const NOTE = `<span class="dim small">⚕ Reference data only — not medical advice. Consult a licensed clinician.</span>`;
  const route = (sh, src) => sh.print(`<span class="dim">NEURAL CORE ▸ routing query → ${src}</span>`);
  const trunc = (s, n = 600) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
  const q = (a) => a.join(" ").trim();

  /* ---------- CODEX: ICD-10-CM ---------- */
  Shell.reg("icd", {
    group: "MEDICAL", usage: "icd <term|code>", desc: "CODEX · ICD-10-CM diagnosis code search", alias: ["codex"],
    async run(a, sh) {
      const t = q(a);
      if (!t) return sh.err("usage: icd &lt;term or code&gt; · e.g. icd asthma");
      route(sh, "NLM Clinical Tables / ICD-10-CM");
      const r = await sh.task(`CODEX classify "${t}"`, U.json(`${D.nlm}/icd10cm/v3/search?sf=code,name&maxList=15&terms=${encodeURIComponent(t)}`));
      const rows = r[3] || [];
      if (!rows.length) return sh.warn("no matching ICD-10-CM codes");
      sh.table([["CODE", "DESCRIPTION"], ...rows.map(([c, n]) => [c, n])]);
      sh.print(`<span class="dim">${rows.length} of ${r[0]} match(es)</span> · ${NOTE}`);
    },
  });

  /* ---------- COND: condition lookup ---------- */
  Shell.reg("cond", {
    group: "MEDICAL", usage: "cond <condition>", desc: "Condition lookup → names, ICD-10 codes, MedlinePlus", alias: ["condition"],
    async run(a, sh) {
      const t = q(a);
      if (!t) return sh.err("usage: cond &lt;condition&gt; · e.g. cond migraine");
      route(sh, "NLM Clinical Tables / Conditions");
      const r = await sh.task(`resolve condition "${t}"`, U.json(`${D.nlm}/conditions/v3/search?maxList=8&df=primary_name,consumer_name&ef=icd10cm_codes,info_link_data&terms=${encodeURIComponent(t)}`));
      const disp = r[3] || [], ex = r[2] || {};
      if (!disp.length) return sh.warn("no matching conditions");
      disp.forEach(([name, consumer], i) => {
        const codes = (ex.icd10cm_codes || [])[i] || "";
        const links = (ex.info_link_data || [])[i] || [];
        const link = Array.isArray(links) && links[0] ? (Array.isArray(links[0]) ? links[0][0] : String(links[0]).split(",")[0]) : "";
        sh.print(`<span class="acc">▸ ${U.esc(name)}</span>${consumer && consumer !== name ? ` <span class="dim">(${U.esc(consumer)})</span>` : ""}${codes ? `  <span class="dim">ICD-10:</span> ${U.esc(codes)}` : ""}${link ? `  <a href="${U.esc(link)}" target="_blank" rel="noopener">MedlinePlus↗</a>` : ""}`);
      });
      sh.print(NOTE);
    },
  });

  /* ---------- PHARMA-SCAN: FDA drug label ---------- */
  Shell.reg("drug", {
    group: "MEDICAL", usage: "drug <name>", desc: "PHARMA-SCAN · FDA drug label (indications, warnings)", alias: ["pharma", "rx"],
    async run(a, sh) {
      const t = q(a).toLowerCase().replace(/"/g, "");
      if (!t) return sh.err("usage: drug &lt;brand or generic name&gt; · e.g. drug ibuprofen");
      route(sh, "openFDA / drug label");
      const search = encodeURIComponent(`openfda.brand_name:"${t}"`) + "+" + encodeURIComponent(`openfda.generic_name:"${t}"`);
      let r;
      try { r = await sh.task(`PHARMA-SCAN "${t}"`, U.json(`${D.openfda}/drug/label.json?search=${search}&limit=1`)); }
      catch (e) { if (e.status === 404) return sh.warn("no FDA label found"); throw e; }
      const L = r.results && r.results[0];
      if (!L) return sh.warn("no FDA label found");
      const of = L.openfda || {};
      const title = `${(of.brand_name || [t])[0]}${of.generic_name ? " · " + of.generic_name[0] : ""}`;
      sh.ok(`label acquired → window <span class="acc">pharma</span>`);
      const sec = (k, label, n) => (L[k] ? `<h4>${label}</h4><p>${U.esc(trunc(L[k][0], n))}</p>` : "");
      const w = WM.open("pharma", { title: "PHARMA-SCAN :: " + title.toUpperCase(), w: 640, h: 520 });
      w.el.querySelector(".win-title").textContent = "PHARMA-SCAN :: " + title.toUpperCase();
      w.body.innerHTML = `<div class="pad doc">
        <pre class="dim">BRAND     ${U.esc((of.brand_name || ["—"]).join(", "))}
GENERIC   ${U.esc((of.generic_name || ["—"]).join(", "))}
MAKER     ${U.esc((of.manufacturer_name || ["—"]).join(", "))}
ROUTE     ${U.esc((of.route || ["—"]).join(", "))}
LABEL     ${U.esc(L.effective_time || "—")}</pre>
        ${L.boxed_warning ? `<div class="alert">${sec("boxed_warning", "⚠ BOXED WARNING", 900)}</div>` : ""}
        ${sec("indications_and_usage", "INDICATIONS & USAGE", 900)}
        ${sec("contraindications", "CONTRAINDICATIONS", 600)}
        ${sec("warnings_and_cautions", "WARNINGS & PRECAUTIONS", 900) || sec("warnings", "WARNINGS", 900)}
        ${sec("adverse_reactions", "ADVERSE REACTIONS", 600)}
        ${L.set_id ? `<p><a href="https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${U.esc(L.set_id)}" target="_blank" rel="noopener">Full label on DailyMed↗</a></p>` : ""}
        <p>${NOTE}</p></div>`;
    },
  });

  /* ---------- RECALL-WATCH: FDA enforcement ---------- */
  Shell.reg("recall", {
    group: "MEDICAL", usage: "recall <drug>", desc: "RECALL-WATCH · FDA drug recall reports",
    async run(a, sh) {
      const t = q(a).replace(/"/g, "");
      if (!t) return sh.err("usage: recall &lt;drug&gt; · e.g. recall metformin");
      route(sh, "openFDA / drug enforcement");
      let r;
      try { r = await sh.task(`RECALL-WATCH "${t}"`, U.json(`${D.openfda}/drug/enforcement.json?search=product_description:"${encodeURIComponent(t)}"&sort=report_date:desc&limit=8`)); }
      catch (e) { if (e.status === 404) return sh.ok("no recall records found"); throw e; }
      const rows = r.results || [];
      sh.table([["DATE", "CLASS", "STATUS", "FIRM"], ...rows.map((x) => [x.report_date, x.classification, x.status, trunc(x.recalling_firm, 28)])]);
      rows.slice(0, 3).forEach((x) => sh.print(`<span class="dim">▸ ${U.esc(x.report_date)}:</span> ${U.esc(trunc(x.reason_for_recall, 160))}`));
      sh.print(`<span class="dim">${rows.length} of ${r.meta?.results?.total ?? rows.length} record(s)</span>`);
    },
  });

  /* ---------- NEURAL-LIT: PubMed ---------- */
  Shell.reg("pubmed", {
    group: "MEDICAL", usage: "pubmed <query>", desc: "NEURAL-LIT · PubMed literature retrieval", alias: ["lit"],
    async run(a, sh) {
      const t = q(a);
      if (!t) return sh.err("usage: pubmed &lt;query&gt; · e.g. pubmed sepsis machine learning");
      route(sh, "NCBI E-utilities / PubMed");
      const s = await sh.task(`index search "${t}"`, U.json(`${D.ncbi}/esearch.fcgi?db=pubmed&retmode=json&retmax=10&sort=relevance&term=${encodeURIComponent(t)}`));
      const ids = s.esearchresult?.idlist || [];
      if (!ids.length) return sh.warn("no articles found");
      const sum = await sh.task(`fetch ${ids.length} abstracts metadata`, U.json(`${D.ncbi}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`));
      const items = ids.map((id) => sum.result[id]).filter(Boolean);
      sh.ok(`${items.length} of ${U.num(+s.esearchresult.count, 0)} articles → window <span class="acc">lit</span>`);
      const html = `<div class="pad doc"><pre class="dim">QUERY  ${U.esc(t)}
HITS   ${U.num(+s.esearchresult.count, 0)} (showing ${items.length}, by relevance)</pre>
        ${items.map((x, i) => `<div class="lit">
          <div><span class="dim">${String(i + 1).padStart(2, "0")}</span> <a href="https://pubmed.ncbi.nlm.nih.gov/${x.uid}/" target="_blank" rel="noopener">${U.esc(x.title)}</a></div>
          <div class="dim small">${U.esc((x.authors || []).slice(0, 3).map((a) => a.name).join(", "))}${(x.authors || []).length > 3 ? " et al." : ""} · ${U.esc(x.source)} · ${U.esc(x.pubdate)} · PMID ${x.uid}</div>
        </div>`).join("")}</div>`;
      const w = WM.open("lit", { title: "NEURAL-LIT :: " + t.toUpperCase(), w: 700, h: 520 });
      w.el.querySelector(".win-title").textContent = "NEURAL-LIT :: " + t.toUpperCase();
      w.body.innerHTML = html;
    },
  });

  /* ---------- CLINIC-CALC ---------- */
  const calcs = {
    bmi: { usage: "calc bmi <kg> <cm>", f: ([kg, cm]) => { const b = kg / (cm / 100) ** 2; return [`BMI ${b.toFixed(1)} kg/m²`, b < 18.5 ? "underweight" : b < 25 ? "normal" : b < 30 ? "overweight" : "obese"]; } },
    bsa: { usage: "calc bsa <kg> <cm>", f: ([kg, cm]) => [`BSA ${Math.sqrt((kg * cm) / 3600).toFixed(2)} m²`, "Mosteller"] },
    map: { usage: "calc map <systolic> <diastolic>", f: ([s, d]) => { const m = (s + 2 * d) / 3; return [`MAP ${m.toFixed(0)} mmHg`, m < 65 ? "below 65 mmHg" : "≥ 65 mmHg"]; } },
    egfr: {
      usage: "calc egfr <creatinine mg/dL> <age> <m|f>",
      f: ([scr, age], sex) => {
        const fem = /^f/i.test(sex || ""), k = fem ? 0.7 : 0.9, al = fem ? -0.241 : -0.302;
        const e = 142 * Math.min(scr / k, 1) ** al * Math.max(scr / k, 1) ** -1.2 * 0.9938 ** age * (fem ? 1.012 : 1);
        const st = e >= 90 ? "G1" : e >= 60 ? "G2" : e >= 45 ? "G3a" : e >= 30 ? "G3b" : e >= 15 ? "G4" : "G5";
        return [`eGFR ${e.toFixed(0)} mL/min/1.73m²`, `CKD-EPI 2021 · stage ${st}`];
      },
    },
  };
  window.MedCalc = calcs; // shared with the MEDIX AI tools

  Shell.reg("calc", {
    group: "MEDICAL", usage: "calc <bmi|bsa|map|egfr> …", desc: "CLINIC-CALC · clinical formulas",
    run(a, sh) {
      const c = calcs[(a[0] || "").toLowerCase()];
      if (!c) { sh.print(Object.values(calcs).map((x) => `<a href="#" data-run="${x.usage.split(" <")[0]}">${U.esc(x.usage)}</a>`).join("<br>")); return; }
      const nums = a.slice(1).map(Number).filter((n) => !isNaN(n) && n > 0);
      const need = (c.usage.match(/</g) || []).length - (a[0] === "egfr" ? 1 : 0);
      if (nums.length < need) return sh.err("usage: " + U.esc(c.usage));
      const [v, note] = c.f(nums, a[a.length - 1]);
      sh.print(`<span class="tag ok">[CALC]</span> <span class="acc big">${U.esc(v)}</span> <span class="dim">${U.esc(note)}</span>`);
      sh.print(NOTE);
    },
  });
})();
