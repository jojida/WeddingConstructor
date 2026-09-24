/* ── Кадрирование фото в рамках (общий модуль всех шаблонов) ─────────────────
   Пара в редакторе двигает фото внутри рамки и меняет масштаб. Настройки
   приходят в данных: photoFrames = { <id поля>: { x, y, z } }
     x, y — положение фото в рамке 0…100 (как object-position: 0 — фото прижато
            к левому/верхнему краю рамки, 50 — по центру, 100 — к правому/нижнему);
     z    — масштаб: 1 — фото ровно заполняет рамку (как cover), дальше крупнее.
   Фото — это <img data-edit="id"> или SVG <image data-edit="id">.

   Форму рамки не трогаем: у полароидов Скетча clip-path-многоугольник, в коллаже
   Средиземноморья — «капли», в дресс-коде — скругления. Поэтому кадр рисуется
   ФОНОМ самого <img> (фон режется той же формой), а исходная картинка уводится
   за пределы рамки через object-position. SVG <image> (арка Флорального)
   кадрируется атрибутами x/y/width/height: clip-path арки задан в координатах
   пользователя и остаётся на месте.

   Подключение: <script src="../assets/photo-frame.js"> ДО script.js шаблона,
   в applyData — WCPhotoFrame.apply(d.photoFrames).
   В редакторе (editing=1) модуль сообщает родителю пропорции рамок, текущее фото
   и исходное положение: { type: 'wc:photo-slots', slots: { id: { w, h, x, y, src } } }
   — по ним рисуется окно кадрирования. */
(function () {
  'use strict';

  var EDITING = new URLSearchParams(location.search).get('editing') === '1';
  var XLINK = 'http://www.w3.org/1999/xlink';
  var MAX_Z = 4;

  var frames = {};    // последние настройки кадров
  var framed = [];    // элементы, на которые наложен кадр (чтобы вернуть как было)
  var sizes = {};     // url → натуральный размер (для SVG <image>)

  function clamp(v, lo, hi) { v = +v; return isNaN(v) ? lo : Math.min(hi, Math.max(lo, v)); }

  function norm(f) {
    if (!f || typeof f !== 'object') return null;
    return {
      x: clamp(f.x == null ? 50 : f.x, 0, 100),
      y: clamp(f.y == null ? 50 : f.y, 0, 100),
      z: clamp(f.z == null ? 1 : f.z, 1, MAX_Z),
    };
  }

  function esc(id) { return window.CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/["\\]/g, '\\$&'); }
  function targets(id) {
    var q = '[data-edit="' + esc(id) + '"]';
    return document.querySelectorAll('img' + q + ', image' + q);
  }
  function isSvg(el) { return el.tagName.toLowerCase() === 'image'; }
  function hrefOf(el) { return el.getAttribute('href') || el.getAttributeNS(XLINK, 'href') || ''; }

  /* Исходное положение фото в рамке — с него начинается кадрирование */
  function defaultPos(el) {
    if (isSvg(el)) {
      var par = el.getAttribute('preserveAspectRatio') || 'xMidYMid';
      return {
        x: /xMin/.test(par) ? 0 : /xMax/.test(par) ? 100 : 50,
        y: /YMin/.test(par) ? 0 : /YMax/.test(par) ? 100 : 50,
      };
    }
    var m = String(getComputedStyle(el).objectPosition).match(/(-?[\d.]+)%\s+(-?[\d.]+)%/);
    return m ? { x: +m[1], y: +m[2] } : { x: 50, y: 50 };
  }

  function contentBox(el) {
    var cs = getComputedStyle(el);
    var w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    return w > 0 && h > 0 ? { w: w, h: h } : null;
  }

  var ro = window.ResizeObserver ? new ResizeObserver(function (entries) {
    entries.forEach(function (en) { refresh(en.target); });
    scheduleReport();
  }) : null;

  /* ── <img>: кадр — фоном элемента, исходная картинка — за рамкой ── */
  var IMG_PROPS = ['backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat',
    'backgroundOrigin', 'backgroundClip', 'objectFit', 'objectPosition'];

  function rememberImg(el) {
    if (el.__wcFrame) return;
    el.__wcFrame = {
      def: defaultPos(el),
      inline: IMG_PROPS.map(function (p) { return el.style[p]; }),
    };
    framed.push(el);
    if (ro) ro.observe(el);
  }

  function frameImg(el, f) {
    var iw = el.naturalWidth, ih = el.naturalHeight;
    if (!el.complete || !iw || !ih) {
      // фото ещё грузится — вернёмся после load
      if (!el.__wcWait) {
        el.__wcWait = true;
        var done = function (e) {
          el.__wcWait = false;
          el.removeEventListener('load', done);
          el.removeEventListener('error', done);
          if (e.type === 'load') { refresh(el); scheduleReport(); }
        };
        el.addEventListener('load', done);
        el.addEventListener('error', done);
      }
      return;
    }
    rememberImg(el);
    var box = contentBox(el);
    if (!box) return;   // рамка скрыта (напр. вкладка дресс-кода) — ResizeObserver вернёт сюда
    var wide = iw / ih > box.w / box.h;          // фото шире рамки → масштаб по высоте
    var pct = +(f.z * 100).toFixed(3) + '%';
    // src, а не currentSrc: сразу после смены фото currentSrc ещё старый
    var url = String(el.src || el.currentSrc).replace(/["\\]/g, '\\$&');
    var s = el.style;
    s.backgroundImage = 'url("' + url + '")';
    s.backgroundSize = wide ? 'auto ' + pct : pct + ' auto';
    s.backgroundPosition = f.x + '% ' + f.y + '%';
    s.backgroundRepeat = 'no-repeat';
    s.backgroundOrigin = 'content-box';
    s.backgroundClip = 'content-box';
    s.objectFit = 'none';
    s.objectPosition = '-99999px -99999px';
  }

  /* ── SVG <image>: кадр атрибутами, clip-path остаётся на месте ── */
  var SVG_ATTRS = ['x', 'y', 'width', 'height', 'preserveAspectRatio'];

  function naturalSize(url, cb) {
    var c = sizes[url];
    if (c && c.w) { cb(c.w, c.h); return; }
    if (c) { c.cbs.push(cb); return; }
    c = sizes[url] = { w: 0, h: 0, cbs: [cb] };
    var im = new Image();
    im.onload = function () {
      c.w = im.naturalWidth || 1; c.h = im.naturalHeight || 1;
      c.cbs.splice(0).forEach(function (fn) { fn(c.w, c.h); });
    };
    im.onerror = function () { delete sizes[url]; };
    im.src = url;
  }

  function frameSvg(el) {
    var href = hrefOf(el);
    if (!href) return;
    if (!el.__wcFrame) {
      el.__wcFrame = {
        def: defaultPos(el),
        attrs: SVG_ATTRS.map(function (a) { return el.getAttribute(a); }),
      };
      framed.push(el);
    }
    var a = el.__wcFrame.attrs;
    var bx = +a[0] || 0, by = +a[1] || 0, bw = +a[2], bh = +a[3];
    if (!(bw > 0 && bh > 0)) return;   // размеры не в единицах пользователя — не трогаем
    naturalSize(href, function (iw, ih) {
      // пока грузилось, кадр могли поменять или снять — берём актуальный
      var f = norm(frames[el.getAttribute('data-edit')]);
      if (!f || !el.__wcFrame || hrefOf(el) !== href) return;
      var k = Math.max(bw / iw, bh / ih) * f.z;
      var rw = iw * k, rh = ih * k;
      el.setAttribute('x', +(bx + (bw - rw) * f.x / 100).toFixed(3));
      el.setAttribute('y', +(by + (bh - rh) * f.y / 100).toFixed(3));
      el.setAttribute('width', +rw.toFixed(3));
      el.setAttribute('height', +rh.toFixed(3));
      el.setAttribute('preserveAspectRatio', 'none');
    });
  }

  function restore(el) {
    var st = el.__wcFrame;
    if (!st) return;
    if (isSvg(el)) {
      SVG_ATTRS.forEach(function (name, i) {
        if (st.attrs[i] == null) el.removeAttribute(name); else el.setAttribute(name, st.attrs[i]);
      });
    } else {
      IMG_PROPS.forEach(function (p, i) { el.style[p] = st.inline[i]; });
      if (ro) ro.unobserve(el);
    }
    el.__wcFrame = null;
    var i = framed.indexOf(el);
    if (i >= 0) framed.splice(i, 1);
  }

  function refresh(el) {
    var f = norm(frames[el.getAttribute('data-edit')]);
    if (!f) { restore(el); return; }
    if (isSvg(el)) frameSvg(el); else frameImg(el, f);
  }

  /* photoFrames из данных. undefined — в данных кадров нет, ничего не меняем. */
  function apply(fr) {
    if (fr === undefined) return;
    frames = fr && typeof fr === 'object' ? fr : {};
    framed.slice().forEach(function (el) {
      if (!el.isConnected || !norm(frames[el.getAttribute('data-edit')])) restore(el);
    });
    Object.keys(frames).forEach(function (id) {
      if (!norm(frames[id])) return;
      targets(id).forEach(refresh);
    });
    scheduleReport();
  }

  /* ── Отчёт редактору: пропорции рамок и исходное положение фото ── */
  // «Вид» рамки: свои классы и классы родителя без состояний (is-hidden и т.п.)
  function classes(el) {
    return String(el.className || '').split(/\s+/)
      .filter(function (c) { return c && !/^(is-|has-)/.test(c) && c !== 'hidden'; })
      .sort().join(' ');
  }
  function kind(el) { return classes(el) + '|' + (el.parentElement ? classes(el.parentElement) : ''); }

  function slotBox(el) {
    if (isSvg(el)) {
      var a = el.__wcFrame ? el.__wcFrame.attrs : SVG_ATTRS.map(function (n) { return el.getAttribute(n); });
      return +a[2] > 0 && +a[3] > 0 ? { w: +a[2], h: +a[3] } : null;
    }
    var box = contentBox(el);
    if (box) return box;
    // рамка скрыта (мужские образы до переключения вкладки) — берём видимую такую же
    var k = kind(el);
    var all = document.querySelectorAll('img[data-edit]');
    for (var i = 0; i < all.length; i++) {
      if (all[i] !== el && kind(all[i]) === k) {
        box = contentBox(all[i]);
        if (box) return box;
      }
    }
    return null;
  }

  var reportTimer = 0;
  function scheduleReport() {
    if (!EDITING || window.parent === window) return;
    clearTimeout(reportTimer);
    reportTimer = setTimeout(report, 150);
  }
  function report() {
    var slots = {};
    document.querySelectorAll('img[data-edit], image[data-edit]').forEach(function (el) {
      var id = el.getAttribute('data-edit');
      if (!id || slots[id]) return;
      var box = slotBox(el);
      if (!box) return;
      var def = el.__wcFrame ? el.__wcFrame.def : defaultPos(el);
      var src = isSvg(el) ? hrefOf(el) : (el.src || el.currentSrc);
      try { src = new URL(src, location.href).href; } catch (e) {}
      slots[id] = { w: +box.w.toFixed(2), h: +box.h.toFixed(2), x: def.x, y: def.y, src: src };
    });
    try { window.parent.postMessage({ type: 'wc:photo-slots', slots: slots }, location.origin); } catch (e) {}
  }

  if (EDITING) {
    window.addEventListener('load', scheduleReport);
    window.addEventListener('resize', scheduleReport);
    scheduleReport();
  }

  window.WCPhotoFrame = { apply: apply, report: scheduleReport };
})();
