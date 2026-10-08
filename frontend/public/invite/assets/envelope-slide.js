/* ============================================================
   ENVELOPE-SLIDE.JS — первый экран: конверт из двух створок белой
   бумаги с золотой печатью-монограммой (с 06.10.26 у «Нежности»).

   Подключение — ПЕРВЫМ элементом <body>, до разметки и script.js шаблона:
     <script src="../assets/envelope-slide.js" data-groom="Евгений"
             data-bride="Надежда" data-hint="Нажмите, чтобы открыть"></script>
   Буквы на печати — первые буквы имён жениха и невесты (шрифт Great Vibes
   шаблон подключает сам). Надпись над печатью пара меняет в редакторе
   (customData.envelopeHint).

   Гость: конверт поверх сайта, по шву пробивается тёплый свет, падают
   лепестки. Касание — печать вдавливается, створки разъезжаются: левая
   с печатью — влево, правая — вправо. Второе касание — пропустить.
   Договор с script.js шаблона — как у других конвертов: пока конверт
   закрыт, window.WCEnvelope.active = true; когда обложке пора появляться —
   событие 'wc:envelope-open'.

   Редактор (editing=1): конверт — первый экран превью, а не поверх сайта
   (к нему листает раздел «Конверт»), и кнопка «Посмотреть, как откроется».
   intro=0 — анимация открытия не входит в тариф (бесплатный): конверта нет.
   ============================================================ */
(function () {
  'use strict';

  var script = document.currentScript;
  var attr = function (n, def) { return (script && script.getAttribute(n)) || def; };
  var BASE = (script && script.src ? script.src.replace(/[^/]*$/, '') : '/invite/assets/') + 'envelope-slide/';
  var Q = new URLSearchParams(window.location.search);
  var EDITING = Q.get('editing') === '1';
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  if (!document.body || Q.get('intro') === '0') { window.WCEnvelope = { active: false }; return; }

  var D = {
    groom: (Q.get('groom') || attr('data-groom', '')).trim(),
    bride: (Q.get('bride') || attr('data-bride', '')).trim(),
    hint: attr('data-hint', 'Нажмите, чтобы открыть')
  };
  var first = function (s) { return (s || '').trim().charAt(0).toUpperCase(); };

  /* ─── Вид ─── */
  // Лепесток белой розы: три вида (чашечкой, сбоку «лодочкой», вытянутый),
  // у каждого — тень завитка по краю, тёплое основание и блик
  var PETALS = [
    ['M50 96C35 90 18 74 14 55 10 36 17 17 33 10c8-3 13 2 17 8 4-6 10-12 18-9 16 7 23 27 18 47-4 19-21 34-36 40z',
     'M14 55C10 36 17 17 33 10 24 20 20 36 22 52s12 30 28 44C35 90 18 74 14 55z'],
    ['M6 62C18 36 47 21 94 27 83 49 58 71 15 76 10 72 7 67 6 62z',
     'M6 62C18 36 47 21 94 27 62 30 36 42 20 64 15 69 10 68 6 62z'],
    ['M50 4c20 14 28 44 20 70-6 16-16 24-24 22-10-6-16-26-14-50 2-20 8-34 18-42z',
     'M50 4c20 14 28 44 20 70-6 16-16 24-24 22 12-6 18-22 18-44 0-20-6-36-14-48z']
  ].map(function (d) {
    return 'url("data:image/svg+xml,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<defs><radialGradient id="g" cx="50%" cy="32%" r="72%"><stop offset="0" stop-color="#fff"/>' +
      '<stop offset=".55" stop-color="#fbf7f4"/><stop offset="1" stop-color="#ebe0d9"/></radialGradient>' +
      '<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#f3ddd2" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="#e6c6b6" stop-opacity=".85"/></linearGradient></defs>' +
      '<path d="' + d[0] + '" fill="url(#g)"/><path d="' + d[0] + '" fill="url(#b)"/>' +
      '<path d="' + d[1] + '" fill="#c9b4a8" fill-opacity=".38"/></svg>') + '")';
  });

  var css =
    'html.wc-slide-lock,html.wc-slide-lock body{overflow:hidden!important;height:100%}' +
    '.wc-slide{position:fixed;inset:0;z-index:90;overflow:hidden;cursor:pointer;outline:none;' +
      '--seal:min(30.6vw,17.2vh,240px);' +
      'touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}' +
    '.wc-slide--inline{position:relative;inset:auto;z-index:auto;height:100vh;cursor:default;touch-action:auto;' +
      'background:#f4f0ed}' +
    // Створки — бумага с фактурой (envelope-slide/paper.jpg, бесшовная): квадратами,
    // по высоте створки ровно три штуки (мелкое зерно на любом экране). Поверх
    // лёгкая светотень: левая створка чуть светлее и лежит на правой, у шва — складка и тень.
    '.wc-slide__half{position:absolute;top:0;bottom:0;width:50%;will-change:transform;background-color:#fafafa;' +
      'background-size:auto,auto,auto 33.3334%;background-repeat:no-repeat,no-repeat,repeat;' +
      'transition:transform 1.5s cubic-bezier(.58,.02,.22,1)}' +
    '.wc-slide__half--r{right:0;z-index:1;' +
      'background-image:linear-gradient(90deg,rgba(60,50,45,.22) 0,rgba(60,50,45,.08) 5px,rgba(60,50,45,0) 22px),' +
      'radial-gradient(130% 75% at 85% 15%,rgba(255,255,255,.2) 0%,rgba(110,108,116,.04) 55%,rgba(100,98,108,.1) 100%),' +
      'url("' + BASE + 'paper.jpg")}' +
    '.wc-slide__half--l{left:0;z-index:2;' +
      'background-image:linear-gradient(270deg,rgba(80,72,70,.55) 0,rgba(140,132,130,.22) 1.5px,rgba(255,255,255,0) 3px),' +
      'radial-gradient(140% 80% at 70% 18%,rgba(255,255,255,.35) 0%,rgba(255,255,255,0) 50%,rgba(110,100,95,.06) 100%),' +
      'url("' + BASE + 'paper.jpg");' +
      'box-shadow:3px 0 9px rgba(60,48,40,.10)}' +
    '.wc-slide.is-open .wc-slide__half--l{transform:translateX(-101%)}' +
    '.wc-slide.is-open .wc-slide__half--r{transform:translateX(101%)}' +
    // тёплый свет из щели: тонкая линия по шву + ореол у печати
    '.wc-slide__glow{position:absolute;top:0;bottom:0;right:-2px;width:4px;pointer-events:none;' +
      'background:linear-gradient(180deg,rgba(255,214,160,0) 6%,rgba(255,214,160,.55) 28%,rgba(255,186,112,.95) 46%,' +
      'rgba(255,160,80,1) 50%,rgba(255,186,112,.95) 54%,rgba(255,214,160,.55) 72%,rgba(255,214,160,0) 94%);' +
      'box-shadow:0 0 10px 2px rgba(255,180,100,.45);animation:wcSlideGlow 2.6s ease-in-out infinite alternate;' +
      'transition:opacity .5s ease}' +
    '@keyframes wcSlideGlow{from{opacity:.7}to{opacity:1}}' +
    '.wc-slide__halo{position:absolute;right:0;top:50%;width:calc(var(--seal)*1.5);height:calc(var(--seal)*1.5);' +
      'transform:translate(50%,-50%);pointer-events:none;border-radius:50%;' +
      'background:radial-gradient(closest-side,rgba(255,176,96,.42) 0,rgba(255,176,96,.18) 62%,rgba(255,176,96,0) 100%);' +
      'transition:opacity .5s ease}' +
    // печать с буквами — на краю левой створки
    '.wc-slide__seal{position:absolute;right:0;top:50%;width:var(--seal);aspect-ratio:336/339;' +
      'transform:translate(50%,-50%);transition:transform .32s cubic-bezier(.3,.7,.3,1)}' +
    '.wc-slide__seal img{position:absolute;inset:0;width:100%;height:100%;display:block;' +
      'filter:drop-shadow(0 calc(var(--seal)*.035) calc(var(--seal)*.05) rgba(70,45,15,.35))}' +
    // монограмма — SVG поверх картинки печати (viewBox = её пиксели), место букв считает layoutMono()
    // тиснение — CSS-фильтром всего слоя (SVG-фильтр в Chrome оставлял полоску по краю своей области)
    '.wc-slide__mono{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;' +
      'filter:drop-shadow(-.6px -.6px 0 rgba(255,244,214,.85)) drop-shadow(.8px 1.1px .5px rgba(84,52,14,.75));' +
      'opacity:0;transition:opacity .3s ease}' +
    '.wc-slide__mono.is-set{opacity:1}' +
    '.wc-slide__mono text{font-family:"Great Vibes",cursive;font-weight:400}' +
    // надпись дугой над печатью
    '.wc-slide__hint{position:absolute;left:50%;bottom:100%;width:calc(var(--seal)*1.3);height:auto;overflow:visible;' +
      'transform:translate(-50%,24%);pointer-events:none;transition:opacity .3s ease;' +
      'font-family:Alice,"Cormorant Garamond",Georgia,serif;fill:#b38a3c}' +
    '.wc-slide.is-pressed .wc-slide__hint{opacity:0}' +
    '.wc-slide.is-pressed .wc-slide__seal{transform:translate(50%,-50%) scale(.93)}' +
    '.wc-slide.is-open .wc-slide__seal{transform:translate(50%,-50%) scale(1)}' +
    '.wc-slide.is-pressed .wc-slide__glow{animation:none;opacity:1;box-shadow:0 0 22px 6px rgba(255,180,100,.6)}' +
    '.wc-slide.is-open .wc-slide__glow,.wc-slide.is-open .wc-slide__halo{opacity:0}' +
    // лепестки падают поверх конверта
    '.wc-slide__petals{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden;transition:opacity 1.2s ease}' +
    '.wc-slide.is-open .wc-slide__petals{opacity:0}' +
    '.wc-slide__petal{position:absolute;top:0;width:var(--s);height:var(--s);' +
      'animation:wcSlideFall var(--t) linear var(--d) infinite}' +
    '.wc-slide__petal i{display:block;width:100%;height:100%;background:center/contain no-repeat;' +
      'filter:drop-shadow(0 3px 4px rgba(90,64,50,.16));animation:wcSlideSpin var(--r) ease-in-out var(--d) infinite alternate}' +
    '@keyframes wcSlideFall{from{transform:translate3d(0,-12vh,0)}to{transform:translate3d(var(--dx),112vh,0)}}' +
    '@keyframes wcSlideSpin{from{transform:rotate(var(--a0)) rotateX(8deg) rotateY(0deg)}to{transform:rotate(var(--a1)) rotateX(58deg) rotateY(35deg)}}' +
    '.wc-slide__replay{position:absolute;left:50%;bottom:72px;transform:translateX(-50%);z-index:4;' +
      'font:500 14px/1 system-ui,-apple-system,"Segoe UI",sans-serif;color:#6b4f2f;background:rgba(255,252,247,.95);' +
      'border:1px solid #dcc8a9;border-radius:999px;padding:10px 18px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.12);white-space:nowrap}' +
    '.wc-slide__replay[disabled]{opacity:.55;cursor:default}' +
    '@media (prefers-reduced-motion:reduce){.wc-slide__petal,.wc-slide__petal i,.wc-slide__glow{animation:none!important}' +
      '.wc-slide__half{transition-duration:.01s}}';
  var st = document.createElement('style');
  st.textContent = css;
  (document.head || root).appendChild(st);

  /* ─── Разметка ─── */
  var uid = 'wcSlideArc' + Math.random().toString(36).slice(2, 7);
  var el = document.createElement('div');
  el.className = 'wc-slide' + (EDITING ? ' wc-slide--inline' : '');
  el.setAttribute('data-wc-section', 'envelope');
  if (!EDITING) {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Открыть приглашение');
  }
  el.innerHTML =
    '<div class="wc-slide__half wc-slide__half--r"></div>' +
    '<div class="wc-slide__half wc-slide__half--l">' +
      '<div class="wc-slide__halo"></div><div class="wc-slide__glow"></div>' +
      '<div class="wc-slide__seal">' +
        '<svg class="wc-slide__hint" viewBox="0 0 260 110" aria-hidden="true">' +
          '<path id="' + uid + '" d="M 22 104 A 112 112 0 0 1 238 104" fill="none"/>' +
          '<text font-size="22" letter-spacing=".4"><textPath href="#' + uid + '" startOffset="50%" text-anchor="middle"' +
          (EDITING ? ' data-edit="envelopeHint"' : '') + '></textPath></text>' +
        '</svg>' +
        '<img src="' + BASE + 'seal-gold.webp" alt="" draggable="false" />' +
        '<svg class="wc-slide__mono" viewBox="0 0 336 339" aria-hidden="true">' +
          '<defs><linearGradient id="' + uid + 'g" gradientUnits="userSpaceOnUse" x1="70" y1="60" x2="266" y2="280">' +
            '<stop offset="0" stop-color="#fbe9bf"/><stop offset=".3" stop-color="#e6c27d"/><stop offset=".58" stop-color="#c08a43"/>' +
            '<stop offset=".8" stop-color="#e9cc8f"/><stop offset="1" stop-color="#b07a36"/></linearGradient></defs>' +
          '<g fill="url(#' + uid + 'g)"><text></text><text></text></g>' +
        '</svg>' +
      '</div>' +
    '</div>' +
    '<div class="wc-slide__petals" aria-hidden="true"></div>' +
    (EDITING ? '<button type="button" class="wc-slide__replay">▶ Посмотреть, как откроется</button>' : '');
  document.body.insertBefore(el, document.body.firstChild);
  var monoSvg = el.querySelector('.wc-slide__mono');
  var mono = monoSvg.querySelectorAll('text');
  var hintPath = el.querySelector('.wc-slide__hint textPath');
  var replay = el.querySelector('.wc-slide__replay');

  /* ─── Монограмма: две буквы внутри лица печати ───
     Размер и место — по реальным контурам букв (canvas): вторая буква правее
     и ниже первой и заходит на неё, пара вместе стоит по центру лица печати
     и целиком помещается в круг R_INK — у любых имён, и с длинными росчерками. */
  var FACE_X = 166.5, FACE_Y = 167.5;   // центр лица печати в seal-gold.webp (336×339)
  var R_INK = 96;                       // круг для букв (лицо печати — до 120, дальше кольцо)
  var F_MAX = 150;                      // кегль не больше: короткие буквы не раздуваются
  var K2 = 0.92;                        // вторая буква чуть меньше первой
  var FAM = '"Great Vibes", cursive';

  function inkBox(ctx, ch, k) {
    var m = ctx.measureText(ch);
    if (m.actualBoundingBoxRight == null) return { l: 0, r: m.width / 100 * k, t: -.75 * k, b: .25 * k };
    return { l: -m.actualBoundingBoxLeft / 100 * k, r: m.actualBoundingBoxRight / 100 * k,
             t: -m.actualBoundingBoxAscent / 100 * k, b: m.actualBoundingBoxDescent / 100 * k };
  }

  function layoutMono() {
    var a = mono[0].textContent, b = mono[1].textContent;
    var c = layoutMono.c || (layoutMono.c = document.createElement('canvas'));
    c.width = 336; c.height = 339;
    var ctx = c.getContext('2d');
    if (!ctx) { monoSvg.classList.add('is-set'); return; }
    // контуры в долях кегля первой буквы (начало буквы — точка базовой линии)
    ctx.font = '100px ' + FAM;
    var A = inkBox(ctx, a, 1), B = inkBox(ctx, b, K2);
    var ox = .38 * ((A.r - A.l) + (B.r - B.l)) / 2;     // центр второй — правее…
    var oy = .30 * ((A.b - A.t) + (B.b - B.t)) / 2;     // …и ниже центра первой
    var bx = (A.l + A.r) / 2 + ox - (B.l + B.r) / 2;
    var by = (A.t + A.b) / 2 + oy - (B.t + B.b) / 2;
    var x0 = Math.min(A.l, bx + B.l), x1 = Math.max(A.r, bx + B.r);
    var y0 = Math.min(A.t, by + B.t), y1 = Math.max(A.b, by + B.b);
    var f = Math.min(F_MAX, 2 * R_INK / Math.max(x1 - x0, .01), 2 * R_INK / Math.max(y1 - y0, .01));
    var ax = FACE_X - f * (x0 + x1) / 2, ay = FACE_Y - f * (y0 + y1) / 2;
    // По пикселям: самая дальняя точка букв от центра — не дальше R_INK
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.font = f + 'px ' + FAM; ctx.fillText(a, ax, ay);
    ctx.font = f * K2 + 'px ' + FAM; ctx.fillText(b, ax + f * bx, ay + f * by);
    var px = ctx.getImageData(0, 0, c.width, c.height).data, far = 0;
    for (var i = 3, n = 0; i < px.length; i += 4, n++) {
      if (px[i] < 96) continue;
      var dx = n % c.width - FACE_X, dy = (n / c.width | 0) - FACE_Y;
      if (dx * dx + dy * dy > far) far = dx * dx + dy * dy;
    }
    far = Math.sqrt(far);
    if (far > R_INK) {                    // уменьшаем вокруг центра лица
      var s = R_INK / far;
      f *= s; ax = FACE_X + (ax - FACE_X) * s; ay = FACE_Y + (ay - FACE_Y) * s;
    }
    var set = function (t, x, y, size) {
      t.setAttribute('x', x.toFixed(2)); t.setAttribute('y', y.toFixed(2)); t.setAttribute('font-size', size.toFixed(2));
    };
    set(mono[0], ax, ay, f);
    set(mono[1], ax + f * bx, ay + f * by, f * K2);
    monoSvg.classList.add('is-set');
  }

  // Буквы считаем по загруженному шрифту; не дождались — считаем по тому, что есть
  function placeMono() {
    var text = mono[0].textContent + mono[1].textContent;
    var done = false;
    var go = function () { if (!done) { done = true; layoutMono(); } };
    if (document.fonts && document.fonts.load) {
      document.fonts.load('100px ' + FAM, text).then(go, go);
      setTimeout(go, 3000);
    } else go();
  }
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', function () { layoutMono(); });
  }

  function render() {
    mono[0].textContent = first(D.groom) || 'Е';
    mono[1].textContent = first(D.bride) || 'Н';
    hintPath.textContent = D.hint;
    el.setAttribute('aria-label', (D.hint || 'Открыть приглашение'));
    placeMono();
  }
  render();

  // Лепестки: разные размеры, скорость, снос и вращение; два ближних — размыты
  (function petals() {
    var box = el.querySelector('.wc-slide__petals');
    var n = REDUCED ? 6 : 10;
    for (var i = 0; i < n; i++) {
      var near = i < 2;
      var p = document.createElement('div');
      p.className = 'wc-slide__petal';
      var s = near ? 62 + Math.random() * 20 : 24 + Math.random() * 20;
      var t = (near ? 7 : 10) + Math.random() * 7;
      p.style.cssText = '--s:' + s.toFixed(0) + 'px;--t:' + t.toFixed(1) + 's;--d:-' + (Math.random() * t).toFixed(1) + 's;' +
        '--dx:' + ((Math.random() - .35) * 26).toFixed(0) + 'vw;--r:' + (2.4 + Math.random() * 2.6).toFixed(1) + 's;' +
        '--a0:' + (Math.random() * 360).toFixed(0) + 'deg;--a1:' + (Math.random() * 360 + 140).toFixed(0) + 'deg;' +
        // ближние крупные — по краям, чтобы не заслонять печать и надпись
        'left:' + (near ? (i ? 72 + Math.random() * 22 : Math.random() * 18) : Math.random() * 100).toFixed(1) + '%;' +
        (near ? 'filter:blur(1.6px);opacity:.9;' : '');
      var img = document.createElement('i');
      img.style.backgroundImage = PETALS[i % 3];
      p.appendChild(img);
      if (REDUCED) { p.style.animation = 'none'; p.style.top = (10 + Math.random() * 80).toFixed(0) + '%'; }
      box.appendChild(p);
    }
  })();

  window.WCEnvelope = {
    active: !EDITING,
    setEnabled: function (enabled) { if (!enabled && !EDITING) reveal(true); }
  };
  if (!EDITING) root.classList.add('wc-slide-lock');

  /* ─── Открытие ─── */
  var phase = 'closed';            // closed → opening → done
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  function fireOpen() {
    if (fireOpen.done) return;
    fireOpen.done = true;
    window.WCEnvelope.active = false;
    root.classList.remove('wc-slide-lock');
    try { window.dispatchEvent(new Event('wc:envelope-open')); }
    catch (e) {
      var ev = document.createEvent('Event');
      ev.initEvent('wc:envelope-open', false, false);
      window.dispatchEvent(ev);
    }
  }

  // Убрать конверт: сразу (пара выключила раздел, «меньше движения», второе касание)
  function reveal(instant) {
    if (EDITING || phase === 'done') return;
    phase = 'done';
    timers.forEach(clearTimeout);
    fireOpen();
    if (instant || REDUCED) {
      if (el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    el.classList.add('is-open');
    el.style.pointerEvents = 'none';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1700);
  }

  function open(e) {
    if (e && e.type === 'keydown') e.preventDefault();
    if (EDITING) return;
    if (phase === 'opening') { reveal(true); return; }   // второе касание — пропустить
    if (phase !== 'closed') return;
    if (REDUCED) { reveal(true); return; }
    phase = 'opening';
    el.classList.add('is-pressed');                       // печать вдавливается, надпись гаснет
    later(function () { el.classList.add('is-open'); }, 380);       // створки разъезжаются
    later(fireOpen, 380 + 550);                                     // обложке пора появляться
    later(function () {
      phase = 'done';
      el.style.pointerEvents = 'none';
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 380 + 1550);
  }

  // Редактор: проиграть открытие и вернуть конверт на место
  function preview() {
    if (phase !== 'closed') return;
    phase = 'opening';
    if (replay) replay.disabled = true;
    el.classList.add('is-pressed');
    later(function () { el.classList.add('is-open'); }, 380);
    later(function () { el.classList.remove('is-open', 'is-pressed'); }, 380 + 2600);
    later(function () { phase = 'closed'; if (replay) replay.disabled = false; }, 380 + 4300);
  }

  if (!EDITING) {
    el.addEventListener('click', open);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') open(e);
    });
    // Пока конверт закрыт, страница под ним не прокручивается
    el.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    el.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
  } else if (replay) {
    replay.addEventListener('click', preview);
  }

  /* ─── Данные редактора и страницы гостя ─── */
  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin || e.source !== window.parent) return;
    var p = e.data && e.data.type === 'wc:data' && e.data.payload;
    if (!p) return;
    var changed = false;
    ['groom', 'bride'].forEach(function (k) {
      var v = p[k + 'Name'];
      if (typeof v === 'string' && v.trim() && v.trim() !== D[k]) { D[k] = v.trim(); changed = true; }
    });
    if (typeof p.envelopeHint === 'string') {
      var h = p.envelopeHint.trim() || attr('data-hint', 'Нажмите, чтобы открыть');
      if (h !== D.hint) { D.hint = h; changed = true; }
    }
    if (changed) render();
  });
})();
