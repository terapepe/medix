window.MEDIX_CONFIG = {
  brand: {
    name: "medix",                 // brand name (lowercase wordmark)
    os: "MEDCORE OS",              // operating system name
    version: "1.0.0",
    domain: "medix.wiki",
    tagline: "Medical AI Operations Core",
  },

  token: {
    name: "medix",                 // Token Name
    symbol: "MDX",                 // Token symbol (shown as $MDX)
    evm: "",
    sol: "",
  },

  social: {
    x: "https://x.com/medixwiki",
    xHandle: "@medixwiki",
  },
  mode: "single",
  singleNetwork: "robinhood",         // solana | robinhood | base | bsc
  multiOrder: ["solana", "robinhood", "base", "bsc"],

  networks: {
    solana: {
      name: "Solana",
      short: "SOL",
      type: "solana",
      icon: "assets/networks/solana.svg",
      color: "#14F195",            // accent used for text / glow
      color2: "#9945FF",           // secondary accent
      rpc: "https://solana-rpc.publicnode.com",
      explorer: "https://solscan.io",
      explorerToken: "/token/",
      explorerAddr: "/account/",
      dexscreener: "solana",       // DexScreener chain id
      uplink: "SOLANA MAINNET-BETA",
    },
    robinhood: {
      name: "Robinhood Chain",
      short: "RH",
      type: "evm",
      chainId: 4663,
      icon: "assets/networks/robinhood.svg",
      color: "#CCFF00",
      color2: "#7fa300",
      rpc: "https://rpc.mainnet.chain.robinhood.com",
      explorer: "https://robinhoodchain.blockscout.com",
      explorerToken: "/token/",
      explorerAddr: "/address/",
      dexscreener: "robinhood",
      uplink: "ROBINHOOD CHAIN L2",
    },
    base: {
      name: "Base",
      short: "BASE",
      type: "evm",
      chainId: 8453,
      icon: "assets/networks/base.svg",
      color: "#5B8CFF",            // lighter than brand #0052FF for legibility on black
      color2: "#0052FF",
      rpc: "https://mainnet.base.org",
      explorer: "https://basescan.org",
      explorerToken: "/token/",
      explorerAddr: "/address/",
      dexscreener: "base",
      uplink: "BASE MAINNET",
    },
    bsc: {
      name: "BNB Smart Chain",
      short: "BSC",
      type: "evm",
      chainId: 56,
      icon: "assets/networks/bsc.svg",
      color: "#F0B90B",
      color2: "#b38600",
      rpc: "https://bsc-dataseed.bnbchain.org",
      explorer: "https://bscscan.com",
      explorerToken: "/token/",
      explorerAddr: "/address/",
      dexscreener: "bsc",
      uplink: "BNB SMART CHAIN",
    },
  },

  /** Theme used in multi mode (single mode uses the network colors). */
  theme: {
    color: "#00FFC6",
    color2: "#00A3FF",
  },

  boot: {
    enabled: true,                 // show boot sequence on load
    pingNetworks: true,            // real RPC handshake during boot
    // ?noboot in the URL skips the boot sequence
  },

  fx: {
    crt: true,                     // scanlines + vignette + curvature
    flicker: true,
    matrix: true,                  // matrix rain background
    glitch: true,
  },

  /** Desktop layout on load (apps opened next to the terminal; ignored on mobile). */
  autostart: ["token"],          // e.g. ["token", "medix"]

  /** MEDIX AI chat (Claude via the Vercel function api/chat.js — API key lives in Vercel env vars). */
  ai: {
    // "auto"   → Claude when ANTHROPIC_API_KEY is set on Vercel, otherwise the free local engine
    // "local"  → always the free local engine (no API cost, simple questions only)
    // "claude" → Claude only (no fallback)
    mode: "auto",
    endpoint: "/api/chat",
    maxToolRounds: 5,              // max live-data tool calls per answer
    historyLimit: 24,              // messages kept in context
  },

  /** Real public data sources. */
  data: {
    refreshMs: 30000,              // token dashboard auto refresh
    timeoutMs: 9000,
    dexscreener: "https://api.dexscreener.com",
    openfda: "https://api.fda.gov",
    nlm: "https://clinicaltables.nlm.nih.gov/api",
    ncbi: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils",
  },
};

/* ---- hybot sync: CA, token name, symbol, X and Telegram follow the newest token hybot launched for this site ----
   https://hybot.xyz/api/site-token?site=<domain> · values above are the fallback when hybot has none / is unreachable.
   Links in the page that point to the old X / Telegram are updated, or hidden when the launched token has none. */
(function (C) {
  if (!C || typeof window === "undefined") return;
  var DOMAIN = "medix.wiki";
  var host = String(location.hostname || "").replace(/^www\./, "");
  var site = /\./.test(host) && !/(^|\.)(vercel\.app|localhost|127\.0\.0\.1)$/.test(host) ? host : DOMAIN;
  if (!site) return;
  var d = null, key = "hybot:" + site;
  try { var c = JSON.parse(localStorage.getItem(key) || "null"); if (c && Date.now() - c.t < 60000) d = c.d; } catch (e) {}
  if (!d) {
    try {
      var x = new XMLHttpRequest();
      x.open("GET", "https://hybot.xyz/api/site-token?site=" + encodeURIComponent(site), false); // sync: config must be ready before the app scripts run
      x.send();
      if (x.status === 200) { d = JSON.parse(x.responseText); try { localStorage.setItem(key, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {} }
    } catch (e) {}
  }
  if (!d || !d.found || !/^0x[0-9a-fA-F]{40}$/.test(d.ca || "")) return;
  var handle = function (u) { var m = String(u || "").match(/(?:x|twitter)\.com\/@?([A-Za-z0-9_]{1,15})|^@?([A-Za-z0-9_]{1,15})$/); return m ? (m[1] || m[2]) : ""; };
  var tgName = function (u) { var m = String(u || "").match(/t\.me\/([\w+/-]+)/); return m ? m[1].replace(/\/+$/, "") : String(u || "").replace(/^@/, ""); };
  var X0 = C.social && C.social.x || "", TG0 = C.social && C.social.telegram || "";
  var oldX = handle(X0), oldTg = tgName(TG0);
  var X = d.x || "", TG = d.telegram || "", SYM = d.symbol, NAME = d.name, CA = d.ca;
  // no X / Telegram on the launched token → config keeps the old link so the app renders as usual, and the link fixer below hides it
  var XV = X || X0, TGV = TG || TG0, XH = handle(XV);
  // single-network per-chain CA overrides would win over the shared address → clear them
  var net = C.singleNetwork || C.singleChain || (C.token && C.token.singleNetwork);
  [C.networks, C.chains, C.token && C.token.chains].forEach(function (m) { if (m && net && m[net] && "ca" in m[net]) m[net].ca = ""; });
  C.token.name = NAME; C.token.symbol = SYM; C.token.evm = CA;
  C.social.x = XV; C.social.xHandle = XH ? "@" + XH : ""; C.social.telegram = TGV;
  // page links still pointing to the old X / Telegram (hard-coded or rendered later)
  var fix = function (root) {
    var as = root.querySelectorAll ? root.querySelectorAll("a[href]") : [];
    for (var i = 0; i < as.length; i++) {
      var a = as[i], h = a.getAttribute("href") || "";
      if (oldX && new RegExp("(x|twitter)\\.com/@?" + oldX + "(?![A-Za-z0-9_])", "i").test(h) && !/intent|share/i.test(h)) {
        if (X) { if (h !== X) { a.href = X; if (XH && oldX !== XH) a.innerHTML = a.innerHTML.split("@" + oldX).join("@" + XH); } }
        else a.style.display = "none";
      } else if (oldTg && /t\.me\//i.test(h) && tgName(h).toLowerCase() === oldTg.toLowerCase()) {
        if (TG) { if (h !== TG) a.href = TG; } else a.style.display = "none";
      }
    }
  };
  var start = function () { fix(document); new MutationObserver(function (ms) { ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1) { fix(n); if (n.matches && n.matches("a[href]")) fix(n.parentNode || n); } }); }); }).observe(document.documentElement, { childList: true, subtree: true }); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})(window.MEDIX_CONFIG);
