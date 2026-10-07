/* ── Бренд WeddingCraft на странице приглашения (общий модуль всех шаблонов) ──
   Бесплатный тариф и демо шаблонов:
     · внизу страницы — подпись «Создано на WeddingCraft» (её рисует signature.js);
     · поверх страницы — еле заметный водяной знак: надпись WeddingCraft косой
       шахматкой (плитка assets/brand-wm.svg). Слой НЕПОДВИЖНЫЙ (position: fixed
       внутри окна приглашения): страницу листают, знак стоит на месте — как у
       демо Digital Yes. Кликов не перехватывает.
   Платные тарифы: ни подписи, ни знака.
   В редакторе (editing=1) бренда нет — как и у подписи: пара правит свой сайт
   и не должна видеть рекламу сервиса поверх него.

   Решает страница-хозяин (TemplatePreview.tsx): в данных wc:data приходит
   wcBrand — true (показать) или false (платный сайт). Пока данных нет, ничего не
   рисуем, чтобы у платных не мелькало. Страницу открыли напрямую (без родителя)
   или данных нет 6 секунд — бренд показывается: так выглядят демо и сырые
   файлы шаблонов.

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

  var wm = null, state = framed ? null : true;   // null — ждём данные страницы-хозяина

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

  function set(on) {
    state = !!on;
    // подпись внизу — отдельный модуль; он сам убирается на платных тарифах
    if (window.WCSignature) window.WCSignature.set({ hidden: !state });
    if (!wm) {
      if (!state) return;                        // платный сайт: слой не создаём вовсе
      ensure();
      if (!wm) return;
    }
    // в следующем кадре — чтобы появление было плавным, а не мгновенным
    requestAnimationFrame(function () { wm.classList.toggle('is-on', state); });
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin || e.source !== window.parent) return;
    var m = e.data;
    // Только когда флаг есть в данных: частичное сообщение без него не должно вернуть бренд платному сайту
    if (m && m.type === 'wc:data' && m.payload && typeof m.payload.wcBrand === 'boolean') set(m.payload.wcBrand);
  });

  function start() {
    if (state === true) set(true);
    else if (state === null) setTimeout(function () { if (state === null) set(true); }, 6000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // Для проверок: показан ли сейчас водяной знак
  window.WCBrand = { set: set, shown: function () { return !!(wm && wm.classList.contains('is-on')); } };
})();
