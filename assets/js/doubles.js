/* 2-1 贪心 · 宝可梦双打：把 2023 世界赛 VGC 冠军木村翔平的队伍交给贪心 AI。
   队伍、招式来自官方公布的队伍表；伤害是简化估算：Lv50，攻击方的攻击/特攻满投入（种族值 + 52），
   防守方不投入（防御/特防 = 种族值 + 20，HP = 种族值 + 75）；不计道具、太晶化、场地、随机数和出手顺序，
   特性只算奇麒麟的「尾甲」（挡住先制招式），暴击只算必定暴击的水流连打。 */
(function () {
  'use strict';
  const root = document.getElementById('vgc-demo');
  if (!root) return;

  const TN = { normal: '一般', fire: '火', water: '水', electric: '电', grass: '草', ice: '冰', fighting: '格斗', poison: '毒', ground: '地面', flying: '飞行',
    psychic: '超能力', bug: '虫', rock: '岩石', ghost: '幽灵', dragon: '龙', dark: '恶', steel: '钢', fairy: '妖精' };
  // 进攻属性 → 防守属性的倍率（第六世代起的属性表，只列不是 ×1 的格子）
  const CHART = {
    normal: { rock: .5, ghost: 0, steel: .5 },
    fire: { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
    water: { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
    electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
    grass: { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
    ice: { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
    fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
    poison: { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
    ground: { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
    flying: { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
    psychic: { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
    bug: { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
    rock: { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
    ghost: { normal: 0, psychic: 2, ghost: 2, dark: .5 },
    dragon: { dragon: 2, steel: .5, fairy: 0 },
    dark: { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
    steel: { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
    fairy: { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 }
  };
  // 招式：t 属性，c 物理 p / 特殊 s / 按攻防高者 auto / 辅助 x，pow 威力，spread 同时打对面两只，prio 先制，crit 必定暴击
  const M = {
    stomp: { n: '跺脚', t: 'ground', c: 'p', pow: 75 }, terablast: { n: '太晶爆发', t: 'normal', c: 'auto', pow: 80 },
    uturn: { n: '急速折返', t: 'bug', c: 'p', pow: 70 }, protect: { n: '守住', c: 'x' },
    surging: { n: '水流连打', t: 'water', c: 'p', pow: 75, crit: true }, aquajet: { n: '水流喷射', t: 'water', c: 'p', pow: 40, prio: true },
    taunt: { n: '挑衅', c: 'x' }, shadowball: { n: '暗影球', t: 'ghost', c: 's', pow: 80 },
    gleam: { n: '魔法闪耀', t: 'fairy', c: 's', pow: 80, spread: true }, moonblast: { n: '月亮之力', t: 'fairy', c: 's', pow: 95 },
    energyball: { n: '能量球', t: 'grass', c: 's', pow: 90 }, icicle: { n: '冰柱坠击', t: 'ice', c: 'p', pow: 85 },
    sacred: { n: '圣剑', t: 'fighting', c: 'p', pow: 90 }, sucker: { n: '突袭', t: 'dark', c: 'p', pow: 70, prio: true },
    pollen: { n: '花粉团', t: 'bug', c: 's', pow: 90 }, spore: { n: '蘑菇孢子', c: 'x' }, ragepowder: { n: '愤怒粉', c: 'x' },
    wildcharge: { n: '疯狂伏特', t: 'electric', c: 'p', pow: 90 }, voltswitch: { n: '伏特替换', t: 'electric', c: 's', pow: 70 },
    drainpunch: { n: '吸取拳', t: 'fighting', c: 'p', pow: 75 }, fakeout: { n: '击掌奇袭', t: 'normal', c: 'p', pow: 40, prio: true },
    psychic: { n: '精神强念', t: 'psychic', c: 's', pow: 90 }, trickroom: { n: '戏法空间', c: 'x' }, imprison: { n: '封印', c: 'x' },
    crunch: { n: '咬碎', t: 'dark', c: 'p', pow: 80 }, phantom: { n: '潜灵奇袭', t: 'ghost', c: 'p', pow: 90 },
    darts: { n: '龙箭', t: 'dragon', c: 'p', pow: 100 }, cc: { n: '近身战', t: 'fighting', c: 'p', pow: 120 },
    woodhammer: { n: '木槌', t: 'grass', c: 'p', pow: 120 }, heatwave: { n: '热风', t: 'fire', c: 's', pow: 95, spread: true },
    flashcannon: { n: '加农光炮', t: 'steel', c: 's', pow: 80 }, earthpower: { n: '大地之力', t: 'ground', c: 's', pow: 90 }
  };
  const P = (n, img, types, st, moves, armor) => ({ n: n, img: 'media/pkm/' + img + '.png', types: types,
    hp: st[0], atk: st[1], def: st[2], spa: st[3], spd: st[4], moves: moves, armor: !!armor });
  const MINE = [
    P('土地云', 'landorus-therian', ['ground', 'flying'], [89, 145, 90, 105, 80, 91], ['stomp', 'terablast', 'uturn', 'protect']),
    P('武道熊师', 'urshifu-rapid-strike', ['fighting', 'water'], [100, 130, 100, 63, 60, 97], ['surging', 'aquajet', 'protect', 'taunt']),
    P('振翼发', 'flutter-mane', ['ghost', 'fairy'], [55, 55, 55, 135, 135, 135], ['shadowball', 'gleam', 'moonblast', 'energyball']),
    P('古剑豹', 'chien-pao', ['dark', 'ice'], [80, 120, 80, 90, 65, 135], ['icicle', 'sacred', 'sucker', 'protect']),
    P('败露球菇', 'amoonguss', ['grass', 'poison'], [114, 85, 70, 85, 80, 30], ['pollen', 'spore', 'ragepowder', 'protect']),
    P('铁臂膀', 'iron-hands', ['fighting', 'electric'], [154, 140, 108, 50, 68, 50], ['wildcharge', 'voltswitch', 'drainpunch', 'fakeout'])
  ];
  const FOES = [
    P('奇麒麟', 'farigiraf', ['normal', 'psychic'], [120, 90, 70, 110, 70, 60], ['psychic', 'gleam', 'trickroom', 'imprison'], true),
    P('古剑豹', 'chien-pao', ['dark', 'ice'], [80, 120, 80, 90, 65, 135], ['icicle', 'crunch', 'sucker', 'protect']),
    P('多龙巴鲁托', 'dragapult', ['dragon', 'ghost'], [88, 120, 75, 100, 75, 142], ['phantom', 'darts', 'terablast', 'sucker']),
    P('武道熊师', 'urshifu-rapid-strike', ['fighting', 'water'], [100, 130, 100, 63, 60, 97], ['cc', 'surging', 'uturn', 'aquajet']),
    P('轰擂金刚猩', 'rillaboom', ['grass'], [100, 125, 90, 60, 70, 85], ['woodhammer', 'stomp', 'fakeout', 'protect']),
    P('席多蓝恩', 'heatran', ['fire', 'steel'], [91, 90, 106, 130, 106, 77], ['heatwave', 'flashcannon', 'earthpower', 'terablast'])
  ];

  /* ---------- 伤害估算 ---------- */
  const effOf = (t, defTypes) => defTypes.reduce((m, d) => m * (CHART[t][d] == null ? 1 : CHART[t][d]), 1);
  function hit(att, mk, def, defSide, both) {
    const mv = M[mk];
    if (mv.c === 'x') return null;
    if (mv.prio && defSide.some(p => p.armor)) return { pct: 0, eff: 1, blocked: true };
    const cat = mv.c === 'auto' ? (att.atk >= att.spa ? 'p' : 's') : mv.c;
    const A = (cat === 'p' ? att.atk : att.spa) + 52, D = (cat === 'p' ? def.def : def.spd) + 20, HP = def.hp + 75;
    const e = effOf(mv.t, def.types);
    const base = Math.floor(Math.floor(22 * mv.pow * A / D) / 50) + 2;
    const mod = (both ? 0.75 : 1) * (att.types.indexOf(mv.t) >= 0 ? 1.5 : 1) * e * (mv.crit ? 1.5 : 1);
    return { pct: Math.round(base * mod / HP * 100), eff: e };
  }
  /* 一只宝可梦这回合能做的所有「招式 + 目标」 */
  function actionsOf(att, foes) {
    const list = [];
    att.moves.forEach(mk => {
      const mv = M[mk];
      if (mv.c === 'x') return;
      if (mv.spread) list.push({ mk: mk, spread: true, hits: foes.map(f => hit(att, mk, f, foes, true)) });
      else foes.forEach((f, i) => { const hits = [null, null]; hits[i] = hit(att, mk, f, foes, false); list.push({ mk: mk, target: i, hits: hits }); });
    });
    return list;
  }
  const dmg = a => [0, 1].map(i => (a && a.hits[i] ? a.hits[i].pct : 0));
  const KO_BONUS = 50;
  // 打分：每只对手吃到的伤害最多算 100%（多打的不算），能打倒再加奖励分
  const score = totals => totals.reduce((s, d) => s + Math.min(d, 100) + (d >= 100 ? KO_BONUS : 0), 0);
  // 分数一样时，挑原始伤害更高的那个（伤害有浮动，多打一点更保险）
  const raw = d => d[0] + d[1];
  const better = (v, r, bv, br) => v > bv || (v === bv && r > br);
  function bestSingle(acts) {
    let best = null, bv = -1, br = -1;
    acts.forEach(a => { const d = dmg(a), v = score(d); if (better(v, raw(d), bv, br)) { bv = v; br = raw(d); best = a; } });
    return best;
  }
  function bestJoint(A, B) {
    let best = null, bv = -1, br = -1;
    A.forEach(a => B.forEach(b => {
      const da = dmg(a), db = dmg(b), d = [da[0] + db[0], da[1] + db[1]], v = score(d);
      if (better(v, raw(d), bv, br)) { bv = v; br = raw(d); best = [a, b]; }
    }));
    return best;
  }
  function threatTo(p, foes, mySide) {
    let best = { pct: 0 };
    foes.forEach(f => f.moves.forEach(mk => {
      const mv = M[mk];
      if (mv.c === 'x') return;
      const h = hit(f, mk, p, mySide, !!mv.spread);
      if (h && h.pct > best.pct) best = { pct: h.pct, eff: h.eff, by: f, mk: mk };
    }));
    return best;
  }

  /* ---------- 界面 ---------- */
  const st = { mine: [0, 5], foes: [5, 4], mode: 'single' };
  const $ = id => document.getElementById(id);
  const typeChip = t => '<span class="ptype tp-' + t + '">' + TN[t] + '</span>';
  function chips(host, list, key) {
    host.innerHTML = list.map((p, i) => '<button type="button" class="pk" data-i="' + i + '"><img src="' + p.img + '" alt=""><span><b>' + p.n + '</b>' +
      p.types.map(typeChip).join('') + '</span></button>').join('');
    host.addEventListener('click', e => {
      const b = e.target.closest('.pk');
      if (!b) return;
      const i = +b.getAttribute('data-i'), sel = st[key];
      if (sel.indexOf(i) >= 0) return;
      sel.shift(); sel.push(i);
      render();
    });
  }
  chips($('vgc-foes'), FOES, 'foes');
  chips($('vgc-mine'), MINE, 'mine');
  G.$$('#vgc-mode button').forEach(b => b.addEventListener('click', () => {
    st.mode = b.getAttribute('data-m');
    G.$$('#vgc-mode button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));

  const pctText = p => (p >= 100 ? '<b class="ko">' + p + '% 能打倒</b>' : p + '%');
  function actLabel(a, foes) {
    if (a.spread) return M[a.mk].n + ' → 对面两只';
    return M[a.mk].n + ' → ' + fname(foes[a.target]);
  }
  function actDmg(a, foes) {
    if (a.spread) return foes.map((f, i) => fname(f) + ' ' + pctText(a.hits[i].pct)).join('，');
    const h = a.hits[a.target];
    return h.blocked ? '被尾甲挡住，0%' : pctText(h.pct) + (h.eff >= 2 ? '（效果绝佳）' : h.eff === 0 ? '（没有效果）' : h.eff < 1 ? '（效果不好）' : '');
  }

  // 两队都有古剑豹和武道熊师：对手一律叫「对面的…」，我方和场上对手同名时叫「我们的…」
  const fname = f => (MINE.some(m => m.n === f.n) ? '对面的' + f.n : f.n);
  function render() {
    const mine = st.mine.map(i => MINE[i]), foes = st.foes.map(i => FOES[i]);
    const mname = p => (foes.some(f => f.n === p.n) ? '我们的' + p.n : p.n);
    G.$$('#vgc-mine .pk').forEach((b, i) => b.classList.toggle('on', st.mine.indexOf(i) >= 0));
    G.$$('#vgc-foes .pk').forEach((b, i) => b.classList.toggle('on', st.foes.indexOf(i) >= 0));
    const acts = mine.map(p => actionsOf(p, foes));
    const single = acts.map(bestSingle);
    const joint = bestJoint(acts[0], acts[1]);
    const chosen = st.mode === 'joint' ? joint : single;
    const vSingle = score([0, 1].map(i => dmg(single[0])[i] + dmg(single[1])[i]));
    const vJoint = score([0, 1].map(i => dmg(joint[0])[i] + dmg(joint[1])[i]));

    // 轮换防守：可能被一击打倒的那只换上替补里受伤最少的；两只都要换时，更危险的先挑
    const ths = mine.map(p => threatTo(p, foes, mine));
    const benchAll = MINE.filter((q, i) => st.mine.indexOf(i) < 0).map(q => ({ q: q, t: threatTo(q, foes, mine) })).sort((x, y) => x.t.pct - y.t.pct);
    const swap = [null, null], taken = [];
    [0, 1].filter(k => ths[k].pct >= 100).sort((x, y) => ths[y].pct - ths[x].pct).forEach(k => {
      const b = benchAll.find(x => taken.indexOf(x) < 0);
      swap[k] = b;
      if (b.t.pct < 100 && b.t.pct < ths[k].pct * 0.6) taken.push(b);
    });

    $('vgc-cards').innerHTML = mine.map((p, k) => {
      const a = chosen[k];
      const top = acts[k].slice().sort((x, y) => score(dmg(y)) - score(dmg(x)) || raw(dmg(y)) - raw(dmg(x))).slice(0, 4);
      const aux = p.moves.filter(mk => M[mk].c === 'x').map(mk => M[mk].n);
      const th = ths[k];
      // 威胁行固定两行：第一行是对面最痛的一招，第二行是换不换人
      let thLine = '最大威胁：' + th.by.n + '的' + M[th.mk].n + '（约 ' + th.pct + '%）<br>扛得住，不换人';
      let danger = false;
      if (th.pct >= 100) {
        const why = th.eff >= 2 ? '，' + th.eff + ' 倍克制' : '';
        const bench = swap[k];
        danger = true;
        thLine = '⚠ 最怕' + th.by.n + '的' + M[th.mk].n + '（' + th.pct + '%' + why + '）<br>' + (bench.t.pct < 100 && bench.t.pct < th.pct * 0.6
          ? '→ 轮换防守：换上<b>' + mname(bench.q) + '</b>（最多受 ' + bench.t.pct + '%）'
          : '替补最扛打的' + mname(bench.q) + '也要受 ' + bench.t.pct + '%，不如不换');
      }
      return '<div class="vgc-card"><div class="vgc-head"><img src="' + p.img + '" alt=""><div><b>' + p.n + '</b><span>' + p.types.map(typeChip).join('') + '</span></div></div>' +
        '<div class="vgc-pick"><small>' + (st.mode === 'joint' ? '组合贪心选择' : '单只贪心选择') + '</small><b>' + actLabel(a, foes) + '</b><span>' + actDmg(a, foes) + '</span></div>' +
        '<div class="vgc-list">' + top.map(x => '<div class="vgc-row' + (x === a ? ' on' : '') + '"><span>' + actLabel(x, foes) + '</span><span class="vbar"><i style="width:' +
          Math.min(100, Math.max(...dmg(x))) + '%"></i></span><span class="vpct">' + (x.spread ? dmg(x).join('/') + '%' : x.hits[x.target].blocked ? '被挡住' : dmg(x)[x.target] + '%') + '</span></div>').join('') + '</div>' +
        (aux.length ? '<p class="vgc-aux">算不出分的辅助招：' + aux.join('、') + '</p>' : '') +
        '<p class="vgc-threat' + (danger ? ' danger' : '') + '">' + thLine + '</p></div>';
    }).join('');

    // 解说
    let l1, l2;
    const d0 = dmg(single[0]), d1 = dmg(single[1]);
    // 两只都打到了同一个对手，并且其中一只单独就能打倒它 → 另一只的伤害白费
    const clash = [0, 1].filter(i => d0[i] > 0 && d1[i] > 0);
    const waste = clash.filter(i => Math.max(d0[i], d1[i]) >= 100);
    if (st.mode === 'single') {
      if (waste.length) {
        const f = waste[0], killer = d0[f] >= d1[f] ? 0 : 1, other = 1 - f;
        l1 = '两只都打到了' + fname(foes[f]) + '：' + mname(mine[killer]) + '一下就能打倒它，' + mname(mine[1 - killer]) + '打在它身上的那部分白费了' +
          (d0[other] + d1[other] === 0 ? '，' + fname(foes[other]) + '却一点伤害没吃。' : '。');
      } else if (clash.length === 1 && !single[0].spread && !single[1].spread) {
        const f = clash[0];
        l1 = '两只都去打' + fname(foes[f]) + '（合计约 ' + (d0[f] + d1[f]) + '%），' + fname(foes[1 - f]) + '没人管。';
      } else {
        l1 = '这一回合两只各打各的，正好没有撞车。';
      }
      l2 = vJoint > vSingle ? '单只贪心的总分 ' + vSingle + '。把两只放在一起打分（组合贪心）能拿到 ' + vJoint + '，切到「组合贪心」看看。' : '这次单只贪心和组合贪心选得一样好（总分 ' + vSingle + '）。';
    } else {
      const dj0 = dmg(joint[0]), dj1 = dmg(joint[1]);
      const team = [0, 1].filter(i => dj0[i] < 100 && dj1[i] < 100 && dj0[i] + dj1[i] >= 100);
      l1 = '组合贪心：' + mname(mine[0]) + '用' + actLabel(joint[0], foes).replace(' → ', '攻击') + '，' + mname(mine[1]) + '用' + actLabel(joint[1], foes).replace(' → ', '攻击') + '，总分 ' + vJoint + '<span class="nw">' + (vJoint > vSingle ? '（单只贪心 ' + vSingle + '）' : '（和单只贪心一样）') + '</span>' +
        (team.length ? '。' + fname(foes[team[0]]) + '单挨哪一下都倒不了，两只合力才打倒它。' : '。');
      l2 = '它还是只看这一回合：对面会不会守住、会不会换人、先手招谁快，它都不知道。';
    }
    const say = G.$$('#vgc-say p');
    say[0].innerHTML = l1;
    say[1].innerHTML = l2;
  }
  render();
})();
