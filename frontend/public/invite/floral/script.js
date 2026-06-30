/* ============================================
   SCRIPT.JS — Свадебное приглашение «Флоральный»
   Подстановка данных из конструктора без изменения дизайна.
   URL-параметры (страница гостя) + postMessage('wc:data') (живое превью).
   Меняются только текст, фото и цвета.
   ============================================ */
(function () {
  'use strict';

  var STATE = { apiBase: '', slug: '', date: '2026-06-26', time: '14:00' };

  function pad(n) { return String(n).padStart(2, '0'); }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function imageUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//.test(url) || url.indexOf('data:') === 0) return url;
    if (url.indexOf('/invite/') === 0) return url;
    if (url.charAt(0) === '/') return (STATE.apiBase || '') + url;
    return url;
  }

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

  // SVG <image> (фото в арке) — обрезка clip-path сохраняется
  function setSvgImage(key, url) {
    if (!url) return;
    var u = imageUrl(url);
    document.querySelectorAll('image[data-edit="' + key + '"]').forEach(function (el) {
      el.setAttribute('href', u);
      el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', u);
    });
  }

  // ─── Имена (обложка): Невеста & Жених ────────────
  function applyNames(groom, bride) {
    groom = (groom || '').trim();
    bride = (bride || '').trim();
    if (!groom && !bride) return;
    var combined = bride + (bride && groom ? ' & ' : '') + groom;
    document.querySelectorAll('[data-edit="names"]').forEach(function (el) {
      el.textContent = combined;
    });
  }

  // ─── Дата (строка DD / MM / YY) + таймер ─────────
  function applyDate(dateStr, timeStr) {
    if (dateStr) {
      var p = String(dateStr).split('-').map(Number);
      var y = p[0], m = p[1], day = p[2];
      if (y && m && day) {
        var dl = document.querySelector('[data-edit="dateLine"]');
        if (dl) dl.textContent = pad(day) + ' / ' + pad(m) + ' / ' + String(y).slice(-2);
      }
    }
    restartCountdown(dateStr, timeStr);
  }

  var cdInterval = null;
  function restartCountdown(dateStr, timeStr) {
    if (dateStr) STATE.date = dateStr;
    if (timeStr) STATE.time = timeStr;
    if (cdInterval) clearInterval(cdInterval);
    var ts = STATE.time || '14:00';
    var target = new Date((STATE.date || '2026-06-26') + 'T' + (ts.length === 5 ? ts + ':00' : ts));
    if (isNaN(target.getTime())) target = new Date('2026-06-26T14:00:00');
    function tick() {
      var diff = target - new Date();
      var d = document.getElementById('cd-days'), h = document.getElementById('cd-hours'),
          mi = document.getElementById('cd-mins'), s = document.getElementById('cd-secs');
      if (!d) return;
      if (diff <= 0) { d.textContent = '00'; h.textContent = '00'; mi.textContent = '00'; s.textContent = '00'; return; }
      d.textContent  = pad(Math.floor(diff / 86400000));
      h.textContent  = pad(Math.floor((diff % 86400000) / 3600000));
      mi.textContent = pad(Math.floor((diff % 3600000) / 60000));
      s.textContent  = pad(Math.floor((diff % 60000) / 1000));
    }
    tick();
    cdInterval = setInterval(tick, 1000);
  }

  // ─── Палитра дресс-кода (силуэт свотча, заливка цветом) ──
  function rebuildSwatches(colors) {
    var box = document.querySelector('[data-edit="swatches"]');
    if (!box || !Array.isArray(colors) || !colors.length) return;
    box.innerHTML = '';
    colors.forEach(function (hex) {
      var s = document.createElement('span');
      s.className = 'dc-swatch-color';
      s.style.backgroundColor = hex;
      box.appendChild(s);
    });
  }

  // ─── Список напитков ─────────────────────────────
  function rebuildDrinks(drinks) {
    var box = document.querySelector('[data-edit="drinks"]');
    if (!box || !Array.isArray(drinks) || !drinks.length) return;
    box.innerHTML = '';
    drinks.forEach(function (d) {
      if (!d || !d.label) return;
      var lab = document.createElement('label');
      lab.className = 'rsvp-option';
      lab.innerHTML =
        '<input type="checkbox" name="drink" value="' + escapeHtml(d.value || d.label) + '">' +
        '<span>' + escapeHtml(d.label) + '</span>';
      box.appendChild(lab);
    });
  }

  // Иконка-картинка (путь/URL) или эмодзи? Демо-данные шлют эмодзи,
  // редактор — пути к SVG. Пустую иконку не рендерим вовсе.
  function isImageIcon(s) {
    return /^(https?:|data:|\/)/.test(s) || /\.(svg|png|jpe?g|gif|webp)$/i.test(s);
  }
  function iconHtml(raw) {
    raw = raw || '';
    if (!raw) return '';
    if (isImageIcon(raw)) return '<img class="sched-icon" src="' + imageUrl(raw) + '" alt="">';
    return '<span class="sched-icon sched-emoji">' + escapeHtml(raw) + '</span>';
  }

  // ─── Расписание: каждый пункт строго напротив точки ──
  function applySchedule(schedule) {
    if (!Array.isArray(schedule) || !schedule.length) return;
    var wrap = document.querySelector('.schedule-wrap');
    if (!wrap) return;
    wrap.style.display = 'block';
    wrap.innerHTML = '';
    schedule.forEach(function (it, i) {
      var left = i % 2 === 0;
      var meta = '<div class="sched-meta"><span class="sched-time">' + escapeHtml(it.time || '') +
                 '</span><span class="sched-name">' + escapeHtml(it.title || '') + '</span></div>';
      var icon = iconHtml(it.icon);
      var content = left
        ? '<div class="sched-item-left">' + meta + icon + '</div>'
        : '<div class="sched-item-right">' + icon + meta + '</div>';
      var row = document.createElement('div');
      row.className = 'sched-row';
      row.innerHTML =
        '<div class="sched-side left">' + (left ? content : '') + '</div>' +
        '<div class="sched-center"><span class="tl-dot"></span></div>' +
        '<div class="sched-side right">' + (left ? '' : content) + '</div>';
      wrap.appendChild(row);
    });
  }

  // ─── Применение данных ───────────────────────────
  function applyData(d) {
    if (!d) return;
    if (typeof d.apiBase === 'string') STATE.apiBase = d.apiBase;
    if (typeof d.slug === 'string' && d.slug) STATE.slug = d.slug;
    if (typeof d.guestToken === 'string' && d.guestToken) STATE.guestToken = d.guestToken;
    if (typeof d.guestName === 'string' && d.guestName) {
      STATE.guestName = d.guestName;
      var _gn = document.querySelector('#rsvpForm [name="guestName"]');
      if (_gn && !_gn.value) _gn.value = d.guestName;
    }

    applyNames(d.groomName, d.brideName);
    applyDate(d.weddingDate, d.weddingTime);

    setRichText('dearGuests', d.dearGuests);
    setRichText('inviteText', d.inviteText);
    setRichText('weAwait', d.weAwait);
    setRichText('venue', d.venue);
    setRichText('story', d.story);
    setRichText('surveyText', d.surveyText);
    setRichText('closing', d.closing);

    setSvgImage('coverPhoto', d.coverPhoto);
    setImg('dressCodePhoto', d.dressCodePhoto);
    setImg('dressPhoto2', d.dressPhoto2);
    setImg('polaroid1', d.polaroid1);
    setImg('polaroid2', d.polaroid2);
    setImg('locationPhoto', d.locationPhoto);

    rebuildSwatches(d.dressCodeColors);
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
        done();
      }
    });
  }

  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (msg && msg.type === 'wc:data' && msg.payload) applyData(msg.payload);
  });

  function init() {
    applyData(dataFromUrl());
    restartCountdown();
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
