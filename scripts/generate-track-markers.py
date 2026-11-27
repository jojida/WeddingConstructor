"""Общий набор «ползунков» — значков, которые едут по линии программы дня
(public/invite/assets/track-marker.js, поле «Ползунок» в редакторе).

Запуск из корня репозитория:  python scripts/generate-track-markers.py

Картинки взяты из шаблонов и собраны в public/invite/assets/markers/, чтобы
любой шаблон брал их из одного места:
  pearl  — жемчужина «Калл»,  acorn — жёлудь «Туманного леса»,
  berry  — клубника «Клубники», gem — самоцвет «Бирюзы»,
  rings  — золотые кольца «Бирюзы», dove — голубь «Ангелов»,
  glitter — сердце с блёстками «Клубники»,
  cupid  — купидон «Ангелов», в золоте: свой кремовый не виден на светлом фоне,
  car    — машинка «Скетча» носом ВНИЗ — по ходу прокрутки (у «Скетча» своя,
           она поворачивается по линии).
Сердце (heart.svg) нарисовано здесь же, вектором.
"""
import math
import os

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INV = os.path.join(ROOT, 'frontend', 'public', 'invite')
OUT = os.path.join(INV, 'assets', 'markers')
MAX = 256

HEART = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 58">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efb3b5"/><stop offset="1" stop-color="#c26a74"/></linearGradient>
<radialGradient id="h" cx="30%" cy="24%" r="42%"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<path d="M32 56C14 43.2 2 32.4 2 18.2 2 8.8 9.4 2 18.2 2c6 0 11.3 3.3 13.8 8.5C34.5 5.3 39.8 2 45.8 2 54.6 2 62 8.8 62 18.2 62 32.4 50 43.2 32 56z" fill="url(#g)" stroke="#a3525d" stroke-opacity=".35" stroke-width="1.2"/>
<path d="M32 56C14 43.2 2 32.4 2 18.2 2 8.8 9.4 2 18.2 2c6 0 11.3 3.3 13.8 8.5C34.5 5.3 39.8 2 45.8 2 54.6 2 62 8.8 62 18.2 62 32.4 50 43.2 32 56z" fill="url(#h)"/>
</svg>
'''


def fit(img):
    img = img.convert('RGBA')
    if max(img.size) > MAX:
        k = MAX / max(img.size)
        img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    return img


def gold(img):
    """Кремовый купидон → золото: карта градиента по яркости, прозрачность как была."""
    a = np.asarray(img.convert('RGBA'), dtype=np.float64)
    y = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    solid = a[..., 3] > 120
    lo, hi = np.percentile(y[solid], 2), np.percentile(y[solid], 99.5)
    t = np.clip((y - lo) / max(hi - lo, 1e-6), 0, 1)[..., None]
    dark, mid, light = np.array([122, 86, 38.]), np.array([196, 152, 84.]), np.array([246, 224, 170.])
    col = np.where(t < 0.5, dark + (mid - dark) * (t / 0.5), mid + (light - mid) * ((t - 0.5) / 0.5))
    return Image.fromarray(np.dstack([col, a[..., 3]]).astype(np.uint8), 'RGBA')


def save(img, name):
    path = os.path.join(OUT, name + '.webp')
    img.save(path, 'WEBP', quality=88, method=6)
    print(os.path.relpath(path, ROOT), img.size, os.path.getsize(path) // 1024, 'КБ')


def main():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'heart.svg'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(HEART)
    src = lambda p: Image.open(os.path.join(INV, *p.split('/')))
    save(fit(src('calla/assets/pearl-bead.png')), 'pearl')
    save(fit(src('forest/assets/acorn.webp')), 'acorn')
    save(fit(src('strawberry/assets/berry.webp')), 'berry')
    save(fit(src('turquoise/assets/gem.webp')), 'gem')
    save(fit(src('turquoise/assets/rings-gold.webp')), 'rings')
    save(fit(src('angels/assets/dove.webp')), 'dove')
    save(fit(src('strawberry/assets/glitter-heart.webp')), 'glitter')
    save(fit(gold(src('angels/assets/cupid-cream.webp'))), 'cupid')
    save(fit(src('sketch/assets/car.lossless.webp')).rotate(180), 'car')


if __name__ == '__main__':
    main()
