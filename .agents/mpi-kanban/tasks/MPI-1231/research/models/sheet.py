# Contact sheet: the three pictures, then FLUX.3 Klein and Qwen-Image 2.1 rows, panels 1-6.
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TIKORI = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Tikori Characters/Media/'
REFS = ['t2i_d919b5be.png', 't2i_8ef43aa4.png', 't2i_566d9ebe.jpg']
W, H, LBL = 448, 256, 150
font = ImageFont.truetype('arial.ttf', 22)
rows = [('pictures', [TIKORI + r for r in REFS]),
        ('FLUX.3 Klein', [f'{HERE}/out/flux3/panel_{i}.png' for i in range(1, 7)]),
        ('Qwen-Image 2.1', [f'{HERE}/out/qwen21/panel_{i}.png' for i in range(1, 7)])]
sheet = Image.new('RGB', (LBL + 6 * W, 3 * H), (24, 22, 26))
d = ImageDraw.Draw(sheet)
for r, (label, files) in enumerate(rows):
    d.text((10, r * H + H // 2 - 12), label, fill=(240, 240, 240), font=font)
    for c, f in enumerate(files):
        im = Image.open(f).convert('RGB')
        im.thumbnail((W - 6, H - 6))
        x, y = LBL + c * W + (W - im.width) // 2, r * H + (H - im.height) // 2
        sheet.paste(im, (x, y))
        if r:
            d.text((x + 6, y + 4), str(c + 1), fill=(255, 255, 0), font=font)
sheet.save(f'{HERE}/sheet_flux3_vs_qwen21.jpg', quality=90)
print('ok')
