/* Vela field — shared generative particle field.
   Modes: dune, ring, rift, vortex, terrain, bloom, grid, tide, dust, curtain. */
(function (global) {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(c, a) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a < 0 ? 0 : a > 1 ? 1 : a).toFixed(3) + ')';
  }

  function rampFactory(colors) {
    const stops = colors.map(hexToRgb);
    return function (t) {
      t = clamp(t, 0, 1);
      const n = stops.length - 1;
      const p = t * n;
      const i = Math.min(n - 1, Math.floor(p));
      const f = p - i;
      const a = stops[i], b = stops[i + 1];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    };
  }

  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function mount(canvas, opts) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    const o = Object.assign({
      mode: 'dune',
      colors: ['#ff3bd4', '#6b4cff', '#5ce6ff'],
      density: 1,
      stars: 1,
      seed: 11,
      fps: 30,
      parallax: 1,
      wobble: .55,
      motionSpeed: 1,
      drift: 0,
      surge: 0,
      spin: 0,
      flat: .62,
      arms: 3,
      haze: false,
      center: null,
      pulse: 0,
      bloomCenter: null,
      bloomSpread: .26,
      bloomRing: false,
      binaryCenters: null,
      duneStart: .40,
      duneWidth: .72,
      duneRise: .55,
      tide: 0,
      tideSpeed: .25,
      tideWave: 3.2,
      tilt: 0,
      spinPlane: false,
      radius: .5
    }, opts || {});

    let W = 0, H = 0, DPR = 1, raf = 0;
    let stars = [], shape = [];
    let pointer = { x: .5, y: .5, tx: .5, ty: .5 };
    let last = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let seed = o.seed >>> 0;

    function makeStars() {
      const count = Math.round((W * H) / 2600 * o.stars);
      const arr = [];
      for (let i = 0; i < count; i++) {
        arr.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: Math.random() < .82 ? .6 + Math.random() * .7 : 1.2 + Math.random() * 1.1,
          a: .12 + Math.random() * .62,
          ph: Math.random() * TAU,
          sp: .18 + Math.random() * .85,
          z: .2 + Math.random() * .9,
          c: Math.random() > .87 ? [170, 225, 255] : [225, 232, 245]
        });
      }
      stars = arr;
    }

    function makeShape() {
      const count = Math.round(15000 * o.density * Math.min(1.9, (W * H) / (1440 * 900)));
      const arr = [];
      const ramp = rampFactory(o.colors);
      const c1 = hexToRgb(o.colors[0]);
      const c2 = hexToRgb(o.colors[Math.min(1, o.colors.length - 1)]);
      const c3 = hexToRgb(o.colors[o.colors.length - 1]);
      const modes = {
        dune: function () {
          const ds = o.duneStart, dw = o.duneWidth, dr = o.duneRise;
          const edgeAt = function (x) {
            return 1.02 - dr * Math.pow((x - ds) / dw, .92) + .045 * Math.sin((x - ds) * 9.2);
          };
          const n = count * 2.15;
          for (let i = 0; i < n; i++) {
            const x = ds + Math.random() * (dw + .06);
            const edge = edgeAt(x);
            const d = Math.pow(Math.random(), 1.35);
            const y = edge + d * (1.14 - edge);
            if (y > 1.13) continue;
            const near = y - edge;
            const bodyT = clamp(.08 + (x - ds) * .42 + (1 - near) * .08, 0, 1);
            const rimT = clamp((x - ds) / (dw + .06), 0, 1);
            const col = near < .028 ? (rimT > .6 ? c3 : rimT > .3 ? c2 : c1) : ramp(bodyT);
            const r = .35 + Math.random() * 1.25 + (near < .022 ? .9 : 0);
            const a = .46 + Math.random() * .54 + (near < .04 ? .15 : 0);
            arr.push({ x: x * W, y: y * H, r, h: r, c: rgba(col, Math.min(1, a)), ph: Math.random() * TAU, sp: .55 + Math.random() * .9, z: .3 + Math.random() * .7 });
          }
          // bright, thick rim
          for (let i = 0; i < 3000; i++) {
            const x = ds + Math.random() * (dw + .06);
            const edge = edgeAt(x);
            const y = edge + Math.random() * .034;
            const rimT = clamp((x - ds) / (dw + .06), 0, 1);
            const col = rimT > .58 ? c3 : rimT > .26 ? c2 : c1;
            arr.push({ x: x * W, y: y * H, r: .55 + Math.random() * 1.65, h: .8 + Math.random() * 1.8, c: rgba(col, .55 + Math.random() * .45), ph: Math.random() * TAU, sp: .8 + Math.random(), z: .9 });
          }
          // fine sand falloff under the crest
          for (let i = 0; i < 9500; i++) {
            const x = ds + Math.random() * (dw + .06);
            const edge = edgeAt(x);
            const y = edge + .03 + Math.pow(Math.random(), 1.8) * (1.14 - edge);
            arr.push({ x: x * W, y: y * H, r: .3 + Math.random() * .65, h: .3 + Math.random() * .65, c: rgba(ramp(clamp((x - ds) / (dw + .06), 0, 1)), .2 + Math.random() * .38), ph: Math.random() * TAU, sp: .35 + Math.random(), z: .2 + Math.random() * .5 });
          }
          // mist above the crest
          for (let i = 0; i < 1600; i++) {
            const x = ds + .02 + Math.random() * (dw - .02);
            const edge = edgeAt(x);
            const y = edge - Math.random() * .1;
            arr.push({ x: x * W, y: y * H, r: .4 + Math.random() * 1.1, h: .4 + Math.random(), c: rgba(c3, .06 + Math.random() * .2), ph: Math.random() * TAU, sp: .4 + Math.random(), z: .2 });
          }
        },
        ring: function () {
          const cx = 1.02, cy = .53, rx = .30, ry = .42, tilt = -.24;
          const ct = Math.cos(tilt), st = Math.sin(tilt);
          for (let i = 0; i < count * 1.4; i++) {
            const a = Math.random() * TAU;
            const band = .004 + Math.abs(gauss()) * .030;
            const rr = 1 + band * 2.8;
            const ex = Math.cos(a) * rx * rr;
            const ey = Math.sin(a) * ry * rr;
            const x = cx + ex * ct - ey * st;
            const y = cy + ex * st + ey * ct;
            const t = clamp((Math.sin(a) + 1) / 2, 0, 1);
            const col = ramp(t);
            const al = .3 + Math.random() * .6;
            const r = .4 + Math.random() * 1.25;
            arr.push({ x: x * W, y: y * H, r, h: r, c: rgba(col, al), ph: Math.random() * TAU, sp: .55 + Math.random(), z: .3 + Math.random() * .7 });
          }
          // bright ring sparks
          for (let i = 0; i < 2100; i++) {
            const a = Math.random() * TAU;
            const band = .002 + Math.random() * .009;
            const rr = 1 + band * 2.4;
            const ex = Math.cos(a) * rx * rr;
            const ey = Math.sin(a) * ry * rr;
            const x = cx + ex * ct - ey * st;
            const y = cy + ex * st + ey * ct;
            const t = clamp((Math.sin(a) + 1) / 2, 0, 1);
            arr.push({ x: x * W, y: y * H, r: .65 + Math.random() * 1.6, h: .8 + Math.random() * 1.5, c: rgba(ramp(t), .55 + Math.random() * .45), ph: Math.random() * TAU, sp: .8 + Math.random(), z: .9 });
          }
          // outer haze
          for (let i = 0; i < 2200; i++) {
            const a = Math.random() * TAU;
            const band = .03 + Math.abs(gauss()) * .07;
            const rr = 1 + band * 2.8;
            const ex = Math.cos(a) * rx * rr;
            const ey = Math.sin(a) * ry * rr;
            const x = cx + ex * ct - ey * st;
            const y = cy + ex * st + ey * ct;
            arr.push({ x: x * W, y: y * H, r: .4 + Math.random() * .9, h: .4 + Math.random() * .9, c: rgba(ramp(Math.random()), .05 + Math.random() * .14), ph: Math.random() * TAU, sp: .4 + Math.random(), z: .2 });
          }
        },
        rift: function () {
          const edgeAt = function (y) {
            return .33 + .03 * Math.sin(y * 7.4 + 1.2) + .016 * Math.sin(y * 19.1);
          };
          for (let i = 0; i < count * 1.25; i++) {
            const y = Math.random();
            const edge = edgeAt(y);
            const x = edge - Math.pow(Math.random(), 1.42) * .31;
            const depth = clamp((edge - x) / .31, 0, 1);
            const t = clamp(1 - depth + .08, 0, 1);
            const col = ramp(t);
            const near = edge - x;
            const r = .35 + Math.random() * 1.1 + (near < .01 ? .65 : 0);
            arr.push({ x: x * W, y: y * H, r, h: r, c: rgba(col, .22 + Math.random() * .62 + (near < .014 ? .18 : 0)), ph: Math.random() * TAU, sp: .5 + Math.random(), z: .3 + Math.random() * .7, depth });
          }
          // luminous edge
          for (let i = 0; i < 2600; i++) {
            const y = Math.random();
            const edge = edgeAt(y);
            arr.push({ x: (edge - Math.random() * .012) * W, y: y * H, r: .55 + Math.random() * 1.5, h: .8 + Math.random() * 1.6, c: rgba(c3, .5 + Math.random() * .45), ph: 0, sp: .75, z: .9, depth: 0 });
          }
          // inner haze
          for (let i = 0; i < 2400; i++) {
            const y = Math.random();
            const edge = edgeAt(y);
            const x = Math.max(0, edge - .08 - Math.random() * .3);
            arr.push({ x: x * W, y: y * H, r: .4 + Math.random() * .9, h: .4 + Math.random() * .9, c: rgba(c1, .03 + Math.random() * .1), ph: 0, sp: .4, z: .2, depth: 1 });
          }
        },
        vortex: function () {
          const cx = o.center ? o.center[0] : .735;
          const cy = o.center ? o.center[1] : .46;
          const arms = o.arms || 3;
          const flat = o.flat || .62;
          const radius = o.radius || .5;
          const scx = cx * W, scy = cy * H;
          const tilt = o.tilt || 0;
          const ct = Math.cos(tilt), st = Math.sin(tilt);
          const put = function (ang, rad, col, alpha, rr, sp, z) {
            const lx = Math.cos(ang) * rad * .95;
            const ly = Math.sin(ang) * rad * flat;
            return { x: (cx + lx * ct - ly * st) * W, y: (cy + lx * st + ly * ct) * H, r: rr, h: rr, c: rgba(col, alpha), ph: Math.random() * TAU, sp, z, scx, scy, ang, rad, flat, tilt };
          };
          for (let i = 0; i < count; i++) {
            const t = Math.pow(Math.random(), .82);
            const arm = Math.floor(Math.random() * arms);
            const ang = t * 8.2 + arm * TAU / arms + gauss() * .16;
            const rad = .055 + t * radius;
            const col = ramp((t + arm / arms * .2) % 1);
            const r = .35 + Math.random() * 1.1 + (t > .8 ? .4 : 0);
            arr.push(put(ang, rad, col, .15 + Math.random() * .62, r, .5 + Math.random(), .25 + Math.random() * .75));
          }
          for (let i = 0; i < 900; i++) {
            const a = Math.random() * TAU;
            const rr = Math.random() * .11;
            arr.push(put(a, rr, c2, .3 + Math.random() * .5, .5 + Math.random() * 1.3, .4, 1));
          }
          if (o.haze) {
            for (let i = 0; i < 3200; i++) {
              const a = Math.random() * TAU;
              const rr = Math.pow(Math.random(), .55) * (radius + .08);
              arr.push(put(a, rr, ramp(Math.random()), .03 + Math.random() * .13, .35 + Math.random() * 1.1, .3 + Math.random(), .2));
            }
          }
        },
        binary: function () {
          const centers = o.binaryCenters || [[.66, .5], [.86, .44]];
          centers.forEach(function (c, idx) {
            const cx = c[0], cy = c[1], scx = cx * W, scy = cy * H;
            const arms = idx === 0 ? 2 : 3;
            for (let i = 0; i < count * .52; i++) {
              const t = Math.pow(Math.random(), .84);
              const arm = Math.floor(Math.random() * arms);
              const ang = t * 7.4 + arm * TAU / arms + gauss() * .17 + idx * .6;
              const rad = .035 + t * .24;
              const x = cx + Math.cos(ang) * rad * .95;
              const y = cy + Math.sin(ang) * rad * .6;
              const col = ramp((t + idx * .25 + arm / arms * .14) % 1);
              const r = .35 + Math.random() * 1.0;
              arr.push({ x: x * W, y: y * H, r, h: r, c: rgba(col, .14 + Math.random() * .6), ph: Math.random() * TAU, sp: .5 + Math.random(), z: .25 + Math.random() * .75, scx, scy });
            }
            for (let i = 0; i < 500; i++) {
              const a = Math.random() * TAU;
              const rr = Math.random() * .055;
              arr.push({ x: (cx + Math.cos(a) * rr) * W, y: (cy + Math.sin(a) * rr * .6) * H, r: .45 + Math.random() * 1.2, h: .45 + Math.random() * 1.2, c: rgba(c2, .25 + Math.random() * .45), ph: 0, sp: .4, z: 1, scx, scy });
            }
          });
        },
        terrain: function () {
          for (let i = 0; i < count; i++) {
            const x = Math.random() * 1.08;
            const edge = .8 + .042 * Math.sin(x * 6.4 + 1.2) + .022 * Math.sin(x * 15.7 + .3);
            const d = Math.pow(Math.random(), 1.35);
            const y = edge + d * (1.1 - edge);
            if (y > 1.08) continue;
            const t = clamp(x / 1.08 + (y - edge) * .3, 0, 1);
            const col = ramp(t);
            const near = y - edge;
            const r = .35 + Math.random() * .95 + (near < .015 ? .5 : 0);
            arr.push({ x: x * W, y: y * H, r, h: r, c: rgba(col, .3 + Math.random() * .6 + (near < .025 ? .2 : 0)), ph: Math.random() * TAU, sp: .4 + Math.random(), z: .25 + Math.random() * .75 });
          }
          for (let i = 0; i < 2200; i++) {
            const x = Math.random() * 1.08;
            const edge = .8 + .042 * Math.sin(x * 6.4 + 1.2) + .022 * Math.sin(x * 15.7 + .3);
            arr.push({ x: x * W, y: (edge + Math.random() * .012) * H, r: .55 + Math.random() * 1.3, h: .6 + Math.random() * 1.2, c: rgba(c3, .4 + Math.random() * .4), ph: 0, sp: .7, z: .9 });
          }
        },
        bloom: function () {
          const cx = o.bloomCenter ? o.bloomCenter[0] : .73;
          const cy = o.bloomCenter ? o.bloomCenter[1] : .44;
          const spread = o.bloomSpread || .26;
          const scx = cx * W, scy = cy * H;
          for (let i = 0; i < count; i++) {
            const a = Math.random() * TAU;
            const rr = Math.abs(gauss()) * spread;
            const x = cx + Math.cos(a) * rr * 1.12;
            const y = cy + Math.sin(a) * rr * .78;
            const t = clamp(rr / (spread * 1.7) + .1, 0, 1);
            const col = ramp(t);
            const r = .35 + Math.random() * 1.15;
            arr.push({ x: x * W, y: y * H, r, h: r, c: rgba(col, .12 + Math.random() * .5), ph: Math.random() * TAU, sp: .4 + Math.random(), z: .2 + Math.random() * .8, scx, scy });
          }
          for (let i = 0; i < 1000; i++) {
            const a = Math.random() * TAU;
            const rr = Math.abs(gauss()) * spread * .27;
            arr.push({ x: (cx + Math.cos(a) * rr) * W, y: (cy + Math.sin(a) * rr * .8) * H, r: .5 + Math.random() * 1.2, h: .5 + Math.random() * 1.2, c: rgba(c2, .2 + Math.random() * .5), ph: 0, sp: .5, z: 1, scx, scy });
          }
          if (o.bloomRing) {
            for (let i = 0; i < 2600; i++) {
              const a = Math.random() * TAU;
              const rr = spread * 1.55 + (Math.random() - .5) * spread * .14;
              arr.push({ x: (cx + Math.cos(a) * rr * 1.08) * W, y: (cy + Math.sin(a) * rr * .82) * H, r: .5 + Math.random() * 1.5, h: .6 + Math.random() * 1.5, c: rgba(c3, .25 + Math.random() * .45), ph: 0, sp: .6, z: .9, scx, scy });
            }
          }
        },
        grid: function () {
          const cx = .755, horizon = .27;
          for (let i = 0; i < count * 1.1; i++) {
            const depth = .34 + Math.pow(Math.random(), .7) * .92;
            const col = Math.floor((Math.random() * 2 - 1) * 22);
            const jx = gauss() * .004 / depth;
            const jy = gauss() * .003 / depth;
            const x = cx + (col * .057) / depth + jx;
            const y = horizon + .48 / depth + jy;
            if (x < -.08 || x > 1.08 || y < .2 || y > 1.08) continue;
            const t = clamp(1 - depth + .08, 0, 1);
            const colr = ramp(t);
            const r = .3 + Math.random() * 1.0;
            arr.push({ x: x * W, y: y * H, r, h: r, c: rgba(colr, .35 + Math.random() * .55), ph: Math.random() * TAU, sp: .7 + Math.random(), z: .2 + Math.random() * .8 });
          }
        },
        tide: function () {
          const bands = 6;
          for (let i = 0; i < count; i++) {
            const band = Math.floor(Math.random() * bands);
            const x = .26 + Math.random() * .86;
            const base = .31 + band * .105;
            const y = base + Math.sin(x * 6.2 + band * .8) * .028 + gauss() * .012;
            if (y < .2 || y > 1.04) continue;
            const t = clamp(band / (bands - 1) + .03, 0, 1);
            const col = ramp(t);
            const r = .35 + Math.random() * .95;
            arr.push({ x: x * W, y: y * H, r, h: r, c: rgba(col, .15 + Math.random() * .55), ph: Math.random() * TAU, sp: .4 + Math.random(), z: .2 + Math.random() * .8 });
          }
          for (let i = 0; i < 900; i++) {
            const band = Math.floor(Math.random() * bands);
            const x = .3 + Math.random() * .8;
            const y = .31 + band * .105 + Math.sin(x * 6.2 + band * .8) * .028;
            arr.push({ x: x * W, y: y * H, r: .5 + Math.random() * 1.2, h: .5 + Math.random() * 1.1, c: rgba(c3, .35 + Math.random() * .4), ph: 0, sp: .5, z: .8 });
          }
        },
        dust: function () {
          const cx = .79, cy = .45;
          for (let i = 0; i < count * 1.35; i++) {
            const a = Math.random() * TAU;
            const rr = Math.pow(Math.random(), .55) * .34;
            const x = cx + Math.cos(a) * rr * 1.05;
            const y = cy + Math.sin(a) * rr * .72;
            const g = 165 + Math.random() * 80;
            const r = .35 + Math.random() * 1.05;
            arr.push({ x: x * W, y: y * H, r, h: r, c: `rgba(${g},${g},${g},${.06 + Math.random() * .34})`, ph: Math.random() * TAU, sp: .3 + Math.random(), z: .2 + Math.random() * .8 });
          }
          for (let i = 0; i < 1800; i++) {
            const a = Math.random() * TAU;
            const rr = Math.pow(Math.random(), .7) * .14;
            arr.push({ x: (cx + Math.cos(a) * rr) * W, y: (cy + Math.sin(a) * rr * .7) * H, r: .5 + Math.random() * 1.4, h: .5 + Math.random() * 1.4, c: `rgba(230,230,230,${.18 + Math.random() * .5})`, ph: 0, sp: .4, z: 1 });
          }
        },
        curtain: function () {
          const strands = 60;
          for (let i = 0; i < count * 1.4; i++) {
            const si = Math.floor(Math.random() * strands);
            const sx = .52 + (si / strands) * .6;
            const y = Math.pow(Math.random(), .88);
            const x = sx + Math.sin(y * 8.4 + si * .47) * .024 + (Math.random() - .5) * .009;
            const t = clamp(y + .06, 0, 1);
            const col = ramp(t);
            const r = .3 + Math.random() * 1.0;
            const h = 1.1 + Math.random() * 3.8;
            arr.push({ x: x * W, y: y * H, r, h, c: rgba(col, .24 + Math.random() * .58), ph: Math.random() * TAU, sp: .3 + Math.random(), z: .2 + Math.random() * .8 });
          }
          for (let i = 0; i < 1500; i++) {
            const si = Math.floor(Math.random() * strands);
            const sx = .52 + (si / strands) * .6;
            const y = Math.random() * .9;
            const x = sx + Math.sin(y * 8.4 + si * .47) * .024;
            arr.push({ x: x * W, y: y * H, r: .4 + Math.random() * .9, h: 1.2 + Math.random() * 3.6, c: rgba(c1, .28 + Math.random() * .48), ph: 0, sp: .3, z: .7 });
          }
        }
      };
      if (modes[o.mode]) modes[o.mode]();
      shape = arr;
    }

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      seed = (o.seed + W * 13 + H * 7) >>> 0;
      const rand = mulberry32(seed);
      // deterministic-ish star field using provided RNG for stable quality
      const oldRandom = Math.random;
      Math.random = rand;
      makeStars();
      makeShape();
      Math.random = oldRandom;
      draw(performance.now(), true);
    }

    function draw(t, force) {
      const time = t / 1000;
      pointer.x += (pointer.tx - pointer.x) * .045;
      pointer.y += (pointer.ty - pointer.y) * .045;
      const px = (pointer.x - .5) * 16 * o.parallax;
      const py = (pointer.y - .5) * 12 * o.parallax;

      ctx.clearRect(0, 0, W, H);

      // stars
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const tw = .62 + .38 * Math.sin(time * s.sp + s.ph);
        const a = s.a * tw;
        ctx.fillStyle = 'rgba(' + s.c[0] + ',' + s.c[1] + ',' + s.c[2] + ',' + a.toFixed(3) + ')';
        ctx.fillRect(s.x + px * s.z, s.y + py * s.z, s.r, s.r);
      }

      // soft vertical bands under the curtain
      if (o.mode === 'curtain') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const bands = 34;
        for (let i = 0; i < bands; i++) {
          const sx = W * (.52 + (i / bands) * .58);
          const grad = ctx.createLinearGradient(sx, 0, sx, H);
          grad.addColorStop(0, 'rgba(255,168,108,.070)');
          grad.addColorStop(.55, 'rgba(205,128,235,.040)');
          grad.addColorStop(1, 'rgba(100,90,255,.018)');
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          for (let y = 0; y <= H; y += 18) {
            const x = sx + Math.sin((y / H) * 8.4 + i * .47) * W * .024;
            y === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // perspective grid backdrop
      if (o.mode === 'grid') {
        const cx = W * .755, hy = H * .27;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1;
        for (let col = -22; col <= 22; col += 2) {
          const a = .05 + (1 - Math.abs(col) / 24) * .07;
          ctx.strokeStyle = 'rgba(70,225,205,' + a.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(cx + col * 2, hy);
          ctx.lineTo(cx + col * (W * .012), H * 1.04);
          ctx.stroke();
        }
        for (let d = .38; d <= 1.4; d += .075) {
          const y = hy + H * .48 / d;
          if (y > H * 1.04) continue;
          const a = .045 + (1 - d / 1.4) * .07;
          ctx.strokeStyle = 'rgba(100,245,225,' + a.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(W * .43, y);
          ctx.lineTo(W * 1.04, y);
          ctx.stroke();
        }
        ctx.restore();
      }

      // tinted base under the dune
      if (o.mode === 'dune') {
        const ds = o.duneStart, dw = o.duneWidth, dr = o.duneRise;
        const cA = hexToRgb(o.colors[0]);
        const cB = hexToRgb(o.colors[Math.min(1, o.colors.length - 1)]);
        const cC = hexToRgb(o.colors[o.colors.length - 1]);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createLinearGradient((ds - .02) * W, H * .95, W, H * .42);
        grad.addColorStop(0, rgba(cA, .18));
        grad.addColorStop(.5, rgba(cB, .19));
        grad.addColorStop(1, rgba(cC, .2));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(ds * W, H * 1.05);
        for (let x = ds; x <= 1.18; x += .02) {
          const edge = 1.02 - dr * Math.pow((x - ds) / dw, .92) + .045 * Math.sin((x - ds) * 9.2);
          ctx.lineTo(x * W, edge * H);
        }
        ctx.lineTo(W * 1.18, H * 1.05);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // field
      ctx.globalCompositeOperation = 'lighter';
      const spinA = o.spin ? time * o.spin : 0;
      const spinC = Math.cos(spinA), spinS = Math.sin(spinA);
      const bloomCx = (o.bloomCenter ? o.bloomCenter[0] : .73) * W;
      const bloomCy = (o.bloomCenter ? o.bloomCenter[1] : .44) * H;
      for (let i = 0; i < shape.length; i++) {
        const p = shape[i];
        let x = p.x, y = p.y;
        if (o.spinPlane && p.ang !== undefined) {
          const a = p.ang + time * o.spin;
          const lx = Math.cos(a) * p.rad * W * .95;
          const ly = Math.sin(a) * p.rad * H * p.flat;
          const ct = Math.cos(p.tilt), st = Math.sin(p.tilt);
          x = p.scx + lx * ct - ly * st;
          y = p.scy + lx * st + ly * ct;
        } else if (o.spin && p.scx != null) {
          const dx = x - p.scx, dy = y - p.scy;
          x = p.scx + dx * spinC - dy * spinS;
          y = p.scy + dx * spinS + dy * spinC;
        }
        if (o.pulse) {
          const s = 1 + Math.sin(time * .32 + p.ph) * o.pulse;
          x = bloomCx + (x - bloomCx) * s;
          y = bloomCy + (y - bloomCy) * s;
        }
        const wob = Math.sin(time * o.motionSpeed * p.sp + p.ph) * o.wobble;
        const wobY = Math.cos(time * o.motionSpeed * p.sp * .8 + p.ph) * o.wobble * .64;
        if (o.mode === 'dune') {
          x += Math.sin(time * .06 + (p.y / H) * 2.1) * o.drift;
          y += Math.sin(time * .22 + (p.x / W) * 4.2) * o.surge;
        }
        if (o.mode === 'rift' && o.tide) {
          const ph = time * o.tideSpeed + (p.y / H) * o.tideWave;
          const wash = Math.sin(ph) + .28 * Math.sin(ph * 2.15 + .8);
          const prox = p.depth == null ? .6 : (1 - p.depth * .62);
          x += wash * o.tide * prox;
          y += Math.cos(ph * 1.32 + .4) * o.tide * .12 * prox;
        }
        ctx.fillStyle = p.c;
        ctx.fillRect(x + px * p.z + wob, y + py * p.z + wobY, p.r, p.h);
      }
      ctx.globalCompositeOperation = 'source-over';

    }

    function loop(t) {
      if (t - last > 1000 / o.fps) {
        draw(t);
        last = t;
      }
      raf = requestAnimationFrame(loop);
    }

    window.addEventListener('resize', () => {
      clearTimeout(resize._t);
      resize._t = setTimeout(resize, 120);
    });
    window.addEventListener('pointermove', e => {
      pointer.tx = e.clientX / window.innerWidth;
      pointer.ty = e.clientY / window.innerHeight;
    }, { passive: true });

    resize();
    if (!reduced) raf = requestAnimationFrame(loop);
    return { resize, destroy(){ cancelAnimationFrame(raf); } };
  }

  global.VelaField = { mount };
})(window);
