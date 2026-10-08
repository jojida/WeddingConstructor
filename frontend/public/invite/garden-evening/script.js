/* ============================================================
   SCRIPT.JS — свадебное приглашение «Вечер в саду»
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
    date: '2027-01-28', time: '15:00',
    groom: 'Даниил', bride: 'Ольга',
    signUser: false,        // подпись финала задала пара (иначе — из имён)
    scheduleSig: '',
    storySig: ''
  };

  var ICONS = [
    'assets/icon-champagne.webp', 'assets/icon-rings.webp', 'assets/icon-bouquet.webp',
    'assets/icon-candelabra.webp', 'assets/icon-cake.webp', 'assets/icon-lamp.webp'
  ];

  var DEFAULT_SCHEDULE = [
    { time: '15:00', title: 'Сбор гостей', icon: 'assets/icon-champagne.webp' },
    { time: '17:00', title: 'Церемония', icon: 'assets/icon-rings.webp' },
    { time: '19:00', title: 'Банкет', icon: 'assets/icon-bouquet.webp' },
    { time: '21:00', title: 'Танцы', icon: 'assets/icon-candelabra.webp' },
    { time: '22:00', title: 'Торт', icon: 'assets/icon-cake.webp' },
    { time: '23:00', title: 'Завершение вечера', icon: 'assets/icon-lamp.webp' }
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

  // Текст абзацами: пустая строка между ними не нужна — каждая строка = абзац
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

  // Пустая строка — пара удалила фото: возвращаем фото дизайна
  function setImg(key, url) {
    if (url == null) return;
    document.querySelectorAll('img[data-edit="' + key + '"]').forEach(function (el) {
      var next = url === '' ? el.getAttribute('data-def') : imageUrl(url);
      if (next && el.getAttribute('src') !== next) el.src = next;
    });
  }

  /* ─── Имена: обложка и финал ─────────────────────── */
  function autoSign() { return STATE.groom + ' & ' + STATE.bride; }

  function applyNames(groom, bride) {
    groom = typeof groom === 'string' ? groom.trim() : '';
    bride = typeof bride === 'string' ? bride.trim() : '';
    if (groom) STATE.groom = groom;
    if (bride) STATE.bride = bride;
    setAll('[data-name="groom"]', STATE.groom);
    setAll('[data-name="bride"]', STATE.bride);
    if (!STATE.signUser) setAll('[data-edit="closingSign"]', autoSign());
    document.title = STATE.groom + ' & ' + STATE.bride + ' — приглашение на свадьбу';
    fitNames();
  }

  // Длинные имена на обложке ужимаем, чтобы строка не выходила за края
  function fitNames() {
    var el = document.querySelector('.hero__names');
    if (!el) return;
    el.style.fontSize = '';
    var room = el.clientWidth - parseFloat(getComputedStyle(el).paddingLeft) * 2;
    var w = el.scrollWidth - parseFloat(getComputedStyle(el).paddingLeft) * 2;
    if (room > 0 && w > room) {
      el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * room / w).toFixed(2) + 'px';
    }
  }

  /* ─── Дата: открытка в конверте и табличка «дней» ── */
  function applyDate(dateStr, timeStr) {
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) STATE.date = dateStr.slice(0, 10);
    if (typeof timeStr === 'string' && /^\d{1,2}:\d{2}/.test(timeStr)) STATE.time = timeStr.slice(0, 5);
    var p = STATE.date.split('-').map(Number), y = p[0], m = p[1], d = p[2];
    if (!y || !m || !d) return;
    // как в макете: «28 .01.27»
    setAll('[data-edit="letterDate"]', pad(d) + ' .' + pad(m) + '.' + String(y).slice(2));
    restartCountdown();
  }

  var cdTimer = null;
  function restartCountdown() {
    if (cdTimer) clearInterval(cdTimer);
    var t = STATE.time.length === 4 ? '0' + STATE.time : STATE.time;
    var target = new Date(STATE.date + 'T' + t + ':00');
    if (isNaN(target.getTime())) target = new Date('2027-01-28T15:00:00');
    function tick() {
      var el = document.getElementById('cdDays');
      if (!el) return;
      var days = Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86400000));
      var s = String(days);
      if (el.textContent !== s) el.textContent = s;
      // 3–4 цифры — мельче, чтобы число поместилось на доске
      el.style.fontSize = s.length >= 4 ? '150px' : s.length === 3 ? '196px' : '';
    }
    tick();
    cdTimer = setInterval(tick, 60000);
  }

  /* ─── Место ──────────────────────────────────────── */
  function applyVenue(d) {
    if (typeof d.venue === 'string') setAll('[data-edit="venue"]', d.venue.trim());
    if (typeof d.venueAddress === 'string') setAll('[data-edit="venueAddress"]', d.venueAddress.trim());
  }

  /* ─── Программа дня: пункты-серпантин + сердце на треке ── */
  var TL = { prog: null, path: null, svg: null, heart: null, len: 0, y0: 0, y1: 0, u: 1 };

  function applySchedule(list) {
    if (!Array.isArray(list) || !list.length) return;
    var sig = JSON.stringify(list.map(function (it) { return it ? [it.time, it.title, it.icon] : null; }));
    if (sig === STATE.scheduleSig) return;          // не перестраиваем то же самое
    STATE.scheduleSig = sig;

    var prog = document.getElementById('prog');
    if (!prog) return;
    // Пункты уже проявились — новые показываем сразу, без повторной анимации
    var shown = !!prog.querySelector('.prog__node.in');
    prog.querySelectorAll('.prog__node').forEach(function (n) { n.remove(); });
    var i = 0;
    list.forEach(function (it) {
      if (!it) return;
      var node = document.createElement('div');
      node.className = 'prog__node ' + (i % 2 ? 'is-right' : 'is-left') + ' rv' + (shown ? ' in' : '');
      var icon = it.icon || ICONS[i % ICONS.length];
      var iconHtml = isImageIcon(icon)
        ? '<img class="prog__icon" src="' + escapeHtml(imageUrl(icon)) + '" alt="">'
        : '<span class="prog__icon prog__icon--emoji" aria-hidden="true">' + escapeHtml(icon) + '</span>';
      node.innerHTML = iconHtml +
        '<p class="prog__title">' + escapeHtml(it.title || '') + '</p>' +
        '<p class="prog__time">' + escapeHtml(it.time || '') + '</p>';
      prog.appendChild(node);
      i++;
    });
    var section = document.getElementById('program');
    if (section) section.classList.toggle('end-right', i % 2 === 0);
    if (!shown) observeReveal(prog);
    prog.querySelectorAll('img.prog__icon').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', layoutTrack, { once: true });
    });
    layoutTrack();
  }

  // Трек проходит между колонками: у пункта слева он отходит вправо, у пункта
  // справа — влево. Точки — по центру иконок (offsetTop: пункт при появлении
  // сдвинут transform'ом, getBoundingClientRect дал бы неверные координаты)
  function layoutTrack() {
    var prog = TL.prog = document.getElementById('prog');
    var svg = TL.svg = document.getElementById('progSvg');
    var path = TL.path = document.getElementById('progPath');
    TL.heart = document.getElementById('progHeart');
    if (!prog || !svg || !path) return;
    var nodes = [].slice.call(prog.querySelectorAll('.prog__node'));
    var W = prog.clientWidth, H = prog.offsetHeight;
    if (!nodes.length || !W || !H) return;
    var u = TL.u = W / 1366;
    var centers = nodes.map(function (n) {
      var icon = n.querySelector('.prog__icon');
      return n.offsetTop + (icon ? icon.offsetTop + icon.offsetHeight / 2 : n.offsetHeight / 2);
    });
    // Как в макете: сердце стоит рядом с первым пунктом на уровне его подписи,
    // трек вьётся между колонками и заканчивается у последнего пункта.
    // Начало и конец — в свободном коридоре между колонками пунктов
    // (левая 0–560, правая 780–1340): на уровне подписей там нет текста.
    // Изгибы у каждого пункта уходят к противоположной колонке, а она на
    // этой высоте пустая — пункты стоят лесенкой.
    var MID = 670;
    var pts = [[(MID - 20) * u, centers[0] + 296 * u]];
    for (var i = 1; i < nodes.length; i++) {
      pts.push([(nodes[i].classList.contains('is-right') ? 585 : 785) * u, centers[i]]);
    }
    var endY = Math.max(centers[centers.length - 1] + 200 * u, pts[pts.length - 1][1] + 160 * u);
    pts.push([(MID + 10) * u, endY]);

    var d = 'M ' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var k = 1; k < pts.length; k++) {
      var a = pts[k - 1], b = pts[k], h = (b[1] - a[1]) / 2;
      d += ' C ' + a[0].toFixed(1) + ' ' + (a[1] + h).toFixed(1) + ' ' + b[0].toFixed(1) + ' ' + (b[1] - h).toFixed(1) +
           ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
    }
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    path.setAttribute('d', d);
    try { TL.len = path.getTotalLength(); } catch (e) { TL.len = 0; }
    TL.y0 = pts[0][1];
    TL.y1 = pts[pts.length - 1][1];
    prog.classList.add('is-ready');
    updateHeart();
  }

  // Как в других шаблонах: позиция — прямо за прокруткой, без переходов;
  // сердце (124×112 в единицах макета) ставим центром на точку трека
  function updateHeart() {
    var prog = TL.prog, path = TL.path, heart = TL.heart;
    if (!prog || !path || !heart || !TL.len) return;
    var top = prog.getBoundingClientRect().top;
    var span = TL.y1 - TL.y0;
    var p = span > 0 ? (window.innerHeight * 0.5 - (top + TL.y0)) / span : 0;
    p = Math.max(0, Math.min(1, p));
    var pt;
    try { pt = path.getPointAtLength(p * TL.len); } catch (e) { return; }
    var u = TL.u;
    heart.setAttribute('transform',
      'translate(' + (pt.x - 62 * u).toFixed(1) + ' ' + (pt.y - 56 * u).toFixed(1) + ') scale(' + u.toFixed(4) + ')');
  }

  function initTrack() {
    window.addEventListener('scroll', updateHeart, { passive: true });
    window.addEventListener('resize', function () { layoutTrack(); fitNames(); fitStory(); }, { passive: true });
    window.addEventListener('load', function () { layoutTrack(); fitNames(); fitStory(); });
    if ('ResizeObserver' in window) {
      var prog = document.getElementById('prog');
      if (prog) new ResizeObserver(function () { layoutTrack(); }).observe(prog);
    }
  }

  /* ─── Палитра дресс-кода: круги макета, при многих цветах — мельче ── */
  function rebuildPalette(colors) {
    if (!Array.isArray(colors) || !colors.length) return;
    var box = document.querySelector('[data-edit="palette"]');
    if (!box) return;
    box.innerHTML = '';
    var list = colors.filter(function (c) { return typeof c === 'string' && c; });
    var n = Math.min(list.length, 6);
    var s = Math.min(244, (1186 - (n - 1) * 46) / n);
    box.style.setProperty('--s', s.toFixed(1));
    list.forEach(function (c) {
      var sp = document.createElement('span');
      sp.style.setProperty('--c', c);
      box.appendChild(sp);
    });
  }

  /* ─── Свиток: текст вписываем в пергамент ─────────── */
  function fitStory() {
    var box = document.querySelector('.scroll__box');
    var text = document.querySelector('.scroll__text');
    if (!box || !text || !box.clientHeight) return;
    var fs = 59;
    text.style.setProperty('--fs', fs);
    while (fs > 36 && text.scrollHeight > box.clientHeight) {
      fs -= 2;
      text.style.setProperty('--fs', fs);
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
      setTimeout(fin, 3000);   // запасной путь: вкладка была в фоне и анимация не шла
    }
  }

  function initReveal() {
    if (REDUCED || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.rv, .rv-soft, .rv-write').forEach(function (el) { el.classList.add('in', 'done'); });
      document.querySelectorAll('.letter').forEach(function (el) { el.classList.add('is-open'); });
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

    // Конверт: бумага с датой выезжает, когда конверт почти целиком на экране
    var letter = document.querySelector('.letter');
    if (letter) {
      var lio = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { letter.classList.add('is-open'); lio.disconnect(); }
        });
      }, { threshold: 0.45 });
      lio.observe(letter);
    }
  }

  function observeReveal(scope) {
    (scope || document).querySelectorAll('.rv:not(.in), .rv-soft:not(.in), .rv-write:not(.in)').forEach(function (el) {
      if (io) io.observe(el);
      else el.classList.add('in', 'done');
    });
  }

  /* ─── Обложка ─────────────────────────────────────────
     Гость: конверт → видео (сад оживает, пара подходит и замирает в позе
     обложки) → видео гаснет поверх тех же слоёв сцены и пары, сад темнеет,
     появляются надпись и имена (класс hero-go). Без видео — редактор,
     «меньше движения», экономия трафика, видео не загрузилось — финал
     сразу после конверта. */
  var LIVE = { v: null, started: false, playing: false, done: false, timer: 0 };

  function startHero() {
    if (ROOT.classList.contains('hero-go')) return;
    fitNames();
    ROOT.classList.add('hero-go');
  }

  function unloadVideo(v) {
    try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
    if (v.parentNode) v.parentNode.removeChild(v);
  }

  // Видео не нужно или сломалось до старта — под конвертом обычная обложка
  function dropLive() {
    var v = LIVE.v || document.getElementById('heroLive');
    LIVE.v = null;
    ROOT.classList.remove('hero-live');
    if (v) unloadVideo(v);
  }

  function finishLive() {
    if (LIVE.done) return;
    LIVE.done = true;
    clearTimeout(LIVE.timer);
    startHero();
    // видео погасло — освобождаем память телефона
    var v = LIVE.v;
    if (v) setTimeout(function () { unloadVideo(v); }, 1600);
  }

  function playLive() {
    var v = LIVE.v;
    if (!v) { startHero(); return; }
    if (LIVE.started) return;
    LIVE.started = true;
    try { if (v.currentTime > 0.05) v.currentTime = 0; } catch (e) {}
    var p;
    try { p = v.play(); } catch (e) { finishLive(); return; }
    if (p && typeof p.catch === 'function') p.catch(finishLive);
    // Начало не успело загрузиться — открываем обложку без видео
    LIVE.timer = setTimeout(function () { if (!LIVE.playing) finishLive(); }, 4000);
  }

  function initLive() {
    var v = document.getElementById('heroLive');
    var conn = navigator.connection;
    if (!v || REDUCED || (conn && conn.saveData) || !v.canPlayType || !v.canPlayType('video/mp4')) {
      dropLive();
      return;
    }
    LIVE.v = v;
    v.muted = true;
    v.poster = v.getAttribute('data-poster');
    v.preload = 'auto';
    v.src = v.getAttribute('data-src');
    ROOT.classList.add('hero-live');

    // Гаснет чуть раньше последнего кадра: пара уже замерла
    v.addEventListener('timeupdate', function () {
      if (LIVE.started && v.duration && v.currentTime >= v.duration - 0.3) finishLive();
    });
    v.addEventListener('ended', function () { if (LIVE.started) finishLive(); });
    v.addEventListener('error', function () { if (LIVE.started) finishLive(); else dropLive(); });
    v.addEventListener('playing', function () {
      if (!LIVE.started || LIVE.done) return;
      LIVE.playing = true;
      // зависло посреди ролика — не держим гостя
      clearTimeout(LIVE.timer);
      LIVE.timer = setTimeout(finishLive, ((v.duration || 8) - v.currentTime + 4) * 1000);
    });

    // Касание конверта «разрешает» видео: iPhone в режиме энергосбережения
    // без касания не запустит даже беззвучное. Запуск и сразу пауза
    var env = document.getElementById('envelope');
    if (!env) return;
    var prime = function () {
      env.removeEventListener('click', prime);
      env.removeEventListener('keydown', prime);
      if (LIVE.started || !LIVE.v) return;
      try {
        var p = v.play();
        if (p && typeof p.then === 'function') {
          p.then(function () {
            if (!LIVE.started) { v.pause(); try { v.currentTime = 0; } catch (e) {} }
          }, function () {});
        }
      } catch (e) {}
    };
    env.addEventListener('click', prime);
    env.addEventListener('keydown', prime);
  }

  /* Редактор: «▶ Посмотреть, как откроется» на обложке — всё, что видит гость:
     конверт (../assets/envelope.js) → живое видео обложки → надпись и имена.
     Пока конверт закрыт, обложка под ним возвращается к началу. */
  function previewIntro(done) {
    var v = document.getElementById('heroLive');
    var live = !!(v && !REDUCED && v.canPlayType && v.canPlayType('video/mp4'));
    ROOT.classList.remove('hero-go');
    if (live) {
      if (!v.getAttribute('src')) {
        v.muted = true;
        v.poster = v.getAttribute('data-poster');
        v.preload = 'auto';
        v.src = v.getAttribute('data-src');
      }
      try { v.pause(); v.currentTime = 0; } catch (e) {}
      ROOT.classList.add('hero-live');
    }
    var finished = false, t = 0;
    function names() {
      if (finished) return;
      finished = true;
      clearTimeout(t);
      if (v) {
        v.removeEventListener('timeupdate', near);
        v.removeEventListener('ended', names);
        v.removeEventListener('error', names);
      }
      startHero();
      // видео погасло, надпись и имена написаны
      setTimeout(function () { if (v) { try { v.pause(); } catch (e) {} } done(); }, 3400);
    }
    function near() { if (v.duration && v.currentTime >= v.duration - 0.3) names(); }
    window.WCEnvelope.preview(function () {
      if (!live) { names(); return; }
      v.addEventListener('timeupdate', near);
      v.addEventListener('ended', names);
      v.addEventListener('error', names);
      t = setTimeout(names, 9000);
      var p;
      try { p = v.play(); } catch (e) { names(); return; }
      if (p && typeof p.catch === 'function') p.catch(names);
    });
  }

  function initHero() {
    if (window.WCEnvelope && window.WCEnvelope.active) {
      initLive();
      window.addEventListener('wc:envelope-open', playLive);
      return;
    }
    var IP = window.WCEnvelope && window.WCEnvelope.preview && window.WCIntroPreview && window.WCIntroPreview.on
      ? window.WCIntroPreview : null;
    if (IP) IP.button(previewIntro);
    else dropLive();
    // Без конверта ждём шрифты (не дольше секунды), чтобы имена не мигнули запасным
    var started = false;
    var go = function () { if (!started) { started = true; startHero(); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
    setTimeout(go, 1000);
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
      if (own) setAll('[data-edit="closingSign"]', own);
    }
    applyNames(d.groomName, d.brideName);
    applyDate(d.weddingDate, d.weddingTime);

    setRichText('heroTitle', d.heroTitle);
    setRichText('greetingTitle', d.greetingTitle);
    setParagraphs('inviteText', d.inviteText);
    applyVenue(d);
    setRichText('dressText', d.dressText);
    setRichText('surveyText', d.surveyText);
    setRichText('closingTitle', d.closingTitle);
    setRichText('closingLove', d.closingLove);
    if (typeof d.story === 'string' && d.story !== STATE.storySig && setParagraphs('story', d.story)) {
      STATE.storySig = d.story;
      fitStory();
    }

    setImg('dressCodePhoto', d.dressCodePhoto);
    setImg('dressPhoto2', d.dressPhoto2);
    setImg('dressMan1', d.dressMan1);
    setImg('dressMan2', d.dressMan2);
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
      document.fonts.ready.then(function () { fitNames(); layoutTrack(); fitStory(); });
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
