"""MPI-1060: bench-test Lightricks' LTX-2.3 Ingredients IC-LoRA (reference-sheet -> video) on OUR shipped int8 stack.

The graph is the official ComfyUI-LTXVideo example
(example_workflows/2.3/LTX-2.3_ICLoRA_Ingredients_Single_Stage_Distilled.json, pinned commit 3b9c5cd) with its loaders
swapped for the ones comfy_workflows/ltx_i2v_t2v_int8.json ships:
  dev checkpoint + distilled LoRA 0.5  ->  ltx-2.3-22b-distilled-1.1 int8 transformer (UNETLoader)
  full Gemma 3 (LTXAVTextEncoderLoader) ->  gemma_3_12B_it_fp4_mixed + ltx-2.3 text projection (DualCLIPLoader, ltxv)
  checkpoint VAE / audio VAE           ->  LTX23_video_vae_bf16 (VAELoader) + LTX23_audio_vae_bf16 (VAELoaderKJ)
Everything else is the example's: the sheet becomes a static video (RepeatImageBatch to the clip length), fed as a
full-clip IC-LoRA guide (LTXAddVideoICLoRAGuide, strength 1, downscale factor from the loader), 8 distilled sigmas,
euler_ancestral_cfg_pp, CFG 1, guides cropped off before the tiled decode.

Combination switches per case (each mirrors how the SHIPPED graph does it, so a pass here means the branch composes):
  fit='pad'    the sheet is letterboxed in black to the output size (ImageResizeKJv2 pad) instead of center-cropped
  start=<img>  start frame: LTXVImgToVideoInplace on the empty latent BEFORE the IC guide (shipped i2v node)
  audio_in=<wav>  supplied audio kept in the AV latent: LTXVAudioVAEEncode -> SetLatentNoiseMask(SolidMask 1-influence)
  idlora=<wav> voice clone: talkvid ID-LoRA after the Ingredients LoRA + LTXVReferenceAudio (scale 1.5), audio generated
  ref_video=<mp4>  a real VIDEO as the IC guide instead of a repeated still (first `frames` frames)

usage (repo root, bench :8188 up, ONLY under the lease):
  python <mpi-lib>/scripts/gpu_lease.py run --timeout 3600 --poll 2 -- "C:/Program Files/Python314/python.exe" -I <this file> <case> [<case> ...]
cases: see CASES below. Each saves C:/AI/MPI-1060-out/<case>.mp4 and prints the run time.
"""
import json, os, sys, time, urllib.parse, urllib.request

URL = 'http://127.0.0.1:8188'
OUT = 'C:/AI/MPI-1060-out'
EXAMPLE = 'G:/ComfyUi/ComfyUI/custom_nodes/ComfyUI-LTXVideo/example_workflows/2.3/LTX-2.3_ICLoRA_Ingredients_Single_Stage_Distilled.json'
LORA = 'LTX2.3\\ltx-2.3-22b-ic-lora-ingredients-0.9.safetensors'
IDLORA = 'LTX2.3\\id-lora-talkvid\\ltx-2.3-id-lora-talkvid-3k.safetensors'
NEG = 'pc game, console game, video game, cartoon, childish, ugly'  # the example's own negative


def example_prompt():
    g = json.load(open(EXAMPLE, encoding='utf-8'))
    return next(n for n in g['nodes'] if n['id'] == 2483)['widgets_values'][0]


WOMAN = (
    "### Reference Sheet Description\n"
    "**Left Panel (Character - Front View):** A woman in her late thirties with shoulder-length wavy copper-red hair and a light dusting of freckles. "
    "She wears an olive-green cotton utility jacket with chest pockets, open over a mustard-yellow ribbed knit sweater, olive-green straight-leg trousers "
    "and brown leather lace-up boots.\n"
    "**Middle Panel (Character - Back View):** The same woman seen from behind: wavy copper-red hair to the shoulders, olive-green utility jacket and "
    "trousers, brown boots.\n"
    "**Right Panel (Character - Close-up):** A close-up of her face: green eyes, freckles across the nose and cheeks, a warm closed-mouth smile, "
    "copper-red waves framing her face, the olive jacket collar over the mustard sweater.\n"
    "### Target Description\n")
WOMAN_CAFE = WOMAN + (
    "a warm, naturalistic medium shot inside a small city cafe on a sunny morning. the woman with wavy copper-red hair and freckles, wearing her "
    "olive-green utility jacket over a mustard-yellow sweater, sits at a wooden table by the big street window, both hands wrapped around a "
    "cream ceramic mug of coffee. she turns from the window toward someone just off camera, her face softening into a smile, and says in a gentle, "
    "slightly amused voice: \"I knew you'd come back.\" she sets the mug down and leans back in her chair, tucking a strand of hair behind her ear. "
    "the camera is handheld and slowly pushes in toward her face. low golden sunlight from the window rims her hair, the street outside is soft "
    "and out of focus. the audio is clear and intimate: her soft voice, quiet cafe murmur and the clink of a mug on the table, no background music.")
WOMAN_SPEAKS = WOMAN + (
    "a naturalistic medium close-up on a quiet city street in soft afternoon light. the woman with wavy copper-red hair and freckles, in her "
    "olive-green utility jacket over a mustard-yellow sweater, stands facing the camera and speaks directly to it in a tired but gentle voice, "
    "her lips moving clearly with every word, small nods as she talks. the camera is steady on a tripod. the audio is her voice only, clear and close.")
FISHER = (
    "### Reference Sheet Description\n"
    "**Left Panel (Character - Front View):** A stylised 3D animated old fisherman with a big round red nose, rosy cheeks, bushy white eyebrows "
    "and a long fluffy white beard. He wears a red knitted beanie, a mustard-yellow wool suit jacket with brown buttons and flap pockets, matching "
    "mustard trousers and brown leather shoes.\n"
    "**Middle Panel (Character - Back View):** The same fisherman from behind: red beanie, white hair at the nape, mustard-yellow jacket and "
    "trousers, brown shoes.\n"
    "**Right Panel (Character - Close-up):** A close-up of his face: big round nose, warm brown eyes glancing to the side, deep smile lines, "
    "white moustache and beard, red ribbed beanie.\n"
    "### Target Description\n"
    "a charming 3D animated film scene. the old fisherman with the red beanie, big round nose and long white beard, in his mustard-yellow suit, "
    "stands at the end of a weathered wooden pier at sunset holding a fishing rod. the line tugs; he leans back laughing and reels in, then holds up "
    "a small silver fish and says cheerfully: \"Well, look at you, little one!\" gulls circle overhead and gentle waves lap the posts. the camera "
    "slowly orbits from his side to the front. warm golden sunset light, soft pastel sky, stylised animated-feature rendering. the audio features "
    "his hearty, gravelly voice, the click of the reel, seagulls and soft waves, no background music.")

WS = 'mpi1042art_cafe2_sheet.png'
# sheet = a file in the bench input folder. w/h = output size (the reference is fed at the SAME size, factor 1).
CASES = {
    # the trained bucket (768x448, 121 frames, 24 fps) on Lightricks' own sheet and prompt
    'ex_bucket': dict(sheet='mpi1060_ingredients_example.jpg', w=768, h=448, frames=121, prompt=example_prompt, seed=42),
    # the example's own settings: shorter side 544, 241 frames
    'ex_official': dict(sheet='mpi1060_ingredients_example.jpg', w=960, h=544, frames=241, prompt=example_prompt, seed=42),
    # OUR sheets (MPI-1041 3-panel character sheets, grey background), letterboxed in black to 960x544, 5 s
    'own_woman': dict(sheet=WS, fit='pad', w=960, h=544, frames=121, prompt=WOMAN_CAFE, seed=42),
    'own_fisher': dict(sheet='mpi1042art_fisher_sheet.png', fit='pad', w=960, h=544, frames=121, prompt=FISHER, seed=42),
    # combinations with the shipped graph's other inputs
    'combo_start': dict(sheet=WS, fit='pad', w=960, h=544, frames=121, prompt=WOMAN_CAFE, seed=42, start='mpi1042art_cafe2.png'),
    'combo_audio': dict(sheet=WS, fit='pad', w=960, h=544, frames=121, prompt=WOMAN_SPEAKS, seed=42, audio_in='mpi1060_voice.wav', influence=0.9),
    'combo_idlora': dict(sheet=WS, fit='pad', w=960, h=544, frames=121, prompt=WOMAN_CAFE, seed=42, idlora='mpi1060_voice.wav'),
    # a moving reference: Lightricks' example clip as the guide (new seed) -> does the output follow the video's content/motion?
    'ref_video': dict(ref_video='mpi1060_refvideo.mp4', w=960, h=544, frames=121, prompt=example_prompt, seed=7),  # = ex_official.mp4, LoadVideo takes input-folder names only
}


def graph(c):
    L = lambda nid, slot=0: [str(nid), slot]
    W, H, F = c['w'], c['h'], c['frames']
    p = c['prompt']() if callable(c['prompt']) else c['prompt']
    n = {
        1: ('UNETLoader', {'unet_name': 'ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors', 'weight_dtype': 'default'}),
        2: ('DualCLIPLoader', {'clip_name1': 'gemma_3_12B_it_fp4_mixed.safetensors', 'clip_name2': 'ltx-2.3_text_projection_bf16.safetensors', 'type': 'ltxv', 'device': 'default'}),
        3: ('VAELoader', {'vae_name': 'LTX23_video_vae_bf16.safetensors'}),
        4: ('VAELoaderKJ', {'vae_name': 'LTX23_audio_vae_bf16.safetensors', 'device': 'main_device', 'weight_dtype': 'bf16'}),
        5: ('LTXICLoRALoaderModelOnly', {'model': L(1), 'lora_name': LORA, 'strength_model': 1.0}),
        9: ('CLIPTextEncode', {'clip': L(2), 'text': p}),
        10: ('CLIPTextEncode', {'clip': L(2), 'text': NEG}),
        11: ('LTXVConditioning', {'positive': L(9), 'negative': L(10), 'frame_rate': 24}),
        12: ('EmptyLTXVLatentVideo', {'width': W, 'height': H, 'length': F, 'batch_size': 1}),
        16: ('RandomNoise', {'noise_seed': c['seed']}),
        17: ('KSamplerSelect', {'sampler_name': 'euler_ancestral_cfg_pp'}),
        18: ('ManualSigmas', {'sigmas': '1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0'}),
        21: ('LTXVSeparateAVLatent', {'av_latent': L(20)}),
        23: ('LTXVTiledVAEDecode', {'vae': L(3), 'latents': L(22, 2), 'horizontal_tiles': 2, 'vertical_tiles': 2, 'overlap': 6, 'last_frame_fix': False}),
        24: ('LTXVAudioVAEDecode', {'samples': L(21, 1), 'audio_vae': L(4)}),
        25: ('MpiSaveVideo', {'images': L(23), 'fps': 24, 'filename_prefix': 'mpi1060', 'audio': L(24)}),
    }
    # --- the guide: a still sheet repeated to the clip length, or a real video
    if c.get('ref_video'):
        n[6] = ('LoadVideo', {'file': c['ref_video']})
        n[61] = ('GetVideoComponents', {'video': L(6)})
        n[62] = ('ImageFromBatch', {'image': L(61), 'batch_index': 0, 'length': F})
        n[8] = ('ImageScale', {'image': L(62), 'upscale_method': 'lanczos', 'width': W, 'height': H, 'crop': 'center'})
    else:
        n[6] = ('LoadImage', {'image': c['sheet']})
        if c.get('fit') == 'pad':
            n[7] = ('ImageResizeKJv2', {'image': L(6), 'width': W, 'height': H, 'upscale_method': 'lanczos', 'keep_proportion': 'pad',
                                        'pad_color': '0, 0, 0', 'crop_position': 'center', 'divisible_by': 32})
        else:
            n[7] = ('ImageScale', {'image': L(6), 'upscale_method': 'lanczos', 'width': W, 'height': H, 'crop': 'center'})
        n[8] = ('RepeatImageBatch', {'image': L(7), 'amount': F})
    # --- start frame (shipped i2v node) on the empty latent, before the IC guide
    latent = L(12)
    if c.get('start'):
        n[30] = ('LoadImage', {'image': c['start']})
        n[31] = ('ImageResizeKJv2', {'image': L(30), 'width': W, 'height': H, 'upscale_method': 'lanczos', 'keep_proportion': 'crop',
                                     'pad_color': '0, 0, 0', 'crop_position': 'center', 'divisible_by': 32})
        n[32] = ('LTXVPreprocess', {'image': L(31), 'img_compression': 18})
        n[33] = ('LTXVImgToVideoInplace', {'vae': L(3), 'image': L(32), 'latent': L(12), 'strength': 1.0, 'bypass': False})
        latent = L(33)
    n[13] = ('LTXAddVideoICLoRAGuide', {'positive': L(11, 0), 'negative': L(11, 1), 'vae': L(3), 'latent': latent, 'image': L(8),
                                        'frame_idx': 0, 'strength': 1.0, 'latent_downscale_factor': L(5, 1), 'crop': 'disabled',
                                        'use_tiled_encode': False, 'tile_size': 256, 'tile_overlap': 64})
    # --- audio latent: empty, or the supplied audio kept by a noise mask (shipped Input_Audio path)
    if c.get('audio_in'):
        n[40] = ('LoadAudio', {'audio': c['audio_in']})
        n[41] = ('LTXVAudioVAEEncode', {'audio': L(40), 'audio_vae': L(4)})
        n[42] = ('SolidMask', {'value': round(1 - c.get('influence', 0.9), 4), 'width': W, 'height': H})
        n[14] = ('SetLatentNoiseMask', {'samples': L(41), 'mask': L(42)})
    else:
        n[14] = ('LTXVEmptyLatentAudio', {'audio_vae': L(4), 'frames_number': F, 'frame_rate': 24, 'batch_size': 1})
    n[15] = ('LTXVConcatAVLatent', {'video_latent': L(13, 2), 'audio_latent': L(14)})
    # --- guider: plain, or ID-LoRA voice reference (shipped Input_Use_Reference_Audio path)
    if c.get('idlora'):
        n[50] = ('MpiLoraModel', {'model': L(5), 'lora_name': IDLORA, 'strength_model': 1.0})
        n[51] = ('LoadAudio', {'audio': c['idlora']})
        n[52] = ('LTXVReferenceAudio', {'model': L(50), 'positive': L(13, 0), 'negative': L(13, 1), 'reference_audio': L(51),
                                        'audio_vae': L(4), 'identity_guidance_scale': 1.5, 'start_percent': 0.0, 'end_percent': 1.0})
        n[19] = ('CFGGuider', {'model': L(52, 0), 'positive': L(52, 1), 'negative': L(52, 2), 'cfg': 1})
        crop_pos, crop_neg = L(52, 1), L(52, 2)
    else:
        n[19] = ('CFGGuider', {'model': L(5), 'positive': L(13, 0), 'negative': L(13, 1), 'cfg': 1})
        crop_pos, crop_neg = L(13, 0), L(13, 1)
    n[20] = ('SamplerCustomAdvanced', {'noise': L(16), 'guider': L(19), 'sampler': L(17), 'sigmas': L(18), 'latent_image': L(15)})
    n[22] = ('LTXVCropGuides', {'positive': crop_pos, 'negative': crop_neg, 'latent': L(21, 0)})
    return {str(k): {'class_type': t, 'inputs': i, '_meta': {'title': t}} for k, (t, i) in n.items()}


def run(tag):
    body = json.dumps({'prompt': graph(CASES[tag]), 'client_id': 'mpi1060'}).encode()
    try:
        res = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})))
    except urllib.error.HTTPError as e:
        print(tag, 'REJECTED', e.read().decode()[:2000], flush=True)
        return
    pid, t0 = res['prompt_id'], time.time()
    while True:
        time.sleep(5)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            break
    st = h[pid].get('status', {})
    saved = []
    for item in (v for out in h[pid]['outputs'].values() for lst in out.values() if isinstance(lst, list) for v in lst):
        if isinstance(item, dict) and item.get('filename', '').endswith(('.mp4', '.webm')):
            q = urllib.parse.urlencode({'filename': item['filename'], 'subfolder': item.get('subfolder', ''), 'type': item.get('type', 'output')})
            dest = f'{OUT}/{tag}.mp4'
            urllib.request.urlretrieve(f'{URL}/view?{q}', dest)
            saved.append(dest)
    print(tag, st.get('status_str'), '%.0fs' % (time.time() - t0), saved or json.dumps(st)[-2000:], flush=True)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for t in sys.argv[1:]:
        run(t)
