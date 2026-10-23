/* ============================================================
   SIGNATURE.JS — подпись «Понравилось приглашение? Создайте своё бесплатно —
   WeddingCraft» внизу приглашения.

   Зачем: каждое приглашение видят 50–150 гостей, и часть из них сами
   скоро женятся. Это единственный канал, который растёт с каждой продажей
   и ничего не стоит.

   Подключается ДО script.js шаблона. Только бесплатный тариф и демо:
   на платных подписи нет. Открытая напрямую страница рисует подпись сама;
   внутри страницы-хозяина (iframe) решение приходит от brand.js вместе с
   данными сайта — wcBrand, см. TemplatePreview.tsx; если данных нет 6 секунд,
   подпись рисуется по умолчанию.
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
  var FRAMED = false;
  try { FRAMED = window.parent !== window; } catch (e) { FRAMED = true; }

  var box = null;
  var decided = !FRAMED;                       // в iframe ждём решения по тарифу (set)

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
    // Две строки: вопрос цепляет гостя, вторая — что делать. Раньше было
    // одно «Создано на WeddingCraft» — ни повода, ни призыва перейти.
    var ask = document.createElement('span');
    ask.style.cssText = 'display:block;font-size:11px;color:#7a756c;margin-bottom:2px';
    ask.appendChild(document.createTextNode('Понравилось приглашение?'));
    link.appendChild(ask);
    var cta = document.createElement('span');
    cta.style.cssText = 'font-weight:600';
    cta.appendChild(document.createTextNode('Создайте своё бесплатно — WeddingCraft '));
    link.appendChild(cta);
    // Сердце рисуем, а не пишем символом: на iOS знак ♥ подменяется
    // цветным эмодзи, которое игнорирует цвет из стилей.
    var NS = 'http://www.w3.org/2000/svg';
    var heart = document.createElementNS(NS, 'svg');
    heart.setAttribute('viewBox', '0 0 24 24');
    heart.setAttribute('width', '11');
    heart.setAttribute('height', '11');
    heart.setAttribute('aria-hidden', 'true');
    heart.style.cssText = 'vertical-align:-1px;margin-left:2px';
    var hp = document.createElementNS(NS, 'path');
    hp.setAttribute('d', 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
    hp.setAttribute('fill', 'currentColor');
    heart.appendChild(hp);
    cta.appendChild(heart);
    // Собственный фон и цвет: шаблоны бывают и светлые, и тёмные,
    // а наследование цвета дало бы нечитаемую подпись на половине из них.
    link.style.cssText = [
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'font-size:12px', 'letter-spacing:.02em', 'text-decoration:none',
      'color:#4a4740', 'background:rgba(255,255,255,.82)',
      '-webkit-backdrop-filter:blur(6px)', 'backdrop-filter:blur(6px)',
      'border:1px solid rgba(0,0,0,.07)', 'border-radius:16px',
      'padding:8px 18px 9px', 'box-shadow:0 2px 10px rgba(0,0,0,.10)',
      'transition:opacity .2s ease', 'opacity:.92', 'text-align:center',
      'line-height:1.35', 'max-width:100%'
    ].join(';');
    link.addEventListener('mouseenter', function () { link.style.opacity = '1'; });
    link.addEventListener('mouseleave', function () { link.style.opacity = '.92'; });

    box.appendChild(link);
    document.body.appendChild(box);
  }

  function remove() {
    if (box && box.parentNode) box.parentNode.removeChild(box);
    box = null;
  }

  /** Показать или убрать подпись. hidden:true — платный тариф: подписи нет. */
  function set(opts) {
    if (EDITING) return;                       // в редакторе подписи нет никогда
    decided = true;
    if (opts && opts.hidden) { remove(); return; }
    build();
  }

  window.WCSignature = { set: set };

  if (!EDITING) {
    if (!FRAMED) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
      else build();
    } else {
      // Решение по тарифу придёт вместе с данными; не пришло — подпись по умолчанию
      setTimeout(function () { if (!decided) build(); }, 6000);
    }
  }
})();
