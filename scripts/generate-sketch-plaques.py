"""Формы плашек обложки «Скетча»: цветные пятна под вырезанными фото и мазки кисти
для подписей. Рисуются векторно (только <path>, без <mask>/<image> — Safari на iOS
такие файлы показывает как есть); цвет в приглашении задаёт CSS (mask-image + фон),
поэтому здесь все формы чёрные.

    python scripts/generate-sketch-plaques.py [папка]

По умолчанию пишет в frontend/public/invite/sketch/assets:
  plaque-blob-l.svg, plaque-blob-r.svg            пятна, viewBox 240×273
  plaque-blob-l-line.svg, plaque-blob-r-line.svg  тот же контур, сдвинутый (чернила)
  plaque-brush-l.svg, plaque-brush-r.svg          мазки кисти, viewBox 240×64
Какие seed взяты и почему — в BLOBS и BRUSHES; чтобы подобрать другие формы,
меняйте seed и смотрите результат на обложке (localhost:3000/invite/sketch/).
"""
import math
import os
import random
import sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', 'frontend', 'public', 'invite', 'sketch', 'assets')


def svg(w, h, body):
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">%s</svg>\n' % (w, h, w, h, body)


def catmull(pts):
    """Замкнутая гладкая кривая через точки — путь из кубических Безье."""
    n = len(pts)
    d = 'M%.1f %.1f' % pts[0]
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += ' C%.1f %.1f %.1f %.1f %.1f %.1f' % (c1[0], c1[1], c2[0], c2[1], p2[0], p2[1])
    return d + ' Z'


# ───────────── пятна ─────────────
# Размер подложки в CSS (.pol-bg): рамка полароида 148:201,5, пятно шире неё на 4% с
# каждого бока, от 6% сверху до 2% снизу — отсюда пропорции viewBox.
VBW, VBH = 240, 273
MARGIN = 10                     # запас до края: контур сдвинут влево-вверх
LINE_OFFSET = (-7, -6)          # «плохо совмещённая печать»
HARMONICS = {2: .05, 3: .075, 4: .05, 5: .03}
BLOBS = {'l': 6, 'r': 12}       # seed: слева (жених) — ровное высокое, справа (невеста) — с наклоном и вмятиной


def blob_points(seed, n=26):
    """Эллипс, радиус которого «дышит» несколькими гармониками; растянут по viewBox."""
    rnd = random.Random(seed)
    phase = {k: rnd.uniform(0, 2 * math.pi) for k in HARMONICS}
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        f = 1 + sum(amp * math.cos(k * a + phase[k]) for k, amp in HARMONICS.items())
        pts.append((120 + 108 * f * math.cos(a), 136 + 126 * f * math.sin(a)))
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    kx = (VBW - 2 * MARGIN) / (max(xs) - min(xs))
    ky = (VBH - 2 * MARGIN) / (max(ys) - min(ys))
    return [(MARGIN + (x - min(xs)) * kx, MARGIN + (y - min(ys)) * ky) for x, y in pts]


def write_blobs():
    for side, seed in BLOBS.items():
        pts = blob_points(seed)
        write('plaque-blob-%s.svg' % side, svg(VBW, VBH, '<path d="%s"/>' % catmull(pts)))
        shifted = [(x + LINE_OFFSET[0], y + LINE_OFFSET[1]) for x, y in pts]
        write('plaque-blob-%s-line.svg' % side, svg(
            VBW, VBH, '<path d="%s" fill="none" stroke="#1c1c1c" stroke-width="2.4" stroke-linejoin="round"/>' % catmull(shifted)))


# ───────────── кисточные мазки ─────────────
BW, BH = 240, 64
BRUSHES = {'l': (4, False), 'r': (11, True)}    # seed, зеркально (у правого хвосты щетины слева)


def smooth_noise(rnd, n, corr):
    """Гладкий шум в [-1, 1]: n значений, соседние связаны на ~corr точек."""
    vals = [rnd.uniform(-1, 1) for _ in range(n // corr + 3)]
    out = []
    for i in range(n):
        x = i / corr
        k = int(x)
        f = x - k
        f = f * f * (3 - 2 * f)
        out.append(vals[k] * (1 - f) + vals[k + 1] * f)
    return out


def brush_path(seed, rows=34):
    """Мазок по горизонтали: строка за строкой — щетинки с разной длиной; на конце, где
    кисть отрывается, часть строк короче; волна по краям; сухие полосы у конца."""
    rnd = random.Random(seed)
    y0, y1 = 6.0, BH - 6.0
    ys = [y0 + (y1 - y0) * i / (rows - 1) for i in range(rows)]
    mid = (rows - 1) / 2
    # крайние строки короче — это скругляет углы мазка
    edge = [max(0.0, 1 - (abs(i - mid) / mid) ** 3) for i in range(rows)]
    nl, nr = smooth_noise(rnd, rows, 3), smooth_noise(rnd, rows, 3)
    xl, xr = [], []
    for i in range(rows):
        e = edge[i] ** .5
        left = 9 + (1 - e) * 20 + (nl[i] + 1) * 8
        if rnd.random() < .24:
            left -= rnd.uniform(6, 17)             # выбившаяся щетинка
        elif rnd.random() < .12:
            left += rnd.uniform(5, 11)             # «прикушенная» строка
        right = 8 + (1 - e) * 18 + (nr[i] + 1) * 9
        if rnd.random() < .34:
            right += rnd.uniform(10, 34)           # кисть оторвалась раньше
        xl.append(left)
        xr.append(BW - right)
    wave = smooth_noise(rnd, 40, 6)

    def top(x):
        return y0 - 2.4 + 2.8 * wave[min(39, max(0, int(x / BW * 39)))]

    def bottom(x):
        return y1 + 2.4 + 2.8 * wave[min(39, max(0, int((BW - x) / BW * 39)))]

    pts = [(xr[i], ys[i]) for i in range(rows)]                                     # правый край сверху вниз
    pts += [(xl[-1] + (xr[-1] - xl[-1]) * k / 10, bottom(xl[-1] + (xr[-1] - xl[-1]) * k / 10)) for k in range(10, -1, -1)]
    pts += [(xl[i], ys[i]) for i in range(rows - 1, -1, -1)]                        # левый край снизу вверх
    pts += [(xl[0] + (xr[0] - xl[0]) * k / 10, top(xl[0] + (xr[0] - xl[0]) * k / 10)) for k in range(11)]
    d = 'M' + ' L'.join('%.1f %.1f' % p for p in pts) + ' Z'
    for _ in range(4):                             # сухие полосы — тонкие прорези ближе к правому концу
        sy = rnd.uniform(y0 + 8, y1 - 8)
        sx0 = rnd.uniform(BW * .50, BW * .72)
        sx1 = min(BW - 10, sx0 + rnd.uniform(40, 90))
        th = rnd.uniform(.9, 1.7)
        d += ' M%.1f %.1f L%.1f %.1f L%.1f %.1f L%.1f %.1f Z' % (
            sx0, sy - th / 2, (sx0 + sx1) / 2, sy - th, sx1, sy - th / 3, (sx0 + sx1) / 2, sy + th)
    return d


def write_brushes():
    for side, (seed, mirror) in BRUSHES.items():
        flip = ' transform="translate(%d 0) scale(-1 1)"' % BW if mirror else ''
        write('plaque-brush-%s.svg' % side, svg(BW, BH, (
            '<path d="%s" fill-rule="evenodd" stroke="#000" stroke-width="1.6" stroke-linejoin="round"%s/>' % (brush_path(seed), flip))))


def write(name, text):
    path = os.path.join(OUT, name)
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    print(name, os.path.getsize(path), 'B')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    write_blobs()
    write_brushes()
