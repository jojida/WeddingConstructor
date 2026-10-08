/* ============================================================
   INTRO-PREVIEW.JS — анимация открытия в редакторе.

   Гость видит заставку (конверт, двери, видео) поверх сайта. В редакторе
   (editing=1) обложка сразу готовая, а заставка играет по кнопке
   «▶ Посмотреть, как откроется» — прямо на обложке и не выходя за её края.
   У всех шаблонов одинаково.

   Подключение — в <head>, до модулей заставки:
     <script src="../assets/intro-preview.js"></script>

   WCIntroPreview.on           — показ есть (редактор и анимация входит в тариф)
   WCIntroPreview.layer(el)    — элемент заставки становится слоем ровно поверх
                                 обложки; скрыт, пока не идёт показ
   WCIntroPreview.show(on)     — показать / скрыть слои
   WCIntroPreview.peek(ms)     — показать закрытую заставку на пару секунд:
                                 пара поменяла её поле (цвет печати, надпись)
   WCIntroPreview.button(play) — кнопка на обложке; play(done) проигрывает
                                 заставку и зовёт done() в конце

   Кнопки нет при intro=0 (анимация не входит в тариф). Кнопка и слои
   помечены data-wc-section="envelope": выключили раздел «Конверт» —
   sections.js прячет и их. Редактор подсвечивает раздел (wc-editor-flash
   на слое или внутри него) — заставка показывается закрытой.
   ============================================================ */
(function () {
  'use strict';
  if (window.WCIntroPreview) return;

  var Q = new URLSearchParams(window.location.search);
  var ON = Q.get('editing') === '1' && Q.get('intro') !== '0';

  var layers = [], btn = null, playFn = null, cover = null;
  var playing = false, peekTimer = 0;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function getCover() {
    return cover || (cover = document.querySelector('[data-wc-section="cover"]'));
  }

  if (ON) {
    var st = document.createElement('style');
    st.textContent =
      // html … — сильнее правил шаблонов вида «.cover > *»
      'html .wc-ip{position:absolute;left:50%;bottom:var(--wc-ip-bottom,8%);z-index:60;transform:translateX(-50%);' +
        'display:inline-flex;align-items:center;gap:8px;margin:0;width:auto;height:auto;' +
        'font:500 14px/1 system-ui,-apple-system,"Segoe UI",sans-serif;letter-spacing:0;text-transform:none;' +
        'color:#4a4038;background:rgba(255,255,255,.94);border:1px solid rgba(74,64,56,.22);border-radius:999px;' +
        'padding:10px 18px;cursor:pointer;box-shadow:0 4px 16px rgba(30,24,18,.2);white-space:nowrap;' +
        'transition:opacity .3s ease}' +
      'html .wc-ip:hover{background:#fff}' +
      'html .wc-ip[disabled]{opacity:0;pointer-events:none}' +
      'html .wc-ip-layer{position:absolute;inset:0;width:auto;height:auto;margin:0;z-index:55;overflow:hidden;' +
        'visibility:hidden;pointer-events:none}' +
      'html .wc-ip-layer.wc-ip-on{visibility:visible}' +
      // скрытая заставка не крутит свои анимации впустую
      'html .wc-ip-layer:not(.wc-ip-on),html .wc-ip-layer:not(.wc-ip-on) *{animation-play-state:paused!important}' +
      '@media print{html .wc-ip,html .wc-ip-layer{display:none}}';
    (document.head || document.documentElement).appendChild(st);
  }

  // Подсветка редактора на слое или внутри него — показать закрытую заставку
  var FLASH = /(^|\s)wc-editor-flash(\s|$)/;
  var flashWatch = ('MutationObserver' in window) ? new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (FLASH.test(r.target.getAttribute('class') || '') && !FLASH.test(r.oldValue || '')) { peek(3600); return; }
    }
  }) : null;

  function place() {
    var c = getCover();
    if (!c) return;
    layers.forEach(function (el) {
      if (el.parentNode !== c) c.appendChild(el);
    });
    if (btn && btn.parentNode !== c) c.appendChild(btn);
  }
  // Обложка уже на странице (скрипт в конце <body>) — сразу, иначе (модуль
  // в начале <body>) — когда разметка дочитана
  function placeSoon() {
    if (getCover()) place(); else ready(place);
  }

  function layer(el) {
    if (!ON || !el) return el;
    el.classList.add('wc-ip-layer');
    el.setAttribute('data-wc-section', 'envelope');
    el.removeAttribute('role');
    el.removeAttribute('tabindex');
    el.setAttribute('aria-hidden', 'true');
    if (layers.indexOf(el) < 0) layers.push(el);
    if (flashWatch) flashWatch.observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true, subtree: true });
    placeSoon();
    return el;
  }

  function show(on) {
    layers.forEach(function (el) { el.classList.toggle('wc-ip-on', !!on); });
  }

  function peek(ms) {
    if (!ON || playing || !layers.length) return;
    show(true);
    clearTimeout(peekTimer);
    peekTimer = setTimeout(function () { if (!playing) { show(false); if (api.onPeekEnd) api.onPeekEnd(); } }, ms || 2600);
    if (api.onPeek) api.onPeek();
  }

  function play() {
    if (!playFn || playing) return;
    playing = true;
    clearTimeout(peekTimer);
    if (btn) btn.disabled = true;
    // Обложка целиком в кадре — заставка играет на ней
    var c = getCover();
    if (c) {
      var top = c.getBoundingClientRect().top + (window.pageYOffset || 0);
      if (Math.abs((window.pageYOffset || 0) - top) > 2) window.scrollTo(0, Math.max(0, top));
    }
    var finished = false;
    playFn(function done() {
      if (finished) return;
      finished = true;
      playing = false;
      if (btn) btn.disabled = false;
    });
  }

  function button(fn, label) {
    if (!ON) return null;
    playFn = fn;
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wc-ip';
      btn.setAttribute('data-wc-section', 'envelope');
      btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); play(); });
    }
    btn.textContent = '▶ ' + (label || 'Посмотреть, как откроется');
    placeSoon();
    return btn;
  }

  var api = {
    on: ON,
    layer: layer,
    show: show,
    peek: peek,
    button: button,
    play: play,
    isPlaying: function () { return playing; },
    onPeek: null,
    onPeekEnd: null
  };
  window.WCIntroPreview = api;
})();
