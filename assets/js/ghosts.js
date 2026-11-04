/* 2-1 贪心 · 吃豆人四只鬼：同一条贪心规则，四个不同的目标格 */
/* ---------- 四只鬼：同一条贪心规则，四个目标函数 ---------- */
(function () {
  'use strict';
  const cv = G.$('#gh-cv');
  if (!cv) return;
  const MAP = [
    '###################',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.###.#.###.####',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '#.##.###.#.###.##.#',
    '#........#........#',
    '###################'
  ];
  const ROWS = MAP.length, COLS = MAP[0].length, T = 32, W = COLS * T, H = ROWS * T;
  const C = G.canvas(cv, W, H, draw);
  const ctx = C.ctx;
  const DIRS = { up: [0, -1], left: [-1, 0], down: [0, 1], right: [1, 0] };
  const ORDER = ['up', 'left', 'down', 'right'];
  const REV = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const ARROW = { up: '▲', left: '◀', down: '▼', right: '▶' };
  const SCATTER = [[COLS - 3, -2], [2, -2], [COLS - 1, ROWS + 1], [0, ROWS + 1]];
  const START = [[9, 3, 'left'], [9, 7, 'right'], [4, 11, 'right'], [14, 11, 'left']];
  const GHOST = [
    { name: '红鬼', pal: 'red' }, { name: '粉鬼', pal: 'pink' }, { name: '青鬼', pal: 'cyan' }, { name: '橙鬼', pal: 'orange' }
  ];
  const isWall = (x, y) => y < 0 || y >= ROWS || x < 0 || x >= COLS || MAP[y][x] === '#';
  const col = {};
  function readColors() {
    col.surface = G.css('--surface'); col.s2 = G.css('--surface-2'); col.line = G.css('--line'); col.ink = G.css('--ink');
    col.ink2 = G.css('--ink-2'); col.border = G.css('--border'); col.green = G.css('--w4'); col.accent = G.css('--w2');
  }
  readColors();
  G.onTheme(function () { readColors(); draw(); });

  let ghosts, pl, mode = 'chase', focus = 0, caughtBy = -1, caughtT = 0;
  const bugEl = G.$('#gh-bug');
  function reset() {
    ghosts = START.map((s, i) => ({ x: s[0], y: s[1], dir: s[2], i: i }));
    pl = { x: 2, y: 5, dir: 'left' };
    caughtBy = -1;
    syncDpad();
  }
  function rawColor(i) { return G.PAL[GHOST[i].pal].pal.b; }

  function targetOf(i) {
    const g = ghosts[i], f = DIRS[pl.dir], bug = bugEl && bugEl.checked;
    if (mode === 'scatter') return SCATTER[i];
    if (i === 0) return [pl.x, pl.y];
    if (i === 1) {
      let tx = pl.x + 4 * f[0], ty = pl.y + 4 * f[1];
      if (bug && pl.dir === 'up') tx -= 4;
      return [tx, ty];
    }
    if (i === 2) {
      const p = pivot(), b = ghosts[0];
      return [2 * p[0] - b.x, 2 * p[1] - b.y];
    }
    return Math.hypot(g.x - pl.x, g.y - pl.y) > 8 ? [pl.x, pl.y] : SCATTER[3];
  }
  function pivot() {
    const f = DIRS[pl.dir], bug = bugEl && bugEl.checked;
    let px = pl.x + 2 * f[0], py = pl.y + 2 * f[1];
    if (bug && pl.dir === 'up') px -= 2;
    return [px, py];
  }
  function choose(g) {
    let opts = ORDER.filter(d => d !== REV[g.dir] && !isWall(g.x + DIRS[d][0], g.y + DIRS[d][1]));
    if (!opts.length) opts = [REV[g.dir]];
    if (mode === 'fright') return { dir: opts[Math.floor(Math.random() * opts.length)], opts: opts, dists: null, target: null };
    const t = targetOf(g.i), dists = {};
    let best = null, bd = Infinity;
    for (const d of opts) {
      const nx = g.x + DIRS[d][0], ny = g.y + DIRS[d][1];
      const dd = (nx - t[0]) * (nx - t[0]) + (ny - t[1]) * (ny - t[1]);
      dists[d] = Math.sqrt(dd);
      if (dd < bd - 1e-9) { bd = dd; best = d; }
    }
    return { dir: best, opts: opts, dists: dists, target: t };
  }
  function step() {
    const picks = ghosts.map(choose);
    ghosts.forEach((g, i) => { g.dir = picks[i].dir; g.x += DIRS[g.dir][0]; g.y += DIRS[g.dir][1]; });
    const hit = ghosts.findIndex(g => g.x === pl.x && g.y === pl.y);
    if (hit >= 0) { caughtBy = hit; caughtT = performance.now(); }
    draw();
  }

  /* ---------- 绘制 ---------- */
  const cx = x => x * T + T / 2, cy = y => y * T + T / 2;
  function drawGhost(g) {
    const px = 2, sx = g.x * T + (T - 28) / 2, sy = g.y * T + (T - 28) / 2;
    const body = mode === 'fright' ? '#2448d8' : rawColor(g.i);
    G.drawSprite(ctx, 'ghost', sx, sy, px, null, { b: body, w: body, p: body });
    const f = DIRS[g.dir];
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx + 2 * px, sy + 3 * px, 4 * px, 5 * px);
    ctx.fillRect(sx + 8 * px, sy + 3 * px, 4 * px, 5 * px);
    ctx.fillStyle = mode === 'fright' ? '#ffd0d0' : '#2553d6';
    ctx.fillRect(sx + 3 * px + f[0] * px, sy + 4.5 * px + f[1] * px, 2 * px, 2 * px);
    ctx.fillRect(sx + 9 * px + f[0] * px, sy + 4.5 * px + f[1] * px, 2 * px, 2 * px);
  }
  function xMark(x, y, color, size) {
    ctx.strokeStyle = col.surface; ctx.lineWidth = 6; ctx.beginPath();
    ctx.moveTo(x - size, y - size); ctx.lineTo(x + size, y + size); ctx.moveTo(x + size, y - size); ctx.lineTo(x - size, y + size); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  }
  function draw() {
    if (!ghosts) return;
    ctx.fillStyle = col.surface; ctx.fillRect(0, 0, W, H);
    // 走廊格线
    ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 1; x < COLS; x++) { ctx.moveTo(x * T + 0.5, 0); ctx.lineTo(x * T + 0.5, H); }
    for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * T + 0.5); ctx.lineTo(W, y * T + 0.5); }
    ctx.stroke();
    // 墙：填充 + 只描外轮廓
    ctx.fillStyle = col.s2;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (MAP[y][x] === '#') ctx.fillRect(x * T, y * T, T, T);
    ctx.strokeStyle = col.border; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (MAP[y][x] !== '#') continue;
      const X = x * T, Y = y * T;
      if (!isWall(x, y - 1) && y > 0) { ctx.moveTo(X, Y); ctx.lineTo(X + T, Y); }
      if (!isWall(x, y + 1) && y < ROWS - 1) { ctx.moveTo(X, Y + T); ctx.lineTo(X + T, Y + T); }
      if (!isWall(x - 1, y) && x > 0) { ctx.moveTo(X, Y); ctx.lineTo(X, Y + T); }
      if (!isWall(x + 1, y) && x < COLS - 1) { ctx.moveTo(X + T, Y); ctx.lineTo(X + T, Y + T); }
    }
    ctx.stroke();

    const picks = ghosts.map(choose);
    // 目标连线与目标格
    if (mode !== 'fright') {
      picks.forEach((p, i) => {
        const g = ghosts[i], color = rawColor(i), tx = cx(p.target[0]), ty = cy(p.target[1]);
        const vx = G.clamp(tx, 10, W - 10), vy = G.clamp(ty, 10, H - 10);
        ctx.save(); ctx.globalAlpha = i === focus ? 1 : 0.55; ctx.setLineDash([6, 5]);
        ctx.strokeStyle = color; ctx.lineWidth = i === focus ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(cx(g.x), cy(g.y)); ctx.lineTo(vx, vy); ctx.stroke(); ctx.restore();
        xMark(vx, vy, color, i === focus ? 9 : 7);
      });
    }
    // 聚焦鬼的推理过程
    const fg = ghosts[focus], fp = picks[focus];
    if (mode !== 'fright') {
      if (focus === 2) {
        const pv = pivot(), b = ghosts[0];
        ctx.save(); ctx.strokeStyle = col.ink2; ctx.lineWidth = 1.5; ctx.beginPath();
        ctx.moveTo(cx(b.x), cy(b.y)); ctx.lineTo(cx(pv[0]), cy(pv[1])); ctx.stroke();
        ctx.fillStyle = col.ink; ctx.beginPath(); ctx.arc(cx(pv[0]), cy(pv[1]), 5, 0, Math.PI * 2); ctx.fill();
        ctx.font = '700 11px "Noto Sans SC", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('支点', cx(pv[0]) + 7, cy(pv[1]) - 3); ctx.restore();
      }
      if (focus === 3) {
        ctx.save(); ctx.strokeStyle = rawColor(3); ctx.globalAlpha = 0.8; ctx.lineWidth = 2; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.arc(cx(fg.x), cy(fg.y), 8 * T, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
    }
    // 玩家
    ctx.fillStyle = col.green; ctx.beginPath(); ctx.arc(cx(pl.x), cy(pl.y), 11, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = col.border; ctx.stroke();
    const f = DIRS[pl.dir];
    ctx.fillStyle = col.border; ctx.beginPath();
    const ax = cx(pl.x) + f[0] * 17, ay = cy(pl.y) + f[1] * 17;
    ctx.moveTo(ax + f[0] * 6, ay + f[1] * 6); ctx.lineTo(ax - f[1] * 6, ay + f[0] * 6); ctx.lineTo(ax + f[1] * 6, ay - f[0] * 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.font = '700 11px "Noto Sans SC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('你', cx(pl.x), cy(pl.y) + 1);
    // 鬼
    ghosts.forEach(drawGhost);
    // 聚焦鬼的候选方向
    ctx.font = '700 12px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ORDER.forEach(d => {
      const nx = fg.x + DIRS[d][0], ny = fg.y + DIRS[d][1];
      if (isWall(nx, ny)) return;
      const X = cx(nx), Y = cy(ny);
      if (fp.opts.indexOf(d) < 0) {
        ctx.fillStyle = col.surface; ctx.fillRect(X - 15, Y - 9, 30, 18);
        ctx.strokeStyle = col.line; ctx.lineWidth = 1.5; ctx.strokeRect(X - 15, Y - 9, 30, 18);
        ctx.fillStyle = col.ink2; ctx.fillText('掉头✕', X, Y + 1);
        return;
      }
      const chosen = d === fp.dir;
      const label = fp.dists ? fp.dists[d].toFixed(1) : '随机';
      const w = Math.max(30, ctx.measureText(label).width + 12);
      ctx.fillStyle = chosen ? col.accent : col.surface; ctx.fillRect(X - w / 2, Y - 10, w, 20);
      ctx.strokeStyle = col.border; ctx.lineWidth = chosen ? 2.5 : 1.5; ctx.strokeRect(X - w / 2, Y - 10, w, 20);
      ctx.fillStyle = chosen ? G.css('--on-w2') : col.ink; ctx.fillText(label, X, Y + 1);
    });
    if (caughtBy >= 0 && performance.now() - caughtT < 1600) {
      G.bubble(ctx, cx(pl.x), cy(pl.y) - 14, '被' + GHOST[caughtBy].name + '抓到了！', { bg: col.surface, fg: col.ink, border: col.border, maxX: W });
    }
  }

  /* ---------- 交互 ---------- */
  const modeLbl = G.$('#gh-mode-lbl');
  const MODE_LBL = { chase: 'MODE · CHASE 追击', scatter: 'MODE · SCATTER 分散', fright: 'MODE · FRIGHTENED 受惊' };
  G.$$('#gh-mode button').forEach(b => b.addEventListener('click', () => {
    const m = b.getAttribute('data-m');
    if (m === mode) return;
    mode = m;
    ghosts.forEach(g => { if (!isWall(g.x + DIRS[REV[g.dir]][0], g.y + DIRS[REV[g.dir]][1])) g.dir = REV[g.dir]; });
    G.$$('#gh-mode button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    modeLbl.textContent = MODE_LBL[mode];
    draw();
  }));
  function syncDpad() {
    G.$$('#gh-dpad button').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-d') === pl.dir)));
  }
  G.$$('#gh-dpad button').forEach(b => b.addEventListener('click', () => { pl.dir = b.getAttribute('data-d'); syncDpad(); draw(); }));
  G.$$('#gh-legend .gl').forEach(b => b.addEventListener('click', () => {
    focus = +b.getAttribute('data-g');
    G.$$('#gh-legend .gl').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    draw();
  }));
  cv.addEventListener('pointerdown', e => {
    const p = C.toLocal(e), x = Math.floor(p.x / T), y = Math.floor(p.y / T);
    if (!isWall(x, y)) { pl.x = x; pl.y = y; caughtBy = -1; draw(); }
  });
  const KEY = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  cv.addEventListener('keydown', e => {
    const d = KEY[e.code];
    if (d) { e.preventDefault(); pl.dir = d; syncDpad(); draw(); }
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); step(); }
  });
  if (bugEl) bugEl.addEventListener('change', draw);
  G.$('#gh-step').addEventListener('click', step);
  G.$('#gh-reset').addEventListener('click', () => { reset(); draw(); });
  let auto = false, timer = 0, visible = false;
  const autoBtn = G.$('#gh-auto');
  new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; }, { threshold: 0.1 }).observe(cv);
  function autoLoop() { if (!auto) return; if (visible) step(); timer = setTimeout(autoLoop, 420); }
  autoBtn.addEventListener('click', () => {
    auto = !auto;
    autoBtn.setAttribute('aria-pressed', String(auto));
    autoBtn.textContent = auto ? '停止' : '自动走';
    clearTimeout(timer);
    if (auto) autoLoop();
  });

  reset();
  G.ready.then(draw);
})();
