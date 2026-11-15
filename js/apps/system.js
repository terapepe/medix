/* MEDCORE OS — system modules: sysmon, net, diag, logs, neofetch, config */
(function () {
  const CFG = window.MEDIX_CONFIG;
  const T0 = performance.now();

  window.ASCII_LOGO = [
    "      ▄▄▄▄▄▄▄      ",
    "    ▄█▀ ▐█▌ ▀█▄    ",
    "   ██   ▐█▌   ██   ",
    "   █▌▐███████▌▐█   ",
    "   ██   ▐█▌   ██   ",
    "    ▀█▄ ▐█▌ ▄█▀    ",
    "      ▀▀▀▀▀▀▀      ",
  ];

  /* FPS meter (real) */
  const fps = { v: 0, n: 0, t: performance.now() };
  (function loop(t) { fps.n++; if (t - fps.t >= 1000) { fps.v = fps.n; fps.n = 0; fps.t = t; } requestAnimationFrame(loop); })(performance.now());

  /* ---------- SYSMON ---------- */
  Shell.app("sysmon", {
    group: "SYSTEM", desc: "Live system monitor (runtime metrics + kernel stream)", alias: ["top", "htop"],
    open() {
      let timer;
      WM.open("sysmon", {
        title: "SYSMON :: RUNTIME TELEMETRY", w: 560, h: 460,
        render(b) {
          b.innerHTML = `<div class="pad"><pre data-m></pre><div class="hdr">── KERNEL STREAM</div><pre class="stream" data-s></pre></div>`;
          const m = b.querySelector("[data-m]"), s = b.querySelector("[data-s]");
          const draw = () => {
            const mem = performance.memory;
            const heap = mem ? mem.usedJSHeapSize / 1048576 : null, lim = mem ? mem.jsHeapSizeLimit / 1048576 : null;
            const c = navigator.connection || {};
            const errs = Log.items.filter((e) => e.level === "err").length, nets = Log.items.filter((e) => e.level === "net").length;
            m.textContent =
`UPTIME     ${U.uptime(performance.now() - T0)}
FPS        ${String(fps.v).padStart(3)}  ${U.bar(fps.v, 60, 24)}
JS HEAP    ${heap ? heap.toFixed(1) + " MB" : "n/a (browser hides)"}${heap ? "  " + U.bar(heap, lim, 16) : ""}
DOM NODES  ${document.getElementsByTagName("*").length}
CPU CORES  ${navigator.hardwareConcurrency || "n/a"}   DEVICE MEM ${navigator.deviceMemory ? navigator.deviceMemory + " GB" : "n/a"}
LINK       ${navigator.onLine ? "ONLINE" : "OFFLINE"} ${c.effectiveType ? "· " + c.effectiveType.toUpperCase() : ""}${c.rtt != null ? " · rtt " + c.rtt + "ms" : ""}
VIEWPORT   ${innerWidth}×${innerHeight} @${devicePixelRatio}x
WINDOWS    ${WM.wins.size}   COMMANDS ${Shell.count}   NET I/O ${nets}   ERRORS ${errs}
MODE       ${Chain.isSingle() ? "SINGLE · " + Chain.list()[0].name : "MULTI · " + Chain.list().length + " networks"}`;
            s.textContent = Log.items.slice(-10).map((e) => `${U.time(e.t)} ${U.pad(e.level.toUpperCase(), 4)} ${e.msg}`).join("\n");
          };
          draw();
          timer = setInterval(draw, 1000);
        },
        onClose: () => clearInterval(timer),
      });
    },
  });

  /* ---------- LOGS ---------- */
  Shell.app("logs", {
    group: "SYSTEM", desc: "Kernel log (live network / command events)", alias: ["dmesg"],
    open() {
      let off;
      WM.open("logs", {
        title: "KERNEL LOG :: /var/log/medcore", w: 620, h: 360,
        render(b) {
          b.innerHTML = `<pre class="pad stream full"></pre>`;
          const p = b.firstElementChild;
          const add = (e) => {
            const ln = document.createElement("span");
            ln.className = "lv-" + e.level;
            ln.textContent = `${U.time(e.t)} [${e.level.toUpperCase()}] ${e.msg}\n`;
            p.appendChild(ln);
            while (p.childNodes.length > 300) p.firstChild.remove();
            p.scrollTop = p.scrollHeight;
          };
          Log.items.forEach(add);
          off = Log.on(add);
        },
        onClose: () => off && off(),
      });
    },
  });

  /* ---------- NET: real chain handshakes ---------- */
  Shell.reg("net", {
    group: "TOKEN", usage: "net", desc: "Handshake every active network (RPC height + latency)", alias: ["chains", "uplink"],
    async run(a, sh) {
      sh.info(`MODE ${Chain.isSingle() ? "SINGLE" : "MULTI"} · probing ${Chain.list().length} network(s)`);
      const res = await sh.task("RPC handshake", Promise.all(Chain.list().map(async (n) => [n, await Chain.ping(n.id)])));
      sh.table([["NET", "STATUS", "HEIGHT", "LATENCY", "CA"], ...res.map(([n, p]) => [
        `${Chain.icon(n, 13)} ${n.short}`,
        p.ok ? `<span class="ok">ONLINE</span>` : `<span class="err">OFFLINE</span>`,
        p.ok ? U.num(p.height, 0) : "—",
        p.ms + "ms",
        Chain.tokenAddress(n.id) ? U.short(Chain.tokenAddress(n.id)) : `<span class="warn">pending</span>`,
      ])], { html: true });
    },
  });

  /* ---------- DIAG: real data-service reachability ---------- */
  Shell.reg("diag", {
    group: "SYSTEM", usage: "diag", desc: "Diagnose all external data services",
    async run(a, sh) {
      const D = CFG.data;
      const probes = [
        ["DexScreener", `${D.dexscreener}/latest/dex/search?q=USDC`],
        ["openFDA", `${D.openfda}/drug/label.json?limit=1`],
        ["NLM Clinical Tables", `${D.nlm}/icd10cm/v3/search?terms=a&maxList=1`],
        ["NCBI PubMed", `${D.ncbi}/einfo.fcgi?db=pubmed&retmode=json`],
      ];
      sh.info("SCANNING external data services…");
      const rows = await Promise.all(probes.map(async ([name, url]) => {
        const t0 = performance.now();
        try { await U.json(url); return [name, `<span class="ok">ONLINE</span>`, Math.round(performance.now() - t0) + "ms"]; }
        catch (e) { return [name, `<span class="err">${U.esc(e.message)}</span>`, Math.round(performance.now() - t0) + "ms"]; }
      }));
      sh.table([["SERVICE", "STATUS", "LATENCY"], ...rows], { html: true });
    },
  });

  /* ---------- NEOFETCH ---------- */
  Shell.reg("neofetch", {
    group: "SYSTEM", usage: "neofetch", desc: "System summary", alias: ["about", "sysinfo"],
    run(a, sh) {
      const info = [
        `<span class="acc">${U.esc(sh.user())}</span>@<span class="acc">medcore</span>`,
        "───────────────────",
        `<span class="acc">OS</span>      ${U.esc(CFG.brand.os)} v${U.esc(CFG.brand.version)}`,
        `<span class="acc">Host</span>    ${U.esc(CFG.brand.domain)}`,
        `<span class="acc">Kernel</span>  medix-neural ${U.esc(CFG.brand.version)}`,
        `<span class="acc">Uptime</span>  ${U.uptime(performance.now() - T0)}`,
        `<span class="acc">Token</span>   ${U.esc(CFG.token.name)} ($${U.esc(CFG.token.symbol)})`,
        `<span class="acc">Mode</span>    ${Chain.isSingle() ? "SINGLE" : "MULTI"} · ${Chain.list().map((n) => Chain.icon(n, 12) + " " + n.short).join(" ")}`,
        `<span class="acc">Shell</span>   medsh · ${Object.keys(sh.cmds).length} commands`,
        `<span class="acc">X</span>       <a href="${CFG.social.x}" target="_blank" rel="noopener">${U.esc(CFG.social.xHandle)}</a>`,
      ];
      const logo = window.ASCII_LOGO;
      const n = Math.max(logo.length, info.length);
      sh.print(`<pre class="neo">${Array.from({ length: n }, (_, i) => `<span class="acc">${U.esc(logo[i] || " ".repeat(19))}</span>  ${info[i] || ""}`).join("\n")}</pre>`);
    },
  });

  /* ---------- CONFIG (read-only view) ---------- */
  Shell.app("config", {
    group: "SYSTEM", desc: "Inspect live configuration (js/config.js)", alias: ["cfg"],
    open() {
      WM.open("config", {
        title: "CONFIG :: js/config.js (read-only)", w: 620, h: 520,
        render(b) {
          const view = { brand: CFG.brand, token: CFG.token, social: CFG.social, mode: CFG.mode, singleNetwork: CFG.singleNetwork, multiOrder: CFG.multiOrder, activeNetworks: Chain.list().map((n) => n.id) };
          b.innerHTML = `<div class="pad"><p class="dim small">Edit <code>js/config.js</code> in the repository to change token, CA, mode, networks or X account. See <a href="#" data-run="docs config">docs config</a>.</p><pre class="json">${U.esc(JSON.stringify(view, null, 2))}</pre></div>`;
        },
      });
    },
  });
})();
