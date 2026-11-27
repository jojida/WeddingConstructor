/* ============================================================
   ENVELOPE-FLAP.JS — первый экран: тёплый бумажный конверт, клапан
   поднимается вверх вместе с сургучной печатью-монограммой.

   Был React-компонентом обёртки «Цветущего» (components/WeddingEnvelope.tsx);
   с 27.11.26 — общий модуль внутри страницы шаблона, его можно поставить
   любому шаблону (../assets/intro-choice.js). Вид перенесён один в один:
   палитра конверта, бумага, зерно и виньетка, клапан 2,8 с, печать с
   тиснёной монограммой (первые буквы невесты и жениха — как было).

   Подключает intro-choice.js (data-own="flap" у «Цветущего» или выбор пары);
   data-groom / data-bride — имена-образцы, data-hint — надпись снизу.
   Цвет печати — customData.sealColor (SEAL_COLORS: beige ivory gold pink
   burgundy brown sage blue; по умолчанию brown — как было у «Цветущего»):
   картинки envelope-flap/seal-<цвет>.webp, их делает
   scripts/generate-seal-colors.py.

   Гость: конверт поверх сайта. Касание — клапан поднимается, через 3,2 с
   конверт тает, под ним сайт. Второе касание — пропустить. Договор с
   script.js шаблона — как у всех конвертов: window.WCEnvelope.active = true,
   пока конверт закрыт; событие 'wc:envelope-open', когда обложке пора
   появляться.

   Редактор (editing=1): обложка готовая, конверт — скрытый слой ровно поверх
   обложки (../assets/intro-preview.js). Кнопка «▶ Посмотреть, как откроется»
   проигрывает открытие (у обложки с анимацией — потом и её, WCHero.replay);
   смена цвета печати или имён показывает конверт закрытым на пару секунд.
   intro=0 — анимация открытия не входит в тариф (бесплатный): конверта нет.
   ============================================================ */
(function () {
  'use strict';

  var CH = window.WCIntroChoice;
  if (CH && CH.style !== 'flap') return;          // выбрана другая заставка — не наш конверт

  var script = document.currentScript;
  var attr = function (n, def) { return (script && script.getAttribute(n)) || def; };
  var BASE = (script && script.src ? script.src.replace(/[^/]*$/, '') : '/invite/assets/') + 'envelope-flap/';
  var Q = new URLSearchParams(window.location.search);
  var EDITING = Q.get('editing') === '1';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  if (!document.body || Q.get('intro') === '0') { window.WCEnvelope = { active: false }; return; }

  var SEALS = ['beige', 'ivory', 'gold', 'pink', 'burgundy', 'brown', 'sage', 'blue'];
  // Тиснение букв: тон воска в глубине, рассеянный свет и блик — под каждый цвет печати
  var INK = {
    beige:    ['#5a4630', '#b39b76', '#e0cfae'],
    ivory:    ['#6d6556', '#c9bfab', '#efe7d8'],
    gold:     ['#5a3d12', '#b38641', '#e7c68a'],
    pink:     ['#6e3a3d', '#c48a8c', '#ecc3c3'],
    burgundy: ['#24050a', '#7a2531', '#b0525e'],
    brown:    ['#281f18', '#6e523c', '#8c6c50'],
    sage:     ['#3c4434', '#8a9678', '#c4ccb3'],
    blue:     ['#34455f', '#7f9bbf', '#c4d4e8']
  };
  var pickSeal = function (v) { return SEALS.indexOf(v) >= 0 ? v : ''; };

  var D = {
    groom: (Q.get('groom') || attr('data-groom', '')).trim(),
    bride: (Q.get('bride') || attr('data-bride', '')).trim(),
    hint: attr('data-hint', 'Нажмите, чтобы открыть'),
    seal: pickSeal(CH && CH.seal) || pickSeal(attr('data-seal', '')) || 'brown'
  };
  var first = function (s) { return (s || '').trim().charAt(0).toUpperCase(); };

  // Монограмма — Marck Script, надпись — Cormorant Garamond (как у «Цветущего»)
  function ensureFontCss(file) {
    if (document.querySelector('link[href*="' + file + '"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = '/invite/assets/fonts/google/' + file;
    (document.head || root).appendChild(l);
  }
  ensureFontCss('758c70af13ec1d31ff6b.css');
  ensureFontCss('000cb0ed3e9570f8d8a7.css');

  /* ─── Вид: палитра «Цветущего» (oklch из WeddingEnvelope.tsx → sRGB) ─── */
  var C = { hi: '#dbad8c', mid: '#c08b69', lo: '#a16c4e', deep: '#6c412a', seam: '#512d1c', inner: '#3d2013', hint: '#ecd2be' };
  var EASE = 'cubic-bezier(.45,.05,.2,1)';
  var GRAIN = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'160\'><filter id=\'n\'>' +
    '<feTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'2\' stitchTiles=\'stitch\'/>' +
    '<feColorMatrix values=\'0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0\'/></filter>' +
    '<rect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/></svg>")';

  var css =
    'html.wc-flap-lock,html.wc-flap-lock body{overflow:hidden!important;height:100%}' +
    '.wc-flap{position:fixed;inset:0;z-index:90;overflow:hidden;cursor:pointer;outline:none;background:' + C.deep + ';' +
      '--seal:min(44vh,520px);touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;' +
      'transition:opacity .65s ease}' +
    '.wc-flap--preview{cursor:default;touch-action:auto;container-type:size;--seal:min(44cqh,520px)}' +
    '.wc-flap.is-out{opacity:0;pointer-events:none}' +
    '.wc-flap.is-snap,.wc-flap.is-snap *{transition:none!important}' +
    '.wc-flap>div,.wc-flap__base>div,.wc-flap__base>svg{position:absolute;inset:0}' +
    '.wc-flap__grain{z-index:30;pointer-events:none;opacity:.13;mix-blend-mode:overlay;background-image:' + GRAIN + '}' +
    '.wc-flap__vignette{z-index:25;pointer-events:none;background:radial-gradient(ellipse 85% 75% at 50% 50%,transparent 40%,rgba(0,0,0,.55) 100%)}' +
    '.wc-flap__base{z-index:5}' +
    '.wc-flap__bg{background:radial-gradient(ellipse 90% 80% at 50% 50%,' + C.mid + ' 0%,' + C.lo + ' 60%,' + C.deep + ' 100%)}' +
    '.wc-flap__paper{background:url("' + BASE + 'paper.jpg") center/cover;mix-blend-mode:multiply;opacity:.45}' +
    '.wc-flap__base>svg{width:100%;height:100%}' +
    '.wc-flap .wc-flap__inner{bottom:50%;z-index:4;background:linear-gradient(180deg,' + C.inner + ' 0%,' + C.deep + ' 80%);' +
      'clip-path:polygon(0 0,100% 0,50% 100%);opacity:0;transition:opacity 1.2s ease .8s}' +
    '.wc-flap.is-open .wc-flap__inner{opacity:1}' +
    '.wc-flap .wc-flap__lid{bottom:50%;z-index:10;transform-origin:50% 0;transform-style:preserve-3d;' +
      'transition:transform 2.8s ' + EASE + ',filter .8s;filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))}' +
    '.wc-flap.is-open .wc-flap__lid{transform:rotateX(-90deg);filter:drop-shadow(0 30px 40px rgba(0,0,0,.65))}' +
    '.wc-flap__lid>svg{position:absolute;inset:0;width:100%;height:100%;backface-visibility:hidden;-webkit-backface-visibility:hidden;' +
      'clip-path:polygon(0 0,100% 0,50% 100%)}' +
    '.wc-flap__lid>svg.is-back{transform:rotateX(180deg)}' +
    // печать — на кончике клапана и уходит вместе с ним
    '.wc-flap__seal{position:absolute;left:50%;top:100%;pointer-events:none;transform-style:preserve-3d;' +
      'backface-visibility:hidden;-webkit-backface-visibility:hidden;' +
      'transform:translate(-50%,-50%) translateZ(2px) rotate(-4deg);transition:transform 2.8s ' + EASE + '}' +
    '.wc-flap.is-open .wc-flap__seal{transform:translate(-50%,calc(-50% - 18px)) translateZ(2px) scale(1.08) rotate(-4deg) rotateX(-28deg) rotateY(6deg)}' +
    '.wc-flap__seal img{display:block;width:var(--seal);height:auto;' +
      'filter:drop-shadow(0 2px 3px rgba(255,200,160,.15)) drop-shadow(0 6px 12px rgba(0,0,0,.45)) drop-shadow(0 20px 28px rgba(0,0,0,.28))}' +
    '.wc-flap__mono{position:absolute;inset:0;width:100%;height:100%;overflow:visible}' +
    '.wc-flap__mono text{font-family:"Marck Script",cursive}' +
    '.wc-flap__hint{position:absolute;left:0;right:0;bottom:2.5rem;z-index:22;margin:0;text-align:center;pointer-events:none;' +
      'font:10px/1.4 "Cormorant Garamond",Georgia,serif;text-transform:uppercase;letter-spacing:.5em;color:' + C.hint + ';' +
      'opacity:0;animation:wcFlapHint .6s ease 1.2s forwards;transition:opacity .6s ease}' +
    '@keyframes wcFlapHint{to{opacity:.75}}' +
    '.wc-flap.is-open .wc-flap__hint{animation:none;opacity:0}' +
    '@media (prefers-reduced-motion:reduce){.wc-flap,.wc-flap *{transition-duration:.01s!important}}';
  var st = document.createElement('style');
  st.textContent = css;
  (document.head || root).appendChild(st);

  /* ─── Разметка ─── */
  var uid = 'wcFlap' + Math.random().toString(36).slice(2, 7);
  var el = document.createElement('div');
  el.className = 'wc-flap' + (EDITING ? ' wc-flap--preview' : '');
  el.setAttribute('data-wc-section', 'envelope');
  if (EDITING) {
    el.setAttribute('data-edit', 'sealColor');
  } else {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Открыть приглашение');
  }
  var line = function (x1, y1, x2, y2, w, o) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + C.seam + '" stroke-width="' + w + '" stroke-opacity="' + o + '"/>';
  };
  var grad = function (id, x1, y1, x2, y2, stops) {
    return '<linearGradient id="' + uid + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join('') +
      '</linearGradient>';
  };
  var url = function (id) { return 'url(#' + uid + id + ')'; };
  el.innerHTML =
    '<div class="wc-flap__grain"></div>' +
    '<div class="wc-flap__vignette"></div>' +
    '<div class="wc-flap__base">' +
      '<div class="wc-flap__bg"></div><div class="wc-flap__paper"></div>' +
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><defs>' +
        grad('tl', 0, 0, 1, 1, [['20%', C.deep, 0], ['100%', C.deep, .22]]) +
        grad('tr', 1, 0, 0, 1, [['20%', C.deep, 0], ['100%', C.deep, .22]]) +
      '</defs>' +
      '<polygon points="0,0 50,50 0,100" fill="' + url('tl') + '"/><polygon points="100,0 50,50 100,100" fill="' + url('tr') + '"/>' +
      line(0, 0, 50, 50, .12, .35) + line(100, 0, 50, 50, .12, .35) + line(0, 100, 50, 50, .12, .35) + line(100, 100, 50, 50, .12, .35) +
      '</svg>' +
      '<div class="wc-flap__inner"></div>' +
    '</div>' +
    '<div class="wc-flap__lid">' +
      '<svg viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true"><defs>' +
        '<pattern id="' + uid + 'fp" patternUnits="userSpaceOnUse" width="100" height="50">' +
          '<image href="' + BASE + 'paper.jpg" x="0" y="0" width="100" height="50" preserveAspectRatio="xMidYMid slice"/></pattern>' +
        grad('fg', 0, 0, 0, 1, [['0%', C.hi], ['55%', C.mid], ['100%', C.lo]]) +
        '<radialGradient id="' + uid + 'fs" cx="35%" cy="18%" r="60%"><stop offset="0%" stop-color="#fff" stop-opacity=".2"/>' +
          '<stop offset="70%" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
        grad('fl', 0, 0, 1, 1, [['30%', C.deep, 0], ['100%', C.deep, .18]]) +
        grad('fr', 1, 0, 0, 1, [['30%', C.deep, 0], ['100%', C.deep, .18]]) +
        grad('ft', 0, 0, 0, 1, [['60%', C.deep, 0], ['100%', C.deep, .38]]) +
      '</defs>' +
      '<rect width="100" height="50" fill="' + url('fg') + '"/>' +
      '<rect width="100" height="50" fill="' + url('fp') + '" opacity=".45" style="mix-blend-mode:multiply"/>' +
      '<polygon points="0,0 50,50 50,0" fill="' + url('fl') + '"/><polygon points="100,0 50,50 50,0" fill="' + url('fr') + '"/>' +
      '<rect width="100" height="50" fill="' + url('ft') + '"/><rect width="100" height="50" fill="' + url('fs') + '"/>' +
      line(0, 0, 50, 50, .14, .3) + line(100, 0, 50, 50, .14, .3) +
      '</svg>' +
      '<svg class="is-back" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true"><defs>' +
        '<pattern id="' + uid + 'bp" patternUnits="userSpaceOnUse" width="100" height="50">' +
          '<image href="' + BASE + 'paper.jpg" x="0" y="0" width="100" height="50" preserveAspectRatio="xMidYMid slice"/></pattern>' +
        grad('bi', 0, 0, 0, 1, [['0%', C.lo], ['100%', C.mid]]) +
      '</defs>' +
      '<rect width="100" height="50" fill="' + url('bi') + '"/>' +
      '<rect width="100" height="50" fill="' + url('bp') + '" opacity=".5" style="mix-blend-mode:multiply"/>' +
      '</svg>' +
      '<div class="wc-flap__seal">' +
        '<img alt="" draggable="false">' +
        '<svg class="wc-flap__mono" viewBox="0 0 100 100" aria-hidden="true"><defs>' +
          // тиснение: рельеф по альфе букв, свет сверху слева (как у WeddingEnvelope)
          '<filter id="' + uid + 'em" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">' +
            '<feGaussianBlur in="SourceAlpha" stdDeviation="1.1" result="blur"/>' +
            '<feDiffuseLighting in="blur" surfaceScale="5" diffuseConstant=".7" lighting-color="#6e523c" result="diffuse">' +
              '<fePointLight x="25" y="18" z="55"/></feDiffuseLighting>' +
            '<feComposite in="diffuse" in2="SourceAlpha" operator="in" result="diffClip"/>' +
            '<feSpecularLighting in="blur" surfaceScale="5" specularConstant=".35" specularExponent="22" lighting-color="#8c6c50" result="specular">' +
              '<fePointLight x="25" y="18" z="55"/></feSpecularLighting>' +
            '<feComposite in="specular" in2="SourceAlpha" operator="in" result="specClip"/>' +
            '<feFlood flood-color="#281f18" result="waxColor"/>' +
            '<feComposite in="waxColor" in2="SourceAlpha" operator="in" result="waxBase"/>' +
            '<feBlend in="waxBase" in2="diffClip" mode="screen" result="withDiff"/>' +
            '<feBlend in="withDiff" in2="specClip" mode="screen" result="lit"/>' +
            '<feDropShadow dx=".3" dy=".5" stdDeviation=".4" flood-color="rgba(0,0,0,.75)"/>' +
          '</filter></defs>' +
          '<text x="50" y="55" text-anchor="middle" dominant-baseline="middle" font-size="26" letter-spacing="1" filter="' + url('em') + '"></text>' +
        '</svg>' +
      '</div>' +
    '</div>' +
    '<p class="wc-flap__hint"></p>';
  document.body.insertBefore(el, document.body.firstChild);

  var sealImg = el.querySelector('.wc-flap__seal img');
  var mono = el.querySelector('.wc-flap__mono text');
  var hintEl = el.querySelector('.wc-flap__hint');
  var lights = {
    flood: el.querySelector('feFlood'),
    diffuse: el.querySelector('feDiffuseLighting'),
    specular: el.querySelector('feSpecularLighting')
  };

  // Редактор: слой поверх обложки и кнопка показа на ней (общий модуль)
  var IP = EDITING && window.WCIntroPreview && window.WCIntroPreview.on ? window.WCIntroPreview : null;
  if (EDITING) {
    if (IP) IP.layer(el);
    else el.style.display = 'none';
  }

  function render() {
    // как было у «Цветущего»: сначала буква невесты, потом жениха
    mono.textContent = (first(D.bride) || 'О') + (first(D.groom) || 'С');
    hintEl.textContent = D.hint;
    if (!EDITING) el.setAttribute('aria-label', D.hint || 'Открыть приглашение');
    var src = BASE + 'seal-' + D.seal + '.webp';
    if (sealImg.getAttribute('src') !== src) sealImg.setAttribute('src', src);
    var ink = INK[D.seal] || INK.brown;
    lights.flood.setAttribute('flood-color', ink[0]);
    lights.diffuse.setAttribute('lighting-color', ink[1]);
    lights.specular.setAttribute('lighting-color', ink[2]);
    mono.setAttribute('fill', ink[0]);
  }
  render();

  window.WCEnvelope = {
    active: !EDITING,
    setEnabled: function (enabled) { if (!enabled && !EDITING) reveal(true); }
  };
  if (!EDITING) root.classList.add('wc-flap-lock');

  /* ─── Открытие ─── */
  var OPEN_MS = 3200;              // клапан 2,8 с + пауза, как у WeddingEnvelope
  var phase = 'closed';            // closed → opening → done
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function fireOpen() {
    if (fireOpen.done) return;
    fireOpen.done = true;
    window.WCEnvelope.active = false;
    root.classList.remove('wc-flap-lock');
    try { window.dispatchEvent(new Event('wc:envelope-open')); }
    catch (e) {
      var ev = document.createEvent('Event');
      ev.initEvent('wc:envelope-open', false, false);
      window.dispatchEvent(ev);
    }
  }

  // Убрать конверт: сразу (пара выключила раздел, «меньше движения», второе касание) или растаять
  function reveal(instant) {
    if (EDITING || phase === 'done') return;
    phase = 'done';
    timers.forEach(clearTimeout);
    fireOpen();
    if (instant || REDUCED) {
      if (el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    el.classList.add('is-out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 700);
  }

  function open(e) {
    if (e && e.type === 'keydown') e.preventDefault();
    if (EDITING) return;
    if (phase === 'opening') { reveal(true); return; }   // второе касание — пропустить
    if (phase !== 'closed') return;
    if (REDUCED) { reveal(true); return; }
    phase = 'opening';
    el.classList.add('is-open');
    later(function () { reveal(false); }, OPEN_MS);
  }

  // Редактор: закрытый конверт поверх обложки → открытие, как у гостя → обложка
  // (и её анимация, если у шаблона она есть — WCHero.replay)
  function preview(done) {
    if (phase !== 'closed') { done(); return; }
    phase = 'opening';
    IP.show(true);
    later(function () { el.classList.add('is-open'); }, 900);
    later(function () { el.classList.add('is-out'); }, 900 + OPEN_MS);
    later(function () {
      IP.show(false);
      el.classList.add('is-snap');
      el.classList.remove('is-open', 'is-out');
      void el.offsetWidth;
      el.classList.remove('is-snap');
      phase = 'closed';
      var hero = window.WCHero && window.WCHero.replay;
      if (hero) hero(done); else done();
    }, 900 + OPEN_MS + 650);
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
    var firstData = !seenData;
    seenData = true;
    var changed = false;
    ['groom', 'bride'].forEach(function (k) {
      var v = p[k + 'Name'];
      if (typeof v === 'string' && v.trim() && v.trim() !== D[k]) { D[k] = v.trim(); changed = true; }
    });
    if (typeof p.envelopeHint === 'string') {
      var h = p.envelopeHint.trim() || attr('data-hint', 'Нажмите, чтобы открыть');
      if (h !== D.hint) { D.hint = h; changed = true; }
    }
    if (typeof p.sealColor === 'string') {
      var s = pickSeal(p.sealColor) || 'brown';
      if (s !== D.seal) { D.seal = s; changed = true; }
    }
    if (changed) render();
    if (changed && !firstData && IP) IP.peek(3200);
  });
})();
