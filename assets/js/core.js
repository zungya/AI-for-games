/* NPC 脑内图鉴 · 公共工具：主题、导航、像素精灵、画布、网格 A* */
(function () {
  'use strict';
  var G = (window.G = {});
  document.documentElement.lang = 'zh-CN';

  G.$ = function (s, r) { return (r || document).querySelector(s); };
  G.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  G.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  G.lerp = function (a, b, t) { return a + (b - a) * t; };
  G.dist = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };
  G.pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };
  G.fmt = function (n) { return Number(n).toLocaleString('en-US'); };
  G.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 颜色 token ---------- */
  G.css = function (name, el) {
    return getComputedStyle(el || document.documentElement).getPropertyValue(name).trim();
  };
  var themeFns = [];
  G.onTheme = function (fn) { themeFns.push(fn); };
  function fireTheme() {
    themeFns.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fireTheme);
  new MutationObserver(fireTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* 主题切换：自动 → 日间 → 夜间。只有在页面里主动选过才写入 data-theme */
  var LABEL = { auto: '◐ 自动', light: '☀︎ 日间', dark: '☾ 夜间' };
  var ORDER = ['auto', 'light', 'dark'];
  var theme = 'auto';
  try { theme = localStorage.getItem('npc-theme') || 'auto'; } catch (e) {}
  if (!LABEL[theme]) theme = 'auto';
  function applyTheme(save) {
    var root = document.documentElement;
    if (theme === 'auto') { if (save) root.removeAttribute('data-theme'); }
    else root.setAttribute('data-theme', theme);
    var b = G.$('#theme-btn');
    if (b) b.textContent = LABEL[theme];
    if (save) { try { localStorage.setItem('npc-theme', theme); } catch (e) {} }
  }
  applyTheme(false);
  var themeBtn = G.$('#theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    theme = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    applyTheme(true);
  });

  /* 全屏 */
  var fsBtn = G.$('#fs-btn');
  if (fsBtn) {
    if (!document.documentElement.requestFullscreen) fsBtn.hidden = true;
    fsBtn.addEventListener('click', function () {
      try {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(function () {});
        else document.exitFullscreen().catch(function () {});
      } catch (e) {}
    });
  }

  /* ---------- 关卡导航与经验条 ---------- */
  var sections = G.$$('main > section[id]');
  var pills = G.$$('#stages a');
  var strip = G.$('#stages');
  var exp = G.$('#exp');
  var expBar = G.$('#exp-bar');
  var current = null;
  function worldOf(sec) {
    var m = /\bw([0-4])\b/.exec(sec.className);
    return m ? 'w' + m[1] : '';
  }
  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (expBar) expBar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0).toFixed(2) + '%';
    var cur = sections[0];
    var line = window.innerHeight * 0.38;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= line) cur = sections[i];
    }
    if (cur && cur !== current) {
      current = cur;
      pills.forEach(function (p) {
        var on = p.getAttribute('href') === '#' + cur.id;
        p.classList.toggle('on', on);
        if (on) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current');
        if (on && strip) {
          var left = p.offsetLeft - strip.clientWidth / 2 + p.offsetWidth / 2;
          strip.scrollTo({ left: Math.max(0, left), behavior: G.reduced ? 'auto' : 'smooth' });
        }
      });
      if (exp) exp.className = 'exp ' + worldOf(cur);
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; onScroll(); });
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ←/→、PageUp/PageDown 在关卡之间跳转（输入框、画布里不拦截） */
  window.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, canvas, [contenteditable="true"], .seg, .dpad')) return;
    var dir = 0;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') dir = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') dir = -1;
    if (!dir || !sections.length) return;
    e.preventDefault();
    var idx = sections.indexOf(current);
    var cur = sections[idx];
    // 当前章节顶部还没对齐时，← 先回到本章开头
    if (dir < 0 && cur && cur.getBoundingClientRect().top < -40) {
      cur.scrollIntoView({ behavior: G.reduced ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    var next = sections[G.clamp(idx + dir, 0, sections.length - 1)];
    if (next) next.scrollIntoView({ behavior: G.reduced ? 'auto' : 'smooth', block: 'start' });
  });

  /* ---------- 只在可见时运行的动画循环 ---------- */
  G.loop = function (el, step) {
    var vis = false, last = 0, raf = 0;
    function frame(t) {
      raf = 0;
      if (!vis) return;
      var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      step(dt, t);
      raf = requestAnimationFrame(frame);
    }
    var io = new IntersectionObserver(function (es) {
      vis = es[es.length - 1].isIntersecting;
      if (vis && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    }, { rootMargin: '120px' });
    io.observe(el);
    return { isVisible: function () { return vis; } };
  };

  /* ---------- 画布：逻辑坐标固定，按实际显示尺寸 × DPR 渲染 ---------- */
  G.canvas = function (cv, W, H, redraw) {
    var ctx = cv.getContext('2d');
    var api = { ctx: ctx, W: W, H: H, scale: 1 };
    cv.style.aspectRatio = W + ' / ' + H;
    function fit(skipRedraw) {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      var w = cv.clientWidth || W;
      var pw = Math.max(1, Math.round(w * dpr));
      var ph = Math.max(1, Math.round((w * H / W) * dpr));
      if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
      api.scale = pw / W;
      ctx.setTransform(api.scale, 0, 0, api.scale, 0, 0);
      ctx.imageSmoothingEnabled = false;
      if (redraw && skipRedraw !== true) redraw();
    }
    api.fit = fit;
    api.toLocal = function (e) {
      var r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
    };
    /* 首次只设置尺寸，不同步重绘：调用方此时可能还没初始化完自己的变量 */
    fit(true);
    if (window.ResizeObserver) new ResizeObserver(function () { fit(); }).observe(cv);
    else window.addEventListener('resize', function () { fit(); });
    return api;
  };

  G.roundRect = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  /* 画布上的对话气泡 */
  G.bubble = function (ctx, x, y, text, opt) {
    opt = opt || {};
    var font = opt.font || '700 12px "Noto Sans SC", "PingFang SC", sans-serif';
    ctx.font = font;
    var w = Math.ceil(ctx.measureText(text).width) + 14, h = 22;
    var bx = G.clamp(x - w / 2, 4, (opt.maxX || 9999) - w - 4), by = y - h - 8;
    ctx.fillStyle = opt.bg; ctx.strokeStyle = opt.border; ctx.lineWidth = 2;
    G.roundRect(ctx, bx, by, w, h, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 5, by + h - 1); ctx.lineTo(x, by + h + 6); ctx.lineTo(x + 5, by + h - 1); ctx.closePath();
    ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 5, by + h); ctx.lineTo(x, by + h + 6); ctx.lineTo(x + 5, by + h); ctx.stroke();
    ctx.fillStyle = opt.fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, bx + 7, by + h / 2 + 1);
  };

  /* ---------- 像素精灵 ---------- */
  var OL = '#1d1b24';
  G.SPR = {
    slime: { pal: { o: OL, g: '#59c96b', w: '#d9ffd0', e: OL, m: OL, d: '#2f9150' }, rows: [
      '.....oooo.....',
      '...oowwggoo...',
      '..owwggggggo..',
      '.owgggggggggo.',
      '.oggweggweggo.',
      'ogggeeggeegggo',
      'ogggggmmgggggo',
      'oggggggggggggo',
      'oddggggggggddo',
      '.oddddddddddo.',
      '..oooooooooo..'] },
    ghost: { pal: { o: OL, b: '#ff2a2a', w: '#ffffff', p: '#2553d6' }, rows: [
      '....oooooo....',
      '..oobbbbbboo..',
      '.obbbbbbbbbbo.',
      '.obwwbbbbwwbo.',
      'obwwwwbbwwwwbo',
      'obwwppbbwwppbo',
      'obwwppbbwwppbo',
      'obbwwbbbbwwbbo',
      'obbbbbbbbbbbbo',
      'obbbbbbbbbbbbo',
      'obbbbbbbbbbbbo',
      'obbbbbbbbbbbbo',
      'obbobbbbbbobbo',
      'oo.oo.oo.oo.oo'] },
    guard: { pal: { o: OL, h: '#5f7d4a', s: '#f0c39b', e: OL, m: '#b04a4a', u: '#6f8a52', b: '#3b3326' }, rows: [
      '...oooooo...',
      '..ohhhhhho..',
      '.ohhhhhhhho.',
      'oooooooooooo',
      '.ossessesso.',
      '.osssssssso.',
      '..ossmmsso..',
      '...oooooo...',
      '.ouuuuuuuuo.',
      'ouuuuuuuuuuo',
      'osuubbbbuuso',
      '.ouuuuuuuuo.',
      '.ouuo..ouuo.',
      '.oooo..oooo.'] },
    goblin: { pal: { o: OL, g: '#7cc242', r: '#ff4d4d', t: '#ffffff', a: '#e08a2e' }, rows: [
      '...oooooo...',
      'o.oggggggo.o',
      'ogoggggggogo',
      'oggoggggoggo',
      '.ogrggggrgo.',
      '.oggttttggo.',
      '..oggggggo..',
      '.oaaaaaaaao.',
      'oaaaaaaaaaao',
      'ogaaaaaaaago',
      '.oaao..oaao.',
      '.ooo....ooo.'] },
    sim: { pal: { o: OL, d: '#3ddc5a', h: '#6b3e26', s: '#f2c7a5', e: OL, m: '#c2455c', c: '#3a7bd5', p: '#2d2a3a' }, rows: [
      '.....oo.....',
      '....oddo....',
      '...oddddo...',
      '....oddo....',
      '.....oo.....',
      '...oooooo...',
      '..ohhhhhho..',
      '..ohssssho..',
      '..osesseso..',
      '..ossmmsso..',
      '...oossoo...',
      '..occcccco..',
      '.osccccccso.',
      '..oppoppo...'] },
    hero: { pal: { o: OL, m: '#c9ced8', b: '#3a6fe0', s: '#f2c7a5', y: '#f5c542' }, rows: [
      '...oooooo...',
      '..ommmmmmo..',
      '..omoooomo..',
      '..ommmmmmo..',
      '...oooooo...',
      '.obbbbbbbbo.',
      'obbbbbbbbbbo',
      'osbbbbbbbbso',
      '.obbyyyybbo.',
      '.obbbbbbbbo.',
      '.obbo..obbo.',
      '.ooo....ooo.'] },
    chest: { pal: { o: OL, w: '#b5651d', y: '#f5c542', k: OL }, rows: [
      '..oooooooo..',
      '.owwwwwwwwo.',
      'owwwwwwwwwwo',
      'oyyyyyyyyyyo',
      'owwwwyywwwwo',
      'owwwwkkwwwwo',
      'owwwwwwwwwwo',
      'oyyyyyyyyyyo',
      'owwwwwwwwwwo',
      'oooooooooooo'] },
    pawn: { pal: { o: OL, k: '#e9e6f2', h: '#ffffff' }, rows: [
      '....oooo....',
      '...okkkko...',
      '...okhkko...',
      '...okkkko...',
      '....oooo....',
      '...okkkko...',
      '....okko....',
      '....okko....',
      '...okkkko...',
      '..okkkkkko..',
      '.okkkkkkkko.',
      '.oooooooooo.'] },
    bird: { pal: { o: OL, b: '#6f98ff', e: '#ffffff', y: '#f5c542', w: '#3a5bd0' }, rows: [
      '....ooo.....',
      '...obbbo....',
      '..obebbbo...',
      'yyobbbbbboo.',
      '..obbbbbbbbo',
      '...obwwwbbo.',
      '....owwwwo..',
      '.....oooo...'] },
    clapper: { pal: { o: OL, w: '#f0eef6', k: '#4a4655' }, rows: [
      'oooooooooooo',
      'owwoowwoowwo',
      'oooooooooooo',
      'okkkkkkkkkko',
      'okwwwkkwwwko',
      'okkkkkkkkkko',
      'okwwkwwwkwko',
      'okkkkkkkkkko',
      'oooooooooooo'] }
  };
  /* 换色版：调色板交换是游戏界最古老的省钱技巧 */
  G.PAL = {
    soldier: { base: 'guard', pal: { h: '#3d4250', u: '#4a5160', e: '#ff5466', s: '#d9b08c' } },
    red: { base: 'ghost', pal: { b: '#ff2a2a' } },
    pink: { base: 'ghost', pal: { b: '#ffa3d6' } },
    cyan: { base: 'ghost', pal: { b: '#2fd9e0' } },
    orange: { base: 'ghost', pal: { b: '#ffb13d' } },
    fire: { base: 'slime', pal: { g: '#ff7a3d', w: '#ffd2b0', d: '#c4471c' } },
    water: { base: 'slime', pal: { g: '#4f8ff0', w: '#cfe2ff', d: '#2a5fb8' } },
    grass: { base: 'slime', pal: { g: '#59c96b', w: '#d9ffd0', d: '#2f9150' } },
    electric: { base: 'slime', pal: { g: '#f7d23a', w: '#fff6c4', d: '#c9a10f' } },
    ground: { base: 'slime', pal: { g: '#c99a5b', w: '#f1dcb8', d: '#8e6534' } }
  };
  function resolve(name, palName) {
    var key = name, extra = null;
    if (palName && G.PAL[palName]) { key = G.PAL[palName].base; extra = G.PAL[palName].pal; }
    else if (G.PAL[name]) { key = G.PAL[name].base; extra = G.PAL[name].pal; }
    var s = G.SPR[key];
    var pal = {};
    Object.keys(s.pal).forEach(function (k) { pal[k] = s.pal[k]; });
    if (extra) Object.keys(extra).forEach(function (k) { pal[k] = extra[k]; });
    return { rows: s.rows, pal: pal };
  }
  function runs(rows, cb) {
    for (var y = 0; y < rows.length; y++) {
      var row = rows[y], x = 0;
      while (x < row.length) {
        var c = row[x];
        if (c === '.') { x++; continue; }
        var x0 = x;
        while (x < row.length && row[x] === c) x++;
        cb(c, x0, y, x - x0);
      }
    }
  }
  G.spriteSVG = function (name, palName, override) {
    var r = resolve(name, palName);
    if (override) Object.keys(override).forEach(function (k) { r.pal[k] = override[k]; });
    var w = r.rows[0].length, h = r.rows.length, out = [];
    runs(r.rows, function (c, x, y, len) {
      out.push('<rect x="' + x + '" y="' + y + '" width="' + len + '" height="1" fill="' + (r.pal[c] || OL) + '"/>');
    });
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' + out.join('') + '</svg>';
  };
  G.spriteSize = function (name, palName) {
    var r = resolve(name, palName);
    return { w: r.rows[0].length, h: r.rows.length };
  };
  /* 在画布上画精灵；(x, y) 为左上角，px 为每像素大小 */
  G.drawSprite = function (ctx, name, x, y, px, palName, override) {
    var r = resolve(name, palName);
    if (override) Object.keys(override).forEach(function (k) { r.pal[k] = override[k]; });
    runs(r.rows, function (c, cx, cy, len) {
      ctx.fillStyle = r.pal[c] || OL;
      ctx.fillRect(x + cx * px, y + cy * px, len * px + 0.02, px + 0.02);
    });
  };
  G.hydrateSprites = function (root) {
    G.$$('.spr[data-s]', root).forEach(function (el) {
      el.innerHTML = G.spriteSVG(el.getAttribute('data-s'), el.getAttribute('data-pal'));
    });
  };
  G.hydrateSprites(document);

  /* ---------- 网格 A*（守卫寻路等共用） ---------- */
  /* blocked(i) 返回格子是否不可走；cols×rows 网格，4 方向，代价 1 */
  G.gridPath = function (cols, rows, blocked, sx, sy, gx, gy) {
    var N = cols * rows, start = sy * cols + sx, goal = gy * cols + gx;
    if (blocked(goal) || blocked(start)) return null;
    var g = new Float64Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    var heap = [];
    function push(f, i) {
      heap.push([f, i]);
      var k = heap.length - 1;
      while (k > 0) { var p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; var t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p; }
    }
    function pop() {
      var top = heap[0], end = heap.pop();
      if (heap.length) {
        heap[0] = end; var k = 0;
        for (;;) {
          var l = 2 * k + 1, r = l + 1, m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          var t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m;
        }
      }
      return top;
    }
    g[start] = 0; push(Math.abs(sx - gx) + Math.abs(sy - gy), start);
    while (heap.length) {
      var cur = pop()[1];
      if (closed[cur]) continue;
      if (cur === goal) break;
      closed[cur] = 1;
      var cx = cur % cols, cy = (cur - cx) / cols;
      var nb = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
      for (var k = 0; k < 4; k++) {
        var nx = nb[k][0], ny = nb[k][1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        var ni = ny * cols + nx;
        if (closed[ni] || blocked(ni)) continue;
        var ng = g[cur] + 1;
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; push(ng + Math.abs(nx - gx) + Math.abs(ny - gy), ni); }
      }
    }
    if (start !== goal && came[goal] < 0) return null;
    var path = [], c = goal;
    while (c !== -1) { path.push([c % cols, (c - (c % cols)) / cols]); if (c === start) break; c = came[c]; }
    return path.reverse();
  };

  /* 线段与矩形是否相交（视线检测） */
  G.segRect = function (x1, y1, x2, y2, r) {
    var t0 = 0, t1 = 1, dx = x2 - x1, dy = y2 - y1;
    var p = [-dx, dx, -dy, dy], q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else {
        var t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
    }
    return t0 <= t1;
  };
  /* 射线与矩形的最近交点参数 t（无交点返回 Infinity） */
  G.rayRect = function (x, y, dx, dy, r) {
    var tmin = -Infinity, tmax = Infinity;
    if (dx !== 0) { var a = (r.x - x) / dx, b = (r.x + r.w - x) / dx; tmin = Math.max(tmin, Math.min(a, b)); tmax = Math.min(tmax, Math.max(a, b)); }
    else if (x < r.x || x > r.x + r.w) return Infinity;
    if (dy !== 0) { var c = (r.y - y) / dy, d = (r.y + r.h - y) / dy; tmin = Math.max(tmin, Math.min(c, d)); tmax = Math.min(tmax, Math.max(c, d)); }
    else if (y < r.y || y > r.y + r.h) return Infinity;
    if (tmax < 0 || tmin > tmax) return Infinity;
    return tmin >= 0 ? tmin : Infinity;
  };

  G.ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
})();
