/* MEDCORE OS — shared helpers + system event log */
(function () {
  const CFG = window.MEDIX_CONFIG;

  /** Kernel log: every real event (network calls, commands, windows) is pushed here. */
  const Log = {
    items: [],
    subs: new Set(),
    push(level, msg) {
      const e = { t: new Date(), level, msg };
      this.items.push(e);
      if (this.items.length > 400) this.items.shift();
      this.subs.forEach((f) => f(e));
    },
    on(f) { this.subs.add(f); return () => this.subs.delete(f); },
  };

  const U = {
    esc(s) {
      return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    reduced: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    mobile: () => window.matchMedia("(max-width: 760px)").matches,

    /** fetch JSON with timeout; logs host, status and latency to the kernel log. */
    async json(url, opt = {}) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), opt.timeout || CFG.data.timeoutMs);
      const host = (() => { try { return new URL(url).host; } catch { return url; } })();
      const t0 = performance.now();
      try {
        const r = await fetch(url, { ...opt, signal: ctl.signal });
        const ms = Math.round(performance.now() - t0);
        Log.push(r.ok ? "net" : "err", `${opt.method || "GET"} ${host} → ${r.status} (${ms}ms)`);
        if (!r.ok) {
          const err = new Error("HTTP " + r.status);
          err.status = r.status;
          throw err;
        }
        return await r.json();
      } catch (e) {
        if (e.name === "AbortError") { Log.push("err", `${host} timeout`); throw new Error("timeout"); }
        if (!e.status) Log.push("err", `${host} ${e.message}`);
        throw e;
      } finally { clearTimeout(timer); }
    },

    num(n, d = 2) {
      if (n == null || isNaN(n)) return "—";
      return Number(n).toLocaleString("en-US", { maximumFractionDigits: d });
    },
    compact(n) {
      if (n == null || isNaN(n)) return "—";
      const a = Math.abs(n);
      if (a >= 1e12) return (n / 1e12).toFixed(2) + "T";
      if (a >= 1e9) return (n / 1e9).toFixed(2) + "B";
      if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
      if (a >= 1e3) return (n / 1e3).toFixed(2) + "K";
      return Number(n).toFixed(a < 1 ? 4 : 2);
    },
    usd(n) { return n == null || isNaN(n) ? "—" : "$" + U.compact(n); },
    price(n) {
      if (n == null || isNaN(n)) return "—";
      n = Number(n);
      if (n === 0) return "$0";
      if (n >= 1) return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 4 });
      // 0.0000123 → $0.0₄123 style subscript for tiny prices
      const s = n.toFixed(20).split(".")[1];
      const zeros = s.match(/^0*/)[0].length;
      if (zeros >= 4) return "$0.0" + String(zeros).split("").map((c) => "₀₁₂₃₄₅₆₇₈₉"[c]).join("") + s.slice(zeros, zeros + 4);
      return "$" + n.toPrecision(4);
    },
    pct(n) {
      if (n == null || isNaN(n)) return "—";
      return (n > 0 ? "+" : "") + Number(n).toFixed(2) + "%";
    },
    short(a, h = 6, t = 4) { return a && a.length > h + t + 3 ? a.slice(0, h) + "…" + a.slice(-t) : a || ""; },
    pad(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); },
    bar(v, max, w = 20) {
      const f = max > 0 ? Math.round(Math.min(1, Math.max(0, v / max)) * w) : 0;
      return "█".repeat(f) + "░".repeat(w - f);
    },
    time(d = new Date()) { return d.toTimeString().slice(0, 8); },
    uptime(ms) {
      const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return `${h}h ${String(m).padStart(2, "0")}m ${String(s % 60).padStart(2, "0")}s`;
    },

    async copy(text) {
      try { await navigator.clipboard.writeText(text); }
      catch {
        const t = document.createElement("textarea");
        t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
        document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
      }
      Log.push("sys", `clipboard ← ${U.short(text, 8, 6)}`);
      U.toast("COPIED TO CLIPBOARD");
    },

    toast(msg, kind = "ok") {
      const el = document.createElement("div");
      el.className = "toast " + kind;
      el.textContent = "» " + msg;
      document.body.appendChild(el);
      setTimeout(() => el.classList.add("out"), 1600);
      setTimeout(() => el.remove(), 2100);
    },

    /** Inline brand mark tinted with the active theme (--acc / --acc2). */
    logo(size = 20) {
      const id = "lg" + Math.random().toString(36).slice(2, 7);
      return `<svg class="logo" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--acc)"/><stop offset="1" style="stop-color:var(--acc2)"/></linearGradient></defs><path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" fill="#020b09" stroke="url(#${id})" stroke-width="3" stroke-linejoin="round"/><path d="M26 15h12v11h11v12H38v11H26V38H15V26h11Z" fill="none" stroke="url(#${id})" stroke-width="3" stroke-linejoin="round"/><path d="M10 32.5h12l3.5-7 5 15 4.5-11 2.5 3H54" fill="none" stroke="#E9FFFA" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    },

    h(html) {
      const t = document.createElement("template");
      t.innerHTML = html.trim();
      return t.content.firstElementChild;
    },
  };

  window.U = U;
  window.Log = Log;
})();
