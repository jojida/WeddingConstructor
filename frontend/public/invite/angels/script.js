/* ============================================================
   SCRIPT.JS — свадебное приглашение «Ангелы»
   Подстановка данных конструктора без изменения дизайна:
   URL-параметры (страница гостя) + postMessage('wc:data') (живое превью).
   Ключи данных == data-edit в index.html == id полей в constants.ts.
   ============================================================ */
(function () {
  'use strict';

  var ROOT = document.documentElement;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EDITING = new URLSearchParams(window.location.search).get('editing') === '1';
  // intro=0 — анимация открытия не входит в тариф: обложка сразу в финале, как в редакторе
  var NO_INTRO = new URLSearchParams(window.location.search).get('intro') === '0';

  var STATE = {
    apiBase: '', slug: '', guestToken: '', guestName: '',
    date: '2027-07-12', time: '12:00',
    groom: 'Алексей', bride: 'Ангелина',
    signUser: false,        // подпись финала задала пара (иначе — имена)
    looksSeen: false,       // данные с фото образов уже приходили
    scheduleSig: '',
    storySig: ''
  };

  var ICONS = [
    'assets/icon-rings.webp', 'assets/icon-champagne.webp', 'assets/icon-plate.webp',
    'assets/icon-cake.webp', 'assets/icon-camera.webp'
  ];

  var DEFAULT_SCHEDULE = [
    { time: '12:00', title: 'Церемония', icon: 'assets/icon-rings.webp' },
    { time: '15:00', title: 'Фуршет', icon: 'assets/icon-champagne.webp' },
    { time: '18:00', title: 'Банкет', icon: 'assets/icon-plate.webp' },
    { time: '20:00', title: 'Торт', icon: 'assets/icon-cake.webp' },
    { time: '22:00', title: 'Фотосессия', icon: 'assets/icon-camera.webp' }
  ];

  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

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

  // Иконка пункта: картинка (из набора или загруженная) — иначе эмодзи/символ
  function isImageIcon(s) {
    return typeof s === 'string' && (/\.(webp|png|jpe?g|svg|gif)(\?|$)/i.test(s) || /^(https?:|data:image|blob:|\/)/.test(s));
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

  // Пустая строка — пара удалила фото: возвращаем фото дизайна
  // Возвращает true, если фото сменилось
  function setImg(key, url) {
    if (url == null) return false;
    var changed = false;
    document.querySelectorAll('img[data-edit="' + key + '"]').forEach(function (el) {
      var next = url === '' ? el.getAttribute('data-def') : imageUrl(url);
      if (!next) return;
      // «assets/x.jpg» и «/invite/angels/assets/x.jpg» — одно и то же фото
      var abs = next;
      try { abs = new URL(next, window.location.href).href; } catch (e) {}
      if (el.src !== abs) { el.src = next; changed = true; }
    });
    return changed;
  }

  /* ─── Дресс-код: вкладки «Для дам / Для джентльменов» ─── */
  function showLooks(which) {
    document.querySelectorAll('.looks__tab').forEach(function (b) {
      var on = b.getAttribute('data-look') === which;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.looks__panel').forEach(function (p) {
      var on = p.getAttribute('data-look') === which;
      p.classList.toggle('is-active', on);
      p.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  }

  function initLooks() {
    document.querySelectorAll('.looks__tab').forEach(function (b) {
      b.addEventListener('click', function () { showLooks(b.getAttribute('data-look')); });
    });
    // В редакторе подсвеченное (правимое) фото образа — сразу на экране:
    // скрытая вкладка (visibility) находится и подсвечивается редактором
    if (EDITING && 'MutationObserver' in window) {
      var mo = new MutationObserver(function (list) {
        list.forEach(function (r) {
          if (!r.target.classList || !r.target.classList.contains('wc-editor-flash')) return;
          var panel = r.target.closest('.looks__panel');
          if (panel) showLooks(panel.getAttribute('data-look'));
        });
      });
      document.querySelectorAll('.looks__panel img').forEach(function (img) {
        mo.observe(img, { attributes: true, attributeFilter: ['class'] });
      });
    }
  }

  /* ─── Имена: лента на обложке и подпись финала ───── */
  function autoSign() { return STATE.groom + ' и ' + STATE.bride; }

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

  // Имена — на прямом участке ленты (≈ 820 единиц макета): длинные ужимаем
  var NAME_FS = 131, NAME_ROOM = 820;
  function fitNames() {
    var el = document.getElementById('heroNames');
    var hero = document.getElementById('hero');
    if (!el || !hero) return;
    var u = hero.clientWidth / 1366;
    if (!u) return;
    el.style.setProperty('--nfs', NAME_FS);
    var w = el.offsetWidth / u;
    if (w > NAME_ROOM) el.style.setProperty('--nfs', (NAME_FS * NAME_ROOM / w).toFixed(1));
  }

  /* ─── Дата: строка «12 июля 2027» и отсчёт ─────────── */
  function applyDate(dateStr, timeStr) {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) STATE.date = dateStr.slice(0, 10);
    if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}/.test(timeStr)) STATE.time = timeStr.slice(0, 5);
    var p = STATE.date.split('-').map(Number), y = p[0], m = p[1], d = p[2];
    if (!y || !m || !d) return;
    var line = document.getElementById('dateLine');
    if (line) line.textContent = d + ' ' + MONTHS_GEN[m - 1] + ' ' + y;
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
    if (isNaN(target.getTime())) target = new Date('2027-07-12T12:00:00');
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

  /* ─── Программа дня: пункты лесенкой + Купидон на пунктире ── */
  var TL = { prog: null, path: null, svg: null, cupid: null, len: 0, y0: 0, y1: 0, u: 1 };

  function applySchedule(list) {
    if (!Array.isArray(list) || !list.length) return;
    var sig = JSON.stringify(list.map(function (it) { return it ? [it.time, it.title, it.icon] : null; }));
    if (sig === STATE.scheduleSig) return;          // не перестраиваем то же самое
    STATE.scheduleSig = sig;

    var prog = document.getElementById('prog');
    if (!prog) return;
    // Пункты уже проявились — новые показываем сразу, без повторной анимации
    var shown = !!prog.querySelector('.prog__row.in');
    prog.querySelectorAll('.prog__row').forEach(function (n) { n.remove(); });
    var i = 0;
    list.forEach(function (it) {
      if (!it) return;
      var row = document.createElement('div');
      row.className = 'prog__row' + (i % 2 ? ' is-right' : '') + ' rv' + (shown ? ' in' : '');
      var icon = it.icon || ICONS[i % ICONS.length];
      var iconHtml = isImageIcon(icon)
        ? '<img class="prog__icon" src="' + escapeHtml(imageUrl(icon)) + '" alt="" loading="lazy" decoding="async">'
        : '<span class="prog__icon prog__icon--emoji" aria-hidden="true">' + escapeHtml(icon) + '</span>';
      row.innerHTML =
        '<div class="prog__text"><p class="prog__time">' + escapeHtml(it.time || '') + '</p>' +
        '<p class="prog__title">' + escapeHtml(it.title || '') + '</p></div>' +
        '<div class="prog__icon-box">' + iconHtml + '</div>';
      prog.appendChild(row);
      i++;
    });
    if (!shown) observeReveal(prog);
    prog.querySelectorAll('img.prog__icon').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', layoutTrack, { once: true });
    });
    layoutTrack();
  }

  // Пунктир вьётся по коридору между текстом и картинками (x 600–720),
  // у каждого пункта — к стороне картинки. Точки — по offsetTop
  // (строка при появлении сдвинута transform'ом)
  function layoutTrack() {
    var prog = TL.prog = document.getElementById('prog');
    var svg = TL.svg = document.getElementById('progSvg');
    var path = TL.path = document.getElementById('progPath');
    TL.cupid = document.getElementById('progCupid');
    if (!prog || !svg || !path) return;
    var rows = [].slice.call(prog.querySelectorAll('.prog__row'));
    var W = prog.clientWidth, H = prog.offsetHeight;
    if (!rows.length || !W || !H) return;
    var u = TL.u = W / 1366;
    var centers = rows.map(function (r) { return r.offsetTop + r.offsetHeight / 2; });
    var pts = [[660 * u, Math.max(20 * u, centers[0] - 230 * u)]];
    rows.forEach(function (r, k) {
      pts.push([(r.classList.contains('is-right') ? 600 : 720) * u, centers[k]]);
    });
    pts.push([655 * u, centers[centers.length - 1] + 200 * u]);

    var d = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var k = 1; k < pts.length; k++) {
      var a = pts[k - 1], b = pts[k], h = (b[1] - a[1]) / 2;
      d += ' C ' + a[0].toFixed(1) + ' ' + (a[1] + h).toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + (b[1] - h).toFixed(1) +
           ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
    }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    path.setAttribute('d', d);
    try { TL.len = path.getTotalLength(); } catch (e) { TL.len = 0; }
    TL.y0 = pts[0][1];
    TL.y1 = pts[pts.length - 1][1];
    prog.classList.add('is-ready');
    updateCupid();
  }

  // Как в других шаблонах: позиция — прямо за прокруткой, без переходов.
  // Купидон (277×181 в единицах макета) летит над точкой пути
  function updateCupid() {
    var prog = TL.prog, path = TL.path, cupid = TL.cupid;
    if (!prog || !path || !cupid || !TL.len) return;
    var top = prog.getBoundingClientRect().top;
    var span = TL.y1 - TL.y0;
    var p = span > 0 ? (window.innerHeight * 0.5 - (top + TL.y0)) / span : 0;
    p = Math.max(0, Math.min(1, p));
    var pt;
    try { pt = path.getPointAtLength(p * TL.len); } catch (e) { return; }
    var u = TL.u;
    cupid.setAttribute('transform',
      'translate(' + (pt.x - 150 * u).toFixed(1) + ' ' + (pt.y - 165 * u).toFixed(1) + ') scale(' + u.toFixed(4) + ')');
  }

  function initTrack() {
    window.addEventListener('scroll', updateCupid, { passive: true });
    window.addEventListener('resize', function () { layoutTrack(); fitNames(); }, { passive: true });
    window.addEventListener('load', function () { layoutTrack(); fitNames(); });
    if ('ResizeObserver' in window) {
      var prog = document.getElementById('prog');
      if (prog) new ResizeObserver(function () { layoutTrack(); }).observe(prog);
    }
  }

  /* ─── Палитра дресс-кода: кружки, при многих цветах — мельче ── */
  function rebuildPalette(colors) {
    if (!Array.isArray(colors) || !colors.length) return;
    var box = document.querySelector('[data-edit="palette"]');
    if (!box) return;
    var list = colors.filter(function (c) { return typeof c === 'string' && c; }).slice(0, 8);
    if (!list.length) return;
    var sig = list.join(',');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    var shown = box.classList.contains('in');
    box.innerHTML = '';
    // Ряд шириной 1246 единиц: 4 кружка — как в макете (282), 5–6 — мельче
    // в один ряд, 7–8 — по четыре в два ряда
    var n = list.length;
    var perRow = n <= 6 ? n : Math.ceil(n / 2);
    var s = Math.min(282, (1246 - (perRow - 1) * 34) / perRow);
    box.style.setProperty('--s', s.toFixed(1));
    list.forEach(function (c) {
      var sp = document.createElement('span');
      sp.style.setProperty('--c', c);
      box.appendChild(sp);
    });
    if (shown) box.classList.add('in');
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
  var io = null, ioClip = null;
  var REVEAL = '.rv:not(.in), .rv-soft:not(.in), .rv-write:not(.in), .rv-pop:not(.in), .scroll:not(.in), .polaroid:not(.in)';

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
      document.querySelectorAll('.rv, .rv-soft, .rv-write, .rv-pop, .scroll, .polaroid').forEach(function (el) { el.classList.add('in', 'done'); });
      return;
    }
    // Что вошло в экран одновременно — проявляется лесенкой
    var enter = function (entries, obs) {
      var i = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--d', Math.min(i++, 5) * 120 + 'ms');
        revealNow(e.target);
        obs.unobserve(e.target);
      });
    };
    io = new IntersectionObserver(enter, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    // Свиток до раскрытия обрезан clip-path до верхнего валика (~5% высоты),
    // а Chrome считает видимость с учётом clip-path: порог 0.12 не набирался
    // никогда, и свиток оставался свёрнутым. Ему — порог 0.
    ioClip = new IntersectionObserver(enter, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    observeReveal(document);
  }

  function observeReveal(scope) {
    (scope || document).querySelectorAll(REVEAL).forEach(function (el) {
      var obs = el.classList.contains('scroll') ? ioClip : io;
      if (obs) obs.observe(el);
      else el.classList.add('in', 'done');
    });
  }

  /* ─── Обложка ─────────────────────────────────────────
     Ждём шрифт имён и фото (не дольше 2,5 с), потом облака поднимаются,
     Купидон прилетает, лента разворачивается. В редакторе и при
     «меньше движения» — сразу финал. */
  function startHero() {
    if (ROOT.classList.contains('hero-go')) return;
    fitNames();
    ROOT.classList.add('hero-go');
  }

  function initHero() {
    if (EDITING || REDUCED || NO_INTRO) {
      ROOT.classList.add('no-anim');
      startHero();
      return;
    }
    // Гость сначала открывает 3D-конверт (../assets/envelope3d.js):
    // облака, Купидон и лента начинают, пока конверт растворяется
    if (window.WCEnvelope && window.WCEnvelope.active) {
      window.addEventListener('wc:envelope-open', waitAndStartHero, { once: true });
      return;
    }
    waitAndStartHero();
  }

  function waitAndStartHero() {
    var waits = [];
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
    var photo = document.querySelector('.hero__photo');
    if (photo && !(photo.complete && photo.naturalWidth)) {
      waits.push(photo.decode ? photo.decode().catch(function () {}) : new Promise(function (res) {
        photo.addEventListener('load', res, { once: true });
        photo.addEventListener('error', res, { once: true });
      }));
    }
    var started = false;
    var go = function () {
      if (started) return;
      started = true;
      requestAnimationFrame(function () { requestAnimationFrame(startHero); });
    };
    Promise.all(waits).then(go, go);
    setTimeout(go, 2500);
  }

  /* ─── Применение данных ───────────────────────────── */
  function applyData(d) {
    if (window.WCSections) WCSections.apply(d);
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
    if (window.WCMap) window.WCMap.set({ address: d.venueAddress, venue: d.venue, mapLink: d.mapLink, point: d.mapPoint, show: d.enabledSections && typeof d.enabledSections.map === 'boolean' ? d.enabledSections.map : d.showMap !== false });
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
    setRichText('dateIntro', d.dateIntro);
    setRichText('dressText', d.dressText);
    setRichText('surveyText', d.surveyText);
    setRichText('closingTitle', d.closingTitle);
    if (typeof d.story === 'string' && d.story !== STATE.storySig && setParagraphs('story', d.story)) {
      STATE.storySig = d.story;
    }

    setImg('coverPhoto', d.coverPhoto);
    setImg('polaroidPhoto', d.polaroidPhoto);
    // Образы гостей: в редакторе замену фото сразу видно — открываем его
    // вкладку (первые данные после загрузки вкладку не переключают)
    var looksReady = STATE.looksSeen;
    [['dressCodePhoto', 'women'], ['dressPhoto2', 'women'], ['dressMan1', 'men'], ['dressMan2', 'men']].forEach(function (k) {
      if (setImg(k[0], d[k[0]]) && EDITING && looksReady) showLooks(k[1]);
      if (d[k[0]] != null) STATE.looksSeen = true;
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
    initLooks();
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
