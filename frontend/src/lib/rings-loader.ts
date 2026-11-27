/* Загрузка «бесконечность → свадебные кольца» — общий движок.
   Прототипы — output/loader-rings/ (spinner.html — первая версия, neon.html — эта).

   Где стоит:
   · главная — с 24.11.26 БЕЗ загрузки (владелец попросил убрать; BootLoader.tsx
     удалён). «Режим страницы» (data-wait не задан: блок на весь экран, ждёт
     window.load, шрифты и видео с data-boot-wait) в движке остался — сейчас
     им никто не пользуется;
   · редактор и анкета «Расскажите о вашей свадьбе» целиком — с 27.11.26 при
     открытии экрана блок на всё окно (components/RingsLoader.tsx, вид cover, в
     app/editor/EditorBoot.tsx; скрипт в разметке — с первой отрисовки), ждёт
     сигнала «сайт в окне загрузился» (data-wait="signal");
   · окно сайта в редакторе, когда сайт там грузится заново (другое устройство), —
     components/RingsLoader.tsx внутри app/editor/SitePreview.tsx: блок поверх
     окна (класс is-inline), ждёт того же сигнала.

   Вид (25.11.26: «бесконечность больше похожа на кольца, а не на весы… с
   неоновым следом как комета»): петли бесконечности — настоящие окружности, в
   середине их соединяют две прямые-касательные, которые перекрещиваются, одна
   над другой (как знак ∞ из двух колец). По бледному следу фигуры бежит
   неоновая комета: хвост от прозрачного к яркому и от тонкого к толстому,
   голова раскалена почти добела, вокруг — свечение (размытая копия кометы
   отдельным слоем .wb-glow поверх чётких линий).

   Как работает. Пока грузится, бежит комета. Когда загрузилось (режим
   страницы — window.load и document.fonts; режим сигнала — data-ready="1" на
   блоке или событие wc:boot-ready на нём), комета дорисовывает знак целиком,
   перекрестье расцепляется — касательные выгибаются во внутренние дуги, и
   выходят два отдельных кольца; они съезжаются и сцепляются, появляются
   бриллиант, искра и два сердечка — и загрузка тает. Таять она ждёт ещё
   одного: на главной — видео первого экрана (до 2,5 с), в режиме сигнала —
   data-settled="1" / wc:boot-settled («догрузилось всё на виду», до 5 с). Так
   кольца складываются, пока докачиваются картинки. В режиме сигнала финал
   вдвое быстрее (~2 с: «сделай загрузку короче в редакторе», 24.11.26).
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
   он делает просвет в линии, уходящей вниз (поэтому фон блока — ровно bg
   палитры). Свечение лежит отдельным слоем без ореолов: иначе ореолы гасили бы
   его вдоль всей линии. На стыке фаз обе картинки совпадают, поэтому
   превращение идёт без скачков. */

export interface RingsPalette {
  /** Фон блока — он же цвет ореолов (просветов на перехлёсте) */
  bg: string;
  /** Линии, хвост кометы, кольца, бриллиант, сердечки */
  ink: string;
  /** Раскалённая голова кометы и искра */
  hot: string;
  /** Насколько видна бледная фигура под кометой (0 — фон, 1 — ink) */
  track: number;
  /** Свечение: прозрачность слоя и как он ложится на фон */
  glow: number;
  glowBlend: 'screen' | 'normal';
}

/** Неон на тёмном — свечение по-настоящему светится (сейчас не используется) */
export const RINGS_NIGHT: RingsPalette = { bg: '#170e14', ink: '#ff6fa8', hot: '#fff1f7', track: 0.17, glow: 0.95, glowBlend: 'screen' };
/** Тот же неон на светлом фоне сайта — на сайте сейчас эта */
export const RINGS_DAY: RingsPalette = { bg: '#faf8f5', ink: '#e0508a', hot: '#ff2f85', track: 0.15, glow: 0.45, glowBlend: 'normal' };

const HEART = 'M0 3.4 C-1.3 2.3 -5.2 -.4 -5.2 -3.1 C-5.2 -5 -3.8 -6.2 -2.4 -6.2 C-1.3 -6.2 -.4 -5.5 0 -4.5 ' +
  'C.4 -5.5 1.3 -6.2 2.4 -6.2 C3.8 -6.2 5.2 -5 5.2 -3.1 C5.2 -.4 1.3 2.3 0 3.4 Z';
const GEM = 'M0 0 L11 -10 L6.5 -15 L-6.5 -15 L-11 -10 Z';

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ');

/* is-inline — блок внутри окна (родителю нужен position: relative): свой
   размер знака (--wb-size, не больше 60 % ширины окна), касания не гасит. */
const css = (p: RingsPalette) => `
.wc-boot{position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:${p.bg};transition:opacity .45s ease;touch-action:none;overscroll-behavior:contain;-webkit-tap-highlight-color:transparent}
.wc-boot.is-on{display:flex}
.wc-boot.is-out{opacity:0;pointer-events:none}
.wc-boot svg{width:200px;height:200px;display:block;overflow:visible}
.wc-boot.is-inline{position:absolute;z-index:5;touch-action:auto;overscroll-behavior:auto}
.wc-boot.is-inline svg{width:var(--wb-size,200px);max-width:60%;height:auto;aspect-ratio:1/1}
.wc-boot .wb-glow{opacity:${p.glow};mix-blend-mode:${p.glowBlend}}
.wc-boot .wb-gem-fill{fill:${p.bg};opacity:0}
.wc-boot .wb-gem-line{fill:none;stroke:${p.ink};stroke-width:1.5px;stroke-linejoin:round;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1}
.wc-boot .wb-spark{fill:${p.hot};opacity:0;transform:scale(0) rotate(-60deg);transform-box:fill-box;transform-origin:center}
.wc-boot .wb-heart{fill:none;stroke:${p.ink};stroke-width:1.4px;stroke-linejoin:round;opacity:0;transform:translateY(6px) scale(.3);transform-box:fill-box;transform-origin:50% 85%}
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

/* Свечение: wb-blur — размытие слоя .wb-glow (комета и кольца без ореолов),
   wb-soft — мягкий ореол у бриллианта, искры и сердечек. Область фильтра — вся
   картинка (userSpaceOnUse): по рамке почти горизонтального кусочка кометы
   размытие обрезалось бы.
   Бриллиант стоит на правом кольце (низ камня — точка 0,0 его группы). Место
   искры и сердечек задаёт внешняя <g>: CSS-transform анимации на самом пути
   затёр бы атрибут transform. */
const SVG = `<svg viewBox="-90 -90 180 180" focusable="false"><defs>` +
  `<filter id="wb-blur" filterUnits="userSpaceOnUse" x="-100" y="-110" width="200" height="220" color-interpolation-filters="sRGB">` +
  `<feGaussianBlur stdDeviation="2.8"/></filter>` +
  `<filter id="wb-soft" filterUnits="userSpaceOnUse" x="-100" y="-110" width="200" height="220" color-interpolation-filters="sRGB">` +
  `<feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
  `</defs><g class="wb-move"><g class="wb-lines"></g><g class="wb-glow" filter="url(#wb-blur)"></g>` +
  `<g filter="url(#wb-soft)"><g transform="translate(20 -29)"><path class="wb-gem-fill" d="${GEM}"/>` +
  `<path class="wb-gem-line" pathLength="1" d="${GEM}"/>` +
  `<path class="wb-gem-line wb-l2" pathLength="1" d="M-11 -10 L11 -10"/>` +
  `<path class="wb-gem-line wb-l3" pathLength="1" d="M-6.5 -15 L-3.2 -10 L0 -15 L3.2 -10 L6.5 -15"/>` +
  `<path class="wb-gem-line wb-l3" pathLength="1" d="M-3.2 -10 L0 0 L3.2 -10"/></g>` +
  `<g transform="translate(41 -44) scale(.7)"><path class="wb-spark" d="M0 -6 C.6 -1.2 1.2 -.6 6 0 C1.2 .6 .6 1.2 0 6 C-.6 1.2 -1.2 .6 -6 0 C-1.2 -.6 -.6 -1.2 0 -6 Z"/></g>` +
  `<g transform="translate(-33 -40) rotate(-12) scale(.9)"><path class="wb-heart wb-h1" d="${HEART}"/></g>` +
  `<g transform="translate(-20 -52) rotate(9) scale(.66)"><path class="wb-heart wb-h2" d="${HEART}"/></g>` +
  `</g></g></svg>`;

/* Сам скрипт: запускается <script> внутри блока .wc-boot (document.currentScript
   → родитель). Пишется без обратных кавычек и «${» (это строка внутри шаблона;
   ${…} ниже — только подстановка палитры), без «?.» и «??» (старые Safari).
   Время — от момента запуска: если вкладка была в фоне, по возвращении сразу
   будет нужная фаза, без повтора анимации. Второй запуск на том же блоке ничего
   не делает (React в разработке монтирует дважды). */
const script = (p: RingsPalette) => `
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
var svg = box.querySelector('svg'), lines = box.querySelector('.wb-lines'), glow = box.querySelector('.wb-glow'), mover = box.querySelector('.wb-move');
if (!svg || !lines || !glow || !mover) return bail();
var NS = 'http://www.w3.org/2000/svg', PATH0 = location.pathname;
var BGC = [${rgb(p.bg)}], INKC = [${rgb(p.ink)}], HOTC = [${rgb(p.hot)}], TRACK_K = ${p.track};
function mix(a, b, k) { return 'rgb(' + a.map(function (v, j) { return Math.round(v + (b[j] - v) * k); }).join(',') + ')'; }
var C_BG = mix(BGC, INKC, 0), C_INK = mix(BGC, INKC, 1), C_TRACK = mix(BGC, INKC, TRACK_K);
var PI = Math.PI, HALF = PI / 2;
/* Бесконечность из двух колец: петли — окружности радиуса RL с центрами в ±CL,
   в середине их соединяют общие внутренние касательные — прямые через центр под
   углом TH к горизонтали. SL — длина касательной до кольца, QL — длина четверти. */
var RL = 30.4, CL = 35.6, TH = Math.asin(RL / CL), CT = Math.cos(TH), ST = Math.sin(TH);
var SL = Math.sqrt(CL * CL - RL * RL), ARC = RL * (HALF + TH), QL = SL + ARC;
var W_TRACK = 1, W_TAIL = 0.4, W_LINE = 2.2, W_HEAD = 4.2, W_RING = 2.4, GLOW_W = 3, GAP = 2.4, SHIFT = 9, E = 0.006;
var FL = { x: -19, y: 8, r: 33 }, FR = { x: 20, y: 3, r: 30 };
var CIRC = [['L', 0, -PI], ['L', -PI, -PI], ['R', -PI, PI], ['R', 0, PI]], ORDER = [2, 1, 0, 3];
var LAP = 1.5, CAP = 10000, VIDEO_WAIT = 2500, SETTLE_WAIT = 5000, NP = 18, HOT_N = 4, HOT_LEN = 0.05, FADE0 = 0.85;
var DUST_LIFE = 0.7, DUST_DT = 0.018;
var D_FILL = SIGNAL ? 0.35 : 0.7, D_A = SIGNAL ? 0.35 : 0.6, D_B = SIGNAL ? 0.55 : 0.85, D_TAIL = SIGNAL ? 0.45 : 1.4, FADE_MS = SIGNAL ? 320 : 480;
var calm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
/* Четверти фигуры по ходу кометы (u — доля длины четверти, от 0 до 1):
   0 — из центра по касательной вверх-влево и верхом левого кольца до его края;
   1 — низом левого кольца и по касательной вверх-вправо в центр;
   2 — из центра вверх-вправо и верхом правого кольца; 3 — низом правого и в центр. */
function G(i, u) {
  var d = u * QL, phi, t;
  if (i === 0) {
    if (d < SL) return [-d * CT, -d * ST];
    phi = TH - HALF - (d - SL) / RL;
    return [-CL + RL * Math.cos(phi), RL * Math.sin(phi)];
  }
  if (i === 1) {
    if (d < ARC) { phi = PI - d / RL; return [-CL + RL * Math.cos(phi), RL * Math.sin(phi)]; }
    t = SL - (d - ARC);
    return [-t * CT, t * ST];
  }
  if (i === 2) {
    if (d < SL) return [d * CT, -d * ST];
    phi = -HALF - TH + (d - SL) / RL;
    return [CL + RL * Math.cos(phi), RL * Math.sin(phi)];
  }
  if (d < ARC) { phi = d / RL; return [CL + RL * Math.cos(phi), RL * Math.sin(phi)]; }
  t = SL - (d - ARC);
  return [t * CT, t * ST];
}
function lerp(a, b, k) { return a + (b - a) * k; }
function inOut(q) { return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2; }
function outBack(q) { return 1 + 2.5 * Math.pow(q - 1, 3) + 1.5 * Math.pow(q - 1, 2); }
var QN = 240, QT = [0, 1, 2, 3].map(function (i) {
  var arr = new Float64Array(QN + 1), acc = 0, prev = G(i, 0);
  for (var k = 1; k <= QN; k++) { var q = G(i, k / QN); acc += Math.sqrt((q[0] - prev[0]) * (q[0] - prev[0]) + (q[1] - prev[1]) * (q[1] - prev[1])); arr[k] = acc; prev = q; }
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
/* Кольца: при b = 0 — петли самой бесконечности, при b = 1 — сцепленные */
function circles(b) {
  return { L: { x: lerp(-CL, FL.x, b), y: lerp(0, FL.y, b), r: lerp(RL, FL.r, b) },
           R: { x: lerp(CL, FR.x, b), y: lerp(0, FR.y, b), r: lerp(RL, FR.r, b) } };
}
function point(i, u, geo) {
  var c = CIRC[i], k = geo.c[c[0]], phi = c[1] + u * c[2];
  var cx = k.x + k.r * Math.cos(phi), cy = k.y + k.r * Math.sin(phi);
  if (geo.a >= 1) return [cx, cy];
  var g = G(i, u);
  return [lerp(g[0], cx, geo.a), lerp(g[1], cy, geo.a)];
}
function arcD(i, u0, u1, geo) {
  var n = Math.max(2, Math.ceil(Math.abs(u1 - u0) * 64)), d = '';
  for (var k = 0; k <= n; k++) { var q = point(i, u0 + (u1 - u0) * k / n, geo); d += (k ? 'L' : 'M') + q[0].toFixed(2) + ' ' + q[1].toFixed(2); }
  return d;
}
function lenAt(t) { return 0.36 + 0.06 * Math.sin(t * 2 * PI / 2.7); }
function stateAt(t, tL) {
  if (tL === null || t < tL) return { a: 0, b: 0, w: W_LINE, head: t / LAP, len: lenAt(t), fade: FADE0, hot: 1 };
  var dt = t - tL;
  if (dt < D_FILL) {
    var q = inOut(dt / D_FILL), l0 = lenAt(tL), len = lerp(l0, 1, q);
    return { a: 0, b: 0, w: W_LINE, head: tL / LAP - l0 + len, len: len, fade: FADE0 * (1 - q), hot: 1 - q };
  }
  dt -= D_FILL;
  if (dt < D_A) { var a = inOut(dt / D_A); return { a: a, b: 0, w: lerp(W_LINE, W_RING, a), full: true }; }
  dt -= D_A;
  if (dt < D_B) return { a: 1, b: outBack(dt / D_B), w: W_RING, full: true, gem: dt > D_B * 0.4 };
  return { a: 1, b: 1, w: W_RING, full: true, gem: true, done: dt >= D_B + D_TAIL };
}
/* Где голова кометы (точка на фигуре) */
function headAt(st, geo) {
  var hb = Math.floor(st.head * 4 + 1e-9), hq = ((hb % 4) + 4) % 4;
  return { q: hq, p: point(hq, uOf(hq, st.head * 4 - hb), geo) };
}
/* Комета: хвост из NP кусочков — цвет от бледного следа к ink, толщина от
   W_TAIL к W_LINE, свечение от 0 к 1; потом тело цвета ink и раскалённый кончик
   (к hot), на самом острие — точка-голова со вспышкой. Всё режется по четвертям
   фигуры, чтобы перехлёст в центре работал и для кометы. */
function comet(st, geo, hd) {
  var head = st.head, tail = head - st.len, fl = st.len * st.fade, hot = HOT_LEN * st.hot, pc = [], parts = [], k, f;
  for (k = 0; k < NP; k++) {
    f = (k + 1) / NP;
    pc.push([tail + fl * k / NP, tail + fl * f, mix(BGC, INKC, TRACK_K + (1 - TRACK_K) * Math.pow(f, 1.2)), lerp(W_TAIL, W_LINE, Math.sqrt(f)), Math.pow(f, 1.4), C_INK]);
  }
  pc.push([tail + fl, head - hot, C_INK, W_LINE, 1, C_INK]);
  for (k = 0; k < HOT_N; k++) {
    var hc = mix(INKC, HOTC, (k + 1) / HOT_N);
    pc.push([head - hot * (1 - k / HOT_N), head - hot * (1 - (k + 1) / HOT_N), hc, W_LINE, 1, hc]);
  }
  var last = pc.length - 1;
  while (last > 0 && pc[last][1] - pc[last][0] < 1e-6) last--;
  for (var n = 0; n <= last; n++) {
    var g1 = pc[n][0], g2 = pc[n][1], a = g1;
    if (g2 - g1 < 1e-6) continue;
    while (a < g2 - 1e-9) {
      var base = Math.floor(a * 4 + 1e-9), b = Math.min(g2, (base + 1) / 4), q = ((base % 4) + 4) % 4;
      parts.push({ i: q, u0: uOf(q, a * 4 - base), u1: uOf(q, b * 4 - base), s: pc[n][2], w: pc[n][3], g: pc[n][4], gs: pc[n][5], head: n === last && b >= g2 - 1e-9 });
      a = b;
    }
  }
  if (st.hot > 0.02) {
    var hs = mix(INKC, HOTC, st.hot);
    parts.push({ i: hd.q, dot: 'M' + hd.p[0].toFixed(2) + ' ' + hd.p[1].toFixed(2) + 'l.01 0', s: hs, w: lerp(W_LINE, W_HEAD, st.hot), g: 1, gs: hs });
  }
  return parts;
}
/* Искры: голова кометы роняет крошки света — они разлетаются и гаснут за
   DUST_LIFE. Время — как у всей анимации; после паузы вкладки не сыплет пачкой. */
var dust = [], dustT = null;
function dustCmds(st, hd, t) {
  var out = [], keep = [], k;
  if (hd && st.hot > 0.3 && !calm) {
    if (dustT === null || t - dustT > 0.1) dustT = t - DUST_DT;
    while (dustT + DUST_DT <= t) {
      dustT += DUST_DT;
      var ang = Math.random() * 2 * PI, sp = 2 + Math.random() * 7;
      dust.push({ x: hd.p[0], y: hd.p[1], vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, t: dustT, r: 0.35 + Math.random() * 0.6, s: mix(INKC, HOTC, 0.3 + Math.random() * 0.7) });
    }
  }
  for (k = 0; k < dust.length; k++) {
    var q = dust[k], age = t - q.t;
    if (age < 0 || age > DUST_LIFE) continue;
    keep.push(q);
    var life = 1 - age / DUST_LIFE;
    out.push({ d: 'M' + (q.x + q.vx * age).toFixed(2) + ' ' + (q.y + q.vy * age).toFixed(2) + 'l.01 0', s: q.s, w: q.r * 2 * (0.5 + 0.5 * life), o: life * life, cap: 'round' });
  }
  dust = keep;
  return out;
}
var poolL = [], poolG = [];
function flush(group, pool, cmds) {
  while (pool.length < cmds.length) {
    var el = document.createElementNS(NS, 'path');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke-linejoin', 'round');
    group.appendChild(el);
    pool.push(el);
  }
  for (var k = 0; k < pool.length; k++) {
    var q = pool[k], c = cmds[k], d = c ? c.d : '';
    if (q._d !== d) { q.setAttribute('d', d); q._d = d; }
    if (!c) continue;
    if (q._s !== c.s) { q.setAttribute('stroke', c.s); q._s = c.s; }
    var w = c.w.toFixed(3);
    if (q._w !== w) { q.setAttribute('stroke-width', w); q._w = w; }
    if (q._c !== c.cap) { q.setAttribute('stroke-linecap', c.cap); q._c = c.cap; }
    var o = (c.o === undefined ? 1 : c.o).toFixed(3);
    if (q._o !== o) { q.setAttribute('stroke-opacity', o); q._o = o; }
  }
}
var still = [];
function render(st, t) {
  var geo = { a: st.a, c: circles(st.b) }, moving = st.a > 0 || st.b > 0;
  var hd = st.full ? null : headAt(st, geo);
  var w = st.w, halo = w + 2 * GAP, cmds = [], gl = [], parts = st.full ? [] : comet(st, geo, hd);
  for (var n = 0; n < 4; n++) {
    var i = ORDER[n], dh, dl;
    if (moving) { dh = arcD(i, 0, 1, geo); dl = arcD(i, -E, 1 + E, geo); }
    else { if (!still[i]) still[i] = [arcD(i, 0, 1, geo), arcD(i, -E, 1 + E, geo)]; dh = still[i][0]; dl = still[i][1]; }
    cmds.push({ d: dh, s: C_BG, w: halo, cap: 'butt' });
    if (st.full) {
      cmds.push({ d: dl, s: C_INK, w: w, cap: 'butt' });
      gl.push({ d: dl, s: C_INK, w: w * GLOW_W, cap: 'butt' });
      continue;
    }
    cmds.push({ d: dl, s: C_TRACK, w: W_TRACK, cap: 'butt' });
    for (var k = 0; k < parts.length; k++) {
      var p = parts[k];
      if (p.i !== i) continue;
      var d = p.dot || arcD(i, p.u0 - E, p.u1 + E, geo);
      cmds.push({ d: d, s: p.s, w: p.w, cap: p.dot || p.head ? 'round' : 'butt' });
      gl.push({ d: d, s: p.gs, w: p.w * GLOW_W, o: p.g, cap: p.dot ? 'round' : 'butt' });
      if (p.dot) gl.push({ d: d, s: p.gs, w: p.w * 4.5, o: 0.55, cap: 'round' });
    }
  }
  var dc = dustCmds(st, hd, t);
  for (var j = 0; j < dc.length; j++) {
    cmds.push(dc[j]);
    gl.push({ d: dc[j].d, s: dc[j].s, w: dc[j].w * 3, o: dc[j].o * 0.7, cap: 'round' });
  }
  flush(lines, poolL, cmds);
  flush(glow, poolG, gl);
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
    var t = now(), st = stateAt(t, tL);
    render(st, t);
    if (st.done) return finish();
  } catch (err) { return cleanup(); }
  requestAnimationFrame(tick);
}
try { render(stateAt(0, null), 0); } catch (err) { return bail(); }
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

/** Стили, знак и скрипт для палитры (прототип сравнивает палитры, сайт берёт одну). */
export function ringsAssets(p: RingsPalette) {
  return { markup: `<style>${css(p).trim()}</style>${SVG}`, script: script(p) };
}

/* На сайте — светлая палитра: из двух показанных рядом (тёмный неон и тот же
   неон на светлом фоне) владелец выбрал светлую, 25.11.26. */
const ASSETS = ringsAssets(RINGS_DAY);
/** Стили и знак — содержимое блока .wc-boot (без скрипта). */
export const RINGS_MARKUP = ASSETS.markup;
export const RINGS_SCRIPT = ASSETS.script;
