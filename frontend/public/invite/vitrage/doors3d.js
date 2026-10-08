/* ============================================================
   «Витраж» — витражные двери на WebGL2 (без библиотек).

   Сцена — в CSS-пикселях блока .doors: x вправо, y вверх (0 — низ блока),
   z к гостю. Камера повторяет CSS-перспективу дверей (2400 ед. макета,
   центр блока), поэтому закрытые створки лежат ровно в плоскости страницы
   и распахиваются так же, как CSS-версия (она осталась запасной и первым
   кадром, пока готовится эта).

   Створка — стекло и серебряная рама с объёмом. Стекло не нарисовано
   заранее: шейдер берёт то, что ровно за ним, — размытую обложку
   (assets/frost.jpg) — и сдвигает её по наклонам «молотковых» ямок. Те же
   ямки ловят блики ламп, которые бегут по стеклу при повороте, а отражение
   комнаты по Френелю само затемняет створку на скосе.

   Медальон на правой створке — настоящий объём: боковая стенка по контуру
   розетки (её видно, когда створка поворачивается), рельеф — пайка, купола
   стёкол, жемчуг, буквы — считается в шейдере по тем же размерам, что
   medallion.webp (пиксели картинки 640×640, центр 320). Инициалы живые:
   canvas → текстура → рельеф из синей стали.
   ============================================================ */
(function () {
  'use strict';

  var PERSP = 2400;                 // перспектива, ед. макета (как в styles.css)
  var DUR = 3.4;                    // с — как CSS-анимации doorL/doorR
  var MED_S = 0.75;                 // ед. макета на пиксель медальона (640 → 480)
  var MED_Z = 14;                   // медальон стоит на раме, ед. макета
  var PHI_N = 720, RING_N = 40;     // сетка медальона: шаг 0,5° (точно попадает в стыки лепестков)
  var LD = 206, LR = 104;           // лепестки розетки: центр на 206 px, радиус 104 px
  var WALL = 54;                    // высота боковой стенки медальона, px картинки (≈ 9% ширины)

  /* ---------- математика ---------- */
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function lookAt(e, c, up) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    var l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1
    ]);
  }
  function mul(a, b) {
    var o = new Float32Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
      var s = 0;
      for (var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
      o[i * 4 + j] = s;
    }
    return o;
  }
  // Поворот вокруг вертикальной оси x = x0, z = 0 (петли створки)
  function hinge(phi, x0) {
    var c = Math.cos(phi), s = Math.sin(phi);
    return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, x0 * (1 - c), 0, x0 * s, 1]);
  }
  function xform(m, p) {
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  }
  function xdir(m, d) {
    return [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];
  }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

  // cubic-bezier, как в CSS
  function bezier(p1x, p1y, p2x, p2y) {
    var cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
    var cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
    var sx = function (t) { return ((ax * t + bx) * t + cx) * t; };
    var sy = function (t) { return ((ay * t + by) * t + cy) * t; };
    var dx = function (t) { return (3 * ax * t + 2 * bx) * t + cx; };
    return function (x) {
      var t = x, i;
      for (i = 0; i < 8; i++) {
        var e = sx(t) - x, d = dx(t);
        if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      if (!(Math.abs(sx(t) - x) < 1e-5)) {
        var lo = 0, hi = 1; t = x;
        for (i = 0; i < 40; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      }
      return sy(t);
    };
  }
  var EASE = bezier(0.55, 0, 0.45, 1);
  // Угол створки: до 76° (уходит за край экрана) — плавно 80% времени, дальше быстро
  function doorAngle(t) {
    if (t <= 0) return 0;
    var p = Math.min(t / DUR, 1);
    var deg = p <= 0.8 ? 76 * EASE(p / 0.8) : 76 + 21 * (p - 0.8) / 0.2;
    return deg * Math.PI / 180;
  }

  /* ---------- контур розетки (как medal.py: круг 202 px + 8 лепестков) ---------- */
  function outline(phi) {
    var best = 202, bk = -1;
    for (var k = 0; k < 8; k++) {
      var d = phi - k * Math.PI / 4, sd = Math.sin(d);
      var disc = LR * LR - LD * LD * sd * sd;
      if (disc < 0) continue;
      var r = LD * Math.cos(d) + Math.sqrt(disc);
      if (r > best) { best = r; bk = k; }
    }
    var x = best * Math.cos(phi), y = best * Math.sin(phi), nx, ny;
    if (bk < 0) { nx = Math.cos(phi); ny = Math.sin(phi); }
    else {
      nx = x - LD * Math.cos(bk * Math.PI / 4); ny = y - LD * Math.sin(bk * Math.PI / 4);
      var l = Math.hypot(nx, ny); nx /= l; ny /= l;
    }
    return { x: x, y: y, nx: nx, ny: ny };
  }

  /* ---------- шейдеры ---------- */
  var COMMON = [
    'precision highp float;',
    'uniform mat4 uVP, uModel;',
    'uniform vec3 uEye, uL;',
    'uniform vec3 uDoor;',            // W, H, u
    'uniform vec2 uRes;',
    'uniform float uTime;',
    'const float PI = 3.14159265;',
    'vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }',
    'vec3 toSrgb(vec3 c){ return pow(clamp(c, 0.0, 1.0), vec3(1.0/2.2)); }'
  ].join('\n');

  // Только во фрагментных шейдерах: лёгкая виньетка и зерно — как кадр с камеры
  var FINISH = [
    'float grain(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }',
    'vec4 finish(vec3 col){',
    '  vec2 sc = gl_FragCoord.xy/uRes - 0.5;',
    '  col *= 1.0 - 0.09*pow(length(sc*vec2(1.0, 0.75))*1.45, 2.4);',
    '  return vec4(toSrgb(col) + (grain(gl_FragCoord.xy + fract(uTime*7.0)*97.0) - 0.5)*0.01, 1.0);',
    '}'
  ].join('\n');

  // Розетка медальона в пикселях картинки (y вверх, центр 0): свёртка к
  // ближайшему лепестку и зеркало — достаточно двух лепестков и одного луча пайки.
  var MEDAL = [
    'const float LD = 206.0, LR = 104.0, RIN = 172.0, HG = 48.0, HW = 54.0;',
    'const vec2 C1 = vec2(145.66399, 145.66399);',
    'const vec2 DR = vec2(0.9238795, 0.3826834);',
    'vec2 foldQ(vec2 p){',
    '  float b = floor(atan(p.y, p.x + 1e-6)/(PI*0.25) + 0.5)*(PI*0.25);',
    '  float c = cos(b), s = sin(b);',
    '  return vec2(c*p.x + s*p.y, abs(c*p.y - s*p.x));',
    '}',
    'float outSDF(vec2 q, float r){ return min(min(length(q - vec2(LD, 0.0)), length(q - C1)) - LR, r - 202.0); }',
    // внешняя пайка-обод: стенка до 54, скруглённый верх до 65, к стеклу — снова 54
    'float rimH(float din){ float t = (din - 11.0)/11.0; return din < 22.0 ? HW + 11.0*sqrt(max(0.0, 1.0 - t*t)) : -1e4; }'
  ].join('\n');

  // Комната вокруг дверей для отражений: тёмный пол, голубоватые стены,
  // светлый потолок, два высоких софтбокса (блики на раме и пайке).
  var ENV = [
    'vec3 env(vec3 R){',
    '  float el = asin(clamp(R.y, -1.0, 1.0));',
    '  float az = atan(R.x, R.z);',
    '  vec3 c = mix(vec3(0.07, 0.085, 0.12), vec3(0.42, 0.49, 0.62), smoothstep(-0.8, 0.05, el));',
    '  c = mix(c, vec3(0.92, 0.95, 1.0), smoothstep(0.15, 1.0, el));',
    '  float a = smoothstep(0.24, 0.10, abs(az + 0.62))*smoothstep(1.25, 0.55, abs(el - 0.2));',
    '  float b = smoothstep(0.17, 0.07, abs(az - 0.98))*smoothstep(1.05, 0.45, abs(el - 0.05));',
    '  c += vec3(2.1, 2.02, 1.9)*a + vec3(0.85, 0.95, 1.2)*b;',
    '  c = mix(c, vec3(0.86, 0.9, 0.97), smoothstep(-0.25, -0.85, R.z)*0.75);',
    '  return c;',
    '}'
  ].join('\n');

  // Тень медальона на створках: луч к свету до плоскости медальона
  var SHADOW = [
    'uniform vec3 uMC, uMX, uMY, uMN, uLs;',
    'uniform float uMS;',
    'float medalShadow(vec3 P){',
    '  float den = dot(uLs, uMN);',
    '  if (den < 0.05) return 0.0;',
    '  float t = dot(uMC - P, uMN)/den;',
    '  if (t <= 0.0) return 0.0;',
    '  vec3 X = P + uLs*t - uMC;',
    '  vec2 p = vec2(dot(X, uMX), dot(X, uMY))/uMS;',
    '  float sd = outSDF(foldQ(p), length(p));',
    '  float pen = 4.0 + 0.22*t/uMS;',
    '  return 1.0 - smoothstep(-pen, pen, sd);',
    '}'
  ].join('\n');

  var GLASS_VS = [
    '#version 300 es', COMMON,
    'layout(location = 0) in vec3 aPos;',
    'out vec3 vW;',
    'out vec2 vL;',
    'void main(){',
    '  vec4 w = uModel*vec4(aPos, 1.0);',
    '  vW = w.xyz; vL = aPos.xy;',
    '  gl_Position = uVP*w;',
    '}'
  ].join('\n');

  var GLASS_FS = [
    '#version 300 es', COMMON, FINISH, MEDAL, ENV, SHADOW,
    'uniform sampler2D uFrost, uHam;',
    'uniform vec3 uNd, uTd, uLamp1, uLamp2;',
    'uniform float uCoverH, uSeamX, uTheta;',
    'in vec3 vW;',
    'in vec2 vL;',
    'out vec4 o;',
    'void main(){',
    '  float u = uDoor.z;',
    '  vec4 hm = texture(uHam, vL/(560.0*u));',
    '  vec2 sl = hm.xy*2.0 - 1.0;',
    '  float lens = hm.z*2.0 - 1.0;',
    '  vec3 N = normalize(uNd - (uTd*sl.x + vec3(0.0, 1.0, 0.0)*sl.y)*0.36);',
    '  vec3 V = normalize(uEye - vW);',
    // то, что ровно за стеклом (обложка, размытая матовым стеклом), сдвинутое ямками;
    // чем дальше стекло от обложки (створка открывается), тем сильнее размыто
    '  vec2 sp = gl_FragCoord.xy/uRes;',
    '  vec2 pd = vec2(sp.x*uDoor.x, (1.0 - sp.y)*uDoor.y) + vec2(sl.x, -sl.y)*(30.0*u);',
    '  vec2 cuv = vec2(pd.x/uDoor.x, pd.y/uCoverH);',
    '  float lod = log2(1.0 + max(vW.z, 0.0)/(45.0*u));',
    '  vec3 behind = toLin(textureLod(uFrost, cuv, lod).rgb);',
    '  behind = mix(behind, toLin(vec3(0.94, 0.968, 1.0)), smoothstep(0.985, 1.03, cuv.y));',
    '  vec3 trans = mix(behind, toLin(vec3(0.93, 0.955, 0.99)), 0.34);',
    '  trans *= 0.97 + 0.16*lens;',                                  // ямки собирают свет
    '  float sx = (vL.x - uSeamX)/(120.0*u);',
    '  trans += toLin(vec3(1.0, 0.97, 0.9))*0.14*exp(-sx*sx)*(1.0 - smoothstep(0.0, 0.5, uTheta));',
    '  float nv = max(dot(N, V), 0.0);',
    '  trans *= 0.58 + 0.42*nv;',
    // матовое стекло отражает слабее гладкого: на скосе оно не должно стать зеркалом
    '  float F = 0.03 + 0.32*pow(1.0 - nv, 4.0);',
    '  vec3 col = trans*(1.0 - F) + env(reflect(-V, N))*vec3(0.86, 0.92, 1.0)*F;',
    '  float g = pow(max(dot(N, normalize(uLamp1 + V)), 0.0), 140.0)*0.42',
    '          + pow(max(dot(N, normalize(uLamp2 + V)), 0.0), 220.0)*0.32;',
    '  col += vec3(1.0, 0.96, 0.88)*g;',
    '  col *= 1.0 - 0.36*medalShadow(vW);',
    '  o = finish(col);',
    '}'
  ].join('\n');

  var METAL_VS = [
    '#version 300 es', COMMON,
    'layout(location = 0) in vec3 aPos;',
    'layout(location = 1) in vec3 aNrm;',
    'uniform vec4 uLocal;',            // медальон: центр xy, основание z, масштаб; рама: 0,0,0,1
    'out vec3 vW;',
    'out vec3 vN;',
    'out float vZ;',
    'void main(){',
    '  vec3 P = uLocal.xyz + aPos*uLocal.w;',
    '  vec4 w = uModel*vec4(P, 1.0);',
    '  vW = w.xyz; vN = mat3(uModel)*aNrm; vZ = aPos.z;',
    '  gl_Position = uVP*w;',
    '}'
  ].join('\n');

  var METAL_FS = [
    '#version 300 es', COMMON, FINISH, MEDAL, ENV, SHADOW,
    'uniform float uSideAO, uShadowOn;',
    'in vec3 vW;',
    'in vec3 vN;',
    'in float vZ;',
    'out vec4 o;',
    'void main(){',
    '  vec3 N = normalize(vN);',
    '  vec3 V = normalize(uEye - vW);',
    '  if (dot(N, V) < 0.0) N = -N;',
    '  vec3 R = reflect(-V, N);',
    '  float fr = pow(1.0 - max(dot(N, V), 0.0), 5.0);',
    '  vec3 ag = vec3(0.88, 0.9, 0.94);',
    '  vec3 col = env(R)*(ag + (1.0 - ag)*fr);',
    '  col += vec3(1.0)*pow(max(dot(N, normalize(uL + V)), 0.0), 140.0)*0.7;',
    '  col *= mix(1.0, 0.5 + 0.5*smoothstep(0.0, 16.0, vZ), uSideAO);',
    '  col *= 1.0 - 0.36*medalShadow(vW)*uShadowOn;',
    '  o = finish(col);',
    '}'
  ].join('\n');

  var CAP_VS = [
    '#version 300 es', COMMON, MEDAL,
    'layout(location = 0) in vec3 aPos;',
    'uniform vec4 uLocal;',
    'out vec3 vW;',
    'out vec2 vP;',
    'void main(){',
    '  vec2 p = aPos.xy;',
    '  float r = length(p);',
    '  float h = max(HG, rimH(-outSDF(foldQ(p), r)));',
    '  vec3 P = vec3(uLocal.xy + p*uLocal.w, uLocal.z + h*uLocal.w);',
    '  vec4 w = uModel*vec4(P, 1.0);',
    '  vW = w.xyz; vP = p;',
    '  gl_Position = uVP*w;',
    '}'
  ].join('\n');

  var CAP_FS = [
    '#version 300 es', COMMON, FINISH, MEDAL, ENV,
    'uniform sampler2D uMono, uHam;',
    'in vec3 vW;',
    'in vec2 vP;',
    'out vec4 o;',
    'vec2 monoUV(vec2 p){ return vec2(p.x + 320.0, 320.0 - p.y)/640.0; }',
    'float medalH(vec2 p){',
    '  float r = length(p);',
    '  vec2 q = foldQ(p);',
    '  float din = -outSDF(q, r);',
    '  float al = dot(q, DR);',
    '  float dRad = abs(q.x*DR.y - q.y*DR.x);',
    '  float e = min(min(din - 22.0, abs(r - RIN) - 7.0), al > RIN ? dRad - 6.0 : 1e4);',
    '  float h = HG + 7.0*(1.0 - exp(-max(e, 0.0)/16.0));',          // купола стёкол
    '  h = max(h, rimH(din));',
    '  float t = abs(r - RIN)/7.0;',
    '  if (t < 1.0) h = max(h, HG + 1.5 + 8.0*sqrt(1.0 - t*t));',    // кольцо пайки вокруг центра
    '  t = dRad/6.0;',
    '  if (al > RIN - 4.0 && t < 1.0) h = max(h, HG + 1.5 + 7.0*sqrt(1.0 - t*t));',   // лучи пайки
    '  float dp = length(q - 236.0*DR);',
    '  if (dp < 13.0) h = max(h, HG + 7.0 + sqrt(169.0 - dp*dp));',  // жемчуг
    '  if (r < RIN - 7.0) {',
    '    t = (r - 144.0)/2.6;',
    '    if (abs(t) < 1.0) h = max(h, HG + 3.2 + 1.6*sqrt(1.0 - t*t));',
    '    h += 4.5*textureLod(uMono, monoUV(p), 1.6).r;',               // буквы — рельеф
    '  }',
    '  return h;',
    '}',
    'void main(){',
    '  vec2 p = vP;',
    '  float r = length(p);',
    '  vec2 q = foldQ(p);',
    '  float din = -outSDF(q, r);',
    '  float al = dot(q, DR);',
    '  float dRad = abs(q.x*DR.y - q.y*DR.x);',
    '  float ep = 0.9;',
    '  float h0 = medalH(p);',
    '  vec3 nl = normalize(vec3(-(medalH(p + vec2(ep, 0.0)) - h0)/ep, -(medalH(p + vec2(0.0, ep)) - h0)/ep, 1.0));',
    '  vec3 N = normalize(mat3(uModel)*nl);',
    '  float aa = clamp(fwidth(r), 0.4, 3.0);',
    '  float metal = 1.0 - smoothstep(22.0 - aa, 22.0 + aa, din);',
    '  metal = max(metal, 1.0 - smoothstep(7.0 - aa, 7.0 + aa, abs(r - RIN)));',
    '  if (al > RIN - 4.0) metal = max(metal, 1.0 - smoothstep(6.0 - aa, 6.0 + aa, dRad));',
    '  if (r < RIN) metal = max(metal, 1.0 - smoothstep(2.6 - aa, 2.6 + aa, abs(r - 144.0)));',
    '  float pearl = 1.0 - smoothstep(13.0 - aa, 13.0 + aa, length(q - 236.0*DR));',
    '  float letter = r < RIN - 7.0 ? smoothstep(0.32, 0.62, texture(uMono, monoUV(p)).r) : 0.0;',
    // стекло: лепестки через один — васильковые и ледяные, центр — матовый
    '  float k = floor(atan(p.y, p.x + 1e-6)/(PI*0.25) + 0.5);',
    '  float f = clamp((r - RIN)/(LD + LR - RIN), 0.0, 1.0);',
    '  vec3 petal = mod(k, 2.0) < 0.5',
    '    ? mix(vec3(0.518, 0.647, 0.839), vec3(0.259, 0.396, 0.627), f)',
    '    : mix(vec3(0.925, 0.957, 0.992), vec3(0.667, 0.780, 0.914), f);',
    '  vec3 disc = mix(vec3(0.975, 0.984, 0.996), vec3(0.88, 0.915, 0.958), (r/165.0)*(r/165.0));',
    '  vec3 alb = r < RIN ? disc : petal;',
    '  float sw = textureLod(uHam, p/420.0 + 0.37, 3.0).b;',
    '  alb = mix(alb*(0.95 + 0.1*sw), vec3(0.97, 0.985, 1.0), 0.16*smoothstep(0.45, 0.8, sw));',   // опаловые разводы
    '  vec3 V = normalize(uEye - vW);',
    '  vec3 R = reflect(-V, N);',
    '  float nv = max(dot(N, V), 0.0);',
    '  float fr = pow(1.0 - nv, 5.0);',
    '  float nh = max(dot(N, normalize(uL + V)), 0.0);',
    '  float ndl = max(dot(N, uL), 0.0);',
    '  vec3 E = env(R);',
    '  float eC = min(min(din - 22.0, abs(r - RIN) - 7.0), al > RIN ? dRad - 6.0 : 1e4);',
    '  float ao = 0.7 + 0.3*smoothstep(0.0, 10.0, eC);',
    '  vec3 col = toLin(alb)*(0.64 + 0.40*ndl)*ao + E*(0.06 + 0.94*fr)*0.9',
    '    + vec3(1.0, 0.98, 0.94)*(pow(nh, 220.0)*1.3 + pow(nh, 36.0)*0.10);',
    '  vec3 st = vec3(0.30, 0.42, 0.66);',
    '  vec3 lt = E*(st + (1.0 - st)*fr)*0.95 + vec3(0.85, 0.92, 1.0)*pow(nh, 90.0)*0.7;',
    '  vec3 ag = vec3(0.9, 0.92, 0.95);',
    '  vec3 m = E*(ag + (1.0 - ag)*fr) + vec3(1.0)*pow(nh, 140.0)*0.8;',
    '  vec3 pr = toLin(vec3(0.93, 0.94, 0.965))*(0.5 + 0.55*ndl) + E*(0.05 + 0.6*fr) + vec3(1.0)*pow(nh, 60.0)*0.5;',
    '  pr += vec3(0.06, -0.01, 0.05)*fr*2.0;',
    '  col = mix(col, lt, letter);',
    '  col = mix(col, m, metal);',
    '  col = mix(col, pr, pearl);',
    '  o = finish(col);',
    '}'
  ].join('\n');

  /* ---------- GL ---------- */
  // Сборка без ожидания результата: с KHR_parallel_shader_compile драйвер собирает
  // программы в фоне, а статус спрашиваем, когда готово (checkProgram), —
  // главный поток не замирает на время компиляции.
  function compile(gl, vs, fs) {
    var mk = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    var p = gl.createProgram(), v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.linkProgram(p);
    p.sh = [v, f];
    var loc = {};
    p.u = function (name) { return name in loc ? loc[name] : (loc[name] = gl.getUniformLocation(p, name)); };
    return p;
  }
  function checkProgram(gl, p) {
    if (gl.getProgramParameter(p, gl.LINK_STATUS) || gl.isContextLost()) return;
    throw new Error([gl.getProgramInfoLog(p)].concat(p.sh.map(function (s) { return gl.getShaderInfoLog(s); })).join('\n'));
  }
  function whenCompiled(gl, progs) {
    var ext = gl.getExtension('KHR_parallel_shader_compile');
    return new Promise(function (res) {
      if (!ext) { res(); return; }
      (function poll() {
        var done = progs.every(function (p) { return gl.isContextLost() || gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR); });
        if (done) res(); else setTimeout(poll, 16);
      })();
    });
  }

  function Mesh() { this.p = []; this.n = []; this.i = []; }
  Mesh.prototype.quad = function (a, b, c, d, n) {
    var o = this.p.length / 3;
    this.p.push.apply(this.p, a.concat(b, c, d));
    for (var k = 0; k < 4; k++) this.n.push(n[0], n[1], n[2]);
    this.i.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  // Планка рамы: скруглённое лицо (полуэллипс) и боковые грани до задней плоскости.
  // vertical — вдоль y (стойка), иначе вдоль x (перекладина)
  Mesh.prototype.bar = function (vertical, c0, c1, s0, s1, zb, zf) {
    var NS = 10, w = c1 - c0, depth = Math.min(w * 0.42, zf - zb), zm = zf - depth;
    var A = Math.PI * 0.46, o = this.p.length / 3, self = this;
    var put = function (c, s, z, nc, nz) {
      if (vertical) { self.p.push(c, s, z); self.n.push(nc, 0, nz); }
      else { self.p.push(s, c, z); self.n.push(0, nc, nz); }
    };
    for (var k = 0; k <= NS; k++) {
      var a = -A + 2 * A * k / NS;
      var c = (c0 + c1) / 2 + (w / 2) * Math.sin(a), z = zm + depth * Math.cos(a);
      var nc = Math.sin(a) / (w / 2), nz = Math.cos(a) / depth, nl = Math.hypot(nc, nz);
      put(c, s0, z, nc / nl, nz / nl); put(c, s1, z, nc / nl, nz / nl);
    }
    for (k = 0; k < NS; k++) { var b = o + k * 2; this.i.push(b, b + 2, b + 3, b, b + 3, b + 1); }
    var ce = (w / 2) * Math.sin(A), ze = zm + depth * Math.cos(A), cm = (c0 + c1) / 2;
    var P = function (c, s, z) { return vertical ? [c, s, z] : [s, c, z]; };
    var nL = vertical ? [-1, 0, 0] : [0, -1, 0], nR = vertical ? [1, 0, 0] : [0, 1, 0];
    this.quad(P(cm - ce, s0, zb), P(cm - ce, s1, zb), P(cm - ce, s1, ze), P(cm - ce, s0, ze), nL);
    this.quad(P(cm + ce, s0, zb), P(cm + ce, s0, ze), P(cm + ce, s1, ze), P(cm + ce, s1, zb), nR);
  };

  // Обход треугольников — против часовой стрелки снаружи (по нормалям вершин,
  // у крышки медальона — по +z): тогда грани, повёрнутые от гостя, отсекаются.
  // Без этого грань рамы, видимая строго с ребра, при сглаживании давала
  // ложную глубину и светлую черту поверх медальона.
  function orient(mesh) {
    var P = mesh.p, Nn = mesh.n, I = mesh.i;
    for (var t = 0; t < I.length; t += 3) {
      var a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      var ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      var vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      var fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      var rx = 0, ry = 0, rz = 1;
      if (Nn.length) { rx = Nn[a] + Nn[b] + Nn[c]; ry = Nn[a + 1] + Nn[b + 1] + Nn[c + 1]; rz = Nn[a + 2] + Nn[b + 2] + Nn[c + 2]; }
      if (fx * rx + fy * ry + fz * rz < 0) { var k = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = k; }
    }
  }

  function upload(gl, mesh, old) {
    if (old) { gl.deleteVertexArray(old.vao); old.bufs.forEach(function (b) { gl.deleteBuffer(b); }); }
    orient(mesh);
    var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    var bufs = [];
    var attr = function (loc, data) {
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
      bufs.push(b);
    };
    attr(0, mesh.p);
    if (mesh.n.length) attr(1, mesh.n);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(mesh.i), gl.STATIC_DRAW);
    bufs.push(ib);
    gl.bindVertexArray(null);
    return { vao: vao, bufs: bufs, count: mesh.i.length };
  }

  // Медальон: крышка (полярная сетка до контура) и боковая стенка — в пикселях картинки
  function medalMeshes() {
    var cap = new Mesh(), side = new Mesh(), j, i, o;
    var rim = [];
    for (j = 0; j <= PHI_N; j++) rim.push(outline((j % PHI_N) / PHI_N * 2 * Math.PI));
    for (i = 0; i <= RING_N; i++) {
      var rho = 1 - Math.pow(i / RING_N, 2);       // кольца гуще у края — там скруглённый обод
      for (j = 0; j <= PHI_N; j++) cap.p.push(rim[j].x * rho, rim[j].y * rho, 0);
    }
    for (i = 0; i < RING_N; i++) for (j = 0; j < PHI_N; j++) {
      var a = i * (PHI_N + 1) + j, c = a + PHI_N + 1;
      cap.i.push(a, c, a + 1, a + 1, c, c + 1);
    }
    for (j = 0; j <= PHI_N; j++) {
      side.p.push(rim[j].x, rim[j].y, 0, rim[j].x, rim[j].y, WALL);
      side.n.push(rim[j].nx, rim[j].ny, 0, rim[j].nx, rim[j].ny, 0);
    }
    for (j = 0; j < PHI_N; j++) { o = j * 2; side.i.push(o, o + 2, o + 3, o, o + 3, o + 1); }
    return { cap: cap, side: side };
  }

  // «Молотковое» стекло: ямки (Вороной F1², бесшовно), сглаженные гребни.
  // RG — наклон, B — «линза» (минус лапласиан: центры ямок собирают свет).
  function hammerTexture(gl) {
    var N = 256, h = new Float32Array(N * N), seed = 11;
    var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var layer = function (G, amp) {
      var cell = N / G, px = [], py = [], x, y;
      for (var j = 0; j < G; j++) for (var i = 0; i < G; i++) {
        px.push((i + 0.05 + 0.9 * rnd()) * cell); py.push((j + 0.05 + 0.9 * rnd()) * cell);
      }
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
        var ci = Math.floor(x / cell), cj = Math.floor(y / cell), best = 1e9;
        for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
          var ii = ci + di, jj = cj + dj, ox = 0, oy = 0;
          if (ii < 0) { ii += G; ox = -N; } else if (ii >= G) { ii -= G; ox = N; }
          if (jj < 0) { jj += G; oy = -N; } else if (jj >= G) { jj -= G; oy = N; }
          var dx = px[jj * G + ii] + ox - x, dy = py[jj * G + ii] + oy - y, d = dx * dx + dy * dy;
          if (d < best) best = d;
        }
        h[y * N + x] += amp * Math.pow(best / (cell * cell), 0.8);
      }
    };
    layer(7, 1.0);
    layer(15, 0.28);
    // сглаживание гребней (бокс-фильтр дважды, по кругу)
    var tmp = new Float32Array(N * N), R = 4, w = 2 * R + 1, pass, x, y, s, k;
    for (pass = 0; pass < 2; pass++) {
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
        s = 0; for (k = -R; k <= R; k++) s += h[y * N + ((x + k + N) % N)];
        tmp[y * N + x] = s / w;
      }
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
        s = 0; for (k = -R; k <= R; k++) s += tmp[((y + k + N) % N) * N + x];
        h[y * N + x] = s / w;
      }
    }
    var at = function (x, y) { return h[((y + N) % N) * N + ((x + N) % N)]; };
    var gx = new Float32Array(N * N), gy = new Float32Array(N * N), lp = new Float32Array(N * N), mg = 0, ml = 0;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) {
      var i0 = y * N + x;
      gx[i0] = (at(x + 1, y) - at(x - 1, y)) / 2; gy[i0] = (at(x, y + 1) - at(x, y - 1)) / 2;
      lp[i0] = -(at(x + 1, y) + at(x - 1, y) + at(x, y + 1) + at(x, y - 1) - 4 * at(x, y));
      mg = Math.max(mg, Math.abs(gx[i0]), Math.abs(gy[i0])); ml = Math.max(ml, Math.abs(lp[i0]));
    }
    var data = new Uint8Array(N * N * 4), cl = function (v) { return Math.max(0, Math.min(255, Math.round(v * 127.5 + 127.5))); };
    for (i0 = 0; i0 < N * N; i0++) {
      data[i0 * 4] = cl(gx[i0] / mg * 0.9); data[i0 * 4 + 1] = cl(gy[i0] / mg * 0.9);
      data[i0 * 4 + 2] = cl(lp[i0] / ml); data[i0 * 4 + 3] = 255;
    }
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, N, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }

  function imageTexture(gl, img, t) {
    t = t || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  function loadImage(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = src;
    });
  }

  /* ---------- сцена ---------- */
  function mount(el, opts) {
    opts = opts || {};
    var canvas = document.createElement('canvas');
    canvas.className = 'doors__gl';
    canvas.setAttribute('aria-hidden', 'true');
    var gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: false });
    if (!gl) throw new Error('WebGL2 недоступен');
    // Программный WebGL (без видеокарты) тянул бы створки рывками — тогда CSS-версия.
    // Chrome и Safari прячут имя в RENDERER («WebKit WebGL») — тогда спрашиваем расширение
    var rend = String(gl.getParameter(gl.RENDERER) || '');
    if (/^webkit webgl$/i.test(rend)) {
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) rend = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
    }
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(rend) && !window.__wcSoftwareGL) {
      var lose0 = gl.getExtension('WEBGL_lose_context');
      if (lose0) lose0.loseContext();
      throw new Error('программный WebGL');
    }

    var S = { openAt: null, mono: null, pointer: [0, 0], light: [0, 0], inited: false, destroyed: false, lost: false, idleUntil: 0 };
    var P = {}, M = {}, T = {}, L = {};
    var monoCanvas = document.createElement('canvas');
    monoCanvas.width = monoCanvas.height = 640;

    function drawMono() {
      var g = monoCanvas.getContext('2d'), m = S.mono;
      g.fillStyle = '#000'; g.fillRect(0, 0, 640, 640);
      if (m) {
        g.fillStyle = g.strokeStyle = '#fff';
        g.lineJoin = 'round'; g.lineWidth = 7;
        g.font = m.f + 'px ' + m.script;
        g.fillText(m.letters[0], m.ox, m.oy); g.strokeText(m.letters[0], m.ox, m.oy);
        g.fillText(m.letters[1], m.ox + m.f * m.bx, m.oy); g.strokeText(m.letters[1], m.ox + m.f * m.bx, m.oy);
        g.font = 'italic 400 ' + (m.f * m.amp) + 'px ' + m.ampFont;
        g.fillText('&', m.ox + m.f * m.mx, m.oy + m.f * m.my);
        g.strokeText('&', m.ox + m.f * m.mx, m.oy + m.f * m.my);
      }
      T.mono = imageTexture(gl, monoCanvas, T.mono);
    }

    function layout() {
      var W = Math.max(1, el.clientWidth), H = Math.max(1, el.clientHeight);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (W * H * dpr * dpr > 2.6e6) dpr = Math.sqrt(2.6e6 / (W * H));
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      var u = W / 1366;
      L.W = W; L.H = H; L.u = u;
      L.D = PERSP * u;
      L.coverH = 2601 * u;
      L.ms = MED_S * u;
      L.med = [W / 2, H / 2, MED_Z * u];
      var view = lookAt([W / 2, H / 2, L.D], [W / 2, H / 2, 0], [0, 1, 0]);
      var fov = 2 * Math.atan(H / 2 / L.D);
      L.vp = mul(perspective(fov, W / H, L.D * 0.05, L.D * 4), view);
      L.eye = [W / 2, H / 2, L.D];
      // стекло — на всю створку; рама поверх: стойки у шва и у краёв, перекладины сверху и снизу
      var half = W / 2, zb = -34 * u, zf = 12 * u, si = 16 * u, so = 14 * u, rl = 14 * u;
      var gL = new Mesh(), gR = new Mesh(), fL = new Mesh(), fR = new Mesh();
      gL.quad([0, 0, 0], [half, 0, 0], [half, H, 0], [0, H, 0], [0, 0, 1]);
      gR.quad([half, 0, 0], [W, 0, 0], [W, H, 0], [half, H, 0], [0, 0, 1]);
      fL.bar(true, half - si, half, 0, H, zb, zf); fL.bar(true, 0, so, 0, H, zb, zf);
      fL.bar(false, 0, rl, 0, half, zb, zf); fL.bar(false, H - rl, H, 0, half, zb, zf);
      fR.bar(true, half, half + si, 0, H, zb, zf); fR.bar(true, W - so, W, 0, H, zb, zf);
      fR.bar(false, 0, rl, half, W, zb, zf); fR.bar(false, H - rl, H, half, W, zb, zf);
      M.gL = upload(gl, gL, M.gL); M.gR = upload(gl, gR, M.gR);
      M.fL = upload(gl, fL, M.fL); M.fR = upload(gl, fR, M.fR);
    }

    function common(p, s) {
      gl.uniformMatrix4fv(p.u('uVP'), false, L.vp);
      gl.uniform3fv(p.u('uEye'), L.eye);
      gl.uniform3fv(p.u('uL'), s.L);
      gl.uniform3f(p.u('uDoor'), L.W, L.H, L.u);
      gl.uniform2f(p.u('uRes'), canvas.width, canvas.height);
      gl.uniform1f(p.u('uTime'), s.time);
    }
    function shadowU(p, s) {
      gl.uniform3fv(p.u('uMC'), s.mc); gl.uniform3fv(p.u('uMX'), s.mx);
      gl.uniform3fv(p.u('uMY'), [0, 1, 0]); gl.uniform3fv(p.u('uMN'), s.mn);
      gl.uniform3fv(p.u('uLs'), s.L); gl.uniform1f(p.u('uMS'), L.ms);
    }
    function drawMesh(m) { gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0); }

    // t < 0 — двери закрыты; t ≥ 0 — секунды с начала открытия
    function draw(t, time) {
      var th = doorAngle(t);
      var s = { time: time };
      var lx = -0.33 + S.light[0] + 0.04 * Math.sin(time * 0.7), ly = 0.5 + S.light[1] + 0.03 * Math.cos(time * 0.53);
      s.L = norm([lx, ly, 0.8]);
      var mL = hinge(-th, 0), mR = hinge(th, L.W);
      var c = L.med;
      s.mc = xform(mR, [c[0], c[1], c[2] + WALL * L.ms]);
      s.mx = xdir(mR, [1, 0, 0]); s.mn = xdir(mR, [0, 0, 1]);
      var lamp1 = norm([-0.22 + S.light[0] * 0.5, 0.26 + S.light[1] * 0.5 + 0.02 * Math.sin(time * 1.3), 0.94]);
      var lamp2 = norm([0.30 + 0.02 * Math.cos(time * 1.1), 0.10, 0.95]);

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      if (th >= 96 * Math.PI / 180) return;           // створки за краями экрана
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.disable(gl.BLEND);

      var p = P.glass;
      gl.useProgram(p); common(p, s); shadowU(p, s);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.frost); gl.uniform1i(p.u('uFrost'), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.ham); gl.uniform1i(p.u('uHam'), 1);
      gl.uniform3fv(p.u('uLamp1'), lamp1); gl.uniform3fv(p.u('uLamp2'), lamp2);
      gl.uniform1f(p.u('uCoverH'), L.coverH); gl.uniform1f(p.u('uSeamX'), L.W / 2); gl.uniform1f(p.u('uTheta'), th);
      [[mL, M.gL], [mR, M.gR]].forEach(function (lf) {
        gl.uniformMatrix4fv(p.u('uModel'), false, lf[0]);
        gl.uniform3fv(p.u('uNd'), xdir(lf[0], [0, 0, 1])); gl.uniform3fv(p.u('uTd'), xdir(lf[0], [1, 0, 0]));
        drawMesh(lf[1]);
      });

      p = P.metal;
      gl.useProgram(p); common(p, s); shadowU(p, s);
      gl.uniform4f(p.u('uLocal'), 0, 0, 0, 1);
      gl.uniform1f(p.u('uSideAO'), 0); gl.uniform1f(p.u('uShadowOn'), 1);
      gl.uniformMatrix4fv(p.u('uModel'), false, mL); drawMesh(M.fL);
      gl.uniformMatrix4fv(p.u('uModel'), false, mR); drawMesh(M.fR);
      // боковая стенка медальона — та же серебряная пайка
      gl.uniform4f(p.u('uLocal'), c[0], c[1], c[2], L.ms);
      gl.uniform1f(p.u('uSideAO'), 1); gl.uniform1f(p.u('uShadowOn'), 0);
      drawMesh(M.side);

      p = P.cap;
      gl.useProgram(p); common(p, s);
      gl.uniformMatrix4fv(p.u('uModel'), false, mR);
      gl.uniform4f(p.u('uLocal'), c[0], c[1], c[2], L.ms);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.mono); gl.uniform1i(p.u('uMono'), 2);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.ham); gl.uniform1i(p.u('uHam'), 1);
      drawMesh(M.cap);
      gl.bindVertexArray(null);
    }

    // Кадры — только пока двери на экране и вкладка видна: во время открытия и
    // ещё несколько секунд у закрытых (блики переливаются), потом холст стоит
    var t0 = performance.now(), raf = 0, running = false, visible = true;
    var sceneT = function (now) { return S.openAt == null ? -1 : (now - S.openAt) / 1000; };
    var wake = function () { S.idleUntil = performance.now() + 6000; };
    function frame(now) {
      if (!S.inited || S.lost) return;
      S.light[0] += (S.pointer[0] - S.light[0]) * 0.06;
      S.light[1] += (S.pointer[1] - S.light[1]) * 0.06;
      draw(sceneT(now), (now - t0) / 1000);
    }
    function loop(now) {
      if (!running) return;
      frame(now);
      var t = sceneT(now);
      if (t > DUR + 0.2 || (t < 0 && now > S.idleUntil)) { running = false; raf = 0; return; }
      raf = requestAnimationFrame(loop);
    }
    function start() {
      if (running || S.destroyed || !S.inited || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    function redraw() { if (!running) frame(performance.now()); }

    // Двери спрятаны: открыты в редакторе (is-gone) или скрытый слой показа на обложке
    // (../assets/intro-preview.js) — кадры не нужны
    var asleep = function () {
      return el.classList.contains('is-gone') || (el.classList.contains('wc-ip-layer') && !el.classList.contains('wc-ip-on'));
    };
    var onPointer = function (e) {
      if (S.openAt != null || asleep()) return;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      S.pointer = [Math.max(-0.25, Math.min(0.25, ((e.clientX - r.left) / r.width - 0.5) * 0.4)),
        Math.max(-0.25, Math.min(0.25, (0.5 - (e.clientY - r.top) / r.height) * 0.4))];
      wake(); start();
    };
    var onVis = function () { if (document.hidden) stop(); else start(); };
    var ro = 'ResizeObserver' in window ? new ResizeObserver(function () { if (S.inited) { layout(); redraw(); } }) : null;
    var io = 'IntersectionObserver' in window
      ? new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) start(); else stop(); })
      : null;

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      S.lost = true; stop();
      if (opts.onLost) opts.onLost();
    });

    var ready = new Promise(function (resolve, reject) {
      // Тяжёлое (шейдеры, текстура ямок) — после первого кадра страницы
      setTimeout(function () {
        if (S.destroyed) { reject(new Error('destroyed')); return; }
        var progs;
        try {
          P.glass = compile(gl, GLASS_VS, GLASS_FS);
          P.metal = compile(gl, METAL_VS, METAL_FS);
          P.cap = compile(gl, CAP_VS, CAP_FS);
          progs = [P.glass, P.metal, P.cap];
          // пока драйвер собирает шейдеры — сетки медальона и текстура ямок
          var mm = medalMeshes();
          M.cap = upload(gl, mm.cap); M.side = upload(gl, mm.side);
          T.ham = hammerTexture(gl);
        } catch (err) { reject(err); return; }
        var built = whenCompiled(gl, progs).then(function () { progs.forEach(function (p) { checkProgram(gl, p); }); });
        var fonts = document.fonts && document.fonts.load
          ? Promise.all([document.fonts.load('100px "HamiltoneSHA"'), document.fonts.load('italic 400 40px Lora', '&')]).catch(function () {})
          : Promise.resolve();
        var capWait = new Promise(function (r) { setTimeout(r, 2000); });
        Promise.all([loadImage(opts.frost || 'assets/frost.jpg'), Promise.race([fonts, capWait]), built]).then(function (res) {
          if (S.destroyed) { reject(new Error('destroyed')); return; }
          T.frost = imageTexture(gl, res[0]);
          drawMono();
          el.insertBefore(canvas, el.querySelector('.doors__replay'));
          layout();
          S.inited = true;
          frame(performance.now());
          if (gl.getError() !== gl.NO_ERROR || gl.isContextLost()) { reject(new Error('gl error')); return; }
          if (ro) ro.observe(el);
          if (io) io.observe(el);
          window.addEventListener('pointermove', onPointer, { passive: true });
          document.addEventListener('visibilitychange', onVis);
          // в редакторе двери спрятаны до показа — холст ждёт, кадры не нужны
          if (!asleep()) { wake(); start(); }
          resolve();
        }, reject);
      }, 30);
    });

    var api = {
      ready: ready,
      canvas: canvas,
      open: function () {
        if (S.openAt != null) return;
        S.openAt = performance.now();
        start();
      },
      reset: function () { S.openAt = null; wake(); redraw(); start(); },
      setMono: function (m) { S.mono = m; if (S.inited) { drawMono(); redraw(); } },
      // для проверок: нарисовать кадр в момент t (с) без живого цикла
      renderAt: function (t) { stop(); draw(t, 0); },
      destroy: function () {
        S.destroyed = true; stop();
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        window.removeEventListener('pointermove', onPointer);
        document.removeEventListener('visibilitychange', onVis);
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      }
    };
    canvas.wcDoors = api;              // для проверок (кадры renderAt)
    return api;
  }

  window.WCDoors3D = { mount: mount };
})();
