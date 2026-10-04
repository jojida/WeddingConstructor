// 3D-конверт на WebGL2 без библиотек — общий движок шаблонов
// (подключает ../envelope3d.js, прототип — /envelope-3d/index.html).
//
// Сцена: плоскость конверта z=0 (мир в CSS-пикселях сцены, y вверх), клапан —
// сетка, которая поворачивается вокруг верхнего сгиба, печать — сетка с картой
// высот, приклеенная к клапану. Бумага берётся из фото-текстуры, а свет считается
// как ПОПРАВКА к ней: в покое множитель = 1, поэтому неподвижный конверт выглядит
// ровно как текстура. Монограмма — рельеф воска из шрифта, поэтому буквы не могут
// «отъехать» от печати: это один объект с общим светом.

const SEAL_N = 512;
const FACE_R = 0.665;   // радиус круглого «лица» печати в долях внешнего радиуса

// ---------------------------------------------------------------- math
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function lookAt(e, c, up) {
  let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([
    xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1,
  ]);
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
    o[i * 4 + j] = s;
  }
  return o;
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const prog = (t, [a, b]) => clamp((t - a) / (b - a), 0, 1);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const srgbToLin = (c) => c.map((v) => Math.pow(v, 2.2));

const _f32 = new Float32Array(1), _u32 = new Uint32Array(_f32.buffer);
function toHalf(v) {
  _f32[0] = v;
  const x = _u32[0], sign = (x >>> 16) & 0x8000;
  let exp = ((x >>> 23) & 0xff) - 112;
  const mant = x & 0x7fffff;
  if (exp <= 0) return sign;
  if (exp >= 31) return sign | 0x7c00;
  return sign | ((exp << 10) + ((mant + 0x1000) >> 13));
}
function hash2(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise2(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j) + (hash2(i + 1, j) - hash2(i, j)) * u;
  const b = hash2(i, j + 1) + (hash2(i + 1, j + 1) - hash2(i, j + 1)) * u;
  return (a + (b - a) * v) * 2 - 1;
}
function blurF(src, N, r) {
  const R = Math.max(1, Math.round(r)), w = 2 * R + 1, ci = (i) => (i < 0 ? 0 : i >= N ? N - 1 : i);
  let a = Float32Array.from(src);
  const b = new Float32Array(N * N);
  for (let pass = 0; pass < 3; pass++) {
    for (let j = 0; j < N; j++) {
      const row = j * N; let s = 0;
      for (let i = -R; i <= R; i++) s += a[row + ci(i)];
      for (let i = 0; i < N; i++) { b[row + i] = s / w; s += a[row + ci(i + R + 1)] - a[row + ci(i - R)]; }
    }
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let j = -R; j <= R; j++) s += b[ci(j) * N + i];
      for (let j = 0; j < N; j++) { a[j * N + i] = s / w; s += b[ci(j + R + 1) * N + i] - b[ci(j - R) * N + i]; }
    }
  }
  return a;
}

// ---------------------------------------------------------------- shaders
const COMMON = `
precision highp float;
uniform mat4 uVP;
uniform vec2 uStage, uRes;
uniform float uHingeY, uFlapZ, uTheta, uKappa, uTipCv, uTipR, uAlpha;
uniform float uSealV, uSealR, uSealT, uFlapLen, uTime;
uniform vec3 uL, uL0, uEye;

vec3 flapPos(float u, float v){
  float th = uTheta, k = uKappa, y, z;
  if (abs(k) < 1e-7) { y = uHingeY - v*cos(th); z = uFlapZ + v*sin(th); }
  else { y = uHingeY - (sin(th + k*v) - sin(th))/k; z = uFlapZ + (cos(th) - cos(th + k*v))/k; }
  return vec3(uStage.x*0.5 + u, y, z);
}
// Клапан в собственных координатах (u — от центра вправо, v — вниз от сгиба):
// клин, стороны которого касаются окружности на кончике.
float flapSDF(vec2 p){
  vec2 q = vec2(abs(p.x), -(p.y - uTipCv));
  vec2 n = vec2(cos(uAlpha), -sin(uAlpha));
  vec2 d = vec2(sin(uAlpha), cos(uAlpha));
  float s = dot(q - uTipR*n, d);
  float sd = s > 0.0 ? dot(q, n) - uTipR : length(q) - uTipR;
  return max(sd, -p.y);
}
float sealSDF(vec2 p){ return length(p - vec2(0.0, uSealV)) - uSealR*0.96; }
vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
vec3 toSrgb(vec3 c){ return pow(max(c, vec3(0.0)), vec3(1.0/2.2)); }
float shadeL(vec3 n, vec3 L){ return 0.40 + 0.60*max(dot(n, L), 0.0); }
`;

// Только для фрагментных шейдеров: виньетка и зерно.
const FRAG = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)))*43758.5453); }
vec3 finish(vec3 col){
  vec2 sc = gl_FragCoord.xy/uRes;
  col *= 1.0 - 0.07*pow(length(sc - 0.5)*1.3, 2.5);
  return toSrgb(col) + (hash(gl_FragCoord.xy + fract(uTime*7.0)*97.0) - 0.5)*0.008;
}
`;

const PAPER = `
uniform sampler2D uPaper;
uniform vec2 uPaperK, uPaperTexel;
uniform float uRelief;
vec2 paperUV(vec2 pw){ vec2 uv = (pw - uStage*0.5)*uPaperK + 0.5; return vec2(uv.x, 1.0 - uv.y); }
vec3 paperN(vec2 uv){
  vec2 e = uPaperTexel*1.25;
  float l = dot(texture(uPaper, uv - vec2(e.x, 0.0)).rgb, vec3(0.3333));
  float r = dot(texture(uPaper, uv + vec2(e.x, 0.0)).rgb, vec3(0.3333));
  float t = dot(texture(uPaper, uv - vec2(0.0, e.y)).rgb, vec3(0.3333));
  float b = dot(texture(uPaper, uv + vec2(0.0, e.y)).rgb, vec3(0.3333));
  return normalize(vec3(-vec2(r - l, t - b)*uRelief, 1.0));
}
// Светлое золото: напечатанная веточка и надписи на карточке.
vec3 foil(vec3 n, vec3 V, vec3 L){
  vec3 base = toLin(vec3(0.80, 0.69, 0.50));
  vec3 H = normalize(L + V);
  float s = pow(max(dot(n, H), 0.0), 56.0);
  return base*(0.62 + 0.38*max(dot(n, L), 0.0)) + toLin(vec3(1.0, 0.92, 0.76))*s*0.6;
}
`;

const BODY_VS = `#version 300 es
${COMMON}
in vec2 aPos;
out vec2 vP;
void main(){
  vec2 p = mix(vec2(-0.15), vec2(1.15), aPos)*uStage;
  vP = p;
  gl_Position = uVP*vec4(p, 0.0, 1.0);
}`;

const BODY_FS = `#version 300 es
${COMMON}
${FRAG}
${PAPER}
uniform sampler2D uSprig, uCard;
uniform vec4 uCardRect;
uniform float uCardShift, uPocketY, uSeamY, uSeamApexY;
uniform vec3 uSprig0;
in vec2 vP;
out vec4 o;

float vLine(vec2 p, float apexY, float sideY){
  float hw = uStage.x*0.5, k = (sideY - apexY)/hw;
  return (p.y - (apexY + k*abs(p.x - hw)))/sqrt(1.0 + k*k);
}
float bodyShadow(vec3 P){
  float a = uTheta + uKappa*uFlapLen*0.5;
  vec3 nf = vec3(0.0, sin(a), cos(a));
  vec3 H0 = vec3(0.0, uHingeY, uFlapZ);
  float den = dot(uL, nf);
  if (abs(den) < 1e-3) return 0.0;
  float t = dot(H0 - P, nf)/den;
  if (t <= 0.0) return 0.0;
  vec3 X = P + t*uL;
  float v = dot(X - H0, vec3(0.0, -cos(a), sin(a)));
  float sd = flapSDF(vec2(X.x - uStage.x*0.5, v));
  float pen = 0.8 + t*0.09;
  return 1.0 - smoothstep(-pen, pen, sd);
}
float sprigAt(vec2 q){
  if (q.x <= 0.0 || q.x >= 1.0 || q.y <= 0.0 || q.y >= 1.0) return 0.0;
  return pow(texture(uSprig, vec2(q.x, 1.0 - q.y)).r, 0.8);
}
void main(){
  vec2 p = vP;
  vec3 P = vec3(p, 0.0);
  vec3 V = normalize(uEye - P);
  vec2 uv = paperUV(p);
  vec3 alb = toLin(texture(uPaper, uv).rgb);
  vec3 n = paperN(uv);
  float ratio = shadeL(n, uL)/shadeL(n, uL0);
  vec3 col = alb*ratio;

  float sdRest = flapSDF(vec2(p.x - uStage.x*0.5, uHingeY - p.y));
  float pocket = vLine(p, uPocketY, uHingeY);

  if (pocket > 0.0) {
    // Внутренность конверта: видна только когда клапан поднят.
    vec2 cp = vec2(p.x, p.y - uCardShift);
    vec3 ic;
    if (cp.x > uCardRect.x && cp.x < uCardRect.y && cp.y > uCardRect.z && cp.y < uCardRect.w) {
      vec2 cuv = vec2((cp.x - uCardRect.x)/(uCardRect.y - uCardRect.x), 1.0 - (cp.y - uCardRect.z)/(uCardRect.w - uCardRect.z));
      float ink = texture(uCard, cuv).r;
      vec3 cn = normalize(vec3(n.xy*0.35, 1.0));
      vec3 c = toLin(vec3(0.972, 0.953, 0.915))*(0.80 + 0.20*max(dot(cn, uL), 0.0));
      c = mix(c, foil(cn, V, uL)*0.92, ink);
      c *= 0.93 + 0.07*smoothstep(0.0, 3.0, min(cp.x - uCardRect.x, uCardRect.y - cp.x));
      ic = c;
    } else {
      ic = toLin(vec3(0.80, 0.72, 0.60))*(0.80 + 0.20*ratio);
      float dx = min(abs(cp.x - uCardRect.x), abs(cp.x - uCardRect.y));
      ic *= 0.80 + 0.20*smoothstep(0.0, 7.0, dx);
    }
    // Глубина кармана: темнее у кромок, тень правой кромки ложится внутрь.
    ic *= 0.80 + 0.20*smoothstep(0.0, 70.0, pocket);
    float hw = uStage.x*0.5, kk = (uHingeY - uPocketY)/hw;
    float dR = (p.y - (uPocketY + kk*(p.x - hw)))/sqrt(1.0 + kk*kk);
    if (p.x > hw - 40.0) ic *= 1.0 - 0.22*exp(-max(dR, 0.0)/9.0);
    col = ic;
  } else if (sdRest < 0.0) {
    // Верхняя кромка кармана (под клапаном).
    col *= 1.0 + 0.06*exp(-pow((pocket + 0.9)/0.9, 2.0));
  }
  if (pocket < 0.0) {
    // Швы нижнего клапана конверта.
    float s = vLine(p, uSeamApexY, uSeamY);
    col *= 1.0 - 0.06*exp(-pow((s - 1.0)/1.1, 2.0));
    col *= 1.0 + 0.03*exp(-pow((s + 1.0)/0.9, 2.0));
  }
  float S = uSprig0.z;
  float m = max(sprigAt((p - uSprig0.xy)/S), sprigAt(vec2(uStage.x - uSprig0.x - p.x, p.y - uSprig0.y)/S));
  col = mix(col, foil(n, V, uL), m*0.92);

  col *= mix(vec3(1.0), vec3(0.74, 0.71, 0.66), bodyShadow(P)*0.85);
  float lift = clamp(uTheta*2.5, 0.0, 1.0);
  if (sdRest > 0.0) col *= 1.0 - (0.06*exp(-sdRest/1.6) + 0.07*exp(-sdRest/5.0))*(1.0 - lift);
  o = vec4(finish(col), 1.0);
}`;

const FLAP_VS = `#version 300 es
${COMMON}
in vec2 aPos;
uniform vec4 uFlapBox;
out vec2 vUV;
out vec3 vW;
out float vA;
void main(){
  float u = mix(uFlapBox.x, uFlapBox.y, aPos.x);
  float v = mix(uFlapBox.z, uFlapBox.w, aPos.y);
  vec3 P = flapPos(u, v);
  vUV = vec2(u, v); vW = P; vA = uTheta + uKappa*v;
  gl_Position = uVP*vec4(P, 1.0);
}`;

const FLAP_FS = `#version 300 es
${COMMON}
${FRAG}
${PAPER}
uniform sampler2D uSprig;
uniform vec3 uSprig0;
in vec2 vUV;
in vec3 vW;
in float vA;
out vec4 o;
float sprigAt(vec2 q){
  if (q.x <= 0.0 || q.x >= 1.0 || q.y <= 0.0 || q.y >= 1.0) return 0.0;
  return pow(texture(uSprig, vec2(q.x, 1.0 - q.y)).r, 0.8);
}
void main(){
  float sd = flapSDF(vUV);
  float aa = max(fwidth(sd)*0.8, 0.45);
  float alpha = 1.0 - smoothstep(-aa, aa, sd);
  if (alpha < 0.003) discard;
  vec3 ex = vec3(1.0, 0.0, 0.0), ey = vec3(0.0, cos(vA), -sin(vA)), ez = vec3(0.0, sin(vA), cos(vA));
  vec2 pr = vec2(uStage.x*0.5 + vUV.x, uHingeY - vUV.y);
  vec2 uv = paperUV(pr); uv.x = 1.0 - uv.x;
  vec3 V = normalize(uEye - vW);
  vec3 col;
  // Сетка клапана идёт вниз от сгиба (v растёт вниз), поэтому обход
  // треугольников зеркальный: лицевая сторона — это !gl_FrontFacing.
  if (!gl_FrontFacing) {
    vec3 alb = toLin(texture(uPaper, uv).rgb);
    vec3 nl = paperN(uv); nl.x = -nl.x;
    vec3 nw = ex*nl.x + ey*nl.y + ez*nl.z;
    col = alb*shadeL(nw, uL)/shadeL(nl, uL0);
    // Верхние веточки напечатаны на клапане и уезжают вместе с ним.
    float S = uSprig0.z, yT = uStage.y - uSprig0.y;
    float m = max(sprigAt(vec2(pr.x - uSprig0.x, yT - pr.y)/S), sprigAt(vec2(uStage.x - uSprig0.x - pr.x, yT - pr.y)/S));
    col = mix(col, foil(nw, V, uL), m*0.92);
    // Тень и прижим печати на клапане.
    vec3 Lf = vec3(dot(uL, ex), dot(uL, ey), dot(uL, ez));
    vec2 off = uSealT*2.0*vec2(Lf.x, -Lf.y)/max(Lf.z, 0.25);
    col *= mix(vec3(1.0), vec3(0.62, 0.58, 0.53), 0.72*(1.0 - smoothstep(-6.0, 11.0, sealSDF(vUV + off))));
    col *= 1.0 - 0.26*exp(-max(sealSDF(vUV), 0.0)/3.5);
    // Светлая кромка бумаги.
    col *= 1.0 + 0.05*(1.0 - smoothstep(0.0, 1.6, -sd))*max(dot(ez, uL), 0.0);
  } else {
    // Изнанка клапана — подкладка.
    vec3 alb = toLin(vec3(0.84, 0.77, 0.66))*(0.94 + 0.06*texture(uPaper, uv*1.3).r);
    col = alb*(0.42 + 0.58*max(dot(-ez, uL), 0.0));
  }
  o = vec4(finish(col)*alpha, alpha);
}`;

const SEAL_VS = `#version 300 es
${COMMON}
in vec2 aPos;
uniform sampler2D uSealTex;
uniform float uSealScale;
out vec2 vTex;
out vec3 vW;
out float vA;
void main(){
  vec2 t = vec2(aPos.x*0.5 + 0.5, 0.5 - aPos.y*0.5);
  float h = textureLod(uSealTex, t, 0.0).r;
  float a = uTheta + uKappa*uSealV;
  vec3 O = flapPos(0.0, uSealV);
  vec3 ey = vec3(0.0, cos(a), -sin(a)), ez = vec3(0.0, sin(a), cos(a));
  float R = uSealR*uSealScale;
  vec3 P = O + vec3(aPos.x*R, 0.0, 0.0) + ey*(aPos.y*R) + ez*(h*uSealT*uSealScale + 0.6);
  vTex = t; vW = P; vA = a;
  gl_Position = uVP*vec4(P, 1.0);
}`;

const SEAL_FS = `#version 300 es
${COMMON}
${FRAG}
uniform sampler2D uSealTex;
uniform vec3 uWaxCol, uGoldCol;
uniform float uWaxGloss;
in vec2 vTex;
in vec3 vW;
in float vA;
out vec4 o;
void main(){
  vec4 s = texture(uSealTex, vTex);
  float m = s.b;
  if (m < 0.003) discard;
  float e = 1.0/${SEAL_N}.0;
  float hl = texture(uSealTex, vTex - vec2(e, 0.0)).r, hr = texture(uSealTex, vTex + vec2(e, 0.0)).r;
  float hu = texture(uSealTex, vTex - vec2(0.0, e)).r, hd = texture(uSealTex, vTex + vec2(0.0, e)).r;
  float k = uSealT/(uSealR*4.0/${SEAL_N}.0);
  vec3 nl = normalize(vec3(-(hr - hl)*k, -(hu - hd)*k, 1.0));
  vec3 ex = vec3(1.0, 0.0, 0.0), ey = vec3(0.0, cos(vA), -sin(vA)), ez = vec3(0.0, sin(vA), cos(vA));
  vec3 N = normalize(ex*nl.x + ey*nl.y + ez*nl.z);
  vec3 V = normalize(uEye - vW);
  vec3 Hh = normalize(uL + V);
  float diff = clamp((dot(N, uL) + 0.38)/1.38, 0.0, 1.0);
  float nh = max(dot(N, Hh), 0.0);
  float ao = s.a;
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  vec3 wax = uWaxCol*(0.34 + 0.78*diff)*ao;
  wax += uWaxCol*vec3(1.0, 0.82, 0.62)*0.10*(1.0 - diff)*ao;
  wax += vec3(1.0, 0.97, 0.92)*(pow(nh, 24.0)*0.16 + pow(nh, 110.0)*0.30)*uWaxGloss*ao;
  wax += uWaxCol*fres*0.12;
  vec3 R = reflect(-V, N);
  vec3 env = mix(vec3(0.22, 0.18, 0.13), vec3(1.0, 0.95, 0.86), smoothstep(-0.3, 0.9, R.y*0.7 + R.z*0.5));
  vec3 gold = uGoldCol*(0.22 + 0.40*diff) + uGoldCol*env*0.62 + vec3(1.0, 0.92, 0.75)*pow(nh, 70.0)*1.1;
  gold *= mix(0.75, 1.0, ao);
  vec3 col = mix(wax, gold, smoothstep(0.25, 0.75, s.g));
  o = vec4(finish(col)*m, m);
}`;

// ---------------------------------------------------------------- textures
function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}

function inkBox(g, N) {
  const d = g.getImageData(0, 0, N, N).data;
  let x0 = N, y0 = N, x1 = -1, y1 = -1;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (d[(j * N + i) * 4] > 40) {
    if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Две буквы внахлёст по диагонали, как на сургучных печатях; вписываем в лицо печати.
function renderMonogram(letters, N, font) {
  const c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true });
  const [a, b] = letters;
  const draw = (s, dx, dy) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = `${Math.round(N * 0.40 * s)}px "${font}"`;
    g.fillText(a, N * 0.5 + dx - N * 0.075 * s, N * 0.5 + dy + N * 0.02 * s);
    g.fillText(b, N * 0.5 + dx + N * 0.085 * s, N * 0.5 + dy + N * 0.15 * s);
  };
  draw(1, 0, 0);
  let bb = inkBox(g, N);
  if (!bb) return new Float32Array(N * N);
  const faceD = N * FACE_R;                     // диаметр лица печати в пикселях текстуры
  const s = clamp((faceD * 0.86) / Math.hypot(bb.w, bb.h), 0.4, 2.5);
  draw(s, 0, 0);
  bb = inkBox(g, N);
  draw(s, N / 2 - (bb.x0 + bb.x1) / 2, N / 2 - (bb.y0 + bb.y1) / 2);
  const d = g.getImageData(0, 0, N, N).data, m = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) m[k] = d[k * 4] / 255;
  return m;
}

function buildSeal(gl, tex, letters, font) {
  const N = SEAL_N;
  const mono = renderMonogram(letters, N, font);
  const monoSoft = blurF(mono, N, 1.6);
  const H = new Float32Array(N * N), G = new Float32Array(N * N), M = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = ((i + 0.5) / N) * 2 - 1, y = 1 - ((j + 0.5) / N) * 2;
    const r = Math.hypot(x, y), th = Math.atan2(y, x);
    const ro = 0.955 + 0.024 * Math.sin(9 * th + 0.4) + 0.010 * Math.sin(5 * th + 2.1) + 0.007 * Math.sin(14 * th + 1.3);
    const rho = r / ro, k = j * N + i;
    M[k] = clamp((1 - rho) / (1.3 * (2 / N)) + 0.5, 0, 1);
    if (rho >= 1.02) continue;
    const t = clamp((1 - rho) / 0.22, 0, 1);
    const wob = 1 + 0.06 * Math.sin(3 * th + 0.8) + 0.04 * Math.sin(7 * th + 2.6);
    let h = 0.92 * wob * Math.sqrt(1 - (1 - t) * (1 - t));
    // Волнистый только внешний край (rho), всё внутри — правильные окружности (r).
    h += 0.05 * Math.exp(-Math.pow((r - (FACE_R + ro) / 2) / 0.06, 2));
    const face = smooth(FACE_R + 0.016, FACE_R - 0.012, r);
    h = h * (1 - face) + 0.60 * face;
    h += 0.04 * Math.exp(-Math.pow((r - (FACE_R - 0.034)) / 0.0085, 2));
    h -= 0.025 * face * (1 - r / FACE_R);
    h += 0.075 * monoSoft[k] * face;
    h += 0.010 * noise2(x * 6 + 3.1, y * 6 - 1.7) + 0.005 * noise2(x * 17, y * 17) + 0.0025 * noise2(x * 70, y * 70);
    H[k] = Math.max(h, 0);
    G[k] = mono[k] * face;
  }
  const Hb = blurF(H, N, 10);
  const data = new Uint16Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    const ao = clamp(1 - 2.4 * Math.max(0, Hb[k] - H[k]), 0.45, 1);
    data[k * 4] = toHalf(H[k]); data[k * 4 + 1] = toHalf(G[k]); data[k * 4 + 2] = toHalf(M[k]); data[k * 4 + 3] = toHalf(ao);
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, N, N, 0, gl.RGBA, gl.HALF_FLOAT, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

// Чернила карточки: белое на чёрном, раскладка в мировых координатах сцены.
function buildCard(gl, tex, L, names, date, fonts) {
  const [x0, x1, y0, y1] = L.cardRect;
  const Wc = 1024, Hc = Math.round(Wc * (y1 - y0) / (x1 - x0));
  const c = document.createElement('canvas'); c.width = Wc; c.height = Hc;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, Wc, Hc);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  const ins = Wc * 0.05;
  g.lineWidth = 2; g.strokeRect(ins, ins, Wc - 2 * ins, Hc - 2 * ins);
  const cy = (yw) => ((y1 - yw) / (y1 - y0)) * Hc;
  const yN = L.H - 0.16 * L.H;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  // Имена должны поместиться в вырез кармана (~62% ширины карточки)
  let fsN = Wc * 0.085;
  g.font = `${Math.round(fsN)}px "${fonts.script}"`;
  const wN = g.measureText(names).width;
  if (wN > Wc * 0.62) { fsN *= (Wc * 0.62) / wN; g.font = `${Math.round(fsN)}px "${fonts.script}"`; }
  g.fillText(names, Wc / 2, cy(yN));
  if (date) {
    g.font = `500 ${Math.round(Wc * 0.04)}px "${fonts.serif}"`;
    g.fillText(date, Wc / 2, cy(yN - 0.06 * L.H));
  }
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

function imageTexture(gl, img, wrap) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  const af = gl.getExtension('EXT_texture_filter_anisotropic');
  if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(af.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return t;
}

// ---------------------------------------------------------------- GL plumbing
function compile(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const loc = {};
  p.u = (name) => (name in loc ? loc[name] : (loc[name] = gl.getUniformLocation(p, name)));
  return p;
}
function grid(gl, nx, ny, x0, x1, y0, y1) {
  const v = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) v.push(x0 + ((x1 - x0) * i) / nx, y0 + ((y1 - y0) * j) / ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return { vao, count: idx.length };
}

export const WAXES = {
  beige: { label: 'Бежевый', col: [0.86, 0.78, 0.64], gloss: 1.1, gold: [0.74, 0.57, 0.33] },
  ivory: { label: 'Айвори', col: [0.93, 0.895, 0.83], gloss: 1.0, gold: [0.80, 0.66, 0.43] },
  gold: { label: 'Золото', col: [0.86, 0.73, 0.50], gloss: 1.5, gold: [0.72, 0.54, 0.28] },
  burgundy: { label: 'Бордо', col: [0.47, 0.11, 0.14], gloss: 1.2, gold: [0.84, 0.68, 0.42] },
  sage: { label: 'Шалфей', col: [0.64, 0.69, 0.58], gloss: 1.0, gold: [0.82, 0.67, 0.43] },
  blue: { label: 'Голубой', col: [0.62, 0.72, 0.84], gloss: 1.1, gold: [0.84, 0.70, 0.46] },
};

// Открытие, секунды с касания: медленный подъём клапана, потом карточка
// выезжает из кармана. reveal — пора показывать сайт под конвертом.
export const TIMELINE = { press: [0, 0.45], flap: [0.35, 3.3], card: [2.5, 4.4], cam: [1.8, 4.7], reveal: 4.0, end: 4.8 };

// «Нажмите, чтобы открыть» по дуге под кончиком клапана и рука — вёрсткой (SVG),
// чтобы текст был чётким на любом экране.
export function drawHint(svg, L, opts = {}) {
  const { W, H, tipR } = L;
  const color = opts.color || '#9a8462';
  const cx = W / 2, cy = 0.553 * H, r = tipR + 0.058 * W;
  const a0 = (157 * Math.PI) / 180, a1 = (23 * Math.PI) / 180;
  const p0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
  const fs = Math.max(13, 0.05 * W);
  const hs = 0.075 * W, hy = cy + r + 0.1 * W;
  const id = 'wcEnvArc' + Math.random().toString(36).slice(2, 8);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs><path id="${id}" d="M ${p0[0]} ${p0[1]} A ${r} ${r} 0 0 0 ${p1[0]} ${p1[1]}" /></defs>
    <text font-size="${fs}" fill="${color}" style="font-family:'${opts.font || 'Cormorant Garamond'}',serif;font-weight:500;letter-spacing:.03em">
      <textPath href="#${id}" startOffset="50%" text-anchor="middle">${opts.text || 'Нажмите, чтобы открыть'}</textPath></text>
    <g transform="translate(${cx - hs / 2} ${hy}) scale(${hs / 24})">
      <g class="wc-env3d__hand" fill="none" stroke="${color}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 11V5.6a1.5 1.5 0 0 1 3 0V11" />
        <path d="M12 10.4V9.1a1.5 1.5 0 0 1 3 0v1.6" />
        <path d="M15 10.6a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.1a5 5 0 0 1-3.9-1.9l-2.4-3.5a1.5 1.5 0 0 1 2.4-1.8L9 15.6" />
        <path d="M10.5 1.4v1.5M6.9 2.9l1 1M14.1 2.9l-1 1" />
      </g>
    </g>`;
}

// ---------------------------------------------------------------- public
export async function mountEnvelope(stage, opts = {}) {
  const canvas = stage.querySelector('canvas');
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: true });
  if (!gl) throw new Error('WebGL2 недоступен');
  const base = opts.base || '';
  const fonts = { script: opts.scriptFont || 'Great Vibes', serif: opts.serifFont || 'Cormorant Garamond' };
  await Promise.all([
    document.fonts.load(`80px "${fonts.script}"`, 'АБВабвABC'),
    document.fonts.load(`500 40px "${fonts.serif}"`, 'АБВабвABC'),
  ]).catch(() => {});
  const [paperImg, sprigImg] = await Promise.all([loadImage(base + 'paper.webp'), loadImage(base + 'sprig.webp')]);

  const progBody = compile(gl, BODY_VS, BODY_FS);
  const progFlap = compile(gl, FLAP_VS, FLAP_FS);
  const progSeal = compile(gl, SEAL_VS, SEAL_FS);
  const quad = grid(gl, 1, 1, 0, 1, 0, 1);
  const flapGrid = grid(gl, 72, 110, 0, 1, 0, 1);
  const sealGrid = grid(gl, 170, 170, -1, 1, -1, 1);
  const texPaper = imageTexture(gl, paperImg, gl.MIRRORED_REPEAT);
  const texSprig = imageTexture(gl, sprigImg, gl.CLAMP_TO_EDGE);
  const texSeal = gl.createTexture();
  const texCard = gl.createTexture();

  const TL = TIMELINE;
  const state = {
    letters: opts.letters || ['А', 'Д'],
    names: opts.names || 'Анна & Дмитрий',
    date: opts.date || '12 · 06 · 2027',
    wax: WAXES[opts.wax] ? opts.wax : 'beige',
    openAt: null, pointer: [0, 0], light: [0, 0], revealed: false, ended: false,
  };
  buildSeal(gl, texSeal, state.letters, fonts.script);

  const L = {};
  function layout() {
    const r = stage.getBoundingClientRect();
    const W = Math.max(1, r.width), H = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    Object.assign(L, { W, H, dpr });
    L.hingeY = H * 1.04;
    L.flapZ = 5;
    L.tipR = 0.201 * W;
    const yTipC = H - 0.553 * H;
    L.tipCv = L.hingeY - yTipC;
    const Ex = W / 2, Ey = (H - 0.272 * H) - yTipC, d = Math.hypot(Ex, Ey);
    L.alpha = Math.atan2(Ex, Ey) - Math.asin(Math.min(0.99, L.tipR / d));
    L.sealR = 0.135 * W;
    L.sealV = L.hingeY - (H - 0.556 * H);
    L.sealT = 0.11 * L.sealR;
    L.flapLen = L.tipCv + L.tipR;
    L.pocketY = H - 0.445 * H;
    L.seamY = H - 0.715 * H;
    L.seamApexY = H - 0.515 * H;
    L.cardRect = [0.075 * W, 0.925 * W, L.pocketY - 0.03 * H, H * 1.25];
    L.sprig = [-0.07 * W, -0.06 * W, 0.46 * W];
    const ta = paperImg.width / paperImg.height;
    const [sx, sy] = W / H < ta ? [H * ta, H] : [W, W / ta];
    L.paperK = [1 / sx, 1 / sy];
    L.fov = (30 * Math.PI) / 180;
    L.D = H / 2 / Math.tan(L.fov / 2);
    buildCard(gl, texCard, L, state.names, state.date, fonts);
    if (opts.onLayout) opts.onLayout(L);
  }

  function uniformsCommon(p, s) {
    gl.uniformMatrix4fv(p.u('uVP'), false, s.vp);
    gl.uniform2f(p.u('uStage'), L.W, L.H);
    gl.uniform2f(p.u('uRes'), canvas.width, canvas.height);
    gl.uniform1f(p.u('uHingeY'), L.hingeY);
    gl.uniform1f(p.u('uFlapZ'), L.flapZ);
    gl.uniform1f(p.u('uTheta'), s.theta);
    gl.uniform1f(p.u('uKappa'), s.kappa);
    gl.uniform1f(p.u('uTipCv'), L.tipCv);
    gl.uniform1f(p.u('uTipR'), L.tipR);
    gl.uniform1f(p.u('uAlpha'), L.alpha);
    gl.uniform1f(p.u('uSealV'), L.sealV);
    gl.uniform1f(p.u('uSealR'), L.sealR);
    gl.uniform1f(p.u('uSealT'), L.sealT);
    gl.uniform1f(p.u('uFlapLen'), L.flapLen);
    gl.uniform1f(p.u('uTime'), s.time);
    gl.uniform3fv(p.u('uL'), s.L);
    gl.uniform3fv(p.u('uL0'), s.L0);
    gl.uniform3fv(p.u('uEye'), s.eye);
  }
  function uniformsPaper(p) {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texPaper);
    gl.uniform1i(p.u('uPaper'), 0);
    gl.uniform2f(p.u('uPaperK'), L.paperK[0], L.paperK[1]);
    gl.uniform2f(p.u('uPaperTexel'), 1 / paperImg.width, 1 / paperImg.height);
    gl.uniform1f(p.u('uRelief'), 6.0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texSprig);
    gl.uniform1i(p.u('uSprig'), 1);
    gl.uniform3f(p.u('uSprig0'), L.sprig[0], L.sprig[1], L.sprig[2]);
  }

  // Время сцены: t < 0 — конверт закрыт, t ≥ 0 — секунды с момента касания.
  const easeSine = (x) => (1 - Math.cos(Math.PI * x)) / 2;
  function sceneAt(t, time) {
    const s = { time };
    const o = t >= 0;
    const th = o ? Math.PI * easeSine(prog(t, TL.flap)) : 0;
    s.theta = th;
    s.kappa = (0.42 / L.flapLen) * Math.sin(th) * Math.sqrt(Math.max(0, 1 - th / Math.PI));
    s.sealScale = o ? 1 - 0.035 * Math.sin(Math.PI * prog(t, TL.press)) : 1;
    s.cardShift = o ? 0.08 * L.H * easeOut(prog(t, TL.card)) : 0;
    const L0 = [0.30, 0.42, 0.86], n0 = Math.hypot(...L0);
    s.L0 = L0.map((v) => v / n0);
    const lx = L0[0] + state.light[0] + 0.05 * Math.sin(time * 0.7);
    const ly = L0[1] + state.light[1] + 0.04 * Math.cos(time * 0.53);
    const n1 = Math.hypot(lx, ly, L0[2]);
    s.L = [lx / n1, ly / n1, L0[2] / n1];
    const D = L.D * (1 - 0.05 * (o ? easeInOut(prog(t, TL.cam)) : 0));
    s.eye = [L.W / 2 + state.light[0] * 14, L.H / 2 + state.light[1] * 14, D];
    const view = lookAt(s.eye, [L.W / 2, L.H / 2, 0], [0, 1, 0]);
    const proj = perspective(L.fov, L.W / L.H, D * 0.2, D * 3);
    s.vp = mul(proj, view);
    return s;
  }

  function draw(t, time) {
    const s = sceneAt(t, time);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.09, 0.08, 0.07, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);

    gl.disable(gl.BLEND);
    gl.useProgram(progBody);
    uniformsCommon(progBody, s); uniformsPaper(progBody);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texCard);
    gl.uniform1i(progBody.u('uCard'), 2);
    gl.uniform4f(progBody.u('uCardRect'), ...L.cardRect);
    gl.uniform1f(progBody.u('uCardShift'), s.cardShift);
    gl.uniform1f(progBody.u('uPocketY'), L.pocketY);
    gl.uniform1f(progBody.u('uSeamY'), L.seamY);
    gl.uniform1f(progBody.u('uSeamApexY'), L.seamApexY);
    gl.bindVertexArray(quad.vao); gl.drawElements(gl.TRIANGLES, quad.count, gl.UNSIGNED_INT, 0);

    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(progFlap);
    uniformsCommon(progFlap, s); uniformsPaper(progFlap);
    gl.uniform4f(progFlap.u('uFlapBox'), -0.62 * L.W, 0.62 * L.W, 0, L.tipCv + L.tipR + 6);
    gl.bindVertexArray(flapGrid.vao); gl.drawElements(gl.TRIANGLES, flapGrid.count, gl.UNSIGNED_INT, 0);

    gl.useProgram(progSeal);
    uniformsCommon(progSeal, s);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, texSeal);
    gl.uniform1i(progSeal.u('uSealTex'), 3);
    gl.uniform1f(progSeal.u('uSealScale'), s.sealScale);
    const w = WAXES[state.wax];
    gl.uniform3fv(progSeal.u('uWaxCol'), srgbToLin(w.col));
    gl.uniform3fv(progSeal.u('uGoldCol'), srgbToLin(w.gold));
    gl.uniform1f(progSeal.u('uWaxGloss'), w.gloss);
    gl.bindVertexArray(sealGrid.vao); gl.drawElements(gl.TRIANGLES, sealGrid.count, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    return s;
  }

  // Кадры идут, только пока конверт на экране и вкладка видна: в редакторе
  // он стоит первым экраном и не должен греть телефон, когда его пролистали.
  const t0 = performance.now();
  let raf = 0, running = false, visible = true, destroyed = false;
  const sceneT = (now) => (state.openAt == null ? -1 : (now - state.openAt) / 1000);
  function frame(now) {
    const time = (now - t0) / 1000;
    state.light[0] += (state.pointer[0] - state.light[0]) * 0.06;
    state.light[1] += (state.pointer[1] - state.light[1]) * 0.06;
    const t = sceneT(now);
    draw(t, time);
    if (t >= TL.reveal && !state.revealed) { state.revealed = true; if (opts.onReveal) opts.onReveal(); }
    if (t >= TL.end && !state.ended) { state.ended = true; if (opts.onEnd) opts.onEnd(); }
  }
  function loop(now) {
    if (!running) return;
    frame(now);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || destroyed || !visible || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }
  // Изменение без живого цикла (например, конверт пролистан в превью) — один кадр.
  function redraw() { if (!running && !destroyed) frame(performance.now()); }

  const onPointer = (e) => {
    const r = stage.getBoundingClientRect();
    state.pointer = [clamp(((e.clientX - r.left) / r.width - 0.5) * 0.5, -0.3, 0.3), clamp((0.5 - (e.clientY - r.top) / r.height) * 0.5, -0.3, 0.3)];
  };
  const onTilt = (e) => {
    if (e.gamma == null) return;
    state.pointer = [clamp(e.gamma / 90, -0.3, 0.3), clamp((45 - (e.beta || 45)) / 90, -0.3, 0.3)];
  };
  const onVis = () => (document.hidden ? stop() : start());

  layout();
  const ro = new ResizeObserver(() => { layout(); redraw(); });
  ro.observe(stage);
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; if (visible) start(); else stop(); })
    : null;
  if (io) io.observe(stage);
  window.addEventListener('pointermove', onPointer);
  window.addEventListener('deviceorientation', onTilt);
  document.addEventListener('visibilitychange', onVis);
  redraw();
  start();

  return {
    layout: L,
    open() {
      if (state.openAt != null) return;
      state.openAt = performance.now(); state.revealed = false; state.ended = false;
      start();
    },
    reset() { state.openAt = null; state.revealed = false; state.ended = false; redraw(); },
    isOpen: () => state.openAt != null,
    setInitials(a, b) { state.letters = [a || ' ', b || ' ']; buildSeal(gl, texSeal, state.letters, fonts.script); redraw(); },
    setWax(name) { if (WAXES[name]) { state.wax = name; redraw(); } },
    setNames(names, date) {
      state.names = names || state.names; if (date) state.date = date;
      buildCard(gl, texCard, L, state.names, state.date, fonts); redraw();
    },
    // Для проверок без живого rAF: нарисовать кадр сцены в момент t.
    renderAt(t, time = 0) { draw(t, time); },
    destroy() {
      destroyed = true; stop(); ro.disconnect(); if (io) io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('deviceorientation', onTilt);
      document.removeEventListener('visibilitychange', onVis);
      // Освобождаем видеопамять телефона сразу, не дожидаясь сборщика мусора
      const lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    },
  };
}
