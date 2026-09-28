/* Cinematic Clinic — motion + behaviour.
   Everything degrades: with JS off the page is complete, just still. */
(function () {
  var d = document, w = window, root = d.documentElement;
  var reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = w.matchMedia('(pointer: fine)').matches;
  var wide = function () { return w.innerWidth >= 860; };
  var lerp = function (a, b, n) { return a + (b - a) * n; };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  root.classList.add('js');
  if (reduce) root.classList.add('no-motion');

  /* ---------------------------------------------------------------
     1. Curtain — covers the first paint, lifts once we are ready,
        drops again on the way out so pages hand over instead of blink.
     --------------------------------------------------------------- */
  var curtain = d.querySelector('.curtain');
  function lift() {
    root.classList.add('is-ready');
    if (curtain) setTimeout(function () { curtain.classList.add('is-up'); }, reduce ? 0 : 120);
  }
  if (d.readyState === 'complete') lift();
  else w.addEventListener('load', lift);
  setTimeout(lift, 2200); // never trap the page behind a slow image

  d.addEventListener('click', function (e) {
    if (reduce || !curtain) return;
    var a = e.target.closest('a');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;
    if (a.host && a.host !== location.host) return;
    if (a.pathname === location.pathname) return;
    e.preventDefault();
    curtain.classList.remove('is-up');
    curtain.classList.add('is-down');
    setTimeout(function () { location.href = href; }, 460);
  });
  w.addEventListener('pageshow', function (e) { if (e.persisted && curtain) { curtain.classList.remove('is-down'); curtain.classList.add('is-up'); } });

  /* ---------------------------------------------------------------
     2. Smooth scroll — a weighted, inertial scroll on desktop only.
        Touch already has its own physics; reduced-motion opts out.
     --------------------------------------------------------------- */
  var scroller = d.getElementById('scroll');
  var smooth = !!scroller && !reduce && fine && wide();
  var current = 0, target = 0, running = false;

  function sizeBody() {
    if (!scroller) return;
    d.body.style.height = Math.round(scroller.getBoundingClientRect().height) + 'px';
  }
  function frame() {
    target = w.scrollY;
    current = lerp(current, target, 0.095);
    if (Math.abs(target - current) < 0.08) current = target;
    scroller.style.transform = 'translate3d(0,' + (-current).toFixed(2) + 'px,0)';
    parallax(current);
    if (running) requestAnimationFrame(frame);
  }
  function startSmooth() {
    if (!scroller || running) return;
    running = true;
    root.classList.add('has-smooth');
    scroller.style.position = 'fixed';
    scroller.style.top = '0'; scroller.style.left = '0'; scroller.style.width = '100%';
    scroller.style.willChange = 'transform';
    sizeBody();
    current = target = w.scrollY;
    requestAnimationFrame(frame);
    if ('ResizeObserver' in w) new ResizeObserver(sizeBody).observe(scroller);
  }
  function stopSmooth() {
    if (!scroller || !running) return;
    running = false;
    root.classList.remove('has-smooth');
    scroller.removeAttribute('style');
    d.body.style.height = '';
  }
  if (smooth) startSmooth();
  w.addEventListener('resize', function () {
    if (!scroller || reduce || !fine) return;
    if (wide() && !running) startSmooth();
    else if (!wide() && running) stopSmooth();
    else sizeBody();
  });
  // Skip-link and in-page anchors still need to land in the right place.
  d.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var el = id && d.getElementById(id);
    if (!el) return;
    e.preventDefault();
    var box = el.getBoundingClientRect();
    var top = box.top + (running ? current : w.scrollY) - 40;
    w.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---------------------------------------------------------------
     3. Word-mask reveals. Each word is wrapped so it can rise out of
        a mask; whole words only, never letters — Persian letters join
        and splitting them would break the script.
     --------------------------------------------------------------- */
  function splitWords(el) {
    if (el.dataset.split === '1') return;
    el.dataset.split = '1';
    var walker = d.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodes = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
    var i = 0;
    nodes.forEach(function (node) {
      var frag = d.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (!part.trim()) { frag.appendChild(d.createTextNode(part)); return; }
        var outer = d.createElement('span'); outer.className = 'w';
        var inner = d.createElement('span'); inner.className = 'wi';
        inner.textContent = part;
        inner.style.transitionDelay = (i * 38) + 'ms';
        i++;
        outer.appendChild(inner); frag.appendChild(outer);
      });
      node.parentNode.replaceChild(frag, node);
    });
  }
  if (!reduce) {
    d.querySelectorAll('.hero h1, .hero .display, .page-head h1, .closing h2, .led h3, .manifesto p, .section-head h2, .feature-meta h3').forEach(splitWords);
  }

  var io = 'IntersectionObserver' in w
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('in');
          io.unobserve(e.target);
          if (e.target.hasAttribute('data-count')) count(e.target);
        });
      }, // threshold 0 as well as 0.05: an element taller than the viewport can
         // never expose 5% of itself, so a tall block would never reveal at all.
         { rootMargin: '0px 0px -12% 0px', threshold: [0, 0.05] })
    : null;

  var watched = [].slice.call(d.querySelectorAll('.reveal, [data-split="1"], [data-count]'));
  var pending = [];
  watched.forEach(function (el) {
    // Already scrolled past — a restored scroll position or a deep link.
    if (el.getBoundingClientRect().bottom < 0) { el.classList.add('in'); return; }
    if (io) { io.observe(el); pending.push(el); } else el.classList.add('in');
  });
  // A jump (anchor, End key, restored position) crosses elements between two
  // frames, so the observer never samples them. Sweep up anything left behind.
  if (io && pending.length) {
    var sweeping = false;
    function sweep() {
      pending = pending.filter(function (el) {
        if (el.classList.contains('in')) return false;
        if (el.getBoundingClientRect().bottom >= 0) return true;
        el.classList.add('in');
        io.unobserve(el);
        if (el.hasAttribute('data-count')) count(el);
        return false;
      });
    }
    w.addEventListener('scroll', function () {
      if (!pending.length) return;
      if (sweeping) return;
      sweeping = true;
      requestAnimationFrame(function () { sweep(); sweeping = false; });
    }, { passive: true });
  }
  // Anything already on screen at load rises as part of the intro, not on scroll.
  d.querySelectorAll('.hero .reveal, .hero [data-split="1"]').forEach(function (el) { el.classList.add('in'); });

  /* ---------------------------------------------------------------
     4. Parallax — media drifts slower than the page inside its frame.
     --------------------------------------------------------------- */
  var par = [].slice.call(d.querySelectorAll('[data-parallax]'));
  function parallax() {
    if (reduce || !par.length) return;
    var vh = w.innerHeight;
    par.forEach(function (el) {
      var box = el.parentNode.getBoundingClientRect();
      if (box.top > vh || box.bottom < 0) return;
      var amount = parseFloat(el.getAttribute('data-parallax')) || 10;
      // -1 at the bottom of the viewport, +1 at the top
      var progress = clamp((box.top + box.height / 2 - vh / 2) / vh, -1, 1);
      // Composed in CSS so hover can still scale the same element.
      el.style.setProperty('--py', (-progress * amount).toFixed(2) + '%');
      el.style.setProperty('--pz', (1 + amount / 100).toFixed(3));
    });
  }
  if (!running && !reduce) {
    var ticking = false;
    w.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { parallax(); ticking = false; });
    }, { passive: true });
  }
  if (!reduce) parallax();

  /* ---------------------------------------------------------------
     5. Numbers count up when they arrive.
     --------------------------------------------------------------- */
  function count(el) {
    if (reduce) return;
    var raw = el.textContent, m = raw.match(/[\d,]+/);
    if (!m) return;
    var digits = m[0], endVal = parseInt(digits.replace(/,/g, ''), 10);
    if (!endVal || endVal > 100000) return;
    var grouped = digits.indexOf(',') > -1, t0 = null, dur = 1100;
    function tick(now) {
      if (!t0) t0 = now;
      var p = clamp((now - t0) / dur, 0, 1), eased = 1 - Math.pow(1 - p, 3);
      var v = Math.round(endVal * eased);
      el.textContent = raw.replace(digits, grouped ? v.toLocaleString('en-US') : String(v));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------------------------------------------------------------
     6. Cursor — a dot that becomes a word over things you can open.
     --------------------------------------------------------------- */
  if (fine && !reduce) {
    var cur = d.createElement('div');
    cur.className = 'cursor';
    cur.innerHTML = '<span class="cursor-dot"></span><span class="cursor-label"></span>';
    d.body.appendChild(cur);
    var label = cur.querySelector('.cursor-label');
    var cx = w.innerWidth / 2, cy = w.innerHeight / 2, tx = cx, ty = cy, on = false;
    d.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!on) { on = true; cur.classList.add('is-on'); }
    });
    d.addEventListener('mouseleave', function () { on = false; cur.classList.remove('is-on'); });
    (function loop() {
      cx = lerp(cx, tx, 0.18); cy = lerp(cy, ty, 0.18);
      cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
    d.addEventListener('mouseover', function (e) {
      var t = e.target.closest('[data-cursor], a, button');
      if (!t) { cur.classList.remove('is-big', 'is-link'); label.textContent = ''; return; }
      var text = t.getAttribute('data-cursor');
      if (text) { label.textContent = text; cur.classList.add('is-big'); cur.classList.remove('is-link'); }
      else { label.textContent = ''; cur.classList.add('is-link'); cur.classList.remove('is-big'); }
    });
  }

  /* ---------------------------------------------------------------
     7. Magnetic buttons — they lean toward the pointer, a little.
     --------------------------------------------------------------- */
  if (fine && !reduce) {
    d.querySelectorAll('.btn, .play-btn').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.22;
        var y = (e.clientY - r.top - r.height / 2) * 0.32;
        b.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      b.addEventListener('mouseleave', function () { b.style.transform = ''; });
    });
  }

  /* ---------------------------------------------------------------
     8. Header state + menu overlay.
     --------------------------------------------------------------- */
  var top = d.querySelector('.top'), lastY = 0;
  function header() {
    var y = running ? current : w.scrollY;
    if (top) {
      top.classList.toggle('is-solid', y > 24);
      top.classList.toggle('is-hidden', y > 480 && y > lastY && !d.body.classList.contains('nav-open'));
    }
    lastY = y;
  }
  w.addEventListener('scroll', header, { passive: true });
  header();

  var toggle = d.querySelector('.nav-toggle'), nav = d.getElementById('nav');
  if (toggle && nav) toggle.addEventListener('click', function () {
    var open = !d.body.classList.contains('nav-open');
    d.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav && nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) { d.body.classList.remove('nav-open'); toggle && toggle.setAttribute('aria-expanded', 'false'); }
  });

  /* ---------------------------------------------------------------
     9. Hero background film — only where it earns its bytes.
     --------------------------------------------------------------- */
  /* ---------------------------------------------------------------
     9. Live films. Anything marked [data-live] is a real film that plays,
        muted, while it is on screen: the hero, the band and a film page's
        stage always; in the rails, ONE card at a time — the one under the
        mouse, else the one nearest the middle of the screen. A player exists
        only while its film is on screen, so a page listing 189 films still
        runs one or two players, never 189.
        The still stays up until frames are really moving, then dissolves —
        no black flash, no YouTube chrome. [data-src] (a self-hosted MP4)
        always beats YouTube. Off for reduced motion, Save-Data and 2G, and
        behind the Pause control, which is remembered.
     --------------------------------------------------------------- */
  var conn = navigator.connection || {};
  var liveOff = reduce || conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  var PKEY = 'cc-films-paused';
  var paused = false;
  try { paused = localStorage.getItem(PKEY) === '1'; } catch (e) {}
  var ytReady = null;
  function loadYT() {
    if (ytReady) return ytReady;
    ytReady = new Promise(function (res) {
      if (w.YT && w.YT.Player) return res(w.YT);
      var prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = function () { if (prev) prev(); res(w.YT); };
      var sc = d.createElement('script');
      sc.src = 'https://www.youtube.com/iframe_api'; sc.async = true;
      d.head.appendChild(sc);
    });
    return ytReady;
  }
  function reveal(el, st, delay) {
    setTimeout(function () { if (el._live === st) el.classList.add('is-live'); }, delay);
  }
  function mount(el) {
    if (el._live || liveOff || paused || el.hasAttribute('data-live-off')) return;
    var st = {};
    el._live = st;
    var start = +el.getAttribute('data-start') || 0;
    var end = +el.getAttribute('data-end') || 0;
    var src = el.getAttribute('data-src');
    if (src) {
      var v = d.createElement('video');
      v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
      v.preload = 'auto'; v.tabIndex = -1; v.src = src;
      v.addEventListener('playing', function () { reveal(el, st, 60); }, { once: true });
      el.appendChild(v);
      var pr = v.play();
      if (pr && pr.catch) pr.catch(function () {});
      st.kill = function () { v.pause(); v.removeAttribute('src'); try { v.load(); } catch (e) {} v.remove(); };
      return;
    }
    var host = d.createElement('div');
    host.className = 'live-yt';
    el.appendChild(host);
    st.kill = function () { host.remove(); };
    loadYT().then(function (YT) {
      if (el._live !== st) return; // left the screen while the API loaded
      var loop = 0;
      var player = new YT.Player(host, {
        host: 'https://www.youtube-nocookie.com',
        videoId: el.getAttribute('data-live'),
        playerVars: { autoplay: 1, mute: 1, controls: 0, playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1, fs: 0, cc_load_policy: 0, start: start, origin: location.origin },
        events: {
          onReady: function (e) { try { e.target.mute(); e.target.playVideo(); } catch (x) {} },
          onStateChange: function (e) {
            // YouTube lays its title bar over the first seconds of playback;
            // the still covers until that has cleared.
            if (e.data === 1 && !st.shown) { st.shown = true; reveal(el, st, 2600); }
            if (e.data === 0) { try { e.target.seekTo(start, true); e.target.playVideo(); } catch (x) {} }
          }
        }
      });
      // Loop a second early, so YouTube's end screen never gets a frame.
      if (end > start + 3) loop = setInterval(function () {
        try { if (player.getCurrentTime && player.getCurrentTime() > end - 0.7) player.seekTo(start, true); } catch (x) {}
      }, 400);
      st.kill = function () {
        clearInterval(loop);
        try { player.destroy(); } catch (x) {}
        [].slice.call(el.querySelectorAll('iframe, .live-yt')).forEach(function (n) { n.remove(); });
      };
    });
  }
  function unmount(el, now) {
    var st = el._live;
    if (!st) return;
    el._live = null;
    el.classList.remove('is-live');
    // Let the still fade back over the film before the player goes, so the
    // hand-back is a dissolve, not a cut.
    if (now) st.kill && st.kill();
    else setTimeout(function () { if (!el._live || el._live !== st) st.kill && st.kill(); }, 500);
  }

  var stages = [].slice.call(d.querySelectorAll('.live-cover[data-live], .stage > .live[data-live]'));
  var cards = [].slice.call(d.querySelectorAll('.film .live[data-live]'));
  var stageSeen = new Set(), cardSeen = new Set();
  var hovered = null, activeCard = null, pickT = 0;
  function pickCard() {
    if (hovered && cardSeen.has(hovered)) return hovered;
    var cx = w.innerWidth / 2, cy = w.innerHeight / 2, best = null, bd = Infinity;
    cardSeen.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!r.width) return; // filtered out
      var dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy, dd = dx * dx + dy * dy;
      if (dd < bd) { bd = dd; best = el; }
    });
    return best;
  }
  function applyCard() {
    var next = paused || liveOff ? null : pickCard();
    if (next === activeCard) return;
    if (activeCard) unmount(activeCard);
    activeCard = next;
    if (activeCard) mount(activeCard);
  }
  // Waits for the scroll to settle, so skimming past forty films doesn't
  // start forty players.
  function schedule() { clearTimeout(pickT); pickT = setTimeout(applyCard, 300); }

  if (!liveOff && 'IntersectionObserver' in w) {
    var sio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { stageSeen.add(e.target); mount(e.target); }
        else { stageSeen.delete(e.target); unmount(e.target); }
      });
    }, { threshold: 0.12 });
    stages.forEach(function (el) { sio.observe(el); });
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.intersectionRatio >= 0.55) cardSeen.add(e.target); else cardSeen.delete(e.target); });
      schedule();
    }, { threshold: [0, 0.55, 0.9] });
    cards.forEach(function (el) { cio.observe(el); });
    w.addEventListener('scroll', schedule, { passive: true });
    w.addEventListener('resize', schedule);
    d.querySelectorAll('.carousel-track').forEach(function (tr) { tr.addEventListener('scroll', schedule, { passive: true }); });
    if (fine) d.addEventListener('mouseover', function (e) {
      var f = e.target.closest ? e.target.closest('.film') : null;
      var el = f ? f.querySelector('.live[data-live]') : null;
      if (el !== hovered) { hovered = el; clearTimeout(pickT); pickT = setTimeout(applyCard, el ? 140 : 600); }
    });
  }

  // Pause / play every film on the site — required for motion that starts on
  // its own (WCAG 2.2.2), and remembered between pages.
  var motion = [].slice.call(d.querySelectorAll('[data-motion]'));
  function paintMotion() {
    motion.forEach(function (b) {
      b.setAttribute('aria-pressed', paused ? 'true' : 'false');
      b.classList.toggle('is-paused', paused);
      var t = b.getAttribute(paused ? 'data-off' : 'data-on');
      var l = b.querySelector('.motion-label');
      if (l) l.textContent = t;
      b.title = t;
    });
  }
  if (!liveOff && (stages.length || cards.length)) {
    motion.forEach(function (b) {
      b.hidden = false;
      b.addEventListener('click', function () {
        paused = !paused;
        try { localStorage.setItem(PKEY, paused ? '1' : '0'); } catch (e) {}
        paintMotion();
        if (paused) { stages.forEach(function (el) { unmount(el); }); if (activeCard) unmount(activeCard); activeCard = null; }
        else { stageSeen.forEach(mount); applyCard(); }
      });
    });
    paintMotion();
  }

  // A film page's stage: the muted preview gives way to the full film, with
  // sound and controls, in the same frame.
  d.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-play-film]') : null;
    if (!b) return;
    e.preventDefault();
    var box = d.getElementById(b.getAttribute('aria-controls'));
    if (!box) return;
    box.setAttribute('data-live-off', '');
    unmount(box, true);
    stageSeen.delete(box);
    var id = b.getAttribute('data-play-film');
    var f = d.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.title = (d.querySelector('.film-h1') || {}).textContent || 'Film';
    box.appendChild(f);
    box.classList.add('is-player');
    b.hidden = true;
  });

  /* ---------------------------------------------------------------
     10. Lightbox, film facades, filters, forms.
     --------------------------------------------------------------- */
  var lb = d.getElementById('lightbox');
  function openLightbox(id) {
    if (!lb) return;
    lb.querySelector('.lightbox-frame').innerHTML =
      '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1" ' +
      'allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Film"></iframe>';
    lb.classList.add('is-open'); d.body.classList.add('is-locked');
  }
  function closeLightbox() {
    if (!lb) return;
    lb.classList.remove('is-open');
    lb.querySelector('.lightbox-frame').innerHTML = '';
    d.body.classList.remove('is-locked');
  }
  d.querySelectorAll('[data-lightbox]').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); openLightbox(b.getAttribute('data-lightbox')); });
  });
  if (lb) lb.addEventListener('click', function (e) { if (e.target === lb || e.target.closest('.lightbox-close')) closeLightbox(); });
  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeLightbox();
    d.body.classList.remove('nav-open');
  });

  d.addEventListener('click', function (e) {
    var a = e.target.closest('a.film[data-yt]');
    if (!a) return;
    e.preventDefault();
    var frame = a.querySelector('.film-frame');
    if (frame.classList.contains('is-player')) return;
    frame.setAttribute('data-live-off', '');
    unmount(frame, true);
    cardSeen.delete(frame);
    if (activeCard === frame) activeCard = null;
    frame.classList.add('is-player');
    var ifr = d.createElement('iframe');
    ifr.src = 'https://www.youtube-nocookie.com/embed/' + a.getAttribute('data-yt') + '?autoplay=1&rel=0&modestbranding=1';
    ifr.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    ifr.allowFullscreen = true;
    var t = a.querySelector('.film-title');
    ifr.title = t ? t.textContent : 'Video';
    frame.appendChild(ifr);
    a.classList.add('is-playing');
  });

  /* Carousel — drag/scroll natively, arrows for the keyboard and the mouse.
     Direction-aware so the arrows point the right way in Persian. */
  d.querySelectorAll('[data-carousel]').forEach(function (root) {
    var track = root.querySelector('.carousel-track');
    var prev = root.querySelector('[data-carousel-prev]');
    var next = root.querySelector('[data-carousel-next]');
    if (!track || !prev || !next) return;
    var rtl = getComputedStyle(track).direction === 'rtl';
    function step() {
      var card = track.querySelector('.film');
      var gap = parseFloat(getComputedStyle(track).columnGap || '16') || 16;
      return card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
    }
    function go(forward) {
      var amount = step() * (forward ? 1 : -1) * (rtl ? -1 : 1);
      track.scrollBy({ left: amount, behavior: reduce ? 'auto' : 'smooth' });
    }
    next.addEventListener('click', function () { go(true); });
    prev.addEventListener('click', function () { go(false); });
    function sync() {
      // scrollLeft goes negative in RTL, so compare on magnitude
      var x = Math.abs(track.scrollLeft);
      var max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = x <= 2;
      next.disabled = x >= max;
    }
    track.addEventListener('scroll', sync, { passive: true });
    w.addEventListener('resize', sync);
    sync();
  });

  var chips = d.querySelectorAll('.chip[data-filter]');
  if (chips.length) chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var f = c.getAttribute('data-filter');
      chips.forEach(function (x) {
        var isOn = x === c;
        x.classList.toggle('is-on', isOn);
        x.setAttribute('aria-pressed', isOn ? 'true' : 'false');
      });
      d.querySelectorAll('#films .film').forEach(function (el) {
        el.classList.toggle('is-hidden', f !== 'all' && el.getAttribute('data-cat') !== f);
      });
      if (running) sizeBody();
    });
  });

  d.querySelectorAll('form.form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var status = form.querySelector('.form-status');
      var btn = form.querySelector('button[type=submit]');
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      if (data.company) return;
      status.className = 'form-status'; status.textContent = '…'; btn.disabled = true;
      fetch(form.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) { status.className = 'form-status ok'; status.textContent = status.getAttribute('data-ok'); form.reset(); }
          else if (res.j && res.j.fallback) mailto();
          else { status.className = 'form-status err'; status.textContent = status.getAttribute('data-err'); }
        })
        .catch(mailto)
        .finally(function () { btn.disabled = false; });
      function mailto() {
        var to = status.getAttribute('data-to');
        var subject = (data.kind === 'academy' ? 'Academy waitlist' : 'Work with me') + ' — ' + (data.name || '');
        var body = Object.keys(data).filter(function (k) { return k !== 'company' && data[k]; })
          .map(function (k) { return k + ': ' + data[k]; }).join('\n');
        status.className = 'form-status'; status.textContent = status.getAttribute('data-fallback');
        w.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      }
    });
  });
})();
