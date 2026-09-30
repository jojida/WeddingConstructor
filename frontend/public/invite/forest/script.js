/* ============================================================
   SCRIPT.JS — свадебное приглашение «Туманный лес»
   Подстановка данных конструктора без изменения дизайна:
   URL-параметры (страница гостя) + postMessage('wc:data') (живое превью).
   Ключи данных == data-edit в index.html == id полей в constants.ts.
   ============================================================ */
(function () {
  'use strict';

  var ROOT = document.documentElement;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EDITING = new URLSearchParams(window.location.search).get('editing') === '1';

  var STATE = {
    apiBase: '', slug: '', guestToken: '', guestName: '',
    date: '2027-06-19', time: '15:00',
    groom: 'Антон', bride: 'Мария',
    signUser: false,        // подпись финала задала пара (иначе — «Ваши …» из имён)
    scheduleSig: '',
    storySig: ''
  };

  var DEFAULT_SCHEDULE = [
    { time: '15:00', title: 'Сбор гостей' },
    { time: '16:00', title: 'Церемония' },
    { time: '17:00', title: 'Фуршет' },
    { time: '21:00', title: 'Торт' },
    { time: '22:00', title: 'Танцы' },
    { time: '23:00', title: 'Окончание вечера' }
  ];

  var MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

  /* ─── Утилиты ─────────────────────────────────────── */
  function pad(n) { return String(n).padStart(2, '0'); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function safeHref(value) {
    if (typeof value !== 'string') return '#';
    try {
      var parsed = new URL(value, window.location.href);
      return /^(https?:|mailto:|tel:)$/.test(parsed.protocol) ? parsed.href : '#';
    } catch (_) { return '#'; }
  }

  function imageUrl(url) {
    if (typeof url !== 'string' || /[<>"\x00-\x20]/.test(url)) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^(https?:|blob:|data:image\/(png|jpeg|gif|webp);base64,)/i.test(url)) return '';
    if (!url) return '';
    if (/^https?:\/\//.test(url) || url.indexOf('data:') === 0 || url.indexOf('blob:') === 0) return url;
    if (url.indexOf('/invite/') === 0) return url;
    if (url.indexOf('assets/') === 0) return url;
    if (url.charAt(0) === '/') return (STATE.apiBase || '') + url;
    return url;
  }

  function setAll(selector, text) {
    document.querySelectorAll(selector).forEach(function (el) { el.textContent = text; });
  }

  function setRichText(key, value) {
    if (value == null || value === '') return;
    document.querySelectorAll('[data-edit="' + key + '"]').forEach(function (el) {
      el.innerHTML = escapeHtml(value).replace(/\n/g, '<br>');
    });
  }

  // Текст абзацами: каждая строка = абзац
  function setParagraphs(key, value) {
    if (typeof value !== 'string' || !value.trim()) return false;
    var box = document.querySelector('[data-edit="' + key + '"]');
    if (!box) return false;
    box.innerHTML = '';
    value.split(/\n+/).forEach(function (line) {
      if (!line.trim()) return;
      var p = document.createElement('p');
      p.textContent = line.trim();
      box.appendChild(p);
    });
    return true;
  }

  // Пустая строка — пара удалила фото: возвращаем фото дизайна.
  // Возвращает true, если фото сменилось
  function setImg(key, url) {
    if (url == null) return false;
    var changed = false;
    document.querySelectorAll('img[data-edit="' + key + '"]').forEach(function (el) {
      var next = url === '' ? el.getAttribute('data-def') : imageUrl(url);
      if (next && el.getAttribute('src') !== next) { el.src = next; changed = true; }
    });
    return changed;
  }

  /* ─── Имена: обложка и подпись финала ─────────────── */
  function autoSign() { return 'Ваши ' + STATE.groom + ' и ' + STATE.bride; }

  function applyNames(groom, bride) {
    groom = typeof groom === 'string' ? groom.trim() : '';
    bride = typeof bride === 'string' ? bride.trim() : '';
    if (groom) STATE.groom = groom;
    if (bride) STATE.bride = bride;
    setAll('[data-name="groom"]', STATE.groom);
    setAll('[data-name="bride"]', STATE.bride);
    if (!STATE.signUser) setAll('[data-edit="closingSign"]', autoSign());
    document.title = STATE.groom + ' и ' + STATE.bride + ' — приглашение на свадьбу';
    fitNames();
  }

  // Имена стоят лесенкой: жених левее центра, невеста правее. Длинное имя
  // сначала подвигаем к центру, потом уменьшаем шрифт — строка не выходит
  // за поля (40 единиц макета с каждой стороны)
  var NAME_FS = 248, NAME_X = { g: -97, b: 99 };
  function fitNames() {
    var box = document.querySelector('.hero__names--front');
    if (!box) return;
    var u = box.clientWidth / 1366;
    if (!u) return;
    var names = document.querySelectorAll('.hero__names');
    names.forEach(function (n) { n.style.setProperty('--nfs', NAME_FS); });
    var g = box.querySelector('.hero__line--g'), b = box.querySelector('.hero__line--b');
    var wg = g.offsetWidth / u, wb = b.offsetWidth / u;
    var room = 1366 - 80;
    var xg = NAME_X.g, xb = NAME_X.b;
    // сдвиг, при котором строка ещё помещается: |x| ≤ (room − w) / 2
    xg = -Math.max(0, Math.min(-xg, (room - wg) / 2));
    xb = Math.max(0, Math.min(xb, (room - wb) / 2));
    var k = Math.min(1, room / Math.max(wg, wb, 1));
    names.forEach(function (n) {
      n.style.setProperty('--nfs', (NAME_FS * k).toFixed(1));
      n.style.setProperty('--ng', xg.toFixed(1));
      n.style.setProperty('--nb', xb.toFixed(1));
    });
  }

  /* ─── Дата: пять дней, день свадьбы в сердце; отсчёт ── */
  function applyDate(dateStr, timeStr) {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) STATE.date = dateStr.slice(0, 10);
    if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}/.test(timeStr)) STATE.time = timeStr.slice(0, 5);
    var p = STATE.date.split('-').map(Number), y = p[0], m = p[1], d = p[2];
    if (!y || !m || !d) return;
    var row = document.getElementById('datesRow');
    if (row) {
      var cells = row.querySelectorAll('.dates__day');
      var around = [-2, -1, 1, 2];
      cells.forEach(function (el, i) {
        el.textContent = String(new Date(y, m - 1, d + around[i]).getDate());
      });
      var num = row.querySelector('.dates__num');
      if (num) num.textContent = String(d);
    }
    var month = document.getElementById('datesMonth');
    if (month) month.textContent = MONTHS[m - 1] + ' ' + y;
    restartCountdown();
  }

  function plural(n, one, few, many) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  }

  var cdTimer = null;
  function restartCountdown() {
    if (cdTimer) clearInterval(cdTimer);
    var t = STATE.time.length === 4 ? '0' + STATE.time : STATE.time;
    var target = new Date(STATE.date + 'T' + t + ':00');
    if (isNaN(target.getTime())) target = new Date('2027-06-19T15:00:00');
    var els = {
      d: document.getElementById('cdD'), h: document.getElementById('cdH'),
      m: document.getElementById('cdM'), s: document.getElementById('cdS'),
      dl: document.getElementById('cdDl'), hl: document.getElementById('cdHl'),
      ml: document.getElementById('cdMl'), sl: document.getElementById('cdSl')
    };
    function put(el, v) { if (el && el.textContent !== v) el.textContent = v; }
    function tick() {
      var left = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
      var D = Math.floor(left / 86400), H = Math.floor(left % 86400 / 3600),
          M = Math.floor(left % 3600 / 60), S = left % 60;
      put(els.d, String(D)); put(els.h, pad(H)); put(els.m, pad(M)); put(els.s, pad(S));
      put(els.dl, plural(D, 'день', 'дня', 'дней'));
      put(els.hl, plural(H, 'час', 'часа', 'часов'));
      put(els.ml, plural(M, 'минута', 'минуты', 'минут'));
      put(els.sl, plural(S, 'секунда', 'секунды', 'секунд'));
    }
    tick();
    cdTimer = setInterval(tick, 1000);
  }

  /* ─── Место ──────────────────────────────────────── */
  function applyVenue(d) {
    if (typeof d.venue === 'string') setAll('[data-edit="venue"]', d.venue.trim());
    if (typeof d.venueAddress === 'string') setAll('[data-edit="venueAddress"]', d.venueAddress.trim());
  }

  /* ─── Фото в овальной рамке: стрелки, свайп, смена сама ─
     Неактивные фото прозрачные, но не скрыты — кадрирование
     (photo-frame.js) меряет рамку у каждого */
  var ALBUM = { i: 0, timer: 0, pausedUntil: 0 };

  function albumImgs() { return [].slice.call(document.querySelectorAll('#albumPhotos .album__img')); }

  function albumShow(i) {
    var imgs = albumImgs();
    if (!imgs.length) return;
    ALBUM.i = (i + imgs.length) % imgs.length;
    imgs.forEach(function (img, k) { img.classList.toggle('is-active', k === ALBUM.i); });
  }

  function albumStep(dir, byUser) {
    if (byUser) ALBUM.pausedUntil = Date.now() + 12000;
    albumShow(ALBUM.i + dir);
  }

  function initAlbum() {
    var box = document.getElementById('album');
    if (!box) return;
    var prev = box.querySelector('.album__nav--prev'), next = box.querySelector('.album__nav--next');
    if (prev) prev.addEventListener('click', function () { albumStep(-1, true); });
    if (next) next.addEventListener('click', function () { albumStep(1, true); });

    // Свайп по фото
    var photos = document.getElementById('albumPhotos');
    var x0 = null, y0 = 0;
    if (photos) {
      photos.addEventListener('touchstart', function (e) {
        var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY;
      }, { passive: true });
      photos.addEventListener('touchend', function (e) {
        if (x0 == null) return;
        var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) albumStep(dx < 0 ? 1 : -1, true);
      }, { passive: true });
    }

    // Редактор подсвечивает фото, которое правят, — показываем именно его
    if (EDITING && 'MutationObserver' in window) {
      var mo = new MutationObserver(function (list) {
        list.forEach(function (r) {
          if (r.target.classList && r.target.classList.contains('wc-editor-flash')) {
            var k = albumImgs().indexOf(r.target);
            if (k >= 0) albumShow(k);
          }
        });
      });
      albumImgs().forEach(function (img) { mo.observe(img, { attributes: true, attributeFilter: ['class'] }); });
    }

    // У гостя фото сменяются сами, пока рамка на экране
    if (!EDITING && !REDUCED) {
      var visible = false;
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0.35 }).observe(box);
      }
      ALBUM.timer = setInterval(function () {
        if (!visible || document.hidden || Date.now() < ALBUM.pausedUntil) return;
        albumStep(1, false);
      }, 5200);
    }
  }

  /* ─── Расписание: строки + жёлудь на треке ─────────── */
  var TL = { sched: null, rows: [], acorn: null, line: null, fill: null, y0: 0, y1: 0, x: 0, u: 1 };

  function applySchedule(list) {
    if (!Array.isArray(list) || !list.length) return;
    var sig = JSON.stringify(list.map(function (it) { return it ? [it.time, it.title] : null; }));
    if (sig === STATE.scheduleSig) return;          // не перестраиваем то же самое
    STATE.scheduleSig = sig;

    var sched = document.getElementById('sched');
    if (!sched) return;
    // Пункты уже проявились — новые показываем сразу, без повторной анимации
    var shown = !!sched.querySelector('.sched__row.in');
    sched.querySelectorAll('.sched__row').forEach(function (n) { n.remove(); });
    var acorn = document.getElementById('schedAcorn');
    list.forEach(function (it) {
      if (!it) return;
      var row = document.createElement('div');
      row.className = 'sched__row rv' + (shown ? ' in' : '');
      row.innerHTML =
        '<p class="sched__time">' + escapeHtml(it.time || '') + '</p>' +
        '<span class="sched__dot" aria-hidden="true"></span>' +
        '<p class="sched__title">' + escapeHtml(it.title || '') + '</p>';
      sched.insertBefore(row, acorn);
    });
    if (!shown) observeReveal(sched);
    layoutTrack();
  }

  // Точки — центры ромбов (offsetTop: строка при появлении сдвинута
  // transform'ом, getBoundingClientRect дал бы неверные координаты)
  function layoutTrack() {
    var sched = TL.sched = document.getElementById('sched');
    TL.acorn = document.getElementById('schedAcorn');
    TL.line = document.getElementById('schedLine');
    TL.fill = document.getElementById('schedFill');
    if (!sched || !TL.acorn) return;
    var rows = TL.rows = [].slice.call(sched.querySelectorAll('.sched__row'));
    var W = sched.clientWidth;
    if (!rows.length || !W) return;
    var u = TL.u = W / 1366;
    var centers = rows.map(function (r) {
      var dot = r.querySelector('.sched__dot');
      return r.offsetTop + (dot ? dot.offsetTop + dot.offsetHeight / 2 : r.offsetHeight / 2);
    });
    TL.centers = centers;
    TL.y0 = centers[0];
    TL.y1 = centers[centers.length - 1];
    TL.x = 915 * u;
    if (TL.line) {
      TL.line.style.top = TL.y0 + 'px';
      TL.line.style.height = Math.max(0, TL.y1 - TL.y0) + 'px';
    }
    if (TL.fill) TL.fill.style.top = TL.y0 + 'px';
    sched.classList.add('is-ready');
    updateAcorn();
  }

  // Как в других шаблонах: позиция — прямо за прокруткой, без переходов.
  // Жёлудь (123×146 в единицах макета) — центром на треке
  function updateAcorn() {
    var sched = TL.sched, acorn = TL.acorn;
    if (!sched || !acorn || !TL.rows.length) return;
    var top = sched.getBoundingClientRect().top;
    var span = TL.y1 - TL.y0;
    var p = span > 0 ? (window.innerHeight * 0.55 - (top + TL.y0)) / span : 0;
    p = Math.max(0, Math.min(1, p));
    var y = TL.y0 + span * p, u = TL.u;
    acorn.style.transform = 'translate(' + (TL.x - 61.5 * u).toFixed(1) + 'px,' + (y - 80 * u).toFixed(1) + 'px)';
    if (TL.fill) TL.fill.style.height = Math.max(0, y - TL.y0).toFixed(1) + 'px';
    TL.rows.forEach(function (r, i) { r.classList.toggle('is-passed', TL.centers[i] <= y + 2); });
  }

  function initTrack() {
    window.addEventListener('scroll', updateAcorn, { passive: true });
    window.addEventListener('resize', function () { layoutTrack(); fitNames(); }, { passive: true });
    window.addEventListener('load', function () { layoutTrack(); fitNames(); });
    if ('ResizeObserver' in window) {
      var sched = document.getElementById('sched');
      if (sched) new ResizeObserver(function () { layoutTrack(); }).observe(sched);
    }
  }

  /* ─── Палитра дресс-кода: мазки, при многих цветах — плотнее ── */
  function rebuildPalette(colors) {
    if (!Array.isArray(colors) || !colors.length) return;
    var box = document.querySelector('[data-edit="palette"]');
    if (!box) return;
    var list = colors.filter(function (c) { return typeof c === 'string' && c; }).slice(0, 8);
    if (!list.length) return;
    var sig = list.join(',');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    box.innerHTML = '';
    // ширина ряда — не больше 1146 единиц: мазок 245 + шаги
    var step = list.length > 1 ? Math.min(170, (1146 - 245) / (list.length - 1)) : 170;
    box.style.setProperty('--step', step.toFixed(1));
    list.forEach(function (c) {
      var sp = document.createElement('span');
      sp.style.setProperty('--c', c);
      box.appendChild(sp);
    });
  }

  /* ─── Анкета: переключатели и напитки ─────────────── */
  function bindFormOption(label) {
    if (!label || label.dataset.bound) return;
    var input = label.querySelector('input');
    var indicator = label.querySelector('.custom-radio, .custom-check');
    if (!input || !indicator) return;
    label.dataset.bound = '1';
    input.addEventListener('change', function () {
      if (input.type === 'radio') {
        document.querySelectorAll('input[name="' + input.name + '"]').forEach(function (r) {
          var opt = r.closest('.form-option');
          var ind = opt && opt.querySelector('.custom-radio');
          if (ind) ind.classList.remove('checked');
        });
      }
      indicator.classList.toggle('checked', input.checked);
    });
  }
  function bindFormOptions() { document.querySelectorAll('.form-option').forEach(bindFormOption); }

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

  function initRsvp() {
    var form = document.getElementById('rsvpForm');
    if (!form) return;
    var btn = form.querySelector('button[type="submit"]');
    var errEl = document.getElementById('rsvpError');
    var thanks = document.getElementById('rsvpThanks');

    function fail(msg) {
      if (errEl) errEl.textContent = msg;
      if (btn) btn.disabled = false;
    }
    function done() {
      form.hidden = true;
      if (thanks) thanks.hidden = false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (errEl) errEl.textContent = '';
      var nameEl = form.querySelector('[name="guestName"]');
      var guestName = nameEl ? nameEl.value.trim() : '';
      var attendEl = form.querySelector('input[name="attend"]:checked');
      var drinks = [];
      form.querySelectorAll('input[name="drink"]:checked').forEach(function (c) { drinks.push(c.value); });

      // Без адреса сайта (демо, превью редактора) анкета никуда не уходит
      if (!STATE.slug) { done(); return; }
      if (!guestName) { fail('Пожалуйста, укажите ваше имя'); if (nameEl) nameEl.focus(); return; }
      if (!attendEl) { fail('Отметьте, пожалуйста, получится ли у вас прийти'); return; }

      if (btn) btn.disabled = true;
      var body = Object.assign(
        {
          guestName: guestName,
          attending: attendEl.value === 'yes',
          drinkChoice: drinks.join(','),
          wishes: '',
          guestToken: STATE.guestToken || '',
          guestsCount: window.WCRsvpCount ? window.WCRsvpCount.get(form) : 1
        },
        // «Пока не знаю», дети и доп. вопросы — общий модуль ../assets/rsvp-count.js
        window.WCRsvp ? window.WCRsvp.payload(form) : {}
      );
      fetch((STATE.apiBase || '') + '/api/rsvp/' + encodeURIComponent(STATE.slug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (res) {
        if (res.ok) { done(); return; }
        return res.json().catch(function () { return {}; }).then(function (j) {
          fail((j && j.error) || 'Не получилось отправить ответ. Попробуйте ещё раз');
        });
      }).catch(function () {
        fail('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз');
      });
    });
  }

  /* ─── Карта проезда ──────────────────────────────────
     Место/адрес становятся ссылкой, когда пара указала карту.
     Вёрстка не меняется: только курсор и пунктирное подчёркивание. */
  function applyMapLink(url) {
    url = typeof url === 'string' ? url.trim() : '';
    if (!url) return;
    document.querySelectorAll('[data-edit="venue"], [data-edit="venueAddress"]').forEach(function (el) {
      el.__wcMapUrl = url;
      if (el.dataset.wcMap) return;
      el.dataset.wcMap = '1';
      el.style.cursor = 'pointer';
      el.style.textDecoration = 'underline dotted';
      el.style.textUnderlineOffset = '0.25em';
      el.setAttribute('role', 'link');
      el.setAttribute('tabindex', '0');
      el.title = 'Открыть на карте';
      var open = function () { window.open(safeHref(el.__wcMapUrl), '_blank', 'noopener'); };
      el.addEventListener('click', open);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
    });
  }

  /* ─── Появление при прокрутке ────────────────────── */
  var io = null;
  var REVEAL = '.rv:not(.in), .rv-soft:not(.in), .rv-write:not(.in), .rv-brush:not(.in)';

  function revealNow(el) {
    el.classList.add('in');
    if (el.classList.contains('rv-write')) {
      var fin = function () { el.classList.add('done'); };
      el.addEventListener('animationend', fin, { once: true });
      setTimeout(fin, 3000);   // запасной путь: вкладка была в фоне и анимация не шла
    }
  }

  function initReveal() {
    if (REDUCED || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.rv, .rv-soft, .rv-write, .rv-brush').forEach(function (el) { el.classList.add('in', 'done'); });
      return;
    }
    io = new IntersectionObserver(function (entries) {
      // Что вошло в экран одновременно — проявляется лесенкой
      var i = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--d', Math.min(i++, 5) * 120 + 'ms');
        revealNow(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    observeReveal(document);
  }

  function observeReveal(scope) {
    (scope || document).querySelectorAll(REVEAL).forEach(function (el) {
      if (io) io.observe(el);
      else el.classList.add('in', 'done');
    });
  }

  /* ─── Обложка: деревья расступаются ───────────────────
     Ждём шрифт имён и картинки обложки (не дольше 2,5 с), чтобы деревья
     не поехали пустыми. В редакторе и при «меньше движения» — сразу финал. */
  function startHero() {
    if (ROOT.classList.contains('hero-go')) return;
    fitNames();
    ROOT.classList.add('hero-go');
  }

  function initHero() {
    if (EDITING || REDUCED) {
      ROOT.classList.add('no-anim');
      startHero();
      return;
    }
    var waits = [];
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
    document.querySelectorAll('.hero__bg, .hero__tree').forEach(function (img) {
      if (img.complete && img.naturalWidth) return;
      waits.push(img.decode ? img.decode().catch(function () {}) : new Promise(function (res) {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
      }));
    });
    var started = false;
    var go = function () {
      if (started) return;
      started = true;
      // два кадра: сомкнутое положение успевает отрисоваться до перехода
      requestAnimationFrame(function () { requestAnimationFrame(startHero); });
    };
    Promise.all(waits).then(go, go);
    setTimeout(go, 2500);
  }

  /* ─── Применение данных ───────────────────────────── */
  function applyData(d) {
    if (!d) return;
    if (typeof d.apiBase === 'string') STATE.apiBase = d.apiBase;
    if (typeof d.slug === 'string' && d.slug) STATE.slug = d.slug;
    if (typeof d.guestToken === 'string' && d.guestToken) STATE.guestToken = d.guestToken;
    if (typeof d.guestName === 'string' && d.guestName) {
      STATE.guestName = d.guestName;
      var gn = document.querySelector('#rsvpForm [name="guestName"]');
      if (gn && !gn.value) gn.value = d.guestName;
    }

    applyMapLink(d.mapLink);
    // Карта места (Яндекс) по адресу — общий модуль ../assets/venue-map.js
    if (window.WCMap) window.WCMap.set({ address: d.venueAddress, venue: d.venue, mapLink: d.mapLink, point: d.mapPoint, show: d.showMap });
    if (window.WCMusic) window.WCMusic.set(imageUrl(d.musicUrl));

    if (typeof d.closingSign === 'string') {
      var own = d.closingSign.trim();
      STATE.signUser = !!own;
      if (own) setAll('[data-edit="closingSign"]', own);
    }
    applyNames(d.groomName, d.brideName);
    applyDate(d.weddingDate, d.weddingTime);

    setRichText('greetingTitle', d.greetingTitle);
    setParagraphs('inviteText', d.inviteText);
    applyVenue(d);
    setRichText('dressText', d.dressText);
    setRichText('surveyText', d.surveyText);
    setRichText('closingTitle', d.closingTitle);
    if (typeof d.story === 'string' && d.story !== STATE.storySig && setParagraphs('story', d.story)) {
      STATE.storySig = d.story;
    }

    // Сменилось фото в рамке — показываем его
    ['coverPhoto', 'albumPhoto2', 'albumPhoto3'].forEach(function (key, i) {
      if (setImg(key, d[key]) && EDITING) albumShow(i);
    });
    if (window.WCPhotoFrame) window.WCPhotoFrame.apply(d.photoFrames);   // кадрирование фото в рамках

    rebuildPalette(d.dressCodeColors);
    applySchedule(d.schedule);
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

  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin || e.source !== window.parent) return;
    var msg = e.data;
    if (msg && msg.type === 'wc:data' && msg.payload) applyData(msg.payload);
  });

  function init() {
    document.querySelectorAll('img[data-edit]').forEach(function (img) {
      img.setAttribute('data-def', img.getAttribute('src') || '');
    });
    initReveal();
    applySchedule(DEFAULT_SCHEDULE);   // базовое наполнение (сам по себе, без редактора)
    initTrack();
    initAlbum();
    bindFormOptions();
    initRsvp();
    applyDate();
    applyData(dataFromUrl());
    initHero();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { fitNames(); layoutTrack(); });
    }
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'wc:ready' }, window.location.origin);
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
