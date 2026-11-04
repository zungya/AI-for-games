/* 4-1 群聚：分离、对齐、聚合三条规则 + 鼠标老鹰 */
(function () {
  'use strict';
  const cv = G.$('#bd-cv');
  if (!cv) return;
  const W = 760, H = 400;
  const C = G.canvas(cv, W, H, draw);
  const ctx = C.ctx;
  const N = window.innerWidth < 640 ? 70 : 115;
  const MAXV = 140, MAXF = 260;
  const P = { sep: 1.6, ali: 1.0, coh: 0.9, view: 48 };
  const PRESETS = {
    flock: { sep: 1.6, ali: 1.0, coh: 0.9, view: 48 },
    sand: { sep: 3.2, ali: 0, coh: 0, view: 30 },
    blob: { sep: 0.3, ali: 0.4, coh: 3.2, view: 95 },
    march: { sep: 1.2, ali: 3.6, coh: 0.5, view: 75 }
  };
  const birds = [];
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2;
    birds.push({ x: Math.random() * W, y: Math.random() * H, vx: Math.cos(a) * 80, vy: Math.sin(a) * 80, nb: [] });
  }
  G.$('#bd-count').textContent = 'N = ' + N;
  const hawkEl = G.$('#bd-hawk'), dbgEl = G.$('#bd-debug');
  const hawk = { x: 0, y: 0, in: false };
  cv.addEventListener('pointermove', e => { const p = C.toLocal(e); hawk.x = p.x; hawk.y = p.y; hawk.in = true; });
  cv.addEventListener('pointerleave', () => { hawk.in = false; });
  cv.addEventListener('pointerdown', e => { const p = C.toLocal(e); hawk.x = p.x; hawk.y = p.y; hawk.in = true; });

  const col = {};
  function readColors() {
    const sec = G.$('#boids');
    col.s2 = G.css('--surface-2'); col.line = G.css('--line'); col.ink = G.css('--ink'); col.ink2 = G.css('--ink-2');
    col.accent = G.css('--accent', sec); col.red = G.css('--w1'); col.surface = G.css('--surface');
  }
  readColors();
  G.onTheme(function () { readColors(); draw(); });

  function steer(b, x, y, w) {
    // 期望速度 = 方向 × 最大速度；转向力 = 期望 − 当前
    const l = Math.hypot(x, y);
    if (l < 1e-6 || !w) return [0, 0];
    let fx = x / l * MAXV - b.vx, fy = y / l * MAXV - b.vy;
    const fl = Math.hypot(fx, fy);
    if (fl > MAXF) { fx = fx / fl * MAXF; fy = fy / fl * MAXF; }
    return [fx * w, fy * w];
  }
  function update(dt) {
    const R = P.view, R2 = R * R, SEP = R * 0.55;
    for (const b of birds) {
      let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, n = 0;
      b.nb.length = 0;
      for (const o of birds) {
        if (o === b) continue;
        const dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 > R2) continue;
        n++; b.nb.push(o);
        ax += o.vx; ay += o.vy; cx += o.x; cy += o.y;
        if (d2 < SEP * SEP && d2 > 1e-4) { sx -= dx / d2; sy -= dy / d2; }
      }
      let fx = 0, fy = 0;
      if (n) {
        const s = steer(b, sx, sy, P.sep), a = steer(b, ax / n, ay / n, P.ali), c = steer(b, cx / n - b.x, cy / n - b.y, P.coh);
        fx += s[0] + a[0] + c[0]; fy += s[1] + a[1] + c[1];
      }
      if (hawkEl.checked && hawk.in) {
        const dx = b.x - hawk.x, dy = b.y - hawk.y, d = Math.hypot(dx, dy);
        if (d < 95) { const f = steer(b, dx, dy, 4 * (1 - d / 95) + 1); fx += f[0]; fy += f[1]; }
      }
      b.ax = fx; b.ay = fy;
    }
    for (const b of birds) {
      b.vx += b.ax * dt; b.vy += b.ay * dt;
      let v = Math.hypot(b.vx, b.vy);
      if (v > MAXV) { b.vx = b.vx / v * MAXV; b.vy = b.vy / v * MAXV; v = MAXV; }
      if (v < 40) { const k = 40 / (v || 1); b.vx *= k; b.vy *= k; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -10) b.x += W + 20; else if (b.x > W + 10) b.x -= W + 20;
      if (b.y < -10) b.y += H + 20; else if (b.y > H + 10) b.y -= H + 20;
    }
  }
  function tri(b, size, fill) {
    const a = Math.atan2(b.vy, b.vx);
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.75, size * 0.55); ctx.lineTo(-size * 0.4, 0); ctx.lineTo(-size * 0.75, -size * 0.55); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }
  function draw() {
    ctx.fillStyle = col.s2; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 40; x < W; x += 40) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let y = 40; y < H; y += 40) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();
    const f = birds[0];
    if (dbgEl.checked) {
      ctx.strokeStyle = col.accent; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(f.x, f.y, P.view, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 0.6; ctx.beginPath();
      f.nb.forEach(o => { ctx.moveTo(f.x, f.y); ctx.lineTo(o.x, o.y); }); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (let i = 1; i < birds.length; i++) tri(birds[i], 6, col.ink2);
    tri(f, 9, dbgEl.checked ? col.accent : col.ink2);
    if (hawkEl.checked && hawk.in) {
      ctx.strokeStyle = col.red; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(hawk.x, hawk.y, 95, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = col.red; ctx.font = '700 12px "Noto Sans SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('老鹰', hawk.x, hawk.y);
    }
  }

  const sliders = ['sep', 'ali', 'coh', 'view'];
  function syncSliders() {
    sliders.forEach(k => {
      const inp = G.$('#bd-' + k);
      inp.value = P[k];
      G.$('#bd-' + k + '-o').textContent = k === 'view' ? String(Math.round(P[k])) : Number(P[k]).toFixed(1);
    });
  }
  sliders.forEach(k => G.$('#bd-' + k).addEventListener('input', e => {
    P[k] = +e.target.value; syncSliders();
    G.$$('#bd-preset button').forEach(x => x.setAttribute('aria-pressed', 'false'));
  }));
  G.$$('#bd-preset button').forEach(b => b.addEventListener('click', () => {
    Object.assign(P, PRESETS[b.getAttribute('data-p')]);
    G.$$('#bd-preset button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    syncSliders();
  }));
  dbgEl.addEventListener('change', draw);
  syncSliders();
  for (let i = 0; i < 90; i++) update(1 / 60);
  G.ready.then(draw);
  G.loop(cv, function (dt) { update(dt); draw(); });
})();
