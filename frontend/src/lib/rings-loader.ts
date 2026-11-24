/* Загрузка «бесконечность → свадебные кольца» (тонкая розовая линия) —
   общий движок. Прототип и раскадровка — output/loader-rings/spinner.html.

   Где стоит:
   · главная — components/landing/BootLoader.tsx: блок на весь экран, скрипт
     выполняется прямо при разборе HTML и ждёт window.load, шрифты и видео
     первого экрана («режим страницы», data-wait не задан);
   · окно сайта в редакторе и в анкете «Расскажите о вашей свадьбе» —
     components/RingsLoader.tsx внутри app/editor/SitePreview.tsx: блок поверх
     окна (класс is-inline), ждёт сигнала «шаблон загрузился» (data-wait="signal").

   Как работает. Пока грузится, по бледной бесконечности бегает участок цвета
   линий. Когда загрузилось (режим страницы — window.load и document.fonts;
   режим сигнала — data-ready="1" на блоке или событие wc:boot-ready на нём),
   участок дорисовывает знак, петли округляются в два кольца, кольца
   сцепляются, появляются бриллиант, искра и два сердечка — и загрузка тает.
   Таять она ждёт ещё одного: на главной — видео первого экрана (до 2,5 с),
   в режиме сигнала — data-settled="1" / wc:boot-settled («догрузилось всё
   на виду», до 5 с). Так кольца складываются, пока докачиваются картинки.
   В режиме сигнала финал вдвое быстрее (~2 с вместо ~4 с: «сделай загрузку
   короче в редакторе», 24.11.26), на главной — прежний.
   Конец — событие wc:boot-done на блоке (в режиме страницы — ещё и на window).
   Запас: через 10 с от начала перестаём ждать, даже если что-то повисло;
   любая ошибка в анимации сразу убирает загрузку, а через 19 с она снимается
   в любом случае.

   Режим страницы: прокрутку колесом, пальцем и клавишами под загрузкой
   гасим, но без overflow:hidden на <html> — иначе при снятии загрузки
   появлялась бы полоса прокрутки и страница сдвигалась (CLS). Если React
   заменит разметку целиком (ошибка гидратации), скрипт вернёт свой блок в
   <body>, и анимация доиграет. Режим сигнала прокрутку не трогает, а блок,
   убранный со страницы, просто останавливается.

   Геометрия: фигура — всегда четыре дуги (левая верх/низ, правая верх/низ),
   порядок отрисовки [2, 1, 0, 3] даёт правильный перехлёст «над/под» и у
   бесконечности, и у сцепленных колец; перед каждой дугой — «ореол» цвета фона,
   он делает просвет в линии, уходящей вниз (поэтому фон блока — ровно RINGS_BG).
   На стыке фаз (кольца касаются) обе картинки совпадают, поэтому превращение
   идёт без скачков. */

export const RINGS_BG = '#faf8f5';   // фон сайта (--background)
const INK = '#c97b8a';               // розовый — выбран 23.11.26

const HEART = 'M0 3.4 C-1.3 2.3 -5.2 -.4 -5.2 -3.1 C-5.2 -5 -3.8 -6.2 -2.4 -6.2 C-1.3 -6.2 -.4 -5.5 0 -4.5 ' +
  'C.4 -5.5 1.3 -6.2 2.4 -6.2 C3.8 -6.2 5.2 -5 5.2 -3.1 C5.2 -.4 1.3 2.3 0 3.4 Z';
const GEM = 'M0 0 L11 -10 L6.5 -15 L-6.5 -15 L-11 -10 Z';

/* is-inline — блок внутри окна (родителю нужен position: relative): свой
   размер знака (--wb-size, не больше 60 % ширины окна), касания не гасит. */
const CSS = `
.wc-boot{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:${RINGS_BG};transition:opacity .45s ease;touch-action:none;overscroll-behavior:contain;-webkit-tap-highlight-color:transparent}
.wc-boot.is-on{display:flex}
.wc-boot.is-out{opacity:0;pointer-events:none}
.wc-boot svg{width:200px;height:200px;display:block;overflow:visible}
.wc-boot.is-inline{position:absolute;z-index:5;touch-action:auto;overscroll-behavior:auto}
.wc-boot.is-inline svg{width:var(--wb-size,200px);max-width:60%;height:auto;aspect-ratio:1/1}
.wc-boot .wb-gem-fill{fill:${RINGS_BG};opacity:0}
.wc-boot .wb-gem-line{fill:none;stroke:${INK};stroke-width:1.5px;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1}
.wc-boot .wb-spark{fill:${INK};opacity:0;transform:scale(0) rotate(-60deg);transform-box:fill-box;transform-origin:center}
.wc-boot .wb-heart{fill:none;stroke:${INK};stroke-width:1.4px;stroke-linejoin:round;opacity:0;transform:translateY(6px) scale(.3);transform-box:fill-box;transform-origin:50% 85%}
.wc-boot .is-gem .wb-gem-fill{opacity:1;transition:opacity .2s .05s}
.wc-boot .is-gem .wb-gem-line{stroke-dashoffset:0;transition:stroke-dashoffset .45s cubic-bezier(.55,0,.3,1)}
.wc-boot .is-gem .wb-l2{transition-delay:.16s}
.wc-boot .is-gem .wb-l3{transition-delay:.28s}
.wc-boot .is-gem .wb-spark{opacity:1;transform:none;transition:opacity .2s .5s,transform .5s .5s cubic-bezier(.34,1.56,.64,1)}
.wc-boot .is-gem .wb-heart{opacity:1;transform:none;transition:opacity .25s,transform .5s cubic-bezier(.34,1.56,.64,1)}
.wc-boot .is-gem .wb-h1{transition-delay:.62s}
.wc-boot .is-gem .wb-h2{transition-delay:.8s}
.wc-boot[data-wait=signal]{transition-duration:.3s}
.wc-boot[data-wait=signal] .is-gem .wb-gem-line{transition-duration:.3s}
.wc-boot[data-wait=signal] .is-gem .wb-l2{transition-delay:.1s}
.wc-boot[data-wait=signal] .is-gem .wb-l3{transition-delay:.18s}
.wc-boot[data-wait=signal] .is-gem .wb-spark{transition:opacity .15s .3s,transform .35s .3s cubic-bezier(.34,1.56,.64,1)}
.wc-boot[data-wait=signal] .is-gem .wb-heart{transition:opacity .2s,transform .35s cubic-bezier(.34,1.56,.64,1)}
.wc-boot[data-wait=signal] .is-gem .wb-h1{transition-delay:.35s}
.wc-boot[data-wait=signal] .is-gem .wb-h2{transition-delay:.45s}
`;

/* Бриллиант стоит на правом кольце (низ камня — точка 0,0 его группы). Место
   искры и сердечек задаёт внешняя <g>: CSS-transform анимации на самом пути
   затёр бы атрибут transform. */
const SVG = `<svg viewBox="-90 -90 180 180" focusable="false"><g class="wb-move"><g class="wb-lines"></g>` +
  `<g transform="translate(20 -29)"><path class="wb-gem-fill" d="${GEM}"/>` +
  `<path class="wb-gem-line" pathLength="1" d="${GEM}"/>` +
  `<path class="wb-gem-line wb-l2" pathLength="1" d="M-11 -10 L11 -10"/>` +
  `<path class="wb-gem-line wb-l3" pathLength="1" d="M-6.5 -15 L-3.2 -10 L0 -15 L3.2 -10 L6.5 -15"/>` +
  `<path class="wb-gem-line wb-l3" pathLength="1" d="M-3.2 -10 L0 0 L3.2 -10"/></g>` +
  `<g transform="translate(41 -44) scale(.7)"><path class="wb-spark" d="M0 -6 C.6 -1.2 1.2 -.6 6 0 C1.2 .6 .6 1.2 0 6 C-.6 1.2 -1.2 .6 -6 0 C-1.2 -.6 -.6 -1.2 0 -6 Z"/></g>` +
  `<g transform="translate(-33 -40) rotate(-12) scale(.9)"><path class="wb-heart wb-h1" d="${HEART}"/></g>` +
  `<g transform="translate(-20 -52) rotate(9) scale(.66)"><path class="wb-heart wb-h2" d="${HEART}"/></g>` +
  `</g></svg>`;

/** Стили и знак — содержимое блока .wc-boot (без скрипта). */
export const RINGS_MARKUP = `<style>${CSS.trim()}</style>${SVG}`;

/* Сам скрипт: запускается <script> внутри блока .wc-boot (document.currentScript
   → родитель). Пишется без обратных кавычек и «${» (это строка внутри шаблона),
   без «?.» и «??» (старые Safari). Время — от момента запуска: если вкладка была
   в фоне, по возвращении сразу будет нужная фаза, без повтора анимации. Второй
   запуск на том же блоке ничего не делает (React в разработке монтирует дважды). */
export const RINGS_SCRIPT = `
(function () {
var box = document.currentScript && document.currentScript.parentNode;
if (!box || !box.querySelector || box.__wcRings) return;
box.__wcRings = 1;
var SIGNAL = box.getAttribute('data-wait') === 'signal';
function bail() {
  if (box.classList) box.classList.remove('is-on');
  try { box.dispatchEvent(new Event('wc:boot-done')); } catch (err) {}
}
if (!window.requestAnimationFrame || !window.performance) return bail();
var svg = box.querySelector('svg'), lines = box.querySelector('.wb-lines'), mover = box.querySelector('.wb-move');
if (!svg || !lines || !mover) return bail();
var NS = 'http://www.w3.org/2000/svg', PATH0 = location.pathname;
var BGC = [250, 248, 245], INKC = [201, 123, 138];
function rgb(k) { return 'rgb(' + BGC.map(function (v, j) { return Math.round(v + (INKC[j] - v) * k); }).join(',') + ')'; }
var C_BG = rgb(0), C_INK = rgb(1), C_TRACK = rgb(0.2), FADE = [];
for (var f = 0; f < 10; f++) FADE.push(rgb(0.2 + 0.8 * Math.pow((f + 1) / 10, 0.9)));
var A = 66, B = 52.8, W_LINE = 1.9, W_RING = 2.6, GAP = 2.4, R0 = A / 2, SHIFT = 9, E = 0.006;
var FL = { x: -19, y: 8, r: 33 }, FR = { x: 20, y: 3, r: 30 };
var PI = Math.PI, HALF = PI / 2, BASE = [HALF, PI, 3 * HALF, 0];
var CIRC = [['L', 0, -PI], ['L', -PI, -PI], ['R', -PI, PI], ['R', 0, PI]], ORDER = [2, 1, 0, 3];
var LAP = 1.5, CAP = 10000, VIDEO_WAIT = 2500, SETTLE_WAIT = 5000;
var D_FILL = SIGNAL ? 0.35 : 0.7, D_A = SIGNAL ? 0.35 : 0.6, D_B = SIGNAL ? 0.55 : 0.85, D_TAIL = SIGNAL ? 0.45 : 1.4, FADE_MS = SIGNAL ? 320 : 480;
var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function G(th) { return [A * Math.cos(th), B / 2 * Math.sin(2 * th)]; }
function lerp(a, b, k) { return a + (b - a) * k; }
function inOut(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
function outBack(p) { return 1 + 2.5 * Math.pow(p - 1, 3) + 1.5 * Math.pow(p - 1, 2); }
var QN = 240, QT = BASE.map(function (b0) {
  var arr = new Float64Array(QN + 1), acc = 0, prev = G(b0);
  for (var k = 1; k <= QN; k++) { var p = G(b0 + k / QN * HALF); acc += Math.sqrt((p[0] - prev[0]) * (p[0] - prev[0]) + (p[1] - prev[1]) * (p[1] - prev[1])); arr[k] = acc; prev = p; }
  for (k = 1; k <= QN; k++) arr[k] /= acc;
  return arr;
});
function uOf(q, f) {
  if (f <= 0) return 0;
  if (f >= 1) return 1;
  var arr = QT[q], lo = 0, hi = QN;
  while (hi - lo > 1) { var m = (lo + hi) >> 1; if (arr[m] <= f) lo = m; else hi = m; }
  return (lo + (f - arr[lo]) / (arr[hi] - arr[lo])) / QN;
}
function circles(b) {
  return { L: { x: lerp(-R0, FL.x, b), y: lerp(0, FL.y, b), r: lerp(R0, FL.r, b) },
           R: { x: lerp(R0, FR.x, b), y: lerp(0, FR.y, b), r: lerp(R0, FR.r, b) } };
}
function point(i, u, geo) {
  var c = CIRC[i], k = geo.c[c[0]], phi = c[1] + u * c[2];
  var cx = k.x + k.r * Math.cos(phi), cy = k.y + k.r * Math.sin(phi);
  if (geo.a >= 1) return [cx, cy];
  var g = G(BASE[i] + u * HALF);
  return [lerp(g[0], cx, geo.a), lerp(g[1], cy, geo.a)];
}
function arcD(i, u0, u1, geo) {
  var n = Math.max(2, Math.ceil(Math.abs(u1 - u0) * 64)), d = '';
  for (var k = 0; k <= n; k++) { var p = point(i, u0 + (u1 - u0) * k / n, geo); d += (k ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }
  return d;
}
function lenAt(t) { return 0.22 + 0.09 * Math.sin(t * 2 * PI / 2.7); }
function stateAt(t, tL) {
  if (tL === null || t < tL) return { a: 0, b: 0, w: W_LINE, head: t / LAP, len: lenAt(t), fade: 0.6 };
  var dt = t - tL;
  if (dt < D_FILL) {
    var p = inOut(dt / D_FILL), l0 = lenAt(tL), len = lerp(l0, 1, p);
    return { a: 0, b: 0, w: W_LINE, head: tL / LAP - l0 + len, len: len, fade: 0.6 * (1 - p) };
  }
  dt -= D_FILL;
  if (dt < D_A) { var a = inOut(dt / D_A); return { a: a, b: 0, w: lerp(W_LINE, W_RING, a), full: true }; }
  dt -= D_A;
  if (dt < D_B) return { a: 1, b: outBack(dt / D_B), w: W_RING, full: true, gem: dt > D_B * 0.4 };
  return { a: 1, b: 1, w: W_RING, full: true, gem: true, done: dt >= D_B + D_TAIL };
}
var pool = [];
function flush(cmds) {
  while (pool.length < cmds.length) {
    var el = document.createElementNS(NS, 'path');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke-linejoin', 'round');
    lines.appendChild(el);
    pool.push(el);
  }
  for (var k = 0; k < pool.length; k++) {
    var p = pool[k], c = cmds[k], d = c ? c.d : '';
    if (p._d !== d) { p.setAttribute('d', d); p._d = d; }
    if (!c) continue;
    if (p._s !== c.s) { p.setAttribute('stroke', c.s); p._s = c.s; }
    var w = c.w.toFixed(3);
    if (p._w !== w) { p.setAttribute('stroke-width', w); p._w = w; }
    if (p._c !== c.cap) { p.setAttribute('stroke-linecap', c.cap); p._c = c.cap; }
  }
}
function comet(st) {
  var parts = [], tail = st.head - st.len, fl = st.len * st.fade, pieces = [];
  for (var k = 0; k < 10; k++) pieces.push([tail + fl * k / 10, tail + fl * (k + 1) / 10, FADE[k]]);
  pieces.push([tail + fl, st.head, C_INK]);
  for (var pi = 0; pi < pieces.length; pi++) {
    var g1 = pieces[pi][0], g2 = pieces[pi][1], a = g1;
    if (g2 - g1 < 1e-6) continue;
    while (a < g2 - 1e-9) {
      var base = Math.floor(a * 4 + 1e-9), b = Math.min(g2, (base + 1) / 4), q = ((base % 4) + 4) % 4;
      parts.push({ i: q, u0: uOf(q, a * 4 - base), u1: uOf(q, b * 4 - base), s: pieces[pi][2], head: pi === pieces.length - 1 && b >= g2 - 1e-9 });
      a = b;
    }
  }
  return parts;
}
var still = [];
function render(st) {
  var geo = { a: st.a, c: circles(st.b) }, moving = st.a > 0 || st.b > 0;
  var w = st.w, halo = w + 2 * GAP, cmds = [], parts = st.full ? [] : comet(st);
  for (var n = 0; n < 4; n++) {
    var i = ORDER[n], dh, dl;
    if (moving) { dh = arcD(i, 0, 1, geo); dl = arcD(i, -E, 1 + E, geo); }
    else { if (!still[i]) still[i] = [arcD(i, 0, 1, geo), arcD(i, -E, 1 + E, geo)]; dh = still[i][0]; dl = still[i][1]; }
    cmds.push({ d: dh, s: C_BG, w: halo, cap: 'butt' });
    cmds.push({ d: dl, s: st.full ? C_INK : C_TRACK, w: w, cap: 'butt' });
    if (st.full) continue;
    for (var k = 0; k < parts.length; k++) {
      var p = parts[k];
      if (p.i === i) cmds.push({ d: arcD(i, p.u0 - E, p.u1 + E, geo), s: p.s, w: w, cap: p.head ? 'round' : 'butt' });
    }
  }
  flush(cmds);
  mover.setAttribute('transform', 'translate(0 ' + (SHIFT * Math.max(0, Math.min(1, st.b))).toFixed(2) + ')');
  if (svg.classList) { if (st.gem) svg.classList.add('is-gem'); else svg.classList.remove('is-gem'); }
}
var t0 = performance.now(), tL = null, capped = false, on = false, ending = false, killer = 0;
function now() { return (performance.now() - t0) / 1000; }
function markLoaded(cap) { if (tL === null) { tL = now(); capped = !!cap; } }
function fontsReady() {
  var fs = document.fonts;
  if (!fs || !fs.ready) return Promise.resolve();
  return Promise.race([fs.ready, new Promise(function (r) { setTimeout(r, 1500); })]);
}
function onLoad() { fontsReady().then(function () { markLoaded(false); }, function () { markLoaded(false); }); }
var KEYS = { ' ': 1, Spacebar: 1, PageDown: 1, PageUp: 1, ArrowDown: 1, ArrowUp: 1, Home: 1, End: 1 };
function block(e) { if (on && e.cancelable) e.preventDefault(); }
function onKey(e) { if (on && KEYS[e.key] === 1) e.preventDefault(); }
function cleanup() {
  if (!on) return;
  on = false;
  clearTimeout(killer);
  box.classList.remove('is-on');
  box.classList.remove('is-out');
  if (!SIGNAL) {
    box.removeEventListener('wheel', block);
    box.removeEventListener('touchmove', block);
    window.removeEventListener('keydown', onKey);
  }
  try {
    box.dispatchEvent(new Event('wc:boot-done'));
    if (!SIGNAL) window.dispatchEvent(new Event('wc:boot-done'));
  } catch (err) {}
}
function videoReady() {
  return new Promise(function (res) {
    var v = document.querySelector('video[data-boot-wait]');
    if (capped || calm || !v || v.getAttribute('data-boot-ready') || v.error || (!v.paused && v.readyState > 2)) return res();
    var evs = ['playing', 'error', 'wc:boot-ready'], timer = 0;
    function ok() { clearTimeout(timer); evs.forEach(function (n) { v.removeEventListener(n, ok); }); res(); }
    evs.forEach(function (n) { v.addEventListener(n, ok); });
    timer = setTimeout(ok, VIDEO_WAIT);
  });
}
function settled() {
  return new Promise(function (res) {
    if (capped || box.getAttribute('data-settled')) return res();
    var timer = setTimeout(res, SETTLE_WAIT);
    box.addEventListener('wc:boot-settled', function () { clearTimeout(timer); res(); });
  });
}
function finish() {
  if (ending) return;
  ending = true;
  (SIGNAL ? settled() : videoReady()).then(function () {
    box.classList.add('is-out');
    setTimeout(cleanup, FADE_MS);
  }, cleanup);
}
function tick() {
  if (!on) return;
  try {
    if (box.isConnected === false) {
      if (SIGNAL) return cleanup();
      if (document.body && location.pathname === PATH0) document.body.appendChild(box);
    }
    if (calm && tL !== null) return finish();
    var st = stateAt(now(), tL);
    render(st);
    if (st.done) return finish();
  } catch (err) { return cleanup(); }
  requestAnimationFrame(tick);
}
try { render(stateAt(0, null)); } catch (err) { return bail(); }
on = true;
if (SIGNAL) {
  if (box.getAttribute('data-ready')) markLoaded(false);
  else box.addEventListener('wc:boot-ready', function () { markLoaded(false); });
} else {
  box.addEventListener('wheel', block, { passive: false });
  box.addEventListener('touchmove', block, { passive: false });
  window.addEventListener('keydown', onKey);
  if (document.readyState === 'complete') onLoad(); else window.addEventListener('load', onLoad);
}
setTimeout(function () { markLoaded(true); }, CAP);
killer = setTimeout(cleanup, CAP + 9000);
box.classList.add('is-on');
requestAnimationFrame(tick);
})();
`.trim();
