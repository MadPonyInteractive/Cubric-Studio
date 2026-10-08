# MPI-1036 Phase 1: Character Swap LoRA A/B on the bench (:8188), akatz-ai's graph rebuilt in API form.
# Run under the GPU lease. Order: turbo pair first (fast, our shipping config), then the 20-step pair.
import json, sys, time, urllib.request

URL = 'http://127.0.0.1:8188'
SEED = 904234
PROMPT = ("Replace only the blonde woman dancing in <Video 1> with the character in <Picture 1>. "
          "Keep the replacement character's identity, outfit, and art style from <Picture 1>. "
          "Preserve the source video's camera, framing, background, lighting, objects, and all other people. "
          "Match the dancing woman's position, scale, pose, and movement throughout the clip. "
          "Do not show the reference sheet or its background.")
SWAP = 'minimax-h3\\h3_character_swap_pro4500_1000.safetensors'
TURBO = 'minimax-h3\\minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors'

RUNS = [  # (name, swap_lora, turbo)
    ('C_lora_turbo', True, True),
    ('D_base_turbo', False, True),
    ('A_lora_20step', True, False),
    ('B_base_20step', False, False),
]
if len(sys.argv) > 1:
    RUNS = [r for r in RUNS if r[0] in sys.argv[1:]]


def graph(name, lora, turbo):
    g = {
        '127': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'minimax_h3_ref2va_pruned_int8_convrot.safetensors', 'weight_dtype': 'default'}},
        '128': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen3vl_32b_h3_ultra_uncensored_heretic_int8_convrot.safetensors', 'type': 'minimax', 'device': 'default'}},
        '119': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_video_vae_int8_convrot.safetensors'}},
        '120': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_audio_vae_fp32.safetensors'}},
        '137': {'class_type': 'LoadImage', 'inputs': {'image': 'mpi1036_girl_with_cat.png'}},
        '139': {'class_type': 'LoadVideo', 'inputs': {'file': 'mpi1036_source_24fps.mp4'}},
        '148': {'class_type': 'GetVideoComponents', 'inputs': {'video': ['139', 0]}},
        '136': {'class_type': 'MiniMaxH3ReferenceToVideo', 'inputs': {
            'clip': ['128', 0], 'vae': ['119', 0], 'audio_vae': ['120', 0], 'prompt': PROMPT,
            'width': 480, 'height': 864, 'length': 124, 'ref_image_size': 'match',
            'ref_images.ref_image_0': ['137', 0], 'ref_videos.ref_video_0': ['148', 0]}},
        '129': {'class_type': 'RandomNoise', 'inputs': {'noise_seed': SEED}},
        '123': {'class_type': 'KSamplerSelect', 'inputs': {'sampler_name': 'res_multistep'}},
    }
    base = '127'
    if lora:
        g['147'] = {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': ['127', 0], 'lora_name': SWAP, 'strength_model': 1.0}}
        base = '147'
    final = base
    if turbo:
        g['145'] = {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': [base, 0], 'lora_name': TURBO, 'strength_model': 1.0}}
        final = '145'
    g['124'] = {'class_type': 'BasicScheduler', 'inputs': {'model': [base, 0], 'scheduler': 'simple', 'steps': 8 if turbo else 20, 'denoise': 1.0}}
    g['126'] = {'class_type': 'BasicGuider', 'inputs': {'model': [final, 0], 'conditioning': ['136', 0]}}
    g['125'] = {'class_type': 'SamplerCustomAdvanced', 'inputs': {'noise': ['129', 0], 'guider': ['126', 0], 'sampler': ['123', 0], 'sigmas': ['124', 0], 'latent_image': ['136', 1]}}
    g['122'] = {'class_type': 'VAEDecode', 'inputs': {'samples': ['125', 0], 'vae': ['119', 0]}}
    g['121'] = {'class_type': 'VAEDecodeAudio', 'inputs': {'samples': ['125', 0], 'vae': ['120', 0]}}
    g['92'] = {'class_type': 'MpiSaveVideo', 'inputs': {'images': ['122', 0], 'audio': ['121', 0], 'fps': 24,
                                                        'filename_prefix': f'mpi1036/{name}', 'use_audio': True, 'truncate_to_audio': False}}
    return g


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


for name, lora, turbo in RUNS:
    t0 = time.time()
    try:
        pid = call('/prompt', {'prompt': graph(name, lora, turbo), 'client_id': 'mpi1036-ab'})['prompt_id']
    except urllib.error.HTTPError as e:
        print(name, 'REJECTED', e.read().decode()[:2000], flush=True)
        sys.exit(1)
    print(f'{name}: queued {pid}', flush=True)
    while True:
        time.sleep(10)
        h = call(f'/history/{pid}')
        if pid in h:
            st = h[pid].get('status', {})
            outs = [f for o in h[pid].get('outputs', {}).values() for k in ('gifs', 'videos', 'images') for f in o.get(k, [])]
            print(f'{name}: {st.get("status_str")} in {time.time() - t0:.0f}s ->', [f.get('subfolder', '') + '/' + f['filename'] for f in outs], flush=True)
            if st.get('status_str') != 'success':
                print(json.dumps(st.get('messages', []))[-3000:], flush=True)
                sys.exit(1)
            break
print('ALL DONE', flush=True)
