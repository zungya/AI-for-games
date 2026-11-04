/* 标题画面：一只四状态的史莱姆（发呆 / 发现你 / 追你 / 受惊） */
(function () {
  'use strict';
  const cv = G.$('#hero-cv');
  if (!cv) return;
  const W = 520, H = 300, PX = 4, SW = 14 * PX, SH = 11 * PX;
  const NOTICE_R = 150, LOSE_R = 230;
  const NAMES = { IDLE: '发呆', NOTICE: '发现你', CHASE: '追你', SCARED: '受惊' };
  const col = {};
  const C = G.canvas(cv, W, H, draw);
  const ctx = C.ctx;
  const pillEls = G.$$('#hero-states [data-st]');

  function readColors() {
    col.bg = G.css('--surface-2'); col.line = G.css('--line'); col.ink = G.css('--ink'); col.ink2 = G.css('--ink-2');
    col.surface = G.css('--surface'); col.border = G.css('--border'); col.red = G.css('--w1'); col.green = G.css('--w4');
  }
  readColors();
  G.onTheme(function () { readColors(); draw(); });

  const S = { x: 320, y: 210, tx: 320, ty: 210, state: 'IDLE', t: 0, lost: 0, hop: 0, face: 1, say: '（发呆中……）', sayT: 3 };
  const P = { x: 0, y: 0, in: false };

  function say(t, dur) { S.say = t; S.sayT = dur || 2.2; }
  function setState(s, line) {
    if (S.state === s) return;
    S.state = s; S.t = 0; S.lost = 0;
    if (line) say(line);
    pillEls.forEach(function (p) { p.classList.toggle('on', p.getAttribute('data-st') === s); });
  }
  function newWander() {
    S.tx = G.clamp(S.x + (Math.random() - 0.5) * 240, 60, W - 60);
    S.ty = G.clamp(S.y + (Math.random() - 0.5) * 120, 110, H - 20);
  }
  function headDist() { return P.in ? G.dist(P.x, P.y, S.x, S.y - SH / 2) : Infinity; }

  cv.addEventListener('pointermove', function (e) { const p = C.toLocal(e); P.x = p.x; P.y = p.y; P.in = true; });
  cv.addEventListener('pointerleave', function () { P.in = false; });
  cv.addEventListener('pointerdown', function (e) {
    const p = C.toLocal(e); P.x = p.x; P.y = p.y; P.in = true;
    if (headDist() < 120) setState('SCARED', G.pick(['妈呀！', '别打我！', '溜了溜了']));
  });

  function moveToward(tx, ty, speed, dt) {
    const dx = tx - S.x, dy = ty - S.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return 0;
    const step = Math.min(d, speed * dt);
    S.x += dx / d * step; S.y += dy / d * step;
    if (Math.abs(dx) > 2) S.face = dx > 0 ? 1 : -1;
    return d;
  }

  function update(dt) {
    S.t += dt; S.hop += dt;
    if (S.sayT > 0) S.sayT -= dt;
    const d = headDist();
    switch (S.state) {
      case 'IDLE':
        if (moveToward(S.tx, S.ty, 28, dt) < 2 || S.t > 4) { newWander(); S.t = 0; }
        if (S.sayT <= 0 && Math.random() < dt * 0.3) say(G.pick(['（发呆中……）', '今天天气不错', '……', '想吃果冻', '好无聊啊']));
        if (d < NOTICE_R) setState('NOTICE', '！？');
        break;
      case 'NOTICE':
        if (S.t > 0.55) setState('CHASE', G.pick(['冲！', '站住！', '我来啦！']));
        break;
      case 'CHASE':
        if (d < LOSE_R) {
          S.lost = 0;
          moveToward(P.x, P.y + SH / 2, 105, dt);
          if (d < 32 && S.sayT <= 0) say('贴贴！', 1.2);
        } else {
          S.lost += dt;
          if (S.lost > 1.1) { setState('IDLE', G.pick(['一定是风吧', '咦，人呢？', '算了，继续发呆'])); newWander(); }
        }
        break;
      case 'SCARED': {
        const ax = P.in ? S.x - P.x : 1, ay = P.in ? (S.y - SH / 2) - P.y : 0;
        const al = Math.sqrt(ax * ax + ay * ay) || 1;
        moveToward(S.x + ax / al * 60, S.y + ay / al * 60, 170, dt);
        if (S.t > 1.8) { setState('IDLE', '吓死宝宝了'); newWander(); }
        break;
      }
    }
    S.x = G.clamp(S.x, SW / 2 + 8, W - SW / 2 - 8);
    S.y = G.clamp(S.y, SH + 64, H - 10);
  }

  function draw() {
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = col.line; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 20; x < W; x += 20) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); }
    for (let y = 20; y < H; y += 20) { ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); }
    ctx.stroke();

    const cx = S.x, cy = S.y - SH / 2, d = headDist();
    // 感知范围
    ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = col.ink2; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, NOTICE_R, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    // 玩家光标
    if (P.in) {
      if (S.state === 'CHASE' || S.state === 'NOTICE') {
        ctx.strokeStyle = col.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(P.x, P.y); ctx.stroke();
      }
      ctx.strokeStyle = col.ink; ctx.lineWidth = 2; ctx.beginPath();
      ctx.arc(P.x, P.y, 8, 0, Math.PI * 2); ctx.moveTo(P.x - 13, P.y); ctx.lineTo(P.x - 4, P.y); ctx.moveTo(P.x + 4, P.y); ctx.lineTo(P.x + 13, P.y);
      ctx.moveTo(P.x, P.y - 13); ctx.lineTo(P.x, P.y - 4); ctx.moveTo(P.x, P.y + 4); ctx.lineTo(P.x, P.y + 13); ctx.stroke();
      ctx.fillStyle = col.ink; ctx.font = '700 12px "Noto Sans SC", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('你', P.x + 14, P.y - 12);
    }
    // 影子
    ctx.fillStyle = col.ink; ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.ellipse(S.x, S.y + 2, SW * 0.45, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    // 史莱姆（带一点弹跳）
    const freq = S.state === 'CHASE' ? 14 : S.state === 'SCARED' ? 20 : 5;
    let sq = G.reduced ? 1 : 1 + 0.07 * Math.sin(S.hop * freq);
    if (S.state === 'NOTICE' && !G.reduced) sq = 1 + 0.16 * Math.abs(Math.sin(S.t * 18));
    ctx.save(); ctx.translate(S.x, S.y); ctx.scale(S.face / sq, sq);
    G.drawSprite(ctx, 'slime', -SW / 2, -SH, PX);
    ctx.restore();
    // 头顶符号
    const topY = S.y - SH * sq - 6;
    let icon = '';
    if (S.state === 'NOTICE') icon = '!';
    else if (S.state === 'CHASE' && S.lost > 0) icon = '?';
    else if (S.state === 'SCARED') icon = '!!';
    if (icon) {
      ctx.font = '700 22px "Pixelify Sans", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 4; ctx.strokeStyle = col.surface; ctx.strokeText(icon, S.x, topY);
      ctx.fillStyle = icon === '?' ? col.ink : col.red; ctx.fillText(icon, S.x, topY);
    }
    if (S.sayT > 0) G.bubble(ctx, S.x, topY - (icon ? 22 : 0), S.say, { bg: col.surface, fg: col.ink, border: col.border, maxX: W });
    // 调试信息
    ctx.font = '600 12px "JetBrains Mono", ui-monospace, monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const l1 = 'state = ' + S.state + '   // ' + NAMES[S.state];
    const l2 = 'dist  = ' + (isFinite(d) ? Math.round(d) + 'px' : '—') + '   t = ' + S.t.toFixed(1) + 's';
    const bw = Math.max(ctx.measureText(l1).width, ctx.measureText(l2).width) + 16;
    ctx.fillStyle = col.surface; ctx.globalAlpha = 0.9; ctx.fillRect(10, 10, bw, 44); ctx.globalAlpha = 1;
    ctx.strokeStyle = col.border; ctx.lineWidth = 2; ctx.strokeRect(10, 10, bw, 44);
    ctx.fillStyle = col.ink; ctx.fillText(l1, 18, 17); ctx.fillStyle = col.ink2; ctx.fillText(l2, 18, 34);
  }

  G.ready.then(draw);
  G.loop(cv, function (dt) { update(dt); draw(); });
})();
