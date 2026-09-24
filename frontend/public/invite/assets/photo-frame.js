/* ── Кадрирование фото в рамках (общий модуль всех шаблонов) ─────────────────
   Пара в редакторе двигает фото внутри рамки, меняет масштаб и поворачивает.
   Настройки приходят в данных: photoFrames = { <id поля>: { x, y, z, r } }
     x, y — положение фото в рамке 0…100 (как object-position: 0 — фото прижато
            к левому/верхнему краю рамки, 50 — по центру, 100 — к правому/нижнему);
            при повороте — вдоль сторон самого фото;
     z    — масштаб: 1 — фото ровно заполняет рамку (как cover), дальше крупнее;
     r    — поворот в градусах по часовой стрелке (−180…180), фото всё равно
            заполняет рамку целиком — без пустых углов.
   Фото — это <img data-edit="id"> или SVG <image data-edit="id">.

   Форму рамки не трогаем: у полароидов Скетча clip-path-многоугольник, в коллаже
   Средиземноморья — «капли», в дресс-коде — скругления. Поэтому кадр рисуется
   ФОНОМ самого <img> (фон режется той же формой), а исходная картинка уводится
   за пределы рамки через object-position. Повёрнутое фото фон повернуть не
   может — его рисуем на canvas под размер рамки и ставим фоном (blob). Для
   этого фото грузится с CORS: api.weddingcraft.ru отдаёт заголовки для наших
   доменов; не пустил — показываем кадр без поворота.
   SVG <image> (арка Флорального) кадрируется атрибутами x/y/width/height и
   transform; clip-path арки переносится на обёртку <g>, чтобы не вращался.

   Подключение: <script src="../assets/photo-frame.js"> ДО script.js шаблона,
   в applyData — WCPhotoFrame.apply(d.photoFrames).
   В редакторе (editing=1) модуль сообщает родителю пропорции рамок, текущее фото
   и исходное положение: { type: 'wc:photo-slots', slots: { id: { w, h, x, y, src } } }
   — по ним рисуется окно кадрирования. */
(function () {
  'use strict';

  var EDITING = new URLSearchParams(location.search).get('editing') === '1';
  var XLINK = 'http://www.w3.org/1999/xlink';
  var SVGNS = 'http://www.w3.org/2000/svg';
  var MAX_Z = 4;

  var frames = {};    // последние настройки кадров
  var framed = [];    // элементы, на которые наложен кадр (чтобы вернуть как было)
  var sizes = {};     // url → натуральный размер (для SVG <image>)
  var corsImgs = {};  // url → картинка, загруженная с CORS (для повёрнутых кадров)

  function clamp(v, lo, hi) { v = +v; return isNaN(v) ? lo : Math.min(hi, Math.max(lo, v)); }

  function norm(f) {
    if (!f || typeof f !== 'object') return null;
    var r = +f.r || 0;
    r = ((r % 360) + 540) % 360 - 180;       // −180…180
    return {
      x: clamp(f.x == null ? 50 : f.x, 0, 100),
      y: clamp(f.y == null ? 50 : f.y, 0, 100),
      z: clamp(f.z == null ? 1 : f.z, 1, MAX_Z),
      r: Math.abs(r) < 0.05 ? 0 : r,
    };
  }

  /* Геометрия кадра в рамке W×H: фото (iw×ih) повёрнуто на r и заполняет рамку.
     Рамка, повёрнутая обратно, вписана в прямоугольник bw×bh вдоль сторон фото —
     его фото и должно покрывать; x/y двигают его по оставшемуся запасу. */
  function geometry(W, H, iw, ih, f) {
    var th = f.r * Math.PI / 180;
    var c = Math.abs(Math.cos(th)), s = Math.abs(Math.sin(th));
    var bw = W * c + H * s, bh = W * s + H * c;
    var k = Math.max(bw / iw, bh / ih) * f.z;
    var rw = iw * k, rh = ih * k;
    return {
      th: th, w: rw, h: rh,
      // левый верхний угол фото относительно центра рамки, в осях фото
      left: -bw / 2 - (rw - bw) * f.x / 100,
      top: -bh / 2 - (rh - bh) * f.y / 100,
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

  // Повёрнутый кадр больше не нужен: отменяем ждущую отрисовку, освобождаем blob
  function dropRotated(el) {
    el.__wcToken = (el.__wcToken || 0) + 1;
    if (el.__wcBlob) { URL.revokeObjectURL(el.__wcBlob); el.__wcBlob = null; }
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
    // src, а не currentSrc: сразу после смены фото currentSrc ещё старый
    var src = String(el.src || el.currentSrc);
    var s = el.style;
    s.backgroundRepeat = 'no-repeat';
    s.backgroundOrigin = 'content-box';
    s.backgroundClip = 'content-box';
    s.objectFit = 'none';
    s.objectPosition = '-99999px -99999px';
    // Без поворота (и пока готовится повёрнутый) — фото фоном с процентами:
    // масштаб по высоте, если фото шире рамки, иначе по ширине
    if (!f.r || !el.__wcBlob) {
      var pct = +(f.z * 100).toFixed(3) + '%';
      s.backgroundImage = 'url("' + src.replace(/["\\]/g, '\\$&') + '")';
      s.backgroundSize = iw / ih > box.w / box.h ? 'auto ' + pct : pct + ' auto';
      s.backgroundPosition = f.x + '% ' + f.y + '%';
    }
    if (f.r) renderRotated(el, f, box, src); else dropRotated(el);
  }

  /* ── повёрнутое фото: canvas под размер рамки → фон ── */
  function corsImage(url, cb) {
    var c = corsImgs[url];
    if (c) {
      if (c.ok) cb(c.img); else if (c.fail) cb(null); else c.cbs.push(cb);
      return;
    }
    c = corsImgs[url] = { img: new Image(), ok: false, fail: false, cbs: [cb] };
    var flush = function () { c.cbs.splice(0).forEach(function (fn) { fn(c.ok ? c.img : null); }); };
    c.img.crossOrigin = 'anonymous';
    c.img.onload = function () { c.ok = true; flush(); };
    c.img.onerror = function () { c.fail = true; flush(); };
    var abs;
    try { abs = new URL(url, location.href); } catch (e) { abs = null; }
    // С чужого домена — отдельным адресом: копия из кэша без CORS-заголовков
    // (её уже загрузил сам <img>) «испортила» бы холст, особенно в Safari
    if (abs && /^https?:$/.test(abs.protocol) && abs.origin !== location.origin) {
      abs.searchParams.set('wc-cors', '1');
      c.img.src = abs.href;
    } else {
      c.img.src = url;
    }
  }

  function renderRotated(el, f, box, src) {
    var token = el.__wcToken = (el.__wcToken || 0) + 1;
    corsImage(src, function (img) {
      if (!img || token !== el.__wcToken || !el.__wcFrame) return;   // не пустили или кадр уже другой
      var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      var area = box.w * box.h * dpr * dpr;
      if (area > 4e6) dpr *= Math.sqrt(4e6 / area);                    // не больше ~4 Мп
      var cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(box.w * dpr));
      cv.height = Math.max(1, Math.round(box.h * dpr));
      var ctx = cv.getContext('2d');
      if (!ctx) return;
      var g = geometry(box.w, box.h, img.naturalWidth || 1, img.naturalHeight || 1, f);
      ctx.scale(cv.width / box.w, cv.height / box.h);
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(box.w / 2, box.h / 2);
      ctx.rotate(g.th);
      ctx.drawImage(img, g.left, g.top, g.w, g.h);
      var type = /\.png([?#]|$)/i.test(src) ? 'image/png' : 'image/jpeg';
      try {
        cv.toBlob(function (blob) {
          cv.width = cv.height = 0;
          if (!blob || token !== el.__wcToken || !el.__wcFrame) return;
          var old = el.__wcBlob;
          el.__wcBlob = URL.createObjectURL(blob);
          var s = el.style;
          s.backgroundImage = 'url("' + el.__wcBlob + '")';
          s.backgroundSize = '100% 100%';
          s.backgroundPosition = '0 0';
          if (old) URL.revokeObjectURL(old);
        }, type, 0.92);
      } catch (e) { /* холст «испорчен» чужой картинкой — остаётся кадр без поворота */ }
    });
  }

  /* ── SVG <image>: кадр атрибутами, clip-path остаётся на месте ── */
  var SVG_ATTRS = ['x', 'y', 'width', 'height', 'preserveAspectRatio', 'transform'];

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

  // clip-path повернулся бы вместе с картинкой — переносим его на обёртку <g>
  function liftClip(el) {
    var clip = el.getAttribute('clip-path');
    if (!clip || !el.parentNode) return;
    var g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('clip-path', clip);
    el.removeAttribute('clip-path');
    el.parentNode.insertBefore(g, el);
    g.appendChild(el);
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
      var g = geometry(bw, bh, iw, ih, f);
      var cx = bx + bw / 2, cy = by + bh / 2;
      el.setAttribute('x', +(cx + g.left).toFixed(3));
      el.setAttribute('y', +(cy + g.top).toFixed(3));
      el.setAttribute('width', +g.w.toFixed(3));
      el.setAttribute('height', +g.h.toFixed(3));
      el.setAttribute('preserveAspectRatio', 'none');
      if (f.r) {
        liftClip(el);
        el.setAttribute('transform', 'rotate(' + f.r + ' ' + +cx.toFixed(3) + ' ' + +cy.toFixed(3) + ')');
      } else if (a[5] == null) {
        el.removeAttribute('transform');
      } else {
        el.setAttribute('transform', a[5]);
      }
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
      dropRotated(el);
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
