"""MPI-1101 leak test (2026-10-14): does the picture UNDER the full-strength mask leak into the LanPaint repaint?

LanPaint's result for window 0 of run c2bb4b7d (greenhouse 16K) keeps a straight line exactly at the old cut
(column step 17.4 vs median 1.8 at x=2048) although the mask there is 255. Same window, same prompt, same seed,
the shipped graph (comfy_workflows/flow_make_seamless.json) on the G:\\ComfyUi bench:
  asis  = the cut as the app sends it
  blur  = the band's full-strength core (mask 255) replaced by a heavy blur of itself, so no edge is left there
If blur loses the line, the input leaks through the masked sampling and the core must be blanked before sampling.

usage (repo root, ONLY under the GPU lease): python .agents/mpi-kanban/tasks/MPI-1101/research/bench/leak_bench.py <runDir> <outName>"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from tile_bench import run, IN, OUT

PROMPT = ('Steel greenhouse roof seen from below: grey iron beams, girders and arches against bright white translucent '
          'roof panels, pale cloth hanging from a beam, soft overcast daylight.')


def main():
    run_dir, name = sys.argv[1], sys.argv[2]
    g = json.load(open(os.path.join(os.path.dirname(__file__), '../../../../../../comfy_workflows/flow_make_seamless.json'), encoding='utf-8'))
    img = Image.open(os.path.join(run_dir, 'win_0_img.png'))
    mask = np.asarray(Image.open(os.path.join(run_dir, 'win_0_mask.png')).convert('RGB'))[..., 0]
    blurred = img.convert('RGBA').filter(ImageFilter.GaussianBlur(96))
    core = Image.fromarray(((mask >= 255) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(16))
    variants = {'asis': img, 'blur': Image.composite(blurred, img.convert('RGBA'), core)}
    shutil_mask = os.path.join(IN, 'mpi1101l_mask.png')
    Image.open(os.path.join(run_dir, 'win_0_mask.png')).save(shutil_mask)
    # Fabio, 2026-10-14: plain IMAGE-TO-IMAGE too - LanPaint (20) swapped for a KSampler at partial denoise on the same
    # masked latent (19), DifferentialDiffusion model (25), prompt, seed, 4 steps, cfg 1, Klein's lcm/normal.
    runs = [(t, im, None) for t, im in variants.items()] + [(f'i2i_d{int(d * 100)}', img, d) for d in (0.6, 0.8)]
    for tag, im, denoise in runs:
        path = os.path.join(IN, f'mpi1101l_{tag}.png')
        im.save(path)
        api = json.loads(json.dumps(g))
        if denoise is not None:
            ls = api['20']['inputs']
            api['20'] = {'class_type': 'KSampler', 'inputs': {
                'model': ls['model'], 'positive': ls['positive'], 'negative': ls['negative'], 'latent_image': ls['latent_image'],
                'seed': ls['seed'], 'steps': ls['steps'], 'cfg': ls['cfg'], 'sampler_name': 'lcm', 'scheduler': 'normal',
                'denoise': denoise}}
        api['1']['inputs']['string'] = path
        api['2']['inputs']['string'] = shutil_mask
        api['3']['inputs']['int'] = 7
        api['5']['inputs']['value'] = PROMPT
        save = next(k for k, n in api.items() if n['class_type'] in ('SaveImage', 'MpiSaveImage', 'PreviewImage'))
        api[save] = {'class_type': 'SaveImage', 'inputs': {'images': api[save]['inputs']['images'], 'filename_prefix': f'{name}/{tag}'}}
        imgs, secs = run(api)
        print(tag, f'{secs:.1f}s', os.path.join(OUT, imgs[0]['subfolder'], imgs[0]['filename']), flush=True)


if __name__ == '__main__':
    main()
