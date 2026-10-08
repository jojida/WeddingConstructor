/* ============================================================
   ENVELOPE.JS — первый экран шаблона: видео раскрытия конверта
   (сейчас только у «Вечера в саду»).

   Гость видит закрытый конверт (первый кадр видео) и подсказку.
   Касание — видео играет, в конце конверт заливается тёплым светом
   и растворяется, под ним проявляется обложка. Повторное касание во
   время видео — пропустить. Касание же включает музыку (music.js).

   Разметка в шаблоне: #envelope (оверлей) и внутри #envelopeVideo,
   вид — стилями шаблона. Позже этот файл заменит анимация первого
   экрана — договор с script.js простой: пока конверт открыт,
   window.WCEnvelope.active = true; когда обложке пора появляться —
   событие 'wc:envelope-open'.

   В редакторе (editing=1) обложка готовая, а конверт — скрытый слой ровно
   поверх неё (../assets/intro-preview.js): WCEnvelope.preview(onReveal, onDone)
   проигрывает его по кнопке «▶ Посмотреть, как откроется» (её ставит script.js
   шаблона — после конверта у него идёт живое видео обложки).
   intro=0 — анимация открытия не входит в тариф (бесплатный): конверта нет.
   ============================================================ */
(function () {
  'use strict';

  var env = document.getElementById('envelope');
  if (!env) { window.WCEnvelope = { active: false }; return; }

  var Q = new URLSearchParams(window.location.search);
  var EDITING = Q.get('editing') === '1';
  var NO_INTRO = Q.get('intro') === '0';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  var video = document.getElementById('envelopeVideo');

  var IP = EDITING && !NO_INTRO && window.WCIntroPreview && window.WCIntroPreview.on ? window.WCIntroPreview : null;
  if (IP && video) {
    IP.layer(env);
    if (REDUCED || !(window.CSS && typeof window.CSS.registerProperty === 'function')) env.classList.add('no-iris');
    window.WCEnvelope = { active: false, preview: preview };
    return;
  }
  if (EDITING || NO_INTRO) {
    env.parentNode.removeChild(env);
    window.WCEnvelope = { active: false };
    return;
  }

  // Редактор: закрытый конверт поверх обложки → видео → свет раскрывается кругом,
  // под ним обложка (onReveal) → конверт снова спрятан (onDone)
  function preview(onReveal, onDone) {
    var lit = false, safetyT = 0, startT = 0;
    if (!video.getAttribute('src') && video.getAttribute('data-src')) video.src = video.getAttribute('data-src');
    env.classList.remove('is-playing', 'is-light', 'is-out');
    try { video.pause(); video.currentTime = 0; } catch (e) {}
    IP.show(true);
    function near() { if (video.duration && video.currentTime >= video.duration - 0.55) light(); }
    function light() {
      if (lit) return;
      lit = true;
      clearTimeout(safetyT);
      clearTimeout(startT);
      video.removeEventListener('timeupdate', near);
      video.removeEventListener('ended', light);
      video.removeEventListener('error', light);
      env.classList.add('is-light');
      setTimeout(function () {
        env.classList.add('is-out');
        if (onReveal) onReveal();
      }, REDUCED ? 120 : 760);
      setTimeout(function () {
        IP.show(false);
        env.classList.remove('is-playing', 'is-light', 'is-out');
        try { video.pause(); video.currentTime = 0; } catch (e) {}
        if (onDone) onDone();
      }, REDUCED ? 900 : 760 + 1900);
    }
    video.addEventListener('timeupdate', near);
    video.addEventListener('ended', light);
    video.addEventListener('error', light);
    // дать рассмотреть закрытый конверт, затем — как от касания гостя
    startT = setTimeout(function () {
      env.classList.add('is-playing');
      if (REDUCED || video.error) { light(); return; }
      var p;
      try { p = video.play(); } catch (err) { light(); return; }
      if (p && typeof p.catch === 'function') p.catch(light);
      safetyT = setTimeout(light, 7000);
    }, 700);
  }

  window.WCEnvelope = { active: true };
  // Attach only for guests: editing=1 must not fetch an invisible intro.
  if (video && video.getAttribute('data-src')) video.src = video.getAttribute('data-src');
  root.classList.add('env-lock');

  var state = 'idle';   // idle → playing → done
  var safety = 0;

  function reveal() {
    window.WCEnvelope.active = false;
    try { window.dispatchEvent(new Event('wc:envelope-open')); }
    catch (e) {
      var ev = document.createEvent('Event');
      ev.initEvent('wc:envelope-open', false, false);
      window.dispatchEvent(ev);
    }
  }

  // Круглое раскрытие света требует @property — иначе просто растворение
  if (REDUCED || !(window.CSS && typeof window.CSS.registerProperty === 'function')) env.classList.add('no-iris');

  // Свет заливает конверт → раскрывается кругом от центра, под ним обложка
  function finish() {
    if (state === 'done') return;
    state = 'done';
    clearTimeout(safety);
    env.classList.add('is-light');
    setTimeout(function () {
      root.classList.add('from-env');
      reveal();
      root.classList.remove('env-lock');
      env.classList.add('is-out');
    }, REDUCED ? 120 : 760);
    setTimeout(function () {
      if (env.parentNode) env.parentNode.removeChild(env);
      // видео больше не нужно — освобождаем память телефона
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
    }, REDUCED ? 900 : 2700);
  }

  function open(e) {
    if (e && e.type === 'keydown') e.preventDefault();
    if (state === 'playing') { finish(); return; }   // второе касание — пропустить
    if (state !== 'idle') return;
    state = 'playing';
    env.classList.add('is-playing');
    if (REDUCED || !video || video.error) { finish(); return; }
    var p;
    try { p = video.play(); } catch (err) { finish(); return; }
    if (p && typeof p.catch === 'function') p.catch(function () { finish(); });
    // Видео меньше двух секунд; зависло на медленной сети — открываем без него
    safety = setTimeout(finish, 7000);
  }

  if (video) {
    // Свет начинается чуть раньше последнего кадра — переход без паузы
    video.addEventListener('timeupdate', function () {
      if (state === 'playing' && video.duration && video.currentTime >= video.duration - 0.55) finish();
    });
    video.addEventListener('ended', finish);
    video.addEventListener('error', function () { if (state === 'playing') finish(); });
  }

  env.addEventListener('click', open);
  env.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') open(e);
  });
  // Пока конверт закрыт, страница под ним не прокручивается
  env.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  env.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
})();
