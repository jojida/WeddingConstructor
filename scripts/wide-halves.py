"""Края бумаги для широкого экрана: левая и правая половины плитки, внутренний
край которых плавно переходит в цвет страницы. Плитка с пятнами по краям
колонки → на компьютере пятна у краёв окна, середина — ровный цвет страницы.
wide-halves.py плитка выход_лево выход_право #цвет_страницы [доля_перехода=0.45]"""
import os, sys
sys.path.append(os.environ.get('PIL_PATH', ''))  # fontTools/Pillow могут стоять в пользовательском site-packages
from PIL import Image
src, out_l, out_r, color = sys.argv[1:5]
frac = float(sys.argv[5]) if len(sys.argv) > 5 else 0.45
T = Image.open(src).convert('RGB')
W, H = T.size
half = W // 2
page = Image.new('RGB', (half, H), color)
def fade(img, inner_on_right):
    m = Image.new('L', (half, 1))
    z = int(half * frac)                   # ширина перехода у внутреннего края
    for x in range(half):
        d = (half - 1 - x) if inner_on_right else x   # расстояние до внутреннего края
        a = 255 if d >= z else int(255 * (d / z) ** 1.5)
        m.putpixel((x, 0), a)
    m = m.resize((half, H))
    return Image.composite(img, page, m)
L = fade(T.crop((0, 0, half, H)), True)
R = fade(T.crop((W - half, 0, W, H)), False)
L.save(out_l, 'JPEG', quality=80, optimize=True, progressive=True)
R.save(out_r, 'JPEG', quality=80, optimize=True, progressive=True)
import os
print(out_l, L.size, os.path.getsize(out_l) // 1024, 'KB;', out_r, os.path.getsize(out_r) // 1024, 'KB')
