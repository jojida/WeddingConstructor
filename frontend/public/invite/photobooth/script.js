/* ============================================================
   SCRIPT.JS — свадебное приглашение «Фотобудка»
   Подстановка данных конструктора без изменения дизайна:
   URL-параметры (страница гостя) + postMessage('wc:data') (живое превью).
   Ключи данных == data-edit в index.html == id полей в constants.ts.
   Заставка: гость жмёт красную кнопку → вспышка → лента с фото и датой
   выезжает из камеры → открывается сайт. Платная: intro=0 — сразу сайт;
   в редакторе — слой на обложке по кнопке «▶ Посмотреть, как откроется».
   ============================================================ */
(function () {
  'use strict';

  var ROOT = document.documentElement;
  var Q = new URLSearchParams(window.location.search);
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EDITING = Q.get('editing') === '1';

  var STATE = {
    apiBase: '', slug: '', guestToken: '', guestName: '',
    date: '2027-06-12', time: '16:00',
    groom: 'Артём', bride: 'Вера',
    scheduleSig: '',
    paraSig: {}
  };

  var ICONS = ['assets/ic-clapper.webp', 'assets/ic-rings.webp', 'assets/ic-glasses.webp', 'assets/ic-mic.webp'];
  var DEFAULT_SCHEDULE = [
    { time: '16:00', title: 'Собираемся', icon: 'assets/ic-clapper.webp' },
    { time: '17:00', title: 'Говорим «Да»', icon: 'assets/ic-rings.webp' },
    { time: '18:00', title: 'Поднимаем бокалы', icon: 'assets/ic-glasses.webp' },
    { time: '20:00', title: 'Зажигаем танцпол', icon: 'assets/ic-mic.webp' }
  ];

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

  function unit() {
    return ((document.getElementById('invite') || document.body).clientWidth || 0) / 1366;
  }

  function later(list, fn, ms) { list.push(setTimeout(fn, ms)); }

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

  // Длинные имена уменьшаем: строка не шире 1240 единиц (обложка) / 1200 (финал)
  function fitLine(el, prop, base, room) {
    var u = unit();
    if (!el || !u) return;
    el.style.setProperty(prop, base);
    var w = el.scrollWidth / u;
    if (w > room) el.style.setProperty(prop, (base * room / w).toFixed(1));
  }
  function fitNames() {
    fitLine(document.getElementById('heroNames'), '--nfs', 69, 1240);
    fitLine(document.getElementById('finNames'), '--nfs2', 69, 1200);
  }

  /* ─── Обращение: «Дорогие» мелко, остальное крупно ─── */
  function applyGreeting(text) {
    if (typeof text !== 'string' || !text.trim()) return;
    var t = text.trim().replace(/\s+/g, ' ');
    var m = t.match(/^(Дорог\S*|Милы\S*|Мил\S*|Уважаем\S*|Любим\S*|Родн\S*)\s+(.+)$/i);
    var label = document.getElementById('greetLabel'), title = document.getElementById('greetTitle');
    if (label) label.textContent = m ? m[1] : '';
    if (title) title.textContent = m ? m[2] : t;
    fitGreeting();
  }

  // Длинное имя в обращении: самое длинное слово — не шире блока (758 единиц)
  function fitGreeting() {
    var title = document.getElementById('greetTitle');
    var u = unit();
    if (!title || !u) return;
    title.style.setProperty('--gfs', 150);
    var probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:0;top:0';
    title.appendChild(probe);
    var max = 0;
    title.firstChild && title.firstChild.nodeType === 3 && title.firstChild.nodeValue.split(/\s+/).forEach(function (w) {
      if (!w) return;
      probe.textContent = w;
      max = Math.max(max, probe.getBoundingClientRect().width);
    });
    title.removeChild(probe);
    var room = 758 * u;
    if (max > room) title.style.setProperty('--gfs', (150 * room / max).toFixed(1));
  }

  /* ─── Дата: обложка, билет, лента, таймер ─────────── */
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
    if ((el = document.getElementById('heroDate'))) el.textContent = pad(d) + '/' + pad(m) + '/' + y;
    if ((el = document.getElementById('stripDate'))) el.textContent = pad(d) + '.' + pad(m) + '.' + y;
    if ((el = document.getElementById('tDay'))) el.textContent = String(d);
    if ((el = document.getElementById('tMonth'))) el.textContent = MONTHS[m - 1];
    if ((el = document.getElementById('tYear'))) el.textContent = String(y);
    if ((el = document.getElementById('tWday'))) el.textContent = WEEKDAYS[new Date(y, m - 1, d).getDay()];
    restartCountdown();
  }

  var cdTimer = null;
  function restartCountdown() {
    if (cdTimer) clearInterval(cdTimer);
    var t = STATE.time.length === 4 ? '0' + STATE.time : STATE.time;
    var target = new Date(STATE.date + 'T' + t + ':00');
    if (isNaN(target.getTime())) target = new Date('2027-06-12T16:00:00');
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
      put(els.dl, plural(D, 'День', 'Дня', 'Дней'));
      put(els.hl, plural(H, 'Час', 'Часа', 'Часов'));
      put(els.ml, plural(M, 'Минута', 'Минуты', 'Минут'));
      put(els.sl, plural(S, 'Секунда', 'Секунды', 'Секунд'));
    }
    tick();
    cdTimer = setInterval(tick, 1000);
  }

  /* ─── Место и кнопка «Смотреть на карте» ──────────── */
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

  /* ─── Программа: пункты + пунктир с сердцем ───────── */
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
      var row = document.createElement('div');
      row.className = 'prog__row rv' + (shown ? ' in' : '');
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

  // Пунктир от сердца вниз, мягко вьётся между x 255 и 385 мимо пунктов
  function layoutTrack() {
    var prog = document.getElementById('prog');
    var svg = document.getElementById('progSvg');
    var path = document.getElementById('progPath');
    if (!prog || !svg || !path) return;
    var rows = [].slice.call(prog.querySelectorAll('.prog__row'));
    var W = prog.clientWidth, H = prog.offsetHeight;
    if (!rows.length || !W || !H) return;
    var u = W / 1366;
    // Ровная волна, как в макете: середина x 312, размах 70, шаг волны 700
    // (полволны — пункт программы); от сердца вниз до конца последнего пункта
    var last = rows[rows.length - 1];
    var y0 = 74 * u, y1 = Math.min(H - 4 * u, last.offsetTop + last.offsetHeight + 30 * u);
    var xAt = function (y) { return 312 * u + 70 * u * Math.sin(2 * Math.PI * (y - y0) / (700 * u)); };
    var pts = [];
    for (var y = y0; y < y1; y += 8 * u) pts.push([xAt(y), y]);
    pts.push([xAt(y1), y1]);
    var d = 'M ' + pts.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' L ');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    path.setAttribute('d', d);
    TRACK.u = u;
    try { TRACK.len = path.getTotalLength(); } catch (e) { TRACK.len = 0; }
    TRACK.y0 = pts[0][1];
    TRACK.y1 = pts[pts.length - 1][1];
    var heart = document.getElementById('progHeart');
    if (heart) { heart.setAttribute('width', (73 * u).toFixed(1)); heart.setAttribute('height', (66 * u).toFixed(1)); }
    updateHeart();
  }

  // Сердце — на пунктире, вслед за прокруткой (позиция атрибутом, без переходов)
  var TRACK = { len: 0, y0: 0, y1: 0, u: 1 };
  function updateHeart() {
    var prog = document.getElementById('prog');
    var path = document.getElementById('progPath');
    var heart = document.getElementById('progHeart');
    if (!prog || !path || !heart || !TRACK.len) return;
    var top = prog.getBoundingClientRect().top;
    var span = TRACK.y1 - TRACK.y0;
    var p = span > 0 ? (window.innerHeight * 0.55 - (top + TRACK.y0)) / span : 0;
    p = Math.max(0, Math.min(1, p));
    var pt;
    try { pt = path.getPointAtLength(p * TRACK.len); } catch (e) { return; }
    heart.setAttribute('x', (pt.x - 36.5 * TRACK.u).toFixed(1));
    heart.setAttribute('y', (pt.y - 33 * TRACK.u).toFixed(1));
  }

  // Пластинка крутится вслед за прокруткой
  var vinylEl = null;
  function updateVinyl() {
    if (!vinylEl || REDUCED) return;
    vinylEl.style.transform = 'rotate(' + ((window.pageYOffset || 0) * 0.32).toFixed(1) + 'deg)';
  }
  // Вешалки дресс-кода выезжают справа вслед за прокруткой: 0 — верх вешалок у
  // нижнего края экрана, 1 — поднялся на три четверти экрана. Каждая следующая
  // чуть позже; пока едет, низ отстаёт (наклон), на месте — ровно
  var rackItems = null;
  function updateRack() {
    var rack = document.getElementById('rack');
    if (!rack) return;
    if (!rackItems) rackItems = [].slice.call(rack.querySelectorAll('.rack__item'));
    var dress = rack.closest('.dress');
    if (REDUCED || (dress && dress.classList.contains('has-own'))) return;
    var vh = window.innerHeight || 1;
    var p = (vh - rack.getBoundingClientRect().top) / (vh * 0.75);
    var uu = rack.clientWidth / 1261;
    rackItems.forEach(function (item, i) {
      var q = Math.max(0, Math.min(1, (p - i * 0.12) / 0.55));
      var e = 1 - Math.pow(1 - q, 3);
      var x = (1 - e) * 1500 * uu;
      item.style.transform = x > 0.5 ? 'translateX(' + x.toFixed(1) + 'px)' : '';
      var img = item.firstElementChild;
      if (img) {
        // широкая связка качается меньше — верх ниток не отходит от рейки
        var amp = Math.min(8, 1600 / (parseFloat(item.style.getPropertyValue('--w')) || 200));
        var a = -amp * Math.sin(Math.PI * q) * (1 - 0.3 * q);
        img.style.transform = Math.abs(a) > 0.05 ? 'rotate(' + a.toFixed(2) + 'deg)' : '';
      }
    });
  }

  var scrollQueued = false;
  function onScroll() {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () { scrollQueued = false; updateHeart(); updateVinyl(); updateRack(); });
  }

  /* ─── Дресс-код: цвета кружками ───────────────────── */
  function cleanColors(colors) {
    return Array.isArray(colors) ? colors.filter(function (c) { return typeof c === 'string' && /^#[0-9a-f]{3,8}$|^rgb/i.test(c.trim()); }).slice(0, 9) : [];
  }
  function rebuildColors(colors) {
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
      sp.style.setProperty('--c', c.trim());
      box.appendChild(sp);
    });
    if (shown) box.classList.add('in');
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
  var REVEAL = '.rv:not(.in), .rv-soft:not(.in), .rv-pop:not(.in)';
  function initReveal() {
    if (REDUCED || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.rv, .rv-soft, .rv-pop').forEach(function (el) { el.classList.add('in'); });
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
  }
  function observeReveal(scope) {
    (scope || document).querySelectorAll(REVEAL).forEach(function (el) {
      if (io) io.observe(el); else el.classList.add('in');
    });
  }

  /* ─── Пластинка: нажатие включает и выключает музыку ── */
  function initVinyl() {
    var v = vinylEl = document.getElementById('vinyl');
    if (!v) return;
    updateVinyl();
    v.addEventListener('click', function () {
      var b = document.querySelector('.wc-music-btn');
      if (b) b.click();
    });
    v.style.cursor = 'pointer';
  }

  /* ─── ЗАСТАВКА «ФОТОБУДКА» ────────────────────────── */
  var INTRO = { el: null, state: 'idle', timers: [], previewDone: null };

  function startHero() { fitNames(); ROOT.classList.add('hero-go'); }

  function resetIntro() {
    INTRO.timers.forEach(clearTimeout);
    INTRO.timers = [];
    INTRO.state = 'idle';
    var el = INTRO.el;
    if (!el) return;
    el.classList.add('is-reset');
    el.classList.remove('is-press', 'is-flash', 'is-print', 'is-done', 'is-gone');
    void el.offsetWidth;
    el.classList.remove('is-reset');
  }

  // Странице вокруг (демо) — заставка на весь экран: она прячет свою нижнюю
  // панель, чтобы та не закрывала кнопку и ленту
  function notifyOverlay(open) {
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'wc:overlay', open: open }, window.location.origin);
    } catch (e) {}
  }

  // Вспышка и печать ленты; onPrinted — когда лента выехала целиком
  function shoot(onPrinted) {
    var el = INTRO.el;
    if (!el || INTRO.state !== 'idle') return;
    INTRO.state = 'printing';
    el.classList.add('is-press');
    later(INTRO.timers, function () { el.classList.remove('is-press'); el.classList.add('is-flash'); }, 140);
    later(INTRO.timers, function () { el.classList.add('is-print'); }, 420);
    later(INTRO.timers, function () { el.classList.add('is-done'); INTRO.state = 'printed'; if (onPrinted) onPrinted(); }, 420 + 3350);
  }

  // Гость: лента напечатана — пауза, заставка тает, открывается сайт
  function finishIntro(instant) {
    var el = INTRO.el;
    if (INTRO.state === 'gone') return;
    INTRO.timers.forEach(clearTimeout);
    INTRO.timers = [];
    INTRO.state = 'gone';
    ROOT.classList.remove('intro-lock');
    notifyOverlay(false);
    startHero();
    if (!el) { ROOT.classList.remove('intro-on'); return; }
    if (instant) { ROOT.classList.remove('intro-on'); return; }
    el.classList.add('is-gone');
    setTimeout(function () { ROOT.classList.remove('intro-on'); }, 950);
  }

  // Редактор: показ на обложке — кнопка «нажимается» сама
  function previewIntro(done) {
    var api = window.WCIntroPreview;
    resetIntro();
    if (api) api.show(true);
    later(INTRO.timers, function () {
      shoot(function () {
        later(INTRO.timers, function () {
          INTRO.el.classList.add('is-gone');
          later(INTRO.timers, function () {
            if (api) api.show(false);
            resetIntro();
            done();
          }, 950);
        }, 1300);
      });
    }, 800);
  }

  function initIntro() {
    var el = INTRO.el = document.getElementById('intro');
    if (!el) { startHero(); return; }
    if (EDITING) {
      var api = window.WCIntroPreview;
      if (api && api.on) { api.layer(el); api.button(previewIntro); }
      return;
    }
    if (!ROOT.classList.contains('intro-on')) { startHero(); return; }
    notifyOverlay(true);
    var btn = document.getElementById('introBtn');
    if (btn) btn.addEventListener('click', function () {
      shoot(function () { later(INTRO.timers, function () { finishIntro(false); }, 1300); });
    });
    var skip = document.getElementById('introSkip');
    if (skip) skip.addEventListener('click', function () { finishIntro(false); });
  }

  // sections.js: раздел «Фотобудка» выключен (или тариф без анимации) — сразу сайт
  window.WCEnvelope = {
    setEnabled: function (on) {
      if (on || EDITING) return;
      if (ROOT.classList.contains('intro-on') && INTRO.state !== 'gone') finishIntro(true);
    }
  };

  /* ─── Применение данных ───────────────────────────── */
  function applyData(d) {
    if (window.WCSections) WCSections.apply(d);
    if (!d) return;
    // Демо: панель страницы вокруг подписывается на сообщения позже, чем
    // стартует заставка, — напоминаем, пока заставка на экране
    if (!EDITING && ROOT.classList.contains('intro-on') && INTRO.state !== 'gone') notifyOverlay(true);
    if (typeof d.apiBase === 'string') STATE.apiBase = d.apiBase;
    if (typeof d.slug === 'string' && d.slug) STATE.slug = d.slug;
    if (typeof d.guestToken === 'string' && d.guestToken) STATE.guestToken = d.guestToken;
    if (typeof d.guestName === 'string' && d.guestName) {
      STATE.guestName = d.guestName;
      var gn = document.querySelector('#rsvpForm [name="guestName"]');
      if (gn && !gn.value) gn.value = d.guestName;
    }

    applyMapLink(d.mapLink);
    if (window.WCMap) window.WCMap.set({ address: d.venueAddress, venue: d.venue, mapLink: d.mapLink, point: d.mapPoint, show: d.enabledSections && typeof d.enabledSections.map === 'boolean' ? d.enabledSections.map : d.showMap !== false });
    if (window.WCMusic) window.WCMusic.set(imageUrl(d.musicUrl));

    applyNames(d.groomName, d.brideName);
    applyDate(d.weddingDate, d.weddingTime);

    setOptText('introLabel', d.introLabel);
    setOptText('introTitle', d.introTitle);
    setOptText('introHint', d.introHint);
    applyGreeting(d.greetingTitle);
    setParagraphs('inviteText', d.inviteText);
    setRichText('menuTitle', d.menuTitle);
    setParagraphs('menuText', d.menuText);
    setRichText('programTitle', d.programTitle);
    setOptText('programSubtitle', d.programSubtitle);
    setRichText('dressTitle', d.dressTitle);
    setOptText('dressText', d.dressText);
    setRichText('venueTitle', d.venueTitle);
    applyVenue(d);
    setRichText('mapButton', d.mapButton);
    setRichText('wishTitle', d.wishTitle);
    setOptText('wish1Title', d.wish1Title);
    setParagraphs('story', d.story);
    setOptText('wish2Title', d.wish2Title);
    setParagraphs('wish2Text', d.wish2Text);
    setOptText('wish3Title', d.wish3Title);
    setParagraphs('wish3Text', d.wish3Text);
    setRichText('surveyTitle', d.surveyTitle);
    setOptText('surveyText', d.surveyText);
    setRichText('closingTitle', d.closingTitle);
    setRichText('countdownTitle', d.countdownTitle);

    // Фото в сердце — чёрно-белое, как в макете (переключатель в редакторе)
    if (d.coverBw !== undefined) ROOT.classList.toggle('pb-bw', d.coverBw !== false);
    setImg('coverPhoto', d.coverPhoto);
    setImg('stripPhoto1', d.stripPhoto1);
    setImg('stripPhoto2', d.stripPhoto2);
    setImg('dressCodePhoto', d.dressCodePhoto);
    var clothes = document.querySelector('.dress__clothes'), dress = document.querySelector('.dress');
    if (clothes && dress) {
      var def = '';
      try { def = new URL(clothes.getAttribute('data-def') || '', window.location.href).href; } catch (e) {}
      dress.classList.toggle('has-own', !!clothes.src && clothes.src !== def);
      updateRack();
    }
    setImg('closingPhoto', d.closingPhoto);
    stillDance();
    if (window.WCPhotoFrame) window.WCPhotoFrame.apply(d.photoFrames);

    rebuildColors(d.dressCodeColors);
    applySchedule(d.schedule);
    rebuildDrinks(d.drinks);
  }

  // «Меньше движения»: вместо танца — неподвижная пара
  function stillDance() {
    if (!REDUCED) return;
    var img = document.querySelector('img[data-edit="closingPhoto"]');
    if (img && /assets\/dance\.svg$/.test(img.getAttribute('src') || '')) img.setAttribute('src', 'assets/dance-still.svg');
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
    ROOT.classList.add('pb-bw');
    document.querySelectorAll('img[data-edit]').forEach(function (img) {
      img.setAttribute('data-def', img.getAttribute('src') || '');
    });
    initReveal();
    applySchedule(DEFAULT_SCHEDULE);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { layoutTrack(); fitNames(); fitGreeting(); updateRack(); }, { passive: true });
    window.addEventListener('load', function () { layoutTrack(); fitNames(); fitGreeting(); updateRack(); });
    if ('ResizeObserver' in window) {
      var prog = document.getElementById('prog');
      if (prog) new ResizeObserver(function () { layoutTrack(); }).observe(prog);
    }
    bindFormOptions();
    initRsvp();
    initVinyl();
    updateRack();
    applyDate();
    updateMapButton();
    applyData(dataFromUrl());
    initIntro();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitNames(); fitGreeting(); layoutTrack(); });
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'wc:ready' }, window.location.origin);
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
