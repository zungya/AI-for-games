/* 1-2 行为树演示：用行为树的思路拆解怪物猎人里一只大型怪物的行为。Tick 一次 = 一次带短路的深度优先遍历 */
(function () {
  'use strict';
  const host = G.$('#bt-tree');
  if (!host) return;
  const W = { flash: false, weak: false, see: true, stamina: 5, rest: 0, stun: 0 };
  let uid = 0;
  const node = (type, label, kids, fn) => ({ id: 'bt-n' + (uid++), type: type, label: label, kids: kids || [], fn: fn });
  const Sel = (l, k) => node('sel', l, k), Seq = (l, k) => node('seq', l, k);
  const Cond = (l, f) => node('cond', l, null, f), Act = (l, f) => node('act', l, null, f);

  const act = {
    stun() {
      W.stun++;
      if (W.stun >= 2) { W.stun = 0; W.flash = false; return ['SUCCESS', '眼睛恢复了，继续打！', '被晃瞎乱咬']; }
      return ['RUNNING', '眼前一白！原地乱咬一通', '被晃瞎乱咬'];
    },
    flee() { return ['RUNNING', G.pick(['一瘸一拐地逃回巢穴……', '撑不住了，回家睡一觉', '（地图上出现了逃跑标记）']), '瘸腿逃回巢穴'];},
    attack() { W.stamina = Math.max(0, W.stamina - 1); return ['SUCCESS', G.pick(['吼——！', '一口火喷过去！', '冲撞！', '甩尾！']), '喷火 / 冲撞']; },
    rest() {
      W.rest++;
      if (W.rest >= 2) { W.rest = 0; W.stamina = 5; return ['SUCCESS', '缓过来了，再来！', '疲劳喘气']; }
      return ['RUNNING', '呼……呼……（累到流口水）', '疲劳喘气'];
    },
    patrol() { return ['RUNNING', G.pick(['在领地里巡逻', '找点东西吃', '溜达到下一个区域']), '巡逻领地']; }
  };

  const tree = Sel('根 · 选择', [
    Seq('先顾眼睛', [Cond('被闪光弹晃到？', () => W.flash), Act('原地乱咬', act.stun)]),
    Seq('保命要紧', [Cond('快不行了？', () => W.weak), Act('瘸腿逃回巢穴', act.flee)]),
    Seq('战斗', [
      Cond('发现猎人？', () => W.see),
      Sel('怎么打', [
        Seq('进攻', [Cond('还有体力？', () => W.stamina > 0), Act('喷火 / 冲撞', act.attack)]),
        Act('疲劳：流口水喘气', act.rest)
      ])
    ]),
    Act('巡逻领地、找吃的', act.patrol)
  ]);
  const all = [];
  (function walk(n) { all.push(n); n.kids.forEach(walk); })(tree);

  const GLYPH = { sel: '?', seq: '→', cond: '◇', act: '▶' };
  const ST = { SUCCESS: ['ok', '成功'], FAILURE: ['fail', '失败'], RUNNING: ['run', '进行中'] };
  function render(n) {
    let h = '<li><span class="nd k-' + n.type + '" id="' + n.id + '"><span class="glyph" aria-hidden="true">' + GLYPH[n.type] + '</span>' +
      '<span class="lb">' + n.label + '</span><span class="st"></span></span>';
    if (n.kids.length) h += '<ul>' + n.kids.map(render).join('') + '</ul>';
    return h + '</li>';
  }
  host.innerHTML = '<ul>' + render(tree) + '</ul>';
  const el = {};
  all.forEach(n => { el[n.id] = document.getElementById(n.id); });

  const tickBtn = G.$('#bt-tick'), autoBtn = G.$('#bt-auto'), info = G.$('#bt-info'), tickNo = G.$('#bt-tickno');
  const bubble = G.$('#bt-bubble'), actEl = G.$('#bt-act'), stamEl = G.$('#bt-stamina');
  const swF = G.$('#bt-flash'), swW = G.$('#bt-weak'), swS = G.$('#bt-see');

  // 体力槽 + 耗光按钮
  stamEl.innerHTML = '<span>体力</span>' + '<i></i>'.repeat(5) + '<button class="btn sm" type="button" id="bt-drain" style="margin-left:8px">耗光体力</button>';
  const bars = G.$$('i', stamEl);
  function sync() {
    swF.checked = W.flash; swW.checked = W.weak; swS.checked = W.see;
    bars.forEach((b, i) => b.classList.toggle('empty', i >= W.stamina));
  }
  G.$('#bt-drain').addEventListener('click', () => { W.stamina = 0; W.rest = 0; sync(); });
  swF.addEventListener('change', () => { W.flash = swF.checked; W.stun = 0; });
  swW.addEventListener('change', () => { W.weak = swW.checked; });
  swS.addEventListener('change', () => { W.see = swS.checked; });

  let lastAction = '', tickCount = 0, timers = [], busy = false;
  function tick(n, trace, out) {
    trace.push([n, 'visit']);
    let s;
    if (n.type === 'sel') {
      s = 'FAILURE';
      for (const k of n.kids) { const r = tick(k, trace, out); if (r !== 'FAILURE') { s = r; break; } }
    } else if (n.type === 'seq') {
      s = 'SUCCESS';
      for (const k of n.kids) { const r = tick(k, trace, out); if (r !== 'SUCCESS') { s = r; break; } }
    } else if (n.type === 'cond') {
      s = n.fn() ? 'SUCCESS' : 'FAILURE';
    } else {
      const r = n.fn();
      s = r[0]; out.say = r[1]; out.act = r[2];
    }
    trace.push([n, s]);
    return s;
  }
  function clearMarks() {
    timers.forEach(clearTimeout); timers = [];
    all.forEach(n => { const e = el[n.id]; e.className = 'nd k-' + n.type + ' skip'; e.querySelector('.st').textContent = ''; });
  }
  function mark(n, kind) {
    const e = el[n.id];
    if (kind === 'visit') { e.classList.remove('skip'); e.classList.add('visit'); return; }
    e.classList.remove('visit', 'skip');
    e.classList.add(ST[kind][0]);
    e.querySelector('.st').textContent = ST[kind][1];
  }
  function doTick(animate) {
    if (busy) return;
    const out = {}, trace = [];
    tick(tree, trace, out);
    if (out.act !== lastAction) { if (lastAction === '疲劳喘气') W.rest = 0; lastAction = out.act; }
    tickCount++;
    tickNo.textContent = 'TICK ' + tickCount;
    const visited = new Set(trace.map(t => t[0].id)).size;
    clearMarks();
    const finish = () => {
      busy = false;
      bubble.textContent = out.say; actEl.textContent = out.act;
      info.innerHTML = '本次访问 <b>' + visited + '</b> / ' + all.length + ' 个节点';
      sync();
    };
    if (!animate || G.reduced) { trace.forEach(t => mark(t[0], t[1])); finish(); return; }
    busy = true;
    const step = 70;
    trace.forEach((t, i) => timers.push(setTimeout(() => mark(t[0], t[1]), i * step)));
    timers.push(setTimeout(finish, trace.length * step + 20));
  }

  tickBtn.addEventListener('click', () => doTick(true));
  // 自动 Tick：只在演示可见时运行
  let auto = false, autoTimer = 0, visible = false;
  new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; }, { threshold: 0.1 }).observe(G.$('#bt-demo'));
  function autoLoop() {
    if (!auto) return;
    if (visible) doTick(true);
    autoTimer = setTimeout(autoLoop, 1900);
  }
  autoBtn.addEventListener('click', () => {
    auto = !auto;
    autoBtn.setAttribute('aria-pressed', String(auto));
    autoBtn.textContent = auto ? '停止自动' : '自动 Tick';
    clearTimeout(autoTimer);
    if (auto) autoLoop();
  });

  sync();
  doTick(false);
})();
