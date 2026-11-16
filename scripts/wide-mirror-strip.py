"""[зеркало | оригинал] — плитка, которая повторяется по горизонтали без шва.
Использование: wide-mirror-strip.py вход выход [качество]"""
import os, sys
sys.path.append(os.environ.get('PIL_PATH', ''))  # Pillow может стоять в пользовательском site-packages
from PIL import Image, ImageOps
src, dst = sys.argv[1], sys.argv[2]
q = int(sys.argv[3]) if len(sys.argv) > 3 else 82
im = Image.open(src)
mode = 'RGBA' if im.mode in ('RGBA', 'LA', 'P') and dst.endswith('.webp') else 'RGB'
im = im.convert(mode)
w, h = im.size
out = Image.new(mode, (w * 2, h))
out.paste(ImageOps.mirror(im), (0, 0))
out.paste(im, (w, 0))
if dst.endswith('.webp'):
    out.save(dst, 'WEBP', quality=q, method=6)
else:
    out.save(dst, 'JPEG', quality=q, optimize=True, progressive=True)
import os
print(dst, out.size, os.path.getsize(dst) // 1024, 'KB (source', os.path.getsize(src) // 1024, 'KB)')
