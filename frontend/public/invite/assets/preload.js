/* ── Фоновая догрузка страницы (общий модуль всех шаблонов) ─────────────────
   Пока гость смотрит первый экран (конверт, двери, обложку), за ним догружаются
   все картинки страницы — дальше она листается без подгрузок, как приглашения
   на Тильде. Первый экран при этом не тормозит: начинаем после load, когда он
   уже показан, и после данных пары (wc:data) — чтобы не качать демо-фото,
   которые тут же заменятся своими. Нет данных за 3 с — не ждём.

   Картинки страницы — <img loading="lazy">: браузер качает их, только когда до
   них долистали. Здесь им по порядку сверху вниз ставится loading="eager", по
   4 одновременно — сначала то, что гость увидит раньше. Скрытое (выключенные
   разделы, лишние слоты, display:none) не трогаем: покажется — браузер загрузит
   сам. При «экономии трафика» (Save-Data) и на 2G ничего не догружаем.

   Очередь опустела — событие wc:preloaded на window: по нему venue-map.js
   заранее грузит карту.

   Подключение: <script src="../assets/preload.js"> рядом с остальными модулями. */
(function () {
  'use strict';
  if (window.WCPreload) return;
  window.WCPreload = true;

  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return;
  if (!('loading' in HTMLImageElement.prototype)) return;   // без lazy браузер и так качает всё

  var PARALLEL = 4;
  var loaded = document.readyState === 'complete';
  var gotData = window.parent === window;                    // открыт сам по себе — данных не ждём
  var started = false;
  var finished = false;
  var queue = [];
  var active = 0;

  function maybeStart() {
    if (started || !loaded || !gotData) return;
    started = true;
    // Даём шаблону применить данные и запустить анимацию первого экрана
    setTimeout(run, 400);
  }

  function onLoad() {
    loaded = true;
    setTimeout(function () { gotData = true; maybeStart(); }, 3000);
    maybeStart();
  }
  if (loaded) onLoad(); else window.addEventListener('load', onLoad);
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'wc:data') { gotData = true; maybeStart(); }
  });

  function enqueue(img) {
    if (img.__wcPreload) return;
    img.__wcPreload = 1;
    queue.push(img);
  }

  function settle(img) {
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.removeEventListener('load', finish);
      img.removeEventListener('error', finish);
      active--;
      pump();
    }
    var timer = setTimeout(finish, 10000);                   // зависшая картинка не держит очередь
    img.addEventListener('load', finish);
    img.addEventListener('error', finish);
  }

  function pump() {
    while (active < PARALLEL && queue.length) {
      var img = queue.shift();
      if (!img.isConnected || img.loading !== 'lazy') continue;
      if (!img.getClientRects().length) { img.__wcPreload = 0; continue; }
      if (img.complete) continue;                            // уже загружена (была у экрана) или без src
      active++;
      settle(img);
      img.loading = 'eager';
    }
    if (!active && !queue.length && !finished) {
      finished = true;
      window.dispatchEvent(new Event('wc:preloaded'));
    }
  }

  function run() {
    var list = document.querySelectorAll('img[loading="lazy"]');
    for (var i = 0; i < list.length; i++) enqueue(list[i]);
    // Картинки, которые шаблон дорисует позже (иконки программы, галерея)
    if ('MutationObserver' in window) {
      new MutationObserver(function (records) {
        var added = false;
        records.forEach(function (r) {
          r.addedNodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            var imgs = node.matches('img[loading="lazy"]') ? [node] : node.querySelectorAll('img[loading="lazy"]');
            for (var j = 0; j < imgs.length; j++) { enqueue(imgs[j]); added = true; }
          });
        });
        if (added) pump();
      }).observe(document.body, { childList: true, subtree: true });
    }
    pump();
  }
})();
