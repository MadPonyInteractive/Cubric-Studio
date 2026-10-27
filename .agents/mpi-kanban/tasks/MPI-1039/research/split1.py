"""Split sampling round 1 (Fabio 2026-10-26): Qwen Edit 2511 + angle LoRA lays the camera move down in the first
steps, Krea2 (NSFW raw + identity-edit LoRA + edit patch) finishes the last steps on the SAME latent.

  python split1.py qwen      stage 1: per target, Qwen Hyper (4-step Lightning, shift 2.5, cfg 1 = app Tier 3) +
                             angle LoRA 0.9. Saves the noisy latent after step 2 and step 3, and the Qwen-only result.
  python split1.py krea      stage 2: each saved latent finished by Krea2 (turbo LoRA, cfg 1) under three
                             reference modes: none (text only, the July test), sub (outfit picture as the one
                             reference), two (scene = the user's picture, subject = outfit picture).
  python split1.py sheet

Runs on Fabio's G:\\ComfyUi bench (127.0.0.1:8188) under gpu_lease.py. Both models share the Wan21 16-ch latent +
qwen_image VAE (MPI-242 research), so the latent crosses with no decode. One sigma list drives both stages: Qwen's own
4-step schedule down to the hand-off, then a Krea2 schedule (shift 1.15) from that same sigma to 0.
Inputs = Fabio's case: edit_006 (low 3/4 back right) + his front eye-level picture (the Whole Outfit slot).
"""
import json, os, shutil, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import angles as a  # noqa: E402  (_sheet only)

URL = 'http://127.0.0.1:8188'
COMFY = 'G:/ComfyUi/ComfyUI'
OUTDIR = 'D:/WORK/Images/Outputs'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out', 'split1.json')
PROJ = os.path.expandvars(r'%USERPROFILE%\Documents\Cubric Studio\Projects\Draw it in improvements\Media')
INPUTS = {'mpi1039_split_person.png': os.path.join(PROJ, 'edit_006.png'),
          'mpi1039_split_outfit.png': os.path.join(PROJ, 'control_c6213e9f.png')}
SEED = 111
# Qwen Tier 3: ModelSamplingAuraFlow shift 2.5, simple scheduler, 4 steps -> sigma = s*t / (1 + (s-1)*t).
Q_SIG = [1.0, 0.8824, 0.7143, 0.4545, 0.0]
LIGHTNING = {4: 'qwen\\Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors',
             8: 'qwen\\Qwen-Image-Edit-2511-Lightning-8steps-V1.0-bf16.safetensors'}


def q_sigmas(n, s=2.5):
    return [round(s * t / (1 + (s - 1) * t), 4) for t in (1 - i / n for i in range(n + 1))]
# The LoRA's directions are the CAMERA's move relative to the source view (orbit1). Start = tq_br (+135), low.
# Each gizmo target is tried with a relative and an absolute reading of the height words where they differ.
TARGETS = {
    'tq_br level rel': '<sks> front view elevated shot medium shot',
    'tq_br level abs': '<sks> front view eye-level shot medium shot',
    'front lo abs': '<sks> back-right quarter view low-angle shot medium shot',
    'front level': '<sks> back-right quarter view eye-level shot medium shot',
    'back level': '<sks> front-left quarter view eye-level shot medium shot',
    'pr_r lo abs': '<sks> front-right quarter view low-angle shot medium shot',
    'pr_r lo rel': '<sks> front-right quarter view eye-level shot medium shot',
}
KREA_PROMPT = ('The same woman seen from another camera angle in the same room. Keep her face, hair, skin and body '
               'exactly as in the reference picture.')
TEXT_PROMPT = ('Photo of a young woman with long dark brown hair, topless, wearing black string bikini briefs, '
               'barefoot, standing in a hotel room with a bed and a door.')


def krea_sigmas(start, n, s=1.15):
    t0 = start / (s - (s - 1) * start)
    ts = [t0 * (1 - i / n) for i in range(n + 1)]
    return [round(s * t / (1 + (s - 1) * t), 4) for t in ts]


def submit(graph):
    body = json.dumps({'prompt': graph}).encode()
    req = urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})
    pid = json.load(urllib.request.urlopen(req))['prompt_id']
    while True:
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            st = h[pid]['status']
            if st.get('status_str') == 'error':
                raise RuntimeError(json.dumps(st)[:1500])
            return h[pid]['outputs']
        time.sleep(2)


def files(outputs, kind):
    return [os.path.join(OUTDIR, f.get('subfolder', ''), f['filename']).replace('\\', '/')
            for o in outputs.values() for f in o.get(kind, [])]


def qwen_graph(prompt, tag, steps=4, cuts=(2, 3), image='mpi1039_split_person.png', peek=None, angle=0.9, start=0):
    # start = first step: > 0 noises the input picture's own latent only to that sigma (img2img), so its camera
    # holds part way - can a height move land between the LoRA's fixed stops?
    # peek = (latent file, cut): one Euler jump from the hand-off sigma straight to 0 = the model's x0 guess at that
    # step (what a live preview shows) - can a short run already tell where the camera landed?
    sig = q_sigmas(steps)
    g = {
        '1': ('UNETLoader', {'unet_name': 'qwen_image_edit_2511_int8_convrot.safetensors', 'weight_dtype': 'default'}),
        '2': ('LoraLoaderModelOnly', {'model': ['1', 0], 'strength_model': 1.0,
                                      'lora_name': LIGHTNING[steps]}),
        '3': ('LoraLoaderModelOnly', {'model': ['2', 0], 'strength_model': angle,
                                      'lora_name': 'qwen\\qwen-image-edit-2511-multiple-angles-lora.safetensors'}),
        '4': ('ModelSamplingAuraFlow', {'model': ['3', 0], 'shift': 2.5}),
        '5': ('CFGNorm', {'model': ['4', 0], 'strength': 1.0}),
        '6': ('CLIPLoader', {'clip_name': 'qwen_2.5_vl_7b_fp8_scaled.safetensors', 'type': 'qwen_image', 'device': 'default'}),
        '7': ('VAELoader', {'vae_name': 'qwen_image_vae.safetensors'}),
        '8': ('LoadImage', {'image': image}),
        '9': ('TextEncodeQwenImageEditPlus', {'clip': ['6', 0], 'vae': ['7', 0], 'image1': ['8', 0], 'prompt': prompt}),
        '10': ('TextEncodeQwenImageEditPlus', {'clip': ['6', 0], 'vae': ['7', 0], 'image1': ['8', 0], 'prompt': ''}),
        '11': ('VAEEncode', {'pixels': ['8', 0], 'vae': ['7', 0]}),
        '12': ('CFGGuider', {'model': ['5', 0], 'positive': ['9', 0], 'negative': ['10', 0], 'cfg': 1.0}),
        '13': ('KSamplerSelect', {'sampler_name': 'euler'}),
        '14': ('RandomNoise', {'noise_seed': SEED}),
        '15': ('DisableNoise', {}),
    }
    if peek:
        g['11'] = ('LoadLatent', {'latent': peek[0]})
        g['20'] = ('ManualSigmas', {'sigmas': f'{sig[peek[1]]}, 0.0'})
        g['30'] = ('SamplerCustomAdvanced', {'noise': ['15', 0], 'guider': ['12', 0], 'sampler': ['13', 0],
                                             'sigmas': ['20', 0], 'latent_image': ['11', 0]})
        g['50'] = ('VAEDecode', {'samples': ['30', 0], 'vae': ['7', 0]})
        g['51'] = ('SaveImage', {'images': ['50', 0], 'filename_prefix': f'mpi1039_split/{tag}_peek{peek[1]}'})
        return {k: {'class_type': c, 'inputs': i} for k, (c, i) in g.items()}
    bounds = [start, *cuts, steps]
    prev, chunks = ['11', 0], list(zip(bounds, bounds[1:]))
    for i, (lo, hi) in enumerate(chunks):
        sid, nid = f'2{i}', f'3{i}'
        g[sid] = ('ManualSigmas', {'sigmas': ', '.join(str(x) for x in sig[lo:hi + 1])})
        g[nid] = ('SamplerCustomAdvanced', {'noise': ['14' if i == 0 else '15', 0], 'guider': ['12', 0],
                                            'sampler': ['13', 0], 'sigmas': [sid, 0], 'latent_image': prev})
        prev = [nid, 0]
        if hi < steps:
            g[f'4{i}'] = ('SaveLatent', {'samples': prev, 'filename_prefix': f'latents/mpi1039_split_{tag}_k{hi}'})
    g['50'] = ('VAEDecode', {'samples': prev, 'vae': ['7', 0]})
    g['51'] = ('SaveImage', {'images': ['50', 0], 'filename_prefix': f'mpi1039_split/{tag}_qwen'})
    return {k: {'class_type': c, 'inputs': i} for k, (c, i) in g.items()}


def krea_graph(latent_file, k, mode, tag, sampler='euler', steps=None, shift=1.15, start=None, up=None, lup=None,
               cfg=None, refine=None, hires=None, usdu=None):
    # usdu = (factor, denoise, turbo): the app's shipped one-pass Krea2 upscale (krea2_t2i template branch 7):
    # Siax 4x -> UltimateSDUpscale one tile, euler/beta; turbo = Turbo LoRA 1.0, 3 steps, cfg 1.0, else base model,
    # 15 steps, cfg 1.5. Then resized back to the user's input picture size (Fabio: output = input size)
    # hires = (start, steps): hi-res fix on the FINISHED 1K latent - upscale 2x, re-noise to `start`, Raw again at 2K,
    # then the same skin pass (needs refine)
    # refine = (steps, denoise): the shipped quality tier's skin pass on the result (Turbo LoRA, beta, cfg 1)
    # cfg = Raw with no Turbo LoRA at this cfg (the app's quality tier runs cfg 2.0); None = Turbo at cfg 1
    # lup = hi-res fix: upscale the hand-off latent 2x with this method and finish it at 2K
    # up = a finished picture redone at 2x size from sigma `start` (img2img), instead of a hand-off latent
    sig = krea_sigmas(start or Q_SIG[k], steps or (6 if k == 2 else 4), shift)
    g = {
        '1': ('UNETLoader', {'unet_name': 'lustify-v10-krea-raw-int8_convrot.safetensors', 'weight_dtype': 'default'}),
        '6': ('CLIPLoader', {'clip_name': 'qwen3vl_4b_abliterated_fp8_scaled.safetensors', 'type': 'krea2', 'device': 'default'}),
        '7': ('VAELoader', {'vae_name': 'qwen_image_vae.safetensors'}),
        '8': ('LoadImage', {'image': 'mpi1039_split_person.png'}),
        '9': ('LoadImage', {'image': 'mpi1039_split_outfit.png'}),
        '11': ('VAEEncode', {'pixels': ['18', 0], 'vae': ['7', 0]}) if up else ('LoadLatent', {'latent': latent_file}),
        '13': ('KSamplerSelect', {'sampler_name': sampler}),
        '15': ('DisableNoise', {}),
        '16': ('ManualSigmas', {'sigmas': ', '.join(str(x) for x in sig)}),
    }
    if lup:
        g['19'] = ('LatentUpscaleBy', {'samples': ['11', 0], 'upscale_method': lup, 'scale_by': 2.0})
    if up:
        g['17'] = ('LoadImage', {'image': up})
        g['18'] = ('ImageScaleBy', {'image': ['17', 0], 'upscale_method': 'lanczos', 'scale_by': 2.0})
        g['14'] = ('RandomNoise', {'noise_seed': SEED})
    model = ['1', 0]
    if mode == 'none':
        g['20'] = ('CLIPTextEncode', {'clip': ['6', 0], 'text': TEXT_PROMPT})
        g['21'] = ('CLIPTextEncode', {'clip': ['6', 0], 'text': ''})
    else:
        g['2'] = ('LoraLoaderModelOnly', {'model': model, 'strength_model': 1.0,
                                         'lora_name': 'krea-2\\edit\\krea2_identity_edit_v1_2_r128.safetensors'})
        g['30'] = ('VAEEncode', {'pixels': ['9', 0], 'vae': ['7', 0]})
        if mode == 'sub':
            g['3'] = ('Krea2EditModelPatch', {'model': ['2', 0], 'source_latent': ['30', 0], 'vae': ['7', 0],
                                              'source_image': ['9', 0], 'ref_boost': 1.0, 'fit_mode': 'fit'})
            refs = {'image': ['9', 0]}
        else:  # scene = the user's picture first, subject = the outfit picture second (training order)
            g['31'] = ('VAEEncode', {'pixels': ['8', 0], 'vae': ['7', 0]})
            g['3'] = ('Krea2EditModelPatch', {'model': ['2', 0], 'source_latent': ['31', 0], 'source_latent_b': ['30', 0],
                                              'vae': ['7', 0], 'source_image': ['8', 0], 'source_image_b': ['9', 0],
                                              'ref_boost': 1.0, 'ref_boost_a': 1.0, 'fit_mode': 'fit'})
            refs = {'image': ['8', 0], 'image_b': ['9', 0]}
        g['20'] = ('Krea2EditGroundedEncode', {'clip': ['6', 0], 'prompt': KREA_PROMPT, 'grounding_px': 1024, **refs})
        g['21'] = ('Krea2EditGroundedEncode', {'clip': ['6', 0], 'prompt': '', 'grounding_px': 1024, **refs})
        model = ['3', 0]
    if cfg is None:
        g['4'] = ('LoraLoaderModelOnly', {'model': model, 'strength_model': 1.0,
                                         'lora_name': 'krea-2\\extra\\krea2_turbo_distill_r128.safetensors'})
        model = ['4', 0]
    g['12'] = ('CFGGuider', {'model': model, 'positive': ['20', 0], 'negative': ['21', 0], 'cfg': cfg or 1.0})
    g['40'] = ('SamplerCustomAdvanced', {'noise': ['14' if up else '15', 0], 'guider': ['12', 0], 'sampler': ['13', 0],
                                         'sigmas': ['16', 0], 'latent_image': ['19' if lup else '11', 0]})
    out = ['40', 0]
    if refine:
        g['60'] = ('LoraLoaderModelOnly', {'model': model, 'strength_model': 1.0,
                                          'lora_name': 'krea-2\\extra\\krea2_turbo_distill_r128.safetensors'})
        g['61'] = ('BasicScheduler', {'model': ['60', 0], 'scheduler': 'beta', 'steps': refine[0], 'denoise': refine[1]})
        g['62'] = ('CFGGuider', {'model': ['60', 0], 'positive': ['20', 0], 'negative': ['21', 0], 'cfg': 1.0})
        g['63'] = ('RandomNoise', {'noise_seed': SEED + 1})
        g['64'] = ('SamplerCustomAdvanced', {'noise': ['63', 0], 'guider': ['62', 0], 'sampler': ['13', 0],
                                             'sigmas': ['61', 0], 'latent_image': out})
        out = ['64', 0]
    if hires:
        g['70'] = ('LatentUpscaleBy', {'samples': out, 'upscale_method': 'bislerp', 'scale_by': 2.0})
        g['71'] = ('ManualSigmas', {'sigmas': ', '.join(str(x) for x in krea_sigmas(hires[0], hires[1], shift))})
        g['72'] = ('RandomNoise', {'noise_seed': SEED + 2})
        # 2K runs light: no refs (the upscaled picture carries identity), plain Raw at cfg 1 - with refs + cfg 2 it
        # spilled out of 16 GB at 133 s/step
        g['80'] = ('CLIPTextEncode', {'clip': ['6', 0], 'text': TEXT_PROMPT})
        g['81'] = ('CLIPTextEncode', {'clip': ['6', 0], 'text': ''})
        g['82'] = ('CFGGuider', {'model': ['1', 0], 'positive': ['80', 0], 'negative': ['81', 0], 'cfg': 1.0})
        g['83'] = ('LoraLoaderModelOnly', {'model': ['1', 0], 'strength_model': 1.0,
                                          'lora_name': 'krea-2\\extra\\krea2_turbo_distill_r128.safetensors'})
        g['84'] = ('CFGGuider', {'model': ['83', 0], 'positive': ['80', 0], 'negative': ['81', 0], 'cfg': 1.0})
        g['85'] = ('BasicScheduler', {'model': ['83', 0], 'scheduler': 'beta', 'steps': refine[0], 'denoise': refine[1]})
        g['73'] = ('SamplerCustomAdvanced', {'noise': ['72', 0], 'guider': ['82', 0], 'sampler': ['13', 0],
                                             'sigmas': ['71', 0], 'latent_image': ['70', 0]})
        g['74'] = ('SamplerCustomAdvanced', {'noise': ['63', 0], 'guider': ['84', 0], 'sampler': ['13', 0],
                                             'sigmas': ['85', 0], 'latent_image': ['73', 0]})
        out = ['74', 0]
    g['50'] = ('VAEDecode', {'samples': out, 'vae': ['7', 0]})
    img = ['50', 0]
    if usdu:
        side = round(1024 * usdu[0] / 16) * 16
        g['90'] = ('UpscaleModelLoader', {'model_name': '4x_NMKD-Siax_200k.pth'})
        g['91'] = ('ResizeImageMaskNode', {'resize_type': 'scale to multiple', 'resize_type.multiple': 16,
                                           'scale_method': 'lanczos', 'input': img})
        g['92'] = ('CLIPTextEncode', {'clip': ['6', 0], 'text': TEXT_PROMPT})
        g['93'] = ('CLIPTextEncode', {'clip': ['6', 0], 'text': ''})
        g['95'] = ('LoraLoaderModelOnly', {'model': ['1', 0], 'strength_model': 1.0,
                                           'lora_name': 'krea-2\\extra\\krea2_turbo_distill_r128.safetensors'})
        turbo = usdu[2]
        g['94'] = ('UltimateSDUpscale', {
            'image': ['91', 0], 'model': ['95' if turbo else '1', 0], 'positive': ['92', 0], 'negative': ['93', 0],
            'vae': ['7', 0], 'upscale_model': ['90', 0], 'upscale_by': usdu[0], 'seed': SEED + 3,
            'steps': 3 if turbo else 15, 'cfg': 1.0 if turbo else 1.5,
            'sampler_name': 'euler', 'scheduler': 'beta', 'denoise': usdu[1], 'mode_type': 'Linear',
            'tile_width': side, 'tile_height': side, 'mask_blur': 8, 'tile_padding': 32, 'seam_fix_mode': 'None',
            'seam_fix_denoise': 0.6, 'seam_fix_width': 64, 'seam_fix_mask_blur': 8, 'seam_fix_padding': 16,
            'force_uniform_tiles': False, 'tiled_decode': False, 'batch_size': 1})
        g['96'] = ('GetImageSize', {'image': ['8', 0]})
        g['97'] = ('ImageScale', {'image': ['94', 0], 'upscale_method': 'lanczos', 'width': ['96', 0],
                                  'height': ['96', 1], 'crop': 'disabled'})
        img = ['97', 0]
    g['51'] = ('SaveImage', {'images': img,
                             'filename_prefix': f'mpi1039_split/{tag}_k{k}_{mode}_{sampler}_n{len(sig) - 1}_s{shift}'
                                                f'{"_2k" if up else ""}{f"_lup_{lup}" if lup else ""}'
                                                f'{f"_raw_cfg{cfg}" if cfg else ""}'
                                                f'{f"_ref{refine[0]}x{refine[1]}" if refine else ""}'
                                                f'{f"_hires{hires[0]}x{hires[1]}" if hires else ""}'
                                                f'{f"_usdu{usdu[0]}x{usdu[1]}{"t" if usdu[2] else ""}" if usdu else ""}'})
    return {k_: {'class_type': c, 'inputs': i} for k_, (c, i) in g.items()}


def slug(t):
    return t.replace(' ', '_')


def main(stage):
    if stage != 'sheet' and not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    res = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for name, src in INPUTS.items():
        shutil.copyfile(src, os.path.join(COMFY, 'input', name))
    if stage == 'qwen':
        for t, prompt in TARGETS.items():
            if f'{t}|qwen' in res:
                continue
            outs = submit(qwen_graph(prompt, slug(t)))
            res[f'{t}|qwen'] = files(outs, 'images')[0]
            for lat in files(outs, 'latents'):
                kk = 'k2' if '_k2' in lat else 'k3'
                res[f'{t}|lat{kk}'] = lat
            json.dump(res, open(OUT, 'w'), indent=1)
            print(t, 'done', flush=True)
    elif stage == 'one':  # one Krea finish at a time: one <target> <k> <mode> [sampler] [steps] [shift]
        t, k, mode = sys.argv[2], int(sys.argv[3]), sys.argv[4]
        sampler = sys.argv[5] if len(sys.argv) > 5 else 'euler'
        steps = int(sys.argv[6]) if len(sys.argv) > 6 else None
        shift = float(sys.argv[7]) if len(sys.argv) > 7 else 1.15
        name = f'mpi1039_split_{slug(t)}_k{k}.latent'
        shutil.copyfile(res[f'{t}|latk{k}'], os.path.join(COMFY, 'input', name))
        print(files(submit(krea_graph(name, k, mode, slug(t), sampler, steps, shift)), 'images')[0])
        return
    elif stage == 'q8':  # q8 <target> [cut] [up_start]: Qwen 8-step (hand-off after `cut`) -> Krea 1K -> Krea 2K
        t = sys.argv[2]
        cut = int(sys.argv[3]) if len(sys.argv) > 3 else 4
        up_start = float(sys.argv[4]) if len(sys.argv) > 4 else 0.45
        tag = slug(t) + '_q8'
        outs = submit(qwen_graph(TARGETS[t], tag, 8, (cut,)))
        print('qwen', files(outs, 'images')[0], flush=True)
        name = f'mpi1039_split_{tag}_k{cut}.latent'
        shutil.copyfile(files(outs, 'latents')[0], os.path.join(COMFY, 'input', name))
        if up_start == 0:  # hand-off only: the locked finish is `raw`
            return
        k1 = files(submit(krea_graph(name, cut, 'two', tag, steps=6, start=q_sigmas(8)[cut])), 'images')[0]
        print('krea1k', k1, flush=True)
        shutil.copyfile(k1, os.path.join(COMFY, 'input', 'mpi1039_split_up.png'))
        print('krea2k', files(submit(krea_graph(None, cut, 'two', tag, steps=6, start=up_start,
                                                up='mpi1039_split_up.png')), 'images')[0])
        return
    elif stage == 'hop':  # hop <tag> <in_image> <cut|0> <words> [angle LoRA strength, 0.9] [start step, 0] [seed, 111]: one Qwen 8-step camera hop from any input picture.
        # cut 0 = full picture, copied to input/mpi1039_split_<tag>.png for the next hop; else the hand-off latent
        # for `raw <tag-target>` (Fabio: an impossible camera spot, e.g. low in front behind a bed, fails - go to
        # eye level first, then rotate)
        tag, image, cut, words = sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5]
        angle = float(sys.argv[6]) if len(sys.argv) > 6 else 0.9
        start = int(sys.argv[7]) if len(sys.argv) > 7 else 0
        global SEED
        SEED = int(sys.argv[8]) if len(sys.argv) > 8 else SEED
        outs = submit(qwen_graph(words, tag, 8, (cut,) if cut else (), image, angle=angle, start=start))
        img = files(outs, 'images')[0]
        print('qwen', img, flush=True)
        if cut:
            shutil.copyfile(files(outs, 'latents')[0], os.path.join(COMFY, 'input', f'mpi1039_split_{tag}_k{cut}.latent'))
        else:
            shutil.copyfile(img, os.path.join(COMFY, 'input', f'mpi1039_split_{tag}.png'))
        return
    elif stage == 'peek':  # peek <target> [cut]: x0 guess from the saved q8 hand-off of a TARGETS entry
        t = sys.argv[2]
        cut = int(sys.argv[3]) if len(sys.argv) > 3 else 4
        tag = slug(t) + '_q8'
        print(files(submit(qwen_graph(TARGETS[t], tag, 8, image='mpi1039_split_person.png',
                                      peek=(f'mpi1039_split_{tag}_k{cut}.latent', cut))), 'images')[0])
        return
    elif stage == 'lup':  # lup <target> <method> [steps] [cut]: hi-res fix on the q8 hand-off latent
        t, method = sys.argv[2], sys.argv[3]
        steps = int(sys.argv[4]) if len(sys.argv) > 4 else 6
        cut = int(sys.argv[5]) if len(sys.argv) > 5 else 4
        tag = slug(t) + '_q8'
        name = f'mpi1039_split_{tag}_k{cut}.latent'
        print(files(submit(krea_graph(name, cut, 'two', tag, steps=steps, start=q_sigmas(8)[cut], lup=method)),
                    'images')[0])
        return
    elif stage == 'raw':  # raw <target> [steps] [cfg] [ref_steps] [ref_denoise] [cut]: Krea2 Raw finishes the q8
        t = sys.argv[2]   # hand-off at 1K; ref_steps 0 = no skin pass
        steps = int(sys.argv[3]) if len(sys.argv) > 3 else 25
        cfg = float(sys.argv[4]) if len(sys.argv) > 4 else 2.0
        ref_steps = int(sys.argv[5]) if len(sys.argv) > 5 else 2
        ref_denoise = float(sys.argv[6]) if len(sys.argv) > 6 else 0.30
        hires_start = float(sys.argv[7]) if len(sys.argv) > 7 else 0  # 0 = stay at 1K
        hires_steps = int(sys.argv[8]) if len(sys.argv) > 8 else 16
        cut = int(sys.argv[9]) if len(sys.argv) > 9 else 4
        usdu = ((float(sys.argv[10]), float(sys.argv[11]), sys.argv[12] != 'q' if len(sys.argv) > 12 else True)
                if len(sys.argv) > 11 else None)  # factor denoise [q = quality tier, default turbo]
        tag = slug(t) + '_q8'
        name = f'mpi1039_split_{tag}_k{cut}.latent'
        print(files(submit(krea_graph(name, cut, 'two', tag, steps=steps, start=q_sigmas(8)[cut], cfg=cfg,
                                      refine=(ref_steps, ref_denoise) if ref_steps else None,
                                      hires=(hires_start, hires_steps) if hires_start else None, usdu=usdu)),
                    'images')[0])
        return
    elif stage == 'krea':
        only = sys.argv[2].split(',') if len(sys.argv) > 2 else list(TARGETS)
        for t in only:
            for k in (2, 3):
                lat = res[f'{t}|latk{k}']
                name = f'mpi1039_split_{slug(t)}_k{k}.latent'
                shutil.copyfile(lat, os.path.join(COMFY, 'input', name))
                for mode in ('none', 'sub', 'two'):
                    key = f'{t}|k{k}|{mode}'
                    if key in res:
                        continue
                    res[key] = files(submit(krea_graph(name, k, mode, slug(t))), 'images')[0]
                    json.dump(res, open(OUT, 'w'), indent=1)
                    print(key, 'done', flush=True)
    sheet(res)


def sheet(res):
    a.HERE = HERE
    a.disk = lambda p: p  # plain disk paths here, not the app's ?path= media URLs
    rows = []
    for t in TARGETS:
        if f'{t}|qwen' not in res:
            continue
        row = [(INPUTS['mpi1039_split_person.png'], 'IN tq_br lo'), (res[f'{t}|qwen'], f'{t} QWEN')]
        row += [(res.get(f'{t}|k{k}|{m}'), f'k{k} {m}') for k in (2, 3) for m in ('none', 'sub', 'two')]
        rows.append(row)
    a._sheet(rows, 'split1', cell=240, h=300)


if __name__ == '__main__':
    main(sys.argv[1])
