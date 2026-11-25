# Contact sheet of a filmstrip: python util/lanternwind/sheet.py out/prefix out/prefix_sheet.jpg [cols=4] [scale=0.5]
import sys, glob
from PIL import Image
pre, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
sc = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
fs = sorted(glob.glob(pre + '_[0-9]*.png'))
ims = [Image.open(f).convert('RGB') for f in fs]
w, h = ims[0].size; w2, h2 = int(w * sc), int(h * sc)
rows = (len(ims) + cols - 1) // cols
S = Image.new('RGB', (cols * w2 + (cols - 1) * 6, rows * h2 + (rows - 1) * 6), (20, 20, 20))
for i, im in enumerate(ims):
    S.paste(im.resize((w2, h2), Image.LANCZOS), ((i % cols) * (w2 + 6), (i // cols) * (h2 + 6)))
S.save(out, quality=88)
print(out, S.size)
