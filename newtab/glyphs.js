/*
 * Single-stroke, chamfered digits on a 56 x 96 grid. Each glyph is a list of <path> strokes, which
 * lets the clock "draw" a digit on and "un-draw" it again with stroke-dashoffset.
 * Paths use absolute M / L / H / V / Z only, so `sample` can walk them without a DOM.
 */
(function (root) {
  'use strict';

  const W = 56;
  const H = 96;

  const paths = {
    0: ['M10,0 H46 L56,10 V86 L46,96 H10 L0,86 V10 Z'],
    1: ['M24,20 L44,0 V96'], // stem sits right of centre, like a digital clock, so "13" reads as a tight pair
    2: ['M0,10 L10,0 H46 L56,10 V38 L46,48 H10 L0,58 V96 H56'],
    3: ['M0,0 H46 L56,10 V38 L46,48 H14', 'M46,48 L56,58 V86 L46,96 H0'],
    4: ['M0,0 V48 H56', 'M40,0 V96'],
    5: ['M56,0 H0 V48 H46 L56,58 V86 L46,96 H0'],
    6: ['M56,0 H10 L0,10 V86 L10,96 H46 L56,86 V58 L46,48 H0'],
    7: ['M0,0 H56 L18,96'],
    8: ['M10,0 H46 L56,10 V38 L46,48 H10 L0,38 V10 Z', 'M10,48 H46 L56,58 V86 L46,96 H10 L0,86 V58 Z'],
    9: ['M0,96 H46 L56,86 V10 L46,0 H10 L0,10 V38 L10,48 H56'],
  };

  /** Points spaced about `step` apart along an absolute M/L/H/V/Z path (used to shed grains of time). */
  function sample(d, step) {
    const pts = [];
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;
    const line = (nx, ny) => {
      const n = Math.max(1, Math.round(Math.hypot(nx - x, ny - y) / step));
      for (let i = 0; i < n; i++) pts.push({ x: x + ((nx - x) * i) / n, y: y + ((ny - y) * i) / n });
      x = nx;
      y = ny;
    };
    for (const [, cmd, args] of d.matchAll(/([MLHVZ])([^MLHVZ]*)/g)) {
      const n = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
      if (cmd === 'M') { x = startX = n[0]; y = startY = n[1]; }
      else if (cmd === 'L') line(n[0], n[1]);
      else if (cmd === 'H') line(n[0], y);
      else if (cmd === 'V') line(x, n[0]);
      else line(startX, startY);
    }
    return pts;
  }

  root.InTimeGlyphs = { W, H, paths, sample };
})(typeof self !== 'undefined' ? self : this);
