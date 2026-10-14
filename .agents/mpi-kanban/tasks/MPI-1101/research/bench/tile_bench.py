"""MPI-1101 bench: TILE DETAILING instead of (or after) the LanPaint inpaint, on the 16K window that kept the cut.

Fabio, 2026-10-14: try the upscale op's Tiles path (Impact MakeTileSEGS -> DetailerForEachPipe, Klein 9B's own
settings from klein_9b_t2i.json 684/685) with the band mask choosing the tiles and NO prompt. Tiles run at 1024
on the picture's own pixels, so there is no 4x shrink (the cause of the kept cut, validation.md 2026-10-13).

Input: window 0 of run c2bb4b7d (greenhouse 16384x8192 left-right, top half, seamScore 67 -> 26 after LanPaint).
  raw = the cut the model is shown (hard seam at x=2048), lan = LanPaint's result for it.
Graph: LoadImage + LoadImageMask(red) -> MaskToSEGS -> ImpactMakeTileSEGS(filter_in = band) -> ToBasicPipe(Klein 9B,
empty prompt, zeroed negative) -> DetailerForEachPipe(denoise D) -> SaveImage.

usage (repo root, ONLY under the GPU lease; needs the G:\\ComfyUi bench on :8188):
  python .agents/mpi-kanban/tasks/MPI-1101/research/bench/tile_bench.py <runDir> <outName> [denoise,...]"""
import json, os, shutil, sys, time, urllib.request

COMFY = 'http://127.0.0.1:8188'
IN = 'G:/ComfyUi/ComfyUI/input'
OUT = 'G:/ComfyUi/ComfyUI/output'


def graph(image, mask, denoise, prefix, seed=7):
    return {
        '1': {'class_type': 'LoadImage', 'inputs': {'image': image}},
        '2': {'class_type': 'LoadImageMask', 'inputs': {'image': mask, 'channel': 'red'}},
        '3': {'class_type': 'MaskToSEGS', 'inputs': {'mask': ['2', 0], 'combined': True, 'crop_factor': 1.0,
                                                      'bbox_fill': False, 'drop_size': 1, 'contour_fill': False}},
        '4': {'class_type': 'ImpactMakeTileSEGS', 'inputs': {'images': ['1', 0], 'bbox_size': 1024, 'crop_factor': 1.5,
              'min_overlap': 200, 'filter_segs_dilation': 30, 'mask_irregularity': 0.7,
              'irregular_mask_mode': 'Reuse fast', 'filter_in_segs_opt': ['3', 0]}},
        '5': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'flux-2-klein-9b-int8-convrot.safetensors', 'weight_dtype': 'default'}},
        '6': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen_3_8b_int8_convrot.safetensors', 'type': 'flux2', 'device': 'default'}},
        '7': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'flux2-vae.safetensors'}},
        '8': {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['6', 0], 'text': ''}},
        '9': {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': ['8', 0]}},
        '10': {'class_type': 'ToBasicPipe', 'inputs': {'model': ['5', 0], 'clip': ['6', 0], 'vae': ['7', 0],
                                                       'positive': ['8', 0], 'negative': ['9', 0]}},
        '11': {'class_type': 'DetailerForEachPipe', 'inputs': {
            'guide_size': 1024, 'guide_size_for': True, 'max_size': 1536, 'steps': 4, 'cfg': 1, 'sampler_name': 'lcm',
            'scheduler': 'normal', 'feather': 10, 'noise_mask': True, 'force_inpaint': True, 'wildcard': '',
            'refiner_ratio': 0.2, 'cycle': 1, 'inpaint_model': False, 'noise_mask_feather': 10, 'tiled_encode': False,
            'tiled_decode': False, 'image': ['1', 0], 'segs': ['4', 0], 'basic_pipe': ['10', 0], 'seed': seed,
            'denoise': denoise}},
        '12': {'class_type': 'SaveImage', 'inputs': {'images': ['11', 0], 'filename_prefix': prefix}},
    }


def run(g):
    req = urllib.request.Request(COMFY + '/prompt', json.dumps({'prompt': g}).encode(), {'Content-Type': 'application/json'})
    try:
        pid = json.load(urllib.request.urlopen(req))['prompt_id']
    except urllib.error.HTTPError as e:
        raise SystemExit(e.read().decode()[:2000])
    t = time.time()
    while True:
        h = json.load(urllib.request.urlopen(f'{COMFY}/history/{pid}'))
        if pid in h:
            st = h[pid].get('status', {})
            if st.get('status_str') == 'error':
                raise SystemExit(json.dumps(st)[:2000])
            imgs = [i for o in h[pid]['outputs'].values() for i in o.get('images', [])]
            return imgs, time.time() - t
        time.sleep(1)


def main():
    run_dir, name = sys.argv[1], sys.argv[2]
    denoises = [float(x) for x in (sys.argv[3] if len(sys.argv) > 3 else '0.4,0.6,0.8').split(',')]
    for kind in ('img', 'mask', 'result'):
        shutil.copy(os.path.join(run_dir, f'win_0_{kind}.png'), os.path.join(IN, f'mpi1101t_{kind}.png'))
    for src in ('img', 'result'):
        for d in denoises:
            tag = f'{name}/{"raw" if src == "img" else "lan"}_d{int(d * 100)}'
            imgs, secs = run(graph(f'mpi1101t_{src}.png', 'mpi1101t_mask.png', d, tag))
            print(tag, f'{secs:.1f}s', os.path.join(OUT, imgs[0]['subfolder'], imgs[0]['filename']), flush=True)


if __name__ == '__main__':
    main()
