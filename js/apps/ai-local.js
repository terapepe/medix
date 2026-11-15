/* MEDCORE OS — MEDIX local engine: free, offline intent matching (no API key).
 * Answers simple questions about the project and fetches real data through the
 * same tools MEDIX AI uses. English + Vietnamese input, replies in the user's language. */
(function () {
  const CFG = window.MEDIX_CONFIG;
  const SYM = "$" + CFG.token.symbol;
  const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  const VI_WORDS = /\b(la gi|gia|bao nhieu|mang|lenh|huong dan|chao|cam on|thuoc|benh|nghien cuu|mua o dau)\b/i;

  const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
  const has = (t, words) => words.some((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(t));
  /** Remove trigger words to get the subject (e.g. "side effects of ibuprofen" → "ibuprofen"). */
  const subject = (raw, words) => {
    let s = " " + fold(raw) + " ";
    words.forEach((w) => (s = s.replace(new RegExp(`(^|[^a-z0-9])${w}(?=[^a-z0-9]|$)`, "g"), " ")));
    return s.replace(/[?!.,:;"']/g, " ").replace(/\s+/g, " ").trim();
  };
  const STOP = ["what", "is", "the", "a", "an", "for", "of", "about", "me", "show", "tell", "find", "search", "give", "please", "on", "la", "gi", "cua", "cho", "toi", "ve", "tim", "xem", "hay", "nao", "nhung", "cac", "ma", "voi"];

  const nets = () => Chain.list().map((n) => n.name).join(", ");
  const caLines = () => Chain.caGroups().map((g) => `- ${g.nets.map((n) => n.short).join(" / ")}: ${g.ca ? "`" + g.ca + "`" : "PENDING"}`).join("\n");
  const anyCA = () => Chain.caGroups().some((g) => g.ca);

  /* ---------- intents: first match wins (order matters) ---------- */
  const INTENTS = [
    {
      id: "emergency",
      words: ["chest pain", "heart attack", "stroke", "suicide", "kill myself", "overdose", "cant breathe", "can't breathe", "dau nguc", "dot quy", "tu tu", "kho tho", "qua lieu"],
      run: () => ({
        en: "**If this is an emergency, call your local emergency number now** (e.g. 115 in Vietnam, 911 in the US). If you are thinking about suicide, please reach out to a crisis line or someone you trust right away. I'm a reference tool and can't help in an emergency.",
        vi: "**Nếu đây là tình huống khẩn cấp, hãy gọi cấp cứu ngay** (115 tại Việt Nam). Nếu bạn đang có ý nghĩ tự tử, hãy liên hệ ngay đường dây hỗ trợ hoặc người bạn tin tưởng. Tôi chỉ là công cụ tra cứu, không thể hỗ trợ trong tình huống khẩn cấp.",
      }),
    },
    {
      id: "greet",
      words: ["hi", "hello", "hey", "gm", "yo", "xin chao", "chao", "alo"],
      only: true,
      run: () => ({
        en: `Hello, ${Shell.user()}. I'm MEDIX, the resident AI of ${CFG.brand.os}. Ask me about ${SYM}, the networks, the contract address, or try \`icd asthma\`, \`drug ibuprofen\`, \`research sepsis\`.`,
        vi: `Chào ${Shell.user()}. Tôi là MEDIX, AI của ${CFG.brand.os}. Bạn có thể hỏi về ${SYM}, các mạng, địa chỉ hợp đồng (CA), hoặc thử \`icd asthma\`, \`thuoc ibuprofen\`, \`nghien cuu sepsis\`.`,
      }),
    },
    {
      id: "thanks",
      words: ["thanks", "thank you", "thx", "ty", "cam on", "bye", "tam biet"],
      run: () => ({ en: "Anytime. Session remains open — type `help` in the terminal for all commands.", vi: "Rất sẵn lòng. Gõ `help` trong terminal để xem toàn bộ lệnh." }),
    },
    {
      id: "ca",
      words: ["contract", "address", "dia chi", "hop dong", "mint"],
      // "CA" only as an uppercase word or the first word — "ca" alone is a common Vietnamese syllable (cả, cá…)
      test: (t, raw) => /\bCA\b/.test(raw) || /^ca\b/i.test(raw.trim()),
      run: () => ({
        en: `${SYM} contract addresses:\n${caLines()}\n${anyCA() ? "Copy with `ca` or the COPY buttons in the top bar." : `The contract has not been announced yet. Follow ${CFG.social.xHandle} for the official address — anything else claiming to be ${SYM} is not confirmed by this site.`}`,
        vi: `Địa chỉ hợp đồng ${SYM}:\n${caLines()}\n${anyCA() ? "Copy bằng lệnh `ca` hoặc nút COPY trên thanh trên cùng." : `CA chưa được công bố. Theo dõi ${CFG.social.xHandle} để nhận địa chỉ chính thức — mọi địa chỉ khác tự nhận là ${SYM} đều chưa được xác nhận.`}`,
      }),
    },
    {
      id: "buy",
      words: ["buy", "where to buy", "how to buy", "mua", "mua o dau", "swap"],
      run: () => ({
        en: `This site does not provide buy links. ${anyCA() ? "Always verify the contract with `ca` before trading. The `token` dashboard links to the live chart." : `The contract is still pending — wait for the official announcement on ${CFG.social.xHandle}.`} Not financial advice.`,
        vi: `Site không cung cấp link mua. ${anyCA() ? "Luôn kiểm tra CA bằng lệnh `ca` trước khi giao dịch. Dashboard `token` có link chart trực tiếp." : `CA vẫn đang chờ công bố — hãy đợi thông báo chính thức trên ${CFG.social.xHandle}.`} Không phải lời khuyên tài chính.`,
      }),
    },
    {
      id: "price",
      words: ["price", "mcap", "market cap", "marketcap", "liquidity", "volume", "chart", "gia", "von hoa", "thanh khoan"],
      async run(t, raw, ctx) {
        if (!anyCA()) return { en: `${SYM} has no live market yet — contract pending. Follow ${CFG.social.xHandle}.`, vi: `${SYM} chưa có dữ liệu thị trường — CA đang chờ công bố. Theo dõi ${CFG.social.xHandle}.` };
        const net = Chain.list().find((n) => t.includes(n.id) || t.includes(n.short.toLowerCase()));
        const rows = await ctx.exec("get_token_market", net ? { network: net.id } : {});
        const out = rows.map((r) => (r.priceUsd
          ? `- **${r.network}**: ${U.price(r.priceUsd)} (${U.pct(r.priceChange?.h24)} 24h) · MC ${U.usd(r.marketCap || r.fdv)} · Liq ${U.usd(r.liquidityUsd)} · Vol ${U.usd(r.volume24h)}`
          : `- **${r.network}**: ${r.contract && r.contract.startsWith("PENDING") ? "contract pending" : r.market || "no data"}`)).join("\n");
        return { en: `Live ${SYM} market (DexScreener):\n${out}\nNot financial advice.`, vi: `Thị trường ${SYM} trực tiếp (DexScreener):\n${out}\nKhông phải lời khuyên tài chính.` };
      },
    },
    {
      id: "status",
      words: ["status", "online", "uptime", "rpc", "block", "trang thai", "hoat dong"],
      async run(t, raw, ctx) {
        const rows = await ctx.exec("get_network_status", {});
        const out = rows.map((r) => `- **${r.network}**: ${r.ok ? `online · #${U.num(r.height, 0)} · ${r.ms}ms` : "offline"}`).join("\n");
        return { en: `Network handshake:\n${out}`, vi: `Kết nối các mạng:\n${out}` };
      },
    },
    {
      id: "networks",
      words: ["network", "networks", "chain", "chains", "solana", "base", "bsc", "bnb", "robinhood", "mang", "mang nao"],
      run: () => ({
        en: `Mode: **${Chain.isSingle() ? "SINGLE" : "MULTI"}** — ${nets()}.${Chain.isSingle() ? "" : " Robinhood, Base and BSC share one EVM contract; Solana uses its own mint."} Run \`net\` for live status.`,
        vi: `Chế độ: **${Chain.isSingle() ? "SINGLE" : "MULTI"}** — ${nets()}.${Chain.isSingle() ? "" : " Robinhood, Base và BSC dùng chung một CA EVM; Solana có mint riêng."} Gõ \`net\` để xem trạng thái trực tiếp.`,
      }),
    },
    {
      id: "social",
      words: ["twitter", "x", "social", "community", "telegram", "cong dong", "mang xa hoi"],
      run: () => ({ en: `Official X: [${CFG.social.xHandle}](${CFG.social.x})`, vi: `X chính thức: [${CFG.social.xHandle}](${CFG.social.x})` }),
    },
    {
      id: "icd",
      words: ["icd", "icd-10", "icd10", "diagnosis code", "ma benh", "ma icd"],
      async run(t, raw, ctx) {
        const term = subject(raw, ["icd-10", "icd10", "icd", "diagnosis", "codes", "code", "ma benh", "ma", ...STOP]);
        if (!term) return { en: "Which condition? e.g. `icd asthma`", vi: "Bệnh nào? Ví dụ: `icd asthma` (dùng tên tiếng Anh)" };
        const r = await ctx.exec("search_icd10", { term });
        const out = r.results.slice(0, 8).map((x) => `- \`${x.code}\` ${x.name}`).join("\n");
        return out
          ? { en: `ICD-10-CM for "${term}" (NLM):\n${out}`, vi: `ICD-10-CM cho "${term}" (NLM):\n${out}` }
          : { en: `No ICD-10-CM match for "${term}". Try the English term.`, vi: `Không tìm thấy mã ICD-10 cho "${term}". Hãy thử tên bệnh bằng tiếng Anh.` };
      },
    },
    {
      id: "recall",
      words: ["recall", "recalls", "thu hoi"],
      async run(t, raw, ctx) {
        const name = subject(raw, ["recalls", "recall", "thu hoi", "drug", "thuoc", ...STOP]);
        if (!name) return { en: "Which drug? e.g. `recall metformin`", vi: "Thuốc nào? Ví dụ: `thu hoi metformin`" };
        const r = await ctx.exec("get_drug_recalls", { name });
        if (!r.results) return { en: `No FDA recall records for "${name}".`, vi: `Không có báo cáo thu hồi FDA cho "${name}".` };
        const out = r.results.slice(0, 5).map((x) => `- ${x.date} · ${x.class} · ${x.firm}: ${x.reason}`).join("\n");
        return { en: `FDA recalls for "${name}" (${r.total} total):\n${out}`, vi: `Thu hồi FDA cho "${name}" (tổng ${r.total}):\n${out}` };
      },
    },
    {
      id: "drug",
      words: ["drug", "medication", "medicine", "side effect", "side effects", "pill", "thuoc", "tac dung phu", "chong chi dinh"],
      async run(t, raw, ctx) {
        const name = subject(raw, ["side effects", "side effect", "medication", "medicine", "drug", "pill", "tac dung phu", "chong chi dinh", "thuoc", ...STOP]);
        if (!name) return { en: "Which drug? e.g. `drug ibuprofen`", vi: "Thuốc nào? Ví dụ: `thuoc ibuprofen` (tên thuốc tiếng Anh)" };
        const r = await ctx.exec("get_drug_label", { name });
        if (!r.indications && !r.warnings) return { en: `No FDA label found for "${name}".`, vi: `Không tìm thấy nhãn FDA cho "${name}".` };
        const short = (s, n = 320) => (s && s.length > n ? s.slice(0, n) + "…" : s || "—");
        const body = `**${(r.brand || [name])[0]}** (${(r.generic || [""])[0]})\n${r.boxed_warning ? "**Boxed warning:** " + short(r.boxed_warning, 240) + "\n" : ""}**Indications:** ${short(r.indications)}\n**Warnings:** ${short(r.warnings, 240)}${r.dailymed ? `\n[Full label on DailyMed](${r.dailymed})` : ""}`;
        return { en: `FDA label (openFDA):\n${body}\nReference only — not medical advice.`, vi: `Nhãn thuốc FDA (openFDA, tiếng Anh):\n${body}\nChỉ để tham khảo — không phải lời khuyên y tế.` };
      },
    },
    {
      id: "pubmed",
      words: ["research", "study", "studies", "paper", "papers", "pubmed", "article", "nghien cuu", "bai bao"],
      async run(t, raw, ctx) {
        const query = subject(raw, ["research", "studies", "study", "papers", "paper", "pubmed", "articles", "article", "latest", "recent", "nghien cuu", "bai bao", "moi nhat", ...STOP]);
        if (!query) return { en: "Research on what? e.g. `research sepsis machine learning`", vi: "Nghiên cứu về gì? Ví dụ: `nghien cuu sepsis machine learning`" };
        const r = await ctx.exec("search_pubmed", { query });
        if (!r.results) return { en: `No PubMed articles for "${query}".`, vi: `Không có bài PubMed cho "${query}".` };
        const out = r.results.slice(0, 5).map((x) => `- [${x.title}](${x.url}) — ${x.journal}, ${x.date}`).join("\n");
        return { en: `PubMed — "${query}" (${U.num(+r.total, 0)} hits):\n${out}`, vi: `PubMed — "${query}" (${U.num(+r.total, 0)} kết quả):\n${out}` };
      },
    },
    {
      id: "calc",
      words: ["bmi", "bsa", "egfr", "map"],
      async run(t, raw, ctx) {
        const type = ["bmi", "bsa", "egfr", "map"].find((k) => has(t, [k]));
        const values = (raw.match(/\d+(\.\d+)?/g) || []).map(Number);
        const sex = /\b(f|female|nu|woman)\b/.test(t) ? "f" : "m";
        const need = { bmi: 2, bsa: 2, map: 2, egfr: 2 }[type];
        if (values.length < need) return { en: `Usage: \`${window.MedCalc[type].usage.replace("calc ", "")}\``, vi: `Cách dùng: \`${window.MedCalc[type].usage.replace("calc ", "")}\`` };
        const r = await ctx.exec("clinical_calc", { type, values, sex });
        return { en: `**${r.result}** — ${r.note}. Reference only.`, vi: `**${r.result}** — ${r.note}. Chỉ để tham khảo.` };
      },
    },
    {
      id: "help",
      words: ["help", "command", "commands", "how to use", "guide", "docs", "lenh", "huong dan", "cach dung", "su dung"],
      run: () => ({
        en: "Main commands: `token` (dashboard), `ca` (contract), `net` (networks), `icd`, `cond`, `drug`, `recall`, `pubmed`, `calc`, `docs`, `sysmon`. Type `help` in the terminal for the full list.",
        vi: "Lệnh chính: `token` (dashboard), `ca` (hợp đồng), `net` (mạng), `icd`, `cond`, `drug`, `recall`, `pubmed`, `calc`, `docs`, `sysmon`. Gõ `help` trong terminal để xem đầy đủ.",
      }),
    },
    {
      id: "token",
      words: ["token", "mdx", "symbol", "ticker", "supply", "tokenomics"],
      run: () => ({
        en: `Token **${CFG.token.name}** (${SYM}) — native token of ${CFG.brand.name}, on ${nets()}. Contract: ${anyCA() ? "see `ca`" : "pending announcement"}. Live data: \`token\`.`,
        vi: `Token **${CFG.token.name}** (${SYM}) — token gốc của ${CFG.brand.name}, trên ${nets()}. CA: ${anyCA() ? "xem lệnh `ca`" : "đang chờ công bố"}. Dữ liệu trực tiếp: \`token\`.`,
      }),
    },
    {
      id: "about",
      words: ["medix", "medcore", "what is", "about", "project", "who are you", "gioi thieu", "la gi", "du an", "ban la ai"],
      run: () => ({
        en: `**${CFG.brand.name}** is a medical-AI operations core shipped as a terminal OS — ${CFG.brand.os}. Its modules query real public datasets (NLM ICD-10, openFDA, PubMed) and live on-chain data for ${SYM}. Everything runs from commands; see \`docs\`.`,
        vi: `**${CFG.brand.name}** là trung tâm vận hành AI y tế dưới dạng hệ điều hành terminal — ${CFG.brand.os}. Các module tra cứu dữ liệu công khai thật (NLM ICD-10, openFDA, PubMed) và dữ liệu on-chain trực tiếp của ${SYM}. Mọi thứ chạy bằng lệnh; xem \`docs\`.`,
      }),
    },
  ];

  const FALLBACK = {
    en: "I'm running on the **local engine** and only understand simple questions. Try: \"what is medix\", \"price\", \"CA\", \"networks\", \"icd asthma\", \"drug ibuprofen\", \"research sepsis\", \"bmi 70 175\".",
    vi: "Tôi đang chạy **chế độ local** nên chỉ hiểu câu hỏi đơn giản. Thử: \"medix là gì\", \"giá\", \"CA\", \"mạng\", \"icd asthma\", \"thuoc ibuprofen\", \"nghien cuu sepsis\", \"bmi 70 175\".",
  };

  window.LocalBot = {
    /** Returns markdown text. ctx.exec(name, input) runs a live-data tool. */
    async reply(raw, ctx) {
      const t = fold(raw);
      const lang = VI_CHARS.test(raw) || VI_WORDS.test(t) ? "vi" : "en";
      for (const it of INTENTS) {
        const clean = t.replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
        const hit = it.only
          ? it.words.some((w) => clean === w || (clean.startsWith(w + " ") && clean.length < 25))
          : has(t, it.words) || (it.test && it.test(t, raw));
        if (!hit) continue;
        try {
          const r = await it.run(t, raw, ctx);
          return r[lang];
        } catch (e) {
          return lang === "vi" ? `Lỗi khi lấy dữ liệu: ${e.message}` : `Data link failure: ${e.message}`;
        }
      }
      return FALLBACK[lang];
    },
  };
})();
