# MPI-1036: background modes, after run E. Same clip, seed, turbo and 480x864 as C/D/E. Run under the GPU lease.
# F - swap the person AND take the photo's room (the clip is only the motion guide), LoRA off: it was trained
#     to keep the SOURCE scene, which is the opposite of what F asks.
# G - keep the dancer, replace only the background with the photo's room, LoRA off (it would swap her).
import json, sys, time, urllib.request

URL = 'http://127.0.0.1:8188'
# Prompts follow the H3 r2v recipe shape (js/data/recipes/minimax-h3.recipe.js, r2v): look line, one reference
# line giving every asset a job (and banning what a content reference must NOT supply), ONE [Shot 1], camera
# line, overall_soundscape, non_diegetic_music, constraint line last. Fabio 2026-10-07: wherever the picture
# supplies the look, the clip is ONLY a reference - otherwise its poor quality carries into the result.
TAIL = ("overall_soundscape: {room}, her feet on the floor, the soft swish of fabric as she turns.\n"
        "non_diegetic_music: An upbeat pop track at a fast dance tempo that her moves land on.\n"
        "No text, subtitles, captions, usernames, logos or watermarks, no blur, no compression artefacts, "
        "no phone-video look, no warped anatomy, no flicker.")
DANCE = ("she crosses her arms over her chest, flicks her hands out beside her face, sways her hips side to side, "
         "spins a full turn so her back faces the camera, runs both hands up through her hair, and turns back to "
         "the lens as the clip ends")
RUNS = {
    # one picture, the character-sheet-like mirror shot (Fabio 2026-10-07), so the room is its bathroom
    'F_photo_bg': (False, ['mpi1036_girl_back_mirror.png'],
                   "A young woman with pink-lined cat ears and a dark messy bun dances in a bright white bathroom: "
                   "clean daylight, soft pink and white palette, sharp photographic detail, playful mood.\n"
                   "Use <Picture 1> as the woman, her face, freckles, hair, cat ears, paw gloves, pink skull sweater and "
                   "art style, seen from the front in the mirror and from behind, and as the location, its marble counter, "
                   "white tiles and soft daylight, without taking its composition, its camera angle or its mirror; use "
                   "<Video 1> only as the choreography, every move and its timing, and its camera framing, and take "
                   "nothing else from it, not its room, its dancer's looks, its image quality, its grade or its text.\n"
                   f"[Shot 1] The woman from <Picture 1> faces the camera in the bathroom of <Picture 1> and dances the "
                   f"routine of <Video 1> move for move: {DANCE}. Her sweater swings with each turn and the paw gloves stay "
                   "on her hands.\n"
                   "The camera holds still at chest height throughout, framing her from the thighs up as <Video 1> does.\n"
                   + TAIL.format(room='A small tiled bathroom room tone')),
    'G_bg_only': (False, ['mpi1036_girl_with_cat.png'],
                  "A blonde woman in a black T-shirt and teal shorts dances in a bright bedroom: soft cool daylight, "
                  "white and pastel palette, sharp photographic detail, playful mood.\n"
                  "Use <Video 1> as the woman and her whole performance, her face, blonde hair, black T-shirt, teal "
                  "shorts, every move and its timing, and as the camera framing, kept exactly as it is; use <Picture 1> "
                  "only as the location, its white bed, vanity and window blinds and its soft daylight, without taking "
                  "its composition, its camera angle, its grade or the girl in it.\n"
                  f"[Shot 1] The woman from <Video 1> dances exactly as she does in <Video 1>, move for move: {DANCE}. "
                  "The room around her is now the bedroom of <Picture 1>, the bed and blinds behind her, and its window "
                  "light falls softly across her face and arms.\n"
                  "The camera holds still throughout, framing her exactly as <Video 1> does.\n"
                  + TAIL.format(room='A quiet bedroom room tone')),
}
# Fabio 2026-10-07: feed the clip as line art or a depth map, so its picture quality has nothing to carry.
F_REF = ("use <Video 1> only as the choreography, every move and its timing, and its camera framing, and take "
         "nothing else from it, not its room, its dancer's looks, its image quality, its grade or its text.")
PRE = {
    'F_depth': {'class_type': 'DepthAnythingV2Preprocessor', 'inputs': {'ckpt_name': 'depth_anything_v2_vitl.pth', 'resolution': 1024}},
    'F_lineart': {'class_type': 'LineartStandardPreprocessor', 'inputs': {'guassian_sigma': 6.0, 'intensity_threshold': 8, 'resolution': 1024}},
}
for _name, _what in (('F_depth', 'a greyscale depth map of a dancer'), ('F_lineart', 'a black-and-white line drawing of a dancer')):
    _lora, _imgs, _p = RUNS['F_photo_bg']
    assert F_REF in _p
    RUNS[_name] = (_lora, _imgs, _p.replace(F_REF, f"<Video 1> is {_what}: {F_REF}"))
# run order after E: the three F inputs side by side, then G
RUNS = {k: RUNS[k] for k in ('F_photo_bg', 'F_depth', 'F_lineart', 'G_bg_only')}
# 576x1024 for this batch (C/D/A/E ran at 480x864): Fabio asked about size; the clip is staged to match
W, H, CLIP = 576, 1024, 'mpi1036_source_24fps_576.mp4'
SWAP = 'minimax-h3\\h3_character_swap_pro4500_1000.safetensors'
TURBO = 'minimax-h3\\minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors'


def graph(name, lora, images, prompt):
    g = {
        '127': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'minimax_h3_ref2va_pruned_int8_convrot.safetensors', 'weight_dtype': 'default'}},
        '128': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen3vl_32b_h3_ultra_uncensored_heretic_int8_convrot.safetensors', 'type': 'minimax', 'device': 'default'}},
        '119': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_video_vae_int8_convrot.safetensors'}},
        '120': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_audio_vae_fp32.safetensors'}},
        '139': {'class_type': 'LoadVideo', 'inputs': {'file': CLIP}},
        '148': {'class_type': 'GetVideoComponents', 'inputs': {'video': ['139', 0]}},
        '129': {'class_type': 'RandomNoise', 'inputs': {'noise_seed': 904234}},
        '123': {'class_type': 'KSamplerSelect', 'inputs': {'sampler_name': 'res_multistep'}},
    }
    cond = {'clip': ['128', 0], 'vae': ['119', 0], 'audio_vae': ['120', 0], 'prompt': prompt,
            'width': W, 'height': H, 'length': 124, 'ref_image_size': 'match', 'ref_videos.ref_video_0': ['148', 0]}
    if name in PRE:  # the clip reaches H3 as depth / line art, never as its own pixels
        g['150'] = {'class_type': PRE[name]['class_type'], 'inputs': {**PRE[name]['inputs'], 'image': ['148', 0]}}
        g['151'] = {'class_type': 'MpiSaveVideo', 'inputs': {'images': ['150', 0], 'fps': 24, 'filename_prefix': f'mpi1036/{name}_input'}}
        cond['ref_videos.ref_video_0'] = ['150', 0]
    for i, img in enumerate(images):
        g[f'20{i}'] = {'class_type': 'LoadImage', 'inputs': {'image': img}}
        cond[f'ref_images.ref_image_{i}'] = [f'20{i}', 0]
    g['136'] = {'class_type': 'MiniMaxH3ReferenceToVideo', 'inputs': cond}
    base = '127'
    if lora:
        g['147'] = {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': ['127', 0], 'lora_name': SWAP, 'strength_model': 1.0}}
        base = '147'
    g['145'] = {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': [base, 0], 'lora_name': TURBO, 'strength_model': 1.0}}
    g['124'] = {'class_type': 'BasicScheduler', 'inputs': {'model': [base, 0], 'scheduler': 'simple', 'steps': 8, 'denoise': 1.0}}
    g['126'] = {'class_type': 'BasicGuider', 'inputs': {'model': ['145', 0], 'conditioning': ['136', 0]}}
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


for name in (sys.argv[1:] or RUNS):
    t0 = time.time()
    try:
        pid = call('/prompt', {'prompt': graph(name, *RUNS[name]), 'client_id': 'mpi1036-modes'})['prompt_id']
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
                sys.exit(1)
            break
print('ALL DONE', flush=True)
