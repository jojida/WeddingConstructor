/* ============================================================
   ENVELOPE3D.JS — первый экран: 3D-конверт с печатью-монограммой.
   Движок — envelope3d/engine.js (WebGL2 без библиотек), прототип —
   /envelope-3d/index.html.

   Подключение — ПЕРВЫМ элементом <body>, до разметки и script.js шаблона:
     <script src="../assets/envelope3d.js" data-wax="beige"
             data-serif="Old Standard TT" data-groom="Алексей"
             data-bride="Ангелина" data-date="2027-07-12"></script>
   data-wax — цвет печати по умолчанию (пара меняет его в редакторе:
   customData.sealColor), data-groom/bride/date — демо-данные шаблона.
   Буквы на печати — первые буквы имён жениха и невесты.

   Гость: конверт поверх сайта. Касание — печать вдавливается, клапан
   поднимается, из кармана выезжает карточка, затем конверт растворяется.
   Второе касание — пропустить. Договор с script.js шаблона — как у
   видео-конверта (envelope.js): window.WCEnvelope.active = true, пока
   конверт закрыт; событие 'wc:envelope-open', когда обложке пора появляться.

   Редактор (editing=1): обложка готовая, конверт — скрытый слой ровно поверх
   обложки (../assets/intro-preview.js; на слое data-edit="sealColor", к нему
   листает раздел «Конверт»). Кнопка «▶ Посмотреть, как откроется» на обложке
   проигрывает открытие; смена цвета печати показывает конверт закрытым на
   пару секунд. Движок в редакторе запускается только на время показа —
   скрытый конверт не греет телефон.

   Без WebGL2 конверта нет — сайт открывается как обычно. Так же при intro=0:
   анимация открытия не входит в тариф (бесплатный).
   ============================================================ */
(function () {
  'use strict';

  var script = document.currentScript;
  var attr = function (n, def) { return (script && script.getAttribute(n)) || def; };
  var BASE = (script && script.src ? script.src.replace(/[^/]*$/, '') : '/invite/assets/') + 'envelope3d/';
  var Q = new URLSearchParams(window.location.search);
  var EDITING = Q.get('editing') === '1';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SERIF = attr('data-serif', 'Cormorant Garamond');
  var WAXES = ['beige', 'ivory', 'gold', 'burgundy', 'sage', 'blue'];
  var root = document.documentElement;

  function hasGL2() {
    try {
      var gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return false;
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  }
  if (Q.get('intro') === '0' || !document.body || !hasGL2() || typeof Promise === 'undefined') {
    window.WCEnvelope = { active: false };
    return;
  }

  /* ─── Данные: имена → буквы печати и карточка, дата, цвет ─── */
  var D = {
    groom: (Q.get('groom') || attr('data-groom', '')).trim(),
    bride: (Q.get('bride') || attr('data-bride', '')).trim(),
    date: Q.get('date') || attr('data-date', ''),
    wax: attr('data-wax', 'beige')
  };
  var first = function (s) { return (s || '').trim().charAt(0).toUpperCase(); };
  var letters = function () { return [first(D.groom) || 'А', first(D.bride) || 'Д']; };
  var namesLine = function () { return [D.groom, D.bride].filter(Boolean).join(' & '); };
  var dateLine = function () {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(D.date || '');
    return m ? m[3] + ' · ' + m[2] + ' · ' + m[1] : '';
  };

  /* ─── Вид ─── */
  var css =
    'html.env-lock,html.env-lock body{overflow:hidden!important;height:100%}' +
    '.wc-env3d{position:fixed;inset:0;z-index:80;overflow:hidden;cursor:pointer;outline:none;' +
      'background:radial-gradient(120% 90% at 50% 45%,#f1ece4 0%,#d9d0c3 100%);' +
      'touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;' +
      'transition:opacity 1.3s ease}' +
    '.wc-env3d.is-out{opacity:0;pointer-events:none}' +
    '.wc-env3d__stage{position:absolute;top:0;bottom:0;left:50%;width:min(100%,calc(100vh * .62));' +
      'transform:translateX(-50%);overflow:hidden;background:#f3f0ea url("' + BASE + 'paper.webp") center/cover}' +
    '.wc-env3d__stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .45s ease}' +
    '.wc-env3d__hint{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity .5s ease}' +
    '.wc-env3d.is-ready canvas,.wc-env3d.is-ready .wc-env3d__hint{opacity:1}' +
    '.wc-env3d.is-opening .wc-env3d__hint{opacity:0}' +
    '.wc-env3d__hand{animation:wcEnvTap 1.9s ease-in-out infinite}' +
    '@keyframes wcEnvTap{0%,100%{transform:translateY(0)}45%{transform:translateY(3px)}}' +
    '.wc-env3d--preview{cursor:default;touch-action:auto}' +
    '@media (prefers-reduced-motion:reduce){.wc-env3d__hand{animation:none}}';
  var st = document.createElement('style');
  st.textContent = css;
  (document.head || root).appendChild(st);

  // Каллиграфия печати и карточки — Great Vibes; подпись — шрифт шаблона
  function ensureFontCss(file) {
    if (document.querySelector('link[href*="' + file + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = '/invite/assets/fonts/google/' + file;
    (document.head || root).appendChild(l);
  }
  ensureFontCss('09cf634f97cd1e649801.css');                          // Great Vibes (+ Old Standard TT)
  if (SERIF === 'Cormorant Garamond') ensureFontCss('000cb0ed3e9570f8d8a7.css');

  var el = document.createElement('div');
  el.className = 'wc-env3d' + (EDITING ? ' wc-env3d--preview' : '');
  if (EDITING) {
    el.setAttribute('data-edit', 'sealColor');
  } else {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Открыть приглашение');
  }
  el.innerHTML = '<div class="wc-env3d__stage"><canvas></canvas><svg class="wc-env3d__hint" aria-hidden="true"></svg></div>';
  document.body.insertBefore(el, document.body.firstChild);
  el.setAttribute('data-wc-section', 'envelope');
  var stage = el.querySelector('.wc-env3d__stage');
  var hint = el.querySelector('.wc-env3d__hint');
  // Редактор: слой поверх обложки и кнопка показа на ней (общий модуль)
  var IP = EDITING && window.WCIntroPreview && window.WCIntroPreview.on ? window.WCIntroPreview : null;
  if (EDITING) {
    if (IP) IP.layer(el);
    else el.style.display = 'none';
  }

  window.WCEnvelope = {
    active: !EDITING,
    setEnabled: function (enabled) { if (!enabled && !EDITING) reveal(); }
  };
  if (!EDITING) root.classList.add('env-lock');

  /* ─── Открытие ─── */
  var engine = null, phase = 'closed';           // closed → opening → done
  var wantOpen = false, waitTimer = 0;

  function reveal() {
    if (EDITING || phase === 'done') return;
    phase = 'done';
    window.WCEnvelope.active = false;
    try { window.dispatchEvent(new Event('wc:envelope-open')); }
    catch (e) {
      var ev = document.createEvent('Event');
      ev.initEvent('wc:envelope-open', false, false);
      window.dispatchEvent(ev);
    }
    root.classList.remove('env-lock');
    el.classList.add('is-out');
    setTimeout(function () {
      if (engine) { engine.destroy(); engine = null; }
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1450);
  }

  function beginOpen() {
    phase = 'opening';
    el.classList.add('is-opening');
    engine.open();
  }

  function open(e) {
    if (e && e.type === 'keydown') e.preventDefault();
    if (EDITING) return;
    if (phase === 'opening') { reveal(); return; }   // второе касание — пропустить
    if (phase !== 'closed') return;
    if (REDUCED) { reveal(); return; }               // «меньше движения» — сразу сайт
    if (!engine) {
      // 3D ещё грузится: откроем, как только будет готов, но ждать не дольше 2,5 с;
      // повторное касание во время ожидания — сразу сайт
      if (wantOpen) { reveal(); return; }
      wantOpen = true;
      waitTimer = setTimeout(reveal, 2500);
      return;
    }
    beginOpen();
  }

  /* ─── Редактор: показ на обложке ─── */
  var mounting = null, previewDone = null, mountVersion = 0;
  function ensure() {
    if (!mounting) {
      var attempt = mount().catch(function (err) {
        if (mounting === attempt) mounting = null;
        throw err;
      });
      mounting = attempt;
    }
    return mounting;
  }
  function release() {
    mountVersion += 1; // A pending import/image load may finish after the preview was hidden.
    if (engine) { engine.destroy(); engine = null; }
    mounting = null;
    el.classList.remove('is-ready', 'is-opening', 'is-out');
  }
  // Закрытый конверт поверх обложки → открытие, как у гостя → растворяется над обложкой
  function preview(done) {
    if (phase !== 'closed') { done(); return; }
    phase = 'opening';
    previewDone = done;
    IP.show(true);
    var shownAt = Date.now();
    ensure().then(function (api) {
      // дать рассмотреть закрытый конверт
      setTimeout(function () {
        if (engine !== api || phase !== 'opening') return;
        el.classList.add('is-opening');
        api.open();
      }, Math.max(300, 1000 - (Date.now() - shownAt)));
    }, finishPreview);
  }
  function previewReveal() {
    el.classList.add('is-out');
    setTimeout(finishPreview, 1350);
  }
  function finishPreview() {
    IP.show(false);
    release();
    phase = 'closed';
    var d = previewDone;
    previewDone = null;
    if (d) d();
  }
  if (IP) {
    IP.onPeek = function () { if (phase === 'closed') ensure().catch(function () {}); };
    IP.onPeekEnd = function () { if (phase === 'closed') release(); };
  }

  if (!EDITING) {
    el.addEventListener('click', open);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') open(e);
    });
    // Пока конверт закрыт, страница под ним не прокручивается
    el.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    el.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
  } else if (IP) {
    IP.button(preview);
  }

  /* ─── Данные редактора и страницы гостя ─── */
  var seenData = false;
  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin || e.source !== window.parent) return;
    var p = e.data && e.data.type === 'wc:data' && e.data.payload;
    if (!p) return;
    var first = !seenData;
    seenData = true;
    var lettersChanged = false, cardChanged = false;
    ['groom', 'bride'].forEach(function (k) {
      var v = p[k + 'Name'];
      if (typeof v === 'string' && v.trim() && v.trim() !== D[k]) {
        D[k] = v.trim(); lettersChanged = cardChanged = true;
      }
    });
    if (typeof p.weddingDate === 'string' && p.weddingDate && p.weddingDate !== D.date) { D.date = p.weddingDate; cardChanged = true; }
    var waxChanged = typeof p.sealColor === 'string' && WAXES.indexOf(p.sealColor) >= 0 && p.sealColor !== D.wax;
    if (waxChanged) D.wax = p.sealColor;
    // пара сменила цвет печати или имена — показать конверт закрытым
    if ((waxChanged || lettersChanged) && !first && IP) IP.peek(3200);
    if (!engine) return;                       // движок возьмёт свежие D при запуске
    if (lettersChanged) engine.setInitials(letters()[0], letters()[1]);
    if (cardChanged) engine.setNames(namesLine(), dateLine());
    if (waxChanged) engine.setWax(D.wax);
  });

  /* ─── Запуск движка ─── */
  function mount() {
    var version = mountVersion;
    var mountedWith = null;
    return import(BASE + 'engine.js').then(function (m) {
      mountedWith = { l: letters().join(''), n: namesLine(), d: dateLine(), w: D.wax };
      return m.mountEnvelope(stage, {
        base: BASE,
        letters: letters(),
        wax: D.wax,
        names: namesLine(),
        date: dateLine(),
        serifFont: SERIF,
        onLayout: function (L) { m.drawHint(hint, L, { font: SERIF }); },
        onReveal: EDITING ? previewReveal : reveal,
        onEnd: null
      });
    }).then(function (api) {
      if ((EDITING && version !== mountVersion) || (!EDITING && phase === 'done')) { api.destroy(); return api; }
      engine = api;
      // Данные, пришедшие, пока движок грузил шрифты и бумагу (цвет печати у гостя
      // приходит только сообщением от обёртки)
      if (letters().join('') !== mountedWith.l) api.setInitials(letters()[0], letters()[1]);
      if (namesLine() !== mountedWith.n || dateLine() !== mountedWith.d) api.setNames(namesLine(), dateLine());
      if (D.wax !== mountedWith.w) api.setWax(D.wax);
      el.classList.add('is-ready');
      if (wantOpen) { clearTimeout(waitTimer); beginOpen(); }
      return api;
    });
  }

  // Гость — сразу; редактор — по кнопке (ensure)
  if (!EDITING) {
    mount().catch(function (err) {
      // Не смогли показать конверт — не держим гостя: сразу сайт
      if (window.console) console.warn('Конверт не запустился:', err);
      reveal();
    });
  }
})();
