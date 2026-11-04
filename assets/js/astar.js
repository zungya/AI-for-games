/* 3-1 寻路算法对决：BFS / Dijkstra / 贪心最佳优先 / A*，可画墙和沼泽 */
(function () {
  'use strict';
  const cv = G.$('#as-cv');
  if (!cv) return;
  const COLS = 30, ROWS = 16, CELL = 26, W = COLS * CELL, H = ROWS * CELL, SWAMP = 5;
  const C = G.canvas(cv, W, H, draw);
  const ctx = C.ctx;
  const wall = new Uint8Array(COLS * ROWS), swamp = new Uint8Array(COLS * ROWS);
  let start = [4, 8], goal = [25, 8];
  let algo = 'astar', tool = 'wall', view = null, gen = null, running = false;
  const NAMES = { bfs: 'BFS', dijkstra: 'Dijkstra', greedy: '贪心最佳优先', astar: 'A*' };
  const col = {};
  function readColors() {
    const sec = G.$('#astar');
    col.surface = G.css('--surface'); col.s2 = G.css('--surface-2'); col.line = G.css('--line'); col.ink = G.css('--ink');
    col.border = G.css('--border'); col.accent = G.css('--accent', sec); col.yellow = G.css('--w2');
  }
  readColors();
  G.onTheme(function () { readColors(); draw(); });
  const idx = (x, y) => y * COLS + x;
  const isStart = i => i === idx(start[0], start[1]);
  const isGoal = i => i === idx(goal[0], goal[1]);

  /* ---------- 搜索（生成器，每展开一个节点 yield 一次） ---------- */
  function* search(kind) {
    const N = COLS * ROWS, s = idx(start[0], start[1]), t = idx(goal[0], goal[1]);
    const g = new Float64Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), st = new Uint8Array(N);
    const heap = [];
    let seq = 0, expanded = 0;
    const h = i => Math.abs((i % COLS) - goal[0]) + Math.abs(Math.floor(i / COLS) - goal[1]);
    const less = (a, b) => a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];
    function push(item) {
      heap.push(item);
      let k = heap.length - 1;
      while (k > 0) { const p = (k - 1) >> 1; if (!less(heap[k], heap[p])) break; [heap[k], heap[p]] = [heap[p], heap[k]]; k = p; }
    }
    function pop() {
      const top = heap[0], end = heap.pop();
      if (heap.length) {
        heap[0] = end; let k = 0;
        for (;;) {
          const l = 2 * k + 1, r = l + 1; let m = k;
          if (l < heap.length && less(heap[l], heap[m])) m = l;
          if (r < heap.length && less(heap[r], heap[m])) m = r;
          if (m === k) break;
          [heap[k], heap[m]] = [heap[m], heap[k]]; k = m;
        }
      }
      return top;
    }
    const key = i => kind === 'greedy' ? [h(i), 0, seq++, i] : kind === 'astar' ? [g[i] + h(i), h(i), seq++, i] : [g[i], 0, seq++, i];
    g[s] = 0; st[s] = 1; push(key(s));
    let found = false;
    while (heap.length) {
      const cur = pop()[3];
      if (st[cur] === 2) continue;
      st[cur] = 2; expanded++;
      if (cur === t) { found = true; break; }
      const cx = cur % COLS, cy = (cur - cx) / COLS;
      const nb = [[cx, cy - 1], [cx + 1, cy], [cx, cy + 1], [cx - 1, cy]];
      for (const [nx, ny] of nb) {
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const ni = idx(nx, ny);
        if (wall[ni] || st[ni] === 2) continue;
        const step = kind === 'bfs' ? 1 : (swamp[ni] ? SWAMP : 1);
        const ng = g[cur] + step;
        if (kind === 'greedy') {
          if (st[ni] === 0) { g[ni] = ng; came[ni] = cur; st[ni] = 1; push(key(ni)); }
        } else if (ng < g[ni]) {
          g[ni] = ng; came[ni] = cur; st[ni] = 1; push(key(ni));
        }
      }
      yield { st: st, expanded: expanded, path: null };
    }
    let path = null, cost = 0;
    if (found) {
      path = [];
      for (let c = t; c !== -1; c = came[c]) { path.push(c); if (c === s) break; }
      path.reverse();
      for (let k = 1; k < path.length; k++) cost += swamp[path[k]] ? SWAMP : 1;
    }
    return { st: st, expanded: expanded, path: path, cost: cost, done: true };
  }
  function runInstant(kind) {
    const it = search(kind);
    let r = it.next();
    while (!r.done) r = it.next();
    return r.value;
  }

  /* ---------- 地图预设 ---------- */
  function clearAll() { wall.fill(0); swamp.fill(0); }
  function preset(p) {
    clearAll();
    if (p === 'trap') {
      start = [4, 8]; goal = [25, 8];
      for (let y = 3; y <= 13; y++) wall[idx(19, y)] = 1;
      for (let x = 12; x <= 19; x++) { wall[idx(x, 3)] = 1; wall[idx(x, 13)] = 1; }
    } else if (p === 'swamp') {
      start = [3, 9]; goal = [26, 9];
      for (let y = 3; y < ROWS; y++) for (let x = 12; x <= 17; x++) swamp[idx(x, y)] = 1;
    } else if (p === 'maze') {
      start = [1, 1]; goal = [27, 13];
      wall.fill(1);
      const vis = new Uint8Array(COLS * ROWS), stack = [[1, 1]];
      vis[idx(1, 1)] = 1; wall[idx(1, 1)] = 0;
      while (stack.length) {
        const [x, y] = stack[stack.length - 1];
        const nb = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => [x + dx, y + dy, x + dx / 2, y + dy / 2])
          .filter(([nx, ny]) => nx > 0 && ny > 0 && nx < COLS - 1 && ny < ROWS - 1 && !vis[idx(nx, ny)]);
        if (!nb.length) { stack.pop(); continue; }
        const [nx, ny, mx, my] = nb[Math.floor(Math.random() * nb.length)];
        vis[idx(nx, ny)] = 1; wall[idx(nx, ny)] = 0; wall[idx(mx, my)] = 0;
        stack.push([nx, ny]);
      }
      // 打通一些墙，制造环路，不同算法才有差别
      for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
        if (wall[idx(x, y)] && Math.random() < 0.12) {
          const h = !wall[idx(x - 1, y)] && !wall[idx(x + 1, y)], v = !wall[idx(x, y - 1)] && !wall[idx(x, y + 1)];
          if (h || v) wall[idx(x, y)] = 0;
        }
      }
    } else {
      start = [4, 8]; goal = [25, 8];
    }
    wall[idx(start[0], start[1])] = 0; wall[idx(goal[0], goal[1])] = 0;
    swamp[idx(start[0], start[1])] = 0; swamp[idx(goal[0], goal[1])] = 0;
    stop(); showInstant(); resetCompare();
  }

  /* ---------- 绘制 ---------- */
  function cellRect(i, color, alpha) {
    ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillStyle = color;
    ctx.fillRect((i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL);
    ctx.globalAlpha = 1;
  }
  function draw() {
    ctx.fillStyle = col.surface; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < COLS * ROWS; i++) {
      if (swamp[i]) {
        cellRect(i, '#7f8f4e', 0.55);
        const x = (i % COLS) * CELL, y = Math.floor(i / COLS) * CELL;
        ctx.fillStyle = '#4d5a2b';
        ctx.fillRect(x + 6, y + 8, 3, 3); ctx.fillRect(x + 16, y + 15, 3, 3); ctx.fillRect(x + 10, y + 19, 2, 2);
      }
    }
    if (view) {
      for (let i = 0; i < COLS * ROWS; i++) {
        if (view.st[i] === 2) cellRect(i, col.accent, 0.2);
        else if (view.st[i] === 1) cellRect(i, col.accent, 0.48);
      }
    }
    for (let i = 0; i < COLS * ROWS; i++) if (wall[i]) cellRect(i, col.border);
    ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 1; x < COLS; x++) { ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, H); }
    for (let y = 1; y < ROWS; y++) { ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(W, y * CELL + 0.5); }
    ctx.stroke();
    if (view && view.path) {
      const pts = view.path.map(i => [(i % COLS) * CELL + CELL / 2, Math.floor(i / COLS) * CELL + CELL / 2]);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = col.border; ctx.lineWidth = 9; ctx.beginPath(); pts.forEach((p, k) => k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
      ctx.strokeStyle = col.yellow; ctx.lineWidth = 5; ctx.stroke();
    }
    const px = 2, off = (CELL - 24) / 2;
    G.drawSprite(ctx, 'hero', start[0] * CELL + off, start[1] * CELL + off, px);
    G.drawSprite(ctx, 'chest', goal[0] * CELL + off, goal[1] * CELL + off + 2, px);
  }

  /* ---------- 运行与统计 ---------- */
  const $exp = G.$('#as-exp'), $len = G.$('#as-len'), $cost = G.$('#as-cost'), $status = G.$('#as-status'), $name = G.$('#as-algo-name');
  const runBtn = G.$('#as-run'), speedEl = G.$('#as-speed');
  function showStats(r) {
    $exp.textContent = G.fmt(r.expanded);
    $len.textContent = r.path ? String(r.path.length - 1) : (r.done ? '无路' : '-');
    $cost.textContent = r.path ? String(r.cost) : (r.done ? '∞' : '-');
  }
  function showInstant() {
    const r = runInstant(algo);
    view = r; showStats(r); draw();
    $status.textContent = r.path ? 'DONE' : 'NO PATH';
  }
  function stop() { running = false; gen = null; runBtn.textContent = '▶ 开始寻路'; }
  function animate() {
    stop();
    gen = search(algo); running = true; runBtn.textContent = '■ 停止';
    $status.textContent = 'SEARCHING';
  }
  G.loop(cv, function () {
    if (!running || !gen) return;
    const n = +speedEl.value;
    let r;
    for (let k = 0; k < n; k++) {
      r = gen.next();
      if (r.done) break;
    }
    view = r.value; showStats(view); draw();
    if (r.done) { stop(); $status.textContent = view.path ? 'DONE' : 'NO PATH'; }
  });
  runBtn.addEventListener('click', () => { if (running) { stop(); showInstant(); } else animate(); });

  const cmpBody = G.$('#as-cmp-t tbody');
  function resetCompare() { cmpBody.innerHTML = '<tr><td colspan="3" style="color:var(--ink-2)">点「四个一起比」</td></tr>'; }
  G.$('#as-cmp').addEventListener('click', () => {
    stop();
    const kinds = ['bfs', 'dijkstra', 'greedy', 'astar'];
    const res = kinds.map(k => ({ k: k, r: runInstant(k) }));
    const minExp = Math.min.apply(null, res.map(x => x.r.expanded));
    const minCost = Math.min.apply(null, res.filter(x => x.r.path).map(x => x.r.cost));
    cmpBody.innerHTML = res.map(x =>
      '<tr><td>' + NAMES[x.k] + '</td><td class="num">' + (x.r.expanded === minExp ? '<b>' + G.fmt(x.r.expanded) + '</b> ★' : G.fmt(x.r.expanded)) + '</td>' +
      '<td class="num">' + (x.r.path ? (x.r.cost === minCost ? '<b>' + x.r.cost + '</b> ★' : x.r.cost) : '无路') + '</td></tr>').join('');
    showInstant();
  });
  G.$$('#as-algo button').forEach(b => b.addEventListener('click', () => {
    algo = b.getAttribute('data-a');
    G.$$('#as-algo button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $name.textContent = NAMES[algo];
    stop(); showInstant();
  }));
  G.$$('#as-tool button').forEach(b => b.addEventListener('click', () => {
    tool = b.getAttribute('data-t');
    G.$$('#as-tool button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  G.$$('#as-map button').forEach(b => b.addEventListener('click', () => {
    G.$$('#as-map button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    preset(b.getAttribute('data-p'));
  }));

  /* ---------- 画笔 ---------- */
  let painting = false, paintVal = 1;
  function cellAt(e) {
    const p = C.toLocal(e);
    return [G.clamp(Math.floor(p.x / CELL), 0, COLS - 1), G.clamp(Math.floor(p.y / CELL), 0, ROWS - 1)];
  }
  function apply(c) {
    const i = idx(c[0], c[1]);
    if (tool === 'start' || tool === 'goal') {
      if (wall[i] || isStart(i) || isGoal(i)) return;
      if (tool === 'start') start = c; else goal = c;
      return;
    }
    if (isStart(i) || isGoal(i)) return;
    if (tool === 'wall') { wall[i] = paintVal; if (paintVal) swamp[i] = 0; }
    else if (tool === 'swamp') { swamp[i] = paintVal; if (paintVal) wall[i] = 0; }
    else { wall[i] = 0; swamp[i] = 0; }
  }
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    stop(); painting = true;
    const c = cellAt(e), i = idx(c[0], c[1]);
    paintVal = tool === 'wall' ? (wall[i] ? 0 : 1) : tool === 'swamp' ? (swamp[i] ? 0 : 1) : 1;
    view = null; apply(c); draw();
  });
  cv.addEventListener('pointermove', e => { if (!painting) return; apply(cellAt(e)); draw(); });
  const end = () => { if (!painting) return; painting = false; showInstant(); resetCompare(); };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);

  preset('trap');
  G.ready.then(draw);
})();
