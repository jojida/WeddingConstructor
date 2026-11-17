/* ============================================================
   SCRIPT.JS — свадебное приглашение «Пудра»
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
    date: '2028-07-30', time: '12:30',
    groom: 'Никита', bride: 'Ольга',
    signUser: false,        // подпись финала задала пара (иначе — имена)
    looksSeen: false,       // данные дресс-кода уже приходили (дальше правки переключают вкладку)
    scheduleSig: '',
    paraSig: {}
  };

  var ICONS = [
    'assets/ic-rings.webp', 'assets/ic-champagne.webp', 'assets/ic-camera.webp',
    'assets/ic-cloche.webp', 'assets/ic-bouquet.webp'
  ];

  var DEFAULT_SCHEDULE = [
    { time: '12:00', title: 'Регистрация брака', icon: 'assets/ic-rings.webp' },
    { time: '14:00', title: 'Фуршет и поздравления', icon: 'assets/ic-champagne.webp' },
    { time: '15:00', title: 'Прогулка и фотосессия', icon: 'assets/ic-camera.webp' },
    { time: '18:00', title: 'Свадебный ужин', icon: 'assets/ic-cloche.webp' },
    { time: '22:00', title: 'Букет невесты и финал вечера', icon: 'assets/ic-bouquet.webp' }
  ];

  // Цвета костюмов по умолчанию (платья — в разметке)
  var DEFAULT_MEN = ['#efe4d6', '#d8c7b3', '#b9a48e', '#c8ccd2', '#a9b8c9', '#e3c4bf'];

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  /* ─── Утилиты ─────────────────────────────────────── */
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

  // Необязательная строка: пустое значение убирает её (CSS :empty)
  function setOptText(key, value) {
    if (typeof value !== 'string') return;
    document.querySelectorAll('[data-edit="' + key + '"]').forEach(function (el) {
      el.innerHTML = escapeHtml(value.trim()).replace(/\n/g, '<br>');
    });
  }

  // Текст абзацами: каждая строка = абзац. Тот же текст не перестраиваем
  function setParagraphs(key, value) {
    if (typeof value !== 'string' || !value.trim() || STATE.paraSig[key] === value) return;
    var box = document.querySelector('[data-edit="' + key + '"]');
    if (!box) return;
    box.innerHTML = '';
    value.split(/\n+/).forEach(function (line) {
      if (!line.trim()) return;
      var p = document.createElement('p');
      p.textContent = line.trim();
      box.appendChild(p);
    });
    STATE.paraSig[key] = value;
  }

  // Пустая строка — пара удалила фото: возвращаем фото дизайна.
  // true — фото действительно сменилось
  function setImg(key, url) {
    if (url == null) return false;
    var changed = false;
    document.querySelectorAll('img[data-edit="' + key + '"]').forEach(function (el) {
      var next = url === '' ? el.getAttribute('data-def') : imageUrl(url);
      if (!next) return;
      var abs = next;
      try { abs = new URL(next, window.location.href).href; } catch (e) {}
      if (el.src !== abs) { el.src = next; changed = true; }
    });
    return changed;
  }

  /* ─── Дресс-код: вкладки «Женщины / Мужчины» ─── */
  function showLooks(which, replay) {
    document.querySelectorAll('.looks__tab').forEach(function (b) {
      var on = b.getAttribute('data-look') === which;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.querySelectorAll('.looks__panel').forEach(function (p) {
      var on = p.getAttribute('data-look') === which;
      var was = p.classList.contains('is-active');
      p.classList.toggle('is-active', on);
      p.setAttribute('aria-hidden', on ? 'false' : 'true');
      // открытая вкладка: силуэты появляются по очереди заново
      if (on && !was && replay && !REDUCED) {
        var grid = p.querySelector('.rv-pop.in');
        if (grid) { grid.classList.remove('in'); void grid.offsetWidth; grid.classList.add('in'); }
      }
    });
  }

  function initLooks() {
    document.querySelectorAll('.looks__tab').forEach(function (b) {
      b.addEventListener('click', function () { showLooks(b.getAttribute('data-look'), true); });
    });
    // В редакторе подсвеченное (правимое) поле дресс-кода — сразу на экране:
    // скрытая вкладка (visibility) находится и подсвечивается редактором
    if (EDITING && 'MutationObserver' in window) {
      var mo = new MutationObserver(function (list) {
        list.forEach(function (r) {
          if (!r.target.classList || !r.target.classList.contains('wc-editor-flash')) return;
          var panel = r.target.closest('.looks__panel');
          if (panel) showLooks(panel.getAttribute('data-look'));
        });
      });
      document.querySelectorAll('.looks__panel [data-edit]').forEach(function (el) {
        mo.observe(el, { attributes: true, attributeFilter: ['class'] });
      });
    }
  }

  /* ─── Имена: обложка и подпись финала ─────────────── */
  function applyNames(groom, bride) {
    groom = typeof groom === 'string' ? groom.trim() : '';
    bride = typeof bride === 'string' ? bride.trim() : '';
    if (groom) STATE.groom = groom;
    if (bride) STATE.bride = bride;
    setAll('[data-name="groom"]', STATE.groom);
    setAll('[data-name="bride"]', STATE.bride);
    if (!STATE.signUser) renderSign();
    document.title = STATE.bride + ' и ' + STATE.groom + ' — приглашение на свадьбу';
    fitNames();
  }

  // Подпись финала: «Невеста &» / «Жених» (как в макете) или своя строка пары
  function renderSign(own) {
    var el = document.getElementById('finSign');
    if (!el) return;
    if (own) {
      el.textContent = own;
      el.style.setProperty('--sfs', 150);
      return;
    }
    el.innerHTML = '<span class="fin__line"><span data-name="bride"></span><span class="vh"> и </span><span class="amp" aria-hidden="true"></span></span>' +
      '<span class="fin__line" data-name="groom"></span>';
    el.querySelector('[data-name="bride"]').textContent = STATE.bride;
    el.querySelector('[data-name="groom"]').textContent = STATE.groom;
    el.style.removeProperty('--sfs');
    fitSign();
  }

  // Длинные имена уменьшаем: на обложке строки не должны залезать на цветы
  // и арку, в финале — за края колонки
  function fitLines(box, prop, base, rooms) {
    if (!box) return;
    var u = (document.getElementById('invite') || document.body).clientWidth / 1366;
    if (!u) return;
    box.style.setProperty(prop, base);
    var k = 1;
    box.querySelectorAll('.cover__line, .fin__line').forEach(function (line, i) {
      var w = line.scrollWidth / u;
      var room = rooms[Math.min(i, rooms.length - 1)];
      if (w > room) k = Math.min(k, room / w);
    });
    if (k < 1) box.style.setProperty(prop, (base * k).toFixed(1));
  }
  function fitNames() { fitLines(document.getElementById('heroNames'), '--nfs', 232, [800, 830]); fitSign(); }
  function fitSign() { if (!STATE.signUser) fitLines(document.getElementById('finSign'), '--sfs', 230, [1180]); }

  /* ─── Дата на обложке ────────────────────────────── */
  function applyDate(dateStr, timeStr) {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) STATE.date = dateStr.slice(0, 10);
    if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}/.test(timeStr)) STATE.time = timeStr.slice(0, 5);
    var p = STATE.date.split('-').map(Number), y = p[0], m = p[1], d = p[2];
    if (!y || !m || !d) return;
    var wd = new Date(y, m - 1, d).getDay();
    var el;
    if ((el = document.getElementById('dateDay'))) el.textContent = String(d);
    if ((el = document.getElementById('dateWday'))) { el.textContent = WEEKDAYS[wd]; el.classList.toggle('is-long', WEEKDAYS[wd].length > 8); }
    if ((el = document.getElementById('dateMonth'))) el.textContent = MONTHS[m - 1];
    if ((el = document.getElementById('dateTime'))) el.textContent = STATE.time.length === 4 ? '0' + STATE.time : STATE.time;
  }

  /* ─── Место и кнопка «Открыть карту» ──────────────── */
  var VENUE = { venue: '', address: '', link: '' };

  function applyVenue(d) {
    if (typeof d.venue === 'string') { VENUE.venue = d.venue.trim(); setAll('[data-edit="venue"]', VENUE.venue); }
    if (typeof d.venueAddress === 'string') { VENUE.address = d.venueAddress.trim(); setAll('[data-edit="venueAddress"]', VENUE.address); }
    if (typeof d.mapLink === 'string') VENUE.link = d.mapLink.trim();
    updateMapButton();
  }

  // Ссылка пары на место — точнее всего; иначе поиск в Яндекс Картах по адресу
  function updateMapButton() {
    var btn = document.getElementById('mapBtn');
    if (!btn) return;
    if (!VENUE.venue && !VENUE.address) {
      var n = document.querySelector('.venue [data-edit="venue"]'), a = document.querySelector('.venue [data-edit="venueAddress"]');
      VENUE.venue = n ? n.textContent.trim() : '';
      VENUE.address = a ? a.textContent.trim() : '';
    }
    var query = VENUE.address || VENUE.venue;
    var href = VENUE.link ? safeHref(VENUE.link) : (query ? 'https://yandex.ru/maps/?text=' + encodeURIComponent(query) : '#');
    btn.setAttribute('href', href);
    btn.hidden = href === '#';
  }

  /* ─── Программа: пункты + сердце на линии ─────────── */
  var TL = { prog: null, path: null, base: null, svg: null, heart: null, len: 0, y0: 0, y1: 0, u: 1 };
  var HEART = { w: 65.6, h: 59 };   // путь сердца — в единицах Canva (×1,333 = px макета)

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

  // Линия вьётся между текстом и картинкой: у пункта с текстом слева — правее
  // (x 820), с текстом справа — левее (x 500); начало — под сердцем (x 736).
  // Точки — по offsetTop (строка при появлении сдвинута transform'ом)
  function layoutTrack() {
    var prog = TL.prog = document.getElementById('prog');
    var svg = TL.svg = document.getElementById('progSvg');
    var path = TL.path = document.getElementById('progPath');
    TL.base = document.getElementById('progBase');
    TL.heart = document.getElementById('progHeart');
    if (!prog || !svg || !path) return;
    var rows = [].slice.call(prog.querySelectorAll('.prog__row'));
    var W = prog.clientWidth, H = prog.offsetHeight;
    if (!rows.length || !W || !H) return;
    var u = TL.u = W / 1366;
    var centers = rows.map(function (r) { return r.offsetTop + r.offsetHeight / 2; });
    var xOf = function (r) { return (r.classList.contains('is-right') ? 500 : 820) * u; };
    // Начало и конец — прямо вверх и вниз от крайних пунктов: без завитков
    var pts = [[xOf(rows[0]), Math.max(40 * u, centers[0] - 150 * u)]];
    rows.forEach(function (r, k) { pts.push([xOf(r), centers[k]]); });
    pts.push([xOf(rows[rows.length - 1]), centers[centers.length - 1] + 150 * u]);

    var d = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var k = 1; k < pts.length; k++) {
      var a = pts[k - 1], b = pts[k], h = (b[1] - a[1]) / 2;
      d += ' C ' + a[0].toFixed(1) + ' ' + (a[1] + h).toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + (b[1] - h).toFixed(1) +
           ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
    }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    path.setAttribute('d', d);
    if (TL.base) TL.base.setAttribute('d', d);
    try { TL.len = path.getTotalLength(); } catch (e) { TL.len = 0; }
    path.style.strokeDasharray = TL.len.toFixed(1) + ' ' + (TL.len + 10).toFixed(1);
    TL.y0 = pts[0][1];
    TL.y1 = pts[pts.length - 1][1];
    prog.classList.add('is-ready');
    updateHeart();
  }

  // Как в других шаблонах: позиция — прямо за прокруткой, без переходов.
  // Сердце — центром на конце прорисованной линии
  function updateHeart() {
    var prog = TL.prog, path = TL.path, heart = TL.heart;
    if (!prog || !path || !heart || !TL.len) return;
    var top = prog.getBoundingClientRect().top;
    var span = TL.y1 - TL.y0;
    var p = span > 0 ? (window.innerHeight * 0.55 - (top + TL.y0)) / span : 0;
    p = Math.max(0, Math.min(1, p));
    var pt;
    try { pt = path.getPointAtLength(p * TL.len); } catch (e) { return; }
    path.style.strokeDashoffset = (TL.len * (1 - p)).toFixed(1);
    var k = TL.u * 1.3333;
    heart.setAttribute('transform',
      'translate(' + (pt.x - HEART.w / 2 * k).toFixed(1) + ' ' + (pt.y - HEART.h / 2 * k).toFixed(1) + ') scale(' + k.toFixed(4) + ')');
  }

  function initTrack() {
    window.addEventListener('scroll', updateHeart, { passive: true });
    window.addEventListener('resize', function () { layoutTrack(); fitNames(); }, { passive: true });
    window.addEventListener('load', function () { layoutTrack(); fitNames(); });
    if ('ResizeObserver' in window) {
      var prog = document.getElementById('prog');
      if (prog) new ResizeObserver(function () { layoutTrack(); }).observe(prog);
    }
  }

  /* ─── Дресс-код: платья в цветах палитры ──────────── */
  function cleanColors(colors) {
    return Array.isArray(colors) ? colors.filter(function (c) { return typeof c === 'string' && /^#[0-9a-f]{3,8}$|^rgb/i.test(c.trim()); }).slice(0, 9) : [];
  }

  // Бант — тот же оттенок темнее. У палитры макета — банты как в макете
  var DESIGN_BOWS = { '#fddfe5': '#f690a8', '#ffeef1': '#ffedf0', '#fff1e3': '#fff0e1', '#faf2d7': '#ffe487', '#feecdd': '#f6d8ba', '#d0eef4': '#39c6e1' };
  function bowColor(c) {
    var k = c.trim().toLowerCase();
    if (DESIGN_BOWS[k]) return DESIGN_BOWS[k];
    var m = k.match(/^#([0-9a-f]{6}|[0-9a-f]{3})(?:[0-9a-f]{2})?$/), r, g, b;
    if (m) {
      var hx = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
      r = parseInt(hx.slice(0, 2), 16); g = parseInt(hx.slice(2, 4), 16); b = parseInt(hx.slice(4, 6), 16);
    } else {
      m = k.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
      if (!m) return c;
      r = +m[1]; g = +m[2]; b = +m[3];
    }
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return 'hsl(' + h.toFixed(0) + ' ' + (s * 100).toFixed(0) + '% ' + (Math.max(.22, l - .15) * 100).toFixed(0) + '%)';
  }

  function rebuildDresses(colors) {
    var list = cleanColors(colors);
    var box = document.querySelector('[data-edit="palette"]');
    if (!box || !list.length) return false;
    var sig = list.join(',');
    if (box.dataset.sig === sig) return false;
    box.dataset.sig = sig;
    var shown = box.classList.contains('in');
    box.innerHTML = '';
    list.forEach(function (c) {
      var sp = document.createElement('span');
      sp.className = 'dress__item';
      sp.style.setProperty('--c', c);
      sp.style.setProperty('--b', bowColor(c));
      sp.appendChild(document.createElement('i'));
      box.appendChild(sp);
    });
    if (shown) box.classList.add('in');
    return true;
  }

  // Костюмы: символ #suit, пиджак — цвет палитры, бабочка — оттенок темнее
  function rebuildSuits(colors) {
    var list = cleanColors(colors);
    var box = document.querySelector('[data-edit="menColors"]');
    if (!box || !list.length) return false;
    var sig = list.join(',');
    if (box.dataset.sig === sig) return false;
    box.dataset.sig = sig;
    var shown = box.classList.contains('in');
    box.innerHTML = '';
    var NS = 'http://www.w3.org/2000/svg';
    list.forEach(function (c) {
      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'suit');
      svg.setAttribute('viewBox', '0 0 257 308');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.setProperty('--c', c);
      svg.style.setProperty('--b', bowColor(c));
      var use = document.createElementNS(NS, 'use');
      use.setAttribute('href', '#suit');
      svg.appendChild(use);
      box.appendChild(svg);
    });
    if (shown) box.classList.add('in');
    return true;
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
      if (el.dataset.wcMapBound) return;
      el.dataset.wcMapBound = '1';
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
  var REVEAL = '.rv:not(.in), .rv-soft:not(.in), .rv-write:not(.in), .rv-line:not(.in), .rv-pop:not(.in)';

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
      document.querySelectorAll('.rv, .rv-soft, .rv-write, .rv-line, .rv-pop').forEach(function (el) { el.classList.add('in', 'done'); });
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
    }, { threshold: 0, rootMargin: '0px 0px 10% 0px' });
    observeReveal(document);
    // Орнаменты свёрнуты clip-path до середины: Chrome считает пересечение
    // с учётом своего clip-path, видимая доля почти нулевая — для них порог 0.
    // И без запаса: остальное проявляется заранее, а орнаменты — на глазах.
    var ioClip = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        revealNow(e.target);
        ioClip.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px' });
    document.querySelectorAll('.rv-line').forEach(function (el) { io.unobserve(el); ioClip.observe(el); });
  }

  function observeReveal(scope) {
    (scope || document).querySelectorAll(REVEAL).forEach(function (el) {
      if (io) io.observe(el);
      else el.classList.add('in', 'done');
    });
  }

  /* ─── Обложка ─────────────────────────────────────────
     Ждём шрифты и арку (не дольше 2,5 с), потом арка и пара проявляются,
     цветы распускаются, имена пишутся. В редакторе, без анимации в тарифе и
     при «меньше движения» — сразу финал (классы ставит скрипт в <head>). */
  function namesDone() {
    var names = document.getElementById('heroNames');
    if (names) names.classList.add('done');
  }

  function startHero() {
    fitNames();
    if (ROOT.classList.contains('no-anim')) { ROOT.classList.add('hero-go'); namesDone(); return; }
    ROOT.classList.add('hero-go');
    var names = document.getElementById('heroNames');
    if (names) {
      names.addEventListener('animationend', namesDone, { once: true });
      setTimeout(namesDone, 4200);
    }
  }

  // Редактор: «▶ Посмотреть, как откроется» на обложке (../assets/intro-preview.js) —
  // обложка собирается заново, как у гостя
  function replayHero(done) {
    var names = document.getElementById('heroNames');
    ROOT.classList.add('no-anim');
    ROOT.classList.remove('hero-go');
    if (names) names.classList.remove('done');
    void ROOT.offsetWidth;                       // в начальное положение без обратного хода
    ROOT.classList.remove('no-anim');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ROOT.classList.add('hero-go');
        if (names) names.addEventListener('animationend', namesDone, { once: true });
        setTimeout(function () { namesDone(); done(); }, 3900);
      });
    });
  }

  function initHero() {
    if (EDITING || REDUCED || NO_INTRO) {
      ROOT.classList.add('no-anim');
      startHero();
      if (EDITING && !REDUCED && window.WCIntroPreview && window.WCIntroPreview.on) window.WCIntroPreview.button(replayHero);
      return;
    }
    var waits = [];
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
    document.querySelectorAll('.cover__arch, .cover__couple').forEach(function (img) {
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
      // два кадра: начальное положение успевает отрисоваться до перехода
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
      renderSign(own);
    }
    applyNames(d.groomName, d.brideName);
    applyDate(d.weddingDate, d.weddingTime);

    setRichText('heroTitle', d.heroTitle);
    setOptText('saveDate', d.saveDate);
    setOptText('heroText', d.heroText);
    setRichText('greetingTitle', d.greetingTitle);
    setParagraphs('inviteText', d.inviteText);
    applyVenue(d);
    setRichText('mapButton', d.mapButton);
    setOptText('heartTitle', d.heartTitle);
    setOptText('storyTitle', d.storyTitle);
    setParagraphs('loveStory', d.loveStory);
    setOptText('forecastQuote', d.forecastQuote);
    [1, 2, 3, 4].forEach(function (n) {
      setOptText('forecast' + n + 'Title', d['forecast' + n + 'Title']);
      setOptText('forecast' + n + 'Text', d['forecast' + n + 'Text']);
    });
    setRichText('menuTitle', d.menuTitle);
    setParagraphs('menuText', d.menuText);
    setRichText('programTitle', d.programTitle);
    setRichText('dressTitle', d.dressTitle);
    setOptText('dressText', d.dressText);
    setOptText('dressNote', d.dressNote);
    setRichText('detailsTitle', d.detailsTitle);
    setParagraphs('detailsText', d.detailsText);
    setRichText('wishTitle', d.wishTitle);
    setParagraphs('story', d.story);
    setRichText('surveyTitle', d.surveyTitle);
    setOptText('surveyText', d.surveyText);
    setRichText('closingTitle', d.closingTitle);

    setImg('coverPhoto', d.coverPhoto);
    // Дресс-код: в редакторе правку сразу видно — открываем её вкладку
    // (первые данные после загрузки вкладку не переключают)
    var looksReady = STATE.looksSeen, showTab = '';
    [['dressCodePhoto', 'women'], ['dressPhoto2', 'women'], ['dressPhoto3', 'women'], ['dressPhoto4', 'women'],
     ['dressMan1', 'men'], ['dressMan2', 'men'], ['dressMan3', 'men'], ['dressMan4', 'men']].forEach(function (k) {
      if (setImg(k[0], d[k[0]])) showTab = k[1];
      if (d[k[0]] != null) STATE.looksSeen = true;
    });
    if (window.WCPhotoFrame) window.WCPhotoFrame.apply(d.photoFrames);   // кадрирование фото в рамках

    if (rebuildDresses(d.dressCodeColors)) showTab = 'women';
    if (rebuildSuits(d.menColors)) showTab = 'men';
    if (d.dressCodeColors != null || d.menColors != null) STATE.looksSeen = true;
    if (EDITING && looksReady && showTab) showLooks(showTab);
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
    rebuildSuits(DEFAULT_MEN);
    initLooks();
    initReveal();
    applySchedule(DEFAULT_SCHEDULE);   // базовое наполнение (сам по себе, без редактора)
    initTrack();
    bindFormOptions();
    initRsvp();
    applyDate();
    updateMapButton();
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
