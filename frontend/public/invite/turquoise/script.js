/* ============================================================
   SCRIPT.JS — свадебное приглашение «Бирюза»
   Подстановка данных конструктора без изменения дизайна:
   URL-параметры (страница гостя) + postMessage('wc:data') (живое превью).
   Ключи данных == data-edit в index.html == id полей в constants.ts.
   ============================================================ */
(function () {
  'use strict';

  var ROOT = document.documentElement;
  var Q = new URLSearchParams(window.location.search);
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EDITING = Q.get('editing') === '1';
  // intro=0 — анимация открытия не входит в тариф: обложка сразу в финале, как в редакторе
  var NO_INTRO = Q.get('intro') === '0';

  var STATE = {
    apiBase: '', slug: '', guestToken: '', guestName: '',
    date: '2030-06-21', time: '12:30',
    groom: 'Евгений', bride: 'Диана',
    scheduleSig: '',
    looksSeen: false,       // данные дресс-кода уже приходили (дальше правки переключают вкладку)
    paraSig: {}
  };

  var ICONS = ['assets/ic-glasses.webp', 'assets/ic-rings.webp', 'assets/ic-cake.webp', 'assets/ic-disco.webp'];
  var DEFAULT_SCHEDULE = [
    { time: '15:00', title: 'Сбор гостей', icon: 'assets/ic-glasses.webp' },
    { time: '15:30', title: 'Церемония', icon: 'assets/ic-rings.webp' },
    { time: '17:00', title: 'Банкет и торт', icon: 'assets/ic-cake.webp' },
    { time: '20:00', title: 'Танцы', icon: 'assets/ic-disco.webp' }
  ];

  var MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

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

  // Пустая строка — пара удалила фото: возвращаем фото дизайна
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

  function unitOf(el) {
    return ((el || document.getElementById('invite') || document.body).clientWidth || 0) / 1366;
  }

  /* ─── Имена ───────────────────────────────────────── */
  function applyNames(groom, bride) {
    groom = typeof groom === 'string' ? groom.trim() : '';
    bride = typeof bride === 'string' ? bride.trim() : '';
    if (groom) STATE.groom = groom;
    if (bride) STATE.bride = bride;
    setAll('[data-name="groom"]', STATE.groom);
    setAll('[data-name="bride"]', STATE.bride);
    document.title = STATE.bride + ' и ' + STATE.groom + ' — приглашение на свадьбу';
    fitNames();
  }

  // Длинные имена уменьшаем: на обложке строка не шире 800 единиц (между
  // агатом и краем), в финале — не шире 1100
  function fitBox(box, prop, base, room, sel) {
    if (!box) return;
    var u = unitOf(box.closest('section'));
    if (!u) return;
    box.style.setProperty(prop, base);
    var k = 1;
    box.querySelectorAll(sel).forEach(function (line) {
      var w = line.scrollWidth / u;
      if (w > room) k = Math.min(k, room / w);
    });
    if (k < 1) box.style.setProperty(prop, (base * k).toFixed(1));
  }
  function fitNames() {
    fitBox(document.getElementById('heroNames'), '--nfs', 180, 800, '.cover__name');
    fitBox(document.getElementById('finNames'), '--nfs2', 90, 1100, '.fin__name');
  }

  /* ─── Дата и таймер ───────────────────────────────── */
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
    if ((el = document.getElementById('dateMonth'))) el.textContent = MONTHS[m - 1];
    if ((el = document.getElementById('dateDay'))) el.textContent = String(d);
    if ((el = document.getElementById('dateYear'))) el.textContent = String(y);
    if ((el = document.getElementById('dateTime'))) el.textContent = STATE.time.length === 4 ? '0' + STATE.time : STATE.time;
    restartCountdown();
  }

  var cdTimer = null;
  function restartCountdown() {
    if (cdTimer) clearInterval(cdTimer);
    var t = STATE.time.length === 4 ? '0' + STATE.time : STATE.time;
    var target = new Date(STATE.date + 'T' + t + ':00');
    if (isNaN(target.getTime())) target = new Date('2030-06-21T12:30:00');
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
      var n = document.querySelector('.place [data-edit="venue"]'), a = document.querySelector('.place [data-edit="venueAddress"]');
      VENUE.venue = n ? n.textContent.trim() : '';
      VENUE.address = a ? a.textContent.trim() : '';
    }
    var query = VENUE.address || VENUE.venue;
    var href = VENUE.link ? safeHref(VENUE.link) : (query ? 'https://yandex.ru/maps/?text=' + encodeURIComponent(query) : '#');
    btn.setAttribute('href', href);
    btn.hidden = href === '#';
  }

  /* Место/адрес становятся ссылкой, когда пара указала карту */
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

  /* ─── Программа: пункты, пунктир и камень на нём ──── */
  function applySchedule(list) {
    if (!Array.isArray(list) || !list.length) return;
    var sig = JSON.stringify(list.map(function (it) { return it ? [it.time, it.title, it.icon] : null; }));
    if (sig === STATE.scheduleSig) return;
    STATE.scheduleSig = sig;
    var prog = document.getElementById('prog');
    if (!prog) return;
    var shown = !!prog.querySelector('.prog__row.in');
    prog.querySelectorAll('.prog__row').forEach(function (n) { n.remove(); });
    var i = 0;
    list.forEach(function (it) {
      if (!it) return;
      var icon = it.icon || ICONS[i % ICONS.length];
      var iconHtml = isImageIcon(icon)
        ? '<img class="prog__icon" src="' + escapeHtml(imageUrl(icon)) + '" alt="" loading="lazy" decoding="async">'
        : '<span class="prog__icon prog__icon--emoji" aria-hidden="true">' + escapeHtml(icon) + '</span>';
      var text = '<div><p class="prog__time">' + escapeHtml(it.time || '') + '</p>' +
        '<p class="prog__title">' + escapeHtml(it.title || '') + '</p></div>';
      // чётные пункты — время слева, рисунок справа; нечётные — наоборот
      var left = i % 2 ? '<div class="prog__half prog__half--l prog__half--icon">' + iconHtml + '</div>' : '<div class="prog__half prog__half--l">' + text + '</div>';
      var right = i % 2 ? '<div class="prog__half prog__half--r">' + text + '</div>' : '<div class="prog__half prog__half--r prog__half--icon">' + iconHtml + '</div>';
      var row = document.createElement('div');
      row.className = 'prog__row rv' + (shown ? ' in' : '');
      row.innerHTML = left + right;
      prog.appendChild(row);
      i++;
    });
    if (!shown) observeReveal(prog);
    prog.querySelectorAll('img.prog__icon').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', layoutTrack, { once: true });
    });
    layoutTrack();
  }

  // Пунктир — плавная волна посередине (x 683, размах 50, шаг 760): текст и
  // рисунки отстоят от неё не меньше чем на 70; камень едет по ней за прокруткой
  var TRACK = { len: 0, y0: 0, y1: 0, u: 1 };
  function layoutTrack() {
    var prog = document.getElementById('prog');
    var svg = document.getElementById('progSvg');
    var path = document.getElementById('progPath');
    if (!prog || !svg || !path) return;
    var rows = prog.querySelectorAll('.prog__row');
    var W = prog.clientWidth, H = prog.offsetHeight;
    if (!rows.length || !W || !H) return;
    var u = W / 1366;
    var last = rows[rows.length - 1];
    // под последним пунктом пунктир идёт дальше, в нижний отступ раздела (svg — overflow: visible)
    var y0 = 40 * u, y1 = last.offsetTop + last.offsetHeight + 160 * u;
    var xAt = function (y) { return 683 * u + 50 * u * Math.sin(2 * Math.PI * (y - y0) / (760 * u)); };
    var pts = [];
    for (var y = y0; y < y1; y += 8 * u) pts.push([xAt(y), y]);
    pts.push([xAt(y1), y1]);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    path.setAttribute('d', 'M ' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' L '));
    TRACK.u = u;
    try { TRACK.len = path.getTotalLength(); } catch (e) { TRACK.len = 0; }
    TRACK.y0 = y0; TRACK.y1 = y1;
    var gem = document.getElementById('progGem');
    if (gem) { gem.setAttribute('width', (119 * u).toFixed(1)); gem.setAttribute('height', (153 * u).toFixed(1)); }
    updateGem();
  }

  function updateGem() {
    var prog = document.getElementById('prog');
    var path = document.getElementById('progPath');
    var gem = document.getElementById('progGem');
    if (!prog || !path || !gem || !TRACK.len) return;
    var top = prog.getBoundingClientRect().top;
    var span = TRACK.y1 - TRACK.y0;
    var p = span > 0 ? (window.innerHeight * 0.55 - (top + TRACK.y0)) / span : 0;
    p = Math.max(0, Math.min(1, p));
    var pt;
    try { pt = path.getPointAtLength(p * TRACK.len); } catch (e) { return; }
    gem.setAttribute('x', (pt.x - 59.5 * TRACK.u).toFixed(1));
    gem.setAttribute('y', (pt.y - 76.5 * TRACK.u).toFixed(1));
  }

  var scrollQueued = false;
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () { scrollQueued = false; updateGem(); });
  }

  /* ─── Дресс-код: цвета кружками ───────────────────── */
  function cleanColors(colors) {
    return Array.isArray(colors) ? colors.filter(function (c) { return typeof c === 'string' && /^#[0-9a-f]{3,8}$|^rgb/i.test(c.trim()); }).slice(0, 9) : [];
  }
  // key — data-edit блока (palette — платья, menColors — костюмы); true — цвета сменились
  function rebuildColors(key, colors) {
    var list = cleanColors(colors);
    var box = document.querySelector('[data-edit="' + key + '"]');
    if (!box || !list.length) return false;
    var sig = list.join(',');
    if (box.dataset.sig === sig) return false;
    box.dataset.sig = sig;
    var shown = box.classList.contains('in');
    box.innerHTML = '';
    list.forEach(function (c) {
      var sp = document.createElement('span');
      sp.style.setProperty('--c', c.trim());
      box.appendChild(sp);
    });
    if (shown) box.classList.add('in');
    return true;
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
      // открытая вкладка: кружки цветов появляются по очереди заново
      if (on && !was && replay && !REDUCED) {
        var dots = p.querySelector('.rv-pop.in');
        if (dots) { dots.classList.remove('in'); void dots.offsetWidth; dots.classList.add('in'); }
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

  /* ─── Анкета ──────────────────────────────────────── */
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
    function fail(msg) { if (errEl) errEl.textContent = msg; if (btn) btn.disabled = false; }
    function done() { form.hidden = true; if (thanks) thanks.hidden = false; }
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
  var REVEAL = '.rv:not(.in), .rv-soft:not(.in), .rv-pop:not(.in), .rv-line:not(.in)';
  function initReveal() {
    if (REDUCED || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.rv, .rv-soft, .rv-pop, .rv-line').forEach(function (el) { el.classList.add('in'); });
      return;
    }
    io = new IntersectionObserver(function (entries) {
      var i = 0;
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.style.setProperty('--d', Math.min(i++, 5) * 110 + 'ms');
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px 10% 0px' });
    observeReveal(document);
    // Вензели и золото свёрнуты clip-path до середины: Chrome считает
    // пересечение с учётом clip-path — для них порог 0 и без запаса
    var ioClip = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        ioClip.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px' });
    document.querySelectorAll('.rv-line').forEach(function (el) { io.unobserve(el); ioClip.observe(el); });
  }
  function observeReveal(scope) {
    (scope || document).querySelectorAll(REVEAL).forEach(function (el) {
      if (io) io.observe(el); else el.classList.add('in');
    });
  }

  /* ─── Обложка ─────────────────────────────────────────
     Ждём шрифты и агат (не дольше 2 с), потом агат наплывает слева,
     имена и дата проявляются. В редакторе, без анимации в тарифе и при
     «меньше движения» — сразу финал (классы ставит скрипт в <head>). */
  function startHero() { fitNames(); ROOT.classList.add('hero-go'); }

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
    var agate = document.querySelector('.cover__agate');
    if (agate && !(agate.complete && agate.naturalWidth)) {
      waits.push(agate.decode ? agate.decode().catch(function () {}) : new Promise(function (res) {
        agate.addEventListener('load', res, { once: true });
        agate.addEventListener('error', res, { once: true });
      }));
    }
    var started = false;
    var go = function () {
      if (started) return;
      started = true;
      requestAnimationFrame(function () { requestAnimationFrame(startHero); });
    };
    Promise.all(waits).then(go, go);
    setTimeout(go, 2000);
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

    setOptText('heroTitle', d.heroTitle);
    setOptText('heroText', d.heroText);
    setRichText('greetingTitle', d.greetingTitle);
    setParagraphs('inviteText', d.inviteText);
    setOptText('heartTitle', d.heartTitle);
    setRichText('coupleTitle', d.coupleTitle);
    setOptText('groomLabel', d.groomLabel);
    setOptText('brideLabel', d.brideLabel);
    setParagraphs('coupleText', d.coupleText);
    setRichText('menuTitle', d.menuTitle);
    setParagraphs('menuText', d.menuText);
    setRichText('detailsTitle', d.detailsTitle);
    setParagraphs('detailsText', d.detailsText);
    setRichText('programTitle', d.programTitle);
    setRichText('dressTitle', d.dressTitle);
    setOptText('dressText', d.dressText);
    setRichText('venueTitle', d.venueTitle);
    applyVenue(d);
    setRichText('mapButton', d.mapButton);
    setRichText('wishTitle', d.wishTitle);
    setParagraphs('story', d.story);
    setRichText('surveyTitle', d.surveyTitle);
    setOptText('surveyText', d.surveyText);
    setOptText('closingTitle', d.closingTitle);
    setRichText('countdownTitle', d.countdownTitle);

    setImg('coverPhoto', d.coverPhoto);
    setImg('groomPhoto', d.groomPhoto);
    setImg('bridePhoto', d.bridePhoto);
    // Дресс-код: в редакторе правку сразу видно — открываем её вкладку
    // (первые данные после загрузки вкладку не переключают)
    var looksReady = STATE.looksSeen, showTab = '';
    [['dressCodePhoto', 'women'], ['dressPhoto2', 'women'], ['dressPhoto3', 'women'], ['dressPhoto4', 'women'],
     ['dressMan1', 'men'], ['dressMan2', 'men'], ['dressMan3', 'men'], ['dressMan4', 'men']].forEach(function (k) {
      if (setImg(k[0], d[k[0]])) showTab = k[1];
      if (d[k[0]] != null) STATE.looksSeen = true;
    });
    if (window.WCPhotoFrame) window.WCPhotoFrame.apply(d.photoFrames);

    if (rebuildColors('palette', d.dressCodeColors)) showTab = 'women';
    if (rebuildColors('menColors', d.menColors)) showTab = 'men';
    if (d.dressCodeColors != null || d.menColors != null) STATE.looksSeen = true;
    if (EDITING && looksReady && showTab) showLooks(showTab);
    applySchedule(d.schedule);
    rebuildDrinks(d.drinks);
  }

  function dataFromUrl() {
    var d = {};
    if (Q.get('apiBase')) d.apiBase = Q.get('apiBase');
    if (Q.get('slug')) d.slug = Q.get('slug');
    if (Q.get('groom') != null) d.groomName = Q.get('groom');
    if (Q.get('bride') != null) d.brideName = Q.get('bride');
    if (Q.get('date')) d.weddingDate = Q.get('date');
    if (Q.get('time')) d.weddingTime = Q.get('time');
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
    applySchedule(DEFAULT_SCHEDULE);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { layoutTrack(); fitNames(); }, { passive: true });
    window.addEventListener('load', function () { layoutTrack(); fitNames(); });
    if ('ResizeObserver' in window) {
      var prog = document.getElementById('prog');
      if (prog) new ResizeObserver(function () { layoutTrack(); }).observe(prog);
    }
    bindFormOptions();
    initLooks();
    initRsvp();
    applyDate();
    updateMapButton();
    applyData(dataFromUrl());
    initHero();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitNames(); layoutTrack(); });
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'wc:ready' }, window.location.origin);
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
