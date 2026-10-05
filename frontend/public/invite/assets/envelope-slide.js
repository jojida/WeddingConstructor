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

  if (!document.body) { window.WCEnvelope = { active: false }; return; }

  var D = {
    groom: (Q.get('groom') || attr('data-groom', '')).trim(),
    bride: (Q.get('bride') || attr('data-bride', '')).trim(),
    hint: attr('data-hint', 'Нажмите, чтобы открыть')
  };
  var first = function (s) { return (s || '').trim().charAt(0).toUpperCase(); };

  /* ─── Вид ─── */
  // Лепесток: белый с тёплой тенью у основания (две формы — «сердечко» и вытянутый)
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
    // створки: левая чуть светлее и лежит поверх правой, у шва — складка и тень
    '.wc-slide__half{position:absolute;top:0;bottom:0;width:50%;will-change:transform;' +
      'transition:transform 1.5s cubic-bezier(.58,.02,.22,1)}' +
    '.wc-slide__half--r{right:0;z-index:1;' +
      'background:linear-gradient(90deg,rgba(60,50,45,.22) 0,rgba(60,50,45,.08) 5px,rgba(60,50,45,0) 22px),' +
      'radial-gradient(130% 75% at 85% 15%,#fbfbfb 0%,#f3f3f4 55%,#e9e8ea 100%)}' +
    '.wc-slide__half--l{left:0;z-index:2;' +
      'background:linear-gradient(270deg,rgba(80,72,70,.55) 0,rgba(140,132,130,.22) 1.5px,rgba(255,255,255,0) 3px),' +
      'radial-gradient(140% 80% at 70% 18%,#ffffff 0%,#fcfcfc 50%,#efeeee 100%);' +
      'box-shadow:3px 0 9px rgba(60,48,40,.10)}' +
    // бумажное зерно поверх обеих створок
    '.wc-slide__half::after{content:"";position:absolute;inset:0;opacity:.05;mix-blend-mode:multiply;pointer-events:none;' +
      'background-image:url("data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220"><filter id="n"><feTurbulence type="fractalNoise" ' +
        'baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .5 0 0 0 0 .45 0 0 0 0 .4 0 0 0 1 0"/>' +
        '</filter><rect width="220" height="220" filter="url(#n)"/></svg>') + '")}' +
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
    '.wc-slide__mono{position:absolute;inset:0;pointer-events:none;font-family:"Great Vibes",cursive;line-height:1}' +
    '.wc-slide__mono b{position:absolute;left:50%;top:50%;font-weight:400;white-space:nowrap;color:transparent;' +
      'background:linear-gradient(140deg,#fbe9bf 0%,#e6c27d 30%,#c08a43 58%,#e9cc8f 80%,#b07a36 100%);' +
      '-webkit-background-clip:text;background-clip:text;' +
      'filter:drop-shadow(-.6px -.6px 0 rgba(255,244,214,.85)) drop-shadow(.8px 1.1px .5px rgba(84,52,14,.75))}' +
    '.wc-slide__mono b:first-child{font-size:calc(var(--seal)*.56);transform:translate(-70%,-63%)}' +
    '.wc-slide__mono b:last-child{font-size:calc(var(--seal)*.45);transform:translate(-27%,-38%)}' +
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
        '<span class="wc-slide__mono" aria-hidden="true"><b></b><b></b></span>' +
      '</div>' +
    '</div>' +
    '<div class="wc-slide__petals" aria-hidden="true"></div>' +
    (EDITING ? '<button type="button" class="wc-slide__replay">▶ Посмотреть, как откроется</button>' : '');
  document.body.insertBefore(el, document.body.firstChild);
  var mono = el.querySelectorAll('.wc-slide__mono b');
  var hintPath = el.querySelector('.wc-slide__hint textPath');
  var replay = el.querySelector('.wc-slide__replay');

  function render() {
    mono[0].textContent = first(D.groom) || 'Е';
    mono[1].textContent = first(D.bride) || 'Н';
    hintPath.textContent = D.hint;
    el.setAttribute('aria-label', (D.hint || 'Открыть приглашение'));
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
