/* ── Бренд WeddingCraft на странице приглашения (общий модуль всех шаблонов) ──
     · внизу страницы — подпись «Создано на WeddingCraft» (её рисует signature.js):
       бесплатный тариф и демо шаблонов, на платных подписи нет;
     · поверх страницы — еле заметный водяной знак: надпись WeddingCraft косой
       шахматкой (плитка assets/brand-wm.svg). Слой НЕПОДВИЖНЫЙ (position: fixed
       внутри окна приглашения): страницу листают, знак стоит на месте — как у
       демо Digital Yes. Кликов не перехватывает. Только у неопубликованного —
       демо шаблонов и предпросмотр черновика; опубликованным сайтам, бесплатным
       тоже, знака нет (с 08.10.26).
   В редакторе (editing=1) бренда нет — как и у подписи: пара правит свой сайт
   и не должна видеть рекламу сервиса поверх него.

   Решает страница-хозяин (TemplatePreview.tsx): в данных wc:data приходят
   wcBrand (подпись) и wcWatermark (знак) — true или false. Пока данных нет,
   ничего не рисуем, чтобы у опубликованных не мелькало. Страницу открыли
   напрямую (без родителя) или данных нет 6 секунд — показываются оба: так
   выглядят демо и сырые файлы шаблонов.

   Подключение: <script src="../assets/brand.js"></script> ПОСЛЕ signature.js в
   каждом шаблоне (и в генераторе студии — studio/export/generate.ts). Больше
   ничего не нужно: модуль сам слушает wc:data, правок в script.js шаблона нет. */
(function () {
  'use strict';

  if (window.WCBrand) return;                    // защита от двойного подключения
  if (window.location.search.indexOf('editing=1') !== -1) return;

  var SRC = (document.currentScript && document.currentScript.src) || '';
  var WM_URL = SRC ? new URL('brand-wm.svg', SRC).href : '/invite/assets/brand-wm.svg';
  var TILE = '330px 214px';                      // размер плитки brand-wm.svg
  var framed = false;
  try { framed = window.parent !== window; } catch (e) { framed = true; }

  var CSS =
    '.wc-wm{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;pointer-events:none;' +
    '-webkit-user-select:none;user-select:none;background:url("' + WM_URL + '") 0 0/' + TILE + ' repeat;' +
    'opacity:0;transition:opacity .9s ease}' +
    '.wc-wm.is-on{opacity:1}' +
    '@media (prefers-reduced-motion:reduce){.wc-wm{transition:none}}' +
    '@media print{.wc-wm{display:none}}';

  var wm = null, mark = false, decided = !framed;   // в iframe ждём решения страницы-хозяина

  function ensure() {
    if (wm || !document.body) return;
    var st = document.createElement('style');
    st.id = 'wc-brand-css';
    st.textContent = CSS;
    document.head.appendChild(st);
    wm = document.createElement('div');
    wm.className = 'wc-wm';
    wm.setAttribute('aria-hidden', 'true');
    document.body.appendChild(wm);
  }

  /* sig — подпись внизу, mk — водяной знак: true/false, null — без изменений.
     Один аргумент — оба сразу. */
  function set(sig, mk) {
    if (arguments.length < 2) mk = sig;
    decided = true;
    // подпись внизу — отдельный модуль; он сам убирается на платных тарифах
    if (typeof sig === 'boolean' && window.WCSignature) window.WCSignature.set({ hidden: !sig });
    if (typeof mk !== 'boolean') return;
    mark = mk;
    if (!wm) {
      if (!mark) return;                         // знака нет: слой не создаём вовсе
      ensure();
      if (!wm) return;
    }
    // в следующем кадре — чтобы появление было плавным, а не мгновенным
    requestAnimationFrame(function () { wm.classList.toggle('is-on', mark); });
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin || e.source !== window.parent) return;
    var p = e.data && e.data.type === 'wc:data' && e.data.payload;
    if (!p) return;
    // Только флаги, которые есть в данных: частичное сообщение без них не должно вернуть бренд
    var sig = typeof p.wcBrand === 'boolean' ? p.wcBrand : null;
    // Страница-хозяин старой сборки шлёт один wcBrand — тогда знак вместе с подписью, как раньше
    var mk = typeof p.wcWatermark === 'boolean' ? p.wcWatermark : sig;
    if (sig !== null || mk !== null) set(sig, mk);
  });

  function start() {
    if (!framed) set(true, true);
    else setTimeout(function () { if (!decided) set(true, true); }, 6000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // Для проверок: показан ли сейчас водяной знак
  window.WCBrand = { set: set, shown: function () { return !!(wm && wm.classList.contains('is-on')); } };
})();
