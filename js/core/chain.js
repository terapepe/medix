/* MEDCORE OS — network config helpers + live on-chain reads (JSON-RPC, no libraries) */
(function () {
  const CFG = window.MEDIX_CONFIG;
  const ALL = ["solana", "robinhood", "base", "bsc"];

  const Chain = {
    isSingle() { return CFG.mode === "single"; },
    singleId() { return CFG.networks[CFG.singleNetwork] ? CFG.singleNetwork : "solana"; },

    /** Active networks: single → 1 · multi → always all 4. */
    list() {
      if (Chain.isSingle()) return [Chain.get(Chain.singleId())];
      return [...new Set([...(CFG.multiOrder || []), ...ALL])].filter((id) => CFG.networks[id]).map(Chain.get);
    },
    get(id) { const n = CFG.networks[id]; return n ? { id, ...n } : null; },
    resolve(q) {
      if (!q) return null;
      q = q.toLowerCase();
      const alias = { sol: "solana", rh: "robinhood", hood: "robinhood", bnb: "bsc", bsc: "bsc", base: "base" };
      const id = CFG.networks[q] ? q : alias[q];
      return Chain.list().find((n) => n.id === id) || null;
    },

    /** Theme for the current mode (single → network colors, multi → brand theme). */
    theme() {
      if (Chain.isSingle()) { const n = Chain.get(Chain.singleId()); return { color: n.color, color2: n.color2, net: n }; }
      return { color: CFG.theme.color, color2: CFG.theme.color2, net: null };
    },

    /** Robinhood / Base / BSC share token.evm · Solana uses token.sol. */
    tokenAddress(id) {
      const n = CFG.networks[id];
      if (!n) return "";
      return ((n.type === "solana" ? CFG.token.sol : CFG.token.evm) || "").trim();
    },

    /** Networks grouped by identical CA → one copy row per CA. */
    caGroups() {
      return Chain.list().reduce((acc, n) => {
        const ca = Chain.tokenAddress(n.id);
        const key = n.type === "solana" ? "sol" : "evm";
        const g = acc.find((x) => x.key === key);
        g ? g.nets.push(n) : acc.push({ key, ca, nets: [n] });
        return acc;
      }, []);
    },

    explorerToken(id) {
      const n = CFG.networks[id], a = Chain.tokenAddress(id);
      return n && a ? n.explorer + n.explorerToken + a : "";
    },
    explorerAddr(id, a) {
      const n = CFG.networks[id];
      return n && a ? n.explorer + (n.explorerAddr || "/address/") + a : "";
    },

    async rpc(id, method, params = []) {
      const n = CFG.networks[id];
      const j = await U.json(n.rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        timeout: 7000,
      });
      if (j.error) throw new Error(j.error.message || "RPC error");
      return j.result;
    },

    /** Real handshake: latest block / slot + latency. */
    async ping(id) {
      const n = CFG.networks[id], t0 = performance.now();
      try {
        const r = n.type === "solana" ? await Chain.rpc(id, "getSlot") : parseInt(await Chain.rpc(id, "eth_blockNumber"), 16);
        return { ok: true, height: r, ms: Math.round(performance.now() - t0) };
      } catch (e) {
        return { ok: false, error: e.message, ms: Math.round(performance.now() - t0) };
      }
    },

    format(raw, dec) {
      const b = BigInt(raw), d = 10n ** BigInt(dec);
      const i = b / d, f = (b % d).toString().padStart(dec, "0").replace(/0+$/, "");
      return i.toString() + (f ? "." + f.slice(0, 6) : "");
    },
    async evmCall(id, to, data) { return Chain.rpc(id, "eth_call", [{ to, data }, "latest"]); },
    async evmDecimals(id, ca) { return Number(BigInt(await Chain.evmCall(id, ca, "0x313ce567"))); },

    /** On-chain total supply (null when CA unset / unreachable). */
    async totalSupply(id) {
      const n = CFG.networks[id], ca = Chain.tokenAddress(id);
      if (!n || !ca) return null;
      try {
        if (n.type === "solana") {
          const r = await Chain.rpc(id, "getTokenSupply", [ca]);
          return Chain.format(r.value.amount, r.value.decimals);
        }
        const dec = await Chain.evmDecimals(id, ca);
        return Chain.format(await Chain.evmCall(id, ca, "0x18160ddd"), dec);
      } catch { return null; }
    },

    /** Token balance of a wallet on a network. */
    async balanceOf(id, owner) {
      const n = CFG.networks[id], ca = Chain.tokenAddress(id);
      if (!n || !ca || !owner) return null;
      if (n.type === "solana") {
        const r = await Chain.rpc(id, "getTokenAccountsByOwner", [owner, { mint: ca }, { encoding: "jsonParsed" }]);
        let raw = 0n, dec = 0;
        for (const acc of r.value || []) { const t = acc.account.data.parsed.info.tokenAmount; raw += BigInt(t.amount); dec = t.decimals; }
        return Chain.format(raw, dec);
      }
      const data = "0x70a08231" + owner.toLowerCase().replace(/^0x/, "").padStart(64, "0");
      const dec = await Chain.evmDecimals(id, ca);
      return Chain.format(await Chain.evmCall(id, ca, data), dec);
    },

    isEvmAddr: (a) => /^0x[0-9a-fA-F]{40}$/.test(a || ""),
    isSolAddr: (a) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a || ""),

    /** DexScreener: all pairs of the token on a network, best (highest liquidity) first. */
    async market(id) {
      const n = CFG.networks[id], ca = Chain.tokenAddress(id);
      if (!ca) return null;
      const pairs = await U.json(`${CFG.data.dexscreener}/tokens/v1/${n.dexscreener}/${ca}`);
      const list = (Array.isArray(pairs) ? pairs : pairs.pairs || []).sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
      return { best: list[0] || null, pairs: list };
    },

    icon(n, size = 16) {
      return `<img class="neticon" src="${n.icon}" width="${size}" height="${size}" alt="${U.esc(n.name)}" title="${U.esc(n.name)}">`;
    },
  };

  window.Chain = Chain;
})();
