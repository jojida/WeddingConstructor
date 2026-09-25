/* ── Анкета гостя: общий модуль всех шаблонов ─────────────────────────────────
   Начинался со «Сколько вас будет?», теперь отвечает и за то, что пара
   включает в редакторе (customData, см. RSVP_FIELDS в constants.ts):
     rsvpMaybe: true      — третий вариант ответа «Пока не знаю»;
     rsvpChildren: true   — отдельно взрослые и дети;
     rsvpQuestions: [id]  — готовые вопросы (QUESTIONS ниже), rsvpCustomQ — свой.
   Настройки модуль берёт сам из postMessage('wc:data'), как и шаблон, —
   в applyData шаблона ничего вызывать не нужно.

   Новые элементы — клоны уже свёрстанных элементов формы, поэтому в каждом
   шаблоне выглядят как свои: группа вопроса — из блока «Сколько вас будет?»,
   вариант с одним ответом — из радио «Да, буду», с несколькими — из чекбокса
   напитка, поле ответа — из поля имени.

   В форме шаблона — блок с атрибутом data-rsvp-count (заголовок + степпер):
     <div class="wc-count" data-wc-count>
       <button type="button" class="wc-count__btn" data-step="-1">−</button>
       <input class="wc-count__num" type="number" name="guestsCount" value="1" min="1" max="10">
       <button type="button" class="wc-count__btn" data-step="1">+</button>
     </div>
   Отказ («не смогу») прячет количество и вопросы для тех, кто придёт.
   Степпер берёт цвет (currentColor) и шрифт у формы, шаблон может подправить
   вид своими правилами для .wc-count*.

   Подключение: <script src="../assets/rsvp-count.js"> ДО script.js шаблона —
   радио «Пока не знаю» должно появиться раньше, чем шаблон оживит свои
   переключатели. Тело запроса анкеты дополняется WCRsvp.payload(form)
   (attendance, guestsCount, childrenCount, answers, wishes). Форму, которую
   строит скрипт (студийный рантайм), после вставки — WCRsvpCount.init(). */
(function () {
  'use strict';

  var MIN = 1, MAX = 10, KIDS_MAX = 10;
  var ATTEND_NAMES = ['attend', 'attending', 'attendance'];
  var INDICATORS = '.custom-radio, .custom-check, .radio-mark, .checkbox-mark, .box';

  /* Готовые вопросы. id — те же, что в RSVP_QUESTIONS (frontend/src/lib/constants.ts).
     coming — спрашиваем только у тех, кто придёт. В вариантах не должно быть
     запятых: мультивыбор уходит одной строкой через «, ». «Пожелания» идут в
     отдельное поле ответа wishes, остальное — в answers. */
  var QUESTIONS = {
    ceremony: { q: 'Будете на регистрации?', t: 'one', options: ['Да, приеду к началу', 'Приеду только на банкет'], coming: true },
    menu:     { q: 'Что предпочитаете на горячее?', t: 'one', options: ['Мясо', 'Рыба', 'Вегетарианское'], coming: true },
    allergy:  { q: 'Есть ли аллергия или ограничения в еде?', t: 'text', placeholder: 'Например, не ем орехи', coming: true },
    transfer: { q: 'Нужен ли трансфер?', t: 'many', options: ['До площадки', 'Обратно после праздника'], coming: true },
    stay:     { q: 'Нужна ли помощь с жильём?', t: 'one', options: ['Да, нужна', 'Нет, спасибо'], coming: true },
    parking:  { q: 'Приедете на машине?', t: 'one', options: ['Да, нужно место на парковке', 'Нет'], coming: true },
    song:     { q: 'Под какую песню точно выйдете танцевать?', t: 'text', placeholder: 'Исполнитель — песня', coming: true },
    seat:     { q: 'С кем хотели бы сидеть рядом?', t: 'text', placeholder: 'Имена', coming: true },
    toast:    { q: 'Хотите сказать тост?', t: 'one', options: ['Да, с радостью', 'Нет'], coming: true },
    wishes:   { q: 'Пожелания молодожёнам', t: 'long', placeholder: 'Несколько тёплых слов' }
  };
  var ORDER = ['ceremony', 'menu', 'allergy', 'transfer', 'stay', 'parking', 'song', 'seat', 'toast', 'wishes'];

  // По умолчанию анкета как раньше: пара включает новое в редакторе
  var CFG = { maybe: false, children: false, questions: [], customQ: '' };

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
    // Взрослые / Дети — две строки «подпись … степпер», колонкой по месту степпера
    // max-width — если шаблон растягивает блок, степперы не уезжают к правому краю
    '.wc-count-rows{display:inline-flex;flex-direction:column;gap:10px;max-width:280px;text-align:left;vertical-align:middle}' +
    '.wc-count-row{display:flex;align-items:center;justify-content:space-between;gap:20px}' +
    '.wc-count-row__label{font:inherit;color:inherit}' +
    // :where — нулевая специфичность: класс поля имени шаблона (он у клона) главнее
    ':where([data-wc-q] textarea){font:inherit;color:inherit;box-sizing:border-box;width:100%;resize:vertical}' +
    '[data-rsvp-count][hidden],.wc-off{display:none!important}';

  function injectCss() {
    if (document.getElementById('wc-count-css')) return;
    var st = document.createElement('style');
    st.id = 'wc-count-css';
    st.textContent = CSS;
    var head = document.head || document.documentElement;
    head.insertBefore(st, head.firstChild);
  }

  function clamp(v, min, max) {
    var n = parseInt(v, 10);
    return isNaN(n) ? min : Math.min(max, Math.max(min, n));
  }

  function attendSelector(value) {
    return ATTEND_NAMES.map(function (n) {
      return 'input[type="radio"][name="' + n + '"]' + (value ? '[value="' + value + '"]' : '');
    }).join(',');
  }

  function answer(form) {
    var r = form.querySelector(attendSelector().split(',').map(function (s) { return s + ':checked'; }).join(','));
    return r ? r.value : '';
  }

  function declined(form) { return answer(form) === 'no'; }

  /* ─── Клоны элементов шаблона ─────────────────────────────────────────── */

  // Текст подписи: последний непустой текстовый узел, остальные гасим
  function setLabelText(label, text) {
    var walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push(n);
    if (!nodes.length) { label.appendChild(document.createTextNode(' ' + text)); return; }
    var last = nodes[nodes.length - 1];
    last.nodeValue = last.nodeValue.replace(/\S[\s\S]*\S|\S/, text);
    for (var i = 0; i < nodes.length - 1; i++) nodes[i].nodeValue = '';
  }

  function syncIndicator(input) {
    var lab = input.closest('label');
    var ind = lab && lab.querySelector(INDICATORS);
    if (ind) ind.classList.toggle('checked', input.checked);
  }

  // Вариант ответа по образцу (радио «Да, буду» или чекбокс напитка)
  function optionClone(proto, type, name, value, text) {
    var lab = proto.cloneNode(true);
    ['data-bound', 'data-wc-maybe', 'id', 'for'].forEach(function (a) { lab.removeAttribute(a); });
    lab.classList.remove('wc-off');
    var input = lab.querySelector('input');
    // Образец радио, а нужен чекбокс: свои значки у шаблонов называются по-разному
    if (input.type !== type) {
      var ind = lab.querySelector(INDICATORS);
      if (ind && type === 'checkbox') {
        ind.className = ind.className.replace('custom-radio', 'custom-check').replace('radio-mark', 'checkbox-mark');
      }
      input.type = type;
    }
    ['checked', 'required', 'id', 'data-edit'].forEach(function (a) { input.removeAttribute(a); });
    input.name = name;
    input.value = value;
    input.checked = false;
    input.defaultChecked = false;
    lab.querySelectorAll(INDICATORS).forEach(function (el) { el.classList.remove('checked'); });
    setLabelText(lab, text);
    return lab;
  }

  // Поле ответа по образцу поля имени (класс и стиль шаблона)
  function fieldClone(form, name, placeholder, long) {
    var src = form.querySelector('input[name="guestName"]');
    var el = document.createElement(long ? 'textarea' : 'input');
    if (src) {
      el.className = src.className;
      if (src.getAttribute('style')) el.setAttribute('style', src.getAttribute('style'));
    }
    if (long) el.rows = 3; else el.type = 'text';
    el.name = name;
    el.placeholder = placeholder || '';
    el.maxLength = long ? 1000 : 300;
    return el;
  }

  // Группа вопроса по образцу блока «Сколько вас будет?»: обёртка + заголовок
  function groupShell(form, title) {
    var block = form.querySelector('[data-rsvp-count]');
    var wrap = block ? block.cloneNode(false) : document.createElement('div');
    ['data-rsvp-count', 'hidden', 'id', 'data-edit'].forEach(function (a) { wrap.removeAttribute(a); });
    wrap.classList.remove('wc-off');
    var t = null;
    if (block) {
      for (var el = block.firstElementChild; el; el = el.nextElementSibling) {
        if (!el.matches('[data-wc-count], .wc-count, .wc-count-rows')) { t = el.cloneNode(true); break; }
      }
    }
    if (!t) t = document.createElement('p');
    t.removeAttribute('id');
    t.removeAttribute('data-edit');
    t.textContent = title;
    wrap.appendChild(t);
    return wrap;
  }

  /* ─── «Пока не знаю» ──────────────────────────────────────────────────── */
  function ensureMaybe(form) {
    var existing = form.querySelector('[data-wc-maybe]');
    if (existing) return existing;
    var no = form.querySelector(attendSelector('no'));
    var label = no && no.closest('label');
    if (!label) return null;
    var clone = optionClone(label, 'radio', no.name, 'maybe', 'Пока не знаю');
    clone.setAttribute('data-wc-maybe', '');
    clone.classList.add('wc-off');     // покажем, когда пара включит
    label.parentNode.insertBefore(clone, label.nextSibling);
    return clone;
  }

  function applyMaybe(form) {
    var lab = ensureMaybe(form);
    if (!lab) return;
    lab.classList.toggle('wc-off', !CFG.maybe);
    var input = lab.querySelector('input');
    if (!CFG.maybe && input.checked) { input.checked = false; syncIndicator(input); }
  }

  /* ─── Степперы: взрослые и дети ───────────────────────────────────────── */
  function syncBox(box, min, max) {
    var input = box.querySelector('input');
    var v = clamp(input.value, min, max);
    input.value = v;
    box.querySelectorAll('[data-step]').forEach(function (b) {
      var step = +b.getAttribute('data-step');
      b.disabled = (step < 0 && v <= min) || (step > 0 && v >= max);
    });
  }

  function bindBox(box, min, max) {
    var input = box.querySelector('input');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-step]');
      if (!b || b.disabled) return;
      e.preventDefault();
      input.value = clamp(input.value, min, max) + (+b.getAttribute('data-step'));
      syncBox(box, min, max);
    });
    input.addEventListener('change', function () { syncBox(box, min, max); });
    input.addEventListener('blur', function () { syncBox(box, min, max); });
    syncBox(box, min, max);
  }

  function row(label, box) {
    var r = document.createElement('div');
    r.className = 'wc-count-row';
    var s = document.createElement('span');
    s.className = 'wc-count-row__label';
    s.textContent = label;
    r.appendChild(s);
    r.appendChild(box);
    return r;
  }

  // Подписи «Взрослые / Дети» — как текст вариантов ответа шаблона. Размеры у
  // шаблонов часто в cqw, поэтому пересчитываем и при смене ширины окна.
  function textHost(label) {
    var walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT, null);
    var host = label, n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) host = n.parentNode;
    return host;
  }

  function matchRowLabels(form) {
    var opt = form.querySelector(attendSelector());
    var lab = opt && opt.closest('label');
    if (!lab) return;
    var cs = getComputedStyle(textHost(lab));
    form.querySelectorAll('.wc-count-row__label').forEach(function (s) {
      s.style.fontSize = cs.fontSize;
      s.style.letterSpacing = cs.letterSpacing;
      s.style.color = cs.color;
    });
  }

  function applyChildren(form) {
    var block = form.querySelector('[data-rsvp-count]');
    var box = block && block.querySelector('[data-wc-count]');
    if (!box) return;
    var rows = block.querySelector('.wc-count-rows');
    if (CFG.children && !rows) {
      if (!form.__wcKids) {
        var kids = box.cloneNode(true);
        kids.removeAttribute('data-wc-count');
        kids.setAttribute('data-wc-kids', '');
        var input = kids.querySelector('input');
        input.name = 'childrenCount';
        input.min = '0';
        input.value = '0';
        input.setAttribute('aria-label', 'Сколько детей');
        bindBox(kids, 0, KIDS_MAX);
        form.__wcKids = kids;
      }
      rows = document.createElement('div');
      rows.className = 'wc-count-rows';
      // Колонка встаёт туда, где стоял степпер, и выравнивается так же
      rows.style.alignSelf = getComputedStyle(box).alignSelf;
      box.parentNode.insertBefore(rows, box);
      rows.appendChild(row('Взрослые', box));
      rows.appendChild(row('Дети', form.__wcKids));
      matchRowLabels(form);
    } else if (!CFG.children && rows) {
      rows.parentNode.insertBefore(box, rows);
      rows.remove();
    }
  }

  /* ─── Дополнительные вопросы ──────────────────────────────────────────── */
  function questionList() {
    var list = [];
    ORDER.forEach(function (id) {
      if (CFG.questions.indexOf(id) >= 0) list.push({ id: id, meta: QUESTIONS[id] });
    });
    if (CFG.customQ) list.push({ id: 'custom', meta: { q: CFG.customQ, t: 'text', placeholder: 'Ваш ответ' } });
    return list;
  }

  function buildQuestions(form) {
    var sig = JSON.stringify([CFG.questions, CFG.customQ]);
    if (form.__wcqSig === sig) return;
    form.__wcqSig = sig;
    var old = form.querySelector('[data-wc-questions]');
    if (old) old.remove();
    var list = questionList();
    if (!list.length) return;

    var radioProto = form.querySelector(attendSelector('yes'));
    radioProto = radioProto && radioProto.closest('label');
    var checkProto = form.querySelector('input[type="checkbox"][name="drink"]');
    checkProto = (checkProto && checkProto.closest('label')) || radioProto;

    // display:contents — группы встают в поток формы наравне с её группами
    var box = document.createElement('div');
    box.setAttribute('data-wc-questions', '');
    box.style.display = 'contents';
    list.forEach(function (item) {
      var m = item.meta, name = 'wcq_' + item.id;
      var g = groupShell(form, m.q);
      g.setAttribute('data-wc-q', item.id);
      if (m.coming) g.setAttribute('data-wc-coming', '');
      if (m.t === 'one' && radioProto) {
        m.options.forEach(function (o) { g.appendChild(optionClone(radioProto, 'radio', name, o, o)); });
      } else if (m.t === 'many' && checkProto) {
        m.options.forEach(function (o) { g.appendChild(optionClone(checkProto, 'checkbox', name, o, o)); });
      } else {
        g.appendChild(fieldClone(form, name, m.placeholder, m.t === 'long'));
      }
      box.appendChild(g);
    });
    // Значки выбора у клонов шаблон не оживлял — ведём их сами
    box.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.name) box.querySelectorAll('input[name="' + t.name + '"]').forEach(syncIndicator);
    });
    form.__wcqMeta = list;

    // Перед кнопкой отправки, на верхнем уровне формы
    var anchor = form.querySelector('button[type="submit"], input[type="submit"], button:not([type])');
    while (anchor && anchor.parentNode !== form) anchor = anchor.parentNode;
    form.insertBefore(box, anchor || null);
  }

  function readAnswer(group) {
    var picked = [];
    group.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked').forEach(function (i) {
      picked.push(i.value);
    });
    if (picked.length) return picked.join(', ');
    var field = group.querySelector('input[type="text"], textarea');
    return field ? field.value.trim() : '';
  }

  /* ─── Состояние формы ─────────────────────────────────────────────────── */
  // Отказ — ни количества, ни вопросов для тех, кто придёт
  function refresh(form) {
    var no = declined(form);
    var block = form.querySelector('[data-rsvp-count]');
    if (block) block.hidden = no;
    form.querySelectorAll('[data-wc-coming]').forEach(function (g) { g.classList.toggle('wc-off', no); });
  }

  function apply(form) {
    applyMaybe(form);
    applyChildren(form);
    buildQuestions(form);
    refresh(form);
  }

  function bind(form) {
    if (form.__wcCount) return;
    var block = form.querySelector('[data-rsvp-count]');
    var box = block && block.querySelector('[data-wc-count]');
    if (!box && !form.querySelector(attendSelector())) return;
    form.__wcCount = true;
    if (box) bindBox(box, MIN, MAX);
    form.addEventListener('change', function () { refresh(form); });
    apply(form);
  }

  function forms() { return document.querySelectorAll('form'); }

  function init() {
    injectCss();
    forms().forEach(bind);
  }

  function config(d) {
    if (!d) return;
    // Не пришло — оставляем как было: частичные данные значат «без изменений»
    if ('rsvpMaybe' in d) CFG.maybe = d.rsvpMaybe === true;
    if ('rsvpChildren' in d) CFG.children = d.rsvpChildren === true;
    if ('rsvpQuestions' in d) {
      CFG.questions = Array.isArray(d.rsvpQuestions)
        ? d.rsvpQuestions.filter(function (id) { return QUESTIONS[id]; })
        : [];
    }
    if ('rsvpCustomQ' in d) CFG.customQ = typeof d.rsvpCustomQ === 'string' ? d.rsvpCustomQ.trim().slice(0, 200) : '';
    forms().forEach(function (f) { if (f.__wcCount) apply(f); });
  }

  function guests(form) {
    if (declined(form)) return { total: 1, kids: 0 };
    var adults = form.querySelector('[name="guestsCount"]');
    var kids = CFG.children ? form.querySelector('[name="childrenCount"]') : null;
    var a = adults ? clamp(adults.value, MIN, MAX) : 1;
    var k = kids ? clamp(kids.value, 0, KIDS_MAX) : 0;
    return { total: a + k, kids: k };
  }

  function payload(form) {
    var out = {};
    var a = answer(form);
    if (a) out.attendance = a === 'maybe' ? 'maybe' : a === 'no' ? 'no' : 'yes';
    var g = guests(form);
    out.guestsCount = g.total;
    out.childrenCount = g.kids;
    var answers = [];
    (form.__wcqMeta || []).forEach(function (item) {
      var group = form.querySelector('[data-wc-q="' + item.id + '"]');
      if (!group || group.classList.contains('wc-off')) return;
      var text = readAnswer(group);
      if (!text) return;
      if (item.id === 'wishes') out.wishes = text;
      else answers.push({ id: item.id, q: item.meta.q, a: text, t: item.meta.t === 'long' ? 'text' : item.meta.t });
    });
    out.answers = answers;
    return out;
  }

  window.WCRsvpCount = {
    // Сколько человек придёт по анкете: взрослые + дети
    get: function (form) { return form ? guests(form).total : 1; },
    init: init,
  };
  window.WCRsvp = { payload: payload, config: config, init: init };

  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin || e.source !== window.parent) return;
    var m = e.data;
    if (m && m.type === 'wc:data' && m.payload) config(m.payload);
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      forms().forEach(function (f) { if (f.__wcCount && CFG.children) matchRowLabels(f); });
    }, 150);
  });

  // Скрипт стоит в конце <body>, форма уже есть: вставляем сразу, до script.js шаблона
  if (document.querySelector('form')) init();
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
