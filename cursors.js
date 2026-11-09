/* cursors.js — "multiplayer cursors" scroll reveal.
   When a section / card scrolls into view, several cursors appear (like Figma or
   Google Docs collaborators). Text is typed out live by the cursors; images are painted
   in tile by tile. Use INSTEAD of swarm.js / ambient.js. Needs cursors.css. */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  /* ---- easy knobs ---- */
  var COLORS = ['#e5484d', '#d97706', '#16a34a', '#4a63d6', '#9333ea', '#0891b2', '#ea580c', '#db2777', '#65a30d', '#0d9488'];
  var TEXT_SEL = 'h1,h2,h3,h4,p,.tl-date,.stat-label';
  var SKIP_SEL = '.del,button,script,style,.stat-num,.typed-line,.cur-skip';

  var root = document.documentElement;
  var small = window.matchMedia('(max-width: 900px)');
  var COUNT = small.matches ? 5 : 8;
  var vw = window.innerWidth, vh = window.innerHeight;
  window.addEventListener('resize', function () { vw = window.innerWidth; vh = window.innerHeight; });

  var layer = document.createElement('div');
  layer.className = 'cur-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);

  function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  var RGB = COLORS.map(hexRgb);

  var cursors = [], jobs = [], paints = [], running = false, last = 0;

  /* ---------- cursors ---------- */
  for (var ci = 0; ci < COUNT; ci++) {
    var el = document.createElement('div');
    el.className = 'cur';
    el.style.setProperty('--c', COLORS[ci % COLORS.length]);
    el.innerHTML = '<i class="cur-caret"></i>' +
      '<svg class="cur-arrow" width="16" height="20" viewBox="0 0 16 20"><path d="M1.5 1.5v14l3.6-3.4 2.9 6.6 2.7-1.2-2.9-6.5h5z" fill="currentColor" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    layer.appendChild(el);
    cursors.push({ el: el, rgb: RGB[ci % RGB.length], x: 0, y: 0, tx: 0, ty: 0, h: 0, hs: -1, typing: false, tcls: false,
      job: null, shown: false, idleSince: 0, freeAt: 0, seed: Math.random() * 6 });
  }

  function ensure() {
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  }

  /* ---------- blocks (a .reveal section or a card) ---------- */
  function finishBlock(b) {
    if (b.done) return;
    b.done = true;
    clearTimeout(b.guard);
    b.el.classList.remove('cur-in', 'cur-hold');
    b.el.classList.add('cur-done', 'in-view');
  }

  function textTargets(el) {
    var all = Array.prototype.slice.call(el.querySelectorAll(TEXT_SEL));
    if (el.matches(TEXT_SEL)) all.unshift(el);
    return all.filter(function (t) {
      if (t.closest(SKIP_SEL) && t.closest(SKIP_SEL) !== t) return false;
      if (t.matches(SKIP_SEL)) return false;
      return !all.some(function (o) { return o !== t && t.contains(o); });
    });
  }

  function prepText(el) {
    if (!el.getClientRects().length) return null;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.data.trim()) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        return (p.closest && p.closest(SKIP_SEL)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    if (!nodes.length) return null;
    var items = [], total = 0;
    nodes.forEach(function (orig) {
      var par = orig.parentNode;
      var typed = document.createTextNode('');
      var ghost = document.createElement('span');
      ghost.className = 'cur-ghost';
      var g = document.createTextNode(orig.data);
      ghost.appendChild(g);
      par.insertBefore(typed, orig); par.insertBefore(ghost, orig); par.removeChild(orig);
      items.push({ orig: orig, typed: typed, ghost: ghost, g: g, text: orig.data, pos: 0 });
      total += orig.data.length;
    });
    return { items: items, total: total };
  }

  function restoreText(job) {
    if (job.obs) { job.obs.disconnect(); job.dead = true; }
    job.items.forEach(function (it) {
      var par = it.ghost.parentNode;
      if (!par) return;
      par.insertBefore(it.orig, it.typed);
      par.removeChild(it.typed); par.removeChild(it.ghost);
    });
    job.items = [];
  }

  /* script.js fills editable text from Firebase with el.textContent = ..., which would wipe our
     ghost nodes. If that happens, re-ghost the new text right away (before it can paint). */
  function watchText(job) {
    var opts = { childList: true, subtree: true };
    job.obs = new MutationObserver(function () {
      if (job.dead) return;
      if (!job.items.some(function (it) { return !it.ghost.isConnected; })) return;
      job.obs.disconnect();
      var pr = prepText(job.el);
      if (pr) {
        job.items = pr.items; job.total = pr.total; job.ni = 0; job.acc = 0;
        job.cps = Math.max(30, Math.min(150, pr.total / 3.2));
      } else { job.items = []; job.ni = 0; }
      job.obs.observe(job.el, opts);
    });
    job.obs.observe(job.el, opts);
  }

  function waitImg(img, cb) {
    if (img.complete && img.naturalWidth) { cb(); return; }
    var done = false;
    function go() {
      if (done) return; done = true;
      img.removeEventListener('load', go); img.removeEventListener('error', go); cb();
    }
    img.addEventListener('load', go); img.addEventListener('error', go);
    setTimeout(go, 3000);
  }

  function roundRect(ctx, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(r, 0);
    ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r); ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r);
    ctx.closePath();
  }

  /* cover an image with a mosaic of tiles; cursors will paint them away one by one */
  function prepImage(img, b) {
    var par = img.parentNode;
    var restorePos = false;
    if (getComputedStyle(par).position === 'static') { par.style.position = 'relative'; restorePos = true; }
    var w = img.offsetWidth, h = img.offsetHeight;
    if (w < 60 || h < 40 || !img.getClientRects().length) { if (restorePos) par.style.position = ''; return null; }
    var k = (w * h < 60000 || small.matches) ? 2 : 3;
    var ts = Math.max(16, Math.min(56, Math.sqrt(w * h / (k * 50))));
    var cols = Math.ceil(w / ts), rows = Math.ceil(h / ts);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cv = document.createElement('canvas');
    cv.className = 'cur-paint';
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.left = img.offsetLeft + 'px'; cv.style.top = img.offsetTop + 'px';
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    par.appendChild(cv);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var cssR = getComputedStyle(img).borderTopLeftRadius || '0';
    var radius = cssR.indexOf('%') > -1 ? Math.min(w, h) * parseFloat(cssR) / 100 : (parseFloat(cssR) || 0);
    var dark = root.getAttribute('data-theme') === 'dark';
    var base = dark ? [30, 38, 58] : [218, 223, 240];
    var tiles = [];
    for (var i = 0; i < cols * rows; i++) {
      var j = Math.round((Math.random() - 0.5) * 12);
      tiles.push({ st: 0, t0: 0, fc: null, cover: 'rgb(' + (base[0] + j) + ',' + (base[1] + j) + ',' + (base[2] + j + 2) + ')' });
    }
    var st = { img: img, cv: cv, ctx: ctx, w: w, h: h, ts: ts, cols: cols, rows: rows, tiles: tiles, radius: radius,
      par: par, restorePos: restorePos, subLeft: k, finishAt: 0, b: b, removed: false };
    paints.push(st);

    /* k painters, each owns a band of columns and sweeps it in a snake pattern */
    var subs = [], per = Math.ceil(cols / k);
    for (var s = 0; s < k; s++) {
      var c0 = s * per, c1 = Math.min(cols, c0 + per), path = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < c1 - c0; c++) path.push(r * cols + (r % 2 ? c1 - 1 - c : c0 + c));
      }
      if (path.length) subs.push({ kind: 'paint', b: b, st: st, path: path, pi: 0, phase: 'go', t0: 0, nextAt: 0, lastPaint: 0 });
    }
    st.subLeft = subs.length;
    return subs;
  }

  function removePaint(st) {
    if (st.removed) return;
    st.removed = true;
    if (st.cv.parentNode) st.cv.parentNode.removeChild(st.cv);
    if (st.restorePos) st.par.style.position = '';
    var i = paints.indexOf(st); if (i > -1) paints.splice(i, 1);
    st.b.left--;
    if (st.b.left <= 0) finishBlock(st.b);
  }

  function drawPaint(st, now) {
    var ctx = st.ctx, ts = st.ts, im = st.img;
    if (im.offsetWidth && (im.offsetWidth !== st.cw || im.offsetHeight !== st.ch)) {
      st.cw = im.offsetWidth; st.ch = im.offsetHeight;
      st.cv.style.left = im.offsetLeft + 'px'; st.cv.style.top = im.offsetTop + 'px';
      st.cv.style.width = st.cw + 'px'; st.cv.style.height = st.ch + 'px';
    }
    ctx.clearRect(0, 0, st.w, st.h);
    ctx.save();
    roundRect(ctx, st.w, st.h, st.radius); ctx.clip();
    for (var i = 0; i < st.tiles.length; i++) {
      var t = st.tiles[i];
      if (t.st === 2) continue;
      var x = (i % st.cols) * ts, y = ((i / st.cols) | 0) * ts;
      if (t.st === 0) { ctx.fillStyle = t.cover; ctx.fillRect(x, y, ts + 0.5, ts + 0.5); }
      else {
        var a = 1 - (now - t.t0) / 340;
        if (a <= 0) { t.st = 2; continue; }
        ctx.fillStyle = 'rgba(' + t.fc[0] + ',' + t.fc[1] + ',' + t.fc[2] + ',' + (a * 0.6).toFixed(3) + ')';
        ctx.fillRect(x, y, ts + 0.5, ts + 0.5);
      }
    }
    ctx.restore();
  }

  function startBlock(el) {
    if (el.__cur) return;
    var b = el.__cur = { el: el, left: 0, done: false, jobs: [], guard: 0 };
    el.classList.remove('cur-hold');
    el.classList.add('cur-in');
    if (document.hidden || document.body.classList.contains('owning')) { finishBlock(b); return; }

    var items = [];
    textTargets(el).forEach(function (t) { items.push({ k: 'text', el: t }); });
    var imgs = Array.prototype.slice.call(el.querySelectorAll('img'));
    if (el.tagName === 'IMG') imgs.unshift(el);
    imgs.forEach(function (im) { items.push({ k: 'img', el: im }); });
    items.sort(function (a, c) { return (a.el.compareDocumentPosition(c.el) & 4) ? -1 : 1; });

    items.forEach(function (it) {
      if (it.k === 'text') {
        var pr = prepText(it.el);
        if (!pr) return;
        var job = { kind: 'text', b: b, el: it.el, items: pr.items, total: pr.total, ni: 0, phase: 'go', t0: 0,
          acc: 0, pauseUntil: 0, cps: Math.max(30, Math.min(150, pr.total / 3.2)) };
        watchText(job);
        b.left++; b.jobs.push(job); jobs.push(job);
      } else {
        b.left++;   /* reserved now, released when the painting ends (or if there is nothing to paint) */
        waitImg(it.el, function () {
          if (b.done) return;
          var subs = prepImage(it.el, b);
          if (!subs || !subs.length) { b.left--; if (b.left <= 0) finishBlock(b); return; }
          subs.forEach(function (s) { b.jobs.push(s); jobs.push(s); });
          ensure();
        });
      }
    });

    if (!b.left) { setTimeout(function () { finishBlock(b); }, 450); return; }
    b.guard = setTimeout(function () { forceFinish(b); }, 14000);   /* never leave content half-hidden */
    ensure();
  }

  function forceFinish(b) {
    if (b.done) return;
    b.jobs.forEach(function (j) {
      var q = jobs.indexOf(j); if (q > -1) jobs.splice(q, 1);
      cursors.forEach(function (c) { if (c.job === j) { c.job = null; c.idleSince = performance.now(); c.typing = false; c.h = 0; } });
      if (j.kind === 'text') restoreText(j);
    });
    paints.slice().forEach(function (st) { if (st.b === b) removePaint(st); });
    finishBlock(b);
  }

  /* ---------- jobs ---------- */
  function caretPos(job) {
    var it = job.items[job.ni];
    if (!it) return null;
    var r = it.ghost.getClientRects()[0];
    if (!r) { r = job.el.getBoundingClientRect(); return { x: r.left, y: r.top, h: Math.min(r.height, 24) }; }
    return { x: r.left, y: r.top, h: Math.max(12, r.height) };
  }

  /* move n characters from the hidden "ghost" text into the visible typed text */
  function advance(job, n) {
    var lastCh = '';
    while (n > 0 && job.ni < job.items.length) {
      var it = job.items[job.ni], left = it.text.length - it.pos, take = Math.min(n, left);
      lastCh = it.text.charAt(it.pos + take - 1);
      it.pos += take; n -= take;
      it.typed.data = it.text.slice(0, it.pos);
      it.g.data = it.text.slice(it.pos);
      if (it.pos >= it.text.length) job.ni++;
    }
    return lastCh;
  }

  function beginJob(c, job, now) {
    c.job = job; job.phase = 'go'; job.t0 = now;
    if (!c.shown) {
      c.shown = true; c.el.classList.add('on');
      c.x = Math.random() < 0.5 ? -40 : vw + 40; c.y = Math.random() * vh;
    }
  }

  function endJob(c, job, now) {
    if (job.kind === 'text') {
      restoreText(job);
      job.b.left--;
      if (job.b.left <= 0) finishBlock(job.b);
    } else {
      job.st.subLeft--;
      if (job.st.subLeft <= 0) job.st.finishAt = now + 380;   /* let the last flashes fade */
    }
    c.job = null; c.typing = false; c.h = 0;
    c.idleSince = now; c.freeAt = now + 160 + Math.random() * 260;
  }

  function updateJob(c, job, now, dt) {
    if (job.kind === 'text') {
      var cp = caretPos(job);
      if (!cp) { endJob(c, job, now); return; }
      c.tx = cp.x; c.ty = cp.y;
      if (cp.y < -60 || cp.y > vh + 60) { advance(job, 1e9); return; }   /* off-screen: finish instantly */
      if (job.phase === 'go') {
        c.h = 0; c.typing = false;
        if (Math.hypot(c.x - c.tx, c.y - c.ty) < 14 || now - job.t0 > 1100) job.phase = 'type';
        return;
      }
      c.typing = true; c.h = cp.h;
      if (now < job.pauseUntil) return;
      job.acc += job.cps * dt * (0.85 + 0.3 * Math.sin(now / 180 + c.seed));
      var n = Math.floor(job.acc);
      if (n > 0) {
        job.acc -= n;
        var ch = advance(job, n);
        if (/[.!?]/.test(ch)) job.pauseUntil = now + 150 + Math.random() * 100;
        else if (/[,;:]/.test(ch)) job.pauseUntil = now + 70;
        else if (Math.random() < 0.025) job.pauseUntil = now + 80 + Math.random() * 80;
      }
      if (job.ni >= job.items.length) endJob(c, job, now);
    } else {
      var st = job.st;
      if (job.pi >= job.path.length) { endJob(c, job, now); return; }
      var r = st.cv.getBoundingClientRect(), sx = r.width / st.w, sy = r.height / st.h;
      var idx = job.path[job.pi], col = idx % st.cols, row = (idx / st.cols) | 0;
      c.tx = r.left + (col * st.ts + st.ts / 2) * sx; c.ty = r.top + (row * st.ts + st.ts / 2) * sy;
      c.h = 0; c.typing = false;
      var d = Math.hypot(c.x - c.tx, c.y - c.ty);
      if (job.phase === 'go') {
        if (d < 30 || now - job.t0 > 900) { job.phase = 'paint'; job.nextAt = now; job.lastPaint = now; }
        return;
      }
      if (now >= job.nextAt && (d < st.ts * 1.2 || now - job.lastPaint > 160)) {
        var t = st.tiles[idx];
        t.st = 1; t.t0 = now; t.fc = c.rgb;
        job.pi++; job.lastPaint = now; job.nextAt = now + 48 + Math.random() * 45;
      }
    }
  }

  /* ---------- main loop ---------- */
  function frame(now) {
    var dt = Math.min(0.033, (now - last) / 1000); last = now;

    for (var i = 0; i < cursors.length; i++) {
      var c = cursors[i];
      if (!c.job && jobs.length && now >= c.freeAt) beginJob(c, jobs.shift(), now);
      if (c.job) updateJob(c, c.job, now, dt);
      else if (c.shown && !jobs.length && now - c.idleSince > 1600) { c.shown = false; c.el.classList.remove('on'); }

      var k = (c.job && c.job.kind === 'paint') ? 14 : (c.typing ? 20 : 6.5);
      var f = Math.min(1, dt * k);
      c.x += (c.tx - c.x) * f; c.y += (c.ty - c.y) * f;
      c.el.style.transform = 'translate3d(' + c.x.toFixed(1) + 'px,' + c.y.toFixed(1) + 'px,0)';
      if (Math.abs(c.h - c.hs) > 0.5) { c.hs = c.h; c.el.style.setProperty('--h', c.h.toFixed(1) + 'px'); }
      if (c.typing !== c.tcls) { c.tcls = c.typing; c.el.classList.toggle('typing', c.typing); }
    }

    for (var p = paints.length - 1; p >= 0; p--) {
      var st = paints[p];
      drawPaint(st, now);
      if (st.finishAt && now >= st.finishAt) removePaint(st);
    }

    var alive = jobs.length || paints.length || cursors.some(function (q) { return q.job || q.shown; });
    if (alive) requestAnimationFrame(frame); else running = false;
  }

  /* ---------- triggering ---------- */
  function loaderWait() {
    var l = document.querySelector('.page-loader');
    if (!l || getComputedStyle(l).display === 'none') return 0;
    return Math.max(0, 1500 - performance.now());
  }
  function whenReady(fn, delay) {
    if (root.classList.contains('intro-running')) {
      window.addEventListener('intro:done', function () { setTimeout(fn, delay); }, { once: true });
    } else {
      setTimeout(fn, loaderWait() + delay);
    }
  }

  var io = new IntersectionObserver(function (entries) {
    var ready = entries.filter(function (e) {
      return e.isIntersecting && (e.intersectionRatio >= 0.15 || e.intersectionRect.height > vh * 0.5);
    });
    ready.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
    ready.forEach(function (e, i) {
      io.unobserve(e.target);
      whenReady(function () { startBlock(e.target); }, i * 350);
    });
  }, { threshold: [0, 0.15, 0.5], rootMargin: '0px 0px -6% 0px' });

  Array.prototype.forEach.call(document.querySelectorAll('.reveal, .footer'), function (el) { io.observe(el); });

  /* project + certificate cards arrive later from Firebase */
  function hold(card) {
    if (card.__curSeen) return;
    card.__curSeen = true;
    if (document.body.classList.contains('owning')) return;   /* no effects while you're editing */
    card.classList.add('cur-hold');
    io.observe(card);
  }
  ['#projectsGrid', '#certsGrid'].forEach(function (sel) {
    var g = document.querySelector(sel);
    if (!g) return;
    Array.prototype.forEach.call(g.children, function (c) { if (c.matches('.proj-card,.cert-card')) hold(c); });
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1 && n.matches('.proj-card,.cert-card')) hold(n);
        });
      });
    }).observe(g, { childList: true });
  });

  root.classList.add('cur-on');
})();
