/* ============================================================
   SCRIPT.JS — Свадебное приглашение «Каллы»
   Подстановка данных из конструктора без изменения дизайна.
   URL-параметры (страница гостя) + postMessage('wc:data') (живое превью).
   ============================================================ */
(function () {
  'use strict';

  var STATE = { apiBase: '', slug: '', date: '2026-05-22', time: '12:00' };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

  var DEFAULT_SCHEDULE = [
    { time: '12:00', title: 'Дворцовая усадьба 12', icon: 'assets/couple-illustration.svg' },
    { time: '13:00', title: 'Дворцовая усадьба 12', icon: 'assets/champagne.svg' },
    { time: '14:00', title: 'Дворцовая усадьба 12', icon: 'assets/rings.svg' },
    { time: '15:00', title: 'Дворцовая усадьба 12', icon: 'assets/bouquet.svg' },
    { time: '16:00', title: 'Дворцовая усадьба 12', icon: 'assets/cake.svg' },
    { time: '17:00', title: 'Дворцовая усадьба 12', icon: 'assets/car.svg' }
  ];

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
    if (url.indexOf('assets/') === 0) return url;
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
    document.querySelectorAll('img[data-edit="' + key + '"]').forEach(function (el) {
      el.src = imageUrl(url);
    });
  }

  /* ─── Имена (обложка) + монограмма ───────────────── */
  function applyNames(groom, bride) {
    groom = (groom || '').trim();
    bride = (bride || '').trim();
    if (bride) {
      var b = document.querySelector('[data-name="bride"]');
      if (b) b.textContent = bride;
    }
    if (groom) {
      var g = document.querySelector('[data-name="groom"]');
      if (g) g.textContent = groom;
    }
    var letters = document.querySelectorAll('.mono-letter');
    if (letters.length >= 2) {
      if (bride) letters[0].textContent = bride[0].toUpperCase();
      if (groom) letters[1].textContent = groom[0].toUpperCase();
    }
    var sign = document.querySelector('[data-edit="closingSign"]');
    if (sign && !sign.dataset.userset && (bride || groom)) {
      sign.textContent = 'Ваши ' + (bride || '') + ' и ' + (groom || '');
    }
  }

  /* ─── Дата: обложка + календарь + таймер ──────────── */
  function applyDate(dateStr, timeStr) {
    if (dateStr) {
      STATE.date = dateStr;
      var p = String(dateStr).split('-').map(Number);
      var y = p[0], m = p[1], day = p[2];
      if (y && m && day) {
        var hd = document.querySelector('[data-edit="heroDate"]');
        if (hd) hd.textContent = pad(day) + ' | ' + pad(m) + ' | ' + y;
      }
      buildCalendar(dateStr);
    }
    restartCountdown(dateStr, timeStr);
  }

  function buildCalendar(dateStr) {
    var p = String(dateStr).split('-').map(Number);
    var y = p[0], m = p[1], day = p[2];
    if (!y || !m) return;
    var monthEl = document.querySelector('[data-cal="month"]');
    if (monthEl) monthEl.textContent = MONTHS[m - 1];
    var yearEl = document.querySelector('[data-cal="year"]');
    if (yearEl) yearEl.textContent = String(y);
    var grid = document.querySelector('[data-cal="grid"]');
    if (!grid) return;
    grid.querySelectorAll('span:not(.cal__dow)').forEach(function (s) { s.remove(); });

    var first = new Date(y, m - 1, 1).getDay();      // 0 = Sun
    var dim = new Date(y, m, 0).getDate();
    var i;
    for (i = 0; i < first; i++) {
      grid.appendChild(document.createElement('span'));
    }
    for (var d = 1; d <= dim; d++) {
      var cell = document.createElement('span');
      if (d === day) {
        cell.className = 'cal__mark';
        cell.innerHTML = d + '<img src="assets/heart-red.svg" alt="">';
      } else {
        cell.textContent = d;
      }
      grid.appendChild(cell);
    }
  }

  var cdInterval = null;
  function restartCountdown(dateStr, timeStr) {
    if (dateStr) STATE.date = dateStr;
    if (timeStr) STATE.time = timeStr;
    if (cdInterval) clearInterval(cdInterval);
    var ts = STATE.time || '12:00';
    var target = new Date((STATE.date || '2026-05-22') + 'T' + (ts.length === 5 ? ts + ':00' : ts));
    if (isNaN(target.getTime())) target = new Date('2026-05-22T12:00:00');
    function tick() {
      var diff = target - new Date();
      var d = document.getElementById('cd-days'), h = document.getElementById('cd-hours'),
          mi = document.getElementById('cd-mins'), s = document.getElementById('cd-secs');
      if (!d) return;
      if (diff <= 0) { d.textContent = '0'; h.textContent = '00'; mi.textContent = '00'; s.textContent = '00'; return; }
      d.textContent  = String(Math.floor(diff / 86400000));
      h.textContent  = pad(Math.floor((diff % 86400000) / 3600000));
      mi.textContent = pad(Math.floor((diff % 3600000) / 60000));
      s.textContent  = pad(Math.floor((diff % 60000) / 1000));
    }
    tick();
    cdInterval = setInterval(tick, 1000);
  }

  /* ─── Программа дня: змейка-серпантин + жемчужина на треке ── */
  var TL = { path: null, heart: null, section: null, len: 0 };

  function applySchedule(schedule) {
    if (!Array.isArray(schedule) || !schedule.length) return;
    var inner = document.querySelector('.timeline-inner');
    if (!inner) return;
    var svg = document.getElementById('tl-svg');
    var path = document.getElementById('tl-path');

    var N = schedule.length;
    var TOP0 = 80, STEP = 178, BOTTOM = 80;
    var xs = [], ys = [];
    for (var i = 0; i < N; i++) { ys.push(TOP0 + i * STEP); xs.push(i % 2 === 0 ? 152 : 288); }
    var H = ys[N - 1] + BOTTOM;

    if (svg) svg.setAttribute('viewBox', '0 0 440 ' + H);
    if (path) {
      var d = 'M ' + xs[0] + ' ' + ys[0];
      for (var k = 0; k < N - 1; k++) {
        var half = (ys[k + 1] - ys[k]) / 2;
        d += ' C ' + xs[k] + ' ' + (ys[k] + half) + ' ' + xs[k + 1] + ' ' + (ys[k + 1] - half) +
             ' ' + xs[k + 1] + ' ' + ys[k + 1];
      }
      path.setAttribute('d', d);
    }

    inner.querySelectorAll('.tl-node').forEach(function (n) { n.remove(); });
    schedule.forEach(function (it, idx) {
      var div = document.createElement('div');
      div.className = 'tl-node ' + (idx % 2 === 0 ? 'tl-nl' : 'tl-nr') + ' fade-soft';
      div.style.top = (ys[idx] / H * 100).toFixed(2) + '%';
      div.innerHTML =
        '<img class="tl-icon-node zoomable" src="' + imageUrl(it.icon || '') + '" alt="">' +
        '<div class="tl-node-info"><time class="tl-time">' + escapeHtml(it.time || '') +
        '</time><p class="tl-text">' + escapeHtml(it.title || '') + '</p></div>';
      inner.appendChild(div);
    });

    if (path) { try { TL.len = path.getTotalLength(); } catch (e) {} }
    observeFadeUp(inner);
    updateHeart();
  }

  function updateHeart() {
    if (!TL.section || !TL.path || !TL.heart) return;
    if (!TL.len) { try { TL.len = TL.path.getTotalLength(); } catch (e) { return; } }
    var rect = TL.section.getBoundingClientRect();
    var prog = (window.innerHeight * 0.5 - rect.top) / TL.section.offsetHeight;
    prog = Math.max(0, Math.min(1, prog));
    var pt;
    try { pt = TL.path.getPointAtLength(prog * TL.len); } catch (e) { return; }
    TL.heart.setAttribute('x', (pt.x - 15).toFixed(1));
    TL.heart.setAttribute('y', (pt.y - 15).toFixed(1));
  }

  function initHeartFollower() {
    TL.section = document.querySelector('.timeline-section');
    TL.path = document.getElementById('tl-path');
    TL.heart = document.getElementById('tl-heart');
    if (!TL.path) return;
    try { TL.len = TL.path.getTotalLength(); } catch (e) {}
    window.addEventListener('scroll', updateHeart, { passive: true });
    window.addEventListener('resize', updateHeart, { passive: true });
    window.addEventListener('load', function () {
      if (TL.path) { try { TL.len = TL.path.getTotalLength(); } catch (e) {} }
      updateHeart();
    });
    updateHeart();
  }

  /* ─── Палитра дресс-кода ──────────────────────────── */
  function rebuildPalette(colors) {
    if (!Array.isArray(colors) || !colors.length) return;
    var box = document.querySelector('[data-edit="palette"]');
    if (!box) return;
    box.innerHTML = '';
    colors.forEach(function (c) {
      var sp = document.createElement('span');
      sp.style.setProperty('--c', c);
      box.appendChild(sp);
    });
  }

  /* ─── Пожелания: абзацы из текста ─────────────────── */
  function rebuildStory(story) {
    if (story == null || story === '') return;
    var box = document.querySelector('[data-edit="story"]');
    if (!box) return;
    box.innerHTML = '';
    String(story).split(/\n+/).forEach(function (line) {
      if (!line.trim()) return;
      var p = document.createElement('p');
      p.textContent = line.trim();
      box.appendChild(p);
    });
  }

  /* ─── Кастомные переключатели (radio/checkbox) ────── */
  function bindFormOption(label) {
    if (!label || label.dataset.bound) return;
    var input = label.querySelector('input');
    var indicator = label.querySelector('.custom-radio, .custom-check');
    if (!input || !indicator) return;
    label.dataset.bound = '1';
    input.addEventListener('change', function () {
      if (input.type === 'radio') {
        document.querySelectorAll('input[name="' + input.name + '"]').forEach(function (r) {
          var ind = r.closest('.form-option').querySelector('.custom-radio');
          if (ind) ind.classList.remove('checked');
        });
      }
      indicator.classList.toggle('checked', input.checked);
    });
  }
  function bindFormOptions() {
    document.querySelectorAll('.form-option').forEach(bindFormOption);
  }

  function rebuildDrinks(drinks) {
    var box = document.querySelector('[data-edit="drinks"]');
    if (!box || !Array.isArray(drinks) || !drinks.length) return;
    box.querySelectorAll('.form-option').forEach(function (o) { o.remove(); });
    drinks.forEach(function (d) {
      if (!d || !d.label) return;
      var lab = document.createElement('label');
      lab.className = 'form-option';
      lab.innerHTML =
        '<span class="custom-check"></span>' +
        '<input type="checkbox" name="drink" value="' + escapeHtml(d.value || d.label) + '">' +
        escapeHtml(d.label);
      box.appendChild(lab);
      bindFormOption(lab);
    });
  }

  /* ─── Карусель дресс-кода ─────────────────────────── */
  function initCarousel() {
    var track = document.getElementById('dressTrack');
    var dotsBox = document.getElementById('dressDots');
    if (!track) return;
    var slides = [].slice.call(track.querySelectorAll('.carousel__slide'));
    var prev = document.querySelector('.carousel__nav--prev');
    var next = document.querySelector('.carousel__nav--next');

    if (dotsBox) {
      dotsBox.innerHTML = '';
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'carousel__dot' + (i === 0 ? ' is-active' : '');
        b.setAttribute('aria-label', 'Слайд ' + (i + 1));
        b.addEventListener('click', function () { go(i); });
        dotsBox.appendChild(b);
      });
    }

    function current() { return Math.round(track.scrollLeft / track.clientWidth); }
    function go(i) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    }
    function syncDots() {
      if (!dotsBox) return;
      var c = current();
      dotsBox.querySelectorAll('.carousel__dot').forEach(function (d, i) {
        d.classList.toggle('is-active', i === c);
      });
    }
    if (prev) prev.addEventListener('click', function () { go(current() - 1); });
    if (next) next.addEventListener('click', function () { go(current() + 1); });
    track.addEventListener('scroll', function () {
      window.clearTimeout(track._t);
      track._t = window.setTimeout(syncDots, 60);
    }, { passive: true });
  }

  /* ─── Анимация появления (fade up) ────────────────── */
  var fadeObserver = null;
  function initReveal() {
    if (!('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.fade-up, .fade-soft').forEach(function (el) { el.classList.add('in'); });
      return;
    }
    fadeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); fadeObserver.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.fade-up, .fade-soft').forEach(function (el, i) {
      el.style.setProperty('--d', (i % 6) * 70 + 'ms');
      fadeObserver.observe(el);
    });
  }
  function observeFadeUp(scope) {
    (scope || document).querySelectorAll('.fade-up:not(.in), .fade-soft:not(.in)').forEach(function (el, i) {
      if (!fadeObserver) { el.classList.add('in'); return; }
      el.style.setProperty('--d', (i % 6) * 70 + 'ms');
      fadeObserver.observe(el);
    });
  }

  /* ─── Применение данных ───────────────────────────── */
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

    setRichText('greetingTitle', d.greetingTitle);
    setRichText('inviteText', d.inviteText);
    setRichText('venue', d.venue);
    setRichText('surveyText', d.surveyText);
    setRichText('closingTitle', d.closingTitle);
    if (d.closingSign) {
      var sign = document.querySelector('[data-edit="closingSign"]');
      if (sign) { sign.textContent = d.closingSign; sign.dataset.userset = '1'; }
    }

    setImg('dressCodePhoto', d.dressCodePhoto);
    setImg('dressPhoto2', d.dressPhoto2);
    setImg('dressPhoto3', d.dressPhoto3);
    setImg('finalPhoto', d.finalPhoto);

    rebuildPalette(d.dressCodeColors);
    rebuildStory(d.story);
    if (Array.isArray(d.schedule) && d.schedule.length) applySchedule(d.schedule);
    rebuildDrinks(d.drinks);
  }

  function dataFromUrl() {
    var p = new URLSearchParams(window.location.search);
    var d = {};
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
      function done() {
        form.hidden = true;
        var th = document.getElementById('rsvpThanks');
        if (th) th.removeAttribute('hidden');
      }
      var nameEl = form.querySelector('[name="guestName"]');
      var guestName = nameEl ? nameEl.value.trim() : '';
      var attendEl = form.querySelector('input[name="attend"]:checked');
      var attending = attendEl ? attendEl.value === 'yes' : true;
      var drinks = [];
      form.querySelectorAll('input[name="drink"]:checked').forEach(function (c) { drinks.push(c.value); });

      if (STATE.slug) {
        if (!guestName) { alert('Пожалуйста, укажите ваше имя'); if (nameEl) nameEl.focus(); return; }
        var btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        fetch((STATE.apiBase || '') + '/api/rsvp/' + STATE.slug, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestName: guestName, attending: attending, drinkChoice: drinks.join(','), wishes: '', guestToken: STATE.guestToken || '' })
        }).then(function () { done(); }).catch(function () { done(); });
      } else {
        done();
      }
    });
  }

  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (msg && msg.type === 'wc:data' && msg.payload) applyData(msg.payload);
  });

  function init() {
    initReveal();
    applySchedule(DEFAULT_SCHEDULE);   // базовое наполнение (standalone)
    initHeartFollower();
    initCarousel();
    bindFormOptions();
    initRsvp();
    buildCalendar(STATE.date);
    applyData(dataFromUrl());
    restartCountdown();
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'wc:ready' }, '*');
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
