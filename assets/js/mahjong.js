/* 2-2 麻将「何切」。每巡打掉一张牌，让「还差几步听牌」（向听数）最少；一样的话，让「能让你前进的牌」（进张）最多 */
(function () {
  'use strict';
  const handEl = document.getElementById('mj-hand');

  /* ---------- 牌：0-8 万，9-17 筒，18-26 条，27-33 东南西北白发中 ---------- */
  const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const HONOR = ['东', '南', '西', '北', '白', '发', '中'];
  const SUIT = ['万', '筒', '条'];
  const nameOf = t => (t < 27 ? (t % 9 + 1) + SUIT[Math.floor(t / 9)] : HONOR[t - 27]);

  /* 一般型向听数：8 − 2×面子 − 搭子 − 雀头（搭子最多算到 4 − 面子） */
  function normalShanten(c) {
    let best = 8;
    function dfs(i, m, t, p) {
      while (i < 34 && c[i] === 0) i++;
      if (i >= 34) {
        const s = 8 - 2 * m - Math.min(t, 4 - m) - p;
        if (s < best) best = s;
        return;
      }
      const num = i < 27 ? i % 9 : -1;
      if (c[i] >= 3) { c[i] -= 3; dfs(i, m + 1, t, p); c[i] += 3; }
      if (num >= 0 && num <= 6 && c[i + 1] && c[i + 2]) { c[i]--; c[i + 1]--; c[i + 2]--; dfs(i, m + 1, t, p); c[i]++; c[i + 1]++; c[i + 2]++; }
      if (!p && c[i] >= 2) { c[i] -= 2; dfs(i, m, t, 1); c[i] += 2; }
      if (m + t < 4) {
        if (c[i] >= 2) { c[i] -= 2; dfs(i, m, t + 1, p); c[i] += 2; }
        if (num >= 0 && num <= 7 && c[i + 1]) { c[i]--; c[i + 1]--; dfs(i, m, t + 1, p); c[i]++; c[i + 1]++; }
        if (num >= 0 && num <= 6 && c[i + 2]) { c[i]--; c[i + 2]--; dfs(i, m, t + 1, p); c[i]++; c[i + 2]++; }
      }
      c[i]--; dfs(i, m, t, p); c[i]++;
    }
    dfs(0, 0, 0, 0);
    return best;
  }
  /* 七对子向听数 */
  function chiitoiShanten(c) {
    let pairs = 0, kinds = 0;
    for (let i = 0; i < 34; i++) { if (c[i] >= 1) kinds++; if (c[i] >= 2) pairs++; }
    return 6 - pairs + Math.max(0, 7 - kinds);
  }
  const shanten = c => Math.min(normalShanten(c), chiitoiShanten(c));

  /* 14 张牌：列出打掉每一种牌之后的向听数和进张，按贪心规则排序 */
  function analyze(c14) {
    const c = c14.slice(), res = [];
    for (let t = 0; t < 34; t++) {
      if (!c[t]) continue;
      c[t]--;
      const s = shanten(c);
      let uk = 0;
      const kinds = [];
      for (let u = 0; u < 34; u++) {
        const left = 4 - c14[u];
        if (left <= 0) continue;
        c[u]++;
        if (shanten(c) < s) { uk += left; kinds.push(u); }
        c[u]--;
      }
      c[t]++;
      res.push({ t: t, s: s, uk: uk, kinds: kinds });
    }
    res.sort((a, b) => a.s - b.s || b.uk - a.uk || a.t - b.t);
    return res;
  }
  const countsOf = tiles => { const c = new Array(34).fill(0); tiles.forEach(t => { c[t]++; }); return c; };
  if (typeof window !== 'undefined') window.MJ = { shanten: shanten, analyze: analyze, countsOf: countsOf, nameOf: nameOf };
  if (!handEl) return;

  /* ---------- 牌面 ---------- */
  function tileHTML(t, extra) {
    if (t >= 27) {
      const cls = t === 32 ? ' g' : t === 33 ? ' r' : '';
      return '<span class="tile z' + cls + (extra || '') + '"><span class="n">' + HONOR[t - 27] + '</span></span>';
    }
    const suit = ['m', 'p', 's'][Math.floor(t / 9)], n = t % 9;
    const face = suit === 'm' ? CN[n] : String(n + 1);
    return '<span class="tile ' + suit + (extra || '') + '"><span class="n">' + face + '</span><span class="s">' + SUIT[Math.floor(t / 9)] + '</span></span>';
  }

  /* ---------- 牌局 ---------- */
  const EXAMPLE = [1, 2, 3, 5, 6, 11, 12, 13, 13, 18, 19, 24, 26, 30];   // 234万 67万 345筒 5筒 12条 79条 北
  const LIMIT = 18;   // 一局大约每人摸 18 次牌
  let hand = [], drawn = -1, wall = [], turn = 0, done = false, autoTimer = 0;
  const $ = id => document.getElementById(id);
  const statusEl = $('mj-status'), rankEl = $('mj-rank'), waitsEl = $('mj-waits'), logEl = $('mj-log'), turnEl = $('mj-turn'), autoBtn = $('mj-auto');

  function freshWall(exclude) {
    const w = [];
    const used = countsOf(exclude);
    for (let t = 0; t < 34; t++) for (let k = used[t]; k < 4; k++) w.push(t);
    for (let i = w.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [w[i], w[j]] = [w[j], w[i]]; }
    return w;
  }
  function deal(tiles) {
    stopAuto();
    const all = tiles.slice();
    drawn = all.pop();
    hand = all.sort((a, b) => a - b);
    wall = freshWall(tiles);
    turn = 0; done = false;
    logEl.innerHTML = '摸进来的牌放在最右边。点任意一张牌打出去，或者让贪心帮你选。';
    render();
  }
  function allTiles() { return drawn >= 0 ? hand.concat([drawn]) : hand.slice(); }
  const shText = s => (s < 0 ? '和了！' : s === 0 ? '听牌：只差一张就和' : s + ' 向听：再前进 ' + s + ' 步才听牌');

  function render() {
    const tiles = allTiles(), c = countsOf(tiles);
    const res = done ? [] : analyze(c);
    const best = res[0];
    const cur = shanten(c);
    handEl.innerHTML = hand.map((t, i) => tileHTML(t, best && t === best.t && !hand.slice(0, i).includes(t) && drawn !== best.t ? ' best' : '').replace('<span class="tile', '<button type="button" data-i="' + i + '" class="tile').replace(/<\/span>$/, '</button>')).join('') +
      (drawn >= 0 ? tileHTML(drawn, ' drawn' + (best && drawn === best.t ? ' best' : '')).replace('<span class="tile', '<button type="button" data-i="d" class="tile').replace(/<\/span>$/, '</button>') : '');
    statusEl.innerHTML = (cur < 0 ? '和了！' : '现在：' + (best ? shText(best.s) : '')) + '<small>第 ' + turn + ' 巡 · 牌山还剩 ' + wall.length + ' 张</small>';
    turnEl.textContent = 'TURN ' + turn;
    if (!res.length) { rankEl.innerHTML = ''; waitsEl.innerHTML = ''; return; }
    const maxUk = Math.max(1, ...res.map(r => r.uk));
    rankEl.innerHTML = res.slice(0, 6).map((r, k) =>
      '<div class="mj-row' + (k === 0 ? ' top' : '') + '">' + tileHTML(r.t, ' small') +
      '<span class="sh">' + (r.s === 0 ? '打完听牌' : '打完 ' + r.s + ' 向听') + '</span>' +
      '<span class="ukb"><i style="width:' + (r.uk / maxUk * 100).toFixed(1) + '%"></i></span>' +
      '<span class="uk">进张 ' + r.uk + ' 张</span></div>').join('');
    waitsEl.innerHTML = best.kinds.map(u => tileHTML(u, ' small')).join('');
    $('mj-best').textContent = '打「' + nameOf(best.t) + '」之后，摸到这 ' + best.kinds.length + ' 种牌（共 ' + best.uk + ' 张）都能让你往前一步：';
  }

  function discard(t, byHuman) {
    if (done) return;
    const tiles = allTiles(), c = countsOf(tiles), res = analyze(c), best = res[0];
    const mine = res.find(r => r.t === t);
    const i = tiles.indexOf(t);
    tiles.splice(i, 1);
    hand = tiles.sort((a, b) => a - b);
    drawn = -1;
    if (byHuman) {
      logEl.innerHTML = mine.t === best.t || (mine.s === best.s && mine.uk === best.uk)
        ? '你打了 <b>' + nameOf(t) + '</b>，和贪心的选择一样：' + (mine.s === 0 ? '听牌' : mine.s + ' 向听') + '，进张 ' + mine.uk + ' 张。'
        : '你打了 <b>' + nameOf(t) + '</b>：' + (mine.s === 0 ? '听牌' : mine.s + ' 向听') + '，进张 ' + mine.uk + ' 张。贪心会打 <b>' + nameOf(best.t) + '</b>（' + (best.s === 0 ? '听牌' : best.s + ' 向听') + '，进张 ' + best.uk + ' 张）' + (best.s < mine.s ? '，离听牌更近。' : '。');
    } else {
      logEl.innerHTML = '贪心打出 <b>' + nameOf(t) + '</b>：' + (best.s === 0 ? '听牌了' : '还差 ' + best.s + ' 步') + '，能前进的牌有 ' + best.uk + ' 张。';
    }
    if (turn >= LIMIT || !wall.length) {
      done = true; stopAuto();
      logEl.innerHTML += ' 摸了 ' + LIMIT + ' 巡还没和，流局。';
      render(); return;
    }
    drawn = wall.pop();
    turn++;
    if (shanten(countsOf(allTiles())) < 0) {
      done = true; stopAuto();
      logEl.innerHTML = '摸到 <b>' + nameOf(drawn) + '</b>，自摸和了！一共用了 <b>' + turn + '</b> 巡。（这里没有对手，真打牌时还得防别人）';
    }
    render();
  }
  function greedyStep() {
    if (done) return;
    const res = analyze(countsOf(allTiles()));
    discard(res[0].t, false);
  }
  function stopAuto() { clearTimeout(autoTimer); autoTimer = 0; if (autoBtn) { autoBtn.setAttribute('aria-pressed', 'false'); autoBtn.textContent = '自动打到和牌'; } }
  function autoLoop() { if (done) { stopAuto(); return; } greedyStep(); if (!done) autoTimer = setTimeout(autoLoop, 700); }

  handEl.addEventListener('click', e => {
    const b = e.target.closest('button.tile');
    if (!b || done) return;
    stopAuto();
    const i = b.getAttribute('data-i');
    discard(i === 'd' ? drawn : hand[+i], true);
  });
  $('mj-step').addEventListener('click', () => { stopAuto(); greedyStep(); });
  autoBtn.addEventListener('click', () => {
    if (autoTimer) { stopAuto(); return; }
    autoBtn.setAttribute('aria-pressed', 'true'); autoBtn.textContent = '停止';
    autoLoop();
  });
  $('mj-new').addEventListener('click', () => { const w = freshWall([]); deal(w.slice(0, 14)); });
  $('mj-example').addEventListener('click', () => deal(EXAMPLE));
  deal(EXAMPLE);
})();
