/* ============================================================
   TRACK-MARKER.JS — «ползунок» на линии программы дня: значок, который
   едет по треку, пока гость листает (сердце, жемчужина, жёлудь, машинка…).
   С 27.11.26 пара выбирает его из общего списка: customData.trackMarker
   (поле «Ползунок» в разделе «Программа дня»), '' — свой значок шаблона.
   Картинки — assets/markers/ (scripts/generate-track-markers.py).

   Разметка: у значка шаблона атрибут data-wc-marker (значение — свой ключ
   из списка, если он там есть: pearl, acorn…; иначе own). Скрипт шаблона
   двигает значок как раньше (x/y, transform, CSS) — модуль меняет только
   картинку и вписывает новую в рамку прежнего значка: центр тот же,
   пропорции — свои; мелкий значок (меньше 30 px на экране) — покрупнее.
     · SVG (<image>, <path>, <g>) — рядом своя картинка в его рамке; x/y,
                              размер и transform повторяет за ним; сам значок прозрачный;
     · <img>                — другой src в той же рамке (aspect-ratio + contain);
     · другой HTML-элемент  — картинка поверх во всю его рамку.
   На подменённом значке — атрибут data-wc-marker-swapped (у «Скетча» по нему
   чужой значок не поворачивается по линии, как своя машинка).

   Подключение: <script src="../assets/track-marker.js"></script> перед
   script.js шаблона с треком программы.
   ============================================================ */
(function () {
  'use strict';
  if (window.WCTrackMarker) return;

  var script = document.currentScript;
  var BASE = (script && script.src ? script.src.replace(/[^/]*$/, '') : '/invite/assets/') + 'markers/';
  var NS = 'http://www.w3.org/2000/svg';
  var LIST = {
    heart: 'heart.svg', glitter: 'glitter.webp', pearl: 'pearl.webp', rings: 'rings.webp', dove: 'dove.webp',
    cupid: 'cupid.webp', gem: 'gem.webp', berry: 'berry.webp', acorn: 'acorn.webp', car: 'car.webp'
  };

  var current = '', undo = null, el = null, waiting = null;

  function find() {
    if (el && el.isConnected !== false && document.contains(el)) return el;
    el = document.querySelector('[data-wc-marker]');
    current = '';
    undo = null;
    return el;
  }

  // Шаблоны двигают значок по 'scroll' — пусть сразу поставят новый на место
  function nudge() {
    try { window.dispatchEvent(new Event('scroll')); } catch (e) {}
  }

  // Голубь или машинка размером с прежнее сердечко (17 px у «Нежности») неразличимы:
  // мелкий значок подменяется картинкой покрупнее — не меньше MIN_PX на экране, центр тот же
  var MIN_PX = 30, MAX_K = 2.2;
  function grow(w, h) { return Math.min(MAX_K, Math.max(1, MIN_PX / Math.max(w, h, 1))); }

  // SVG-значок (<image>, <path>, <g>…): своя картинка рядом, в его рамке; x/y/размер
  // и transform — следом за ним (шаблон двигает значок то атрибутами, то transform)
  function overlaySvg(m, src) {
    var isImage = m.tagName.toLowerCase() === 'image';
    var num = function (a) { return parseFloat(m.getAttribute(a)) || 0; };
    var bb = null;
    try { bb = isImage ? { x: num('x'), y: num('y'), width: num('width'), height: num('height') } : m.getBBox(); } catch (e) {}
    var sr = m.getBoundingClientRect();
    if (!bb || !bb.width || !bb.height || !sr.width || !sr.height) return null;   // ещё не разложен — позже
    var k = grow(sr.width, sr.height);
    var img = document.createElementNS(NS, 'image');
    img.setAttribute('class', 'wc-mk');
    img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    img.setAttribute('href', src);
    img.style.pointerEvents = 'none';
    var place = function () {
      var r = isImage ? { x: num('x'), y: num('y'), width: num('width'), height: num('height') } : bb;
      var w = r.width * k, h = r.height * k;
      img.setAttribute('x', (r.x - (w - r.width) / 2).toFixed(2));
      img.setAttribute('y', (r.y - (h - r.height) / 2).toFixed(2));
      img.setAttribute('width', w.toFixed(2));
      img.setAttribute('height', h.toFixed(2));
      var t = m.getAttribute('transform');
      if (t == null) img.removeAttribute('transform'); else img.setAttribute('transform', t);
    };
    place();
    m.parentNode.insertBefore(img, m.nextSibling);
    var mo = 'MutationObserver' in window ? new MutationObserver(place) : null;
    if (mo) mo.observe(m, { attributes: true, attributeFilter: ['x', 'y', 'width', 'height', 'transform'] });
    var opacity = m.style.opacity;
    m.style.opacity = '0';
    return function () {
      if (mo) mo.disconnect();
      if (img.parentNode) img.parentNode.removeChild(img);
      m.style.opacity = opacity;
    };
  }

  // <img>: та же рамка (пропорции прежней картинки), новая вписывается в неё
  function swapImg(m, src) {
    var w = m.naturalWidth || m.offsetWidth, h = m.naturalHeight || m.offsetHeight;
    if (!w || !h) return null;
    var old = m.getAttribute('src'), ar = m.style.aspectRatio, fit = m.style.objectFit, hgt = m.style.height;
    m.style.aspectRatio = w + ' / ' + h;
    m.style.height = 'auto';
    m.style.objectFit = 'contain';
    m.setAttribute('src', src);
    return function () {
      m.setAttribute('src', old);
      m.style.aspectRatio = ar;
      m.style.objectFit = fit;
      m.style.height = hgt;
    };
  }

  // Другой HTML-элемент (у «Айвори» — сердце-SVG в span): картинка поверх, своё — прячем
  function overlayHtml(m, src) {
    if (!m.offsetWidth || !m.offsetHeight) return null;     // блок скрыт — позже
    var img = document.createElement('img');
    img.className = 'wc-mk';
    img.alt = '';
    img.src = src;
    img.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain;pointer-events:none;' +
      'transform:scale(' + grow(m.offsetWidth, m.offsetHeight).toFixed(3) + ')';
    var kids = [].slice.call(m.children).map(function (k) { var v = k.style.visibility; k.style.visibility = 'hidden'; return [k, v]; });
    var pos = m.style.position;
    if (window.getComputedStyle(m).position === 'static') m.style.position = 'relative';
    m.appendChild(img);
    return function () {
      if (img.parentNode) img.parentNode.removeChild(img);
      kids.forEach(function (kv) { kv[0].style.visibility = kv[1]; });
      m.style.position = pos;
    };
  }

  function apply(name, attempt) {
    var m = find();
    if (!m) return;
    if (!LIST[name] || m.getAttribute('data-wc-marker') === name) name = '';   // свой ключ — свой значок
    clearTimeout(waiting);
    if (name === current) return;
    if (undo) { undo(); undo = null; }
    m.removeAttribute('data-wc-marker-swapped');
    current = name;
    if (name) {
      var src = BASE + LIST[name];
      var svg = m instanceof SVGElement, tag = m.tagName.toLowerCase();
      if (tag === 'img' && !m.complete) {
        // своя картинка ещё не загрузилась (loading="lazy") — по её рамке, когда загрузится
        current = '';
        m.addEventListener('load', function () { apply(wanted); }, { once: true });
        return;
      }
      undo = svg ? overlaySvg(m, src) : tag === 'img' ? swapImg(m, src) : overlayHtml(m, src);
      if (!undo) {
        // значок ещё не разложен (блок программы скрыт) — чуть позже, но не бесконечно
        current = '';
        if ((attempt || 0) < 25) waiting = setTimeout(function () { apply(wanted, (attempt || 0) + 1); }, 400);
        return;
      }
      m.setAttribute('data-wc-marker-swapped', name);
    }
    nudge();
  }

  var wanted = '';
  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin || e.source !== window.parent) return;
    var p = e.data && e.data.type === 'wc:data' && e.data.payload;
    if (!p) return;
    wanted = typeof p.trackMarker === 'string' ? p.trackMarker : '';
    // после обработчика шаблона: он мог перестроить программу
    setTimeout(function () { apply(wanted); }, 0);
  });

  window.WCTrackMarker = { set: apply, list: Object.keys(LIST), current: function () { return current; } };
})();
