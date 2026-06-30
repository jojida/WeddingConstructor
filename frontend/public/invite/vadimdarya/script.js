/* ============================================
   SCRIPT.JS — Wedding Invitation (Тёмная элегантность)
   Интегрирован в конструктор: данные подставляются
   через URL-параметры и postMessage из редактора.
   ============================================ */

(function () {
  'use strict';

  // ─── Справочники месяцев ─────────────────────────
  var MONTHS_GEN = ['ЯНВАРЯ','ФЕВРАЛЯ','МАРТА','АПРЕЛЯ','МАЯ','ИЮНЯ',
                    'ИЮЛЯ','АВГУСТА','СЕНТЯБРЯ','ОКТЯБРЯ','НОЯБРЯ','ДЕКАБРЯ'];
  var MONTHS_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                    'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

  // Текущее состояние данных (для таймера и т.п.)
  var STATE = {
    weddingDate: '2026-09-20',
    weddingTime: '15:00',
    apiBase: ''
  };

  function pad(n) { return String(n).padStart(2, '0'); }

  function imageUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//.test(url) || url.indexOf('data:') === 0) return url;
    // Ассеты фронтенда (этот же origin) — без префикса apiBase
    if (url.indexOf('/invite/') === 0) return url;
    // Загруженные файлы бэкенда (/uploads/...) — с префиксом apiBase
    if (url.charAt(0) === '/') return (STATE.apiBase || '') + url;
    return url;
  }

  function setText(key, value) {
    if (value == null) return;
    document.querySelectorAll('[data-edit="' + key + '"]').forEach(function (el) {
      el.textContent = value;
    });
  }

  // ─── Применение данных к DOM ─────────────────────
  function applyData(d) {
    if (!d) return;

    if (typeof d.apiBase === 'string') STATE.apiBase = d.apiBase;

    // Имена
    var groom = (d.groomName || '').trim();
    var bride = (d.brideName || '').trim();
    if (groom) setText('groomName', groom);
    if (bride) setText('brideName', bride);
    if (groom || bride) {
      setText('footerNames', (groom || '') + (groom && bride ? ' и ' : '') + (bride || ''));
    }
    // Инициалы на печати — первые буквы имён, меняются вместе с именами
    if (groom) setText('sealGroomInitial', groom.charAt(0).toUpperCase());
    if (bride) setText('sealBrideInitial', bride.charAt(0).toUpperCase());

    // Дата
    if (d.weddingDate) {
      STATE.weddingDate = d.weddingDate;
      var parts = String(d.weddingDate).split('-').map(Number);
      var y = parts[0], m = parts[1], day = parts[2];
      if (y && m && day) {
        var monGen = MONTHS_GEN[m - 1] || '';
        var monNom = MONTHS_NOM[m - 1] || '';
        setText('dateDay', String(day));
        setText('dateMonth', monGen);
        setText('dateYear', String(y));
        setText('calMonth', monNom);
        setText('calYear', String(y));
        setText('footerDate', day + ' · ' + monGen + ' · ' + y);
        rebuildCalendar(day);
      }
    }
    if (d.weddingTime) STATE.weddingTime = d.weddingTime;

    // Площадка
    if (d.venue) setText('venue', d.venue);
    var addrEl = document.querySelector('[data-edit="venueAddress"]');
    if (addrEl) {
      if (d.venueAddress) addrEl.textContent = d.venueAddress;
      if (d.mapLink) addrEl.setAttribute('href', d.mapLink);
    }

    // Тексты
    if (d.inviteText) setText('inviteText', d.inviteText);
    if (d.dressCode) setText('dressCode', d.dressCode);

    // Пожелания и детали
    if (typeof d.story === 'string' && d.story.trim()) {
      var dc = document.getElementById('detailsContent');
      if (dc) {
        dc.innerHTML = '';
        d.story.split(/\n+/).forEach(function (line) {
          if (!line.trim()) return;
          var p = document.createElement('p');
          p.className = 'details-text';
          p.textContent = line.trim();
          dc.appendChild(p);
        });
      }
    }

    // Обложка / hero
    if (d.coverPhoto) {
      var hero = document.getElementById('heroImg');
      var fb = document.getElementById('heroFallback');
      if (hero) {
        hero.src = imageUrl(d.coverPhoto);
        hero.style.display = '';
        if (fb) fb.style.display = 'none';
      }
    }

    // Программа дня
    if (Array.isArray(d.schedule) && d.schedule.length) {
      rebuildTimeline(d.schedule);
    }

    // Цвета дресс-кода
    if (Array.isArray(d.dressCodeColors) && d.dressCodeColors.length) {
      rebuildPalette(d.dressCodeColors);
    }

    // Фото образа (дресс-код)
    if (d.dressCodePhoto) {
      var slot = document.getElementById('dc-custom-photo');
      if (slot) {
        slot.innerHTML = '<img src="' + imageUrl(d.dressCodePhoto) + '" alt="Образ" class="dc-custom-img" />';
        slot.removeAttribute('hidden');
      }
    }

    // Перезапуск таймера под новую дату
    restartCountdown();
  }

  // ─── Мини-календарь: 5 дней c сердцем на дне свадьбы ──
  function rebuildCalendar(day) {
    var days = document.querySelector('[data-edit="calDays"]');
    if (!days) return;
    var arr = [day - 2, day - 1, day, day + 1, day + 2];
    var min = Math.min.apply(null, arr);
    if (min < 1) { var shift = 1 - min; arr = arr.map(function (n) { return n + shift; }); }
    days.innerHTML = '';
    arr.forEach(function (n) {
      if (n === day) {
        var wrapEl = document.createElement('div');
        wrapEl.className = 'cal-heart-wrap';
        wrapEl.innerHTML =
          '<svg class="cal-heart-svg" viewBox="0 0 24 24">' +
          '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>' +
          '</svg><span class="cal-day cal-day-main">' + n + '</span>';
        days.appendChild(wrapEl);
      } else {
        var s = document.createElement('span');
        s.className = 'cal-day';
        s.textContent = n;
        days.appendChild(s);
      }
    });
  }

  // ─── Перестроение программы дня ──────────────────
  function rebuildTimeline(schedule) {
    var tl = document.getElementById('timeline');
    if (!tl) return;
    tl.innerHTML = '';
    schedule.forEach(function (item, i) {
      var div = document.createElement('div');
      div.className = 'timeline-item';
      div.setAttribute('data-delay', String(i * 100));
      var title = (item.icon ? item.icon + ' ' : '') + (item.title || '');
      div.innerHTML =
        '<div class="timeline-time">' + escapeHtml(item.time || '') + '</div>' +
        '<div class="timeline-dot"></div>' +
        '<div class="timeline-content">' +
        '<h3 class="tl-title">' + escapeHtml(title) + '</h3>' +
        (item.desc ? '<p class="tl-desc">' + escapeHtml(item.desc) + '</p>' : '') +
        '</div>';
      tl.appendChild(div);
    });
    observeReveals(tl.querySelectorAll('.timeline-item'));
  }

  // ─── Перестроение палитры дресс-кода ─────────────
  function rebuildPalette(colors) {
    var pal = document.getElementById('palette');
    if (!pal) return;
    pal.innerHTML = '';
    colors.forEach(function (hex) {
      var sw = document.createElement('div');
      sw.className = 'palette-swatch';
      sw.style.background = hex;
      sw.setAttribute('title', hex);
      pal.appendChild(sw);
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ─── Чтение URL-параметров ───────────────────────
  function dataFromUrl() {
    var p = new URLSearchParams(window.location.search);
    var d = {};
    if (p.get('apiBase')) d.apiBase = p.get('apiBase');
    if (p.get('groom') != null) d.groomName = p.get('groom');
    if (p.get('bride') != null) d.brideName = p.get('bride');
    if (p.get('date')) d.weddingDate = p.get('date');
    if (p.get('time')) d.weddingTime = p.get('time');
    if (p.get('venue')) d.venue = p.get('venue');
    if (p.get('address')) d.venueAddress = p.get('address');
    if (p.get('map')) d.mapLink = p.get('map');
    if (p.get('cover')) d.coverPhoto = p.get('cover');
    if (p.get('inviteText')) d.inviteText = p.get('inviteText');
    if (p.get('story')) d.story = p.get('story');
    if (p.get('dressCode')) d.dressCode = p.get('dressCode');
    if (p.get('dressPhoto')) d.dressCodePhoto = p.get('dressPhoto');
    try { if (p.get('schedule')) d.schedule = JSON.parse(p.get('schedule')); } catch (e) {}
    try { if (p.get('colors')) d.dressCodeColors = JSON.parse(p.get('colors')); } catch (e) {}
    return d;
  }

  // ─── Scroll Reveal ───────────────────────────────
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var el = entry.target;
      if (entry.isIntersecting) {
        var delay = el.dataset.delay ? parseInt(el.dataset.delay) : 0;
        if (el.revealTimeout) clearTimeout(el.revealTimeout);
        el.revealTimeout = setTimeout(function () { el.classList.add('visible'); }, delay);
        revealObserver.unobserve(el);
      }
    });
  }, { threshold: 0.15 });

  function observeReveals(list) {
    list.forEach(function (el) { revealObserver.observe(el); });
  }

  function initScrollReveal() {
    var targets = [
      '#invite-text .invite-card',
      '#program',
      '#rsvp .rsvp-card',
      '.divider-section'
    ];
    targets.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) { el.classList.add('reveal'); });
    });
    observeReveals(document.querySelectorAll('.reveal'));
    document.querySelectorAll('.timeline-item').forEach(function (el) {
      el.classList.remove('reveal');
      revealObserver.observe(el);
    });
  }

  // ─── Countdown Timer ─────────────────────────────
  var countdownInterval = null;
  function restartCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    var dateStr = STATE.weddingDate || '2026-09-20';
    var timeStr = STATE.weddingTime || '15:00';
    var target = new Date(dateStr + 'T' + (timeStr.length === 5 ? timeStr + ':00' : timeStr));
    if (isNaN(target.getTime())) target = new Date('2026-09-20T15:00:00');

    function tick() {
      var diff = target - new Date();
      var dEl = document.getElementById('cd-days'),
          hEl = document.getElementById('cd-hours'),
          mEl = document.getElementById('cd-minutes'),
          sEl = document.getElementById('cd-seconds');
      if (!dEl) return;
      if (diff <= 0) {
        dEl.textContent = '00'; hEl.textContent = '00';
        mEl.textContent = '00'; sEl.textContent = '00';
        return;
      }
      dEl.textContent = pad(Math.floor(diff / 86400000));
      hEl.textContent = pad(Math.floor((diff % 86400000) / 3600000));
      mEl.textContent = pad(Math.floor((diff % 3600000) / 60000));
      sEl.textContent = pad(Math.floor((diff % 60000) / 1000));
    }
    tick();
    countdownInterval = setInterval(tick, 1000);
  }

  // ─── Hero parallax ───────────────────────────────
  window.addEventListener('scroll', function () {
    var heroBg = document.getElementById('hero-bg');
    if (heroBg) heroBg.style.transform = 'translateY(' + (window.pageYOffset * 0.35) + 'px)';
  }, { passive: true });

  // ─── Couple photo fallback ───────────────────────
  function initHeroFallback() {
    var img = document.getElementById('heroImg');
    var fallback = document.getElementById('heroFallback');
    if (!img) return;
    function handle() {
      if (img.naturalWidth === 0) {
        img.style.display = 'none';
        if (fallback) fallback.style.display = 'flex';
      } else {
        if (fallback) fallback.style.display = 'none';
      }
    }
    if (img.complete) handle();
    else { img.addEventListener('load', handle); img.addEventListener('error', handle); }
  }

  // ─── Dresscode Tabs ──────────────────────────────
  window.switchDresscode = function (tabId) {
    document.querySelectorAll('.dresscode-tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.dresscode-content').forEach(function (c) { c.classList.remove('active'); });
    var targetBtn = document.querySelector('.dresscode-tab[onclick="switchDresscode(\'' + tabId + '\')"]');
    var targetContent = document.getElementById('dresscode-' + tabId);
    if (targetBtn) targetBtn.classList.add('active');
    if (targetContent) targetContent.classList.add('active');
  };

  // ─── RSVP / Сообщения (реальная отправка — следующий этап) ──
  window.sendRsvp = function (form) {
    var attendance = form.querySelector('input[name="attendance"]:checked');
    if (!attendance) { alert('Пожалуйста, выберите ответ о присутствии.'); return; }
    var btn = form.querySelector('button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '✓ Спасибо! Ваш ответ получен';
      btn.style.opacity = '0.6';
    }
  };

  window.sendGuestMessage = function () {
    var input = document.getElementById('guestMessageInput');
    var btn = document.querySelector('[onclick="sendGuestMessage()"]');
    if (!input || input.value.trim() === '') {
      alert('Пожалуйста, напишите сообщение перед отправкой.');
      if (input) input.focus();
      return;
    }
    if (btn) { btn.textContent = '✓ Отправлено!'; btn.style.opacity = '0.6'; }
    input.value = '';
  };

  // ─── postMessage от редактора (живое превью) ─────
  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (msg && msg.type === 'wc:data' && msg.payload) {
      applyData(msg.payload);
    }
  });

  // ─── Инициализация ───────────────────────────────
  function init() {
    applyData(dataFromUrl());
    initHeroFallback();
    initScrollReveal();
    restartCountdown();
    // Сообщить родителю (редактору), что iframe готов принимать данные
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'wc:ready' }, '*');
      }
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
