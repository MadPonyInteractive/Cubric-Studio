# MPI-1036: run E - Character Swap LoRA + turbo, with a second reference showing her from behind.
# Same graph, seed and clip as run C; only the second picture and the prompt change. Run under the GPU lease.
import json, sys, time, urllib.request

URL = 'http://127.0.0.1:8188'
NAME = 'E_lora_turbo_backref'
# Fabio 2026-10-07: ONE picture, used like a character sheet - the mirror shot shows her front (in the
# mirror) and her back, so it carries the back of her head that the first photo lacked.
PROMPT = ("Replace only the blonde woman dancing in <Video 1> with the character in <Picture 1>. "
          "<Picture 1> shows the character from the front in the mirror and from behind, so use it for her "
          "face, her dark hair in a bun, and the back of her head whenever she turns away; no blonde hair remains. "
          "Keep the replacement character's identity, cat ears, outfit, and art style from <Picture 1>. "
          "Preserve the source video's camera, framing, background, lighting, objects, and all other people. "
          "Match the dancing woman's position, scale, pose, and movement throughout the clip. "
          "Do not show the reference image, the mirror, or its background.")
SWAP = 'minimax-h3\\h3_character_swap_pro4500_1000.safetensors'
TURBO = 'minimax-h3\\minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors'

g = {
    '127': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'minimax_h3_ref2va_pruned_int8_convrot.safetensors', 'weight_dtype': 'default'}},
    '147': {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': ['127', 0], 'lora_name': SWAP, 'strength_model': 1.0}},
    '145': {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': ['147', 0], 'lora_name': TURBO, 'strength_model': 1.0}},
    '128': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen3vl_32b_h3_ultra_uncensored_heretic_int8_convrot.safetensors', 'type': 'minimax', 'device': 'default'}},
    '119': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_video_vae_int8_convrot.safetensors'}},
    '120': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_audio_vae_fp32.safetensors'}},
    '137': {'class_type': 'LoadImage', 'inputs': {'image': 'mpi1036_girl_back_mirror.png'}},
    '139': {'class_type': 'LoadVideo', 'inputs': {'file': 'mpi1036_source_24fps.mp4'}},
    '148': {'class_type': 'GetVideoComponents', 'inputs': {'video': ['139', 0]}},
    '136': {'class_type': 'MiniMaxH3ReferenceToVideo', 'inputs': {
        'clip': ['128', 0], 'vae': ['119', 0], 'audio_vae': ['120', 0], 'prompt': PROMPT,
        'width': 480, 'height': 864, 'length': 124, 'ref_image_size': 'match',
        'ref_images.ref_image_0': ['137', 0],
        'ref_videos.ref_video_0': ['148', 0]}},
    '129': {'class_type': 'RandomNoise', 'inputs': {'noise_seed': 904234}},
    '123': {'class_type': 'KSamplerSelect', 'inputs': {'sampler_name': 'res_multistep'}},
    '124': {'class_type': 'BasicScheduler', 'inputs': {'model': ['147', 0], 'scheduler': 'simple', 'steps': 8, 'denoise': 1.0}},
    '126': {'class_type': 'BasicGuider', 'inputs': {'model': ['145', 0], 'conditioning': ['136', 0]}},
    '125': {'class_type': 'SamplerCustomAdvanced', 'inputs': {'noise': ['129', 0], 'guider': ['126', 0], 'sampler': ['123', 0], 'sigmas': ['124', 0], 'latent_image': ['136', 1]}},
    '122': {'class_type': 'VAEDecode', 'inputs': {'samples': ['125', 0], 'vae': ['119', 0]}},
    '121': {'class_type': 'VAEDecodeAudio', 'inputs': {'samples': ['125', 0], 'vae': ['120', 0]}},
    '92': {'class_type': 'MpiSaveVideo', 'inputs': {'images': ['122', 0], 'audio': ['121', 0], 'fps': 24,
                                                    'filename_prefix': f'mpi1036/{NAME}', 'use_audio': True, 'truncate_to_audio': False}},
}


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


t0 = time.time()
try:
    pid = call('/prompt', {'prompt': g, 'client_id': 'mpi1036-backref'})['prompt_id']
except urllib.error.HTTPError as e:
    print(NAME, 'REJECTED', e.read().decode()[:2000], flush=True)
    sys.exit(1)
print(f'{NAME}: queued {pid}', flush=True)
while True:
    time.sleep(10)
    h = call(f'/history/{pid}')
    if pid in h:
        st = h[pid].get('status', {})
        outs = [f for o in h[pid].get('outputs', {}).values() for k in ('gifs', 'videos', 'images') for f in o.get(k, [])]
        print(f'{NAME}: {st.get("status_str")} in {time.time() - t0:.0f}s ->', [f.get('subfolder', '') + '/' + f['filename'] for f in outs], flush=True)
        sys.exit(0 if st.get('status_str') == 'success' else 1)
