"""Плитка водяного знака WeddingCraft для страниц приглашений.

    python scripts/generate-brand-watermark.py [файл.svg]

По умолчанию пишет frontend/public/invite/assets/brand-wm.svg — её подкладывает общий
модуль assets/brand.js фоном неподвижного слоя поверх страницы. Надпись «WeddingCraft»
курсивом Playfair Display (SIL OFL), переведённая в контуры, — чтобы знак выглядел
одинаково на любом устройстве и не зависел от шрифтов страницы. Слова чуть повёрнуты
(−22°, как у водяных знаков в демо Digital Yes) и стоят шахматкой; цвет — тёплый
графит с малой непрозрачностью: на светлой странице знак «еле заметен».

Нужны: fontTools, brotli и @fontsource-variable/playfair-display в frontend/node_modules.
"""
import math
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FONT = os.path.join(ROOT, 'frontend', 'node_modules', '@fontsource-variable', 'playfair-display',
                    'files', 'playfair-display-latin-wght-italic.woff2')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    ROOT, 'frontend', 'public', 'invite', 'assets', 'brand-wm.svg')

TEXT = 'WeddingCraft'
WEIGHT = 400
TRACKING = 0.035              # межбуквенный интервал, в em
WORD_W = 124                  # ширина слова в плитке, px
TILE_W, TILE_H = 330, 214     # плитка: два слова шахматкой — шаг сетки ~165 × 107 по осям
ANGLE = -22                   # градусов
FILL = '#4a4238'
OPACITY = 0.17
# Светлый ореол вокруг букв: на тёмных участках страницы (фото, тёмные шаблоны) тёмная
# надпись пропадает, а тонкий светлый контур остаётся едва заметным; на светлой странице
# он белый по белому и не виден.
HALO = '#ffffff'
HALO_OPACITY = 0.085
HALO_PX = 1.3


def word_path():
    """Контуры слова: (путь SVG в единицах шрифта с перевёрнутой осью y, ширина в em)."""
    font = instancer.instantiateVariableFont(TTFont(FONT), {'wght': WEIGHT})
    glyphs, cmap, upm = font.getGlyphSet(), font.getBestCmap(), font['head'].unitsPerEm
    d, x = '', 0.0
    for ch in TEXT:
        name = cmap[ord(ch)]
        pen = SVGPathPen(glyphs, ntos=lambda v: str(round(v)))      # целые единицы шрифта: ошибка < 0,02 px
        glyphs[name].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        d += pen.getCommands()
        x += glyphs[name].width + TRACKING * upm
    return d, (x - TRACKING * upm) / upm, upm


def main():
    d, width_em, upm = word_path()
    k = WORD_W / (width_em * upm)                 # единицы шрифта → px
    a = math.radians(ANGLE)
    # центр слова — в точке (cx, cy) плитки; ось x слова повёрнута на ANGLE
    def place(cx, cy):
        hw = WORD_W / 2
        ox, oy = cx - hw * math.cos(a), cy - hw * math.sin(a) + 0.28 * k * upm / 2
        return 'translate(%.1f %.1f) rotate(%d) scale(%.5f)' % (ox, oy, ANGLE, k)
    # второе слово — со сдвигом на полплитки: получается шахматка
    words = [place(TILE_W * 0.27, TILE_H * 0.74), place(TILE_W * 0.77, TILE_H * 0.24)]
    # слово один раз в <defs>, на плитке — две ссылки; обводка (светлый ореол) задана в единицах
    # шрифта, потому что слово уменьшено в k раз; paint-order — обводка под заливкой
    body = ''.join('<use href="#w" transform="%s"/>' % t for t in words)
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">'
           '<defs><path id="w" d="%s"/></defs>'
           '<g fill="%s" fill-opacity="%s" stroke="%s" stroke-opacity="%s" stroke-width="%d" '
           'stroke-linejoin="round" paint-order="stroke">%s</g></svg>\n') % (
               TILE_W, TILE_H, TILE_W, TILE_H, d, FILL, OPACITY, HALO, HALO_OPACITY, round(HALO_PX / k), body)
    os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(svg)
    print(os.path.basename(OUT), os.path.getsize(OUT), 'B; слово %.2f em, %d px' % (width_em, WORD_W))


if __name__ == '__main__':
    main()
