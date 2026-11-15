/* MEDCORE OS — MEDIX AI: conversational core (Claude via /api/chat) with live OS tools */
(function () {
  const CFG = window.MEDIX_CONFIG;
  const D = CFG.data;
  const AI = Object.assign({ mode: "auto", endpoint: "/api/chat", maxToolRounds: 5, historyLimit: 24 }, CFG.ai || {});
  const SKEY = "medcore.ai.chat";
  const cut = (s, n = 1200) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };

  /* ================= tools executed in the browser (real data) ================= */
  const TOOLS = {
    async get_token_market({ network } = {}) {
      const nets = network ? [Chain.resolve(network)].filter(Boolean) : Chain.list();
      if (!nets.length) return { error: `network ${network} is not active in this deployment` };
      return Promise.all(nets.map(async (n) => {
        const ca = Chain.tokenAddress(n.id);
        if (!ca) return { network: n.name, contract: "PENDING — not announced yet" };
        const [m, supply] = await Promise.all([Chain.market(n.id).catch((e) => ({ error: e.message })), Chain.totalSupply(n.id)]);
        const p = m && m.best;
        if (!p) return { network: n.name, contract: ca, totalSupply: supply, market: m && m.error ? "error: " + m.error : "no liquidity pool indexed" };
        return {
          network: n.name, contract: ca, totalSupply: supply, priceUsd: p.priceUsd, marketCap: p.marketCap, fdv: p.fdv,
          liquidityUsd: p.liquidity?.usd, volume24h: p.volume?.h24, priceChange: p.priceChange, txns24h: p.txns?.h24,
          dex: p.dexId, pair: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`, pools: m.pairs.length, chart: p.url,
        };
      }));
    },
    async get_network_status() {
      return Promise.all(Chain.list().map(async (n) => ({ network: n.name, ...(await Chain.ping(n.id)) })));
    },
    async search_icd10({ term }) {
      const r = await U.json(`${D.nlm}/icd10cm/v3/search?sf=code,name&maxList=15&terms=${encodeURIComponent(term)}`);
      return { source: "NLM Clinical Tables ICD-10-CM", total: r[0], results: (r[3] || []).map(([code, name]) => ({ code, name })) };
    },
    async search_conditions({ term }) {
      const r = await U.json(`${D.nlm}/conditions/v3/search?maxList=8&df=primary_name,consumer_name&ef=icd10cm_codes,info_link_data&terms=${encodeURIComponent(term)}`);
      const ex = r[2] || {};
      return {
        source: "NLM Clinical Tables Conditions",
        results: (r[3] || []).map(([name, consumer], i) => ({
          name, consumer, icd10: (ex.icd10cm_codes || [])[i] || "",
          links: ((ex.info_link_data || [])[i] || []).slice(0, 2),
        })),
      };
    },
    async get_drug_label({ name }) {
      const t = String(name).toLowerCase().replace(/"/g, "");
      const search = encodeURIComponent(`openfda.brand_name:"${t}"`) + "+" + encodeURIComponent(`openfda.generic_name:"${t}"`);
      try {
        const r = await U.json(`${D.openfda}/drug/label.json?search=${search}&limit=1`);
        const L = r.results[0], of = L.openfda || {};
        return {
          source: "openFDA drug label", brand: of.brand_name, generic: of.generic_name, manufacturer: of.manufacturer_name, route: of.route,
          boxed_warning: L.boxed_warning && cut(L.boxed_warning[0]), indications: L.indications_and_usage && cut(L.indications_and_usage[0]),
          contraindications: L.contraindications && cut(L.contraindications[0], 800),
          warnings: cut((L.warnings_and_cautions || L.warnings || [""])[0], 1200), adverse_reactions: L.adverse_reactions && cut(L.adverse_reactions[0], 800),
          dailymed: L.set_id ? `https://dailymed.nlm.nih.gov/dailymed/lookup.cfm?setid=${L.set_id}` : undefined,
        };
      } catch (e) { if (e.status === 404) return { result: "no FDA label found" }; throw e; }
    },
    async get_drug_recalls({ name }) {
      try {
        const r = await U.json(`${D.openfda}/drug/enforcement.json?search=product_description:"${encodeURIComponent(String(name).replace(/"/g, ""))}"&sort=report_date:desc&limit=6`);
        return { source: "openFDA enforcement", total: r.meta?.results?.total, results: r.results.map((x) => ({ date: x.report_date, class: x.classification, status: x.status, firm: x.recalling_firm, product: cut(x.product_description, 160), reason: cut(x.reason_for_recall, 200) })) };
      } catch (e) { if (e.status === 404) return { result: "no recall records found" }; throw e; }
    },
    async search_pubmed({ query }) {
      const s = await U.json(`${D.ncbi}/esearch.fcgi?db=pubmed&retmode=json&retmax=6&sort=relevance&term=${encodeURIComponent(query)}`);
      const ids = s.esearchresult?.idlist || [];
      if (!ids.length) return { result: "no articles found" };
      const sum = await U.json(`${D.ncbi}/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`);
      return {
        source: "NCBI PubMed", total: s.esearchresult.count,
        results: ids.map((id) => sum.result[id]).filter(Boolean).map((x) => ({ pmid: x.uid, title: x.title, journal: x.source, date: x.pubdate, authors: (x.authors || []).slice(0, 3).map((a) => a.name), url: `https://pubmed.ncbi.nlm.nih.gov/${x.uid}/` })),
      };
    },
    async clinical_calc({ type, values = [], sex }) {
      const c = window.MedCalc && window.MedCalc[type];
      if (!c) return { error: "unknown calculator" };
      const nums = values.map(Number).filter((n) => !isNaN(n) && n > 0);
      const [result, note] = c.f(nums, sex || "m");
      return { result, note, formula: c.usage };
    },
    async open_app({ app, section }) {
      const a = Shell.apps[app];
      if (!a) return { error: "unknown app" };
      a.open(section ? [section] : []);
      return { opened: app };
    },
  };

  /* ================= tiny markdown → HTML (escaped first) ================= */
  function md(s) {
    let h = U.esc(s);
    h = h.replace(/`([^`\n]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
      .replace(/^#{1,4} (.+)$/gm, '<span class="acc">$1</span>')
      .replace(/^\s*[-*] /gm, "› ");
    return h;
  }

  /* ================= chat engine ================= */
  const Chat = {
    msgs: (() => { try { return JSON.parse(sessionStorage.getItem(SKEY) || "[]"); } catch { return []; } })(),
    busy: false,
    log: null,
    input: null,

    save() { try { sessionStorage.setItem(SKEY, JSON.stringify(this.msgs.slice(-AI.historyLimit))); } catch { /* quota */ } },

    /** History window that always starts on a real user turn (never on a tool_result). */
    history() {
      let m = this.msgs.slice(-AI.historyLimit);
      while (m.length && !(m[0].role === "user" && typeof m[0].content === "string")) m = m.slice(1);
      return m;
    },

    line(html, cls) {
      const d = document.createElement("div");
      d.className = "cl " + (cls || "");
      d.innerHTML = html;
      this.log.appendChild(d);
      this.log.scrollTop = this.log.scrollHeight;
      return d;
    },

    engine: "local",   // "claude" when the server key is configured, otherwise the free local engine
    ready: null,

    /** Pick the engine: config ai.mode = "auto" | "local" | "claude". */
    async status() {
      if (AI.mode === "local") {
        this.engine = "local";
        return this.line(`<span class="tag ok">[ OK ]</span> local engine online <span class="dim">· free mode, simple questions</span>`);
      }
      try {
        const j = await (await fetch(AI.endpoint, { method: "GET" })).json();
        if (!j.configured) throw new Error("key not configured");
        this.engine = "claude";
        this.line(`<span class="tag ok">[ OK ]</span> neural link established <span class="dim">· model ${U.esc(j.model)}</span>`);
      } catch (e) {
        this.engine = AI.mode === "claude" ? "claude" : "local";
        this.line(this.engine === "local"
          ? `<span class="tag ok">[ OK ]</span> local engine online <span class="dim">· free mode, simple questions</span>`
          : `<span class="tag err">[FAIL]</span> AI endpoint unavailable <span class="dim">(${U.esc(e.message)})</span>`);
      }
    },

    /** Run one live-data tool with an [EXEC] line; throws on failure. */
    async exec(name, input = {}) {
      const arg = Object.values(input).join(", ");
      const ln = this.line(`<span class="tag proc">[EXEC]</span> ${U.esc(name)}(${U.esc(cut(arg, 60))}) <span class="dim">PROCESSING</span>`, "t");
      const t0 = performance.now();
      try {
        const out = await (TOOLS[name] ? TOOLS[name](input) : Promise.reject(new Error("unknown tool")));
        ln.innerHTML = `<span class="tag ok">[EXEC]</span> ${U.esc(name)}(${U.esc(cut(arg, 60))}) <span class="dim">${Math.round(performance.now() - t0)}ms</span>`;
        return out;
      } catch (e) {
        ln.innerHTML = `<span class="tag err">[EXEC]</span> ${U.esc(name)} <span class="dim">— ${U.esc(e.message)}</span>`;
        throw e;
      }
    },

    /** Free local engine answer, typed out like a stream. */
    async local(text) {
      const out = await LocalBot.reply(text, { exec: (n, i) => this.exec(n, i) });
      const el = this.line(`<span class="who ai">medix&gt;</span> <span class="txt"></span><span class="cur">█</span>`, "a").querySelector(".txt");
      for (let i = 0; i <= out.length; i += 4) {
        el.innerHTML = md(out.slice(0, i));
        this.log.scrollTop = this.log.scrollHeight;
        if (!U.reduced()) await U.sleep(10);
      }
      el.innerHTML = md(out);
      el.parentElement.querySelector(".cur")?.remove();
      this.msgs.push({ role: "assistant", content: [{ type: "text", text: out }] });
    },

    async send(text) {
      text = (text || "").trim();
      if (!text || this.busy) return;
      this.busy = true;
      this.input && (this.input.disabled = true);
      this.line(`<span class="who you">${U.esc(Shell.user())}&gt;</span> ${U.esc(text)}`, "u");
      this.msgs.push({ role: "user", content: text });
      Log.push("cmd", `medix ← "${cut(text, 60)}"`);
      await this.ready;
      try {
        if (this.engine === "local") { await this.local(text); return; }
        for (let round = 0; round <= AI.maxToolRounds; round++) {
          const { blocks, stop } = await this.stream();
          const content = blocks.filter((b) => (b.type === "text" ? b.text.trim() : true)).map((b) => (b.type === "text" ? { type: "text", text: b.text } : { type: "tool_use", id: b.id, name: b.name, input: b.input }));
          if (content.length) this.msgs.push({ role: "assistant", content });
          if (stop !== "tool_use") break;
          const results = [];
          for (const b of blocks.filter((x) => x.type === "tool_use")) {
            try {
              const out = await this.exec(b.name, b.input || {});
              results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(out).slice(0, 12000) });
            } catch (e) {
              results.push({ type: "tool_result", tool_use_id: b.id, content: "Tool error: " + e.message, is_error: true });
            }
          }
          this.msgs.push({ role: "user", content: results });
          if (round === AI.maxToolRounds) this.line(`<span class="tag warn">[WARN]</span> tool round limit reached`);
        }
      } catch (e) {
        // drop the unanswered Claude turn so the conversation stays valid
        while (this.msgs.length && this.msgs[this.msgs.length - 1].role === "user") this.msgs.pop();
        if (this.engine === "claude" && AI.mode !== "claude") {
          // Claude unavailable (no credit, rate limit, outage) → answer with the free engine
          this.line(`<span class="tag warn">[WARN]</span> neural core unavailable (${U.esc(e.message)}) — switching to local engine`);
          this.engine = "local";
          this.msgs.push({ role: "user", content: text });
          try { await this.local(text); } catch (e2) { this.line(`<span class="tag err">[FAIL]</span> ${U.esc(e2.message)}`); }
        } else this.line(`<span class="tag err">[FAIL]</span> ${U.esc(e.message)}`);
      } finally {
        this.save();
        this.busy = false;
        if (this.input) { this.input.disabled = false; this.input.focus(); }
      }
    },

    /** One streamed Claude turn: renders text live, collects tool_use blocks. */
    async stream() {
      const r = await fetch(AI.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: this.history() }),
      });
      if (!r.ok) {
        let msg = "HTTP " + r.status;
        try { msg = (await r.json()).error || msg; } catch { /* non-JSON */ }
        throw new Error(msg);
      }
      const reader = r.body.getReader(), dec = new TextDecoder();
      const blocks = [];
      let buf = "", stop = null, el = null;
      const handle = (j) => {
        if (j.type === "content_block_start") {
          const cb = j.content_block;
          if (cb.type === "text") {
            blocks[j.index] = { type: "text", text: cb.text || "" };
            el = this.line(`<span class="who ai">medix&gt;</span> <span class="txt"></span><span class="cur">█</span>`, "a").querySelector(".txt");
          } else if (cb.type === "tool_use") blocks[j.index] = { type: "tool_use", id: cb.id, name: cb.name, json: "" };
        } else if (j.type === "content_block_delta") {
          const b = blocks[j.index];
          if (j.delta.type === "text_delta" && b) { b.text += j.delta.text; if (el) { el.innerHTML = md(b.text); this.log.scrollTop = this.log.scrollHeight; } }
          else if (j.delta.type === "input_json_delta" && b) b.json += j.delta.partial_json;
        } else if (j.type === "content_block_stop") {
          const b = blocks[j.index];
          if (b && b.type === "tool_use") { try { b.input = JSON.parse(b.json || "{}"); } catch { b.input = {}; } }
          if (b && b.type === "text" && el) { el.parentElement.querySelector(".cur")?.remove(); el = null; }
        } else if (j.type === "message_delta") stop = j.delta.stop_reason;
        else if (j.type === "error") throw new Error(j.error?.message || "stream error");
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const evt = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const data = evt.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
          if (data) handle(JSON.parse(data));
        }
      }
      this.log.querySelectorAll(".cur").forEach((c) => c.remove());
      return { blocks: blocks.filter(Boolean), stop };
    },

    reset() { this.msgs = []; this.save(); if (this.log) this.log.innerHTML = ""; this.greet(); },

    greet() {
      this.line(`<pre class="acc neo">${U.esc(window.ASCII_LOGO.join("\n"))}</pre>`);
      this.line(`<span class="acc">MEDIX AI</span> <span class="dim">· resident intelligence of ${U.esc(CFG.brand.os)} · ask about the project, $${U.esc(CFG.token.symbol)}, or medical reference data</span>`);
      this.ready = this.status();
      const ex = ["What is medix?", `Show $${CFG.token.symbol} live market data`, "ICD-10 code for type 2 diabetes", "Latest PubMed research on AI sepsis detection", "Recalls for metformin"];
      this.line(ex.map((q) => `<button class="btn mini" data-ask="${U.esc(q)}">${U.esc(q)}</button>`).join(" "), "ex");
    },

    replay() {
      this.msgs.forEach((m) => {
        if (typeof m.content === "string") this.line(`<span class="who you">${U.esc(Shell.user())}&gt;</span> ${U.esc(m.content)}`, "u");
        else if (m.role === "assistant") m.content.filter((b) => b.type === "text").forEach((b) => this.line(`<span class="who ai">medix&gt;</span> <span class="txt">${md(b.text)}</span>`, "a"));
      });
    },
  };

  Shell.app("medix", {
    group: "APPS", usage: "medix [question|reset]", desc: "MEDIX AI — talk to the resident AI", alias: ["chat", "ai", "ask"],
    open(args = []) {
      const q = args.join(" ").trim();
      if (q === "reset") { Chat.reset(); return Shell.ok("conversation memory wiped"); }
      const isNew = !WM.wins.has("medix");
      const dw = WM.desk.clientWidth, dh = WM.desk.clientHeight;
      WM.open("medix", {
        title: "MEDIX AI :: neural core", w: Math.min(640, dw - 32), h: Math.min(620, dh - 32),
        render(b) {
          b.innerHTML = `<div class="chat">
            <div class="chat-log" aria-live="polite"></div>
            <form class="chat-line" autocomplete="off">
              <label class="acc">ask&gt;</label>
              <input class="chat-in" maxlength="2000" spellcheck="false" placeholder="type a message…" aria-label="Message MEDIX AI" enterkeyhint="send">
              <button class="btn" type="submit">SEND</button>
            </form>
            <div class="dim small chat-note">⚕ Not medical or financial advice · AI can make mistakes · <a href="#" data-run="medix reset">reset</a></div>
          </div>`;
          Chat.log = b.querySelector(".chat-log");
          Chat.input = b.querySelector(".chat-in");
          b.querySelector(".chat-line").onsubmit = (e) => { e.preventDefault(); const v = Chat.input.value; Chat.input.value = ""; Chat.send(v); };
          b.addEventListener("click", (e) => { const a = e.target.closest("[data-ask]"); if (a) Chat.send(a.dataset.ask); });
          Chat.greet();
          Chat.replay();
          setTimeout(() => Chat.input.focus(), 50);
        },
      });
      if (isNew) Shell.ok("MEDIX AI window mounted");
      if (q) Chat.send(q);
    },
  });
})();
