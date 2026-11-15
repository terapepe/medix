/* MEDCORE OS — init: theme, system bar, desktop, terminal */
(function () {
  const CFG = window.MEDIX_CONFIG;
  const SYM = "$" + CFG.token.symbol;

  function applyTheme() {
    const th = Chain.theme(), r = document.documentElement.style;
    r.setProperty("--acc", th.color);
    r.setProperty("--acc2", th.color2);
    document.body.dataset.net = th.net ? th.net.id : "multi";
    document.title = `${CFG.brand.os} — ${CFG.brand.name}${th.net ? " · " + th.net.name : ""}`;
    const fx = (k) => { const v = localStorage.getItem("medcore.fx." + k); return v == null ? CFG.fx[k] : v === "1"; };
    FX.crt(fx("crt"));
    FX.flicker(fx("flicker") && !U.reduced());
  }

  function sysbar() {
    const bar = document.getElementById("sysbar");
    const groups = Chain.caGroups();
    bar.innerHTML = `
      <button class="sb-brand" data-run="neofetch" title="${U.esc(CFG.brand.os)}">
        ${U.logo(20)}<b>${U.esc(CFG.brand.os)}</b><span class="dim">v${U.esc(CFG.brand.version)}</span>
      </button>
      <span class="sb-mode">${Chain.isSingle() ? Chain.icon(Chain.list()[0], 14) + " " + U.esc(Chain.list()[0].short) : "MULTI"}</span>
      <span class="sb-ca">${groups.map((g) => `
        <span class="chip" title="${g.ca ? U.esc(g.ca) : "CA pending"}">
          <span class="ca-icons">${g.nets.map((n) => Chain.icon(n, 14)).join("")}</span>
          <code>${g.ca ? U.esc(U.short(g.ca, 5, 4)) : "CA: PENDING"}</code>
          <button class="btn mini" ${g.ca ? "" : "disabled"} data-copy="${U.esc(g.ca)}" aria-label="Copy CA">COPY</button>
        </span>`).join("")}</span>
      <span class="sb-ticker dim" aria-hidden="true"></span>
      <span class="sb-right">
        <a href="${CFG.social.x}" target="_blank" rel="noopener" class="sb-x" title="${U.esc(CFG.social.xHandle)}">
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h6.9l4.8 6.4L18.9 2Zm-1.2 18h1.7L6.4 3.9H4.6L17.7 20Z"/></svg>
          <span>${U.esc(CFG.social.xHandle)}</span>
        </a>
        <span class="sb-op"><span class="ok">●</span> <span data-operator>${U.esc(Shell.user())}</span></span>
        <span class="sb-clock"></span>
      </span>`;
    const clock = bar.querySelector(".sb-clock");
    const tick = () => (clock.textContent = U.time());
    tick(); setInterval(tick, 1000);
    const tk = bar.querySelector(".sb-ticker");
    Log.on((e) => { tk.textContent = `${e.level.toUpperCase()} ▸ ${e.msg}`; });
  }

  function openTerm() {
    const desk = document.getElementById("desktop");
    const mob = U.mobile();
    const w = mob ? desk.clientWidth : Math.min(820, Math.round(desk.clientWidth * (CFG.autostart.length ? 0.52 : 0.7)));
    const h = mob ? desk.clientHeight : desk.clientHeight - 32;
    WM.open("term", {
      title: `medsh — ${Shell.user()}@medcore`, w, h, x: mob ? 0 : 16, y: mob ? 0 : 16,
      render: (b) => Shell.mount(b),
    });
  }

  async function motd() {
    const sh = Shell;
    sh.print(`<pre class="neo acc">${U.esc(window.ASCII_LOGO.join("\n"))}</pre>`);
    await sh.typed(`${CFG.brand.os} v${CFG.brand.version} — ${CFG.brand.tagline}`, "acc");
    sh.print(`<span class="dim">session opened for</span> <span class="acc">${U.esc(sh.user())}</span> <span class="dim">· ${new Date().toUTCString()}</span>`);
    sh.print(`<span class="dim">network mode:</span> ${Chain.isSingle() ? "SINGLE · " + Chain.icon(Chain.list()[0], 13) + " " + U.esc(Chain.list()[0].name) : "MULTI · " + Chain.list().map((n) => Chain.icon(n, 13) + " " + n.short).join("  ")}`);
    Chain.caGroups().forEach((g) => sh.print(`<span class="dim">${SYM} CA</span> ${g.nets.map((n) => Chain.icon(n, 13)).join("")} ${g.ca ? `<code class="acc">${U.esc(g.ca)}</code> <button class="btn mini" data-copy="${U.esc(g.ca)}">COPY</button>` : `<span class="warn">PENDING DEPLOYMENT</span>`}`));
    sh.print(`type <a href="#" data-run="help">help</a> for commands · <a href="#" data-run="docs">docs</a> for the manual · try <a href="#" data-run="icd asthma">icd asthma</a>`);
  }

  async function desktop() {
    document.getElementById("os").hidden = false;
    WM.init();
    sysbar();
    document.getElementById("tb-term").onclick = () => (WM.wins.has("term") ? WM.restore("term") : openTerm());
    document.getElementById("tb-launch").onclick = () => { if (!WM.wins.has("term")) openTerm(); else WM.restore("term"); Shell.exec("ls"); };
    openTerm();
    await motd();
    if (!U.mobile()) for (const a of CFG.autostart || []) Shell.apps[a] && Shell.apps[a].open([]);
    WM.focus("term");
    // deep link: ?app=docs  /  #docs
    const want = new URLSearchParams(location.search).get("app") || location.hash.slice(1);
    if (want) Shell.exec(want.replace(/[-_]/g, " "));
    Log.push("sys", "desktop ready");
  }

  document.addEventListener("click", (e) => {
    const r = e.target.closest("[data-run]");
    if (r && !e.target.closest(".term")) { e.preventDefault(); if (!WM.wins.has("term")) openTerm(); Shell.exec(r.dataset.run); }
  });
  addEventListener("keydown", (e) => {
    if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "`" && !e.target.closest("input"))) {
      e.preventDefault();
      WM.wins.has("term") ? WM.restore("term") : openTerm();
    }
  });

  async function start() {
    applyTheme();
    FX.Matrix.init();
    CA.bind();
    Log.push("sys", `kernel ${CFG.brand.version} · mode ${CFG.mode}`);
    const params = new URLSearchParams(location.search);
    const noBoot = !CFG.boot.enabled || params.has("noboot") || sessionStorage.getItem("medcore.booted");
    if (!noBoot) await Boot.run();
    sessionStorage.setItem("medcore.booted", "1");
    await desktop();
  }

  start();
})();
