/* ============================================================
   SCRIPT.JS — свадебное приглашение «Бархат»
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
    date: '2027-05-01', time: '13:00',
    groom: 'Михаил', bride: 'Анастасия',
    signUser: false,        // подпись финала задала пара (иначе — имена)
    scheduleSig: '',
    paraSig: {}
  };

  var DEFAULT_SCHEDULE = [
    { time: '13:00', title: 'Сбор гостей' },
    { time: '13:30', title: 'Торжественная регистрация' },
    { time: '14:30', title: 'Начало банкета' },
    { time: '21:00', title: 'Окончание вечера' }
  ];

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

  // Сердечко «от руки» вокруг дня свадьбы
  var HEART =
    '<svg class="cal__heart" viewBox="0 0 150 140" aria-hidden="true">' +
    '<path d="M75,40 C66,10 22,4 14,36 C6,70 46,98 75,128 C104,98 144,70 136,36 C128,4 86,6 75,42 C71,54 69,30 80,20" ' +
    'fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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

  // Адрес картинки или мелодии из данных пары — та же проверка, что у остальных шаблонов
  function imageUrl(url) {
    if (typeof url !== 'string' || /[<>"\x00-\x20]/.test(url)) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^(https?:|blob:|data:image\/(png|jpeg|gif|webp);base64,)/i.test(url)) return '';
    if (!url) return '';
    if (/^https?:\/\//.test(url) || url.indexOf('data:') === 0 || url.indexOf('blob:') === 0) return url;
    if (url.indexOf('/invite/') === 0) return url;
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

  // Единица макета (1080 на ширину колонки) — от ширины раздела: на телефоне
  // это вся страница, на компьютере страница во всю ширину, а разделы — по центру
  function unit(el) {
    var box = (el && el.closest && el.closest('section')) || document.getElementById('invite') || document.body;
    return box.clientWidth / 1080;
  }

  /* ─── Имена: обложка, монограмма на печати, подпись финала ─── */
  function applyNames(groom, bride) {
    groom = typeof groom === 'string' ? groom.trim() : '';
    bride = typeof bride === 'string' ? bride.trim() : '';
    if (groom) STATE.groom = groom;
    if (bride) STATE.bride = bride;
    setAll('[data-name="groom"]', STATE.groom);
    setAll('[data-name="bride"]', STATE.bride);
    var mono = document.getElementById('monogram');
    if (mono) mono.textContent = (STATE.groom.charAt(0) + STATE.bride.charAt(0)).toUpperCase();
    if (!STATE.signUser) renderSign();
    document.title = STATE.groom + ' и ' + STATE.bride + ' — приглашение на свадьбу';
    fitNames();
  }

  // Подпись финала: имена лесенкой (как на обложке) или своя строка пары
  function renderSign(own) {
    var el = document.getElementById('finSign');
    if (!el) return;
    if (own) {
      el.textContent = own;
      el.classList.add('is-own');
      el.style.setProperty('--sfs', 100);
      return;
    }
    el.classList.remove('is-own');
    el.innerHTML = '<span class="fin__line fin__line--1" data-name="groom"></span>' +
      '<span class="fin__line fin__line--and">и</span>' +
      '<span class="fin__line fin__line--2" data-name="bride"></span>';
    el.querySelector('[data-name="groom"]').textContent = STATE.groom;
    el.querySelector('[data-name="bride"]').textContent = STATE.bride;
    el.style.removeProperty('--sfs');
    fitSign();
  }

  // Длинные имена уменьшаем: строка со своим сдвигом не должна уходить за край
  // колонки. rooms — ширина в единицах макета для 1-й и 3-й строки
  function fitLines(box, prop, base, rooms) {
    if (!box) return;
    var u = unit(box);
    if (!u) return;
    box.style.setProperty(prop, base);
    var k = 1;
    [['--1', rooms[0]], ['--2', rooms[1]]].forEach(function (r) {
      var line = box.querySelector('[class*="__line' + r[0] + '"]');
      if (!line) return;
      var w = line.scrollWidth / u;
      if (w > r[1]) k = Math.min(k, r[1] / w);
    });
    if (k < 1) box.style.setProperty(prop, (base * k).toFixed(1));
  }
  function fitNames() { fitLines(document.getElementById('heroNames'), '--nfs', 200, [880, 940]); fitSign(); }
  function fitSign() { if (!STATE.signUser) fitLines(document.getElementById('finSign'), '--sfs', 132, [880, 900]); }

  /* ─── Дата: неделя свадьбы в календаре, время сбора ── */
  function applyDate(dateStr, timeStr) {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) STATE.date = dateStr.slice(0, 10);
    if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}/.test(timeStr)) STATE.time = timeStr.slice(0, 5);
    var p = STATE.date.split('-').map(Number), y = p[0], m = p[1], d = p[2];
    if (!y || !m || !d) return;
    var day = new Date(y, m - 1, d);
    var dow = (day.getDay() + 6) % 7;            // понедельник = 0
    var grid = document.getElementById('calGrid');
    if (grid) {
      grid.querySelectorAll('.cal__d').forEach(function (n) { n.remove(); });
      for (var i = 0; i < 7; i++) {
        var dt = new Date(y, m - 1, d - dow + i);
        var cell = document.createElement('span');
        cell.className = 'cal__d' + (i === dow ? ' is-day' : '');
        cell.textContent = (dt.getDate() < 10 ? '0' : '') + dt.getDate();
        if (i === dow) cell.insertAdjacentHTML('beforeend', HEART);
        grid.appendChild(cell);
      }
    }
    var cal = document.getElementById('calendar');
    if (cal) cal.style.setProperty('--mx', Math.max(.22, Math.min(.78, (dow + .5) / 7)).toFixed(3));
    var el;
    if ((el = document.getElementById('calMonth'))) el.textContent = MONTHS_NOM[m - 1];
    if ((el = document.getElementById('calText'))) el.textContent = WEEKDAYS[day.getDay()] + ', ' + d + ' ' + MONTHS[m - 1] + ' ' + y + ' года';
    if ((el = document.getElementById('gatherTime'))) el.textContent = STATE.time.length === 4 ? '0' + STATE.time : STATE.time;
  }

  /* ─── Место и кнопка «Посмотреть на карте» ────────── */
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

  /* ─── Программа: время | точка на линии | событие ─── */
  function applySchedule(list) {
    if (!Array.isArray(list) || !list.length) return;
    var sig = JSON.stringify(list.map(function (it) { return it ? [it.time, it.title] : null; }));
    if (sig === STATE.scheduleSig) return;          // не перестраиваем то же самое
    STATE.scheduleSig = sig;

    var prog = document.getElementById('prog');
    if (!prog) return;
    // Пункты уже проявились — новые показываем сразу, без повторной анимации
    var shown = !!prog.querySelector('.prog__row.in');
    prog.querySelectorAll('.prog__row').forEach(function (n) { n.remove(); });
    list.forEach(function (it) {
      if (!it || (!it.time && !it.title)) return;
      var row = document.createElement('div');
      row.className = 'prog__row rv' + (shown ? ' in' : '');
      row.innerHTML =
        '<p class="prog__time">' + escapeHtml(it.time || '') + '</p>' +
        '<span class="prog__dot" aria-hidden="true"></span>' +
        '<p class="prog__title">' + escapeHtml(it.title || '') + '</p>';
      prog.appendChild(row);
    });
    if (!shown) observeReveal(prog);
    layoutLine();
  }

  // Линия — от точки первого пункта до точки последнего
  function layoutLine() {
    var prog = document.getElementById('prog');
    var line = document.getElementById('progLine');
    if (!prog || !line) return;
    var dots = prog.querySelectorAll('.prog__dot');
    if (dots.length < 2) { line.style.height = '0'; return; }
    var a = dots[0], b = dots[dots.length - 1];
    var top = a.parentNode.offsetTop + a.offsetTop + a.offsetHeight / 2;
    var bottom = b.parentNode.offsetTop + b.offsetTop + b.offsetHeight / 2;
    line.style.top = top.toFixed(1) + 'px';
    line.style.height = Math.max(0, bottom - top).toFixed(1) + 'px';
  }

  /* ─── Дресс-код: кружки цветов палитры ────────────── */
  function cleanColors(colors) {
    return Array.isArray(colors) ? colors.filter(function (c) { return typeof c === 'string' && /^#[0-9a-f]{3,8}$|^rgb/i.test(c.trim()); }).slice(0, 8) : [];
  }

  function rebuildSwatches(colors) {
    var list = cleanColors(colors);
    var box = document.querySelector('[data-edit="palette"]');
    if (!box || !list.length) return;
    var sig = list.join(',');
    if (box.dataset.sig === sig) return;
    box.dataset.sig = sig;
    var shown = !!box.querySelector('.swatch.in');
    box.innerHTML = '';
    list.forEach(function (c) {
      var sp = document.createElement('span');
      sp.className = 'swatch rv-soft' + (shown ? ' in' : '');
      sp.style.setProperty('--c', c.trim());
      box.appendChild(sp);
    });
    if (!shown) observeReveal(box);
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
  var REVEAL = '.rv:not(.in), .rv-soft:not(.in), .rv-write:not(.in)';

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
      document.querySelectorAll('.rv, .rv-soft, .rv-write').forEach(function (el) { el.classList.add('in', 'done'); });
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
  }

  function observeReveal(scope) {
    (scope || document).querySelectorAll(REVEAL).forEach(function (el) {
      if (io) io.observe(el);
      else el.classList.add('in', 'done');
    });
  }

  /* ─── Обложка ─────────────────────────────────────────
     Ждём шрифты и конверт (не дольше 2,5 с), потом заголовок и конверт
     проявляются, имена пишутся. В редакторе, без анимации в тарифе и при
     «меньше движения» — сразу финал (классы ставит скрипт в <head>). */
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
      if (EDITING && !REDUCED && window.WCIntroPreview && window.WCIntroPreview.on) {
        // Общий конверт вместо своей заставки (../assets/intro-choice.js): кнопку
        // ставит он, а после его показа обложка собирается заново (WCHero.replay)
        if (window.WCIntroChoice && window.WCIntroChoice.swapped) window.WCHero = { replay: replayHero };
        else window.WCIntroPreview.button(replayHero);
      }
      return;
    }
    // Конверт закрывает страницу — обложка собирается, когда он откроется
    if (window.WCEnvelope && window.WCEnvelope.active) {
      window.addEventListener('wc:envelope-open', initHero, { once: true });
      return;
    }
    var waits = [];
    if (document.fonts && document.fonts.ready) waits.push(document.fonts.ready);
    document.querySelectorAll('.cover__envelope').forEach(function (img) {
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

    setOptText('heroTitle', d.heroTitle);
    setOptText('heroSub', d.heroSub);
    setRichText('greetingTitle', d.greetingTitle);
    setParagraphs('inviteText', d.inviteText);
    setOptText('venueTitle', d.venueTitle);
    setOptText('addressLabel', d.addressLabel);
    setOptText('venueLabel', d.venueLabel);
    applyVenue(d);
    setRichText('mapButton', d.mapButton);
    setOptText('gatherLabel', d.gatherLabel);
    setRichText('programTitle', d.programTitle);
    setRichText('dressTitle', d.dressTitle);
    setOptText('dressText', d.dressText);
    setOptText('wishTitle', d.wishTitle);
    setParagraphs('story', d.story);
    setRichText('surveyTitle', d.surveyTitle);
    setOptText('surveyText', d.surveyText);
    setOptText('closingTitle', d.closingTitle);

    rebuildSwatches(d.dressCodeColors);
    applySchedule(d.schedule);
    rebuildDrinks(d.drinks);
    layoutLine();
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
    initReveal();
    applySchedule(DEFAULT_SCHEDULE);   // базовое наполнение (сам по себе, без редактора)
    bindFormOptions();
    initRsvp();
    applyDate();
    updateMapButton();
    applyData(dataFromUrl());
    initHero();
    window.addEventListener('resize', function () { fitNames(); layoutLine(); }, { passive: true });
    window.addEventListener('load', function () { fitNames(); layoutLine(); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { fitNames(); layoutLine(); });
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
