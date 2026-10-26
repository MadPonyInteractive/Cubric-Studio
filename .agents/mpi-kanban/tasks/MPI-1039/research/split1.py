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


def qwen_graph(prompt, tag):
    g = {
        '1': ('UNETLoader', {'unet_name': 'qwen_image_edit_2511_int8_convrot.safetensors', 'weight_dtype': 'default'}),
        '2': ('LoraLoaderModelOnly', {'model': ['1', 0], 'strength_model': 1.0,
                                      'lora_name': 'qwen\\Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors'}),
        '3': ('LoraLoaderModelOnly', {'model': ['2', 0], 'strength_model': 0.9,
                                      'lora_name': 'qwen\\qwen-image-edit-2511-multiple-angles-lora.safetensors'}),
        '4': ('ModelSamplingAuraFlow', {'model': ['3', 0], 'shift': 2.5}),
        '5': ('CFGNorm', {'model': ['4', 0], 'strength': 1.0}),
        '6': ('CLIPLoader', {'clip_name': 'qwen_2.5_vl_7b_fp8_scaled.safetensors', 'type': 'qwen_image', 'device': 'default'}),
        '7': ('VAELoader', {'vae_name': 'qwen_image_vae.safetensors'}),
        '8': ('LoadImage', {'image': 'mpi1039_split_person.png'}),
        '9': ('TextEncodeQwenImageEditPlus', {'clip': ['6', 0], 'vae': ['7', 0], 'image1': ['8', 0], 'prompt': prompt}),
        '10': ('TextEncodeQwenImageEditPlus', {'clip': ['6', 0], 'vae': ['7', 0], 'image1': ['8', 0], 'prompt': ''}),
        '11': ('VAEEncode', {'pixels': ['8', 0], 'vae': ['7', 0]}),
        '12': ('CFGGuider', {'model': ['5', 0], 'positive': ['9', 0], 'negative': ['10', 0], 'cfg': 1.0}),
        '13': ('KSamplerSelect', {'sampler_name': 'euler'}),
        '14': ('RandomNoise', {'noise_seed': SEED}),
        '15': ('DisableNoise', {}),
    }
    prev, chunks = ['11', 0], [(0, 2), (2, 3), (3, 4)]
    for i, (lo, hi) in enumerate(chunks):
        sid, nid = f'2{i}', f'3{i}'
        g[sid] = ('ManualSigmas', {'sigmas': ', '.join(str(x) for x in Q_SIG[lo:hi + 1])})
        g[nid] = ('SamplerCustomAdvanced', {'noise': ['14' if i == 0 else '15', 0], 'guider': ['12', 0],
                                            'sampler': ['13', 0], 'sigmas': [sid, 0], 'latent_image': prev})
        prev = [nid, 0]
        if hi < 4:
            g[f'4{i}'] = ('SaveLatent', {'samples': prev, 'filename_prefix': f'latents/mpi1039_split_{tag}_k{hi}'})
    g['50'] = ('VAEDecode', {'samples': prev, 'vae': ['7', 0]})
    g['51'] = ('SaveImage', {'images': ['50', 0], 'filename_prefix': f'mpi1039_split/{tag}_qwen'})
    return {k: {'class_type': c, 'inputs': i} for k, (c, i) in g.items()}


def krea_graph(latent_file, k, mode, tag):
    sig = krea_sigmas(Q_SIG[k], 6 if k == 2 else 4)
    g = {
        '1': ('UNETLoader', {'unet_name': 'lustify-v10-krea-raw-int8_convrot.safetensors', 'weight_dtype': 'default'}),
        '6': ('CLIPLoader', {'clip_name': 'qwen3vl_4b_abliterated_fp8_scaled.safetensors', 'type': 'krea2', 'device': 'default'}),
        '7': ('VAELoader', {'vae_name': 'qwen_image_vae.safetensors'}),
        '8': ('LoadImage', {'image': 'mpi1039_split_person.png'}),
        '9': ('LoadImage', {'image': 'mpi1039_split_outfit.png'}),
        '11': ('LoadLatent', {'latent': latent_file}),
        '13': ('KSamplerSelect', {'sampler_name': 'euler'}),
        '15': ('DisableNoise', {}),
        '16': ('ManualSigmas', {'sigmas': ', '.join(str(x) for x in sig)}),
    }
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
    g['4'] = ('LoraLoaderModelOnly', {'model': model, 'strength_model': 1.0,
                                     'lora_name': 'krea-2\\extra\\krea2_turbo_distill_r128.safetensors'})
    g['12'] = ('CFGGuider', {'model': ['4', 0], 'positive': ['20', 0], 'negative': ['21', 0], 'cfg': 1.0})
    g['40'] = ('SamplerCustomAdvanced', {'noise': ['15', 0], 'guider': ['12', 0], 'sampler': ['13', 0],
                                         'sigmas': ['16', 0], 'latent_image': ['11', 0]})
    g['50'] = ('VAEDecode', {'samples': ['40', 0], 'vae': ['7', 0]})
    g['51'] = ('SaveImage', {'images': ['50', 0], 'filename_prefix': f'mpi1039_split/{tag}_k{k}_{mode}'})
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
