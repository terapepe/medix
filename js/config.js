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
    // EVM contract address — shared by Robinhood, Base and BSC.
    evm: "0x579317261b896e94399881f3f7E51c375CCA03d2",
    // Solana mint address.
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
