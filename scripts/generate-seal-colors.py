"""Печати универсальных конвертов в цветах палитры SEAL_COLORS (constants.ts).

Запуск из корня репозитория:  python scripts/generate-seal-colors.py

Цвет меняется картой градиента по яркости: тени, свет и блики исходной печати
остаются, меняется только тон воска. Прозрачность — как у исходника.

  · envelope-slide («Нежность»): исходник seal-gold.webp (336×339) — золото
    остаётся как есть, остальные цвета → seal-<цвет>.webp рядом;
  · envelope-flap («Цветущий»): исходник public/envelope/wax-seal.png (красный
    сургуч 1024²). У шаблона он был тонирован CSS-фильтром
    sepia(1) hue-rotate(-20deg) saturate(1.2) brightness(.9) — это цвет brown;
    остальные — картой градиента. Кадр тот же (печать занимает ту же долю
    картинки: монограмма считается от неё), размер — 640².

Цвета (тень → основа → свет → блик) держать в согласии с SEAL_COLORS и с
WAXES 3D-конверта (public/invite/assets/envelope3d/engine.js).
"""
import math
import os
import shutil

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'frontend', 'public')
SLIDE = os.path.join(PUB, 'invite', 'assets', 'envelope-slide')
FLAP = os.path.join(PUB, 'invite', 'assets', 'envelope-flap')

RAMPS = {
    'beige':    ['#7c6545', '#c9b08a', '#e6d6b9', '#fbf3e4'],
    'ivory':    ['#8f8673', '#ddd3c0', '#f1eadc', '#fffdf7'],
    'gold':     ['#6f4d1c', '#c99a4e', '#e8c98d', '#fff0c9'],
    'pink':     ['#8c4f52', '#d59c9d', '#ecc4c3', '#fdeceb'],
    'burgundy': ['#2e070c', '#741a25', '#a43a47', '#d77a84'],
    'brown':    ['#2a170e', '#6b4330', '#9a6a4f', '#cfa286'],
    'sage':     ['#4d5643', '#96a284', '#bcc5ac', '#e7ecdc'],
    'blue':     ['#45597a', '#8faccd', '#bccfe5', '#eef4fb'],
}
STOPS = [0.0, 0.42, 0.78, 1.0]


def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float64)


def gradient_map(img, ramp):
    """Яркость → цвет по ramp; растяжка по перцентилям непрозрачной части.
    Гамма ставит медиану (гладкое лицо печати) на основной цвет: у красного
    сургуча лицо тёмное (медиана 0,11), у золотой печати — уже на месте (0,45)."""
    a = np.asarray(img.convert('RGBA'), dtype=np.float64)
    rgb, alpha = a[..., :3], a[..., 3]
    y = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    solid = alpha > 200
    lo, hi = np.percentile(y[solid], 1.5), np.percentile(y[solid], 99.2)
    t = np.clip((y - lo) / max(hi - lo, 1e-6), 0, 1)
    med = float(np.median(t[solid]))
    if 0.02 < med < 0.98:
        t = t ** (math.log(0.45) / math.log(med))
    cols = [hex_rgb(c) for c in ramp]
    out = np.zeros_like(rgb)
    for i in range(len(STOPS) - 1):
        t0, t1 = STOPS[i], STOPS[i + 1]
        m = (t >= t0) & (t <= t1) if i == len(STOPS) - 2 else (t >= t0) & (t < t1)
        k = ((t - t0) / (t1 - t0))[m][:, None]
        out[m] = cols[i] * (1 - k) + cols[i + 1] * k
    res = np.dstack([np.clip(out, 0, 255), alpha]).astype(np.uint8)
    return Image.fromarray(res, 'RGBA')


def css_native_brown(img):
    """CSS sepia(1) hue-rotate(-20deg) saturate(1.2) brightness(.9) — в sRGB, как у Chrome."""
    a = np.asarray(img.convert('RGBA'), dtype=np.float64) / 255.0
    rgb, alpha = a[..., :3], a[..., 3:]
    sepia = np.array([[.393, .769, .189], [.349, .686, .168], [.272, .534, .131]])
    th = math.radians(-20)
    c, s = math.cos(th), math.sin(th)
    hue = np.array([
        [.213 + c * .787 - s * .213, .715 - c * .715 - s * .715, .072 - c * .072 + s * .928],
        [.213 - c * .213 + s * .143, .715 + c * .285 + s * .140, .072 - c * .072 - s * .283],
        [.213 - c * .213 - s * .787, .715 - c * .715 + s * .715, .072 + c * .928 + s * .072],
    ])
    sat = 1.2
    satm = np.array([
        [.213 + .787 * sat, .715 - .715 * sat, .072 - .072 * sat],
        [.213 - .213 * sat, .715 + .285 * sat, .072 - .072 * sat],
        [.213 - .213 * sat, .715 - .715 * sat, .072 + .928 * sat],
    ])
    x = np.clip(rgb @ sepia.T, 0, 1)
    x = np.clip(x @ hue.T, 0, 1)
    x = np.clip(x @ satm.T, 0, 1)
    x = np.clip(x * 0.9, 0, 1)
    return Image.fromarray((np.dstack([x, alpha]) * 255).round().astype(np.uint8), 'RGBA')


def save_webp(img, path):
    img.save(path, 'WEBP', quality=86, method=6)
    print(os.path.relpath(path, ROOT), os.path.getsize(path) // 1024, 'КБ')


def main():
    # «Нежность»: золото — исходник, остальные — карта градиента
    gold = Image.open(os.path.join(SLIDE, 'seal-gold.webp')).convert('RGBA')
    for name, ramp in RAMPS.items():
        if name == 'gold':
            continue
        save_webp(gradient_map(gold, ramp), os.path.join(SLIDE, 'seal-%s.webp' % name))

    # «Цветущий»: brown — как было у шаблона (CSS-фильтр), остальные — карта градиента
    os.makedirs(FLAP, exist_ok=True)
    src = Image.open(os.path.join(PUB, 'envelope', 'wax-seal.png')).convert('RGBA').resize((640, 640), Image.LANCZOS)
    for name, ramp in RAMPS.items():
        img = css_native_brown(src) if name == 'brown' else gradient_map(src, ramp)
        save_webp(img, os.path.join(FLAP, 'seal-%s.webp' % name))
    paper = os.path.join(FLAP, 'paper.jpg')
    shutil.copyfile(os.path.join(PUB, 'envelope', 'paper-texture.jpg'), paper)
    print(os.path.relpath(paper, ROOT), os.path.getsize(paper) // 1024, 'КБ')


if __name__ == '__main__':
    main()
