/* ============================================================
   SCRIPT.JS — «Цветущая арка»
   Данные конструктора (URL + postMessage) + интерактив:
   • программа дня — серпантин + сердечко, едущее по треку при скролле
   • дата в сердце — «засыпана цветами», гость их смахивает (скролл-гейт)
   • плавное проявление секций при скролле
   ============================================================ */
(function () {
  'use strict';

  var STATE = { apiBase: '', slug: '', date: '2026-08-15', time: '15:00' };
  var EDITING = new URLSearchParams(location.search).get('editing') === '1';

  function pad(n) { return String(n).padStart(2, '0'); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function imageUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//.test(url) || url.indexOf('data:') === 0) return url;
    if (url.indexOf('/invite/') === 0) return url;
    if (url.charAt(0) === '/') return (STATE.apiBase || '') + url;
    return url;
  }
  function setRichText(key, value) {
    if (value == null || value === '') return;
    document.querySelectorAll('[data-edit="' + key + '"]').forEach(function (el) {
      el.innerHTML = escapeHtml(value).replace(/\n/g, '<br>');
    });
  }
  function setImg(key, url) {
    if (!url) return;
    document.querySelectorAll('img[data-edit="' + key + '"]').forEach(function (el) { el.src = imageUrl(url); });
  }
  function firstLetter(s) { s = (s || '').trim(); return s ? s.charAt(0).toUpperCase() : ''; }

  // ─── Имена + монограмма ──────────────────────────
  function applyNames(groom, bride) {
    groom = (groom || '').trim(); bride = (bride || '').trim();
    if (groom) document.querySelectorAll('[data-edit="groomLine"]').forEach(function (el) { el.textContent = groom; });
    if (bride) document.querySelectorAll('[data-edit="brideLine"]').forEach(function (el) { el.textContent = bride; });
    var mono = document.getElementById('monogram');
    if (mono && (groom || bride)) {
      var L = firstLetter(groom) || 'Е', R = firstLetter(bride) || 'М';
      mono.innerHTML = '<span class="mono-letters"><span>' + L + '</span><span>' + R + '</span></span><span class="mono-amp">&amp;</span>';
    }
  }

  // ─── Дата: обложка + число в сердце + таймер ─────
  function applyDate(dateStr, timeStr) {
    if (dateStr) {
      var p = String(dateStr).split('-').map(Number);
      var y = p[0], m = p[1], day = p[2];
      if (y && m && day) {
        var cd = document.getElementById('coverDate'); if (cd) cd.textContent = pad(day) + ' · ' + pad(m) + ' · ' + y;
        var hd = document.getElementById('heartDay');  if (hd) hd.textContent = day;
      }
    }
    restartCountdown(dateStr, timeStr);
  }

  var cdInterval = null;
  function restartCountdown(dateStr, timeStr) {
    if (dateStr) STATE.date = dateStr;
    if (timeStr) STATE.time = timeStr;
    if (cdInterval) clearInterval(cdInterval);
    var ts = STATE.time || '15:00';
    var target = new Date((STATE.date || '2026-08-15') + 'T' + (ts.length === 5 ? ts + ':00' : ts));
    if (isNaN(target.getTime())) target = new Date('2026-08-15T15:00:00');
    function tick() {
      var d = document.getElementById('cd-days'), h = document.getElementById('cd-hours'),
          mi = document.getElementById('cd-mins'), s = document.getElementById('cd-secs');
      if (!d) return;
      var diff = target - new Date();
      if (diff <= 0) { d.textContent = h.textContent = mi.textContent = s.textContent = '00'; return; }
      d.textContent = pad(Math.floor(diff / 86400000));
      h.textContent = pad(Math.floor((diff % 86400000) / 3600000));
      mi.textContent = pad(Math.floor((diff % 3600000) / 60000));
      s.textContent = pad(Math.floor((diff % 60000) / 1000));
    }
    tick(); cdInterval = setInterval(tick, 1000);
  }

  // ─── Палитра дресс-кода ──────────────────────────
  function rebuildSwatches(colors) {
    var box = document.querySelector('[data-edit="dressCodeColors"]');
    if (!box || !Array.isArray(colors) || !colors.length) return;
    box.innerHTML = '';
    colors.forEach(function (hex) {
      var s = document.createElement('span'); s.className = 'ga-swatch'; s.style.background = hex; box.appendChild(s);
    });
  }

  // ─── Напитки ─────────────────────────────────────
  function rebuildDrinks(drinks) {
    var box = document.querySelector('[data-edit="drinks"]');
    if (!box || !Array.isArray(drinks) || !drinks.length) return;
    box.innerHTML = '';
    drinks.forEach(function (d) {
      if (!d || !d.label) return;
      var lab = document.createElement('label'); lab.className = 'rsvp-option';
      lab.innerHTML = '<input type="checkbox" name="drink" value="' + escapeHtml(d.value || d.label) + '"><span>' + escapeHtml(d.label) + '</span>';
      box.appendChild(lab);
    });
  }

  // ─── ПРОГРАММА ДНЯ: серпантин под N пунктов + узлы-стопки ──
  var TL = { path: null, heart: null, section: null, inner: null, len: 0 };
  function isImageIcon(s) { return /^(https?:|data:|\/)/.test(s) || /\.(svg|png|jpe?g|gif|webp)$/i.test(s); }
  function iconNode(raw) {
    raw = raw || '';
    if (isImageIcon(raw)) return '<img class="tl-icon-node" src="' + imageUrl(raw) + '" alt="">';
    return '<span class="tl-icon-node" style="display:flex;align-items:center;justify-content:center;font-size:54px">' + escapeHtml(raw) + '</span>';
  }
  function scheduleFromDOM() {
    var arr = [];
    document.querySelectorAll('.timeline-inner .tl-node').forEach(function (n) {
      var img = n.querySelector('.tl-icon-node');
      arr.push({
        time: (n.querySelector('.tl-time') || {}).textContent || '',
        title: (n.querySelector('.tl-text') || {}).textContent || '',
        icon: img ? (img.getAttribute('src') || '') : ''
      });
    });
    return arr;
  }
  function applySchedule(schedule) {
    if (!Array.isArray(schedule) || !schedule.length) return;
    var inner = document.querySelector('.timeline-inner');
    if (!inner) return;
    var svg = document.getElementById('tl-svg'), path = document.getElementById('tl-path');

    var N = schedule.length, TOP0 = 60, STEP = 160, BOTTOM = 70;
    var xs = [], ys = [];
    for (var i = 0; i < N; i++) { ys.push(TOP0 + i * STEP); xs.push(i % 2 === 0 ? 158 : 282); }
    var H = ys[N - 1] + BOTTOM;
    if (svg) svg.setAttribute('viewBox', '0 0 440 ' + H);
    if (path) {
      var d = 'M ' + xs[0] + ' ' + ys[0];
      for (var k = 0; k < N - 1; k++) {
        var half = (ys[k + 1] - ys[k]) / 2;
        d += ' C ' + xs[k] + ' ' + (ys[k] + half) + ' ' + xs[k + 1] + ' ' + (ys[k + 1] - half) + ' ' + xs[k + 1] + ' ' + ys[k + 1];
      }
      path.setAttribute('d', d);
    }
    inner.querySelectorAll('.tl-node').forEach(function (n) { n.remove(); });
    schedule.forEach(function (it, idx) {
      var div = document.createElement('div');
      div.className = 'tl-node ' + (idx % 2 === 0 ? 'tl-nl' : 'tl-nr');
      div.style.top = (ys[idx] / H * 100).toFixed(2) + '%';
      div.innerHTML = iconNode(it.icon) +
        '<div class="tl-node-info"><time class="tl-time">' + escapeHtml(it.time || '') +
        '</time><p class="tl-text">' + escapeHtml(it.title || '') + '</p></div>';
      inner.appendChild(div);
    });
    if (path) { try { TL.len = path.getTotalLength(); } catch (e) {} }
    updateHeart();
  }

  // ─── Сердечко, едущее по треку программы при скролле ──
  function updateHeart() {
    if (!TL.section || !TL.path || !TL.heart) return;
    if (!TL.len) { try { TL.len = TL.path.getTotalLength(); } catch (e) { return; } }
    var rect = TL.section.getBoundingClientRect();
    var prog = (window.innerHeight * 0.5 - rect.top) / TL.section.offsetHeight;
    prog = Math.max(0, Math.min(1, prog));
    var pt; try { pt = TL.path.getPointAtLength(prog * TL.len); } catch (e) { return; }
    TL.heart.setAttribute('x', (pt.x - 13).toFixed(1));
    TL.heart.setAttribute('y', (pt.y - 12).toFixed(1));
  }
  function initHeartFollower() {
    TL.section = document.querySelector('.program');
    TL.path = document.getElementById('tl-path');
    TL.heart = document.getElementById('tl-heart');
    if (!TL.path) return;
    try { TL.len = TL.path.getTotalLength(); } catch (e) {}
    window.addEventListener('scroll', updateHeart, { passive: true });
    window.addEventListener('resize', updateHeart);
    window.addEventListener('load', function () { try { TL.len = TL.path.getTotalLength(); } catch (e) {} updateHeart(); });
    updateHeart();
  }

  // ─── ИНТЕРАКТИВ: дата в БОЛЬШОМ сердце из цветов. Курсор мягко разгоняет лепестки —
  //     они плавно разлетаются (нужно много движений), остаётся венок-сердце с датой ──
  function initHeartReveal() {
    var wrap = document.getElementById('heartWrap');
    var section = document.querySelector('.wedday');
    var hint = document.getElementById('weddayHint');
    if (!wrap || !section) return;

    var revealed = false, active = false;
    var PINKS = ['#e6a9bd', '#d98ba0', '#e6c2cf', '#f0d6de', '#dd9bb0'];
    var CREAMS = ['#f4efe3', '#efe7cf', '#fbf6ea'];
    var GREENS = ['#9fb083', '#bccaa6', '#8a9a6f'];
    function pick(a) { return a[(Math.random() * a.length) | 0]; }
    function inHeart(u, v) { var a = u * u + v * v - 1; return a * a * a - u * u * v * v * v <= 0; }

    function build() {
      var w = Math.round(wrap.clientWidth), h = Math.round(wrap.clientHeight);
      if (!w || !h) { setTimeout(build, 150); return; }
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var canvas = document.createElement('canvas');
      canvas.className = 'heart-canvas';
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      var ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
      wrap.appendChild(canvas);
      active = true;

      // 1) точки сердца в нормированных координатах (плотно — чтобы дата была спрятана)
      var raw = [];
      for (var v = -1.5; v <= 1.15; v += 0.038) {
        for (var u = -1.3; u <= 1.3; u += 0.038) {
          var ju = u + (Math.random() - 0.5) * 0.04, jv = v + (Math.random() - 0.5) * 0.04;
          if (inHeart(ju, jv)) raw.push([ju, jv]);
        }
      }
      // 2) bbox + центроид → вписываем сердце в .heart-wrap ЦЕЛИКОМ (с полями, без обрезки)
      var umin = 1e9, umax = -1e9, vmin = 1e9, vmax = -1e9, su = 0, sv = 0;
      for (var i = 0; i < raw.length; i++) { var p = raw[i]; if (p[0] < umin) umin = p[0]; if (p[0] > umax) umax = p[0]; if (p[1] < vmin) vmin = p[1]; if (p[1] > vmax) vmax = p[1]; su += p[0]; sv += p[1]; }
      var uc = su / raw.length, vc = sv / raw.length;
      var scale = Math.min(w * 0.9 / (umax - umin), h * 0.9 / (vmax - vmin));
      var bcx = (umin + umax) / 2, bcy = (vmin + vmax) / 2;
      function mapX(u) { return w / 2 + (u - bcx) * scale; }
      function mapY(v) { return h / 2 - (v - bcy) * scale; }
      // внутреннее сердце (центр) — эти цветы можно сдуть; ободок-венок ТОНКИЙ остаётся
      function inInner(u, v) { return inHeart(uc + (u - uc) / 0.82, vc + (v - vc) / 0.82); }

      var P = [];
      for (var k = 0; k < raw.length; k++) {
        var ru = raw[k][0], rv = raw[k][1];
        var fixed = !inInner(ru, rv);   // ободок-венок (приклеен)
        var t = Math.random();
        var X = mapX(ru), Y = mapY(rv);
        P.push({
          x: X, y: Y, ox: X, oy: Y, vx: 0, vy: 0,
          r: scale * (0.062 + Math.random() * 0.055), rot: Math.random() * 6.28, vr: 0,
          kind: t < 0.55 ? 'flower' : (t < 0.82 ? 'leaf' : 'bud'),
          col: t < 0.32 ? pick(PINKS) : (t < 0.56 ? pick(CREAMS) : pick(GREENS)),
          gone: false, fade: 1, fixed: fixed
        });
      }
      // зона даты (центр) — открытие, когда она расчищена
      var ctrX = w / 2, ctrY = h * 0.46, Rz = w * 0.15, zoneTotal = 0;
      for (var m = 0; m < P.length; m++) {
        var pp = P[m];
        pp.inZone0 = !pp.fixed && Math.hypot(pp.ox - ctrX, pp.oy - ctrY) < Rz;
        if (pp.inZone0) zoneTotal++;
      }
      zoneTotal = zoneTotal || 1;
      var running = false;

      function petal(x, y, r, rot, col) { ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.56, 0, 0, 6.2832); ctx.fill(); ctx.restore(); }
      function drawP(p) {
        ctx.globalAlpha = p.fade;
        if (p.kind === 'leaf') { petal(p.x, p.y, p.r * 1.15, p.rot, p.col); }
        else if (p.kind === 'bud') { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.72, 0, 6.2832); ctx.fill(); }
        else { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.6, 0, 6.2832); ctx.fill(); for (var i = 0; i < 6; i++) petal(p.x, p.y, p.r, p.rot + i * 1.0472, p.col); ctx.fillStyle = '#e7c97e'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.34, 0, 6.2832); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      function render() { ctx.clearRect(0, 0, w, h); for (var i = 0; i < P.length; i++) if (!P[i].gone) drawP(P[i]); }

      // «потревоженные» цветы летят И тают — где провёл курсором, там расчистилось
      var tick = 0, RpxC = Math.max(8, Math.round(Rz * canvas.width / w));
      function centerClear() {
        var cw = canvas.width, ch = canvas.height;
        var sx = Math.max(0, (cw / 2 - RpxC) | 0), sy = Math.max(0, (ch * 0.46 - RpxC) | 0);
        var sw = Math.min(cw - sx, 2 * RpxC), sh = Math.min(ch - sy, 2 * RpxC);
        if (sw <= 0 || sh <= 0) return false;
        var d; try { d = ctx.getImageData(sx, sy, sw, sh).data; } catch (e) { return false; }
        var o = 0, t = 0; for (var q = 3; q < d.length; q += 16) { t++; if (d[q] > 40) o++; }
        return t && (o / t) < 0.2;
      }
      function frame() {
        var anim = false;
        for (var i = 0; i < P.length; i++) {
          var p = P[i]; if (p.gone || p.fixed || !p.dist) continue;
          anim = true;
          p.x += p.vx; p.y += p.vy; p.rot += p.vr;
          p.vx *= 0.92; p.vy *= 0.92; p.vr *= 0.92;
          p.fade -= 0.04;
          if (p.fade <= 0 || p.x < -50 || p.x > w + 50 || p.y < -50 || p.y > h + 50) p.gone = true;
        }
        render();
        if (!revealed && (++tick % 5) === 0 && centerClear()) finish();   // дата видна
        if (anim) requestAnimationFrame(frame);
        else { if (!revealed && centerClear()) finish(); running = false; }
      }
      function startLoop() { if (!running) { running = true; requestAnimationFrame(frame); } }

      // импульс по «съёмным» цветам: помечаем dist → летят и тают; радиус средний, чуть интенсивнее
      function blow(bx, by) {
        var Rd = w * 0.2;
        for (var i = 0; i < P.length; i++) {
          var p = P[i]; if (p.gone || p.fixed) continue;
          var dx = p.x - bx, dy = p.y - by, d = Math.hypot(dx, dy);
          if (d < Rd) {
            p.dist = true;
            var f = (1 - d / Rd) * 3.4, inv = d || 1;
            p.vx += dx / inv * f + (Math.random() - 0.5) * 1.2;
            p.vy += dy / inv * f - Math.random() * 1.0;
            var sp = Math.hypot(p.vx, p.vy), MX = 7; if (sp > MX) { p.vx = p.vx / sp * MX; p.vy = p.vy / sp * MX; }
            p.vr += (Math.random() - 0.5) * 0.4;
          }
        }
        startLoop();
      }
      function rel(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
      canvas.addEventListener('pointermove', function (e) { var p = rel(e); blow(p.x, p.y); e.preventDefault(); }, { passive: false });
      canvas.addEventListener('pointerdown', function (e) { var p = rel(e); blow(p.x, p.y); });

      // открытие: внутренние цветы сдуты, ободок-венок ОСТАЁТСЯ на холсте + дата внутри
      function finish() {
        revealed = true;
        if (hint) { hint.textContent = 'дата открыта'; hint.classList.add('done'); }
      }

      render(); // большое сердце из цветов (анимация запускается по движению курсора)
    }

    build();

    /* ── Скролл-гейт только для гостя (в редакторе скролл свободный, но цветы видны) ── */
    if (!EDITING) {
      var lockTarget = function () {
        var r = section.getBoundingClientRect(), docTop = r.top + window.scrollY;
        return Math.max(0, Math.round(docTop + section.offsetHeight / 2 - window.innerHeight * 0.5));
      };
      var gateActive = function () { return active && !revealed; };
      var enforce = function () { if (revealed) return; if (active && window.scrollY > lockTarget() + 2) window.scrollTo(0, lockTarget()); requestAnimationFrame(enforce); };
      window.addEventListener('wheel', function (e) { if (gateActive() && e.deltaY > 0 && window.scrollY >= lockTarget() - 2) e.preventDefault(); }, { passive: false });
      var touchY = 0;
      window.addEventListener('touchstart', function (e) { if (e.touches && e.touches.length) touchY = e.touches[0].clientY; }, { passive: true });
      window.addEventListener('touchmove', function (e) {
        if (!gateActive() || !e.touches.length) return;
        if (e.target && e.target.classList && e.target.classList.contains('heart-canvas')) return;
        if (touchY - e.touches[0].clientY > 0 && window.scrollY >= lockTarget() - 2) e.preventDefault();
      }, { passive: false });
      window.addEventListener('keydown', function (e) { if (!gateActive()) return; var k = e.key; if ((k === 'ArrowDown' || k === 'PageDown' || k === 'End' || k === ' ' || k === 'Spacebar') && window.scrollY >= lockTarget() - 2) e.preventDefault(); });
      requestAnimationFrame(enforce);
    }
  }

  // ─── Плавное проявление всего сайта: секции блоками + элементы со стэггером ──
  function initReveal() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });

    // поэлементная анимация (безопасные селекторы — без абсолютных tl-node/cover-inner)
    var SEL = '.cover-names,.cover-date,.script-h,.friends-text,.friends-photos,' +
      '.wedday-script,.wedday-divider,.wedday-hint,.heart-wrap,' +
      '.venue-sprig,.venue-name,.venue-illustration,.venue-laurel,' +
      '.countdown,.cd-meadow,.cd-couple,' +
      '.dc-sub,.dc-swatches,.dc-photos,.dc-divider,.dc-doves,' +
      '.rsvp-heart,.rsvp-title,.rsvp-sub,.rsvp-form,' +
      '.wishes-inner,.closing-h,.closing-wreath-wrap';
    var io2 = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('anim-in'); io2.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -24px 0px' });
    document.querySelectorAll(SEL).forEach(function (el) {
      el.classList.add('anim');
      // стэггер по позиции среди соседей-.anim в той же секции
      var sec = el.closest('section') || el.parentNode;
      var sibs = sec ? sec.querySelectorAll(SEL) : [el];
      var idx = Array.prototype.indexOf.call(sibs, el);
      el.style.transitionDelay = (Math.min(idx < 0 ? 0 : idx, 5) * 0.08) + 's';
      io2.observe(el);
    });
  }

  // ─── Применение данных ───────────────────────────
  /* ─── Карта проезда ──────────────────────────
     Место/адрес становятся ссылкой, когда пара указала карту.
     Вёрстка не меняется: только курсор и пунктирное подчёркивание. */
  function applyMapLink(url) {
    url = (url || '').trim();
    if (!url) return;
    document.querySelectorAll('[data-edit="venue"], [data-edit="venueAddress"]').forEach(function (el) {
      if (el.tagName === 'A') {
        el.setAttribute('href', url);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
        return;
      }
      el.__wcMapUrl = url;
      if (el.dataset.wcMap) return;
      el.dataset.wcMap = '1';
      el.style.cursor = 'pointer';
      el.style.textDecoration = 'underline dotted';
      el.style.textUnderlineOffset = '0.25em';
      el.setAttribute('role', 'link');
      el.setAttribute('tabindex', '0');
      el.title = 'Открыть на карте';
      var open = function () { window.open(el.__wcMapUrl, '_blank', 'noopener'); };
      el.addEventListener('click', open);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
    });
  }

  function applyData(d) {
    if (!d) return;
    applyMapLink(d.mapLink);
    if (window.WCMusic) window.WCMusic.set(imageUrl(d.musicUrl));
    if (typeof d.apiBase === 'string') STATE.apiBase = d.apiBase;
    if (typeof d.slug === 'string' && d.slug) STATE.slug = d.slug;
    if (typeof d.guestToken === 'string' && d.guestToken) STATE.guestToken = d.guestToken;
    if (typeof d.guestName === 'string' && d.guestName) {
      STATE.guestName = d.guestName;
      var _gn = document.querySelector('#rsvpForm [name="guestName"]');
      if (_gn && !_gn.value) _gn.value = d.guestName;
    }
    applyNames(d.groomName, d.brideName);
    applyDate(d.weddingDate, d.weddingTime);
    setRichText('dearGuests', d.dearGuests);
    setRichText('inviteText', d.inviteText);
    setRichText('venue', d.venue);
    setRichText('story', d.story);
    setRichText('surveyText', d.surveyText);
    setRichText('closing', d.closing);
    setImg('polaroid1', d.polaroid1);
    setImg('polaroid2', d.polaroid2);
    setImg('dressCodePhoto', d.dressCodePhoto);
    setImg('dressPhoto2', d.dressPhoto2);
    rebuildSwatches(d.dressCodeColors);
    if (Array.isArray(d.schedule) && d.schedule.length) applySchedule(d.schedule);
    rebuildDrinks(d.drinks);
  }

  function dataFromUrl() {
    var p = new URLSearchParams(window.location.search), d = {};
    if (p.get('apiBase')) d.apiBase = p.get('apiBase');
    if (p.get('slug')) d.slug = p.get('slug');
    if (p.get('groom') != null) d.groomName = p.get('groom');
    if (p.get('bride') != null) d.brideName = p.get('bride');
    if (p.get('date')) d.weddingDate = p.get('date');
    if (p.get('time')) d.weddingTime = p.get('time');
    return d;
  }

  function initRsvp() {
    var form = document.getElementById('rsvpForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      function done() { form.hidden = true; var th = document.getElementById('rsvpThanks'); if (th) th.removeAttribute('hidden'); }
      var nameEl = form.querySelector('[name="guestName"]');
      var guestName = nameEl ? nameEl.value.trim() : '';
      var attendEl = form.querySelector('input[name="attend"]:checked');
      var attending = attendEl ? attendEl.value === 'yes' : true;
      var drinks = []; form.querySelectorAll('input[name="drink"]:checked').forEach(function (c) { drinks.push(c.value); });
      if (STATE.slug) {
        if (!guestName) { alert('Пожалуйста, укажите ваше имя'); if (nameEl) nameEl.focus(); return; }
        var btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
        fetch((STATE.apiBase || '') + '/api/rsvp/' + STATE.slug, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestName: guestName, attending: attending, drinkChoice: drinks.join(','), wishes: '', guestToken: STATE.guestToken || '' })
        }).then(done).catch(done);
      } else { done(); }
    });
  }

  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (msg && msg.type === 'wc:data' && msg.payload) applyData(msg.payload);
  });

  function init() {
    applySchedule(scheduleFromDOM());   // разложить серпантин под стартовые пункты
    applyData(dataFromUrl());
    restartCountdown();
    initHeartFollower();
    initReveal();
    initHeartReveal();
    initRsvp();
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'wc:ready' }, '*'); } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
