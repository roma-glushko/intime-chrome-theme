/*
 * Canvas layer for the new-tab page: the ring whose hand ticks once a second, and the "grains of
 * time" that peel off the digits and fall (or, on your birthday, rise back up into the clock).
 */
(function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const MAX_GRAINS = 700;
  const MAX_PIXELS = 8e6; // cap the backing store so 4K screens don't pay for a full-res glow layer
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);

  // A dark scene adds light (`lighter`): glows brighten the night. A pale sky can't be brightened, so the light
  // scene paints the same shapes as translucent deep-green ink with ordinary blending instead.
  const PALETTES = {
    dark: {
      rgb: '57,255,148',
      blend: 'lighter',
      sprite: ['rgba(235,255,244,1)', 'rgba(130,255,185,0.9)', 'rgba(57,255,148,0.28)', 'rgba(57,255,148,0)'],
      streak: 'rgb(120,255,178)',
      grain: 1,
      circle: 0.14,
      beam: 0.26,
      ticks: { major: 0.32, minor: 0.18, trail: 0.6 },
      arcs: [0.16, 0.12],
      head: 0.9,
    },
    light: {
      rgb: '0,150,88',
      blend: 'source-over',
      sprite: ['rgba(0,70,42,1)', 'rgba(0,150,88,0.85)', 'rgba(0,185,105,0.3)', 'rgba(0,185,105,0)'],
      streak: 'rgb(0,150,88)',
      grain: 0.85,
      circle: 0.2,
      beam: 0.2,
      ticks: { major: 0.42, minor: 0.24, trail: 0.55 },
      arcs: [0.24, 0.18],
      head: 0.95,
    },
  };

  /** A soft round dot: bright core, fading halo. `stops` are the colours at 0, 16%, 45% and 100% of the radius. */
  function makeSprite(stops) {
    const size = 64;
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = size;
    const g = sprite.getContext('2d');
    const halo = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    [0, 0.16, 0.45, 1].forEach((at, i) => halo.addColorStop(at, stops[i]));
    g.fillStyle = halo;
    g.fillRect(0, 0, size, size);
    return sprite;
  }

  class FX {
    /** `ringCanvas` sits behind the skyline, `grainCanvas` in front of it, so the HUD ring is occluded by buildings. */
    constructor(ringCanvas, grainCanvas, { calm = false } = {}) {
      this.ringCanvas = ringCanvas;
      this.ringCtx = ringCanvas.getContext('2d');
      this.canvas = grainCanvas;
      this.ctx = grainCanvas.getContext('2d');
      this.calm = calm; // reduced motion: no grains, and the ring hand doesn't ease
      this.rising = false; // birthday: grains flow up into the clock instead of falling out of it
      this.grains = [];
      this.carry = 0;
      this.box = { x: 0, y: 0, w: 0, h: 0 }; // the row of digits, in CSS px
      this.setScheme('dark');
      this.resize();
    }

    /** 'dark' or 'light': switches colours and blending for everything drawn from now on. */
    setScheme(name) {
      this.palette = PALETTES[name] || PALETTES.dark;
      this.sprite = makeSprite(this.palette.sprite);
    }

    resize() {
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / (this.w * this.h)));
      for (const canvas of [this.ringCanvas, this.canvas]) {
        canvas.width = Math.round(this.w * this.scale);
        canvas.height = Math.round(this.h * this.scale);
      }
      this.u = this.h / 900; // sizes and speeds are authored for a 900px tall window
    }

    /** Shed `count` grains from random `points` ({x, y} in CSS px), each starting up to `delay` seconds from now. */
    shed(points, count, delay = 0.4) {
      if (this.calm || !points.length) return;
      for (let i = 0; i < count && this.grains.length < MAX_GRAINS; i++) {
        const p = points[(Math.random() * points.length) | 0];
        this.grains.push(this.grain(p.x, p.y, Math.random() * delay));
      }
    }

    grain(x, y, delay) {
      const { u } = this;
      const dir = this.rising ? -1 : 1;
      return {
        x,
        y,
        delay,
        vx: (Math.random() - 0.5) * 36 * u,
        vy: dir * (6 + Math.random() * 26) * u,
        g: dir * (140 + Math.random() * 90) * u * (this.rising ? 0.45 : 1),
        life: 1.3 + Math.random() * 1.9,
        age: 0,
        size: (1.1 + Math.random() * 2.2) * u,
        sway: 1.5 + Math.random() * 2.5,
        phase: Math.random() * TAU,
        glow: 0.7 + Math.random() * 0.3,
      };
    }

    /** A thin continuous drizzle off the baseline of the digits, so time is always slipping. */
    trickle(dt) {
      this.carry += dt * 16;
      while (this.carry >= 1) {
        this.carry -= 1;
        if (this.grains.length >= MAX_GRAINS) return;
        const { box, u } = this;
        const x = box.x + Math.random() * box.w;
        if (this.rising) {
          const g = this.grain(x, box.y + box.h + (40 + Math.random() * 260) * u, 0);
          g.vy = -(40 + Math.random() * 60) * u;
          this.grains.push(g);
        } else {
          this.grains.push(this.grain(x, box.y + box.h, 0));
        }
      }
    }

    step(dt) {
      const { ctx, grains, u, palette } = this;
      ctx.globalCompositeOperation = palette.blend;
      ctx.lineCap = 'round';
      let alive = 0;
      for (let i = 0; i < grains.length; i++) {
        const p = grains[i];
        if (p.delay > 0) {
          p.delay -= dt;
          grains[alive++] = p;
          continue;
        }
        p.age += dt;
        if (p.age >= p.life) continue;
        p.vy += p.g * dt;
        p.vx += Math.sin(p.age * p.sway + p.phase) * 22 * u * dt;
        p.vx *= 1 - 0.7 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        grains[alive++] = p;

        const k = p.age / p.life;
        const alpha = (k < 0.1 ? k / 0.1 : Math.pow(1 - (k - 0.1) / 0.9, 1.5)) * p.glow * palette.grain;
        const s = p.size * 5;
        ctx.globalAlpha = alpha;
        ctx.drawImage(this.sprite, p.x - s / 2, p.y - s / 2, s, s);
        if (Math.abs(p.vy) > 60 * u) {
          ctx.globalAlpha = alpha * 0.4;
          ctx.strokeStyle = palette.streak;
          ctx.lineWidth = Math.max(1, p.size * 0.55);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
          ctx.stroke();
        }
      }
      grains.length = alive;
    }

    /** 60 ticks around the clock, a hand that steps once a second and drags a fading beam behind it. */
    ring(nowMs) {
      const { ringCtx: ctx, box, u, palette: pal } = this;
      const rgb = pal.rgb;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const R = Math.min(this.h * 0.52, this.w * 0.4);

      const sec = (nowMs / 1000) % 60;
      const whole = Math.floor(sec);
      const lead = this.calm ? 1 : easeOut(Math.min(1, (sec - whole) / 0.22));
      const hand = ((whole - 1 + lead) / 60) * TAU - Math.PI / 2; // settles on tick `whole` just after the second starts

      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';

      ctx.strokeStyle = `rgba(${rgb},${pal.circle})`;
      ctx.lineWidth = u;
      for (const r of [R + 14 * u, R - 36 * u]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
      }

      if (ctx.createConicGradient) {
        const span = 1.25;
        const beam = ctx.createConicGradient(hand - span, cx, cy);
        beam.addColorStop(0, `rgba(${rgb},0)`);
        beam.addColorStop(span / TAU, `rgba(${rgb},${pal.beam})`);
        beam.addColorStop(span / TAU + 0.001, `rgba(${rgb},0)`);
        beam.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = beam;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, TAU);
        ctx.arc(cx, cy, R - 72 * u, 0, TAU, true);
        ctx.fill('evenodd');
      }

      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * TAU - Math.PI / 2;
        const behind = (((hand - a) % TAU) + TAU) % TAU; // how far the hand has travelled past this tick
        const trail = behind < 1.6 ? Math.exp(-behind * 2.6) : 0;
        const major = i % 5 === 0;
        const len = (major ? 20 : 9) * u;
        // Ticks that would land inside the row of digits are nearly hidden, or they read as stray dashes in the glyphs.
        const mx = cx + Math.cos(a) * (R - len / 2);
        const my = cy + Math.sin(a) * (R - len / 2);
        const behindDigits = mx > box.x - 16 * u && mx < box.x + box.w + 16 * u && my > box.y - 12 * u && my < box.y + box.h + 12 * u;
        const alpha = ((major ? pal.ticks.major : pal.ticks.minor) + trail * pal.ticks.trail) * (behindDigits ? 0.12 : 1);
        ctx.strokeStyle = `rgba(${rgb},${alpha})`;
        ctx.lineWidth = (major ? 2 : 1.2) * u;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (R - len), cy + Math.sin(a) * (R - len));
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
      }

      const t = this.calm ? 0 : nowMs / 1000;
      ctx.lineWidth = 2 * u;
      [[R + 44 * u, 0.04, 0.9, pal.arcs[0]], [R - 66 * u, -0.07, 0.6, pal.arcs[1]]].forEach(([r, speed, len, alpha]) => {
        const a0 = t * speed * TAU;
        ctx.strokeStyle = `rgba(${rgb},${alpha})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, a0, a0 + len);
        ctx.stroke();
      });

      const glow = 54 * u;
      ctx.globalCompositeOperation = pal.blend;
      ctx.globalAlpha = pal.head;
      ctx.drawImage(this.sprite, cx + Math.cos(hand) * R - glow / 2, cy + Math.sin(hand) * R - glow / 2, glow, glow);
      ctx.globalAlpha = 1;
    }

    frame(nowMs, dt) {
      const { ctx, ringCtx, scale } = this;
      ringCtx.setTransform(scale, 0, 0, scale, 0, 0);
      ringCtx.clearRect(0, 0, this.w, this.h);
      this.ring(nowMs);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, this.w, this.h);
      if (!this.calm) {
        this.trickle(dt);
        this.step(dt);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  root.InTimeFX = { FX };
})(window);
