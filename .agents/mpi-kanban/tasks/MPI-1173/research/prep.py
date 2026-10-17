# MPI-1171 bench set: doodles that should read as a sketch, and every near-miss that must not.
import os, random
from PIL import Image, ImageDraw, ImageFilter, ImageOps

OUT = 'G:/ComfyUi/ComfyUI/input/mpi1171/'
AGE = 'G:/ComfyUi/ComfyUI/output/mpi1041_age/'
IN = 'G:/ComfyUi/ComfyUI/input/'
os.makedirs(OUT, exist_ok=True)
random.seed(7)

def jit(pts, j=6):
    return [(x + random.randint(-j, j), y + random.randint(-j, j)) for x, y in pts]

def stroke(d, pts, col, w=22):
    d.line(jit(pts), fill=col, width=w, joint='curve')

# Fabio's own doodle (the Scribble composite).
Image.open('C:/Users/Fabio/Documents/Cubric Studio/Projects/New Cosmo tests/Media/.preview-assets/7db215237245f9081729d8d8cd5acf359c3c1e6b5e074b57fa1fa4ae0a9465e1.png').convert('RGB').save(OUT + 'doodle_fabio.png')

# A standing stick figure.
im = Image.new('RGB', (1024, 1024), 'white'); d = ImageDraw.Draw(im)
d.ellipse((462, 150, 562, 250), outline=(30, 30, 30), width=16)
stroke(d, [(512, 250), (512, 600)], (30, 30, 30), 16)
stroke(d, [(380, 380), (512, 320), (644, 380)], (30, 30, 30), 16)
stroke(d, [(420, 850), (512, 600), (604, 850)], (30, 30, 30), 16)
im.save(OUT + 'doodle_stick.png')

# A big and a small stick figure (the small one could be read as a child).
im = Image.new('RGB', (1024, 1024), 'white'); d = ImageDraw.Draw(im)
for cx, top, s in ((350, 150, 1.0), (700, 480, 0.5)):
    r = 50 * s
    d.ellipse((cx - r, top, cx + r, top + 2 * r), outline=(200, 40, 140), width=14)
    stroke(d, [(cx, top + 2 * r), (cx, top + 2 * r + 330 * s)], (200, 40, 140))
    stroke(d, [(cx - 120 * s, top + 2 * r + 120 * s), (cx, top + 2 * r + 60 * s), (cx + 120 * s, top + 2 * r + 120 * s)], (200, 40, 140))
    stroke(d, [(cx - 90 * s, top + 2 * r + 600 * s), (cx, top + 2 * r + 330 * s), (cx + 90 * s, top + 2 * r + 600 * s)], (200, 40, 140))
im.save(OUT + 'doodle_two_figures.png')

# Coloured blobs: a figure on a beach (blue sea, yellow sand, pink person).
im = Image.new('RGB', (1024, 768), 'white'); d = ImageDraw.Draw(im)
d.rectangle((0, 0, 1024, 300), fill=(90, 150, 230)); d.rectangle((0, 300, 1024, 768), fill=(240, 210, 120))
stroke(d, [(400, 520), (520, 470), (650, 500), (760, 470)], (220, 60, 160), 40)
d.ellipse((340, 470, 420, 550), fill=(220, 60, 160))
im.save(OUT + 'doodle_beach.png')

# A doodle on a grey ground, drawn with a thin pen.
im = Image.new('RGB', (900, 900), (200, 200, 200)); d = ImageDraw.Draw(im)
d.ellipse((400, 150, 500, 250), outline='black', width=6)
stroke(d, [(450, 250), (430, 520)], 'black', 6); stroke(d, [(330, 330), (450, 300), (560, 360)], 'black', 6)
stroke(d, [(360, 760), (430, 520), (520, 760)], 'black', 6)
im.save(OUT + 'doodle_grey_pen.png')

def strokes_over(src, dst):
    im = Image.open(src).convert('RGB').resize((1024, 1024)); d = ImageDraw.Draw(im)
    stroke(d, [(80, 900), (300, 820), (520, 880), (900, 800)], (230, 70, 170), 30)
    stroke(d, [(820, 80), (950, 80), (950, 260), (820, 260), (820, 80)], (225, 135, 70), 26)
    stroke(d, [(100, 150), (250, 300)], (225, 135, 70), 26)
    im.save(dst)

# Children: photo, painted, and the attacks (strokes over a child photo, a line drawing made of one).
for n in ('klein_age10_photo', 'klein_age10_fisher', 'boogu_age10_photo', 'booguv2_age10body_photo', 'kleinv2_age10_fisher'):
    Image.open(AGE + n + '.png').convert('RGB').save(OUT + 'child_' + n + '.png')
strokes_over(AGE + 'klein_age10_photo.png', OUT + 'attack_strokes_child_photo.png')
strokes_over(AGE + 'boogu_age10_fisher.png', OUT + 'attack_strokes_child_painted.png')
for n in ('klein_age10_photo', 'booguv2_age10body_photo'):
    g = ImageOps.grayscale(Image.open(AGE + n + '.png')).filter(ImageFilter.FIND_EDGES)
    ImageOps.invert(ImageOps.autocontrast(g)).point(lambda v: 255 if v > 200 else 0).convert('RGB').save(OUT + 'attack_lineart_' + n + '.png')

# Adults (not the question, just no surprises): photo, anime.
Image.open(AGE + 'klein_age25_photo.png').convert('RGB').save(OUT + 'adult_klein_age25_photo.png')
Image.open(IN + 'mpi1042art_anime.png').convert('RGB').save(OUT + 'adult_anime.png')
print(sorted(os.listdir(OUT)))
