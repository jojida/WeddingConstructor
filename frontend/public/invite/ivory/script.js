/* ============================================================
   SCRIPT.JS — свадебное приглашение «Айвори»
   Подстановка данных конструктора без изменения дизайна:
   URL-параметры (страница гостя) + postMessage('wc:data') (живое превью).
   Ключи данных == data-edit в index.html == id полей в constants.ts.
   ============================================================ */
(function () {
  'use strict';

  var ROOT = document.documentElement;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var STATE = {
    apiBase: '', slug: '', guestToken: '', guestName: '',
    date: '2027-06-12', time: '16:00',
    groom: 'Марк', bride: 'Алиса',
    signUser: false,        // подпись финала задала пара (иначе — из имён)
    scheduleSig: ''
  };

  var MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

  var DEFAULT_SCHEDULE = [
    { time: '15:00', title: 'Сбор гостей', desc: 'Встречаемся, наслаждаемся фуршетом, настраиваемся на весёлую свадьбу' },
    { time: '16:00', title: 'Церемония', desc: 'Немного радостных, трогательных формальностей' },
    { time: '17:00', title: 'Банкет', desc: 'Время вкусной еды, музыки, приятных пожеланий и танцев' }
  ];

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

  // Пустая строка — пара удалила фото: возвращаем фото дизайна
  function setImg(key, url) {
    if (url == null) return;
    document.querySelectorAll('img[data-edit="' + key + '"]').forEach(function (el) {
      var next = url === '' ? el.getAttribute('data-def') : imageUrl(url);
      if (next && el.getAttribute('src') !== next) el.src = next;
    });
  }

  /* ─── Имена: обложка, конверт, подпись, монограмма ── */
  function autoSign() { return 'Ваши ' + STATE.groom + ' и ' + STATE.bride; }

  function applyNames(groom, bride) {
    groom = typeof groom === 'string' ? groom.trim() : '';
    bride = typeof bride === 'string' ? bride.trim() : '';
    if (groom) STATE.groom = groom;
    if (bride) STATE.bride = bride;
    setAll('[data-name="groom"], [data-env-name="groom"]', STATE.groom);
    setAll('[data-name="bride"], [data-env-name="bride"]', STATE.bride);
    setAll('[data-mono="groom"]', STATE.groom.charAt(0).toUpperCase());
    setAll('[data-mono="bride"]', STATE.bride.charAt(0).toUpperCase());
    if (!STATE.signUser) setAll('[data-edit="closingSign"]', autoSign());
    document.title = STATE.groom + ' & ' + STATE.bride + ' — приглашение на свадьбу';
    fitNames();
  }

  /* Длинные имена не должны уходить за край обложки: сперва сдвигаем
     влево, если не хватает и этого — уменьшаем шрифт. */
  function fitNames() {
    var hero = document.getElementById('hero');
    if (!hero) return;
    var W = hero.clientWidth;
    if (!W) return;
    var u = W / 411, edge = 14 * u;
    [['groom', 41], ['bride', 199]].forEach(function (pair) {
      var el = hero.querySelector('.hero__name--' + pair[0]);
      if (!el) return;
      el.style.fontSize = '';
      el.style.left = '';
      var padX = parseFloat(window.getComputedStyle(el).paddingLeft) || 0;
      var textW = el.offsetWidth - 2 * padX;
      var maxW = W - 2 * edge;
      if (textW > maxW) {
        el.style.fontSize = (64 * u * maxW / textW).toFixed(2) + 'px';
        textW = maxW;
      }
      var left = pair[1] * u;
      if (left + textW > W - edge) left = Math.max(edge, W - edge - textW);
      el.style.left = left.toFixed(2) + 'px';
    });
  }

  /* ─── Дата: обложка, календарь, таймер ───────────── */
  function applyDate(dateStr, timeStr) {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) STATE.date = dateStr.slice(0, 10);
    if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}/.test(timeStr)) STATE.time = timeStr.slice(0, 5);
    var p = STATE.date.split('-').map(Number), y = p[0], m = p[1], d = p[2];
    if (!y || !m || !d) return;

    setAll('[data-date="day"]', String(d));
    setAll('[data-date="month"]', MONTHS_GEN[m - 1]);
    setAll('[data-date="year"]', String(y));

    var month = document.querySelector('[data-cal="month"]');
    if (month) month.textContent = MONTHS[m - 1];
    [-2, -1, 0, 1, 2].forEach(function (off) {
      var el = document.querySelector('[data-cal="d' + off + '"]');
      if (el) el.textContent = String(new Date(y, m - 1, d + off).getDate());
    });

    var cdDate = document.querySelector('[data-cd="date"]');
    if (cdDate) cdDate.textContent = d + ' ' + MONTHS_GEN[m - 1] + ' ' + y + ' · ' + STATE.time;
    restartCountdown();
  }

  function plural(n, forms) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return forms[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
    return forms[2];
  }

  var cdTimer = null;
  function restartCountdown() {
    if (cdTimer) clearInterval(cdTimer);
    var t = STATE.time.length === 4 ? '0' + STATE.time : STATE.time;
    var target = new Date(STATE.date + 'T' + t + ':00');
    if (isNaN(target.getTime())) target = new Date('2027-06-12T16:00:00');
    function put(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
    function tick() {
      var diff = Math.max(0, target.getTime() - Date.now());
      var days = Math.floor(diff / 86400000);
      var hours = Math.floor(diff % 86400000 / 3600000);
      var mins = Math.floor(diff % 3600000 / 60000);
      var secs = Math.floor(diff % 60000 / 1000);
      put('cd-days', String(days));
      put('cd-hours', pad(hours));
      put('cd-mins', pad(mins));
      put('cd-secs', pad(secs));
      put('cd-days-l', plural(days, ['день', 'дня', 'дней']));
      put('cd-hours-l', plural(hours, ['час', 'часа', 'часов']));
      put('cd-mins-l', plural(mins, ['минута', 'минуты', 'минут']));
      put('cd-secs-l', plural(secs, ['секунда', 'секунды', 'секунд']));
    }
    tick();
    cdTimer = setInterval(tick, 1000);
  }

  /* ─── Место: название в кавычках макета ─────────────
     Пара пишет «Белая роща» или "Белая роща" — снимаем только внешнюю пару;
     если кавычки есть внутри (Ресторан «Прага») — выводим как есть,
     без вторых кавычек */
  function applyVenue(v) {
    if (typeof v !== 'string' || !v.trim()) return;
    var t = v.trim();
    var OPEN = '«"“„\'‘', CLOSE = '»"”“\'’';
    if (t.length > 1 && OPEN.indexOf(t.charAt(0)) >= 0 && CLOSE.indexOf(t.charAt(t.length - 1)) >= 0) {
      t = t.slice(1, -1).trim();
    }
    if (!t) return;
    setAll('[data-edit="venue"]', /[«»"“”„]/.test(t) ? t : '“' + t + '”');
  }

  /* ─── Программа дня: пункты + трек с сердцем ──────── */
  var TL = { prog: null, dots: [], dotY: [], y0: 0, y1: 0 };

  function applySchedule(list) {
    if (!Array.isArray(list) || !list.length) return;
    var sig = JSON.stringify(list.map(function (it) { return it ? [it.time, it.title, it.desc] : null; }));
    if (sig === STATE.scheduleSig) return;          // не перестраиваем то же самое
    STATE.scheduleSig = sig;

    var prog = document.getElementById('prog');
    if (!prog) return;
    // Пункты уже проявились — новые показываем сразу, без повторной анимации
    var shown = !!prog.querySelector('.prog__item.in');
    prog.querySelectorAll('.prog__item').forEach(function (n) { n.remove(); });
    list.forEach(function (it) {
      if (!it) return;
      var item = document.createElement('div');
      item.className = 'prog__item rv' + (shown ? ' in' : '');
      var desc = typeof it.desc === 'string' && it.desc.trim()
        ? '<p class="prog__desc">' + escapeHtml(it.desc.trim()).replace(/\n/g, '<br>') + '</p>' : '';
      item.innerHTML =
        '<time class="prog__time">' + escapeHtml(it.time || '') + '</time>' +
        '<span class="prog__dot"></span>' +
        '<div class="prog__body"><h3 class="prog__title">' + escapeHtml(it.title || '') + '</h3>' + desc + '</div>';
      prog.appendChild(item);
    });
    if (!shown) observeReveal(prog);
    layoutTrack();
  }

  // Точки ищем по layout-координатам (offsetTop): пункт при появлении
  // сдвинут transform'ом, getBoundingClientRect дал бы неверную высоту
  function layoutTrack() {
    var prog = TL.prog = document.getElementById('prog');
    if (!prog) return;
    TL.dots = [].slice.call(prog.querySelectorAll('.prog__dot'));
    if (!TL.dots.length || !prog.offsetHeight) return;
    TL.dotY = TL.dots.map(function (dot) {
      return dot.parentNode.offsetTop + dot.offsetTop + dot.offsetHeight / 2;
    });
    TL.y0 = TL.dotY[0];
    TL.y1 = TL.dotY[TL.dotY.length - 1];
    prog.style.setProperty('--y0', TL.y0 + 'px');
    prog.style.setProperty('--len', Math.max(0, TL.y1 - TL.y0) + 'px');
    prog.classList.add('is-ready');
    updateHeart();
  }

  function updateHeart() {
    var prog = TL.prog;
    if (!prog || !TL.dots.length) return;
    var top = prog.getBoundingClientRect().top;
    var len = TL.y1 - TL.y0;
    // Сердце держится чуть ниже середины экрана и едет по треку вместе с прокруткой
    var p = len > 0 ? (window.innerHeight * 0.56 - (top + TL.y0)) / len : 1;
    p = Math.max(0, Math.min(1, p));
    var y = TL.y0 + p * len;
    prog.style.setProperty('--hy', y.toFixed(1) + 'px');
    prog.style.setProperty('--fill', (y - TL.y0).toFixed(1) + 'px');
    TL.dots.forEach(function (dot, i) { dot.classList.toggle('is-on', TL.dotY[i] <= y + 0.5); });
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

  /* ─── Палитра дресс-кода ──────────────────────────── */
  function rebuildPalette(colors) {
    if (!Array.isArray(colors) || !colors.length) return;
    var box = document.querySelector('[data-edit="palette"]');
    if (!box) return;
    box.innerHTML = '';
    colors.forEach(function (c) {
      if (typeof c !== 'string' || !c) return;
      var sp = document.createElement('span');
      sp.style.setProperty('--c', c);
      box.appendChild(sp);
    });
  }

  /* ─── Пожелания: абзацы из текста ─────────────────── */
  function rebuildStory(story) {
    if (typeof story !== 'string' || !story.trim()) return;
    var box = document.querySelector('[data-edit="story"]');
    if (!box) return;
    box.innerHTML = '';
    story.split(/\n+/).forEach(function (line) {
      if (!line.trim()) return;
      var p = document.createElement('p');
      p.textContent = line.trim();
      box.appendChild(p);
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

  function revealNow(el) {
    el.classList.add('in');
    if (el.classList.contains('rv-write')) {
      var fin = function () { el.classList.add('done'); };
      el.addEventListener('animationend', fin, { once: true });
      setTimeout(fin, 2800);   // запасной путь: вкладка была в фоне и анимация не шла
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
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    observeReveal(document);
  }

  function observeReveal(scope) {
    (scope || document).querySelectorAll('.rv:not(.in), .rv-soft:not(.in), .rv-write:not(.in)').forEach(function (el) {
      if (io) io.observe(el);
      else el.classList.add('in', 'done');
    });
  }

  /* ─── Обложка появляется после конверта (в редакторе — сразу) ── */
  function startHero() {
    fitNames();
    ROOT.classList.add('hero-go');
  }

  function initHero() {
    if (window.WCEnvelope && window.WCEnvelope.active) {
      window.addEventListener('wc:envelope-open', startHero);
      return;
    }
    // Без конверта ждём шрифты (не дольше секунды), чтобы имена не мигнули запасным
    var started = false;
    var go = function () { if (!started) { started = true; startHero(); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
    setTimeout(go, 1000);
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

    setRichText('heroTitle', d.heroTitle);
    setRichText('greetingTitle', d.greetingTitle);
    setRichText('inviteText', d.inviteText);
    setRichText('venueLabel', d.venueLabel);
    applyVenue(d.venue);
    if (typeof d.venueAddress === 'string') setAll('[data-edit="venueAddress"]', d.venueAddress.trim());
    setRichText('dressText', d.dressText);
    setRichText('surveyText', d.surveyText);
    setRichText('closingTitle', d.closingTitle);

    setImg('coverPhoto', d.coverPhoto);
    setImg('venuePhoto', d.venuePhoto);
    setImg('dressCodePhoto', d.dressCodePhoto);
    setImg('dressPhoto2', d.dressPhoto2);
    setImg('dressMan1', d.dressMan1);
    setImg('dressMan2', d.dressMan2);
    setImg('finalPhoto', d.finalPhoto);
    if (window.WCPhotoFrame) window.WCPhotoFrame.apply(d.photoFrames);   // кадрирование фото в рамках

    rebuildPalette(d.dressCodeColors);
    rebuildStory(d.story);
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
