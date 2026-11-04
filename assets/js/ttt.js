/* 3-2 井字棋：同一个棋盘，六种 AI。
   随机 / 贪心 / 深度受限 + 评估函数 / Minimax / α-β 剪枝 / 蒙特卡洛树搜索（UCT）。
   每种算法都返回 { move, work, cells }：cells[i] 是第 i 格在「AI 的草稿纸」上的分数。 */
(function () {
  'use strict';
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
  const other = p => (p === 'X' ? 'O' : 'X');
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function winner(bd) {
    for (const L of LINES) if (bd[L[0]] && bd[L[0]] === bd[L[1]] && bd[L[0]] === bd[L[2]]) return { w: bd[L[0]], line: L };
    return bd.every(Boolean) ? { w: 'D', line: [] } : null;
  }
  const emptiesOf = bd => { const r = []; for (let i = 0; i < 9; i++) if (!bd[i]) r.push(i); return r; };
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const signed = v => (v > 0 ? '+' + v : String(v).replace('-', '−'));

  const AI = {};

  /* ① 随机：不看棋盘 */
  AI.random = function (bd) {
    const em = emptiesOf(bd), cells = {};
    em.forEach(i => { cells[i] = { t: '1/' + em.length, c: 'n' }; });
    return { move: pick(em), work: 0, cells: cells };
  };

  /* ② 贪心：只看一步。能赢就赢，能堵就堵，否则随机 */
  AI.greedy = function (bd, me) {
    const em = emptiesOf(bd), cells = {}, wins = [], blocks = [];
    let work = 0;
    for (const i of em) { work++; bd[i] = me; const r = winner(bd); bd[i] = null; if (r && r.w === me) wins.push(i); }
    if (!wins.length) for (const i of em) { work++; bd[i] = other(me); const r = winner(bd); bd[i] = null; if (r && r.w === other(me)) blocks.push(i); }
    const hit = wins.length ? wins : blocks;
    em.forEach(i => { cells[i] = hit.indexOf(i) >= 0 ? { t: wins.length ? '赢' : '堵', c: wins.length ? 'w' : 'd' } : { t: hit.length ? '—' : '随机', c: 'n' }; });
    return { move: pick(hit.length ? hit : em), work: work, cells: cells, kind: wins.length ? 'win' : blocks.length ? 'block' : 'none' };
  };

  /* ③ 深度受限 + 评估函数。评估函数取自《人工智能：一种现代方法》的井字棋习题：
     Eval = 3·M₂ + M₁ − (3·T₂ + T₁)，Mₙ = 恰好有我方 n 个子、没有对方子的线的条数，Tₙ 是对方的 */
  const DEPTH = 2, WIN = 100;
  function evaluate(bd, me) {
    let s = 0;
    for (const L of LINES) {
      let m = 0, o = 0;
      for (const i of L) { if (bd[i] === me) m++; else if (bd[i]) o++; }
      if (!o && m) s += m === 2 ? 3 : 1;
      if (!m && o) s -= o === 2 ? 3 : 1;
    }
    return s;
  }
  function depthLimited(bd, turn, me, depth, cnt) {
    cnt.n++;
    const r = winner(bd);
    if (r) return r.w === 'D' ? 0 : r.w === me ? WIN - depth : depth - WIN;
    if (depth >= DEPTH) return evaluate(bd, me);
    let v = turn === me ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (bd[i]) continue;
      bd[i] = turn;
      const s = depthLimited(bd, other(turn), me, depth + 1, cnt);
      bd[i] = null;
      v = turn === me ? Math.max(v, s) : Math.min(v, s);
    }
    return v;
  }
  AI.depth = function (bd, me) {
    const cnt = { n: 1 }, cells = {};
    let best = -Infinity, moves = [];
    for (const i of emptiesOf(bd)) {
      bd[i] = me;
      const v = depthLimited(bd, other(me), me, 1, cnt);
      bd[i] = null;
      cells[i] = v > WIN - 10 ? { t: '赢', c: 'w' } : v < 10 - WIN ? { t: '输', c: 'l' } : { t: signed(v), c: 'n', sub: '估分' };
      if (v > best) { best = v; moves = [i]; } else if (v === best) moves.push(i);
    }
    return { move: pick(moves), work: cnt.n, cells: cells, value: best };
  };

  /* ④ Minimax：搜到终局。分数站在 me 这边：赢 = 10 − 步数，输 = 步数 − 10，平 = 0（同样是赢，越快越好） */
  function minimax(bd, turn, me, depth, cnt) {
    cnt.n++;
    const r = winner(bd);
    if (r) return r.w === 'D' ? 0 : r.w === me ? 10 - depth : depth - 10;
    let v = turn === me ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (bd[i]) continue;
      bd[i] = turn;
      const s = minimax(bd, other(turn), me, depth + 1, cnt);
      bd[i] = null;
      v = turn === me ? Math.max(v, s) : Math.min(v, s);
    }
    return v;
  }
  const outcome = v => (v > 0 ? { t: '赢', c: 'w', sub: signed(v) } : v < 0 ? { t: '输', c: 'l', sub: signed(v) } : { t: '平', c: 'd', sub: '0' });
  AI.minimax = function (bd, me) {
    const cnt = { n: 1 }, cells = {};
    let best = -Infinity, moves = [];
    for (const i of emptiesOf(bd)) {
      bd[i] = me;
      const v = minimax(bd, other(me), me, 1, cnt);
      bd[i] = null;
      cells[i] = outcome(v);
      if (v > best) { best = v; moves = [i]; } else if (v === best) moves.push(i);
    }
    return { move: pick(moves), work: cnt.n, cells: cells, value: best };
  };

  /* ⑤ α-β 剪枝（fail-soft）：结果和 Minimax 一样，但已经确定不会被选中的分支不再往下搜 */
  function alphabeta(bd, turn, me, depth, a, b, cnt) {
    cnt.n++;
    const r = winner(bd);
    if (r) return r.w === 'D' ? 0 : r.w === me ? 10 - depth : depth - 10;
    let v = turn === me ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (bd[i]) continue;
      bd[i] = turn;
      const s = alphabeta(bd, other(turn), me, depth + 1, a, b, cnt);
      bd[i] = null;
      if (turn === me) { if (s > v) v = s; if (v > a) a = v; } else { if (s < v) v = s; if (v < b) b = v; }
      if (a >= b) break;
    }
    return v;
  }
  /* 根节点也共享 α：先搜到的好棋会让后面的候选提前剪掉，它们只拿到一个上界「≤ v」。
     候选顺序先打乱，一样好的棋随机挑一个 */
  AI.ab = function (bd, me) {
    const cnt = { n: 1 }, cells = {};
    let alpha = -Infinity, move = -1;
    for (const i of shuffle(emptiesOf(bd))) {
      bd[i] = me;
      const v = alphabeta(bd, other(me), me, 1, alpha, Infinity, cnt);
      bd[i] = null;
      if (v > alpha) { alpha = v; move = i; cells[i] = outcome(v); }
      else cells[i] = { t: '≤' + signed(v), c: 'cut', sub: '剪枝' };
    }
    return { move: move, work: cnt.n, cells: cells, value: alpha };
  };

  /* ⑥ 蒙特卡洛树搜索（UCT）。每轮四步：选择 → 扩展 → 模拟 → 回传。
     节点里的 W 记的是「走进这个节点的那一方」的得分（赢 1，平 0.5） */
  const UCT_C = Math.SQRT2;
  AI.mcts = function (bd, me, opt) {
    const iters = (opt && opt.iters) || 1000;
    const root = { bd: bd.slice(), toMove: me, parent: null, move: -1, kids: [], untried: shuffle(emptiesOf(bd)), N: 0, W: 0 };
    let size = 1;
    for (let k = 0; k < iters; k++) {
      let n = root;
      // 选择：子节点都展开过了，就挑 UCT 分数最高的往下走
      while (!n.untried.length && n.kids.length) {
        const lnN = Math.log(n.N);
        let best = null, bv = -Infinity;
        for (const c of n.kids) { const u = c.W / c.N + UCT_C * Math.sqrt(lnN / c.N); if (u > bv) { bv = u; best = c; } }
        n = best;
      }
      // 扩展：还有没试过的走法，长出一个新子节点
      if (n.untried.length) {
        const m = n.untried.pop(), b2 = n.bd.slice();
        b2[m] = n.toMove;
        const c = { bd: b2, toMove: other(n.toMove), parent: n, move: m, kids: [], untried: winner(b2) ? [] : shuffle(emptiesOf(b2)), N: 0, W: 0 };
        n.kids.push(c); n = c; size++;
      }
      // 模拟：从新节点开始随机下到终局（井字棋很短；大型游戏常常只模拟几步，再用评估函数估分）
      const sim = n.bd.slice();
      let turn = n.toMove, r = winner(sim);
      while (!r) { const em = emptiesOf(sim); sim[pick(em)] = turn; turn = other(turn); r = winner(sim); }
      // 回传：沿路径往上更新访问次数和得分
      for (let p = n; p; p = p.parent) { p.N++; p.W += r.w === 'D' ? 0.5 : r.w === other(p.toMove) ? 1 : 0; }
    }
    let best = null;
    const cells = {};
    root.kids.forEach(c => {
      cells[c.move] = { t: Math.round(c.W / c.N * 100) + '%', c: 'n', sub: c.N + ' 次' };
      if (!best || c.N > best.N || (c.N === best.N && c.W / c.N > best.W / best.N)) best = c;
    });
    return { move: best.move, work: iters, cells: cells, size: size, rate: best.W / best.N, visits: best.N };
  };

  /* 每个空格：me 下在这里、之后双方都完美应对时的分数 */
  function perfectFor(bd, me) {
    const res = {};
    for (const i of emptiesOf(bd)) { bd[i] = me; res[i] = alphabeta(bd, other(me), me, 1, -Infinity, Infinity, { n: 0 }); bd[i] = null; }
    return res;
  }

  if (typeof window !== 'undefined') window.TTT = { AI: AI, winner: winner, minimax: minimax, alphabeta: alphabeta, evaluate: evaluate, perfectFor: perfectFor };
  const boardEl = typeof document !== 'undefined' && document.getElementById('ttt-board');
  if (!boardEl) return;

  /* ---------- 界面 ---------- */
  const NAMES = { random: '随机', greedy: '贪心', depth: '深度 2 + 评估', minimax: 'Minimax', ab: 'α-β 剪枝', mcts: 'MCTS' };
  const ORDER = ['random', 'greedy', 'depth', 'minimax', 'ab', 'mcts'];
  const CELL = ['左上角', '上边', '右上角', '左边', '正中', '右边', '左下角', '下边', '右下角'];
  const $ = id => document.getElementById(id);
  const msgEl = $('ttt-msg'), statsEl = $('ttt-stats'), turnEl = $('ttt-turn'), viewEl = $('ttt-view'), mindEl = $('ttt-mind'), mindH = $('ttt-mind-h');
  const cmpBtn = $('ttt-cmp'), cmpBody = $('ttt-cmp-t').tBodies[0];
  const b = Array(9).fill(null);
  const tally = { X: 0, O: 0, D: 0 };
  let level = 'ab', iters = 1000, over = false, aiTurn = false, timer = 0, last = null;
  const fmtMs = ms => (ms < 1 ? '< 1 ms' : Math.round(ms) + ' ms');

  function run(lv, bd, me) {
    const t0 = now();
    const res = AI[lv](bd, me, { iters: iters });
    res.ms = now() - t0;
    return res;
  }
  function workText(lv, res) {
    if (lv === 'random') return '0';
    if (lv === 'greedy') return '试下 ' + res.work + ' 次';
    if (lv === 'mcts') return '模拟 ' + G.fmt(res.work) + ' 局';
    return G.fmt(res.work) + ' 个局面';
  }

  function render() {
    const r = winner(b), win = r ? r.line : [];
    const ev = viewEl.checked && !over && !aiTurn ? perfectFor(b, 'X') : {};
    boardEl.innerHTML = b.map((v, i) => {
      const e = ev[i];
      const tag = e == null ? '' : '<span class="ev ' + (e > 0 ? 'w' : e < 0 ? 'l' : 'd') + '">' + (e > 0 ? '你能赢' : e < 0 ? '你会输' : '平局') + '</span>';
      return '<button type="button" class="cell' + (v ? ' ' + v.toLowerCase() : '') + (win.indexOf(i) >= 0 ? ' win' : '') + '" data-i="' + i + '"' +
        (v || over || aiTurn ? ' disabled' : '') + ' aria-label="' + CELL[i] + (v ? '：' + v : '：空') + '">' + (v || '') + tag + '</button>';
    }).join('');
    turnEl.textContent = over ? 'GAME OVER' : aiTurn ? 'AI THINKING…' : 'YOUR TURN';
    $('ttt-sx').textContent = tally.X; $('ttt-so').textContent = tally.O; $('ttt-sd').textContent = tally.D;
  }
  function renderMind() {
    if (!last) {
      mindH.textContent = 'AI 的草稿纸';
      mindEl.innerHTML = Array(9).fill('<span class="mc"></span>').join('');
      return;
    }
    mindH.textContent = 'AI 的草稿纸 · ' + NAMES[last.lv] + '（上一步）';
    mindEl.innerHTML = last.bd.map((v, i) => {
      if (v) return '<span class="mc stone ' + v.toLowerCase() + '">' + v + '</span>';
      const c = last.res.cells[i] || { t: '', c: 'n' };
      return '<span class="mc s-' + c.c + (i === last.res.move ? ' chosen' : '') + '"><b>' + c.t + '</b>' + (c.sub ? '<small>' + c.sub + '</small>' : '') + '</span>';
    }).join('');
  }

  function sayFor(lv, res) {
    if (lv === 'random') return '随便下一个，反正我是人工智障。';
    if (lv === 'greedy') return (res.kind === 'win' ? '能赢就赢。' : res.kind === 'block' ? '能堵就堵。' : '没得赢也没得堵，随便下一个。') + '（我只看一步）';
    if (lv === 'depth') return res.value > WIN - 10 ? '这步下去就赢。' : res.value < 10 - WIN ? '……怎么下都要输。' : '我只往前看 2 步（我一步、你一步），再往后的交给评估函数估分。';
    if (lv === 'mcts') return '模拟了 ' + G.fmt(res.work) + ' 局，这一步试得最多（' + res.visits + ' 次），胜率约 ' + Math.round(res.rate * 100) + '%（平局算半盘）。';
    return res.value > 0 ? '我已经算到赢了。' : res.value === 0 ? '这局最多是平局。' : '……我算到要输了。';
  }
  function statFor(lv, res) {
    const ms = '，用时 ' + fmtMs(res.ms);
    if (lv === 'random') return 'AI 上一步：不搜索，直接随机。';
    if (lv === 'greedy') return 'AI 上一步：试下了 ' + res.work + ' 次（能不能赢、要不要堵），没有往后看。';
    if (lv === 'depth') return 'AI 上一步：只搜 2 层，看了 ' + G.fmt(res.work) + ' 个局面，叶子用评估函数打分' + ms + '。';
    if (lv === 'minimax') return 'AI 上一步：完整 Minimax 搜到终局，看了 ' + G.fmt(res.work) + ' 个局面' + ms + '。';
    if (lv === 'mcts') return 'AI 上一步：模拟了 ' + G.fmt(res.work) + ' 局，搜索树长到 ' + G.fmt(res.size) + ' 个节点' + ms + '。';
    const plain = AI.minimax(last.bd.slice(), 'O').work;
    return 'AI 上一步：α-β 看了 ' + G.fmt(res.work) + ' 个局面；不剪枝要 ' + G.fmt(plain) + ' 个，省了 ' + Math.round((1 - res.work / plain) * 100) + '%' + ms + '。';
  }
  function endMessage(w) {
    const strong = level === 'minimax' || level === 'ab';
    if (w === 'X') {
      if (strong) return '……你赢了？这不应该发生。请检查一下是不是有 bug。';
      if (level === 'mcts') return '你赢了。我只模拟了 ' + G.fmt(iters) + ' 局，漏看了你的杀招。把模拟次数调高再试试。';
      if (level === 'depth') return '你赢了。我只看 2 步，你的杀招在第 3 步以后，这叫「地平线效应」。';
      if (level === 'greedy') return '你赢了。贪心只看一步，被你做了个双杀，这就是只顾眼前的下场。';
      return '你赢了。不过我是随机下的，赢我不算本事。';
    }
    if (w === 'O') {
      if (strong) return '我赢了。Minimax 不会放水。';
      if (level === 'mcts') return '我赢了。随机模拟够多，也能找到好棋。';
      if (level === 'depth') return '我赢了。看 2 步再加一个靠谱的评估函数，已经够对付大多数人了。';
      if (level === 'greedy') return '贪心都能赢你？要不要再想想。';
      return '随便下也能赢……你是认真的吗？';
    }
    return strong ? '平局。恭喜，这已经是人类在这个难度下的最好成绩了。' : '平局。';
  }
  function afterMove() {
    const r = winner(b);
    if (r) {
      over = true;
      tally[r.w === 'D' ? 'D' : r.w]++;
      msgEl.textContent = endMessage(r.w);
    }
    render();
  }
  function aiPlay() {
    aiTurn = true; render();
    clearTimeout(timer);
    timer = setTimeout(() => {
      const before = b.slice();
      const res = run(level, b, 'O');
      last = { bd: before, res: res, lv: level };
      msgEl.textContent = sayFor(level, res);
      statsEl.textContent = statFor(level, res);
      b[res.move] = 'O';
      aiTurn = false;
      renderMind();
      afterMove();
    }, G.reduced ? 0 : 380);
  }
  boardEl.addEventListener('click', e => {
    const c = e.target.closest('.cell');
    if (!c || over || aiTurn) return;
    const i = +c.getAttribute('data-i');
    if (b[i]) return;
    b[i] = 'X';
    afterMove();
    if (!over) aiPlay();
  });
  function newGame(aiFirst) {
    clearTimeout(timer);
    b.fill(null); over = false; aiTurn = false; last = null;
    msgEl.textContent = aiFirst ? '这次我先下。' : '你先下。友情提示：在 Minimax 和 α-β 难度下，平局就是人类的最好成绩。';
    statsEl.textContent = 'AI 上一步：还没下';
    renderMind();
    render();
    if (aiFirst) aiPlay();
  }

  /* 对比：六种算法替你（X）想这一步 */
  function compare() {
    if (aiTurn) return;
    if (over) { cmpBody.innerHTML = '<tr><td colspan="5" class="muted">这局已经结束了。点「再来一局」，下到一半再来比。</td></tr>'; return; }
    cmpBtn.disabled = true;
    cmpBody.innerHTML = '<tr><td colspan="5" class="muted">计算中…</td></tr>';
    setTimeout(() => {
      const exact = perfectFor(b, 'X');
      const bestV = Math.max.apply(null, Object.keys(exact).map(k => exact[k]));
      const cls = v => (v > 0 ? 1 : v < 0 ? -1 : 0);
      cmpBody.innerHTML = ORDER.map(lv => {
        const res = run(lv, b, 'X');
        const v = exact[res.move], ok = cls(v) === cls(bestV);
        const out = (v > 0 ? '能赢' : v < 0 ? '会输' : '平局') + (ok ? '' : bestV > 0 ? '（本可以赢）' : '（本可以平）');
        return '<tr' + (lv === level ? ' class="on"' : '') + '><td>' + NAMES[lv] + '</td><td>' + CELL[res.move] + '</td><td class="num">' + workText(lv, res) +
          '</td><td class="num">' + fmtMs(res.ms) + '</td><td class="' + (ok ? 'good' : 'bad') + '">' + out + '</td></tr>';
      }).join('');
      cmpBtn.disabled = false;
    }, 30);
  }

  G.$$('#ttt-level button').forEach(btn => btn.addEventListener('click', () => {
    level = btn.getAttribute('data-l');
    G.$$('#ttt-level button').forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
    render();
  }));
  G.$$('#ttt-iters button').forEach(btn => btn.addEventListener('click', () => {
    iters = +btn.getAttribute('data-n');
    G.$$('#ttt-iters button').forEach(x => x.setAttribute('aria-pressed', String(x === btn)));
  }));
  viewEl.addEventListener('change', render);
  $('ttt-new').addEventListener('click', () => newGame(false));
  $('ttt-first').addEventListener('click', () => newGame(true));
  cmpBtn.addEventListener('click', compare);
  renderMind();
  render();
})();
