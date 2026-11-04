/* 1-1 潜入演示：守卫的状态机决定「做什么」，网格 A* 负责「怎么走」 */
(function () {
  'use strict';
  const cv = G.$('#fsm-cv');
  if (!cv) return;
  const W = 720, H = 420, CELL = 20, COLS = W / CELL, ROWS = H / CELL;
  const WALLS = [
    { x: 150, y: 70, w: 40, h: 170 },
    { x: 330, y: 0, w: 30, h: 140 },
    { x: 330, y: 280, w: 30, h: 140 },
    { x: 480, y: 110, w: 130, h: 40 },
    { x: 520, y: 270, w: 70, h: 70 },
    { x: 50, y: 310, w: 80, h: 50 },
    { x: 220, y: 330, w: 50, h: 40 }
  ];
  const ROUTE = [[250, 60], [420, 210], [650, 60], [650, 380], [430, 380], [250, 250]];
  const PLAYER_START = { x: 70, y: 120 };
  const FOV = 0.6, RANGE = 210, HEAR = 280, GR = 11, PR = 9, PSPEED = 200;
  const SPEED = { PATROL: 62, SUSP: 58, CHASE: 128, SEARCH: 88 };
  const NAMES = { PATROL: '巡逻', SUSP: '怀疑', CHASE: '追击', SEARCH: '搜索', CAUGHT: '抓获' };

  const C = G.canvas(cv, W, H, draw);
  const ctx = C.ctx;
  cv.tabIndex = 0;
  const svg = G.$('#fsm-svg'), logEl = G.$('#fsm-log'), clockEl = G.$('#fsm-clock'), dbgEl = G.$('#fsm-debug');
  const col = {};
  function readColors() {
    col.bg = G.css('--surface-2'); col.surface = G.css('--surface'); col.line = G.css('--line'); col.ink = G.css('--ink');
    col.ink2 = G.css('--ink-2'); col.border = G.css('--border'); col.red = G.css('--w1'); col.yellow = G.css('--w2');
    col.blue = G.css('--w3'); col.green = G.css('--w4');
  }
  readColors();
  G.onTheme(function () { readColors(); draw(); });

  /* ---------- 导航网格 ---------- */
  const blockedArr = new Uint8Array(COLS * ROWS);
  for (let cy = 0; cy < ROWS; cy++) {
    for (let cx = 0; cx < COLS; cx++) {
      const x = cx * CELL, y = cy * CELL;
      blockedArr[cy * COLS + cx] = WALLS.some(w => x < w.x + w.w + 10 && x + CELL > w.x - 10 && y < w.y + w.h + 10 && y + CELL > w.y - 10) ? 1 : 0;
    }
  }
  const blocked = i => blockedArr[i] === 1;
  const cellOf = (x, y) => [G.clamp(Math.floor(x / CELL), 0, COLS - 1), G.clamp(Math.floor(y / CELL), 0, ROWS - 1)];
  function nearestFree(c) {
    const cx = c[0], cy = c[1];
    if (!blocked(cy * COLS + cx)) return c;
    for (let r = 1; r < 10; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= COLS || y >= ROWS) continue;
          if (!blocked(y * COLS + x)) return [x, y];
        }
      }
    }
    return c;
  }
  const INFL = WALLS.map(w => ({ x: w.x - 9, y: w.y - 9, w: w.w + 18, h: w.h + 18 }));
  const clearLine = (x1, y1, x2, y2) => !INFL.some(r => G.segRect(x1, y1, x2, y2, r));
  const normAngle = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  /* ---------- 角色 ---------- */
  const gd = { x: 250, y: 60, a: Math.PI / 2, state: 'PATROL', t: 0, wp: 1, path: [], goalKey: '', repath: 0, arrived: false,
    meter: 0, target: null, lastSeen: null, lostT: 0, lookT: 0, lookBase: 0, say: '', sayT: 0 };
  const pl = { x: PLAYER_START.x, y: PLAYER_START.y, tx: null, ty: null };
  const keys = {};
  const rings = [];
  let clock = 0, caughtT = 0, lastTenth = -1, hotTimer = 0;
  let dragging = false, pending = false, downAt = 0, downX = 0, downY = 0, downLocal = null;

  function say(t, d) { gd.say = t; gd.sayT = d || 2.4; }
  function stamp() { return clock.toFixed(1).padStart(5, '0'); }
  function log(text) {
    const li = document.createElement('li');
    const tm = document.createElement('time');
    tm.textContent = stamp();
    li.appendChild(tm);
    li.appendChild(document.createTextNode(text));
    logEl.insertBefore(li, logEl.firstChild);
    while (logEl.children.length > 7) logEl.removeChild(logEl.lastChild);
  }
  function lightEdge(prev, next) {
    G.$$('.ed.hot, .el.hot', svg).forEach(n => {
      n.classList.remove('hot');
      if (n.tagName.toLowerCase() === 'path') n.setAttribute('marker-end', 'url(#ah)');
    });
    const e = G.$('#e-' + prev + '-' + next);
    if (!e) return;
    const lbl = e.nextElementSibling;
    e.classList.add('hot'); e.setAttribute('marker-end', 'url(#ah-hot)');
    if (lbl) lbl.classList.add('hot');
    clearTimeout(hotTimer);
    hotTimer = setTimeout(() => {
      e.classList.remove('hot'); e.setAttribute('marker-end', 'url(#ah)');
      if (lbl) lbl.classList.remove('hot');
    }, 1800);
  }
  function setState(next, reason, line) {
    const prev = gd.state;
    if (prev === next) return;
    gd.state = next; gd.t = 0; gd.lookT = 0; gd.path = []; gd.goalKey = ''; gd.lostT = 0; gd.arrived = false;
    if (line) say(line);
    G.$$('.st', svg).forEach(n => n.classList.toggle('on', n.id === 's-' + next));
    lightEdge(prev, next);
    log(NAMES[prev] + ' → ' + NAMES[next] + '：' + reason);
  }

  function turnTo(target, maxStep) { gd.a += G.clamp(normAngle(target - gd.a), -maxStep, maxStep); }

  /* 走向目标：直线能走就直线，不能就跑网格 A*，再沿途「拉直」 */
  function goTo(tx, ty, speed, dt) {
    const d = G.dist(gd.x, gd.y, tx, ty);
    gd.arrived = d < 14;
    if (gd.arrived) return;
    let wx = tx, wy = ty;
    if (!clearLine(gd.x, gd.y, tx, ty)) {
      const goal = nearestFree(cellOf(tx, ty));
      const key = goal[0] + ',' + goal[1];
      if (key !== gd.goalKey || gd.repath <= 0 || !gd.path.length) {
        const s = nearestFree(cellOf(gd.x, gd.y));
        const p = G.gridPath(COLS, ROWS, blocked, s[0], s[1], goal[0], goal[1]);
        gd.path = p ? p.map(c => [c[0] * CELL + CELL / 2, c[1] * CELL + CELL / 2]) : [];
        gd.goalKey = key; gd.repath = 0.6;
      }
      while (gd.path.length > 1 && clearLine(gd.x, gd.y, gd.path[1][0], gd.path[1][1])) gd.path.shift();
      if (gd.path.length > 1 && G.dist(gd.x, gd.y, gd.path[0][0], gd.path[0][1]) < 4) gd.path.shift();
      if (gd.path.length) {
        wx = gd.path[0][0]; wy = gd.path[0][1];
        if (gd.path.length === 1 && G.dist(gd.x, gd.y, wx, wy) < 5) { gd.arrived = true; return; }
      } else { gd.arrived = true; return; }
    } else {
      gd.path = [];
    }
    const dx = wx - gd.x, dy = wy - gd.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
    const step = Math.min(dd, speed * dt);
    gd.x += dx / dd * step; gd.y += dy / dd * step;
    turnTo(Math.atan2(dy, dx), dt * 7);
  }

  function canSee() {
    const dx = pl.x - gd.x, dy = pl.y - gd.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > RANGE) return false;
    if (d > 36 && Math.abs(normAngle(Math.atan2(dy, dx) - gd.a)) > FOV) return false;
    return !WALLS.some(w => G.segRect(gd.x, gd.y, pl.x, pl.y, w));
  }

  function noise(x, y, who) {
    rings.push({ x: x, y: y, t: 0 });
    const d = G.dist(x, y, gd.x, gd.y);
    if (d > HEAR) { log('（' + (who || '石子落地') + '，守卫离得太远，没听见）'); return; }
    if (gd.state === 'PATROL') { gd.target = { x: x, y: y }; setState('SUSP', '听到声音', '什么声音？'); }
    else if (gd.state === 'SUSP') { gd.target = { x: x, y: y }; gd.lookT = 0; gd.t = 0; say('又来了？'); log('怀疑：又听到声音，换个地方查'); }
    else if (gd.state === 'SEARCH') { gd.lastSeen = { x: x, y: y }; gd.lookT = 0; gd.t = 0; say('在那边！'); log('搜索：听到声音，改去那边'); }
  }

  function resolvePlayer() {
    pl.x = G.clamp(pl.x, PR, W - PR); pl.y = G.clamp(pl.y, PR, H - PR);
    for (const w of WALLS) {
      const nx = G.clamp(pl.x, w.x, w.x + w.w), ny = G.clamp(pl.y, w.y, w.y + w.h);
      const dx = pl.x - nx, dy = pl.y - ny, d2 = dx * dx + dy * dy;
      if (d2 >= PR * PR) continue;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pl.x = nx + dx / d * PR; pl.y = ny + dy / d * PR;
      } else {
        const l = pl.x - w.x, r = w.x + w.w - pl.x, t = pl.y - w.y, b = w.y + w.h - pl.y, m = Math.min(l, r, t, b);
        if (m === l) pl.x = w.x - PR; else if (m === r) pl.x = w.x + w.w + PR; else if (m === t) pl.y = w.y - PR; else pl.y = w.y + w.h + PR;
      }
    }
  }
  function movePlayer(dt) {
    let vx = 0, vy = 0;
    if (keys.left) vx -= 1;
    if (keys.right) vx += 1;
    if (keys.up) vy -= 1;
    if (keys.down) vy += 1;
    if (vx || vy) {
      const l = Math.hypot(vx, vy);
      vx = vx / l * PSPEED * dt; vy = vy / l * PSPEED * dt;
    } else if (dragging && !pending && pl.tx != null) {
      const dx = pl.tx - pl.x, dy = pl.ty - pl.y, d = Math.hypot(dx, dy);
      if (d > 1) { const st = Math.min(d, PSPEED * dt); vx = dx / d * st; vy = dy / d * st; }
    }
    pl.x += vx; resolvePlayer();
    pl.y += vy; resolvePlayer();
  }

  function update(dt) {
    clock += dt;
    gd.t += dt; gd.repath -= dt;
    if (gd.sayT > 0) gd.sayT -= dt;
    if (dragging && pending && performance.now() - downAt > 180) pending = false;
    movePlayer(dt);
    rings.forEach(r => { r.t += dt; });
    while (rings.length && rings[0].t > 0.9) rings.shift();
    const tenth = Math.floor(clock * 10);
    if (clockEl && tenth !== lastTenth) { lastTenth = tenth; clockEl.textContent = 'T+' + clock.toFixed(1).padStart(5, '0') + 's'; }

    if (gd.state === 'CAUGHT') {
      caughtT += dt;
      if (caughtT > 1.7) {
        pl.x = PLAYER_START.x; pl.y = PLAYER_START.y; pl.tx = pl.ty = null; gd.meter = 0;
        setState('PATROL', '重置', '回去站岗');
      }
      return;
    }
    const vis = canSee();
    const d = G.dist(gd.x, gd.y, pl.x, pl.y);
    const alert = gd.state === 'SEARCH' || gd.state === 'SUSP';
    if (vis) gd.meter = Math.min(1, gd.meter + dt * (alert ? 1.5 : 1) * (0.5 + 1.7 * (1 - d / RANGE)));
    else if (gd.state !== 'CHASE') gd.meter = Math.max(0, gd.meter - dt * 0.28);

    switch (gd.state) {
      case 'PATROL': {
        const wp = ROUTE[gd.wp];
        goTo(wp[0], wp[1], SPEED.PATROL, dt);
        if (gd.arrived) gd.wp = (gd.wp + 1) % ROUTE.length;
        if (vis && gd.meter >= 0.22) { gd.target = { x: pl.x, y: pl.y }; setState('SUSP', '瞥见了什么', '嗯？那是什么？'); }
        break;
      }
      case 'SUSP': {
        if (vis) {
          gd.target = { x: pl.x, y: pl.y };
          if (gd.lookT > 0 && G.dist(gd.x, gd.y, pl.x, pl.y) > 30) gd.lookT = 0;
        }
        if (gd.meter >= 1) { gd.lastSeen = { x: pl.x, y: pl.y }; setState('CHASE', '看清了', '站住！'); break; }
        if (gd.lookT > 0) {
          gd.lookT += dt; gd.a = gd.lookBase + Math.sin(gd.lookT * 2.4) * 1.1;
          if (gd.lookT > 2.6 && gd.meter < 0.2) setState('PATROL', '查无此人', G.pick(['一定是风吧……', '大概是猫吧', '我眼花了']));
        } else {
          goTo(gd.target.x, gd.target.y, SPEED.SUSP, dt);
          if (gd.arrived) { gd.lookT = 1e-4; gd.lookBase = gd.a; }
        }
        if (gd.state === 'SUSP' && gd.t > 12) setState('PATROL', '查无此人', '一定是风吧……');
        break;
      }
      case 'CHASE': {
        if (vis) { gd.lastSeen = { x: pl.x, y: pl.y }; gd.lostT = 0; }
        else gd.lostT += dt;
        goTo(gd.lastSeen.x, gd.lastSeen.y, SPEED.CHASE, dt);
        if (d < GR + PR + 2) { caughtT = 0; setState('CAUGHT', '贴脸', '抓到你了！'); break; }
        if (gd.lostT > 1.0) setState('SEARCH', '跟丢了', '人呢？给我搜！');
        break;
      }
      case 'SEARCH': {
        if (vis && gd.meter >= 0.55) { gd.lastSeen = { x: pl.x, y: pl.y }; setState('CHASE', '又看见了', '在那儿！'); break; }
        if (gd.lookT > 0) {
          gd.lookT += dt; gd.a = gd.lookBase + Math.sin(gd.lookT * 2.0) * 1.4;
          if (gd.lookT > 3.4) setState('PATROL', '超时', G.pick(['算了，回去摸鱼', '一定是风吧……', '下班再说']));
        } else {
          goTo(gd.lastSeen.x, gd.lastSeen.y, SPEED.SEARCH, dt);
          if (gd.arrived) { gd.lookT = 1e-4; gd.lookBase = gd.a; }
        }
        if (gd.state === 'SEARCH' && gd.t > 14) setState('PATROL', '超时', '算了，回去摸鱼');
        break;
      }
    }
    gd.x = G.clamp(gd.x, GR, W - GR); gd.y = G.clamp(gd.y, GR, H - GR);
  }

  /* ---------- 绘制 ---------- */
  function stateColor() {
    return { PATROL: col.green, SUSP: col.yellow, CHASE: col.red, SEARCH: col.blue, CAUGHT: col.red }[gd.state];
  }
  function draw() {
    const dbg = !dbgEl || dbgEl.checked;
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H);
    if (dbg) {
      ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = CELL; x < W; x += CELL) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
      for (let y = CELL; y < H; y += CELL) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
      ctx.stroke();
      ctx.fillStyle = col.ink; ctx.globalAlpha = 0.05;
      for (let i = 0; i < blockedArr.length; i++) if (blockedArr[i]) ctx.fillRect((i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL);
      ctx.globalAlpha = 1;
      ctx.font = '700 11px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ROUTE.forEach((p, i) => {
        ctx.strokeStyle = col.ink2; ctx.lineWidth = 1.5; ctx.fillStyle = col.surface;
        ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col.ink2; ctx.fillText(String(i + 1), p[0], p[1] + 1);
      });
      ctx.save(); ctx.strokeStyle = col.ink2; ctx.globalAlpha = 0.3; ctx.setLineDash([3, 5]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(gd.x, gd.y, HEAR, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    // 墙与箱子
    for (const w of WALLS) {
      ctx.fillStyle = col.surface; ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.save(); ctx.beginPath(); ctx.rect(w.x, w.y, w.w, w.h); ctx.clip();
      ctx.strokeStyle = col.line; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = -w.h; k < w.w; k += 12) { ctx.moveTo(w.x + k, w.y + w.h); ctx.lineTo(w.x + k + w.h, w.y); }
      ctx.stroke(); ctx.restore();
      ctx.strokeStyle = col.border; ctx.lineWidth = 2; ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
    }
    // 视野锥（射线被墙截断）
    const sc = stateColor();
    const RAYS = 44;
    ctx.beginPath(); ctx.moveTo(gd.x, gd.y);
    for (let i = 0; i <= RAYS; i++) {
      const ang = gd.a - FOV + (2 * FOV) * i / RAYS, dx = Math.cos(ang), dy = Math.sin(ang);
      let t = RANGE;
      for (const w of WALLS) { const tt = G.rayRect(gd.x, gd.y, dx, dy, w); if (tt < t) t = tt; }
      ctx.lineTo(gd.x + dx * t, gd.y + dy * t);
    }
    ctx.closePath();
    ctx.fillStyle = sc; ctx.globalAlpha = 0.2; ctx.fill();
    ctx.globalAlpha = 0.75; ctx.strokeStyle = sc; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1;
    // 当前路径
    if (dbg && gd.path.length) {
      ctx.save(); ctx.strokeStyle = col.ink; ctx.globalAlpha = 0.6; ctx.setLineDash([2, 4]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(gd.x, gd.y); gd.path.forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke(); ctx.restore();
    }
    // 目标标记
    ctx.font = '700 16px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (gd.state === 'SUSP' && gd.target) {
      ctx.strokeStyle = col.yellow; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(gd.target.x, gd.target.y, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = col.ink; ctx.fillText('?', gd.target.x, gd.target.y + 1);
    }
    if ((gd.state === 'SEARCH' || gd.state === 'CHASE') && gd.lastSeen && gd.lostT > 0) {
      const p = gd.lastSeen; ctx.strokeStyle = col.blue; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p.x - 7, p.y - 7); ctx.lineTo(p.x + 7, p.y + 7); ctx.moveTo(p.x + 7, p.y - 7); ctx.lineTo(p.x - 7, p.y + 7); ctx.stroke();
    }
    // 噪音波纹
    rings.forEach(r => {
      ctx.strokeStyle = col.ink; ctx.globalAlpha = Math.max(0, 0.8 - r.t); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(r.x, r.y, 8 + r.t * 90, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(r.x, r.y, 3, 0, Math.PI * 2); ctx.fillStyle = col.ink; ctx.fill();
    });
    ctx.globalAlpha = 1;
    // 玩家
    if (dragging && !pending && pl.tx != null) {
      ctx.strokeStyle = col.green; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pl.tx, pl.ty, 6, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = col.green; ctx.beginPath(); ctx.arc(pl.x, pl.y, PR, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = col.border; ctx.stroke();
    ctx.font = '700 12px "Noto Sans SC", sans-serif'; ctx.fillStyle = col.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('你', pl.x, pl.y - PR - 5);
    // 守卫
    ctx.save(); ctx.translate(gd.x, gd.y); ctx.rotate(gd.a);
    ctx.fillStyle = '#6f8a52'; ctx.beginPath(); ctx.arc(0, 0, GR, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = col.border; ctx.stroke();
    ctx.fillStyle = '#4b5e37'; ctx.beginPath(); ctx.arc(-2, 0, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col.border; ctx.beginPath(); ctx.moveTo(GR + 6, 0); ctx.lineTo(GR - 1, -5); ctx.lineTo(GR - 1, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
    // 警觉条
    const bx = gd.x - 18, by = gd.y - GR - 14;
    if (gd.meter > 0 || gd.state !== 'PATROL') {
      ctx.fillStyle = col.surface; ctx.fillRect(bx, by, 36, 6);
      ctx.fillStyle = gd.meter >= 1 ? col.red : col.yellow; ctx.fillRect(bx, by, 36 * gd.meter, 6);
      ctx.strokeStyle = col.border; ctx.lineWidth = 1.5; ctx.strokeRect(bx, by, 36, 6);
    }
    let icon = '';
    if (gd.state === 'SUSP' || gd.state === 'SEARCH') icon = '?';
    else if (gd.state === 'CHASE') icon = '!';
    else if (gd.state === 'CAUGHT') icon = '!!';
    let top = by - 4;
    if (icon) {
      ctx.font = '700 22px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 4; ctx.strokeStyle = col.surface; ctx.strokeText(icon, gd.x, top);
      ctx.fillStyle = icon === '?' ? col.ink : col.red; ctx.fillText(icon, gd.x, top);
      top -= 20;
    }
    if (gd.sayT > 0 && gd.say) G.bubble(ctx, gd.x, top, gd.say, { bg: col.surface, fg: col.ink, border: col.border, maxX: W });
    if (dbg) {
      ctx.font = '600 11px "JetBrains Mono", ui-monospace, monospace'; ctx.fillStyle = col.ink2; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(gd.state + ' · 警觉 ' + Math.round(gd.meter * 100) + '%', gd.x, gd.y + GR + 6);
    }
    if (gd.state === 'CAUGHT') {
      ctx.strokeStyle = col.red; ctx.globalAlpha = 0.85 * Math.max(0, 1 - caughtT / 1.7); ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, W - 10, H - 10); ctx.globalAlpha = 1;
    }
  }

  /* ---------- 输入 ---------- */
  cv.addEventListener('pointerdown', e => {
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    dragging = true; pending = true; downAt = performance.now(); downX = e.clientX; downY = e.clientY;
    downLocal = C.toLocal(e); pl.tx = downLocal.x; pl.ty = downLocal.y;
  });
  cv.addEventListener('pointermove', e => {
    if (!dragging) return;
    const p = C.toLocal(e); pl.tx = p.x; pl.ty = p.y;
    if (pending && Math.hypot(e.clientX - downX, e.clientY - downY) > 6) pending = false;
  });
  cv.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    if (pending && performance.now() - downAt < 300 && downLocal) noise(downLocal.x, downLocal.y, '石子落地');
    pending = false;
  });
  cv.addEventListener('pointercancel', () => { dragging = false; pending = false; });
  const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  cv.addEventListener('keydown', e => {
    const k = KEYMAP[e.code];
    if (k) { keys[k] = true; e.preventDefault(); }
    if (e.code === 'Space') { e.preventDefault(); noise(pl.x, pl.y, '你咳嗽了一声'); }
  });
  cv.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
  cv.addEventListener('blur', () => { Object.keys(keys).forEach(k => { keys[k] = false; }); });

  function reset() {
    Object.assign(gd, { x: 250, y: 60, a: Math.PI / 2, state: 'PATROL', t: 0, wp: 1, path: [], goalKey: '', meter: 0,
      target: null, lastSeen: null, lostT: 0, lookT: 0, say: '', sayT: 0, arrived: false });
    pl.x = PLAYER_START.x; pl.y = PLAYER_START.y; pl.tx = pl.ty = null;
    rings.length = 0; clock = 0; lastTenth = -1;
    G.$$('.st', svg).forEach(n => n.classList.toggle('on', n.id === 's-PATROL'));
    logEl.innerHTML = '';
    log('巡逻：开始上班');
    draw();
  }
  G.$('#fsm-cough').addEventListener('click', () => noise(pl.x, pl.y, '你咳嗽了一声'));
  G.$('#fsm-reset').addEventListener('click', reset);
  if (dbgEl) dbgEl.addEventListener('change', draw);

  G.ready.then(draw);
  G.loop(cv, function (dt) { update(dt); draw(); });
})();
