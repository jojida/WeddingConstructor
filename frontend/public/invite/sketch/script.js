/* ============================================
   SCRIPT.JS — Свадебное приглашение «Скетч»
   Подстановка данных из конструктора без изменения дизайна.
   Данные приходят: 1) через URL-параметры (страница гостя, SSR);
                    2) через postMessage('wc:data') из редактора (живое превью).
   Меняются только текст, фото и цвета — вёрстка/декор не трогаются.
   ============================================ */
(function () {
  'use strict';

  var MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

  var STATE = { apiBase: '', slug: '' };

  function pad(n) { return String(n).padStart(2, '0'); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function imageUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//.test(url) || url.indexOf('data:') === 0) return url;
    if (url.indexOf('/invite/') === 0) return url;        // ассеты фронта (этот origin)
    if (url.charAt(0) === '/') return (STATE.apiBase || '') + url; // загрузки бэка
    return url;
  }

  // Текст с сохранением переносов строк (\n → <br>)
  function setRichText(key, value) {
    if (value == null || value === '') return;
    document.querySelectorAll('[data-edit="' + key + '"]').forEach(function (el) {
      el.innerHTML = escapeHtml(value).replace(/\n/g, '<br>');
    });
  }

  function setImg(key, url) {
    if (!url) return;
    document.querySelectorAll('img[data-edit="' + key + '"]').forEach(function (el) {
      el.src = imageUrl(url);
    });
  }

  // ─── Имена (обложка + подпись) и монограмма ──────
  function applyNames(groom, bride) {
    groom = (groom || '').trim();
    bride = (bride || '').trim();
    if (!groom && !bride) return;
    var combined = groom + (groom && bride ? ' и ' : '') + bride;
    document.querySelectorAll('[data-edit="names"]').forEach(function (el) {
      el.textContent = combined;
    });
    var mono = document.getElementById('monogram');
    if (mono) {
      var a = groom ? groom[0] : '';
      var b = bride ? bride[0] : '';
      var m = (a + b).toUpperCase();
      if (m) mono.textContent = m;
    }
  }

  // ─── «Наш день»: подсветка дня + соседи N-2 N-1 [N] N+1 N+2 ──
  function applyOurDay(dateStr) {
    if (!dateStr) return;
    var parts = String(dateStr).split('-').map(Number);
    var m = parts[1], day = parts[2];
    if (!day) return;
    var neigh = [day - 2, day - 1, day + 1, day + 2];
    var ds = document.querySelectorAll('#dateRow .d');
    if (ds.length === 4) {
      ds.forEach(function (el, i) {
        el.textContent = neigh[i] >= 1 ? pad(neigh[i]) : '';
      });
    }
    var hl = document.getElementById('dayHl');
    if (hl) hl.textContent = pad(day);
    var mn = document.getElementById('monthName');
    if (mn && m) mn.textContent = (MONTHS_NOM[m - 1] || '').toLowerCase();
  }

  // ─── Палитра дресс-кода ──────────────────────────
  function rebuildSwatches(colors) {
    var box = document.querySelector('[data-edit="swatches"]');
    if (!box || !Array.isArray(colors) || !colors.length) return;
    box.innerHTML = '';
    colors.forEach(function (hex) {
      var i = document.createElement('i');
      i.style.background = hex;
      box.appendChild(i);
    });
  }

  // ─── Список напитков в анкете ────────────────────
  function rebuildDrinks(drinks) {
    var box = document.querySelector('[data-edit="drinks"]');
    if (!box || !Array.isArray(drinks) || !drinks.length) return;
    box.innerHTML = '';
    drinks.forEach(function (d) {
      if (!d || !d.label) return;
      var lab = document.createElement('label');
      lab.className = 'opt';
      lab.innerHTML =
        '<input type="checkbox" name="drink" value="' + escapeHtml(d.value || d.label) + '">' +
        '<span class="box"></span>' + escapeHtml(d.label);
      box.appendChild(lab);
    });
  }

  // ─── Программа дня (серпантин) ───────────────────
  function applySchedule(schedule) {
    if (!Array.isArray(schedule) || !schedule.length) return;
    var tl = document.querySelector('.timeline');
    if (!tl) return;
    var existing = tl.querySelectorAll('.stop');
    if (existing.length === schedule.length) {
      // Кол-во не изменилось → правим на месте (позиции и трек дизайна сохраняются)
      existing.forEach(function (stop, i) {
        var it = schedule[i] || {};
        var ic = stop.querySelector('.ic'); if (ic && it.icon) ic.src = imageUrl(it.icon);
        var tm = stop.querySelector('.time'); if (tm) tm.textContent = it.time || '';
        var lb = stop.querySelector('.lab'); if (lb) lb.textContent = it.title || '';
      });
    } else {
      rebuildTimeline(tl, schedule);
    }
  }

  // Генерация серпантина под произвольное число пунктов (тот же стиль кривой)
  function buildSerpentine(ys, xs) {
    if (!ys.length) return '';
    var d = 'M ' + xs[0] + ' ' + (ys[0] - 40);
    for (var k = 0; k < ys.length - 1; k++) {
      var y0 = ys[k], y1 = ys[k + 1], x0 = xs[k], x1 = xs[k + 1];
      var cy0 = y0 + (y1 - y0) * 0.45, cy1 = y1 - (y1 - y0) * 0.45;
      d += ' C ' + x0 + ' ' + cy0 + ' ' + x1 + ' ' + cy1 + ' ' + x1 + ' ' + y1;
    }
    return d;
  }

  function rebuildTimeline(tl, schedule) {
    var N = schedule.length;
    var TOP0 = 20, STEP = 300, BOTTOM = 280;
    var H = TOP0 + (N - 1) * STEP + BOTTOM;
    var xL = 168, xR = 246;
    tl.style.height = H + 'px';

    var ys = [], xs = [];
    for (var i = 0; i < N; i++) { ys.push(TOP0 + 90 + i * STEP); xs.push(i % 2 === 0 ? xL : xR); }

    var svg = tl.querySelector('.track');
    if (svg) {
      svg.setAttribute('viewBox', '0 0 420 ' + H);
      var path = svg.querySelector('path');
      if (path) path.setAttribute('d', buildSerpentine(ys, xs));
    }

    tl.querySelectorAll('.stop').forEach(function (s) { s.remove(); });
    schedule.forEach(function (it, idx) {
      var side = idx % 2 === 0 ? 'left' : 'right';
      var div = document.createElement('div');
      div.className = 'stop ' + side + ' fu in';
      div.style.top = (TOP0 + idx * STEP) + 'px';
      div.innerHTML =
        '<img class="ic" src="' + imageUrl(it.icon || '') + '" alt="">' +
        '<span class="time">' + escapeHtml(it.time || '') + '</span>' +
        '<span class="lab">' + escapeHtml(it.title || '') + '</span>';
      tl.appendChild(div);
    });
  }

  // ─── Применение всех данных ──────────────────────
  /* ─── Карта проезда ──────────────────────────
     Место/адрес становятся ссылкой, когда пара указала карту.
     Вёрстка не меняется: только курсор и пунктирное подчёркивание. */
  function applyMapLink(url) {
    url = (url || '').trim();
    if (!url) return;
    document.querySelectorAll('[data-edit="venue"], [data-edit="venueAddress"]').forEach(function (el) {
      if (el.tagName === 'A') {
        el.setAttribute('href', url);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener');
        return;
      }
      el.__wcMapUrl = url;
      if (el.dataset.wcMap) return;
      el.dataset.wcMap = '1';
      el.style.cursor = 'pointer';
      el.style.textDecoration = 'underline dotted';
      el.style.textUnderlineOffset = '0.25em';
      el.setAttribute('role', 'link');
      el.setAttribute('tabindex', '0');
      el.title = 'Открыть на карте';
      var open = function () { window.open(el.__wcMapUrl, '_blank', 'noopener'); };
      el.addEventListener('click', open);
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
    });
  }

  function applyData(d) {
    if (!d) return;
    applyMapLink(d.mapLink);
    if (window.WCMusic) window.WCMusic.set(imageUrl(d.musicUrl));
    if (typeof d.apiBase === 'string') STATE.apiBase = d.apiBase;
    if (typeof d.slug === 'string' && d.slug) STATE.slug = d.slug;
    if (typeof d.guestToken === 'string' && d.guestToken) STATE.guestToken = d.guestToken;
    if (typeof d.guestName === 'string' && d.guestName) {
      STATE.guestName = d.guestName;
      var _gn = document.querySelector('#rsvpForm [name="guestName"]');
      if (_gn && !_gn.value) _gn.value = d.guestName;
    }

    applyNames(d.groomName, d.brideName);
    applyOurDay(d.weddingDate);

    setRichText('guestsTitle', d.guestsTitle);
    setRichText('inviteText', d.inviteText);
    setRichText('locationText', d.locationText);
    setRichText('dressText', d.dressText);
    setRichText('surveyText', d.surveyText);
    setRichText('wishesText', d.wishesText);

    setImg('groomPhoto', d.groomPhoto);
    setImg('bridePhoto', d.bridePhoto);
    rebuildSwatches(d.dressCodeColors);
    setImg('dressCodePhoto', d.dressCodePhoto);
    setImg('dressPhoto2', d.dressPhoto2);
    setImg('finalPhoto', d.finalPhoto);

    applySchedule(d.schedule);
    rebuildDrinks(d.drinks);
  }

  // ─── Данные из URL (страница гостя / SSR) ────────
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

  // ─── RSVP: отправка на бэкенд (если есть slug) ───
  function initRsvp() {
    var form = document.getElementById('rsvpForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      function done() {
        form.hidden = true;
        var th = document.getElementById('rsvpThanks');
        if (th) th.removeAttribute('hidden');
      }
      var nameEl = form.querySelector('[name="guestName"]');
      var guestName = nameEl ? nameEl.value.trim() : '';
      var attendEl = form.querySelector('input[name="attend"]:checked');
      var attending = attendEl ? attendEl.value === 'yes' : true;
      var drinks = [];
      form.querySelectorAll('input[name="drink"]:checked').forEach(function (c) { drinks.push(c.value); });

      if (STATE.slug) {
        if (!guestName) { alert('Пожалуйста, укажите ваше имя'); if (nameEl) nameEl.focus(); return; }
        var btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        fetch((STATE.apiBase || '') + '/api/rsvp/' + STATE.slug, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestName: guestName, attending: attending, drinkChoice: drinks.join(','), wishes: '', guestToken: STATE.guestToken || '' })
        }).then(function () { done(); }).catch(function () { done(); });
      } else {
        done(); // режим превью в редакторе
      }
    });
  }

  // ─── postMessage из редактора ────────────────────
  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (msg && msg.type === 'wc:data' && msg.payload) applyData(msg.payload);
  });

  function init() {
    applyData(dataFromUrl());
    initRsvp();
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'wc:ready' }, '*');
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
