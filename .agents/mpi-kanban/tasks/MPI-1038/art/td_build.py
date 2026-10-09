"""Tile Detailer tile + hero from ONE real run: input -> (lanczos x factor) -> cloud tiles walk.

usage: python td_build.py <input.png> <output.png> <factor> <outdir>
Tile geometry and cloud mask = td_art.tiles (Impact's own algorithm, the shipped graph's values).
"""
import subprocess, sys
import numpy as np
from PIL import Image, ImageFilter
from td_art import tiles

HEAT = np.array([255, 126, 182], np.float32)       # --vision-accent / --accent-heat, canvas-read
GROUND = np.array([29, 18, 23], np.float32)        # --surface-viewer as the browser paints it
FF = 'C:/AI/Mpi/video-tool/node_modules/ffmpeg-static/ffmpeg.exe'
FPS, HW, HH = 24, 1280, 720

inp, outp, factor, outdir = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]
after_full = Image.open(outp).convert('RGB')
FW, FH = after_full.size
src = Image.open(inp).convert('RGB')
geo = tiles(FW, FH)


def plates(scale, box=None):
    """before (input lanczos-enlarged, as the graph does) and after, at working scale."""
    w, h = round(FW * scale), round(FH * scale)
    b = np.asarray(src.resize((w, h), Image.LANCZOS), np.float32)
    a = np.asarray(after_full.resize((w, h), Image.LANCZOS), np.float32)
    masks = []
    for t in geo:
        m = Image.fromarray((t['mask'] * 255).astype(np.uint8)).resize((w, h), Image.BILINEAR)
        masks.append(np.asarray(m, np.float32) / 255)
    if box:
        x0, y0, x1, y1 = box
        b, a = b[y0:y1, x0:x1], a[y0:y1, x0:x1]
        masks = [m[y0:y1, x0:x1] for m in masks]
    return b, a, masks


def dim(img):
    g = img.mean(axis=2, keepdims=True)
    return (img * 0.25 + g * 0.75) * 0.5


def cloud_marks(mask, stroke, dash):
    m = Image.fromarray(((mask > 0.5) * 255).astype(np.uint8))
    out = np.asarray(m.filter(ImageFilter.MaxFilter(stroke * 2 + 1)), np.float32) / 255
    inn = np.asarray(m.filter(ImageFilter.MinFilter(stroke * 2 + 1)), np.float32) / 255
    edge = np.asarray(Image.fromarray((np.clip(out - inn, 0, 1) * 255).astype(np.uint8))
                      .filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255
    soft = np.asarray(m.filter(ImageFilter.GaussianBlur(stroke * 6)), np.float32) / 255
    return edge[..., None], soft[..., None]


def compose(b, a, masks, done, active, act_amt, marks):
    pend = dim(b)
    lit = np.zeros(b.shape[:2], np.float32)
    for i in done:
        lit = np.maximum(lit, masks[i])
    if active is not None:
        lit = np.maximum(lit, masks[active] * act_amt)
    lit = lit[..., None]
    img = pend * (1 - lit) + a * lit
    if active is not None:
        edge, soft = marks[active]
        tint = HEAT * 0.45 * soft * act_amt
        img = 255 - (255 - img) * (255 - tint) / 255     # screen, as .mask-shape
        img = img * (1 - edge * act_amt) + HEAT * edge * act_amt
    return img


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def hero():
    s = HW / FW
    b_full, a, masks = plates(s)
    y0 = (b_full.shape[0] - HH) // 2
    b, a, masks = b_full[y0:y0 + HH], a[y0:y0 + HH], [m[y0:y0 + HH] for m in masks]
    marks = [cloud_marks(m, 4, 16) for m in masks]
    n = len(masks)
    T_GROW0, T_GROW1, T_WALK0 = 0.5, 1.3, 1.5
    step = min(0.6, 5.2 / n)
    T_WALK1 = T_WALK0 + step * n
    T_HOLD1, T_END = T_WALK1 + 0.7, T_WALK1 + 1.2
    start = None
    frames = []
    for f in range(round(T_END * FPS)):
        t = f / FPS
        if t < T_GROW1:  # the input at its own size, enlarged first (the optional x factor)
            k = ease((t - T_GROW0) / (T_GROW1 - T_GROW0))
            sc = 1 / factor + (1 - 1 / factor) * k
            w, h = round(HW * sc), round(b_full.shape[0] * sc)
            pic = Image.fromarray(b_full.astype(np.uint8)).resize((w, h), Image.LANCZOS)
            pic = np.asarray(pic, np.float32)
            pic = pic * (1 - k) + dim(pic) * k
            canvas = Image.new('RGB', (HW, HH), tuple(int(c) for c in GROUND))
            canvas.paste(Image.fromarray(pic.astype(np.uint8)), ((HW - w) // 2, -((h - HH) // 2)))
            img = np.asarray(canvas, np.float32)
            if start is None:
                start = img.copy()
        elif t < T_WALK0:
            img = dim(b)
        elif t < T_WALK1 + 0.3:
            i = int((t - T_WALK0) / step)
            if i < n:
                img = compose(b, a, masks, range(i), i, ease(((t - T_WALK0) / step - i) / 0.35), marks)
            else:
                img = compose(b, a, masks, range(n), n - 1, 1 - ease((t - T_WALK1) / 0.3), marks)
        elif t < T_HOLD1:
            img = a
        else:
            k = ease((t - T_HOLD1) / (T_END - T_HOLD1))
            img = a * (1 - k) + start * k
        frames.append(np.clip(img, 0, 255).astype(np.uint8))
    out = f'{outdir}/flow-tile-detailer.mp4'
    p = subprocess.Popen([FF, '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{HW}x{HH}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'slow',
                          '-movflags', '+faststart', '-an', out], stdin=subprocess.PIPE, stderr=subprocess.DEVNULL)
    for fr in frames:
        p.stdin.write(fr.tobytes())
    p.stdin.close(); p.wait()
    Image.fromarray(frames[round((T_WALK0 + step * n * 0.55) * FPS)]).resize((446, 251), Image.LANCZOS).save(f'{outdir}/hero_446.png')
    return out, T_END


def still(active, cx):
    """4/5 tile: the walk frozen with `active` lit in heat, crop centred on x=cx (0-1)."""
    TW, TH = 896, 1120
    s = TH / FH
    w = round(FW * s)
    x0 = int(min(max(cx * w - TW / 2, 0), w - TW))
    b, a, masks = plates(s, (x0, 0, x0 + TW, TH))
    marks = [cloud_marks(m, 6, 26) for m in masks]
    img = compose(b, a, masks, list(range(active)), active, 1.0, marks)
    im = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    im.save(f'{outdir}/flow-tile-detailer.webp', quality=90)
    idle = np.asarray(im.resize((220, 275), Image.LANCZOS), np.float32)
    g = idle.mean(axis=2, keepdims=True)
    idle = (g + (idle - g) * 0.92) * 0.92                      # MpiTileSheet idle filter
    Image.fromarray(idle.clip(0, 255).astype(np.uint8)).save(f'{outdir}/tile_220_idle.png')


if __name__ == '__main__':
    what = sys.argv[5] if len(sys.argv) > 5 else 'both'
    if what in ('still', 'both'):
        still(int(sys.argv[6]) if len(sys.argv) > 6 else len(geo) // 2, float(sys.argv[7]) if len(sys.argv) > 7 else 0.5)
    if what in ('hero', 'both'):
        print(hero())
