/* MEDCORE OS — command shell (parser, history, autocomplete, output primitives, built-ins) */
(function () {
  const CFG = window.MEDIX_CONFIG;
  const HKEY = "medcore.history", UKEY = "medcore.operator";

  const Shell = {
    cmds: {},
    aliases: {},
    apps: {},          // launchable windows: name → { title, open(args) }
    hist: JSON.parse(localStorage.getItem(HKEY) || "[]"),
    hi: -1,
    count: 0,
    busy: false,
    out: null,
    input: null,

    user() { return localStorage.getItem(UKEY) || "operator"; },

    /** Register a command: { group, usage, desc, alias:[], run(args, sh) } */
    reg(name, def) {
      this.cmds[name] = { name, group: "SYSTEM", ...def };
      (def.alias || []).forEach((a) => (this.aliases[a] = name));
    },
    /** Register an app window launched by a command of the same name. */
    app(name, def) {
      this.apps[name] = def;
      this.reg(name, { group: def.group || "APPS", usage: def.usage || name, desc: def.desc, alias: def.alias, run: (args) => def.open(args) });
    },

    mount(body) {
      body.classList.add("term");
      body.innerHTML = `
        <div class="term-out" aria-live="polite"></div>
        <form class="term-line" autocomplete="off">
          <label class="prompt"></label>
          <input class="term-in" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Command input" enterkeyhint="go">
          <span class="busy" hidden>PROCESSING</span>
        </form>
        <div class="chips"></div>`;
      this.out = body.querySelector(".term-out");
      this.input = body.querySelector(".term-in");
      this.form = body.querySelector(".term-line");
      this.busyEl = body.querySelector(".busy");
      this.setPrompt();

      const chips = body.querySelector(".chips");
      ["medix", "help", "token", "ca", "docs", "sysmon", "net", "icd fever", "drug aspirin", "pubmed sepsis", "logs"].forEach((c) => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = c;
        b.onclick = () => this.exec(c);
        chips.appendChild(b);
      });

      this.form.addEventListener("submit", (e) => {
        e.preventDefault();
        const v = this.input.value;
        this.input.value = "";
        this.exec(v);
      });
      this.input.addEventListener("keydown", (e) => this.key(e));
      body.addEventListener("click", (e) => {
        const run = e.target.closest("[data-run]");
        if (run) { e.preventDefault(); this.exec(run.dataset.run); return; }
        if (!getSelection().toString() && !e.target.closest("a,button,input")) this.focusInput();
      });
    },

    focusInput() { if (this.input && !U.mobile()) this.input.focus({ preventScroll: true }); },

    setPrompt() {
      const net = Chain.isSingle() ? Chain.singleId() : "multi";
      const p = this.form && this.form.querySelector(".prompt");
      if (p) p.innerHTML = `<span class="p-user">${U.esc(this.user())}</span><span class="p-rest">@<span class="p-host">medcore</span>:<span class="p-net">${net}</span></span><span class="p-sym">$</span>`;
    },

    key(e) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (this.hist.length) { this.hi = this.hi < 0 ? this.hist.length - 1 : Math.max(0, this.hi - 1); this.input.value = this.hist[this.hi]; }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (this.hi >= 0) { this.hi++; if (this.hi >= this.hist.length) { this.hi = -1; this.input.value = ""; } else this.input.value = this.hist[this.hi]; }
      } else if (e.key === "Tab") {
        e.preventDefault();
        this.complete();
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault(); this.clear();
      } else if (e.key === "c" && e.ctrlKey && !getSelection().toString()) {
        this.print(`<span class="dim">${U.esc(this.input.value)}^C</span>`); this.input.value = "";
      }
    },

    complete() {
      const v = this.input.value, parts = v.split(/\s+/);
      let pool, word;
      if (parts.length <= 1) { pool = Object.keys(this.cmds); word = parts[0] || ""; }
      else if (["open", "close", "man"].includes(parts[0])) { pool = parts[0] === "man" ? Object.keys(this.cmds) : Object.keys(this.apps); word = parts[parts.length - 1]; }
      else return;
      const hits = pool.filter((c) => c.startsWith(word)).sort();
      if (hits.length === 1) { parts[parts.length - 1] = hits[0]; this.input.value = parts.join(" ") + " "; }
      else if (hits.length > 1) this.print(hits.map((h) => `<span class="acc">${h}</span>`).join("  "));
    },

    /* ---------- output primitives ---------- */
    print(html, cls = "") {
      const d = document.createElement("div");
      d.className = "ln " + cls;
      d.innerHTML = html;
      this.out.appendChild(d);
      this.scroll();
      return d;
    },
    text(t, cls = "") { return this.print(U.esc(t), cls); },
    pre(t, cls = "") { return this.print(`<pre>${U.esc(t)}</pre>`, cls); },
    ok(t) { return this.print(`<span class="tag ok">[ OK ]</span> ${t}`); },
    warn(t) { return this.print(`<span class="tag warn">[WARN]</span> ${t}`); },
    err(t) { return this.print(`<span class="tag err">[FAIL]</span> ${t}`); },
    info(t) { return this.print(`<span class="tag info">[INFO]</span> ${t}`); },
    async typed(t, cls = "") { const d = this.print("", cls); await FX.type(d, t, 8); this.scroll(); return d; },
    scroll() { this.out.scrollTop = this.out.scrollHeight; },
    clear() { this.out.innerHTML = ""; },

    /** Animated task line: [ PROCESSING ] label → [ OK ] / [FAIL] */
    async task(label, promise) {
      const fr = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
      const d = this.print(`<span class="tag proc">[ <b>⠋</b> ]</span> ${U.esc(label)} <span class="dim">PROCESSING</span>`);
      let i = 0;
      const t = setInterval(() => { const b = d.querySelector("b"); if (b) b.textContent = fr[++i % fr.length]; }, 80);
      try {
        const r = await promise;
        d.innerHTML = `<span class="tag ok">[ OK ]</span> ${U.esc(label)}`;
        return r;
      } catch (e) {
        d.innerHTML = `<span class="tag err">[FAIL]</span> ${U.esc(label)} <span class="dim">— ${U.esc(e.message || e)}</span>`;
        if (e && typeof e === "object") e.reported = true;
        throw e;
      } finally { clearInterval(t); }
    },

    /** Monospace table from rows of strings (first row = header). */
    table(rows, opts = {}) {
      const vlen = (x) => String(x ?? "").replace(/<[^>]+>/g, "").replace(/&(#\d+|[a-z]+);/g, "x").length;
      const w = rows[0].map((_, c) => Math.max(...rows.map((r) => (opts.html ? vlen(r[c]) : String(r[c] ?? "").length))));
      const line = (r) => r.map((cell, c) => {
        const raw = String(cell ?? ""), vis = opts.html ? vlen(raw) : raw.length;
        const html = opts.html ? raw : U.esc(raw);
        return html + " ".repeat(Math.max(0, w[c] - vis));
      }).join("  ");
      return this.print(`<pre class="tbl">${rows.map((r, i) => (i === 0 && !opts.noHead ? `<span class="th">${line(r)}</span>` : line(r))).join("\n")}</pre>`);
    },

    parse(line) {
      const out = [];
      line.replace(/"([^"]*)"|'([^']*)'|(\S+)/g, (_, a, b, c) => out.push(a ?? b ?? c));
      return out;
    },

    async exec(line, { echo = true } = {}) {
      line = (line || "").trim();
      if (echo) this.print(`<span class="echo">${this.form.querySelector(".prompt").innerHTML}</span> ${U.esc(line)}`);
      if (!line) return;
      if (this.hist[this.hist.length - 1] !== line) { this.hist.push(line); this.hist = this.hist.slice(-80); localStorage.setItem(HKEY, JSON.stringify(this.hist)); }
      this.hi = -1;
      for (const part of line.split(/\s*;\s*/).filter(Boolean)) {
        const [raw, ...args] = this.parse(part);
        const name = raw.toLowerCase();
        const cmd = this.cmds[name] || this.cmds[this.aliases[name]];
        this.count++;
        Log.push("cmd", part);
        if (!cmd) {
          const near = Object.keys(this.cmds).filter((c) => c[0] === name[0]).slice(0, 4);
          this.err(`command not found: <b>${U.esc(name)}</b>${near.length ? ` <span class="dim">— did you mean ${near.map((n) => `<a href="#" data-run="${n}">${n}</a>`).join(", ")}?</span>` : ""} · type <a href="#" data-run="help">help</a>`);
          continue;
        }
        this.busy = true; this.busyEl.hidden = false;
        try { await cmd.run(args, this); }
        catch (e) { if (!e.reported) this.err(U.esc(e.message || String(e))); }
        finally { this.busy = false; this.busyEl.hidden = true; this.scroll(); }
      }
    },
  };

  window.Shell = Shell;

  /* ======================= built-in commands ======================= */
  const R = (n, d) => Shell.reg(n, d);

  R("help", {
    usage: "help [command]", desc: "List commands or show usage", alias: ["?", "man"],
    run(args, sh) {
      if (args[0]) {
        const c = sh.cmds[args[0]] || sh.cmds[sh.aliases[args[0]]];
        if (!c) return sh.err("no manual entry for " + U.esc(args[0]));
        sh.print(`<span class="acc">${c.name}</span> — ${U.esc(c.desc)}`);
        sh.print(`<span class="dim">usage:</span> ${U.esc(c.usage)}${c.alias ? ` <span class="dim">· alias: ${c.alias.join(", ")}</span>` : ""}`);
        return;
      }
      const groups = {};
      Object.values(sh.cmds).forEach((c) => (groups[c.group] = groups[c.group] || []).push(c));
      const order = ["APPS", "TOKEN", "MEDICAL", "SYSTEM", "FX"];
      Object.keys(groups).sort((a, b) => order.indexOf(a) - order.indexOf(b)).forEach((g) => {
        sh.print(`<span class="hdr">── ${g} ${"─".repeat(Math.max(2, 40 - g.length))}</span>`);
        sh.table(groups[g].map((c) => [`<a href="#" class="cmd" data-run="${c.name}">${U.esc(c.usage)}</a>`, `<span class="dim">${U.esc(c.desc)}</span>`]), { html: true, noHead: true });
      });
      sh.print(`<span class="dim">TAB autocomplete · ↑↓ history · Ctrl+L clear · chain with ";" · click any command</span>`);
    },
  });

  R("clear", { usage: "clear", desc: "Clear terminal", alias: ["cls"], run: (a, sh) => sh.clear() });
  R("echo", { usage: "echo <text>", desc: "Print text", run: (a, sh) => sh.text(a.join(" ")) });
  R("date", { usage: "date", desc: "System date / time (local + UTC)", run: (a, sh) => { const d = new Date(); sh.text(d.toString()); sh.text("UTC " + d.toISOString()); } });
  R("whoami", {
    usage: "whoami", desc: "Current operator session",
    run(a, sh) {
      sh.print(`<span class="acc">${U.esc(sh.user())}</span> <span class="dim">clearance:</span> LEVEL-3 · <span class="dim">session:</span> ${U.uptime(performance.now())} · <span class="dim">commands:</span> ${sh.count}`);
    },
  });
  R("login", {
    usage: "login <callsign>", desc: "Change operator callsign", alias: ["su"],
    run(a, sh) {
      const n = (a[0] || "").replace(/[^\w.-]/g, "").slice(0, 16);
      if (!n) return sh.err("usage: login &lt;callsign&gt;");
      localStorage.setItem(UKEY, n);
      sh.setPrompt();
      document.querySelectorAll("[data-operator]").forEach((e) => (e.textContent = n));
      sh.ok(`operator set → <span class="acc">${U.esc(n)}</span>`);
    },
  });
  R("history", {
    usage: "history [clear]", desc: "Command history",
    run(a, sh) {
      if (a[0] === "clear") { sh.hist = []; localStorage.removeItem(HKEY); return sh.ok("history cleared"); }
      sh.print(sh.hist.map((h, i) => `<span class="dim">${String(i + 1).padStart(3)}</span>  <a href="#" data-run="${U.esc(h)}">${U.esc(h)}</a>`).join("<br>") || "<span class='dim'>(empty)</span>");
    },
  });
  R("ls", {
    usage: "ls", desc: "List installed applications", alias: ["apps"],
    run(a, sh) {
      sh.table([["APP", "GROUP", "DESCRIPTION"], ...Object.entries(sh.apps).map(([k, v]) => [`<a href="#" data-run="${k}">${k}</a>`, v.group || "APPS", U.esc(v.desc)])], { html: true });
    },
  });
  R("open", {
    usage: "open <app>", desc: "Launch an application window",
    run(a, sh) {
      const app = sh.apps[a[0]];
      if (!app) return sh.err(`unknown app: ${U.esc(a[0] || "")} · see <a href="#" data-run="ls">ls</a>`);
      return app.open(a.slice(1));
    },
  });
  R("close", {
    usage: "close <app|all>", desc: "Close a window", alias: ["kill"],
    run(a, sh) {
      if (a[0] === "all") { WM.closeAll(); return sh.ok("all windows terminated"); }
      WM.close(a[0]) ? sh.ok(`${U.esc(a[0])} terminated`) : sh.err(`no such window: ${U.esc(a[0] || "")}`);
    },
  });
  R("ps", {
    usage: "ps", desc: "List open windows", alias: ["windows"],
    run(a, sh) {
      sh.table([["#", "ID", "STATE", "TITLE"], ...[...WM.wins.values()].map((w) => [w.n, w.id, w.min ? "minimized" : w.max ? "maximized" : w.id === WM.active ? "focused" : "running", w.title])]);
    },
  });
  R("x", {
    usage: "x", desc: `Open ${CFG.social.xHandle} on X`, alias: ["twitter"],
    run(a, sh) { window.open(CFG.social.x, "_blank", "noopener"); sh.ok(`uplink → <a href="${CFG.social.x}" target="_blank" rel="noopener">${U.esc(CFG.social.xHandle)}</a>`); },
  });
  R("reboot", {
    usage: "reboot", desc: "Restart MEDCORE OS (replays boot)",
    run() { sessionStorage.removeItem("medcore.booted"); location.href = location.pathname; },
  });
  R("matrix", {
    group: "FX", usage: "matrix [on|off|burst]", desc: "Matrix data-rain",
    run(a, sh) {
      if (a[0] === "burst") { FX.Matrix.on || FX.Matrix.start(); FX.Matrix.burst(2500); return sh.ok("data burst"); }
      const v = FX.Matrix.toggle(a[0] ? a[0] === "on" : undefined);
      sh.ok("matrix " + (v ? "online" : "offline"));
    },
  });
  R("fx", {
    group: "FX", usage: "fx <crt|flicker|glitch> [on|off]", desc: "Toggle display effects",
    run(a, sh) {
      const [k, v] = a;
      if (k === "glitch") { FX.glitch(document.body, 700); return sh.ok("glitch pulse"); }
      if (k === "crt" || k === "flicker") {
        const on = v ? v === "on" : !document.body.classList.contains(k);
        FX[k](on);
        localStorage.setItem("medcore.fx." + k, on ? "1" : "0");
        return sh.ok(`${k} ${on ? "on" : "off"}`);
      }
      sh.err("usage: fx &lt;crt|flicker|glitch&gt; [on|off]");
    },
  });
})();
