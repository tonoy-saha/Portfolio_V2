/* swarm.js - particle-swarm scroll reveal (needs swarm.css) */
(function () {
  'use strict';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return;
  canvas.className = 'swarm-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  var root = document.documentElement;
  var small = window.matchMedia('(max-width: 900px)');
  var LEAVES = 'h1,h2,h3,h4,p,img,i,a,button,.stat,.typed-line,.tl-card';
  var vw = 0, vh = 0, swarms = [], live = 0, running = false, last = 0;

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, small.matches ? 1.5 : 2);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  window.addEventListener('resize', size);

  function colors() {
    var cs = getComputedStyle(root);
    var a = (cs.getPropertyValue('--fx-rgb') || '').split(',').map(Number);
    if (a.length !== 3 || a.some(isNaN)) a = [110, 147, 255];
    var g = [240, 168, 28];
    var m = /^#([0-9a-f]{6})$/i.exec((cs.getPropertyValue('--fx-gold') || '').trim());
    if (m) g = [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    return { a: a, g: g };
  }

  function reveal(el) {
    if (el.classList.contains('reveal')) {
      el.classList.add('swarm-in');
      setTimeout(function () {
        el.classList.remove('swarm-in');
        el.classList.add('in-view', 'swarm-done');
      }, 1000);
    } else {
      el.classList.remove('sw-hold');
    }
  }

  function spawn(el) {
    if (!el.isConnected) return;
    var maxLive = small.matches ? 260 : 520;
    var r = el.getBoundingClientRect();
    var L = Math.max(r.left, 0), T = Math.max(r.top, 0), R = Math.min(r.right, vw), B = Math.min(r.bottom, vh);
    var area = (R - L) * (B - T);
    if (document.hidden || area <= 0 || maxLive - live < 12) { reveal(el); return; }

    var boxes = [], total = 0, kids = el.querySelectorAll(LEAVES);
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i].getBoundingClientRect();
      var l = Math.max(k.left, L), t = Math.max(k.top, T), rr = Math.min(k.right, R), b = Math.min(k.bottom, B);
      var a = (rr - l) * (b - t);
      if (a > 150) { boxes.push({ l: l, t: t, w: rr - l, h: b - t, a: a }); total += a; }
    }
    if (!boxes.length) { boxes.push({ l: L, t: T, w: R - L, h: B - T, a: area }); total = area; }

    var n = Math.round(area / 2600 * (small.matches ? 0.6 : 1));
    n = Math.max(28, Math.min(110, n, maxLive - live));
    var col = colors(), dir = Math.random() < 0.5 ? -1 : 1;
    var reach = small.matches ? [70, 190] : [120, 320], parts = [];

    for (var p = 0; p < n; p++) {
      var pick = Math.random() * total, bx = boxes[0];
      for (var j = 0; j < boxes.length; j++) { pick -= boxes[j].a; if (pick <= 0) { bx = boxes[j]; break; } }
      var tx = bx.l + Math.random() * bx.w - r.left;
      var ty = bx.t + Math.random() * bx.h - r.top;
      var ang = Math.random() * Math.PI * 2;
      var dist = reach[0] + Math.random() * (reach[1] - reach[0]);
      var sp = 140 + Math.random() * 160;
      parts.push({
        x: tx + Math.cos(ang) * dist, y: ty + Math.sin(ang) * dist, tx: tx, ty: ty,
        vx: -Math.sin(ang) * sp * dir, vy: Math.cos(ang) * sp * dir,
        delay: Math.random() * 0.3, leave: 1.15 + Math.random() * 0.5, ph: Math.random() * 6.28,
        s: 0.9 + Math.random() * 1.6, c: Math.random() < 0.3 ? col.g : col.a, gone: false, dead: false
      });
    }
    live += n;
    swarms.push({ el: el, parts: parts, t: 0, shown: false, dir: dir, n: n });
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  }

  function frame(now) {
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    ctx.clearRect(0, 0, vw, vh);
    ctx.lineCap = 'round';

    for (var si = swarms.length - 1; si >= 0; si--) {
      var s = swarms[si];
      s.t += dt;
      if (!s.el.isConnected) { live -= s.n; swarms.splice(si, 1); continue; }
      if (!s.shown && s.t >= (small.matches ? 0.45 : 0.55)) { s.shown = true; reveal(s.el); }

      var r = s.el.getBoundingClientRect(), alive = 0;
      for (var i = 0; i < s.parts.length; i++) {
        var p = s.parts[i];
        if (p.dead) continue;
        var lt = s.t - p.delay, alpha;
        if (lt < 0) { alive++; continue; }
        if (lt < p.leave) {
          var tx = p.tx + Math.sin(lt * 6 + p.ph) * 3, ty = p.ty + Math.cos(lt * 5 + p.ph) * 3;
          var dx = tx - p.x, dy = ty - p.y, sw = 5 * s.dir * Math.max(0, 1 - lt / 0.9);
          p.vx += (55 * dx - 10 * p.vx - dy * sw) * dt;
          p.vy += (55 * dy - 10 * p.vy + dx * sw) * dt;
          alpha = Math.min(1, lt / 0.2);
        } else {
          if (!p.gone) {
            p.gone = true;
            var a = Math.atan2(p.ty - r.height / 2, p.tx - r.width / 2) + (Math.random() - 0.5) * 1.6;
            var v = 60 + Math.random() * 130;
            p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
          }
          var drag = 1 - 2.2 * dt;
          p.vx *= drag; p.vy *= drag;
          alpha = 1 - (lt - p.leave) / 0.7;
          if (alpha <= 0) { p.dead = true; continue; }
        }
        p.x += p.vx * dt; p.y += p.vy * dt;
        alive++;

        var X = r.left + p.x, Y = r.top + p.y;
        if (X < -20 || X > vw + 20 || Y < -20 || Y > vh + 20) continue;
        var rgb = p.c[0] + ',' + p.c[1] + ',' + p.c[2];
        ctx.strokeStyle = 'rgba(' + rgb + ',' + (alpha * 0.45).toFixed(3) + ')';
        ctx.lineWidth = p.s * 0.9;
        ctx.beginPath(); ctx.moveTo(X - p.vx * 0.025, Y - p.vy * 0.025); ctx.lineTo(X, Y); ctx.stroke();
        ctx.fillStyle = 'rgba(' + rgb + ',' + (alpha * 0.14).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(X, Y, p.s * 3, 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba(' + rgb + ',' + (alpha * 0.95).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(X, Y, p.s, 0, 6.2832); ctx.fill();
      }
      if (!alive) { live -= s.n; swarms.splice(si, 1); }
    }

    if (swarms.length) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, vw, vh); }
  }

  /* wait for the intro loader to clear before the first swarm */
  function loaderWait() {
    var l = document.querySelector('.page-loader');
    if (!l || getComputedStyle(l).display === 'none') return 0;
    return Math.max(0, 1500 - performance.now());
  }

  var io = new IntersectionObserver(function (entries) {
    var ready = entries.filter(function (e) {
      return e.isIntersecting && (e.intersectionRatio >= 0.15 || e.intersectionRect.height > vh * 0.5);
    });
    ready.sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
    ready.forEach(function (e, i) {
      io.unobserve(e.target);
      setTimeout(function () { spawn(e.target); }, loaderWait() + i * 110);
    });
  }, { threshold: [0, 0.15, 0.5], rootMargin: '0px 0px -6% 0px' });

  Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (el) { io.observe(el); });

  /* project / certificate cards are rendered later from Firebase */
  function hold(card) {
    if (card.__sw) return;
    card.__sw = true;
    if (document.body.classList.contains('owning')) return;
    card.classList.add('sw-hold');
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

  root.classList.add('swarm-on');
})();
