/* MEDCORE OS — visual effects: matrix rain, CRT, glitch, typing, decode */
(function () {
  const CFG = window.MEDIX_CONFIG;
  const GLYPHS = "01ABCDEFアイウエオカキクケコサシスセソ+✚♥∆µΩ≈∑#%<>/".split("");

  const Matrix = {
    cv: null, ctx: null, cols: [], on: false, raf: 0, last: 0, intensity: 1,
    init() {
      this.cv = document.getElementById("matrix");
      this.ctx = this.cv.getContext("2d");
      this.resize();
      addEventListener("resize", () => this.resize());
      document.addEventListener("visibilitychange", () => (document.hidden ? this.stop(true) : this.on && this.start()));
      if (CFG.fx.matrix && !U.reduced()) this.start();
    },
    resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      this.cv.width = innerWidth * dpr; this.cv.height = innerHeight * dpr;
      this.cv.style.width = innerWidth + "px"; this.cv.style.height = innerHeight + "px";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.fs = U.mobile() ? 12 : 14;
      const n = Math.ceil(innerWidth / this.fs);
      this.cols = Array.from({ length: n }, (_, i) => this.cols[i] ?? Math.random() * -60);
    },
    start() {
      this.on = true; this.cv.classList.add("on");
      cancelAnimationFrame(this.raf);
      const tick = (t) => {
        this.raf = requestAnimationFrame(tick);
        if (t - this.last < 55) return; // ~18fps, controlled data stream
        this.last = t;
        this.draw();
      };
      this.raf = requestAnimationFrame(tick);
    },
    stop(keepFlag) { cancelAnimationFrame(this.raf); if (!keepFlag) { this.on = false; this.cv.classList.remove("on"); } },
    toggle(v) { (v ?? !this.on) ? this.start() : this.stop(); return this.on; },
    burst(ms = 1600) { this.intensity = 4; setTimeout(() => (this.intensity = 1), ms); },
    draw() {
      const { ctx, fs } = this, w = innerWidth, h = innerHeight;
      const c = getComputedStyle(document.documentElement).getPropertyValue("--acc").trim() || "#00FFC6";
      ctx.fillStyle = "rgba(0,0,0,0.09)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = fs + "px 'JetBrains Mono', monospace";
      for (let i = 0; i < this.cols.length; i++) {
        if (this.intensity === 1 && Math.random() < 0.45) continue; // sparse unless bursting
        const y = this.cols[i] * fs;
        const ch = GLYPHS[(Math.random() * GLYPHS.length) | 0];
        ctx.fillStyle = Math.random() > 0.96 ? "#e9fff9" : c;
        ctx.fillText(ch, i * fs, y);
        if (y > h && Math.random() > 0.975) this.cols[i] = 0;
        this.cols[i] += 1;
      }
    },
  };

  const FX = {
    Matrix,
    crt(v) { document.body.classList.toggle("crt", v); return v; },
    flicker(v) { document.body.classList.toggle("flicker", v); return v; },
    glitch(el, ms = 600) {
      if (!CFG.fx.glitch || U.reduced()) return;
      (el || document.body).classList.add("glitching");
      setTimeout(() => (el || document.body).classList.remove("glitching"), ms);
    },
    /** Typing effect into a text node / element. */
    async type(el, text, speed = 12) {
      if (U.reduced() || speed <= 0) { el.textContent += text; return; }
      for (let i = 0; i < text.length; i += 2) {
        el.textContent += text.slice(i, i + 2);
        await U.sleep(speed);
      }
    },
    /** Decode/scramble reveal. */
    async decode(el, text, steps = 14) {
      const pool = "#%&@$*+=<>/\\[]{}01";
      if (U.reduced()) { el.textContent = text; return; }
      for (let s = 0; s <= steps; s++) {
        const k = Math.floor((s / steps) * text.length);
        el.textContent = text.slice(0, k) + [...text.slice(k)].map((c) => (c === " " ? " " : pool[(Math.random() * pool.length) | 0])).join("");
        await U.sleep(28);
      }
      el.textContent = text;
    },
  };

  window.FX = FX;
})();
