/* ============================================================
   SCRIPT.JS — свадебное приглашение «Клубника»
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
    date: '2027-06-19', time: '12:00',
    groom: 'Вадим', bride: 'Дарья',
    chatName: '',           // имя в шапке чата; пусто — имя жениха
    signUser: false,        // подпись финала задала пара (иначе — имена)
    scheduleSig: '',
    chatSig: '',
    paraSig: {}
  };

  var ICONS = [
    'assets/ic-rings.webp', 'assets/ic-camera.webp', 'assets/ic-champagne.webp',
    'assets/cloche.webp', 'assets/ic-cake.webp', 'assets/ic-disco.webp'
  ];

  var DEFAULT_SCHEDULE = [
    { time: '12:00', title: 'Регистрация брака', icon: 'assets/ic-rings.webp' },
    { time: '13:30', title: 'Фотосессия', icon: 'assets/ic-camera.webp' },
    { time: '15:00', title: 'Фуршет и поздравления', icon: 'assets/ic-champagne.webp' },
    { time: '17:00', title: 'Праздничный ужин', icon: 'assets/cloche.webp' },
    { time: '20:00', title: 'Свадебный торт', icon: 'assets/ic-cake.webp' },
    { time: '21:00', title: 'Танцы до утра', icon: 'assets/ic-disco.webp' }
  ];

  // Переписка по умолчанию: слева — он (собеседник в шапке), справа — она
  var DEFAULT_CHAT = [
    { from: 'him', text: 'Ты не спишь?' },
    { from: 'her', text: 'Нет 🙂 Что-то случилось?' },
    { from: 'him', text: 'Я тут подумал…' },
    { from: 'him', text: 'Хочу просыпаться рядом с тобой каждое утро' },
    { from: 'him', text: 'Выйдешь за меня? 💍' },
    { from: 'her', text: 'Да! Тысячу раз да 💗' }
  ];

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

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

  function unit() {
    return ((document.getElementById('invite') || document.body).clientWidth || 0) / 1366;
  }

  /* ─── Имена: полароид и подпись финала ───────────── */
  function applyNames(groom, bride) {
    groom = typeof groom === 'string' ? groom.trim() : '';
    bride = typeof bride === 'string' ? bride.trim() : '';
    if (groom) STATE.groom = groom;
    if (bride) STATE.bride = bride;
    setAll('[data-name="groom"]', STATE.groom);
    setAll('[data-name="bride"]', STATE.bride);
    if (!STATE.signUser) renderSign();
    document.title = STATE.bride + ' и ' + STATE.groom + ' — приглашение на свадьбу';
    applyChatHead();
    fitNames();
  }

  // Подпись финала: «Жених + Невеста» (как на полароиде) или своя строка пары
  function renderSign(own) {
    var el = document.getElementById('finSign');
    if (!el) return;
    if (own) { el.textContent = own; return; }
    el.innerHTML = '<span data-name="groom"></span> + <span data-name="bride"></span>';
    el.querySelector('[data-name="groom"]').textContent = STATE.groom;
    el.querySelector('[data-name="bride"]').textContent = STATE.bride;
  }

  // Длинные имена уменьшаем: строка не шире нижнего поля полароида (~960 единиц)
  function fitNames() {
    var box = document.getElementById('heroNames');
    var u = unit();
    if (!box || !u) return;
    box.style.setProperty('--nfs', 138);
    var line = box.querySelector('.pol__line');
    if (!line) return;
    var w = line.scrollWidth / u;
    if (w > 960) box.style.setProperty('--nfs', (138 * 960 / w).toFixed(1));
  }

  // Длинный месяц («19 сентября 2027») — дата не шире 1240 единиц
  function fitDate() {
    var el = document.getElementById('heroDate');
    var u = unit();
    if (!el || !u) return;
    el.style.setProperty('--dfs', 182);
    var range = document.createRange();
    range.selectNodeContents(el);
    var w = range.getBoundingClientRect().width / u;
    if (w > 1240) el.style.setProperty('--dfs', (182 * 1240 / w).toFixed(1));
  }

  /* ─── Дата, время, таймер ─────────────────────────── */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function plural(n, one, few, many) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return one;
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
    return many;
  }

  function applyDate(dateStr, timeStr) {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) STATE.date = dateStr.slice(0, 10);
    if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}/.test(timeStr)) STATE.time = timeStr.slice(0, 5);
    var p = STATE.date.split('-').map(Number), y = p[0], m = p[1], d = p[2];
    if (!y || !m || !d) return;
    var el;
    if ((el = document.getElementById('heroDate'))) { el.textContent = d + ' ' + MONTHS[m - 1] + ' ' + y; fitDate(); }
    if ((el = document.getElementById('venueTime'))) el.textContent = STATE.time.length === 4 ? '0' + STATE.time : STATE.time;
    if ((el = document.getElementById('chatBadge'))) el.textContent = String(d);
    restartCountdown();
  }

  var cdTimer = null;
  function restartCountdown() {
    if (cdTimer) clearInterval(cdTimer);
    var t = STATE.time.length === 4 ? '0' + STATE.time : STATE.time;
    var target = new Date(STATE.date + 'T' + t + ':00');
    if (isNaN(target.getTime())) target = new Date('2027-06-19T12:00:00');
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

  /* Место/адрес становятся ссылкой, когда пара указала карту.
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

  /* ─── Детские фото: длинная реплика жениха — мельче ── */
  function fitCaptions() {
    var el = document.getElementById('capGroom');
    if (!el) return;
    var n = el.textContent.trim().length;
    el.classList.toggle('is-mid', n > 12 && n <= 26);
    el.classList.toggle('is-long', n > 26);
  }

  /* ─── Переписка ───────────────────────────────────────
     Пузыри строятся из customData.chat: [{ from: 'him'|'her', text }].
     У гостя, когда телефон появляется на экране, сообщения приходят по
     очереди («печатает…» перед репликой собеседника). В редакторе — сразу все */
  var CHAT = { started: false, done: false, timers: [] };

  function cleanChat(list) {
    if (!Array.isArray(list)) return null;
    return list.filter(function (m) { return m && typeof m.text === 'string' && m.text.trim(); })
      .slice(0, 16)
      .map(function (m) { return { from: m.from === 'her' ? 'her' : 'him', text: m.text.trim().slice(0, 300) }; });
  }

  function renderChat(list) {
    var items = cleanChat(list);
    if (!items || !items.length) return;
    var sig = JSON.stringify(items);
    if (sig === STATE.chatSig) return;
    STATE.chatSig = sig;
    var box = document.getElementById('chatMsgs');
    if (!box) return;
    stopChat(true);
    box.querySelectorAll('.msg').forEach(function (n) { n.remove(); });
    var spark = box.querySelector('.phone__doodle--spark');
    items.forEach(function (m, i) {
      var next = items[i + 1];
      var row = document.createElement('div');
      row.className = 'msg msg--' + m.from + (!next || next.from !== m.from ? ' is-tail' : '');
      var b = document.createElement('p');
      b.className = 'bubble';
      b.textContent = m.text;
      row.appendChild(b);
      if (m.from === 'her' && (!next || next.from !== 'her')) {
        var st = document.createElement('span');
        st.className = 'msg__status';
        st.textContent = 'Доставлено';
        row.appendChild(st);
      }
      box.insertBefore(row, spark);
    });
  }

  function applyChatHead() {
    var name = STATE.chatName || STATE.groom;
    var el = document.getElementById('chatName');
    if (el) el.textContent = name;
    var av = document.getElementById('chatAvatar');
    if (av) av.textContent = (name.replace(/^[^0-9A-Za-zА-Яа-яЁё]+/, '').charAt(0) || '♥').toUpperCase();
  }

  function stopChat(showAll) {
    CHAT.timers.forEach(clearTimeout);
    CHAT.timers = [];
    var phone = document.getElementById('phone');
    if (!phone) return;
    phone.querySelectorAll('.msg--typing').forEach(function (n) { n.remove(); });
    if (showAll && CHAT.started && !CHAT.done) { CHAT.done = true; phone.classList.remove('is-playing'); }
  }

  function later(fn, ms) { CHAT.timers.push(setTimeout(fn, ms)); }

  function playChat() {
    if (CHAT.started) return;
    CHAT.started = true;
    var phone = document.getElementById('phone');
    var box = document.getElementById('chatMsgs');
    if (!phone || !box) return;
    var msgs = [].slice.call(box.querySelectorAll('.msg'));
    phone.classList.add('is-playing');
    var i = 0;
    var next = function () {
      if (i >= msgs.length) { CHAT.done = true; phone.classList.remove('is-playing'); return; }
      var m = msgs[i++];
      if (m.classList.contains('msg--him')) {
        var t = document.createElement('div');
        t.className = 'msg msg--him msg--typing is-shown';
        t.innerHTML = '<p class="bubble" aria-hidden="true"><i></i><i></i><i></i></p>';
        box.insertBefore(t, m);
        later(function () {
          t.remove();
          m.classList.add('is-shown');
          later(next, 380);
        }, 650 + Math.min(900, m.textContent.length * 16));
      } else {
        later(function () {
          m.classList.add('is-shown');
          later(next, 420);
        }, 450);
      }
    };
    later(next, 300);
  }

  function initChat() {
    if (EDITING || REDUCED || !('IntersectionObserver' in window)) { CHAT.started = CHAT.done = true; return; }
    var phone = document.getElementById('phone');
    if (!phone) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        playChat();
      });
    }, { threshold: 0.3 });
    io.observe(phone);
  }

  /* ─── Программа: пункты + ягода на линии ──────────── */
  var TL = { prog: null, path: null, base: null, svg: null, berry: null, len: 0, y0: 0, y1: 0, u: 1 };
  var BERRY = { w: 70, h: 94 };   // ягода — в единицах макета

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
      row.className = 'prog__row' + (i % 2 ? ' is-alt' : '') + ' rv' + (shown ? ' in' : '');
      var icon = it.icon || ICONS[i % ICONS.length];
      var iconHtml = isImageIcon(icon)
        ? '<img class="prog__icon" src="' + escapeHtml(imageUrl(icon)) + '" alt="" loading="lazy" decoding="async">'
        : '<span class="prog__icon prog__icon--emoji" aria-hidden="true">' + escapeHtml(icon) + '</span>';
      row.innerHTML =
        '<div class="prog__icon-box">' + iconHtml + '</div>' +
        '<div class="prog__text"><p class="prog__time">' + escapeHtml(it.time || '') + '</p>' +
        '<p class="prog__title">' + escapeHtml(it.title || '') + '</p></div>';
      prog.appendChild(row);
      i++;
    });
    if (!shown) observeReveal(prog);
    prog.querySelectorAll('img.prog__icon').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', layoutTrack, { once: true });
    });
    layoutTrack();
  }

  // Линия вьётся между стикером и текстом: у пункта со стикером слева — x 580,
  // со стикером справа — x 786. Начало и конец — прямо вверх и вниз.
  // Точки — по offsetTop (строка при появлении сдвинута transform'ом)
  function layoutTrack() {
    var prog = TL.prog = document.getElementById('prog');
    var svg = TL.svg = document.getElementById('progSvg');
    var path = TL.path = document.getElementById('progPath');
    TL.base = document.getElementById('progBase');
    TL.berry = document.getElementById('progBerry');
    if (!prog || !svg || !path) return;
    var rows = [].slice.call(prog.querySelectorAll('.prog__row'));
    var W = prog.clientWidth, H = prog.offsetHeight;
    if (!rows.length || !W || !H) return;
    var u = TL.u = W / 1366;
    var centers = rows.map(function (r) { return r.offsetTop + r.offsetHeight / 2; });
    var xOf = function (r) { return (r.classList.contains('is-alt') ? 786 : 580) * u; };
    var pts = [[xOf(rows[0]), Math.max(20 * u, centers[0] - 170 * u)]];
    rows.forEach(function (r, k) { pts.push([xOf(r), centers[k]]); });
    pts.push([xOf(rows[rows.length - 1]), centers[centers.length - 1] + 170 * u]);

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
    if (TL.berry) {
      TL.berry.setAttribute('width', (BERRY.w * u).toFixed(1));
      TL.berry.setAttribute('height', (BERRY.h * u).toFixed(1));
    }
    prog.classList.add('is-ready');
    updateBerry();
  }

  // Как в других шаблонах: позиция — прямо за прокруткой, без переходов
  function updateBerry() {
    var prog = TL.prog, path = TL.path, berry = TL.berry;
    if (!prog || !path || !berry || !TL.len) return;
    var top = prog.getBoundingClientRect().top;
    var span = TL.y1 - TL.y0;
    var p = span > 0 ? (window.innerHeight * 0.55 - (top + TL.y0)) / span : 0;
    p = Math.max(0, Math.min(1, p));
    var pt;
    try { pt = path.getPointAtLength(p * TL.len); } catch (e) { return; }
    path.style.strokeDashoffset = (TL.len * (1 - p)).toFixed(1);
    berry.setAttribute('x', (pt.x - BERRY.w / 2 * TL.u).toFixed(1));
    berry.setAttribute('y', (pt.y - BERRY.h * 0.55 * TL.u).toFixed(1));
  }

  function initTrack() {
    window.addEventListener('scroll', updateBerry, { passive: true });
    window.addEventListener('resize', function () { layoutTrack(); fitNames(); fitDate(); }, { passive: true });
    window.addEventListener('load', function () { layoutTrack(); fitNames(); fitDate(); });
    if ('ResizeObserver' in window) {
      var prog = document.getElementById('prog');
      if (prog) new ResizeObserver(function () { layoutTrack(); }).observe(prog);
    }
  }

  /* ─── Дресс-код: платья в цветах палитры ──────────── */
  function cleanColors(colors) {
    return Array.isArray(colors) ? colors.filter(function (c) { return typeof c === 'string' && /^#[0-9a-f]{3,8}$|^rgb/i.test(c.trim()); }).slice(0, 9) : [];
  }

  function rebuildDresses(colors) {
    var list = cleanColors(colors);
    var box = document.querySelector('[data-edit="palette"]');
    if (!box || !list.length) return;
    var sig = list.join(',');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    var shown = box.classList.contains('in');
    box.innerHTML = '';
    list.forEach(function (c) {
      var sp = document.createElement('span');
      sp.className = 'dress__item';
      sp.style.setProperty('--c', c.trim());
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

  /* ─── Появление при прокрутке ────────────────────── */
  var io = null;
  var REVEAL = '.rv:not(.in), .rv-soft:not(.in), .rv-pop:not(.in), .rv-pop-one:not(.in)';

  function initReveal() {
    if (REDUCED || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.rv, .rv-soft, .rv-pop, .rv-pop-one').forEach(function (el) { el.classList.add('in'); });
      return;
    }
    io = new IntersectionObserver(function (entries) {
      // Что вошло в экран одновременно — проявляется лесенкой
      var i = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        if (!e.target.style.getPropertyValue('--d')) e.target.style.setProperty('--d', Math.min(i, 5) * 110 + 'ms');
        i++;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px 10% 0px' });
    observeReveal(document);
    // Стикеры коллажа прилепляются на глазах — без запаса
    var ioPop = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        ioPop.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
    document.querySelectorAll('.rv-pop-one').forEach(function (el) { io.unobserve(el); ioPop.observe(el); });
  }

  function observeReveal(scope) {
    (scope || document).querySelectorAll(REVEAL).forEach(function (el) {
      if (io) io.observe(el);
      else el.classList.add('in');
    });
  }

  /* ─── Обложка ─────────────────────────────────────────
     Ждём шрифты, рамку полароида и надпись (не дольше 1,5 с), потом полароид
     падает, стикеры прилепляются. В редакторе, без анимации в тарифе и
     при «меньше движения» — сразу финал (классы ставит скрипт в <head>). */
  function startHero() {
    fitNames();
    ROOT.classList.add('hero-go');
  }

  // Редактор: «▶ Посмотреть, как откроется» на обложке (../assets/intro-preview.js)
  function replayHero(done) {
    ROOT.classList.add('no-anim');
    ROOT.classList.remove('hero-go');
    void ROOT.offsetWidth;                       // в начальное положение без обратного хода
    ROOT.classList.remove('no-anim');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ROOT.classList.add('hero-go');
        setTimeout(done, 3000);
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
    // Фото пары не ждём: полароид падает, а снимок проявляется в нём, как в настоящем
    document.querySelectorAll('.pol__frame, .cover__title').forEach(function (img) {
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
    setTimeout(go, 1500);
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
    if (typeof d.chatName === 'string') STATE.chatName = d.chatName.trim();
    applyNames(d.groomName, d.brideName);
    applyDate(d.weddingDate, d.weddingTime);

    setRichText('greetingTitle', d.greetingTitle);
    setParagraphs('inviteText', d.inviteText);
    applyVenue(d);
    setRichText('mapButton', d.mapButton);
    setOptText('kidCaptionBride', d.kidCaptionBride);
    setOptText('kidCaptionGroom', d.kidCaptionGroom);
    fitCaptions();
    setOptText('storyTitle', d.storyTitle);
    setParagraphs('loveStory', d.loveStory);
    renderChat(d.chat);
    setRichText('countdownTitle', d.countdownTitle);
    setRichText('programTitle', d.programTitle);
    [1, 2, 3, 4].forEach(function (n) {
      setOptText('forecast' + n + 'Title', d['forecast' + n + 'Title']);
      setOptText('forecast' + n + 'Text', d['forecast' + n + 'Text']);
    });
    setOptText('dressText', d.dressText);
    setRichText('menuTitle', d.menuTitle);
    setParagraphs('menuText', d.menuText);
    setRichText('wishTitle', d.wishTitle);
    setParagraphs('story', d.story);
    setRichText('surveyTitle', d.surveyTitle);
    setOptText('surveyText', d.surveyText);

    setImg('coverPhoto', d.coverPhoto);
    setImg('venuePhoto', d.venuePhoto);
    setImg('kidPhotoBride', d.kidPhotoBride);
    setImg('kidPhotoGroom', d.kidPhotoGroom);
    setImg('chatPhoto', d.chatPhoto);
    if (window.WCPhotoFrame) window.WCPhotoFrame.apply(d.photoFrames);   // кадрирование фото в рамках

    rebuildDresses(d.dressCodeColors);
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
    renderChat(DEFAULT_CHAT);
    initChat();
    applySchedule(DEFAULT_SCHEDULE);   // базовое наполнение (сам по себе, без редактора)
    initTrack();
    bindFormOptions();
    initRsvp();
    applyDate();
    updateMapButton();
    applyData(dataFromUrl());
    initHero();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { fitNames(); fitDate(); layoutTrack(); });
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
