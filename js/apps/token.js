/* MEDCORE OS — Token module: dashboard, CA registry, wallet scan (all live data) */
(function () {
  const CFG = window.MEDIX_CONFIG;
  const SYM = "$" + CFG.token.symbol;

  /* ---------- reusable CA block (used by the top bar, CA app, dashboard, docs) ---------- */
  const CA = {
    rowHTML(g) {
      const icons = g.nets.map((n) => Chain.icon(n, 16)).join("");
      const label = g.nets.map((n) => n.short).join(" · ");
      const ca = g.ca;
      return `
        <div class="ca-row" data-key="${g.key}">
          <span class="ca-icons">${icons}</span>
          <span class="ca-label">${label}</span>
          <code class="ca-addr ${ca ? "" : "pending"}">${ca ? U.esc(ca) : "PENDING DEPLOYMENT"}</code>
          <button class="btn ca-copy" ${ca ? "" : "disabled"} data-copy="${U.esc(ca)}">COPY CA</button>
          ${ca ? g.nets.map((n) => `<a class="btn ghost" href="${Chain.explorerToken(n.id)}" target="_blank" rel="noopener" title="${U.esc(n.name)} explorer">${n.short}↗</a>`).join("") : ""}
        </div>`;
    },
    html() { return Chain.caGroups().map(CA.rowHTML).join(""); },
    bind() {
      if (CA._bound) return; // single delegated listener for every COPY button in the OS
      CA._bound = true;
      document.addEventListener("click", (e) => {
        const b = e.target.closest("[data-copy]");
        if (b && b.dataset.copy) { U.copy(b.dataset.copy); b.textContent = "COPIED ✓"; setTimeout(() => (b.textContent = b.classList.contains("mini") ? "COPY" : "COPY CA"), 1400); }
      });
    },
  };
  window.CA = CA;

  /* ---------- Token dashboard ---------- */
  const Dash = {
    timer: 0,
    data: {},
    render(body) {
      const single = Chain.isSingle();
      body.innerHTML = `
        <div class="dash ${single ? "single" : "multi"}">
          <div class="dash-head">
            ${U.logo(40)}
            <div>
              <div class="dash-sym">${SYM} <span class="dim">/ ${U.esc(CFG.token.name)}</span></div>
              <div class="dim small">${single ? `SINGLE-NET · ${U.esc(Chain.list()[0].uplink)}` : "MULTI-NET · " + Chain.list().map((n) => n.short).join(" / ")}</div>
            </div>
            <div class="dash-ctl">
              <span class="dim small" data-upd>—</span>
              <button class="btn" data-refresh>REFRESH</button>
            </div>
          </div>
          <div class="ca-block">${CA.html()}</div>
          ${single ? "" : `<div class="agg" data-agg></div>`}
          <div class="nets">${Chain.list().map((n) => `
            <div class="net" data-net="${n.id}" style="--nc:${n.color}">
              <div class="net-h">${Chain.icon(n, 18)}<b>${U.esc(n.name)}</b><span class="dim small" data-st>…</span></div>
              <div class="net-b" data-body><span class="dim">initializing…</span></div>
            </div>`).join("")}
          </div>
          <div class="dim small src">SOURCE: DexScreener API · on-chain RPC (${Chain.list().map((n) => n.short).join(", ")}) · auto-refresh ${CFG.data.refreshMs / 1000}s</div>
        </div>`;
      CA.bind(body);
      body.querySelector("[data-refresh]").onclick = () => Dash.load(body);
      Dash.load(body);
      clearInterval(Dash.timer);
      Dash.timer = setInterval(() => document.body.contains(body) && !document.hidden && Dash.load(body), CFG.data.refreshMs);
    },

    async load(body) {
      const nets = Chain.list();
      const upd = body.querySelector("[data-upd]");
      upd.textContent = "SCANNING…";
      await Promise.all(nets.map((n) => Dash.loadNet(body, n)));
      upd.textContent = "SYNC " + U.time();
      Dash.renderAgg(body);
    },

    async loadNet(body, n) {
      const box = body.querySelector(`[data-net="${n.id}"]`);
      if (!box) return;
      const st = box.querySelector("[data-st]"), out = box.querySelector("[data-body]");
      const ca = Chain.tokenAddress(n.id);
      const ping = await Chain.ping(n.id);
      st.innerHTML = ping.ok ? `<span class="ok">● ${ping.ms}ms</span> #${U.num(ping.height, 0)}` : `<span class="err">● offline</span>`;
      if (!ca) {
        Dash.data[n.id] = null;
        out.innerHTML = `<pre class="awaiting">CONTRACT NOT CONFIGURED
> awaiting ${SYM} deployment on ${U.esc(n.name)}
> set token.${n.type === "solana" ? "sol" : "evm"} in js/config.js</pre>`;
        return;
      }
      try {
        const [m, supply] = await Promise.all([Chain.market(n.id).catch((e) => ({ error: e.message })), Chain.totalSupply(n.id)]);
        const p = m && m.best;
        Dash.data[n.id] = p ? { liq: p.liquidity?.usd || 0, vol: p.volume?.h24 || 0, mc: p.marketCap || p.fdv || 0 } : null;
        if (!p) {
          out.innerHTML = `<pre>NO LIQUIDITY POOL INDEXED${m && m.error ? " (" + U.esc(m.error) + ")" : ""}
supply (on-chain)  ${supply ? U.compact(Number(supply)) : "—"}</pre>`;
          return;
        }
        const ch = p.priceChange || {}, tx = (p.txns && p.txns.h24) || {};
        const buys = tx.buys || 0, sells = tx.sells || 0, tot = buys + sells;
        const chg = (k) => `<span class="${(ch[k] || 0) >= 0 ? "up" : "down"}">${U.pct(ch[k])}</span>`;
        const maxAbs = Math.max(1, ...["m5", "h1", "h6", "h24"].map((k) => Math.abs(ch[k] || 0)));
        const cbar = (k) => `${U.pad(k, 4)} <span class="${(ch[k] || 0) >= 0 ? "up" : "down"}">${U.bar(Math.abs(ch[k] || 0), maxAbs, 14)}</span> ${chg(k)}`;
        out.innerHTML = `
          <div class="price">${U.price(p.priceUsd)} ${chg("h24")}</div>
          <pre>MCAP     ${U.usd(p.marketCap || p.fdv)}
FDV      ${U.usd(p.fdv)}
LIQ      ${U.usd(p.liquidity?.usd)}
VOL 24H  ${U.usd(p.volume?.h24)}
SUPPLY   ${supply ? U.compact(Number(supply)) : "—"} <span class="dim">(on-chain)</span>
TXNS 24H ${tot} <span class="up">B ${buys}</span> / <span class="down">S ${sells}</span>
         <span class="up">${"█".repeat(tot ? Math.round((buys / tot) * 20) : 0)}</span><span class="down">${"█".repeat(tot ? 20 - Math.round((buys / tot) * 20) : 0)}</span>
${cbar("m5")}
${cbar("h1")}
${cbar("h6")}
${cbar("h24")}</pre>
          <div class="dim small">${U.esc(p.dexId || "")} · ${U.esc((p.baseToken?.symbol || "") + "/" + (p.quoteToken?.symbol || ""))} · ${m.pairs.length} pool(s) · <a href="${U.esc(p.url)}" target="_blank" rel="noopener">chart↗</a></div>`;
      } catch (e) {
        out.innerHTML = `<pre class="err">DATA LINK FAILURE: ${U.esc(e.message)}</pre>`;
      }
    },

    renderAgg(body) {
      const el = body.querySelector("[data-agg]");
      if (!el) return;
      const vals = Object.values(Dash.data).filter(Boolean);
      if (!vals.length) { el.innerHTML = `<pre class="dim">AGGREGATE: no live pools yet — CA pending or not indexed</pre>`; return; }
      const sum = (k) => vals.reduce((s, v) => s + v[k], 0);
      el.innerHTML = `<pre>AGGREGATE ${vals.length}/${Chain.list().length} NETS   LIQ ${U.usd(sum("liq"))}   VOL24H ${U.usd(sum("vol"))}</pre>`;
    },
  };

  Shell.app("token", {
    group: "TOKEN", usage: "token", desc: `${SYM} token dashboard (live)`, alias: ["dashboard", "mdx"],
    open() {
      const dw = WM.desk.clientWidth, dh = WM.desk.clientHeight;
      const w = Chain.isSingle() ? Math.min(560, dw * 0.44) : Math.min(900, Math.max(560, dw * 0.44));
      WM.open("token", {
        title: `${SYM} :: TOKEN DASHBOARD`, w, h: dh - 32,
        x: U.mobile() ? 0 : Math.max(8, dw - w - 16), y: U.mobile() ? 0 : 16,
        render: (b) => Dash.render(b),
        onClose: () => clearInterval(Dash.timer),
      });
      Shell.ok(`token dashboard mounted · ${Chain.list().length} network(s)`);
    },
  });

  Shell.app("ca", {
    group: "TOKEN", usage: "ca [copy] [net]", desc: "Contract addresses + copy", alias: ["contract"],
    open(args) {
      if (args[0] === "copy") {
        const n = Chain.resolve(args[1]) || Chain.list()[0];
        const ca = Chain.tokenAddress(n.id);
        if (!ca) return Shell.warn(`${SYM} CA on ${U.esc(n.name)} is pending deployment`);
        U.copy(ca);
        return Shell.ok(`${Chain.icon(n, 14)} ${U.esc(n.name)} CA copied → <code>${U.esc(ca)}</code>`);
      }
      Chain.caGroups().forEach((g) => Shell.print(`${g.nets.map((n) => Chain.icon(n, 14)).join("")} <span class="dim">${g.nets.map((n) => n.short).join("/")}</span>  ${g.ca ? `<code class="acc">${U.esc(g.ca)}</code> <button class="btn mini" data-copy="${U.esc(g.ca)}">COPY</button>` : `<span class="warn">PENDING DEPLOYMENT</span>`}`));
      WM.open("ca", {
        title: `${SYM} :: CONTRACT REGISTRY`, w: 680, h: 300,
        render(b) {
          b.innerHTML = `<div class="pad">
            <pre class="dim">TOKEN   ${U.esc(CFG.token.name)} (${SYM})
MODE    ${Chain.isSingle() ? "SINGLE · " + U.esc(Chain.list()[0].name) : "MULTI · Robinhood / Base / BSC share one EVM contract"}</pre>
            <div class="ca-block">${CA.html()}</div>
            <p class="dim small">Always verify the contract address from official ${U.esc(CFG.social.xHandle)} channels before interacting.</p></div>`;
          CA.bind(b);
        },
      });
    },
  });
  CA.bind(document.body); // copy buttons printed inside the terminal

  Shell.reg("scan", {
    group: "TOKEN", usage: "scan <wallet>", desc: `On-chain ${SYM} balance of a wallet`,
    async run(a, sh) {
      const w = (a[0] || "").trim();
      if (!w) return sh.err("usage: scan &lt;wallet address&gt;");
      const nets = Chain.list().filter((n) => (n.type === "solana" ? Chain.isSolAddr(w) : Chain.isEvmAddr(w)));
      if (!nets.length) return sh.err("address format does not match any active network");
      sh.info(`SCANNING ${U.esc(U.short(w, 8, 6))} on ${nets.map((n) => n.short).join(", ")}`);
      for (const n of nets) {
        if (!Chain.tokenAddress(n.id)) { sh.warn(`${Chain.icon(n, 14)} ${n.short}: ${SYM} CA pending deployment`); continue; }
        try {
          const bal = await sh.task(`${n.name} balanceOf`, Chain.balanceOf(n.id, w));
          sh.print(`${Chain.icon(n, 14)} <b>${n.short}</b>  ${U.num(Number(bal), 4)} ${SYM}  <a href="${Chain.explorerAddr(n.id, w)}" target="_blank" rel="noopener">explorer↗</a>`);
        } catch { /* task already printed failure */ }
      }
    },
  });
})();
