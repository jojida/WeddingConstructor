/* ============================================================
   SIGNATURE.JS — подпись «Создано на WeddingCraft» внизу приглашения.

   Зачем: каждое приглашение видят 50–150 гостей, и часть из них сами
   скоро женятся. Это единственный канал, который растёт с каждой продажей
   и ничего не стоит.

   Подключается ДО script.js шаблона. Рисуется сама, данных не ждёт.
   Ссылка размечена UTM — в Метрике переходы из приглашений видны отдельно
   от прочего трафика, с разбивкой по шаблону.
   ============================================================ */
(function () {
  'use strict';
  if (window.WCSignature) return;              // защита от двойного подключения

  var SITE = 'https://weddingcraft.ru';
  // В редакторе подпись не нужна: пара правит текст и не должна видеть рекламу
  // собственного сервиса поверх своего сайта.
  var EDITING = window.location.search.indexOf('editing=1') !== -1;

  var box = null;

  /** Имя шаблона из пути /invite/<шаблон>/index.html — для utm_campaign. */
  function templateId() {
    var m = window.location.pathname.match(/\/invite\/([^/]+)\//);
    return m ? m[1] : 'mediterranean';         // корневой /invite/ — «Средиземноморье»
  }

  function build() {
    if (box) return;

    box = document.createElement('div');
    box.className = 'wc-signature';
    box.style.cssText = [
      'display:flex', 'justify-content:center', 'align-items:center',
      'padding:22px 16px 26px', 'width:100%', 'box-sizing:border-box',
      'position:relative', 'z-index:5'
    ].join(';');

    var link = document.createElement('a');
    link.href = SITE + '/?utm_source=invite&utm_medium=signature&utm_campaign=' + encodeURIComponent(templateId());
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Создано на WeddingCraft ♥';
    // Собственный фон и цвет: шаблоны бывают и светлые, и тёмные,
    // а наследование цвета дало бы нечитаемую подпись на половине из них.
    link.style.cssText = [
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'font-size:12px', 'letter-spacing:.02em', 'text-decoration:none',
      'color:#4a4740', 'background:rgba(255,255,255,.82)',
      '-webkit-backdrop-filter:blur(6px)', 'backdrop-filter:blur(6px)',
      'border:1px solid rgba(0,0,0,.07)', 'border-radius:999px',
      'padding:7px 15px', 'box-shadow:0 2px 10px rgba(0,0,0,.10)',
      'transition:opacity .2s ease', 'opacity:.9', 'white-space:nowrap'
    ].join(';');
    link.addEventListener('mouseenter', function () { link.style.opacity = '1'; });
    link.addEventListener('mouseleave', function () { link.style.opacity = '.9'; });

    box.appendChild(link);
    document.body.appendChild(box);
  }

  function remove() {
    if (box && box.parentNode) box.parentNode.removeChild(box);
    box = null;
  }

  /** Показать или убрать подпись. hidden:true — тариф с отключённой подписью. */
  function set(opts) {
    if (opts && opts.hidden) { remove(); return; }
    build();
  }

  window.WCSignature = { set: set };

  if (!EDITING) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
    else build();
  }
})();
