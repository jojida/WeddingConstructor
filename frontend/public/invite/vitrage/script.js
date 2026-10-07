/* ============================================================
   SCRIPT.JS — свадебное приглашение «Витраж»
   Подстановка данных конструктора без изменения дизайна:
   URL-параметры (страница гостя) + postMessage('wc:data') (живое превью).
   Ключи данных == data-edit в index.html == id полей в constants.ts.
   ============================================================ */
(function () {
  'use strict';

  var ROOT = document.documentElement;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EDITING = new URLSearchParams(window.location.search).get('editing') === '1';

  // Дата по умолчанию — через 212 дней, как на таймере в макете
  function isoDate(t) {
    var d = new Date(t);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return String(n).padStart(2, '0'); }

  var STATE = {
    apiBase: '', slug: '', guestToken: '', guestName: '',
    date: isoDate(Date.now() + 212 * 86400000), time: '15:00',
    groom: 'Григорий', bride: 'Александра',
    looksSeen: false,       // данные дресс-кода уже приходили (дальше правки переключают вкладку)
    scheduleSig: '',
    storySig: '', inviteSig: '', menuSig: '', groomSig: '', brideSig: ''
  };

  var ICONS = ['assets/ic-plate.webp', 'assets/ic-bottle.webp', 'assets/ic-cake.webp'];

  var DEFAULT_SCHEDULE = [
    { time: '12:00', title: 'Церемония', icon: ICONS[0] },
    { time: '15:00', title: 'Банкет', icon: ICONS[1] },
    { time: '18:00', title: 'Торт', icon: ICONS[2] }
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

  /* ─── Имена на обложке ────────────────────────────── */
  function applyNames(groom, bride) {
    groom = typeof groom === 'string' ? groom.trim() : '';
    bride = typeof bride === 'string' ? bride.trim() : '';
    if (groom) STATE.groom = groom;
    if (bride) STATE.bride = bride;
    setAll('[data-name="groom"]', STATE.groom);
    setAll('[data-name="bride"]', STATE.bride);
    document.title = STATE.groom + ' и ' + STATE.bride + ' — приглашение на свадьбу';
    fitNames();
    layoutMono();
  }

  // Имена — внутри витражной арки (≈ 960 единиц): длинные ужимаем
  var NAME_FS = 155, NAME_ROOM = 960;
  function fitNames() {
    var hero = document.getElementById('hero');
    var box = document.getElementById('heroNames');
    if (!hero || !box) return;
    var u = hero.clientWidth / 1366;
    if (!u) return;
    box.style.setProperty('--nfs', NAME_FS);
    var w = 0;
    box.querySelectorAll('.cover__name').forEach(function (n) {
      var cs = getComputedStyle(n);
      w = Math.max(w, (n.offsetWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / u);
    });
    if (w > NAME_ROOM) box.style.setProperty('--nfs', (NAME_FS * NAME_ROOM / w).toFixed(1));
  }

  /* ─── Обращение: первое слово — рукописным, остальное — ниже ───
     «Дорогие гости» → «Дорогие» + «Гости»; по персональной ссылке —
     «Дорогие Иван и Мария» → «Дорогие» + «Иван и Мария»,
     «Семья Петровых» → «Дорогая» + «Семья Петровых». */
  var ADDRESS = /^(дорог|уважаем|мил|любим|родн)/i;
  function applyGreeting(text) {
    if (typeof text !== 'string' || !text.trim()) return;
    var t = text.trim().replace(/\s+/g, ' ');
    var cut = t.indexOf(' ');
    var first = cut < 0 ? t : t.slice(0, cut), rest = cut < 0 ? '' : t.slice(cut + 1);
    var word, line;
    if (ADDRESS.test(first) || !rest) { word = first; line = rest; }
    else if (/^семь/i.test(first)) { word = 'Дорогая'; line = t; }
    else { word = ''; line = t; }
    line = line.replace(/^[,!\s]+/, '');
    if (line) line = line.charAt(0).toUpperCase() + line.slice(1);
    var w = document.getElementById('greetWord'), n = document.getElementById('greetName');
    if (w) w.textContent = word;
    if (n) n.textContent = line;
  }

  /* ─── Дата на обложке и таймер ────────────────────── */
  function applyDate(dateStr, timeStr) {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) STATE.date = dateStr.slice(0, 10);
    if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}/.test(timeStr)) STATE.time = timeStr.slice(0, 5);
    var p = STATE.date.split('-').map(Number), y = p[0], m = p[1], d = p[2];
    if (!y || !m || !d) return;
    var dt = document.getElementById('dateText');
    var tm = document.getElementById('dateTime');
    if (dt) dt.textContent = d + ' ' + MONTHS[m - 1] + ' ' + y;
    if (tm) tm.textContent = STATE.time.length === 4 ? '0' + STATE.time : STATE.time;
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
    if (isNaN(target.getTime())) target = new Date(Date.now() + 212 * 86400000);
    var els = {
      d: document.getElementById('cdD'), h: document.getElementById('cdH'), m: document.getElementById('cdM'),
      dl: document.getElementById('cdDl'), hl: document.getElementById('cdHl'), ml: document.getElementById('cdMl')
    };
    function put(el, v) { if (el && el.textContent !== v) el.textContent = v; }
    function tick() {
      var left = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
      var D = Math.floor(left / 86400), H = Math.floor(left % 86400 / 3600), M = Math.floor(left % 3600 / 60);
      put(els.d, String(D)); put(els.h, String(H)); put(els.m, String(M));
      put(els.dl, plural(D, 'день', 'дня', 'дней'));
      put(els.hl, plural(H, 'час', 'часа', 'часов'));
      put(els.ml, plural(M, 'минута', 'минуты', 'минут'));
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
      var n = document.querySelector('[data-edit="venue"]'), a = document.querySelector('[data-edit="venueAddress"]');
      VENUE.venue = n ? n.textContent.trim() : '';
      VENUE.address = a ? a.textContent.trim() : '';
    }
    var query = VENUE.address || VENUE.venue;
    var href = VENUE.link ? safeHref(VENUE.link) : (query ? 'https://yandex.ru/maps/?text=' + encodeURIComponent(query) : '#');
    btn.setAttribute('href', href);
    btn.hidden = href === '#';
  }

  /* ─── Карта проезда: место/адрес — ссылкой, когда пара указала карту ─── */
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

  /* ─── Расписание: карусель ─────────────────────────
     Текущий пункт — крупно по центру, соседние — мельче и бледнее (как в
     макете). Касание соседнего пункта, свайп, стрелки и точки листают. */
  var SC = { items: [], dots: [], active: 0, swiped: false };

  function applySchedule(list) {
    if (!Array.isArray(list) || !list.length) return;
    var clean = list.filter(function (it) { return it && (it.time || it.title); });
    if (!clean.length) return;
    var sig = JSON.stringify(clean.map(function (it) { return [it.time, it.title, it.icon]; }));
    if (sig === STATE.scheduleSig) return;          // не перестраиваем то же самое
    var firstBuild = !STATE.scheduleSig;
    STATE.scheduleSig = sig;

    var track = document.getElementById('schedTrack');
    var dots = document.getElementById('schedDots');
    if (!track) return;
    track.innerHTML = '';
    SC.items = clean.map(function (it, i) {
      var el = document.createElement('div');
      el.className = 'sched__item';
      el.setAttribute('role', 'group');
      el.setAttribute('aria-roledescription', 'пункт программы');
      el.setAttribute('aria-label', (i + 1) + ' из ' + clean.length);
      var icon = it.icon || ICONS[i % ICONS.length];
      var iconHtml = isImageIcon(icon)
        ? '<img class="sched__icon" src="' + escapeHtml(imageUrl(icon)) + '" alt="" decoding="async" draggable="false">'
        : '<span class="sched__icon sched__icon--emoji" aria-hidden="true">' + escapeHtml(icon) + '</span>';
      el.innerHTML =
        '<div class="sched__icon-box">' + iconHtml + '</div>' +
        '<p class="sched__time">' + escapeHtml(it.time || '') + '</p>' +
        '<p class="sched__title">' + escapeHtml(it.title || '') + '</p>';
      // после свайпа браузер шлёт и click по пункту — его пропускаем
      el.addEventListener('click', function () { if (SC.swiped) { SC.swiped = false; return; } goSched(i); });
      track.appendChild(el);
      return el;
    });
    if (dots) {
      dots.innerHTML = '';
      SC.dots = clean.length > 1 ? clean.map(function (it, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'sched__dot';
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-label', (it.time ? it.time + ' — ' : '') + (it.title || 'пункт ' + (i + 1)));
        b.addEventListener('click', function () { goSched(i); });
        dots.appendChild(b);
        return b;
      }) : [];
    }
    // Как в макете: при трёх и больше пунктах в центре — второй
    if (firstBuild || SC.active >= clean.length) SC.active = clean.length >= 3 ? 1 : 0;
    renderSched();
  }

  function goSched(i) {
    if (!SC.items.length) return;
    SC.active = Math.max(0, Math.min(SC.items.length - 1, i));
    renderSched();
  }

  function renderSched() {
    SC.items.forEach(function (el, i) {
      var off = i - SC.active, far = Math.abs(off) > 1;
      el.style.setProperty('--off', String(Math.max(-2, Math.min(2, off))));
      el.classList.toggle('is-active', off === 0);
      el.classList.toggle('is-side', Math.abs(off) === 1);
      el.setAttribute('aria-hidden', off === 0 ? 'false' : 'true');
      el.style.visibility = far ? 'hidden' : '';
    });
    SC.dots.forEach(function (b, i) {
      var on = i === SC.active;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function initSched() {
    var box = document.getElementById('sched');
    if (!box) return;
    var sx = null, sy = 0;
    box.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; SC.swiped = false; });
    box.addEventListener('pointerup', function (e) {
      if (sx == null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        SC.swiped = true;
        setTimeout(function () { SC.swiped = false; }, 400);
        goSched(SC.active + (dx < 0 ? 1 : -1));
      }
    });
    box.addEventListener('pointercancel', function () { sx = null; });
    // мышью картинку не «перетаскиваем» — иначе браузер отменяет жест
    box.addEventListener('dragstart', function (e) { e.preventDefault(); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); goSched(SC.active + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goSched(SC.active - 1); }
    });
  }

  /* ─── Дресс-код: палитра и вкладки «Женщины / Мужчины» ─── */
  function cleanColors(colors) {
    return Array.isArray(colors) ? colors.filter(function (c) { return typeof c === 'string' && /^#[0-9a-f]{3,8}$|^rgb/i.test(c.trim()); }).slice(0, 9) : [];
  }

  function rebuildPalette(colors) {
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
      sp.style.setProperty('--c', c);
      box.appendChild(sp);
    });
    if (shown) box.classList.add('in');
    return true;
  }

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
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    observeReveal(document);
    // Гирлянда свёрнута clip-path до середины: Chrome считает пересечение
    // с учётом своего clip-path, видимая доля почти нулевая — для неё порог 0
    var ioClip = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        revealNow(e.target);
        ioClip.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.rv-line').forEach(function (el) { io.unobserve(el); ioClip.observe(el); });
  }

  function observeReveal(scope) {
    (scope || document).querySelectorAll(REVEAL).forEach(function (el) {
      if (io) io.observe(el);
      else el.classList.add('in', 'done');
    });
  }

  /* ─── Снег над витражом ──────────────────────────────
     Хлопья разного размера и скорости; пока обложка вне экрана — пауза */
  function initSnow() {
    var box = document.querySelector('.cover__snow');
    if (!box || REDUCED) return;
    var n = EDITING ? 14 : 28;
    for (var i = 0; i < n; i++) {
      var f = document.createElement('i');
      var s = 8 + Math.random() * 18;
      var t = 11 + Math.random() * 10;
      f.style.cssText = '--x:' + (Math.random() * 100).toFixed(1) + '%;--s:' + s.toFixed(1) +
        ';--t:' + t.toFixed(1) + 's;--d:-' + (Math.random() * t).toFixed(1) + 's;--dx:' + ((Math.random() - .5) * 160).toFixed(0) +
        ';--o:' + (0.55 + Math.random() * 0.4).toFixed(2) + (s > 22 ? ';filter:blur(1px)' : '');
      box.appendChild(f);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        box.classList.toggle('is-off', !en[0].isIntersecting);
      }).observe(document.getElementById('hero'));
    }
  }

  /* ─── Витражные двери ───────────────────────────────────
     Створки матового стекла в проёме арки раздвигаются САМИ после загрузки:
     двери — часть обложки, а не слой поверх сайта, поэтому листать страницу
     можно сразу. Касание створки — открыть не дожидаясь. Договор с обложкой
     как у конвертов: WCEnvelope.active, событие 'wc:envelope-open' (имена
     начинают писаться, когда створки разошлись). Раздел «Витражные двери»
     в редакторе выключает их: sections.js → WCEnvelope.setEnabled(false). */
  var DOORS = { el: null, phase: 'closed', timers: [] };   // closed → opening → open

  function doorsLater(fn, ms) { DOORS.timers.push(setTimeout(fn, ms)); }

  function fireOpen() {
    if (fireOpen.done) return;
    fireOpen.done = true;
    window.WCEnvelope.active = false;
    try { window.dispatchEvent(new Event('wc:envelope-open')); }
    catch (e) {
      var ev = document.createEvent('Event');
      ev.initEvent('wc:envelope-open', false, false);
      window.dispatchEvent(ev);
    }
  }

  function dropDoors() {
    DOORS.timers.forEach(clearTimeout);
    DOORS.phase = 'open';
    if (DOORS.el && DOORS.el.parentNode) DOORS.el.parentNode.removeChild(DOORS.el);
    DOORS.el = null;
    fireOpen();
  }

  function openDoors() {
    var el = DOORS.el;
    if (!el || DOORS.phase !== 'closed') return;
    DOORS.phase = 'opening';
    el.classList.add('is-open');
    doorsLater(fireOpen, 1500);                     // створки распахнулись примерно на треть
    doorsLater(function () {
      DOORS.phase = 'open';
      if (!EDITING) { dropDoors(); return; }
      el.classList.add('is-gone');
      el.classList.remove('is-open');
      var btn = el.querySelector('.doors__replay');
      if (btn) btn.disabled = false;
    }, 3500);
  }

  // Редактор: закрыть мгновенно, подождать и открыть, как увидит гость
  function replayDoors() {
    var el = DOORS.el;
    if (!el || DOORS.phase !== 'open') return;
    var btn = el.querySelector('.doors__replay');
    if (btn) btn.disabled = true;
    el.classList.remove('is-gone', 'is-open');      // створки сразу закрыты
    DOORS.phase = 'closed';
    doorsLater(openDoors, 900);
  }

  function initDoors() {
    var el = DOORS.el = document.getElementById('doors');
    window.WCEnvelope = {
      active: false,
      setEnabled: function (on) { if (!on && !EDITING && DOORS.el) dropDoors(); }
    };
    if (!el) return;
    layoutMono();
    if (EDITING) {
      // двери открыты: паре нужна обложка; «Посмотреть, как откроются» — по кнопке
      // и когда редактор показывает раздел дверей (подсветка wc-editor-flash)
      el.classList.add('is-gone');
      DOORS.phase = 'open';
      var btn = el.querySelector('.doors__replay');
      if (btn) { btn.hidden = false; btn.addEventListener('click', replayDoors); }
      if ('MutationObserver' in window) {
        new MutationObserver(function () {
          if (el.classList.contains('wc-editor-flash')) replayDoors();
        }).observe(el, { attributes: true, attributeFilter: ['class'] });
      }
      return;
    }
    if (REDUCED) { dropDoors(); return; }
    window.WCEnvelope.active = true;
    ROOT.classList.add('has-doors');
    el.querySelectorAll('.doors__leaf').forEach(function (lf) { lf.addEventListener('click', openDoors); });
    // Ждём створки, медальон и шрифт букв (не дольше 2,5 с), даём рассмотреть
    // закрытые двери — и они раздвигаются. Вкладка в фоне — ждём, пока её откроют;
    // обложка уже ушла с экрана (страницу вернули ниже) — двери не нужны
    var load = function (src) { return new Promise(function (res) { var i = new Image(); i.onload = i.onerror = res; i.src = src; }); };
    var waits = ['door-l.webp', 'door-r.webp', 'medallion.webp'].map(function (f) { return load('assets/' + f); });
    if (document.fonts && document.fonts.load) waits.push(document.fonts.load('100px "HamiltoneSHA"', monoLetters().join('')));
    var started = false;
    var go = function () {
      if (started || DOORS.phase !== 'closed' || !DOORS.el) return;
      if (document.visibilityState === 'hidden') {
        document.addEventListener('visibilitychange', go, { once: true });
        return;
      }
      started = true;
      var hero = document.getElementById('hero');
      if (hero && hero.getBoundingClientRect().bottom < 0) { dropDoors(); return; }
      doorsLater(openDoors, 700);
    };
    Promise.all(waits).then(go, go);
    setTimeout(go, 2500);
  }

  /* ─── Монограмма на медальоне: «буква & буква» ───────
     Раскладка по реальным контурам букв (canvas): у HamiltoneSHA заглавные
     с длинными росчерками — вся вязь вписывается в круг центра медальона.
     Координаты — в пикселях картинки медальона (viewBox 640). */
  var MONO = { cx: 320, cy: 320, r: 126, amp: .46 };
  var SCRIPT_FONT = '"HamiltoneSHA", cursive', AMP_FONT = 'Lora, Georgia, serif';

  function monoLetters() {
    var f = function (v) { return (v || '').trim().charAt(0).toUpperCase(); };
    return [f(STATE.groom) || 'Г', f(STATE.bride) || 'А'];
  }

  function layoutMono() {
    var svg = document.querySelector('.doors__mono');
    if (!svg) return;
    var t = svg.querySelectorAll('text');
    var L = monoLetters();
    t[0].textContent = L[0];
    t[2].textContent = L[1];
    var c = layoutMono.c || (layoutMono.c = document.createElement('canvas'));
    c.width = 640; c.height = 640;
    var ctx = c.getContext('2d');
    if (!ctx || typeof ctx.measureText('A').actualBoundingBoxAscent !== 'number') { svg.classList.add('is-set'); return; }
    var box = function (font, ch) {
      ctx.font = font;
      var m = ctx.measureText(ch);
      return { l: -m.actualBoundingBoxLeft / 100, r: m.actualBoundingBoxRight / 100, t: -m.actualBoundingBoxAscent / 100, b: m.actualBoundingBoxDescent / 100 };
    };
    var A = box('100px ' + SCRIPT_FONT, L[0]);
    var B = box('100px ' + SCRIPT_FONT, L[1]);
    var M = box('italic 400 ' + (100 * MONO.amp) + 'px ' + AMP_FONT, '&');
    // буква, «&» и буква подряд по контурам; «&» — по середине высоты заглавных
    var gap = -.06;                                   // буквы чуть заходят на «&»
    var mx = A.r + gap - M.l;
    var bx = mx + M.r + gap - B.l;
    var my = -.3 - (M.t + M.b) / 2;
    var x0 = Math.min(A.l, mx + M.l, bx + B.l), x1 = Math.max(A.r, mx + M.r, bx + B.r);
    var y0 = Math.min(A.t, my + M.t, B.t), y1 = Math.max(A.b, my + M.b, B.b);
    var f = Math.min(170, 2 * MONO.r / Math.max(x1 - x0, .01), 2 * MONO.r / Math.max(y1 - y0, .01));
    var ox = MONO.cx - f * (x0 + x1) / 2, oy = MONO.cy - f * (y0 + y1) / 2;
    // По пикселям: самая дальняя точка вязи от центра — не дальше радиуса
    ctx.clearRect(0, 0, 640, 640);
    ctx.font = f + 'px ' + SCRIPT_FONT; ctx.fillText(L[0], ox, oy); ctx.fillText(L[1], ox + f * bx, oy);
    ctx.font = 'italic 400 ' + (f * MONO.amp) + 'px ' + AMP_FONT; ctx.fillText('&', ox + f * mx, oy + f * my);
    var px = ctx.getImageData(0, 0, 640, 640).data, far = 0;
    for (var i = 3, n = 0; i < px.length; i += 4, n++) {
      if (px[i] < 96) continue;
      var dx = n % 640 - MONO.cx, dy = (n / 640 | 0) - MONO.cy, q = dx * dx + dy * dy;
      if (q > far) far = q;
    }
    far = Math.sqrt(far);
    if (far > MONO.r) {
      var k = MONO.r / far;
      f *= k; ox = MONO.cx + (ox - MONO.cx) * k; oy = MONO.cy + (oy - MONO.cy) * k;
    }
    var set = function (el, x, y, size) {
      el.setAttribute('x', x.toFixed(2)); el.setAttribute('y', y.toFixed(2)); el.setAttribute('font-size', size.toFixed(2));
    };
    set(t[0], ox, oy, f);
    set(t[1], ox + f * mx, oy + f * my, f * MONO.amp);
    set(t[2], ox + f * bx, oy, f);
    svg.classList.add('is-set');
  }

  /* ─── Обложка ─────────────────────────────────────────
     Ждём шрифты и витраж (не дольше 2,5 с), потом витраж проступает и имена
     пишутся. В редакторе и при «меньше движения» — сразу финал. */
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
    // Если у шаблона появится конверт (общие модули конвертов) — обложка ждёт его открытия
    if (window.WCEnvelope && window.WCEnvelope.active) {
      window.addEventListener('wc:envelope-open', heroWhenReady, { once: true });
      return;
    }
    heroWhenReady();
  }

  function heroWhenReady() {
    var waits = [];
    if (document.fonts && document.fonts.load) {
      waits.push(document.fonts.load('100px "HamiltoneSHA"', STATE.groom + STATE.bride));
      waits.push(document.fonts.ready);
    }
    var bg = new Image();
    waits.push(new Promise(function (res) { bg.onload = bg.onerror = res; bg.src = 'assets/cover.jpg'; }));
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

    applyNames(d.groomName, d.brideName);
    applyDate(d.weddingDate, d.weddingTime);

    ['heroTitle', 'heroText', 'venueTitle', 'hallTitle', 'menuTitle', 'programTitle', 'dressTitle', 'wishTitle',
     'surveyTitle', 'surveyText', 'closingTitle'].forEach(function (k) { setRichText(k, d[k]); });
    ['groomTitle', 'brideTitle', 'dressStyle', 'dressText', 'menu1Title', 'menu2Title', 'menu3Title', 'menu4Title']
      .forEach(function (k) { setOptText(k, d[k]); });
    applyGreeting(d.greetingTitle);
    if (typeof d.inviteText === 'string' && d.inviteText !== STATE.inviteSig && setParagraphs('inviteText', d.inviteText)) STATE.inviteSig = d.inviteText;
    if (typeof d.menuText === 'string' && d.menuText !== STATE.menuSig && setParagraphs('menuText', d.menuText)) STATE.menuSig = d.menuText;
    if (typeof d.groomText === 'string' && d.groomText !== STATE.groomSig && setParagraphs('groomText', d.groomText)) STATE.groomSig = d.groomText;
    if (typeof d.brideText === 'string' && d.brideText !== STATE.brideSig && setParagraphs('brideText', d.brideText)) STATE.brideSig = d.brideText;
    if (typeof d.story === 'string' && d.story !== STATE.storySig && setParagraphs('story', d.story)) STATE.storySig = d.story;
    applyVenue(d);

    ['hallPhoto', 'groomPhoto', 'bridePhoto', 'coverPhoto'].forEach(function (k) { setImg(k, d[k]); });
    // Дресс-код: в редакторе правку сразу видно — открываем её вкладку
    // (первые данные после загрузки вкладку не переключают)
    var looksReady = STATE.looksSeen, showTab = '';
    [['dressCodePhoto', 'women'], ['dressPhoto2', 'women'], ['dressMan1', 'men'], ['dressMan2', 'men']].forEach(function (k) {
      if (setImg(k[0], d[k[0]])) showTab = k[1];
      if (d[k[0]] != null) STATE.looksSeen = true;
    });
    if (EDITING && looksReady && showTab) showLooks(showTab);
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
    initDoors();
    document.querySelectorAll('img[data-edit]').forEach(function (img) {
      img.setAttribute('data-def', img.getAttribute('src') || '');
    });
    initLooks();
    initSched();
    initReveal();
    applySchedule(DEFAULT_SCHEDULE);   // базовое наполнение (сам по себе, без редактора)
    bindFormOptions();
    initRsvp();
    applyDate();
    updateMapButton();
    applyData(dataFromUrl());
    initSnow();
    initHero();
    window.addEventListener('resize', fitNames, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitNames(); layoutMono(); });
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', layoutMono);
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'wc:ready' }, window.location.origin);
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
