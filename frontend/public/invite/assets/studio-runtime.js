/* ============================================================
   STUDIO-RUNTIME.JS — общий рантайм шаблонов, собранных в «Верстаке».

   Один модуль на все такие шаблоны: у каждого свой script.js только
   передаёт сюда настройки. Подключается ПОСЛЕ music.js и ДО script.js.

   Что делает:
     • подставляет данные пары — из URL (страница гостя) и из
       postMessage('wc:data') (живое превью в кабинете);
     • разворачивает блоки, которые студия не рисует: программу дня,
       календарь, отсчёт, дресс-код, пожелания, анкету гостя;
     • включает появление секций при прокрутке;
     • отправляет анкету на POST {apiBase}/api/rsvp/{slug}.
   ============================================================ */
(function () {
  'use strict';
  if (window.WCStudio) return;

  var STATE = { apiBase: '', slug: '', date: '', time: '', guestToken: '', editing: false };
  var CONFIG = { defaults: {} };
  var DATA = {};

  var MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                   'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  var DOW_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

  /* ─── мелочи ───────────────────────────────────────────── */

  function pad(n) { return String(n).padStart(2, '0'); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /** Путь к картинке: из конструктора приходит и абсолютный, и относительный. */
  function imageUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//.test(url) || url.indexOf('data:') === 0) return url;
    if (url.indexOf('/invite/') === 0) return url;
    if (url.indexOf('assets/') === 0) return url;
    if (url.charAt(0) === '/') return (STATE.apiBase || '') + url;
    return url;
  }

  function each(selector, fn, root) {
    (root || document).querySelectorAll(selector).forEach(fn);
  }

  /* ─── подстановка значений ─────────────────────────────── */

  function setText(key, value) {
    if (value == null || value === '') return;
    each('[data-edit="' + key + '"]', function (el) {
      if (el.tagName === 'IMG') return;
      el.innerHTML = esc(value).replace(/\n/g, '<br>');
    });
  }

  function setImage(key, url) {
    if (!url) return;
    each('img[data-edit="' + key + '"]', function (el) { el.src = imageUrl(url); });
    // Перекрашенный вектор выводится маской, а не картинкой.
    each('div[data-edit="' + key + '"]', function (el) {
      el.style.backgroundImage = 'url("' + imageUrl(url) + '")';
    });
  }

  function applyNames(groom, bride) {
    groom = (groom || '').trim();
    bride = (bride || '').trim();
    if (bride) each('[data-name="bride"]', function (el) { el.textContent = bride; });
    if (groom) each('[data-name="groom"]', function (el) { el.textContent = groom; });
  }

  /** Ссылка на карту: у <a> ставим href, остальным — клик и пунктир. */
  function applyMapLink(link) {
    if (!link) return;
    each('[data-edit="venue"], [data-edit="venueAddress"]', function (el) {
      if (el.tagName === 'A') { el.href = link; el.target = '_blank'; return; }
      if (el.dataset.wcMapBound) return;
      el.dataset.wcMapBound = '1';
      el.style.cursor = 'pointer';
      el.style.textDecoration = 'underline dotted';
      el.addEventListener('click', function () { window.open(link, '_blank'); });
    });
  }

  /* ─── дата ─────────────────────────────────────────────── */

  function weddingMoment() {
    if (!STATE.date) return null;
    var d = String(STATE.date).split('-').map(Number);
    if (d.length < 3) return null;
    var t = String(STATE.time || '00:00').split(':').map(Number);
    return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0, 0);
  }

  function applyDate() {
    var when = weddingMoment();
    if (!when) return;
    var dd = pad(when.getDate()), mm = pad(when.getMonth() + 1), yy = when.getFullYear();
    each('[data-date]', function (el) {
      var f = el.getAttribute('data-date');
      if (f === 'day') el.textContent = dd;
      else if (f === 'month') el.textContent = MONTHS_RU[when.getMonth()];
      else if (f === 'year') el.textContent = String(yy);
      else if (f === 'time') el.textContent = STATE.time || '';
      else el.textContent = dd + ' | ' + mm + ' | ' + yy;
    });
  }

  /* ─── блоки ────────────────────────────────────────────── */

  function blockParams(el) {
    try { return JSON.parse(el.getAttribute('data-params') || '{}'); }
    catch (e) { return {}; }
  }

  function renderSchedule(el) {
    var items = DATA.schedule && DATA.schedule.length
      ? DATA.schedule
      : (CONFIG.defaults.schedule || []);
    var html = items.map(function (item) {
      var icon = item.icon ? (/^(\/|https?:|data:|assets\/)/.test(item.icon)
        ? '<img class="wcb-sch__icon" src="' + esc(imageUrl(item.icon)) + '" alt="" />'
        : '<span class="wcb-sch__emoji">' + esc(item.icon) + '</span>') : '';
      return '<li class="wcb-sch__row">' + icon +
        '<span class="wcb-sch__time">' + esc(item.time || '') + '</span>' +
        '<span class="wcb-sch__title">' + esc(item.title || '') + '</span>' +
        (item.desc ? '<span class="wcb-sch__desc">' + esc(item.desc) + '</span>' : '') +
        '</li>';
    }).join('');
    el.innerHTML = '<ol class="wcb-sch">' + html + '</ol>';
  }

  function renderCalendar(el) {
    var when = weddingMoment();
    if (!when) { el.innerHTML = ''; return; }
    var year = when.getFullYear(), month = when.getMonth(), day = when.getDate();
    var first = new Date(year, month, 1);
    // В России неделя начинается с понедельника.
    var shift = (first.getDay() + 6) % 7;
    var total = new Date(year, month + 1, 0).getDate();

    var cells = '';
    for (var i = 0; i < shift; i++) cells += '<span></span>';
    for (var d = 1; d <= total; d++) {
      cells += '<span class="wcb-cal__day' + (d === day ? ' is-day' : '') + '">' + d + '</span>';
    }
    el.innerHTML =
      '<div class="wcb-cal">' +
      '<div class="wcb-cal__head">' + MONTHS_RU[month] + ' ' + year + '</div>' +
      '<div class="wcb-cal__grid">' +
      DOW_RU.map(function (n) { return '<span class="wcb-cal__dow">' + n + '</span>'; }).join('') +
      cells + '</div></div>';
  }

  function renderCountdown(el) {
    el.innerHTML =
      '<div class="wcb-cd">' +
      ['days', 'hours', 'minutes', 'seconds'].map(function (unit) {
        return '<span class="wcb-cd__cell"><b data-cd="' + unit + '">0</b>' +
          '<i>' + { days: 'дней', hours: 'часов', minutes: 'минут', seconds: 'секунд' }[unit] +
          '</i></span>';
      }).join('') + '</div>';
  }

  function tickCountdown() {
    var when = weddingMoment();
    if (!when) return;
    var left = Math.max(0, when.getTime() - Date.now());
    var sec = Math.floor(left / 1000);
    var parts = {
      days: Math.floor(sec / 86400),
      hours: Math.floor((sec % 86400) / 3600),
      minutes: Math.floor((sec % 3600) / 60),
      seconds: sec % 60
    };
    each('[data-cd]', function (el) { el.textContent = parts[el.getAttribute('data-cd')]; });
  }

  function renderDresscode(el) {
    var colors = (DATA.dressCodeColors && DATA.dressCodeColors.length)
      ? DATA.dressCodeColors
      : (CONFIG.defaults.dressCodeColors || []);
    var photo = DATA.dressCodePhoto || CONFIG.defaults.dressCodePhoto || '';
    el.innerHTML =
      '<div class="wcb-dc">' +
      '<div class="wcb-dc__swatches">' +
      colors.map(function (c) {
        return '<span class="wcb-dc__swatch" style="background:' + esc(c) + '"></span>';
      }).join('') + '</div>' +
      (photo ? '<img class="wcb-dc__photo" src="' + esc(imageUrl(photo)) + '" alt="Образ" />' : '') +
      '</div>';
  }

  function renderWishes(el, params) {
    var key = params.key || 'story';
    var text = DATA[key] != null ? DATA[key] : (CONFIG.defaults[key] || '');
    el.innerHTML = '<p class="wcb-wishes" data-edit="' + esc(key) + '">' +
      esc(text).replace(/\n/g, '<br>') + '</p>';
  }

  function renderRsvp(el, params) {
    var drinks = (DATA.drinks && DATA.drinks.length)
      ? DATA.drinks
      : (CONFIG.defaults.drinks || []);
    el.innerHTML =
      '<form class="wcb-rsvp" novalidate>' +
      '<label class="wcb-rsvp__field"><span>Ваше имя</span>' +
      '<input name="guestName" type="text" autocomplete="name" required /></label>' +
      '<div class="wcb-rsvp__field"><span>Придёте?</span>' +
      '<label class="wcb-rsvp__radio"><input type="radio" name="attending" value="yes" checked /> Да, буду</label>' +
      '<label class="wcb-rsvp__radio"><input type="radio" name="attending" value="no" /> К сожалению, нет</label>' +
      '</div>' +
      (drinks.length
        ? '<div class="wcb-rsvp__field"><span>Что предпочитаете?</span>' +
          '<div class="wcb-rsvp__drinks">' + drinks.map(function (d) {
            return '<label class="wcb-rsvp__check"><input type="checkbox" name="drink" value="' +
              esc(d.value) + '" /> ' + esc(d.label) + '</label>';
          }).join('') + '</div></div>'
        : '') +
      '<button class="wcb-rsvp__submit" type="submit">' +
      esc(params.submitLabel || 'Отправить') + '</button>' +
      '<p class="wcb-rsvp__done" hidden>Спасибо! Ваш ответ записан.</p>' +
      '</form>';

    var form = el.querySelector('form');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var nameEl = form.querySelector('[name="guestName"]');
      var guestName = nameEl ? nameEl.value.trim() : '';
      if (!guestName) { nameEl && nameEl.focus(); return; }

      var attendEl = form.querySelector('[name="attending"]:checked');
      var attending = attendEl ? attendEl.value === 'yes' : true;
      var chosen = [];
      form.querySelectorAll('input[name="drink"]:checked').forEach(function (c) {
        chosen.push(c.value);
      });

      function done() {
        form.querySelector('.wcb-rsvp__done').hidden = false;
        form.querySelector('.wcb-rsvp__submit').disabled = true;
      }

      // Без слага это превью в кабинете — показываем «спасибо», но не пишем.
      if (!STATE.slug) { done(); return; }
      fetch((STATE.apiBase || '') + '/api/rsvp/' + STATE.slug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: guestName,
          attending: attending,
          drinkChoice: chosen.join(','),
          wishes: '',
          guestToken: STATE.guestToken || ''
        })
      }).then(done).catch(done);
    });
  }

  var RENDERERS = {
    schedule: renderSchedule,
    calendar: renderCalendar,
    countdown: renderCountdown,
    dresscode: renderDresscode,
    wishes: renderWishes,
    rsvp: renderRsvp
  };

  function renderBlocks() {
    each('[data-block]', function (el) {
      var kind = el.getAttribute('data-block');
      var render = RENDERERS[kind];
      if (render) render(el, blockParams(el));
    });
  }

  /* ─── появление при прокрутке ──────────────────────────── */

  function initReveal() {
    var nodes = document.querySelectorAll('.wc-up, .wc-soft');
    if (!nodes.length) return;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    nodes.forEach(function (el) { io.observe(el); });
  }

  /* ─── данные ───────────────────────────────────────────── */

  function applyData(d) {
    if (!d) return;
    DATA = Object.assign({}, DATA, d);

    if (d.apiBase != null) STATE.apiBase = d.apiBase;
    if (d.slug != null) STATE.slug = d.slug;
    if (d.weddingDate) STATE.date = d.weddingDate;
    if (d.weddingTime) STATE.time = d.weddingTime;

    applyNames(d.groomName, d.brideName);
    applyDate();

    Object.keys(d).forEach(function (key) {
      var value = d[key];
      if (typeof value === 'string') {
        setText(key, value);
        setImage(key, value);
      }
    });

    applyMapLink(d.mapLink);
    if (window.WCMusic && d.musicUrl !== undefined) WCMusic.set(imageUrl(d.musicUrl));

    renderBlocks();
    tickCountdown();
  }

  function dataFromUrl() {
    var p = new URLSearchParams(window.location.search);
    STATE.editing = p.get('editing') === '1';
    STATE.guestToken = p.get('g') || '';
    return {
      apiBase: p.get('apiBase') || '',
      slug: p.get('slug') || '',
      groomName: p.get('groom') || '',
      brideName: p.get('bride') || '',
      weddingDate: p.get('date') || '',
      weddingTime: p.get('time') || ''
    };
  }

  /* ─── старт ────────────────────────────────────────────── */

  function start(config) {
    CONFIG = Object.assign({ defaults: {} }, config || {});
    STATE.date = CONFIG.defaults.weddingDate || '';
    STATE.time = CONFIG.defaults.weddingTime || '';

    renderBlocks();
    initReveal();
    applyData(dataFromUrl());
    setInterval(tickCountdown, 1000);

    window.addEventListener('message', function (e) {
      var msg = e.data;
      if (msg && msg.type === 'wc:data' && msg.payload) applyData(msg.payload);
    });
    // Кабинет ждёт этот сигнал, чтобы прислать данные сразу после загрузки.
    try { window.parent.postMessage({ type: 'wc:ready' }, '*'); } catch (err) { /* не в iframe */ }
  }

  window.WCStudio = { start: start, applyData: applyData };
})();
