/* ============================================================
   SMOOTH-SCROLL.JS — мягкая прокрутка колесом мыши и тачпадом во всех
   шаблонах (27.11.26: «на всех шаблонах сделай прокрутку мягче и плавнее»).

   Вместо рывков по 100 px за щелчок колеса страница плавно догоняет цель:
   каждый щелчок сдвигает цель, а прокрутка идёт к ней с затуханием — доля
   LERP оставшегося пути за кадр (как у Lenis), поэтому быстрые прокрутки
   сливаются в одно мягкое движение и так же мягко останавливаются.

   Палец на телефоне — как был: у телефонов своя инерция, подделка под неё
   только хуже. Клавиатура — как была (браузер сам листает плавно).

   Не трогаем: Ctrl + колесо (масштаб), горизонтальную прокрутку, «меньше
   движения», страницу под замком (overflow: hidden — конверт ещё закрыт),
   прокрутку внутри блоков со своей прокруткой (карусели, списки), колесо,
   которое шаблон уже отменил сам (preventDefault). Чужая прокрутка —
   полоса прокрутки, якоря, scrollTo скриптов шаблона и редактора — главнее:
   увидели сдвиг не от нас — сразу уступаем.

   Предел для колеса шаблон может задать сам: window.WCScrollGate() —
   число (докуда можно листать вниз) или null. Так «Средиземноморье»
   держит страницу у кружков с датой, пока из них не стечёт вода.

   Подключение: <script src="../assets/smooth-scroll.js"></script> в конце
   <body> каждого шаблона.
   ============================================================ */
(function () {
  'use strict';
  if (window.WCSmoothScroll) return;

  var LERP = 0.1;                 // доля оставшегося пути за кадр 60 Гц
  var LINE = 33;                  // строка колеса в px (Firefox: 3 строки ≈ 100 px, как щелчок у Chrome)
  var root = document.documentElement;
  var reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  var raf = 0, target = 0, pos = 0, lastSet = -1, lastT = 0;

  function scrollY() { return window.pageYOffset || root.scrollTop || 0; }
  function maxY() {
    var s = document.scrollingElement || root;
    return Math.max(0, s.scrollHeight - window.innerHeight);
  }
  function hidden(el) {
    if (!el) return false;
    var o = window.getComputedStyle(el).overflowY;
    return o === 'hidden' || o === 'clip';
  }
  // Блок со своей прокруткой, которому есть куда листать в эту сторону
  function ownScroll(el, dy) {
    for (; el && el !== document.body && el !== root; el = el.parentElement) {
      if (el.nodeType !== 1 || el.scrollHeight <= el.clientHeight + 1) continue;
      var o = window.getComputedStyle(el).overflowY;
      if (o !== 'auto' && o !== 'scroll' && o !== 'overlay') continue;
      if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
    }
    return false;
  }
  function gate() {
    try { return typeof window.WCScrollGate === 'function' ? window.WCScrollGate() : null; } catch (e) { return null; }
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    // scroll-behavior: smooth у некоторых шаблонов — возвращаем, как было в стилях
    root.style.scrollBehavior = '';
  }

  function frame(t) {
    raf = 0;
    var cur = scrollY();
    // Страницу сдвинули не мы (полоса прокрутки, якорь, скрипт) — уступаем
    if (lastSet >= 0 && Math.abs(cur - lastSet) > 1.5) { stop(); return; }
    var dt = lastT ? Math.min(64, t - lastT) : 16.7;
    lastT = t;
    var max = maxY();
    if (target > max) target = max;
    pos += (target - pos) * (1 - Math.pow(1 - LERP, dt / 16.7));
    if (Math.abs(target - pos) < 0.5) pos = target;
    window.scrollTo(0, pos);
    lastSet = scrollY();
    if (pos === target) { stop(); return; }
    raf = requestAnimationFrame(frame);
  }

  window.addEventListener('wheel', function (e) {
    if (e.defaultPrevented || e.ctrlKey || reduce.matches) return;
    var dy = e.deltaY;
    if (!dy || Math.abs(e.deltaX) > Math.abs(dy)) return;
    if (e.deltaMode === 1) dy *= LINE;
    else if (e.deltaMode === 2) dy *= window.innerHeight;
    if (hidden(root) || hidden(document.body) || ownScroll(e.target, dy)) return;
    var max = maxY();
    if (max <= 0) return;
    e.preventDefault();
    if (!raf) {
      // начинаем с места, где страница сейчас (её могли прокрутить чем угодно)
      pos = target = scrollY();
      lastSet = -1;
      lastT = 0;
      root.style.scrollBehavior = 'auto';
    }
    target = Math.max(0, Math.min(max, target + dy));
    var g = gate();
    if (g != null && dy > 0 && target > g) target = Math.max(Math.min(pos, scrollY()), g);
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: false });

  window.WCSmoothScroll = { stop: stop, busy: function () { return !!raf; } };
})();
