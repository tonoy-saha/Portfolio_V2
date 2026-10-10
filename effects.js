/* effects.js — animations & graphics. Independent of script.js (Firebase/editing). */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ---------- scroll progress bar + timeline progress ---------- */
  var bar = document.createElement('div');
  bar.className = 'scroll-progress';
  document.body.appendChild(bar);
  var timeline = $('.timeline');

  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? h.scrollTop / max : 0) + ')';
    if (timeline) {
      var r = timeline.getBoundingClientRect();
      var p = (window.innerHeight * 0.62 - r.top) / r.height;
      p = Math.max(0, Math.min(1, p));
      timeline.style.setProperty('--tl', (p * 100).toFixed(1) + '%');
      $$('.tl-item', timeline).forEach(function (it) {
        it.classList.toggle('active', it.getBoundingClientRect().top < window.innerHeight * 0.65);
      });
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- cursor glow ---------- */
  if (fine && !reduce) {
    var glow = document.createElement('div');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);
    var gx = 0, gy = 0, tx = 0, ty = 0, raf = 0;
    document.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      glow.classList.add('on');
      if (!raf) raf = requestAnimationFrame(follow);
    });
    document.addEventListener('pointerleave', function () { glow.classList.remove('on'); });
    function follow() {
      gx += (tx - gx) * 0.16; gy += (ty - gy) * 0.16;
      glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      raf = (Math.abs(tx - gx) + Math.abs(ty - gy) > 0.5) ? requestAnimationFrame(follow) : 0;
    }
  }

  /* ---------- spotlight border + 3D tilt (event delegation: works on dynamic cards) ---------- */
  var SPOT = '.skill-card,.proj-card,.cert-card,.contact-item,.stat';
  var TILT = '.proj-card,.cert-card,.contact-item,.stat';
  document.addEventListener('pointermove', function (e) {
    var el = e.target.closest && e.target.closest(SPOT);
    if (!el) return;
    var r = el.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    el.style.setProperty('--mx', x + 'px');
    el.style.setProperty('--my', y + 'px');
    if (fine && !reduce && el.matches(TILT)) {
      var rx = ((y / r.height) - 0.5) * -8;
      var ry = ((x / r.width) - 0.5) * 8;
      el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-6px)';
    }
  });
  document.addEventListener('pointerout', function (e) {
    var el = e.target.closest && e.target.closest(TILT);
    if (el && !el.contains(e.relatedTarget)) el.style.transform = '';
  });

  /* ---------- typing effect ---------- */
  var typed = $('#typedText');
  if (typed) {
    var roles = (typed.getAttribute('data-roles') || '').split('|').filter(Boolean);
    if (roles.length) {
      if (reduce) {
        typed.textContent = roles[0];
      } else {
        var ri = 0, ci = 0, deleting = false;
        (function tick() {
          var word = roles[ri], wait = deleting ? 40 : 85;
          ci += deleting ? -1 : 1;
          typed.textContent = word.slice(0, ci);
          if (!deleting && ci === word.length) { wait = 1600; deleting = true; }
          else if (deleting && ci === 0) { deleting = false; ri = (ri + 1) % roles.length; wait = 350; }
          setTimeout(tick, wait);
        })();
      }
    }
  }

  /* ---------- hero particle network ---------- */
  var cv = $('#heroCanvas');
  if (cv && !reduce && cv.getContext) {
    var ctx = cv.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, pts = [], mouse = { x: -999, y: -999 }, running = false, looping = false, rgb = '110,147,255';
    var host = cv.parentNode;

    var readColor = function () {
      var v = getComputedStyle(document.documentElement).getPropertyValue('--fx-rgb');
      if (v && v.trim()) rgb = v.trim();
    };
    var size = function () {
      var r = host.getBoundingClientRect();
      W = r.width; H = r.height;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(70, (W * H) / 16000));
      while (pts.length < n) pts.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.4 + 0.8
      });
      pts.length = Math.min(pts.length, n);
    };
    var frame = function () {
      if (!running) { looping = false; return; }
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        var dx = p.x - mouse.x, dy = p.y - mouse.y, md = Math.sqrt(dx * dx + dy * dy);
        if (md < 120 && md > 0) { p.x += (dx / md) * 0.6; p.y += (dy / md) * 0.6; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + rgb + ',.65)';
        ctx.fill();
        for (var j = i + 1; j < pts.length; j++) {
          var q = pts[j], ax = p.x - q.x, ay = p.y - q.y, d = Math.sqrt(ax * ax + ay * ay);
          if (d < 120) {
            ctx.strokeStyle = 'rgba(' + rgb + ',' + ((1 - d / 120) * 0.3).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    };
    readColor(); size();
    window.addEventListener('resize', size);
    new MutationObserver(readColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    host.addEventListener('pointerleave', function () { mouse.x = mouse.y = -999; });
    new IntersectionObserver(function (entries) {
      running = entries[0].isIntersecting;
      if (running && !looping) { looping = true; requestAnimationFrame(frame); }
    }).observe(host);
  }

  /* ---------- animated counters (numbers come from the live cards) ---------- */
  var counters = $$('.stat-num');
  function countFor(key) {
    var sel = key === 'projects' ? '#projectsGrid .proj-card'
            : key === 'skills' ? '#skillsGrid .skill-card'
            : '#certsGrid .cert-card';
    return $$(sel).length;
  }
  function animateCount(el) {
    var to = countFor(el.getAttribute('data-count'));
    var from = parseInt(el.getAttribute('data-shown') || '0', 10);
    if (reduce || from === to) { el.textContent = to; el.setAttribute('data-shown', to); return; }
    var t0 = performance.now(), dur = 900;
    (function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step); else el.setAttribute('data-shown', to);
    })(t0);
  }
  if (counters.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.setAttribute('data-seen', '1'); animateCount(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (c) { c.textContent = '0'; io.observe(c); });
  }

  /* ---------- skills marquee ---------- */
  var mqTimer = 0;
  function buildMarquee() {
    var sec = $('.skillsSection'), grid = $('#skillsGrid');
    if (!sec || !grid) return;
    var old = $('.skills-marquee', sec);
    if (old) old.remove();
    var cards = $$('.skill-card', grid);
    if (!cards.length) { sec.classList.remove('has-marquee'); return; }
    var reps = Math.max(1, Math.ceil(1400 / (cards.length * 140)));
    var set = document.createElement('div');
    set.className = 'mq-set';
    for (var r = 0; r < reps; r++) {
      cards.forEach(function (c) {
        var k = c.cloneNode(true);
        var d = k.querySelector('.del'); if (d) d.remove();
        k.style.animationDelay = '';
        set.appendChild(k);
      });
    }
    var track = document.createElement('div');
    track.className = 'mq-track';
    track.appendChild(set);
    track.appendChild(set.cloneNode(true));
    track.style.animationDuration = Math.max(18, (cards.length * reps * 140) / 45) + 's';
    var wrap = document.createElement('div');
    wrap.className = 'skills-marquee';
    wrap.appendChild(track);
    grid.parentNode.insertBefore(wrap, grid);
    sec.classList.add('has-marquee');
  }

  /* ---------- watch the dynamic grids: stagger, counters, marquee ---------- */
  function onGridChange() {
    ['#skillsGrid', '#projectsGrid', '#certsGrid'].forEach(function (sel) {
      var g = $(sel);
      if (!g) return;
      $$(':scope > .skill-card, :scope > .proj-card, :scope > .cert-card', g).forEach(function (c, i) {
        c.style.animationDelay = (i * 70) + 'ms';
      });
    });
    counters.forEach(function (c) { if (c.getAttribute('data-seen')) animateCount(c); });
    clearTimeout(mqTimer);
    mqTimer = setTimeout(buildMarquee, 60);
  }
  var gridObs = new MutationObserver(onGridChange);
  ['#skillsGrid', '#projectsGrid', '#certsGrid'].forEach(function (sel) {
    var g = $(sel);
    if (g) gridObs.observe(g, { childList: true });
  });
  onGridChange();

  /* ---------- project detail pop-up ---------- */
  var pd = document.createElement('div');
  pd.className = 'pd-back';
  pd.innerHTML = '<div class="pd-modal" role="dialog" aria-modal="true"><button class="pd-x" type="button" aria-label="Close">&times;</button>' +
    '<div class="pd-media"></div><h2></h2><p></p><div class="pd-links"></div></div>';
  document.body.appendChild(pd);

  function closePd() { pd.classList.remove('show'); }
  function openPd(card) {
    var media = $('.pd-media', pd);
    media.innerHTML = '';
    var img = card.querySelector(':scope > img');
    var ico = card.querySelector(':scope > i');
    if (img) { var im = document.createElement('img'); im.src = img.src; im.alt = img.alt || ''; media.appendChild(im); }
    else if (ico) { media.appendChild(ico.cloneNode(true)); }
    var h = card.querySelector('h1'), p = card.querySelector('p');
    $('h2', pd).textContent = h ? h.textContent : '';
    $('p', pd).textContent = p ? p.textContent : '';
    var links = $('.pd-links', pd);
    links.innerHTML = '';
    $$('a.proj-link', card).forEach(function (a) {
      var c = a.cloneNode(true);
      c.className = '';
      links.appendChild(c);
    });
    pd.classList.add('show');
  }
  document.addEventListener('click', function (e) {
    var card = e.target.closest && e.target.closest('.proj-card');
    if (!card || e.target.closest('.del,.add-link-btn,.link-x,a,button')) return;
    openPd(card);
  });
  pd.addEventListener('click', function (e) { if (e.target === pd || e.target.closest('.pd-x')) closePd(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePd(); });
  /* ---------- mobile hamburger nav ---------- */
  var hdr = $('header'), burger = $('#navBurger');
  if (hdr && burger) {
    var setNav = function (open) {
      hdr.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      var ic = $('i', burger);
      if (ic) ic.className = open ? 'bi bi-x-lg' : 'bi bi-list';
    };
    burger.addEventListener('click', function (e) { e.stopPropagation(); setNav(!hdr.classList.contains('nav-open')); });
    hdr.addEventListener('click', function (e) { if (e.target.closest('.navbar a, .navbar button')) setNav(false); });
    document.addEventListener('click', function (e) { if (!hdr.contains(e.target)) setNav(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 960) setNav(false); });
  }
})();
