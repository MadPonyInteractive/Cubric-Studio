"""MPI-1086 phase B round 23: the mannequin INSIDE the Qwen graph (Fabio, 2026-10-14) - the shipping shape. r22 (raw
photo as image_2) leaked the photo's make-up onto the front figure (buns s7), so the mannequin stays, but as ONE graph:
Input_Image_2 (the raw photo) -> Klein 9B free edit, string qh19.M4, fixed seed qh16.MSEED, 1 MP -> MpiClearVram ->
TextEncodeQwenImage21 images.image_2. The describer reads the RAW photo (the app describes before the graph runs; r22's
words are reused). Klein half = flow_character_sheet_edit.json's free-edit path (4 steps, lcm, cfg 1, no LoRA).
The mannequin is also saved (h23_man_*) to eye it. usage: qh23.py <out> [only...] ('rate' = s1-s4). Under gpu_lease only.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh16
import qh19
import qh21
import qf2


def mannequin_nodes(g, tag):
    n = {
        '900': ('MpiLoadImage', {'image': 'None', 'channel': 'alpha', 'block_if_empty': True, 'string': ''}, 'Input_Image_2'),
        '901': ('UNETLoader', {'unet_name': 'flux-2-klein-9b-int8-convrot.safetensors', 'weight_dtype': 'default'}, 'Klein 9B'),
        '902': ('CLIPLoader', {'clip_name': 'qwen_3_8b_int8_convrot.safetensors', 'type': 'flux2', 'device': 'default'}, 'Klein CLIP'),
        '903': ('VAELoader', {'vae_name': 'flux2-vae.safetensors'}, 'Klein VAE'),
        '904': ('ImageScaleToTotalPixels', {'upscale_method': 'nearest-exact', 'megapixels': 1, 'resolution_steps': 16,
                                            'image': ['900', 0]}, 'photo to 1 MP'),
        '905': ('VAEEncode', {'pixels': ['904', 0], 'vae': ['903', 0]}, 'encode the photo'),
        '906': ('GetImageSize', {'image': ['904', 0]}, 'photo size'),
        '907': ('CLIPTextEncode', {'clip': ['902', 0], 'text': qh19.M4}, 'mannequin prompt'),
        '908': ('ConditioningZeroOut', {'conditioning': ['907', 0]}, 'negative'),
        '909': ('ReferenceLatent', {'conditioning': ['907', 0], 'latent': ['905', 0]}, 'photo as reference'),
        '910': ('RandomNoise', {'noise_seed': qh16.MSEED}, 'mannequin seed (fixed)'),
        '911': ('KSamplerSelect', {'sampler_name': 'lcm'}, 'sampler'),
        '912': ('CFGGuider', {'model': ['901', 0], 'positive': ['909', 0], 'negative': ['908', 0], 'cfg': 1}, 'guider'),
        '913': ('Flux2Scheduler', {'steps': 4, 'width': ['906', 0], 'height': ['906', 1]}, 'scheduler'),
        '914': ('SamplerCustomAdvanced', {'noise': ['910', 0], 'guider': ['912', 0], 'sampler': ['911', 0],
                                          'sigmas': ['913', 0], 'latent_image': ['905', 0]}, 'mannequin sampler'),
        '915': ('VAEDecode', {'samples': ['914', 0], 'vae': ['903', 0]}, 'the mannequin'),
        '916': ('MpiClearVram', {'passthrough': ['915', 0]}, 'free Klein before Qwen'),
        '917': ('SaveImage', {'images': ['915', 0], 'filename_prefix': f'mpi1086/h23_man_{tag}'}, 'save the mannequin'),
    }
    for k, (ct, ins, title) in n.items():
        g[k] = {'class_type': ct, 'inputs': ins, '_meta': {'title': title}}
    g['30']['inputs']['images.image_2'] = ['916', 0]
    return g


def graph(out, tag):
    g = json.load(open(qh21.QAPI, encoding='utf-8'))
    p = f'{out}/h23_api_{tag}.json'
    json.dump(mannequin_nodes(g, tag), open(p, 'w', encoding='utf-8'), indent=1)
    return p


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    desc = json.load(open(f'{out}/h22_describe.json', encoding='utf-8'))
    cases = [(s, t, seed) for s in 'MBW' for t, seed in qh1.SEEDS[1:]]
    if 'rate' in only:
        cases = [(s, f's{n}', n) for s in 'MBW' for n in (1, 2, 3, 4)]
        only = [o for o in only if o != 'rate']
    for s, t, seed in cases:
        tag = f'h23_{s}_{t}'
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        ref = qh16.SHEETS[s][2]
        prompt = qh21.q1(desc[ref].strip().rstrip('.'))
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': graph(out, tag), 'set': {
            'Input_Image': {'string': qh16.SHEETS[s][0]}, 'Input_Image_2': {'string': ref},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}}}], tag)
