/* ============================================================
   INTRO-CHOICE.JS — какая заставка открывает приглашение.

   У шаблонов своя заставка: тематическая (двери «Витража», видео
   «Средиземноморья», конверт и живая обложка «Вечера в саду», вспышка
   «Фотобудки», анимация обложки) или универсальная — конверт. Универсальные
   конверты — общие модули, и пара может поставить любой из них вместо своей
   заставки шаблона (27.11.26: «у Витража можно оставить его тематическое
   превью, либо загрузить одно из универсальных»):
     slide — створки с золотой печатью и лепестками   (envelope-slide.js, «Нежность»)
     flap  — конверт, клапан поднимается              (envelope-flap.js, «Цветущий»)
     wax3d — 3D-конверт с сургучной печатью           (envelope3d.js, «Ангелы»)
   Цвет печати у всех трёх — customData.sealColor (SEAL_COLORS в constants.ts).

   Подключение — ПЕРВЫМ элементом <body> каждого шаблона:
     <script src="../assets/intro-choice.js" data-own="slide"
             data-groom="Евгений" data-bride="Надежда" data-hint="…"></script>
   data-own — своя заставка шаблона, если она универсальная (slide | flap |
   wax3d); у тематических и у шаблонов без заставки атрибута нет. Остальные
   data-* достаются модулю конверта (имена-образцы, надпись, печать, шрифт).

   Выбор приходит в адресе страницы от обёртки (lib/intro-choice.ts):
   introStyle=slide|flap|wax3d (нет — своя заставка), seal=<цвет печати>,
   intro=0 — анимация открытия не входит в тариф: заставки нет никакой.
   Модуль выбранного конверта вписывается прямо за этим скриптом
   (document.write) — он закрывает страницу ещё до её отрисовки, как раньше
   свой конверт «Нежности» и «Ангелов».

   Для скриптов шаблона:
     WCIntroChoice.swapped   — вместо своей заставки шаблона — общий конверт:
                               свою не показываем ни гостю, ни кнопкой в
                               редакторе, и WCEnvelope не трогаем (он за конвертом)
     WCIntroChoice.own       — наоборот: своя заставка на месте (при intro=0
                               тоже — её скрипт сам знает, что показывать нечего)
     WCIntroChoice.style     — slide | flap | wax3d | own | none
     WCIntroChoice.universal — заставка — один из общих конвертов
     WCIntroChoice.seal      — цвет печати из адреса ('' — по умолчанию)
   Своя заставка заменена — на <html> класс wc-intro-swapped (до отрисовки:
   по нему CSS шаблона прячет разметку своей заставки). Обложка ждёт конверт
   по общему договору: WCEnvelope.active и событие 'wc:envelope-open'.
   ============================================================ */
(function () {
  'use strict';
  if (window.WCIntroChoice) return;

  var script = document.currentScript;
  var Q = new URLSearchParams(window.location.search);
  var MODULES = { slide: 'envelope-slide.js', flap: 'envelope-flap.js', wax3d: 'envelope3d.js' };
  var own = (script && script.getAttribute('data-own')) || '';
  if (!MODULES[own]) own = '';
  var asked = Q.get('introStyle') || '';
  var style = Q.get('intro') === '0' ? 'none' : MODULES[asked] ? asked : (own || 'own');

  var swapped = !!MODULES[style] && style !== own;
  var api = {
    style: style,
    swapped: swapped,
    own: !swapped,
    universal: !!MODULES[style],
    seal: (Q.get('seal') || '').replace(/[^a-z]/g, '')
  };
  window.WCIntroChoice = api;
  if (swapped) document.documentElement.classList.add('wc-intro-swapped');
  if (!api.universal) return;

  // Модуль конверта — сразу за этим скриптом, с теми же data-* (кроме data-own)
  var base = script && script.src ? script.src.replace(/[^/]*$/, '') : '/invite/assets/';
  var attrs = '';
  if (script) {
    for (var i = 0; i < script.attributes.length; i++) {
      var a = script.attributes[i];
      if (a.name.indexOf('data-') !== 0 || a.name === 'data-own') continue;
      attrs += ' ' + a.name + '="' + String(a.value).replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
    }
  }
  document.write('<script src="' + base + MODULES[style] + '"' + attrs + '><\/script>');

  // Гость: пока конверт закрыт, CSS-анимации обложки стоят — иначе они отыграли
  // бы под ним (плашка «Средиземноморья», обложка «Цветущего»). Обложки, которые
  // запускает скрипт шаблона, сами ждут 'wc:envelope-open'.
  if (Q.get('editing') === '1') return;
  var root = document.documentElement;
  root.classList.add('wc-env-wait');
  var st = document.createElement('style');
  st.textContent = 'html.wc-env-wait [data-wc-section="cover"],html.wc-env-wait [data-wc-section="cover"] *' +
    '{animation-play-state:paused!important}';
  (document.head || root).appendChild(st);
  var go = function () { root.classList.remove('wc-env-wait'); };
  window.addEventListener('wc:envelope-open', go);
  // Конверт так и не закрыл страницу (3D без WebGL2 и т. п.) — ждать нечего
  document.addEventListener('DOMContentLoaded', function () {
    if (!(window.WCEnvelope && window.WCEnvelope.active)) go();
  });
})();
