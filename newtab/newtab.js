/*
 * In Time — new-tab page: a glowing countdown to your next birthday, drained one second at a time.
 *
 * Debug query params (handy for screenshots):
 *   ?dob=1990-10-21            use this birthday without saving it
 *   ?now=2026-10-07T15:30:00   pretend it is this local time (the clock keeps running from there)
 *   ?scheme=light|dark         force a colour scheme without saving it (default: the saved choice, else the system's)
 *   ?calm                      behave as if prefers-reduced-motion were on
 *   ?still=bg                  backdrop only, frozen: the dark theme's New Tab image and the store tiles come from this
 *   ?nograin                   with ?still=bg, leave out the film grain
 *   ?debug                     expose window.__intime for poking at the effects
 */
(() => {
  'use strict';

  const { InTimeCore: Core, InTimeGlyphs: Glyphs, InTimeFX: FXLib, InTimeScheme: Scheme } = window;

  const STORAGE_KEY = 'intime.birthday';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const UNITS = ['YRS', 'MTH', 'DAY', 'HRS', 'MIN', 'SEC'];
  // Grains a digit sheds when it changes: big units shed more, so a new minute or hour is felt.
  const SHED = [140, 140, 90, 90, 60, 60, 36, 36, 22, 22, 14, 9];
  const GAP = 14; // between the two digits of a pair
  const SEP = 36; // width of a ':' column
  const PAD = 30; // room around the glyphs for the glow
  const LABEL_ROOM = 44;

  const query = new URLSearchParams(location.search);
  const STILL = query.get('still') === 'bg';
  const CALM = STILL || query.has('calm') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const faked = Date.parse(query.get('now') || '');
  const skew = Number.isFinite(faked) ? faked - Date.now() : 0;
  const now = () => Date.now() + skew;

  const $ = (id) => document.getElementById(id);
  const ui = {
    stage: $('stage'), city: $('city'), ring: $('ring'), canvas: $('fx'), clockWrap: $('clock-wrap'), clock: $('clock'),
    kicker: $('kicker'), subject: $('subject'), srTime: $('sr-time'),
    bankLeft: $('bank-left'), bankRight: $('bank-right'), bankTrack: $('bank-track'),
    days: $('stat-days'), hours: $('stat-hours'), seconds: $('stat-seconds'),
    edit: $('edit'), setup: $('setup'), title: $('setup-title'), form: $('setup-form'), input: $('dob'), error: $('setup-error'),
    cancel: $('setup-cancel'), submit: $('setup-submit'), appearance: [...document.querySelectorAll('input[name="scheme"]')],
  };

  const store = {
    read() {
      try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
    },
    write(value) {
      try { localStorage.setItem(STORAGE_KEY, value); } catch { /* storage blocked: the date just won't persist */ }
    },
  };

  let fx = null;
  let birthday = null;
  let birthdayText = '';
  let preference = Scheme.readPreference(); // 'auto' | 'dark' | 'light'
  let metrics = { left: 0, top: 0, s: 1 };
  let lastSecond = NaN;
  let lastTarget = 0;
  let lastHourKey = '';
  let nextGlitch = 0;

  function svgEl(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    if (parent) parent.appendChild(node);
    return node;
  }

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  // ---- backdrop ---------------------------------------------------------------------------------

  // Small seeded PRNG so the skyline is identical every time (and in the theme's static image).
  function mulberry32(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildCity(root) {
    const W = 1920;
    const H = 420;
    const rand = mulberry32(2011);
    root.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // The far layer stays low, inside the horizon haze: taller than that and it reads as a pale ghost box against the dark sky.
    const layers = [
      { name: 'far', width: [34, 84], height: [0.12, 0.4], gap: 6, lit: 0.07, tower: 0.09, boost: 1.25 },
      { name: 'mid', width: [30, 96], height: [0.12, 0.5], gap: 10, lit: 0.12, tower: 0.07, boost: 1.6 },
      { name: 'near', width: [44, 130], height: [0.08, 0.36], gap: 14, lit: 0.16, tower: 0.05, boost: 1.6 },
    ];
    for (const layer of layers) {
      const group = svgEl('g', { class: `city-${layer.name}` }, root);
      // All lit windows of one kind share a single <path>, so a few thousand windows stay a handful of nodes.
      const windows = { steady: '', warm: '', slow: '', fast: '' };
      let x = -20;
      while (x < W + 20) {
        const w = layer.width[0] + rand() * (layer.width[1] - layer.width[0]);
        let h = H * (layer.height[0] + rand() * (layer.height[1] - layer.height[0]));
        if (rand() < layer.tower) h *= layer.boost;
        h = Math.min(h, H - 10);
        const top = H - h;
        svgEl('rect', { x: x.toFixed(1), y: top.toFixed(1), width: w.toFixed(1), height: (h + 2).toFixed(1) }, group);

        for (let wx = x + 5; wx < x + w - 6; wx += 8) {
          for (let wy = top + 9; wy < H - 6; wy += 11) {
            if (rand() >= layer.lit) continue;
            const r = rand();
            const kind = r < 0.7 ? 'steady' : r < 0.78 ? 'warm' : r < 0.92 ? 'slow' : 'fast';
            windows[kind] += `M${wx.toFixed(1)} ${wy.toFixed(1)}h3v5h-3z`;
          }
        }
        if (h > H * 0.5 && layer.name !== 'near') {
          const sx = (x + w / 2).toFixed(1);
          svgEl('line', { class: 'spire', x1: sx, y1: top.toFixed(1), x2: sx, y2: (top - 26).toFixed(1) }, group);
          svgEl('circle', { class: 'beacon', cx: sx, cy: (top - 27).toFixed(1), r: 2.2 }, group);
        }
        x += w + rand() * layer.gap;
      }
      for (const [kind, d] of Object.entries(windows)) if (d) svgEl('path', { d, class: `win win-${kind}` }, group);
    }
  }

  /** A tile of sparse speckle (pale on the dark scene, deep green on the light one), jittered with steps() for a film-grain shimmer. */
  function makeGrain(scheme) {
    const [red, green, blue, peak] = scheme === 'light' ? [10, 70, 45, 60] : [200, 255, 225, 70];
    const size = 160;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d');
    const image = g.createImageData(size, size);
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = red;
      image.data[i + 1] = green;
      image.data[i + 2] = blue;
      image.data[i + 3] = Math.pow(Math.random(), 3) * peak;
    }
    g.putImageData(image, 0, 0);
    return canvas.toDataURL();
  }

  /** Applies a resolved scheme ('dark' | 'light') to the canvas palette and the grain; the CSS follows <html data-scheme>. */
  function setScheme(next) {
    fx.setScheme(next);
    document.documentElement.style.setProperty('--grain', `url(${makeGrain(next)})`);
  }

  // ---- clock ------------------------------------------------------------------------------------

  const pairW = Glyphs.W * 2 + GAP;
  const vb = { w: PAD * 2 + pairW * 6 + SEP * 5, h: PAD + Glyphs.H + LABEL_ROOM };
  const slots = [];
  const SAMPLES = Object.fromEntries(
    Object.entries(Glyphs.paths).map(([ch, strokes]) => [ch, strokes.flatMap((d) => Glyphs.sample(d, 5))]),
  );

  function buildClock() {
    ui.clock.setAttribute('viewBox', `0 0 ${vb.w} ${vb.h}`);
    ui.clock.style.setProperty('--phase', `${-(now() % 1000)}ms`); // colons pulse on the second
    for (let group = 0; group < 6; group++) {
      const x0 = PAD + group * (pairW + SEP);
      for (let i = 0; i < 2; i++) {
        const x = x0 + i * (Glyphs.W + GAP);
        const node = svgEl('g', { class: 'slot', transform: `translate(${x} ${PAD})` }, ui.clock);
        slots.push({ x, node, glyph: null, value: '' });
      }
      svgEl('text', { class: 'unit', x: x0 + pairW / 2, y: PAD + Glyphs.H + 28 }, ui.clock).textContent = UNITS[group];
      if (group < 5) {
        const cx = x0 + pairW + SEP / 2;
        const sep = svgEl('g', { class: 'sep' }, ui.clock);
        for (const cy of [PAD + Glyphs.H * 0.32, PAD + Glyphs.H * 0.68]) {
          svgEl('rect', { x: cx - 2.6, y: cy - 2.6, width: 5.2, height: 5.2 }, sep);
        }
      }
    }
  }

  function makeGlyph(ch) {
    const glyph = svgEl('g', { class: 'glyph' });
    for (const d of Glyphs.paths[ch]) svgEl('path', { d, pathLength: 1 }, glyph);
    return glyph;
  }

  /** Where a digit's strokes are on screen, in CSS px: the places its grains will peel off from. */
  function pointsFor(i, ch) {
    const { left, top, s } = metrics;
    const slot = slots[i];
    return SAMPLES[ch].map((p) => ({ x: left + (slot.x + p.x) * s, y: top + (PAD + p.y) * s }));
  }

  function setDigit(i, ch, animate, delay = 0) {
    const slot = slots[i];
    if (slot.value === ch) return;
    const old = slot.glyph;
    const oldValue = slot.value;
    const glyph = makeGlyph(ch);
    if (animate) {
      glyph.classList.add('enter');
      if (delay) glyph.style.setProperty('--d', `${delay}ms`);
    }
    slot.node.appendChild(glyph);
    slot.glyph = glyph;
    slot.value = ch;
    if (!old) return;
    if (animate) {
      old.classList.remove('enter');
      old.classList.add('leave');
      setTimeout(() => old.remove(), 520);
      fx.shed(pointsFor(i, oldValue), SHED[i]);
    } else {
      old.remove();
    }
  }

  function measure() {
    const r = ui.clock.getBoundingClientRect();
    const s = r.width / vb.w;
    metrics = { left: r.left, top: r.top, s };
    fx.box = { x: r.left + PAD * s, y: r.top + PAD * s, w: (vb.w - PAD * 2) * s, h: Glyphs.H * s };
  }

  function rowPoints(n = 48) {
    const { x, y, w, h } = fx.box;
    return Array.from({ length: n }, (_, i) => ({ x: x + (w * i) / (n - 1), y: y + h * (0.15 + Math.random() * 0.85) }));
  }

  /** The clock "slips": a short signal tear with a puff of grains. */
  function glitch() {
    ui.clockWrap.classList.remove('glitch');
    void ui.clockWrap.offsetWidth; // restart the CSS animation
    ui.clockWrap.classList.add('glitch');
    fx.shed(rowPoints(), 70, 0.25);
    setTimeout(() => ui.clockWrap.classList.remove('glitch'), 380);
  }

  /** A fresh year lands on the clock: flash, and a downpour of grains. */
  function grant() {
    ui.stage.classList.remove('grant');
    void ui.stage.offsetWidth;
    ui.stage.classList.add('grant');
    fx.shed(rowPoints(64), 360, 0.9);
    setTimeout(() => ui.stage.classList.remove('grant'), 1800);
  }

  // ---- text -------------------------------------------------------------------------------------

  const number = new Intl.NumberFormat();
  const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  function renderText(snap) {
    setText(ui.kicker, snap.isBirthday ? 'Time granted' : 'Time remaining');
    setText(
      ui.subject,
      snap.isBirthday
        ? 'Happy birthday · a new year has been added to your clock'
        : `Until you turn ${snap.turning} · ${dateFormat.format(snap.next)}`,
    );
    setText(ui.days, number.format(snap.totalDays));
    setText(ui.hours, number.format(snap.totalHours));
    setText(ui.seconds, number.format(snap.totalSeconds));
    ui.bankTrack.style.setProperty('--p', snap.remaining.toFixed(5));
    setText(ui.bankLeft, `${(snap.remaining * 100).toFixed(1)}% of this year left`);
    setText(ui.bankRight, `Age ${snap.turning}`);
    setText(
      ui.srTime,
      `${snap.months} months, ${snap.days} days, ${snap.hours} hours and ${snap.minutes} minutes until your birthday`,
    );
  }

  // ---- loop -------------------------------------------------------------------------------------

  /** Redraw the readout for `nowMs`. `stagger` (ms) draws the digits on one after another, left to right. */
  function tick(nowMs, animate, stagger = 0) {
    const snap = Core.snapshot(birthday, nowMs);
    const text = Core.digits(snap);
    for (let i = 0; i < slots.length; i++) setDigit(i, text[i], animate, stagger ? 120 + i * stagger : 0);
    renderText(snap);

    fx.rising = snap.isBirthday;
    const target = +snap.next;
    if (lastTarget && target !== lastTarget && snap.isBirthday) grant(); // the clock was open at midnight
    lastTarget = target;

    const hourKey = text.slice(0, 8);
    const hourRolled = lastHourKey && hourKey !== lastHourKey;
    lastHourKey = hourKey;
    if (animate && !CALM && !stagger && (hourRolled || nowMs >= nextGlitch)) {
      glitch();
      nextGlitch = nowMs + 9000 + Math.random() * 15000;
    }
    return snap;
  }

  let lastFrame = performance.now();
  function loop(t) {
    const dt = Math.min(0.05, (t - lastFrame) / 1000);
    lastFrame = t;
    const nowMs = now();
    const sec = Math.floor(nowMs / 1000);
    if (sec !== lastSecond) {
      // Animate only a clean one-second step. After the tab was hidden (or on first paint) just snap to the truth.
      const animate = sec - lastSecond === 1 && !document.hidden;
      lastSecond = sec;
      if (birthday) tick(nowMs, animate);
      measure();
    }
    fx.frame(nowMs, dt);
    requestAnimationFrame(loop);
  }

  // ---- birthday setup ---------------------------------------------------------------------------

  const isoOf = (b) => `${b.year}-${Core.pad2(b.month + 1)}-${Core.pad2(b.day)}`;
  const isPast = (b) => !!b && b.year >= 1900 && new Date(b.year, b.month, b.day) <= new Date(now());

  function isoToday() {
    const d = new Date(now());
    return isoOf({ year: d.getFullYear(), month: d.getMonth(), day: d.getDate() });
  }

  function openSetup(first) {
    ui.stage.classList.add('setup-open');
    ui.setup.hidden = false;
    ui.cancel.hidden = first;
    ui.title.textContent = first ? 'Activate your clock' : 'Settings';
    ui.submit.textContent = first ? 'Start clock' : 'Save';
    ui.appearance.forEach((radio) => { radio.checked = radio.value === preference; });
    ui.input.max = isoToday();
    ui.input.value = birthdayText;
    ui.error.textContent = '';
    ui.input.focus();
  }

  function closeSetup() {
    ui.stage.classList.remove('setup-open');
    ui.setup.hidden = true;
  }

  /** Start (or restart) the clock for `parsed`. */
  function applyBirthday(parsed) {
    birthday = parsed;
    birthdayText = isoOf(parsed);
    ui.stage.classList.remove('dormant');
    ui.edit.hidden = false;
    for (const slot of slots) {
      slot.glyph?.remove();
      slot.glyph = null;
      slot.value = '';
    }
    lastTarget = 0;
    lastHourKey = '';
    const nowMs = now();
    lastSecond = Math.floor(nowMs / 1000);
    nextGlitch = nowMs + 7000;
    const snap = tick(nowMs, true, 34);
    if (snap.isBirthday) setTimeout(grant, 900);
  }

  ui.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const fail = (message) => { ui.error.textContent = message; };
    const parsed = Core.parseBirthday(ui.input.value);
    if (!parsed) return fail('Pick a real date.');
    if (parsed.year < 1900) return fail('That is a little too long ago.');
    if (!isPast(parsed)) return fail('That date is in the future.');
    store.write(isoOf(parsed));
    applyBirthday(parsed);
    closeSetup();
  });
  ui.cancel.addEventListener('click', closeSetup);
  ui.edit.addEventListener('click', () => openSetup(false));
  ui.appearance.forEach((radio) => radio.addEventListener('change', () => {
    if (!radio.checked) return;
    preference = radio.value;
    Scheme.savePreference(preference);
    setScheme(Scheme.apply(preference));
  }));
  Scheme.system.addEventListener('change', () => {
    if (preference === 'auto') setScheme(Scheme.apply('auto')); // the OS flipped between light and dark
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !ui.setup.hidden && !ui.cancel.hidden) closeSetup();
  });

  // ---- start ------------------------------------------------------------------------------------

  function init() {
    buildCity(ui.city);
    buildClock();
    fx = new FXLib.FX(ui.ring, ui.canvas, { calm: CALM });
    setScheme(document.documentElement.dataset.scheme); // scheme.js picked it before first paint
    measure();

    if (STILL) {
      ui.stage.classList.add('still');
      ui.stage.classList.toggle('nograin', query.has('nograin')); // the store tiles are too small for film grain
      fx.frame(new Date(2026, 0, 1, 0, 0, 17).getTime(), 0);
      return;
    }

    window.addEventListener('resize', () => { fx.resize(); measure(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) lastSecond = NaN; });

    // ?dob= wins over the saved date; a date that isn't in the past yet (bad clock, hand-edited storage) is ignored.
    const start = [Core.parseBirthday(query.get('dob')), Core.parseBirthday(store.read())].find(isPast);
    ui.edit.hidden = true;
    if (start) {
      applyBirthday(start);
    } else {
      ui.stage.classList.add('dormant'); // unlit zeros behind the setup card
      slots.forEach((_, i) => setDigit(i, '0', false));
      openSetup(true);
    }

    if (query.has('debug')) window.__intime = { glitch, grant, fx, tick: () => tick(now(), true) };
    requestAnimationFrame(loop);
  }

  init();
})();
