/* 2-2 效用 AI：小人的一天。给每个行动打分，取最大；正在做的事有惯性分 */
(function () {
  'use strict';
  const needsHost = G.$('#ut-needs');
  if (!needsHost) return;
  const NEEDS = [
    { k: 'hunger', n: '饱腹', decay: 1.4 },
    { k: 'energy', n: '精力', decay: 0.8 },
    { k: 'bladder', n: '膀胱', decay: 1.8 },
    { k: 'fun', n: '娱乐', decay: 1.2 },
    { k: 'hygiene', n: '卫生', decay: 0.7 }
  ];
  const START = { hunger: 62, energy: 74, bladder: 40, fun: 55, hygiene: 80 };
  const curve = (v, k) => Math.pow(1 - G.clamp(v, 0, 100) / 100, k);
  const ACTS = [
    { k: 'eat', n: '吃泡面', dur: 4, eff: { hunger: 20, bladder: -3 }, score: N => 1.0 * curve(N.hunger, 2), say: '泡面真香', why: N => '饱腹只剩 ' + Math.round(N.hunger) },
    { k: 'toilet', n: '上厕所', dur: 2.5, eff: { bladder: 40 }, score: N => 1.25 * curve(N.bladder, 3), say: '憋不住了！！', why: N => '膀胱只剩 ' + Math.round(N.bladder) },
    { k: 'sleep', n: '睡觉', dur: 7, eff: { energy: 13, hunger: -0.6 }, score: N => 0.95 * curve(N.energy, 2), say: 'Zzz……', why: N => '精力只剩 ' + Math.round(N.energy) },
    { k: 'game', n: '打游戏', dur: 5, eff: { fun: 18, energy: -2.2, hygiene: -0.8 }, score: N => 0.85 * curve(N.fun, 1.6), say: '再来一把！', why: N => '娱乐只剩 ' + Math.round(N.fun) },
    { k: 'shower', n: '洗澡', dur: 4, eff: { hygiene: 24, fun: 2 }, score: N => 0.75 * curve(N.hygiene, 2), say: '啦啦啦～', why: N => '卫生只剩 ' + Math.round(N.hygiene) },
    { k: 'phone', n: '刷手机', dur: 3, eff: { fun: 6, energy: -0.5 }, score: N => 0.3 * curve(N.fun, 1) + 0.04, say: '就刷五分钟……', why: () => '其他事都不急，那就摸鱼' }
  ];
  const INERTIA = 0.15;
  const N = Object.assign({}, START);
  let doing = null, prog = 0, simMin = 8 * 60, speed = 1, lastUi = 0;

  needsHost.innerHTML = NEEDS.map(nd =>
    '<label class="need" for="ut-n-' + nd.k + '"><span>' + nd.n + '</span><input type="range" id="ut-n-' + nd.k + '" min="0" max="100" step="1"><output id="ut-o-' + nd.k + '"></output></label>').join('');
  const actsHost = G.$('#ut-acts');
  actsHost.innerHTML = ACTS.map(a =>
    '<div class="act" id="ut-a-' + a.k + '"><span>' + a.n + '</span><span class="scorebar"><i></i></span><b>0</b></div>').join('');
  const ui = {
    clock: G.$('#ut-clock'), bubble: G.$('#ut-bubble'), doing: G.$('#ut-doing'), prog: G.$('#ut-prog'), why: G.$('#ut-why'), rand: G.$('#ut-rand')
  };
  NEEDS.forEach(nd => {
    nd.input = G.$('#ut-n-' + nd.k); nd.out = G.$('#ut-o-' + nd.k); nd.row = nd.input.closest('.need');
    nd.input.addEventListener('input', () => { N[nd.k] = +nd.input.value; render(true); });
  });
  ACTS.forEach(a => { a.row = G.$('#ut-a-' + a.k); a.bar = G.$('i', a.row); a.num = G.$('b', a.row); });

  function scores() {
    return ACTS.map(a => {
      let s = a.score(N);
      if (doing === a) s += INERTIA;
      return { a: a, s: s };
    });
  }
  function choose() {
    const sc = scores().sort((x, y) => y.s - x.s);
    if (ui.rand.checked && sc.length > 1) {
      const a = Math.max(sc[0].s, 0.001), b = Math.max(sc[1].s, 0.001);
      return Math.random() < a / (a + b) ? sc[0].a : sc[1].a;
    }
    return sc[0].a;
  }
  function start(a, note) {
    doing = a; prog = 0;
    ui.bubble.textContent = note || a.say;
    ui.doing.textContent = a.n;
  }
  function update(dt) {
    if (!speed) return;
    const d = dt * speed;
    simMin += d * 5;
    NEEDS.forEach(nd => { N[nd.k] -= nd.decay * d; });
    if (doing) {
      Object.keys(doing.eff).forEach(k => { N[k] += doing.eff[k] * d; });
      prog += d;
    }
    NEEDS.forEach(nd => { N[nd.k] = G.clamp(N[nd.k], 0, 100); });
    if (N.bladder <= 0 && (!doing || doing.k !== 'toilet')) {
      N.bladder = 100; N.hygiene = 0; N.fun = Math.max(0, N.fun - 25);
      doing = null;
      ui.bubble.textContent = '（发生了不可描述的事故）';
      ui.doing.textContent = '……';
      return;
    }
    if (doing && prog >= doing.dur) doing = null;
    if (!doing) { start(choose()); return; }
    // 有更急的事就打断（要超过当前行动 + 惯性分）
    const sc = scores().sort((x, y) => y.s - x.s);
    if (sc[0].a !== doing) start(sc[0].a, '等等，先' + sc[0].a.n + '！');
  }
  function render(force) {
    const now = performance.now();
    if (!force && now - lastUi < 100) return;
    lastUi = now;
    NEEDS.forEach(nd => {
      const v = Math.round(N[nd.k]);
      if (document.activeElement !== nd.input) nd.input.value = v;
      nd.input.style.setProperty('--p', v + '%');
      nd.input.style.setProperty('--fill', v < 25 ? 'var(--bad)' : 'var(--accent)');
      nd.out.textContent = v;
      nd.row.classList.toggle('low', v < 25);
    });
    const sc = scores();
    let top = sc[0];
    sc.forEach(x => { if (x.s > top.s) top = x; });
    sc.forEach(x => {
      x.a.bar.style.width = G.clamp(x.s * 100, 0, 100) + '%';
      x.a.num.textContent = Math.round(x.s * 100);
      x.a.row.classList.toggle('top', x === top);
      x.a.row.classList.toggle('doing', x.a === doing);
    });
    ui.why.textContent = '最高分：' + top.a.n + ' ' + Math.round(top.s * 100) + ' 分' + (top.a === doing ? '（含惯性 +15）' : '') + '。' + top.a.why(N) + '。';
    ui.prog.style.width = doing ? G.clamp(prog / doing.dur * 100, 0, 100) + '%' : '0%';
    const m = Math.floor(simMin) % (24 * 60), day = Math.floor(simMin / (24 * 60)) + 1;
    ui.clock.textContent = 'DAY ' + day + ' · ' + String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  G.$$('#ut-speed button').forEach(b => b.addEventListener('click', () => {
    speed = +b.getAttribute('data-v');
    G.$$('#ut-speed button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  G.$('#ut-reset').addEventListener('click', () => {
    Object.assign(N, START); doing = null; prog = 0; simMin = 8 * 60;
    ui.bubble.textContent = '新的一天！'; ui.doing.textContent = '发呆';
    render(true);
  });

  render(true);
  G.loop(G.$('#ut-demo'), function (dt) { update(dt); render(false); });
})();
