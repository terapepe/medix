/* MEDCORE OS — boot sequence → login → ACCESS GRANTED */
(function () {
  const CFG = window.MEDIX_CONFIG;

  const WORDMARK = [
    "███╗   ███╗███████╗██████╗ ██╗██╗  ██╗",
    "████╗ ████║██╔════╝██╔══██╗██║╚██╗██╔╝",
    "██╔████╔██║█████╗  ██║  ██║██║ ╚███╔╝ ",
    "██║╚██╔╝██║██╔══╝  ██║  ██║██║ ██╔██╗ ",
    "██║ ╚═╝ ██║███████╗██████╔╝██║██╔╝ ██╗",
    "╚═╝     ╚═╝╚══════╝╚═════╝ ╚═╝╚═╝  ╚═╝",
  ].join("\n");

  const Boot = {
    skip: false,
    el: null,
    log: null,

    line(html, cls = "") {
      const d = document.createElement("div");
      d.className = "bl " + cls;
      d.innerHTML = html;
      this.log.appendChild(d);
      this.log.scrollTop = this.log.scrollHeight;
      return d;
    },
    async typed(text, cls = "") {
      const d = this.line("", cls);
      await FX.type(d, text, this.skip ? 0 : 6);
      return d;
    },
    wait(ms) { return this.skip ? Promise.resolve() : U.sleep(ms); },
    stamp() { return `<span class="dim">[${(performance.now() / 1000).toFixed(4).padStart(10)}]</span>`; },

    async run() {
      this.el = document.getElementById("boot");
      this.el.hidden = false;
      this.el.innerHTML = `<div class="boot-log"></div><div class="boot-skip dim">[ press any key to skip ]</div>`;
      this.log = this.el.querySelector(".boot-log");
      const onSkip = (e) => { if (!e.target.closest || !e.target.closest(".login")) this.skip = true; };
      addEventListener("keydown", onSkip);
      this.el.addEventListener("pointerdown", onSkip);

      const th = Chain.theme();
      await this.typed(`MEDCORE BIOS v4.2.1  ·  (c) ${new Date().getFullYear()} ${CFG.brand.name} labs  ·  ${CFG.brand.domain}`, "acc");
      await this.wait(120);
      this.line(`${this.stamp()} CPU  neural-tensor array ×${navigator.hardwareConcurrency || "?"} ............ <span class="ok">OK</span>`);
      await this.wait(60);
      this.line(`${this.stamp()} MEM  ${navigator.deviceMemory ? navigator.deviceMemory + " GB" : "volatile"} ECC ............ <span class="ok">OK</span>`);
      await this.wait(60);
      this.line(`${this.stamp()} GPU  ${innerWidth}×${innerHeight} framebuffer @${devicePixelRatio}x ...... <span class="ok">OK</span>`);
      await this.wait(80);
      await this.typed(`Loading kernel medix-neural-${CFG.brand.version} …`);
      await this.wait(120);
      ["mounting /dev/neural0", "mounting /med/icd10cm (NLM)", "mounting /med/openfda", "mounting /med/pubmed (NCBI)", "loading medsh shell"].forEach((m) =>
        this.line(`${this.stamp()} ${m} <span class="ok">done</span>`));
      await this.wait(160);

      // SYSTEM INITIALIZING progress
      const p = this.line(`<span class="acc">SYSTEM INITIALIZING</span> <span class="pb"></span>`);
      const pb = p.querySelector(".pb");
      for (let i = 0; i <= 24; i++) { pb.textContent = `[${"█".repeat(i)}${"░".repeat(24 - i)}] ${Math.round((i / 24) * 100)}%`; await this.wait(22); }

      // SCANNING: real RPC handshake
      this.line(`<span class="acc">SCANNING NETWORK UPLINKS</span> <span class="dim">mode=${Chain.label("id", ",")}</span>`);
      const nets = Chain.list();
      const rows = nets.map((n) => this.line(`  ${Chain.icon(n, 13)} ${U.pad(n.uplink, 22).replace(/ /g, "&nbsp;")} <span class="dim">handshake…</span>`));
      if (CFG.boot.pingNetworks) {
        await Promise.all(nets.map(async (n, i) => {
          const r = await Promise.race([Chain.ping(n.id), U.sleep(3500).then(() => ({ ok: false, error: "timeout", ms: 3500 }))]);
          rows[i].innerHTML = `  ${Chain.icon(n, 13)} ${U.pad(n.uplink, 22).replace(/ /g, "&nbsp;")} ${r.ok ? `<span class="ok">ONLINE</span> <span class="dim">${n.type === "solana" ? "slot" : "block"} #${U.num(r.height, 0)} · ${r.ms}ms</span>` : `<span class="warn">DEGRADED</span> <span class="dim">${U.esc(r.error)}</span>`}`;
        }));
      } else rows.forEach((r) => (r.innerHTML += ' <span class="ok">LINKED</span>'));

      this.line(`<span class="acc">PROCESSING</span> token registry · ${U.esc(CFG.token.name)} ($${U.esc(CFG.token.symbol)}) · ${Chain.caGroups().map((g) => (g.ca ? U.short(g.ca) : "CA pending")).join(" / ")}`);
      await this.wait(250);

      // Wordmark
      const wm = this.line(`<pre class="wordmark"></pre>`);
      await FX.decode(wm.firstChild, WORDMARK, this.skip ? 1 : 12);
      this.line(`<span class="dim">${U.esc(CFG.brand.os)} v${CFG.brand.version} · ${U.esc(CFG.brand.tagline)}${th.net ? " · " + U.esc(th.net.uplink) : ""}</span>`);
      await this.wait(200);

      // token + official channel, visible before login
      this.line(`<div class="boot-info">${Chain.caGroups().map((g) => `<div>${g.nets.map((n) => Chain.icon(n, 14)).join("")} <span class="dim">${g.nets.map((n) => n.short).join(" / ")}</span> <span class="acc">$${U.esc(CFG.token.symbol)} CA</span> ${g.ca ? `<code>${U.esc(g.ca)}</code> <button class="btn mini" data-copy="${U.esc(g.ca)}">COPY</button>` : `<span class="warn">PENDING DEPLOYMENT</span>`}</div>`).join("")}
        <div><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" style="vertical-align:-2px"><path fill="currentColor" d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h6.9l4.8 6.4L18.9 2Zm-1.2 18h1.7L6.4 3.9H4.6L17.7 20Z"/></svg> <a href="${CFG.social.x}" target="_blank" rel="noopener">${U.esc(CFG.social.xHandle)}</a></div></div>`, "ll");

      removeEventListener("keydown", onSkip);
      this.el.querySelector(".boot-skip").remove();
      await this.login();
    },

    login() {
      return new Promise((resolve) => {
        const saved = localStorage.getItem("medcore.operator") || "medix";
        const box = this.line(`
          <form class="login" autocomplete="off">
            <div><span class="acc">medcore login:</span> <input name="u" maxlength="16" spellcheck="false" autocapitalize="off" value="${U.esc(saved)}" placeholder="medix" aria-label="Callsign"></div>
            <div class="dim small">enter a callsign · ENTER to authenticate</div>
          </form>`, "ll");
        const f = box.querySelector("form"), inp = f.querySelector("input");
        setTimeout(() => inp.focus(), 50);
        f.onsubmit = async (e) => {
          e.preventDefault();
          const u = (inp.value || "medix").replace(/[^\w.-]/g, "").slice(0, 16) || "medix";
          localStorage.setItem("medcore.operator", u);
          box.innerHTML = `<span class="acc">medcore login:</span> ${U.esc(u)}`;
          this.skip = false;
          const a = this.line(`AUTHENTICATING <span class="dots"></span>`);
          for (let i = 0; i < 6; i++) { a.querySelector(".dots").textContent = ".".repeat(i % 4); await U.sleep(110); }
          a.innerHTML = `AUTHENTICATING … <span class="ok">verified</span> · clearance LEVEL-3`;
          FX.Matrix.burst(1400);
          const g = this.line(`ACCESS GRANTED`, "granted");
          FX.glitch(g, 900);
          await U.sleep(U.reduced() ? 200 : 950);
          this.el.classList.add("out");
          await U.sleep(400);
          this.el.hidden = true;
          this.el.innerHTML = "";
          resolve(u);
        };
      });
    },
  };

  window.Boot = Boot;
})();
