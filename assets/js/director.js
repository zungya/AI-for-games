/* 4-2 AI 导演：四状态节奏机 + 紧张度曲线；火焰纹章 2RN 命中率；结尾的 CONTINUE */
(function () {
  'use strict';
  const svg = G.$('#dir-svg');
  if (!svg) return;
  const VW = 600, VH = 250, ML = 34, MR = 16, MT = 24, MB = 28, PW = VW - ML - MR, PHt = VH - MT - MB;
  const SPAN = 60, SAMPLE = 0.25, NS = SPAN / SAMPLE;
  const INFO = {
    build: { n: '积累', en: 'BUILD UP', c: 'var(--w1)' },
    peak: { n: '维持峰值', en: 'SUSTAIN PEAK', c: 'var(--w2)' },
    fade: { n: '消退', en: 'PEAK FADE', c: 'var(--w3)' },
    relax: { n: '放松', en: 'RELAX', c: 'var(--w4)' }
  };
  const SAY = {
    build: ['上菜！', '再来一波，别让他们闲着。', '给他们点压力。'],
    peak: ['就是现在，保持住！', '高潮来了，再撑几秒。'],
    fade: ['差不多了，收。', '停止刷怪，让他们清场。'],
    relax: ['让他们喘口气，顺便放个医疗包。', '安静一会儿。下一波已经在路上了。']
  };
  const S = { I: 8, phase: 'build', pt: 0, z: 0, spawnT: 0, acc: 0, hist: [] };
  let paused = false, silent = true, hoverK = -1, dirty = true;
  const lbl = G.$('#dir-phase-lbl'), sayEl = G.$('#dir-say'), zEl = G.$('#dir-zombies'), znEl = G.$('#dir-zn'), tip = G.$('#dir-tip');
  const pills = G.$$('#dir-phases .phase');

  function setPhase(p) {
    S.phase = p; S.pt = 0;
    if (silent) return;
    lbl.textContent = INFO[p].en;
    sayEl.textContent = G.pick(SAY[p]);
    pills.forEach(x => x.classList.toggle('on', x.getAttribute('data-p') === p));
  }
  function sim(dt) {
    S.pt += dt;
    if (S.phase === 'build' || S.phase === 'peak') {
      S.spawnT += dt;
      while (S.spawnT > 0.45) { S.spawnT -= 0.45; if (S.z < 16) S.z++; }
    }
    const atk = S.phase === 'fade' ? 0.5 : 1;
    for (let i = 0; i < S.z; i++) if (Math.random() < 0.22 * atk * dt) S.I += 3 + Math.random() * 4;
    const kill = S.phase === 'fade' || S.phase === 'relax' ? 0.9 : 0.32;
    let k = 0;
    for (let i = 0; i < S.z; i++) if (Math.random() < kill * dt) k++;
    S.z -= k; S.I += k * 0.8;
    const decay = S.z ? 1 : S.phase === 'fade' ? 7 : S.phase === 'relax' ? 5 : 3;
    S.I = G.clamp(S.I - decay * dt, 0, 100);
    if (S.phase === 'build' && S.I >= 80) setPhase('peak');
    else if (S.phase === 'peak' && S.pt > 3.5) setPhase('fade');
    else if (S.phase === 'fade' && S.z === 0 && S.I < 35) setPhase('relax');
    else if (S.phase === 'relax' && S.pt > 7) setPhase('build');
    S.acc += dt;
    while (S.acc >= SAMPLE) {
      S.acc -= SAMPLE;
      S.hist.push({ I: S.I, p: S.phase });
      if (S.hist.length > NS + 1) S.hist.shift();
      dirty = true;
    }
  }
  // 预先跑 60 秒，让图表一打开就有数据
  for (let i = 0; i < SPAN * 30; i++) sim(1 / 30);
  silent = false;
  setPhase(S.phase);

  const xOf = k => ML + PW * (k + (NS + 1 - S.hist.length)) / NS;
  const yOf = v => MT + PHt * (1 - v / 100);
  function render() {
    dirty = false;
    const h = S.hist, out = [];
    // 阶段色块
    let s = 0;
    for (let k = 1; k <= h.length; k++) {
      if (k === h.length || h[k].p !== h[s].p) {
        const x0 = xOf(s), x1 = Math.min(xOf(k), ML + PW), info = INFO[h[s].p];
        out.push('<rect x="' + x0.toFixed(1) + '" y="' + MT + '" width="' + Math.max(0, x1 - x0).toFixed(1) + '" height="' + PHt + '" style="fill:' + info.c + ';opacity:.14"/>');
        if (x1 - x0 > 52) out.push('<text class="band-lbl" x="' + ((x0 + x1) / 2).toFixed(1) + '" y="' + (MT - 8) + '" text-anchor="middle">' + info.n + '</text>');
        s = k;
      }
    }
    // 网格与坐标
    out.push('<g class="grid">');
    [0, 50, 100].forEach(v => out.push('<line x1="' + ML + '" x2="' + (ML + PW) + '" y1="' + yOf(v) + '" y2="' + yOf(v) + '"/>'));
    out.push('</g><g class="axis">');
    [0, 50, 100].forEach(v => out.push('<text x="' + (ML - 6) + '" y="' + (yOf(v) + 4) + '" text-anchor="end">' + v + '</text>'));
    out.push('<text x="' + ML + '" y="' + (VH - 8) + '" text-anchor="start">−60 秒</text>');
    out.push('<text x="' + (ML + PW / 2) + '" y="' + (VH - 8) + '" text-anchor="middle">−30 秒</text>');
    out.push('<text x="' + (ML + PW) + '" y="' + (VH - 8) + '" text-anchor="end">现在</text>');
    out.push('<text x="' + (ML + 6) + '" y="' + (yOf(80) - 5) + '" text-anchor="start">峰值线 80</text></g>');
    out.push('<line x1="' + ML + '" x2="' + (ML + PW) + '" y1="' + yOf(80) + '" y2="' + yOf(80) + '" style="stroke:var(--ink-2);stroke-width:1;opacity:.6"/>');
    // 曲线
    if (h.length > 1) {
      const pts = h.map((d, k) => xOf(k).toFixed(1) + ',' + yOf(d.I).toFixed(1));
      out.push('<path class="areaS" d="M' + xOf(0).toFixed(1) + ',' + yOf(0) + ' L' + pts.join(' L') + ' L' + xOf(h.length - 1).toFixed(1) + ',' + yOf(0) + ' Z"/>');
      out.push('<path class="lineS" d="M' + pts.join(' L') + '"/>');
      const last = h[h.length - 1], lx = xOf(h.length - 1), ly = yOf(last.I);
      out.push('<circle class="dot" cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" r="4.5"/>');
      out.push('<text class="band-lbl" x="' + (lx - 8).toFixed(1) + '" y="' + (ly - 9).toFixed(1) + '" text-anchor="end" style="font-size:13px;fill:var(--ink)">' + Math.round(last.I) + '</text>');
    }
    if (hoverK >= 0 && hoverK < h.length) {
      const x = xOf(hoverK);
      out.push('<line class="cross" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + MT + '" y2="' + (MT + PHt) + '"/>');
      out.push('<circle class="dot" cx="' + x.toFixed(1) + '" cy="' + yOf(h[hoverK].I).toFixed(1) + '" r="4"/>');
    }
    out.push('<rect x="' + ML + '" y="' + MT + '" width="' + PW + '" height="' + PHt + '" fill="transparent"/>');
    svg.innerHTML = out.join('');
    zEl.innerHTML = '<i></i>'.repeat(S.z);
    znEl.textContent = S.z;
    if (hoverK >= 0 && hoverK < h.length) showTip(hoverK);
  }
  function showTip(k) {
    const d = S.hist[k], ago = (S.hist.length - 1 - k) * SAMPLE;
    tip.hidden = false;
    tip.innerHTML = '<b>' + Math.round(d.I) + '</b>紧张度 · ' + INFO[d.p].n + '阶段 · ' + (ago < 0.5 ? '现在' : ago.toFixed(0) + ' 秒前');
    const box = svg.getBoundingClientRect(), sc = box.width / VW;
    const left = xOf(k) * sc, top = yOf(d.I) * sc;
    tip.style.left = Math.min(left + 12, box.width - tip.offsetWidth - 4) + 'px';
    tip.style.top = Math.max(0, top - tip.offsetHeight - 10) + 'px';
  }
  svg.addEventListener('pointermove', e => {
    const box = svg.getBoundingClientRect(), x = (e.clientX - box.left) * VW / box.width;
    if (x < ML || x > ML + PW) { hoverK = -1; tip.hidden = true; dirty = true; return; }
    const k = Math.round((x - ML) / PW * NS - (NS + 1 - S.hist.length));
    hoverK = G.clamp(k, 0, S.hist.length - 1); dirty = true;
  });
  svg.addEventListener('pointerleave', () => { hoverK = -1; tip.hidden = true; dirty = true; });

  const bump = v => { S.I = G.clamp(S.I + v, 0, 100); dirty = true; };
  G.$('#dir-tank').addEventListener('click', () => bump(35));
  G.$('#dir-heal').addEventListener('click', () => bump(-15));
  G.$('#dir-hit').addEventListener('click', () => bump(8));
  const pauseBtn = G.$('#dir-pause');
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseBtn.textContent = paused ? '继续' : '暂停';
  });
  G.onTheme(render);
  render();
  G.loop(G.$('#dir-demo'), function (dt) { if (!paused) sim(dt); if (dirty) render(); });
})();

/* 火焰纹章：两个随机数取平均（2RN） */
(function () {
  'use strict';
  const svg = G.$('#fe-svg');
  if (!svg) return;
  const VW = 320, VH = 270, ML = 44, MR = 16, MT = 14, MB = 42, PW = VW - ML - MR, PHt = VH - MT - MB;
  const trueHit = h => (h <= 50 ? h * (2 * h + 1) / 10000 : 1 - (199 - 2 * h) * (200 - 2 * h) / 20000);
  const x = v => ML + PW * v / 100, y = v => MT + PHt * (1 - v / 100);
  const input = G.$('#fe-hit');
  function render() {
    const h = +input.value, t = trueHit(h) * 100;
    G.$('#fe-hit-o').textContent = h + '%';
    G.$('#fe-shown').textContent = h + '%';
    G.$('#fe-true').textContent = (t >= 99.95 && h < 100 ? t.toFixed(2) : t.toFixed(1)) + '%';
    const out = ['<g class="grid">'];
    [0, 50, 100].forEach(v => {
      out.push('<line x1="' + ML + '" x2="' + (ML + PW) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>');
      out.push('<line y1="' + MT + '" y2="' + (MT + PHt) + '" x1="' + x(v) + '" x2="' + x(v) + '"/>');
    });
    out.push('</g><g class="axis">');
    [0, 50, 100].forEach(v => {
      out.push('<text x="' + (ML - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + '</text>');
      out.push('<text x="' + x(v) + '" y="' + (MT + PHt + 16) + '" text-anchor="middle">' + v + '</text>');
    });
    out.push('<text x="' + (ML + PW / 2) + '" y="' + (VH - 6) + '" text-anchor="middle">屏幕显示的命中率（%）</text>');
    out.push('<text transform="translate(12 ' + (MT + PHt / 2) + ') rotate(-90)" text-anchor="middle">实际命中率（%）</text>');
    out.push('<text x="' + x(66) + '" y="' + y(52) + '" text-anchor="start">显示 = 实际</text></g>');
    out.push('<line x1="' + x(0) + '" y1="' + y(0) + '" x2="' + x(100) + '" y2="' + y(100) + '" style="stroke:var(--ink-2);stroke-width:1;opacity:.7"/>');
    const pts = [];
    for (let v = 0; v <= 100; v++) pts.push(x(v).toFixed(1) + ',' + y(trueHit(v) * 100).toFixed(1));
    out.push('<path class="lineS" d="M' + pts.join(' L') + '"/>');
    const mx = x(h), my = y(t);
    out.push('<line class="cross" x1="' + mx + '" x2="' + mx + '" y1="' + (MT + PHt) + '" y2="' + my + '" opacity="0.7"/>');
    out.push('<line class="cross" x1="' + ML + '" x2="' + mx + '" y1="' + my + '" y2="' + my + '" opacity="0.7"/>');
    out.push('<circle class="dot" cx="' + mx + '" cy="' + my + '" r="5"/>');
    // h < 50 时曲线在对角线下方，左上是空的；h ≥ 50 时右下是空的
    const pos = h < 50 ? [-10, -8, 'end'] : h <= 78 ? [10, 18, 'start'] : [-10, 20, 'end'];
    out.push('<text class="band-lbl" x="' + (mx + pos[0]) + '" y="' + (my + pos[1]) + '" text-anchor="' + pos[2] + '" style="font-size:13px;fill:var(--ink)">' + t.toFixed(1) + '%</text>');
    out.push('<rect x="' + ML + '" y="' + MT + '" width="' + PW + '" height="' + PHt + '" fill="transparent"/>');
    svg.innerHTML = out.join('');
  }
  input.addEventListener('input', render);
  svg.addEventListener('pointermove', e => {
    const box = svg.getBoundingClientRect(), v = ((e.clientX - box.left) * VW / box.width - ML) / PW * 100;
    if (v < 0 || v > 100) return;
    input.value = Math.round(v); render();
  });
  render();
})();

/* 结尾：CONTINUE 倒计时 */
(function () {
  'use strict';
  const btn = G.$('#cont-btn');
  if (!btn) return;
  const n = G.$('#cont-n'), msg = G.$('#cont-msg');
  let timer = 0, k = 9, running = false;
  btn.addEventListener('click', () => {
    if (running) {
      clearInterval(timer); running = false;
      msg.textContent = '收到！请提问。'; btn.textContent = '再投一枚';
      return;
    }
    k = 9; n.textContent = k; running = true;
    msg.textContent = '倒计时开始。想提问就再按一次！'; btn.textContent = 'CONTINUE！我要提问';
    timer = setInterval(() => {
      k--; n.textContent = k;
      if (k <= 0) {
        clearInterval(timer); running = false;
        msg.textContent = 'GAME OVER……开个玩笑，欢迎提问！'; btn.textContent = '再投一枚';
      }
    }, 1000);
  });
})();
