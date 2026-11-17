"""Боковая лента для картинки во всю ширину колонки (рваный край, гирлянда):
середина картинки [from..to] без украшений по краям, повторённая зеркально
(оригинал | зеркало | ...), — продолжает картинку к краям широкого экрана.
Ставится фоном слева и справа от исходной картинки; стык с ней прячется под
украшениями её концов (цветы, листья).
wide-side-strip.py вход выход [from=0.35] [to=0.65] [повторов=6] [качество=82]"""
import os, sys
sys.path.append(os.environ.get('PIL_PATH', ''))  # Pillow может стоять в пользовательском site-packages
from PIL import Image, ImageOps
src, dst = sys.argv[1], sys.argv[2]
a = float(sys.argv[3]) if len(sys.argv) > 3 else 0.35
b = float(sys.argv[4]) if len(sys.argv) > 4 else 0.65
n = int(sys.argv[5]) if len(sys.argv) > 5 else 6
q = int(sys.argv[6]) if len(sys.argv) > 6 else 82
im = Image.open(src).convert('RGBA')
W, H = im.size
mid = im.crop((int(W * a), 0, int(W * b), H))
w = mid.width
out = Image.new('RGBA', (w * n, H), (0, 0, 0, 0))
for i in range(n):
    out.paste(mid if i % 2 == 0 else ImageOps.mirror(mid), (i * w, 0))
out.save(dst, 'WEBP', quality=q, method=6)
print(dst, out.size, os.path.getsize(dst) // 1024, 'KB; плитка', w, 'из', W)
