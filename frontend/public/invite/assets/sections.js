/* Границы блоков размечены в HTML: скрываем весь блок вместе с декором,
   а в общих карточках — только необязательные части. Данные не удаляются. */
(function () {
  'use strict';
  if (window.WCSections) return;
  var required = ['cover', 'date', 'venue', 'closing'];
  var state = {};
  var plan = '';
  var freeLocked = ['venue', 'hall', 'map', 'schedule', 'dresscode', 'style', 'rsvp', 'menu'];
  var style = document.createElement('style');
  style.textContent = '.wc-section-hidden{display:none!important}';
  document.head.appendChild(style);

  function enabled(id) {
    if (plan === 'free' && freeLocked.indexOf(id) !== -1) return false;
    if (plan === 'premium' && id === 'menu') return false;
    return required.indexOf(id) !== -1 || state[id] !== false;
  }

  function apply(data) {
    if (!data) return;
    if (Object.prototype.hasOwnProperty.call(data, 'plan')) plan = data.plan || '';
    if (Object.prototype.hasOwnProperty.call(data, 'enabledSections')) {
      state = data.enabledSections && typeof data.enabledSections === 'object' ? data.enabledSections : {};
    }
    var changed = false;
    function hide(el, off) {
      if (el.classList.contains('wc-section-hidden') === off) return;
      el.classList.toggle('wc-section-hidden', off);
      changed = true;
    }
    document.querySelectorAll('[data-wc-section]').forEach(function (el) {
      hide(el, !enabled(el.getAttribute('data-wc-section')));
    });
    document.querySelectorAll('[data-wc-section-group]').forEach(function (el) {
      var ids = el.getAttribute('data-wc-section-group').split(' ');
      hide(el, ids.every(function (id) { return !enabled(id); }));
    });
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      var target = document.getElementById(link.getAttribute('href').slice(1));
      hide(link, !!target && !!target.closest('.wc-section-hidden'));
    });
    if (window.WCMusic) window.WCMusic.setEnabled(enabled('music'));
    if (window.WCEnvelope && window.WCEnvelope.setEnabled) window.WCEnvelope.setEnabled(enabled('envelope'));
    if (changed) {
      // Треки расписания зависят от размеров: после возврата блока пересчитать.
      requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
    }
  }
  window.WCSections = { apply: apply, enabled: enabled };
})();
