/* ============================================================
   MUSIC.JS — фоновая мелодия приглашения (общий модуль шаблонов).
   Подключается ДО script.js шаблона; script.js вызывает
   WCMusic.set(url) в applyData. Кнопка добавляется поверх дизайна
   и не влияет на вёрстку. Без url кнопки нет вовсе.
   ============================================================ */
(function () {
  'use strict';
  if (window.WCMusic) return;                 // защита от двойного подключения

  var audio = null, btn = null, src = '', playing = false, armed = false;
  // В редакторе музыка не должна включаться сама — пара правит текст в тишине.
  var EDITING = window.location.search.indexOf('editing=1') !== -1;

  var ICON_ON =
    '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>';
  var ICON_OFF =
    '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>' +
    '<line x1="3" y1="3" x2="21" y2="21" stroke-width="1.8"/></svg>';

  function render() {
    if (!btn) return;
    btn.innerHTML = playing ? ICON_ON : ICON_OFF;
    btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    btn.setAttribute('aria-label', playing ? 'Выключить музыку' : 'Включить музыку');
    btn.title = playing ? 'Выключить музыку' : 'Включить музыку';
    btn.style.opacity = playing ? '1' : '0.72';
  }

  function build() {
    if (audio) return;

    audio = document.createElement('audio');
    audio.loop = true;
    audio.preload = 'none';
    audio.setAttribute('playsinline', '');
    document.body.appendChild(audio);
    audio.addEventListener('play',  function () { playing = true;  render(); });
    audio.addEventListener('pause', function () { playing = false; render(); });

    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wc-music-btn';
    btn.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:9999',
      'width:44px', 'height:44px', 'border-radius:50%',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(255,255,255,.86)', '-webkit-backdrop-filter:blur(6px)', 'backdrop-filter:blur(6px)',
      'border:1px solid rgba(0,0,0,.08)', 'box-shadow:0 4px 16px rgba(0,0,0,.18)',
      'color:#2b2b2b', 'cursor:pointer', 'padding:0',
      'transition:opacity .2s ease, transform .2s ease'
    ].join(';');
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      armed = true;                            // ручное управление важнее автозапуска
      if (audio.paused) play(); else audio.pause();
    });
    document.body.appendChild(btn);
    render();
  }

  function play() {
    if (!audio || !audio.src) return;
    var p = audio.play();
    if (p && p.catch) p.catch(function () { /* браузер запретил автозапуск — ждём тап */ });
  }

  /* Автозапуск заблокирован во всех браузерах, пока не было жеста пользователя.
     Ловим первый тап/клавишу на странице и пробуем стартовать один раз. */
  function armAutoplay() {
    if (armed || EDITING) return;
    armed = true;
    var once = function () {
      document.removeEventListener('pointerdown', once);
      document.removeEventListener('keydown', once);
      if (audio && audio.paused) play();
    };
    document.addEventListener('pointerdown', once, { once: true });
    document.addEventListener('keydown', once, { once: true });
  }

  function teardown() {
    if (audio) { audio.pause(); audio.removeAttribute('src'); }
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    btn = null; src = ''; playing = false;
  }

  /** Задать мелодию. Пустое значение — убрать плеер. */
  function set(url) {
    url = (url || '').trim();
    if (!url) { if (src) teardown(); return; }
    if (url === src && audio) return;
    build();
    src = url;
    audio.src = url;
    audio.load();
    render();
    if (!EDITING) armAutoplay();
  }

  window.WCMusic = { set: set };
})();
