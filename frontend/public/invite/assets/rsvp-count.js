/* ── «Сколько вас будет?» в анкете гостя (общий модуль всех шаблонов) ─────────
   В форме шаблона — блок с атрибутом data-rsvp-count, внутри степпер:
     <div class="wc-count" data-wc-count>
       <button type="button" class="wc-count__btn" data-step="-1">−</button>
       <input class="wc-count__num" type="number" name="guestsCount" value="1" min="1" max="10">
       <button type="button" class="wc-count__btn" data-step="1">+</button>
     </div>
   Модуль оживляет кнопки ± и ввод (1…10), прячет блок, когда гость отвечает
   «не смогу» (радио attend / attending / attendance со значением no), и отдаёт
   число для отправки: WCRsvpCount.get(form). Степпер берёт цвет (currentColor)
   и шрифт у формы, шаблон может подправить вид своими правилами для .wc-count*.

   Подключение: <script src="../assets/rsvp-count.js"> ДО script.js шаблона,
   при отправке анкеты — guestsCount: WCRsvpCount.get(form). Форму, которую
   строит скрипт (студийный рантайм), после вставки — WCRsvpCount.init(). */
(function () {
  'use strict';

  var MIN = 1, MAX = 10;

  // Обычные классы в начале <head>: сильнее сброса шаблона, слабее его правил
  var CSS =
    '.wc-count{display:inline-flex;align-items:center;gap:12px}' +
    '.wc-count__btn{width:34px;height:34px;padding:0;border-radius:50%;border:1px solid currentColor;' +
      'background:transparent;color:inherit;font:inherit;font-size:18px;line-height:1;cursor:pointer;' +
      'display:inline-flex;align-items:center;justify-content:center;opacity:.85;transition:opacity .15s}' +
    '.wc-count__btn:hover{opacity:1}' +
    '.wc-count__btn:disabled{opacity:.3;cursor:default}' +
    '.wc-count__num{width:44px;padding:4px 0;border:none;border-bottom:1px solid currentColor;border-radius:0;' +
      'background:transparent;color:inherit;font:inherit;font-size:18px;text-align:center;outline:none;' +
      '-moz-appearance:textfield;appearance:textfield}' +
    '.wc-count__num::-webkit-outer-spin-button,.wc-count__num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}' +
    '[data-rsvp-count][hidden]{display:none!important}';

  function injectCss() {
    if (document.getElementById('wc-count-css')) return;
    var st = document.createElement('style');
    st.id = 'wc-count-css';
    st.textContent = CSS;
    var head = document.head || document.documentElement;
    head.insertBefore(st, head.firstChild);
  }

  function clamp(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? MIN : Math.min(MAX, Math.max(MIN, n));
  }

  function declined(form) {
    var r = form.querySelector('input[name="attend"]:checked, input[name="attending"]:checked, input[name="attendance"]:checked');
    return !!r && r.value === 'no';
  }

  function sync(box) {
    var input = box.querySelector('[name="guestsCount"]');
    var v = clamp(input.value);
    input.value = v;
    box.querySelectorAll('[data-step]').forEach(function (b) {
      var step = +b.getAttribute('data-step');
      b.disabled = (step < 0 && v <= MIN) || (step > 0 && v >= MAX);
    });
  }

  function bind(form) {
    var block = form.querySelector('[data-rsvp-count]');
    var box = block && block.querySelector('[data-wc-count]');
    if (!box || form.__wcCount) return;
    form.__wcCount = true;
    var input = box.querySelector('[name="guestsCount"]');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-step]');
      if (!b || b.disabled) return;
      e.preventDefault();
      input.value = clamp(input.value) + (+b.getAttribute('data-step'));
      sync(box);
    });
    input.addEventListener('change', function () { sync(box); });
    input.addEventListener('blur', function () { sync(box); });
    // Отказ — количество не спрашиваем
    var toggle = function () { block.hidden = declined(form); };
    form.addEventListener('change', toggle);
    toggle();
    sync(box);
  }

  function init() {
    injectCss();
    document.querySelectorAll('form').forEach(bind);
  }

  window.WCRsvpCount = {
    get: function (form) {
      var input = form && form.querySelector('[name="guestsCount"]');
      return input && !declined(form) ? clamp(input.value) : 1;
    },
    init: init,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
