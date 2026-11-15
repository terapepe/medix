/* MEDCORE OS — MEDIX local engine: free, offline intent matching (no API key).
 * Answers simple questions about the project and fetches real data through the
 * same tools MEDIX AI uses. */
(function () {
  const CFG = window.MEDIX_CONFIG;
  const SYM = "$" + CFG.token.symbol;

  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const has = (t, words) => words.some((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(t));
  /** Remove trigger words to get the subject (e.g. "side effects of ibuprofen" → "ibuprofen"). */
  const subject = (raw, words) => {
    let s = " " + norm(raw) + " ";
    words.forEach((w) => (s = s.replace(new RegExp(`(^|[^a-z0-9])${w}(?=[^a-z0-9]|$)`, "g"), " ")));
    return s.replace(/[?!.,:;"']/g, " ").replace(/\s+/g, " ").trim();
  };
  const STOP = ["what", "is", "are", "the", "a", "an", "for", "of", "about", "me", "show", "tell", "find", "search", "give", "get", "please", "on", "any", "latest", "recent"];

  const nets = () => Chain.list().map((n) => n.name).join(", ");
  const caLines = () => Chain.caGroups().map((g) => `- ${g.nets.map((n) => n.short).join(" / ")}: ${g.ca ? "`" + g.ca + "`" : "PENDING"}`).join("\n");
  const anyCA = () => Chain.caGroups().some((g) => g.ca);

  /* ---------- intents: first match wins (order matters) ---------- */
  const INTENTS = [
    {
      words: ["chest pain", "heart attack", "stroke", "suicide", "kill myself", "overdose", "cant breathe", "can't breathe", "severe bleeding"],
      run: () => "**If this is an emergency, call your local emergency number now.** If you are thinking about suicide, please reach out to a crisis line or someone you trust right away. I'm a reference tool and can't help in an emergency.",
    },
    {
      words: ["hi", "hello", "hey", "gm", "yo", "sup"],
      only: true,
      run: () => `Hello, ${Shell.user()}. I'm MEDIX, the resident AI of ${CFG.brand.os}. Ask me about ${SYM}, the networks, the contract address, or try \`icd asthma\`, \`drug ibuprofen\`, \`research sepsis\`.`,
    },
    {
      words: ["thanks", "thank you", "thx", "ty", "bye", "goodbye"],
      run: () => "Anytime. Session remains open — type `help` in the terminal for all commands.",
    },
    {
      words: ["ca", "contract", "address", "mint"],
      run: () => `${SYM} contract addresses:\n${caLines()}\n${anyCA() ? "Copy with `ca` or the COPY buttons in the top bar." : `The contract has not been announced yet. Follow ${CFG.social.xHandle} for the official address — anything else claiming to be ${SYM} is not confirmed by this site.`}`,
    },
    {
      words: ["buy", "where to buy", "how to buy", "swap"],
      run: () => `This site does not provide buy links. ${anyCA() ? "Always verify the contract with `ca` before trading. The `token` dashboard links to the live chart." : `The contract is still pending — wait for the official announcement on ${CFG.social.xHandle}.`} Not financial advice.`,
    },
    {
      words: ["price", "mcap", "market cap", "marketcap", "liquidity", "volume", "chart"],
      async run(t, raw, ctx) {
        if (!anyCA()) return `${SYM} has no live market yet — contract pending. Follow ${CFG.social.xHandle}.`;
        const net = Chain.list().find((n) => t.includes(n.id) || t.includes(n.short.toLowerCase()));
        const rows = await ctx.exec("get_token_market", net ? { network: net.id } : {});
        const out = rows.map((r) => (r.priceUsd
          ? `- **${r.network}**: ${U.price(r.priceUsd)} (${U.pct(r.priceChange?.h24)} 24h) · MC ${U.usd(r.marketCap || r.fdv)} · Liq ${U.usd(r.liquidityUsd)} · Vol ${U.usd(r.volume24h)}`
          : `- **${r.network}**: ${r.contract && r.contract.startsWith("PENDING") ? "contract pending" : r.market || "no data"}`)).join("\n");
        return `Live ${SYM} market (DexScreener):\n${out}\nNot financial advice.`;
      },
    },
    {
      words: ["status", "online", "uptime", "rpc", "block"],
      async run(t, raw, ctx) {
        const rows = await ctx.exec("get_network_status", {});
        return `Network handshake:\n${rows.map((r) => `- **${r.network}**: ${r.ok ? `online · #${U.num(r.height, 0)} · ${r.ms}ms` : "offline"}`).join("\n")}`;
      },
    },
    {
      words: ["network", "networks", "chain", "chains", "solana", "base", "bsc", "bnb", "robinhood"],
      run: () => `Mode: **${Chain.isSingle() ? "SINGLE" : "MULTI"}** — ${nets()}.${Chain.isSingle() ? "" : " Robinhood, Base and BSC share one EVM contract; Solana uses its own mint."} Run \`net\` for live status.`,
    },
    {
      words: ["twitter", "x", "social", "community", "telegram"],
      run: () => `Official X: [${CFG.social.xHandle}](${CFG.social.x})`,
    },
    {
      words: ["icd", "icd-10", "icd10", "diagnosis code"],
      async run(t, raw, ctx) {
        const term = subject(raw, ["icd-10", "icd10", "icd", "diagnosis", "codes", "code", ...STOP]);
        if (!term) return "Which condition? e.g. `icd asthma`";
        const r = await ctx.exec("search_icd10", { term });
        const out = r.results.slice(0, 8).map((x) => `- \`${x.code}\` ${x.name}`).join("\n");
        return out ? `ICD-10-CM for "${term}" (NLM):\n${out}` : `No ICD-10-CM match for "${term}".`;
      },
    },
    {
      words: ["recall", "recalls"],
      async run(t, raw, ctx) {
        const name = subject(raw, ["recalls", "recall", "drug", ...STOP]);
        if (!name) return "Which drug? e.g. `recall metformin`";
        const r = await ctx.exec("get_drug_recalls", { name });
        if (!r.results) return `No FDA recall records for "${name}".`;
        return `FDA recalls for "${name}" (${r.total} total):\n${r.results.slice(0, 5).map((x) => `- ${x.date} · ${x.class} · ${x.firm}: ${x.reason}`).join("\n")}`;
      },
    },
    {
      words: ["drug", "medication", "medicine", "side effect", "side effects", "pill", "contraindication", "contraindications"],
      async run(t, raw, ctx) {
        const name = subject(raw, ["side effects", "side effect", "contraindications", "contraindication", "medication", "medicine", "drug", "pill", ...STOP]);
        if (!name) return "Which drug? e.g. `drug ibuprofen`";
        const r = await ctx.exec("get_drug_label", { name });
        if (!r.indications && !r.warnings) return `No FDA label found for "${name}".`;
        const short = (s, n = 320) => (s && s.length > n ? s.slice(0, n) + "…" : s || "—");
        return `FDA label (openFDA):\n**${(r.brand || [name])[0]}** (${(r.generic || [""])[0]})\n${r.boxed_warning ? "**Boxed warning:** " + short(r.boxed_warning, 240) + "\n" : ""}**Indications:** ${short(r.indications)}\n**Warnings:** ${short(r.warnings, 240)}${r.dailymed ? `\n[Full label on DailyMed](${r.dailymed})` : ""}\nReference only — not medical advice.`;
      },
    },
    {
      words: ["research", "study", "studies", "paper", "papers", "pubmed", "article", "articles"],
      async run(t, raw, ctx) {
        const query = subject(raw, ["research", "studies", "study", "papers", "paper", "pubmed", "articles", "article", ...STOP]);
        if (!query) return "Research on what? e.g. `research sepsis machine learning`";
        const r = await ctx.exec("search_pubmed", { query });
        if (!r.results) return `No PubMed articles for "${query}".`;
        return `PubMed — "${query}" (${U.num(+r.total, 0)} hits):\n${r.results.slice(0, 5).map((x) => `- [${x.title}](${x.url}) — ${x.journal}, ${x.date}`).join("\n")}`;
      },
    },
    {
      words: ["bmi", "bsa", "egfr", "map"],
      async run(t, raw, ctx) {
        const type = ["bmi", "bsa", "egfr", "map"].find((k) => has(t, [k]));
        const values = (raw.match(/\d+(\.\d+)?/g) || []).map(Number);
        const sex = /\b(f|female|woman)\b/.test(t) ? "f" : "m";
        if (values.length < 2) return `Usage: \`${window.MedCalc[type].usage.replace("calc ", "")}\``;
        const r = await ctx.exec("clinical_calc", { type, values, sex });
        return `**${r.result}** — ${r.note}. Reference only.`;
      },
    },
    {
      words: ["help", "command", "commands", "how to use", "guide", "docs"],
      run: () => "Main commands: `token` (dashboard), `ca` (contract), `net` (networks), `icd`, `cond`, `drug`, `recall`, `pubmed`, `calc`, `docs`, `sysmon`. Type `help` in the terminal for the full list.",
    },
    {
      words: ["token", "mdx", "symbol", "ticker", "supply", "tokenomics"],
      run: () => `Token **${CFG.token.name}** (${SYM}) — native token of ${CFG.brand.name}, on ${nets()}. Contract: ${anyCA() ? "see `ca`" : "pending announcement"}. Live data: \`token\`.`,
    },
    {
      words: ["medix", "medcore", "what is", "about", "project", "who are you"],
      run: () => `**${CFG.brand.name}** is a medical-AI operations core shipped as a terminal OS — ${CFG.brand.os}. Its modules query real public datasets (NLM ICD-10, openFDA, PubMed) and live on-chain data for ${SYM}. Everything runs from commands; see \`docs\`.`,
    },
  ];

  const FALLBACK = "I'm running on the **local engine** and only understand simple questions. Try: \"what is medix\", \"price\", \"CA\", \"networks\", \"icd asthma\", \"drug ibuprofen\", \"research sepsis\", \"bmi 70 175\".";

  window.LocalBot = {
    /** Returns markdown text. ctx.exec(name, input) runs a live-data tool. */
    async reply(raw, ctx) {
      const t = norm(raw);
      const clean = t.replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
      for (const it of INTENTS) {
        const hit = it.only
          ? it.words.some((w) => clean === w || (clean.startsWith(w + " ") && clean.length < 25))
          : has(t, it.words);
        if (!hit) continue;
        try { return await it.run(t, raw, ctx); }
        catch (e) { return `Data link failure: ${e.message}`; }
      }
      return FALLBACK;
    },
  };
})();
