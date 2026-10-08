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

   В редакторе (editing=1) конверта нет: паре нужен сам сайт.
   intro=0 — анимация открытия не входит в тариф (бесплатный): тоже без конверта.
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

  if (EDITING || NO_INTRO) {
    env.parentNode.removeChild(env);
    window.WCEnvelope = { active: false };
    return;
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
