/* MEDCORE OS — built-in documentation (/usr/share/doc/medcore) */
(function () {
  const CFG = window.MEDIX_CONFIG;
  const SYM = "$" + CFG.token.symbol;
  const run = (c) => `<a href="#" data-run="${c}"><code>${c}</code></a>`;

  const SECTIONS = {
    intro: {
      title: "00 · README",
      html: () => `
        <pre class="acc logo-ascii">${U.esc(window.ASCII_LOGO.join("\n"))}</pre>
        <h2>${U.esc(CFG.brand.os)} <span class="dim">by ${U.esc(CFG.brand.name)}</span></h2>
        <p><b>${U.esc(CFG.brand.name)}</b> is a medical-AI operations core shipped as an operating system that runs in your browser.
        Instead of pages and menus, you get a shell: every capability is an application launched by a command.</p>
        <p>The medical modules query <b>real public datasets</b> — the U.S. National Library of Medicine (ICD-10-CM, conditions),
        openFDA (drug labels, recalls) and NCBI PubMed (biomedical literature). The token module reads <b>live market data</b>
        from DexScreener and <b>on-chain state</b> directly from each network's RPC. Nothing on screen is mock or demo data:
        if a source is unreachable the OS reports it.</p>
        <p><b>${SYM}</b> is the native token of the ${U.esc(CFG.brand.name)} network. Mode:
        <b>${Chain.isSingle() ? "SINGLE — " + U.esc(Chain.list()[0].name) : "MULTI — " + Chain.list().map((n) => n.name).join(", ")}</b>.</p>
        <p>Start with ${run("help")}, ${run("token")} or ${run("icd asthma")}.</p>`,
    },
    start: {
      title: "01 · QUICK START",
      html: () => `
        <h3>BOOT</h3>
        <p>On load the system runs a boot sequence (kernel init, real RPC handshake with each network, operator authentication).
        Press any key or tap to skip. Add <code>?noboot</code> to the URL to bypass it, or run ${run("reboot")} to replay it.</p>
        <h3>LOGIN</h3>
        <p>Enter a callsign at the LOGIN prompt (or press ENTER for <code>operator</code>). Change it later with <code>login &lt;callsign&gt;</code>.</p>
        <h3>THE SHELL</h3>
        <ul>
          <li>Type a command and press ENTER. <code>TAB</code> autocompletes, <code>↑ ↓</code> walks history, <code>Ctrl+L</code> clears.</li>
          <li>Chain commands with <code>;</code> — e.g. ${run("net; diag")}.</li>
          <li>Every command name printed in the terminal is clickable.</li>
          <li><code>help &lt;command&gt;</code> shows usage for a single command.</li>
        </ul>
        <h3>WINDOWS</h3>
        <ul>
          <li>Drag a window by its title bar, resize from the bottom-right corner.</li>
          <li><code>_</code> minimize · <code>□</code> maximize (or double-click the bar) · <code>×</code> close.</li>
          <li>The bottom status line lists running windows (<code>1:term*</code>) — click to focus / minimize / restore.</li>
          <li>${run("ps")} lists windows, <code>close &lt;id&gt;</code> or <code>close all</code> terminates them.</li>
        </ul>
        <h3>MOBILE</h3>
        <p>Windows open full-screen and stack. Quick-command chips sit under the prompt; the status line switches windows.</p>`,
    },
    commands: {
      title: "02 · COMMANDS",
      html: () => {
        const groups = {};
        Object.values(Shell.cmds).forEach((c) => (groups[c.group] = groups[c.group] || []).push(c));
        return `<p>Complete command reference (generated from the running shell).</p>` + ["APPS", "TOKEN", "MEDICAL", "SYSTEM", "FX"].filter((g) => groups[g]).map((g) => `
          <h3>${g}</h3>
          <table class="doc-tbl">${groups[g].map((c) => `<tr><td>${run(c.name)}</td><td><code>${U.esc(c.usage)}</code></td><td>${U.esc(c.desc)}${c.alias ? ` <span class="dim">(${c.alias.join(", ")})</span>` : ""}</td></tr>`).join("")}</table>`).join("");
      },
    },
    medical: {
      title: "03 · MEDICAL MODULES",
      html: () => `
        <p>Each module routes your query to an authoritative public dataset and renders the raw result.</p>
        <table class="doc-tbl">
          <tr><td><b>CODEX</b></td><td>${run("icd asthma")}</td><td>ICD-10-CM diagnosis codes · NLM Clinical Tables</td></tr>
          <tr><td><b>COND</b></td><td>${run("cond migraine")}</td><td>Condition names, ICD-10 codes, MedlinePlus links · NLM</td></tr>
          <tr><td><b>PHARMA-SCAN</b></td><td>${run("drug ibuprofen")}</td><td>FDA label: indications, boxed warning, contraindications, warnings, adverse reactions · openFDA</td></tr>
          <tr><td><b>RECALL-WATCH</b></td><td>${run("recall metformin")}</td><td>FDA drug recall / enforcement reports · openFDA</td></tr>
          <tr><td><b>NEURAL-LIT</b></td><td>${run("pubmed sepsis machine learning")}</td><td>Top PubMed articles by relevance · NCBI E-utilities</td></tr>
          <tr><td><b>CLINIC-CALC</b></td><td>${run("calc")}</td><td>BMI, BSA (Mosteller), MAP, eGFR (CKD-EPI 2021)</td></tr>
        </table>
        <p>Run ${run("diag")} to check every data service live.</p>
        <div class="alert"><p><b>⚕ Not medical advice.</b> Outputs are reference information from public datasets. They are not a diagnosis,
        prescription or treatment plan. Always consult a licensed clinician. In an emergency call your local emergency number.</p></div>`,
    },
    ai: {
      title: "03b · MEDIX AI",
      html: () => `
        <p><b>MEDIX AI</b> is the resident intelligence of ${U.esc(CFG.brand.os)}. Open it with ${run("medix")} or ask directly:
        <code>medix what is ${U.esc(CFG.brand.name)}?</code></p>
        <ul>
          <li>Knows the project: token, symbol, networks, contract addresses, commands — read from the live configuration.</li>
          <li>Fetches real data itself: token market & network status, ICD-10 codes, conditions, FDA labels & recalls, PubMed, clinical calculators. Each tool call appears as an <code>[EXEC]</code> line.</li>
          <li>Can open OS windows for you (dashboard, docs…).</li>
          <li>Two engines: <b>Claude</b> (full conversation, when the server key is set) and a free <b>local engine</b> that understands simple questions. Set <code>ai.mode</code> in config: <code>auto</code> | <code>local</code> | <code>claude</code>. In auto mode it falls back to local if Claude is unavailable.</li>
          <li><code>medix reset</code> wipes the conversation (kept only in this browser tab).</li>
        </ul>
        <div class="alert"><p>AI can make mistakes. It does not diagnose, prescribe or give financial advice.</p></div>`,
    },
    token: {
      title: "04 · TOKEN",
      html: () => `
        <table class="doc-tbl">
          <tr><td>Token name</td><td><b>${U.esc(CFG.token.name)}</b></td></tr>
          <tr><td>Symbol</td><td><b>${SYM}</b></td></tr>
          <tr><td>Mode</td><td>${Chain.isSingle() ? "SINGLE · " + U.esc(Chain.list()[0].name) : "MULTI · Solana, Robinhood, Base, BSC"}</td></tr>
          <tr><td>X</td><td><a href="${CFG.social.x}" target="_blank" rel="noopener">${U.esc(CFG.social.xHandle)}</a></td></tr>
        </table>
        <h3>CONTRACT ADDRESSES</h3>
        <div class="ca-block">${CA.html()}</div>
        <p class="dim small">In multi mode Robinhood, Base and BSC share one EVM contract address; Solana uses its own mint.</p>
        <h3>WHERE THE CA IS SHOWN</h3>
        <ul>
          <li>Top system bar — network icon + short address + one-click copy (always visible).</li>
          <li>${run("ca")} — contract registry window with explorer links; <code>ca copy &lt;net&gt;</code> copies from the shell.</li>
          <li>${run("token")} — header of the token dashboard.</li>
          <li>This page (docs → token).</li>
        </ul>
        <h3>LIVE DATA</h3>
        <p>${run("token")} shows price, market cap, FDV, liquidity, 24h volume, buy/sell flow and price change per network (DexScreener),
        plus on-chain total supply and network height/latency (RPC). ${run("net")} handshakes every network;
        <code>scan &lt;wallet&gt;</code> reads a wallet's ${SYM} balance on-chain.</p>
        <p class="dim small">Nothing here is financial advice. Verify the contract address on ${U.esc(CFG.social.xHandle)} before interacting.</p>`,
    },
    config: {
      title: "05 · CONFIGURATION",
      html: () => `
        <p>All settings live in <code>js/config.js</code> — edit it on GitHub and redeploy. No build step.</p>
        <table class="doc-tbl">
          <tr><td><code>brand.*</code></td><td>Brand name, OS name, version, domain, tagline</td></tr>
          <tr><td><code>token.name</code> / <code>token.symbol</code></td><td>Token name and symbol (currently ${U.esc(CFG.token.name)} / ${SYM})</td></tr>
          <tr><td><code>token.evm</code></td><td>EVM CA shared by Robinhood, Base and BSC</td></tr>
          <tr><td><code>token.sol</code></td><td>Solana mint address</td></tr>
          <tr><td><code>social.x</code> / <code>social.xHandle</code></td><td>X account link and handle</td></tr>
          <tr><td><code>mode</code></td><td><code>"single"</code> → one network · <code>"multi"</code> → always all 4</td></tr>
          <tr><td><code>singleNetwork</code></td><td><code>solana</code> | <code>robinhood</code> | <code>base</code> | <code>bsc</code> — the OS re-themes to that network</td></tr>
          <tr><td><code>multiOrder</code></td><td>Network order in multi mode</td></tr>
          <tr><td><code>networks.&lt;id&gt;</code></td><td>name, colors, icon, RPC, explorer, DexScreener id, boot uplink label</td></tr>
          <tr><td><code>theme</code></td><td>Accent colors for multi mode</td></tr>
          <tr><td><code>boot</code> / <code>fx</code></td><td>Boot sequence, CRT, flicker, matrix rain, glitch defaults</td></tr>
          <tr><td><code>autostart</code></td><td>Apps opened beside the terminal on desktop</td></tr>
          <tr><td><code>data.*</code></td><td>API endpoints, refresh interval, timeouts</td></tr>
        </table>
        <p>Inspect the running values with ${run("config")}.</p>`,
    },
    privacy: {
      title: "06 · DATA & PRIVACY",
      html: () => `
        <ul>
          <li>No accounts, no analytics. The only server code is the MEDIX AI proxy.</li>
          <li>Queries go directly from your browser to: DexScreener, network RPCs, NLM Clinical Tables, openFDA, NCBI.</li>
          <li>MEDIX AI messages are sent to <code>/api/chat</code> and processed by the Claude API (Anthropic). No chat logs are stored by this site.</li>
          <li>Local storage keys: <code>medcore.operator</code> (callsign), <code>medcore.history</code> (command history), <code>medcore.fx.*</code> (effect toggles). Clear with <code>history clear</code> or your browser settings.</li>
          <li>Do not enter personal health information — queries are sent to third-party public APIs.</li>
        </ul>`,
    },
  };

  Shell.app("docs", {
    group: "APPS", usage: "docs [section]", desc: "Documentation & project introduction", alias: ["readme", "guide"],
    open(args) {
      const pick = (args && args[0]) || "intro";
      const key = SECTIONS[pick] ? pick : Object.keys(SECTIONS).find((k) => k.startsWith(pick)) || "intro";
      const w = WM.open("docs", {
        title: "DOCS :: /usr/share/doc/medcore", w: 820, h: 560,
        render(b, win) {
          b.innerHTML = `<div class="docs">
            <nav class="docs-nav"><div class="dim small">/usr/share/doc</div>${Object.entries(SECTIONS).map(([k, s]) => `<button data-sec="${k}">${s.title}</button>`).join("")}</nav>
            <article class="docs-main doc"></article></div>`;
          const show = (k) => {
            b.querySelectorAll("[data-sec]").forEach((x) => x.classList.toggle("on", x.dataset.sec === k));
            const m = b.querySelector(".docs-main");
            m.innerHTML = SECTIONS[k].html();
            m.scrollTop = 0;
          };
          b.querySelector(".docs-nav").onclick = (e) => { const s = e.target.closest("[data-sec]"); if (s) show(s.dataset.sec); };
          win.show = show;
          win.onReopen = (a) => a && a[0] && show(SECTIONS[a[0]] ? a[0] : Object.keys(SECTIONS).find((k) => k.startsWith(a[0])) || "intro");
          show(key);
        },
      });
      if (w.show) w.show(key);
    },
  });
})();
