/* MEDCORE OS — window manager: layered, draggable, resizable, min / max / close, tmux-style task bar */
(function () {
  const WM = {
    wins: new Map(),
    z: 10,
    seq: 0,
    desk: null,
    bar: null,

    init() {
      this.desk = document.getElementById("desktop");
      this.bar = document.getElementById("tasks");
      addEventListener("resize", () => this.wins.forEach((w) => this.clamp(w)));
    },

    /**
     * open(id, { title, w, h, x, y, render(body, win), onClose, icon })
     * Re-opening an existing id focuses / restores it and calls win.onReopen(args).
     */
    open(id, o = {}) {
      if (this.wins.has(id)) {
        const w = this.wins.get(id);
        this.restore(id);
        w.onReopen && w.onReopen(o.args);
        return w;
      }
      const n = ++this.seq;
      const el = U.h(`
        <section class="win opening" data-id="${id}" role="dialog" aria-label="${U.esc(o.title)}">
          <header class="win-bar">
            <span class="win-idx">[${n}]</span>
            <span class="win-title">${U.esc(o.title)}</span>
            <span class="win-pid">pid ${1000 + Math.floor(Math.random() * 8999)}</span>
            <span class="win-ctrl">
              <button class="wb-min" title="Minimize" aria-label="Minimize">_</button>
              <button class="wb-max" title="Maximize" aria-label="Maximize">□</button>
              <button class="wb-close" title="Close" aria-label="Close">×</button>
            </span>
          </header>
          <div class="win-body"></div>
          <i class="win-rs" aria-hidden="true"></i>
        </section>`);
      const dw = this.desk.clientWidth, dh = this.desk.clientHeight;
      const w = Math.min(o.w || 640, dw - 16), h = Math.min(o.h || 440, dh - 16);
      const off = (this.wins.size % 6) * 26;
      Object.assign(el.style, {
        width: w + "px", height: h + "px",
        left: (o.x ?? Math.max(8, (dw - w) / 2 + off - 60)) + "px",
        top: (o.y ?? Math.max(8, (dh - h) / 2 + off - 40)) + "px",
      });
      const win = { id, n, el, title: o.title, body: el.querySelector(".win-body"), onClose: o.onClose, onReopen: null, min: false, max: false };
      this.wins.set(id, win);
      this.desk.appendChild(el);
      this.bind(win);
      this.focus(id);
      this.renderBar();
      Log.push("sys", `spawn ${id} (window ${n})`);
      setTimeout(() => el.classList.remove("opening"), 380);
      if (o.render) o.render(win.body, win);
      return win;
    },

    bind(win) {
      const { el } = win;
      el.addEventListener("pointerdown", () => this.focus(win.id));
      el.querySelector(".wb-close").onclick = (e) => { e.stopPropagation(); this.close(win.id); };
      el.querySelector(".wb-min").onclick = (e) => { e.stopPropagation(); this.minimize(win.id); };
      el.querySelector(".wb-max").onclick = (e) => { e.stopPropagation(); this.toggleMax(win.id); };
      const bar = el.querySelector(".win-bar");
      bar.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) this.toggleMax(win.id); });

      // drag
      bar.addEventListener("pointerdown", (e) => {
        if (e.target.closest("button") || win.max || U.mobile()) return;
        const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
        bar.setPointerCapture(e.pointerId);
        el.classList.add("dragging");
        const mv = (ev) => {
          el.style.left = ox + ev.clientX - sx + "px";
          el.style.top = Math.max(0, oy + ev.clientY - sy) + "px";
        };
        const up = () => { bar.removeEventListener("pointermove", mv); el.classList.remove("dragging"); this.clamp(win); };
        bar.addEventListener("pointermove", mv);
        bar.addEventListener("pointerup", up, { once: true });
      });

      // resize
      const rs = el.querySelector(".win-rs");
      rs.addEventListener("pointerdown", (e) => {
        if (win.max || U.mobile()) return;
        e.stopPropagation();
        const sx = e.clientX, sy = e.clientY, ow = el.offsetWidth, oh = el.offsetHeight;
        rs.setPointerCapture(e.pointerId);
        const mv = (ev) => {
          el.style.width = Math.max(300, ow + ev.clientX - sx) + "px";
          el.style.height = Math.max(180, oh + ev.clientY - sy) + "px";
        };
        rs.addEventListener("pointermove", mv);
        rs.addEventListener("pointerup", () => rs.removeEventListener("pointermove", mv), { once: true });
      });
    },

    clamp(win) {
      if (U.mobile() || win.max) return;
      const el = win.el, dw = this.desk.clientWidth, dh = this.desk.clientHeight;
      el.style.left = Math.min(Math.max(-el.offsetWidth + 120, el.offsetLeft), dw - 120) + "px";
      el.style.top = Math.min(Math.max(0, el.offsetTop), dh - 40) + "px";
    },

    focus(id) {
      const w = this.wins.get(id);
      if (!w) return;
      this.wins.forEach((x) => x.el.classList.toggle("active", x === w));
      w.el.style.zIndex = ++this.z;
      this.active = id;
      this.renderBar();
      if (id === "term") setTimeout(() => window.Shell && Shell.focusInput(), 0);
    },

    minimize(id) {
      const w = this.wins.get(id);
      if (!w) return;
      w.min = true;
      w.el.classList.add("minimized");
      const next = [...this.wins.values()].filter((x) => !x.min).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
      next ? this.focus(next.id) : this.renderBar();
    },

    restore(id) {
      const w = this.wins.get(id);
      if (!w) return;
      w.min = false;
      w.el.classList.remove("minimized");
      this.focus(id);
    },

    toggleMax(id) {
      const w = this.wins.get(id);
      if (!w) return;
      w.max = !w.max;
      w.el.classList.toggle("maximized", w.max);
      this.focus(id);
    },

    close(id) {
      const w = this.wins.get(id);
      if (!w) return false;
      w.onClose && w.onClose();
      w.el.classList.add("closing");
      this.wins.delete(id);
      setTimeout(() => w.el.remove(), 200);
      Log.push("sys", `kill ${id}`);
      const next = [...this.wins.values()].filter((x) => !x.min).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
      next ? this.focus(next.id) : this.renderBar();
      return true;
    },

    closeAll(except = "term") { [...this.wins.keys()].filter((k) => k !== except).forEach((k) => this.close(k)); },

    renderBar() {
      if (!this.bar) return;
      this.bar.innerHTML = "";
      [...this.wins.values()].sort((a, b) => a.n - b.n).forEach((w) => {
        const b = document.createElement("button");
        b.className = "task" + (w.id === this.active && !w.min ? " on" : "") + (w.min ? " min" : "");
        b.textContent = `${w.n}:${w.id}${w.id === this.active && !w.min ? "*" : w.min ? "-" : ""}`;
        b.title = w.title;
        b.onclick = () => (w.id === this.active && !w.min ? this.minimize(w.id) : this.restore(w.id));
        this.bar.appendChild(b);
      });
    },
  };

  window.WM = WM;
})();
