import json, sys
# two_pass.py <api.json from convert.py> <out.json> [turn]   (validation.md "T6", the MPI-1042 A+B fix)
# `turn` = pass 1 forces a three-quarter close-up (batch 13 "H": frontal picture -> 3/4, 12 of 12) instead of
# copying the picture's own turn.
# Pass 1 = the bench graph at 896x1120 (portrait alone; sweep spec sets W/H 896x1120 + the portrait prompts).
# Pass 2 = the body-views half, its own 896x1120 sampling, refs = picture 1 + the finished portrait
# (so it copies the portrait's grey), then [bodies | portrait] stitched. No mask, no shared canvas.
api = json.load(open(sys.argv[1], encoding='utf-8'))
T = {v.get('_meta', {}).get('title'): k for k, v in api.items()}
C = {v['class_type']: k for k, v in api.items()}
dec1, vae, clip, unet, enc1 = C['VAEDecode'], T['Load VAE'], T['Load CLIP'], T['Load Diffusion Model'], T['Encode ref 1']
out, clear = T['Output_Image'], T['free VRAM after the run']
P2 = (
    "The character from image 1, in exactly the same visual style and medium as image 1. The face, head and hair come "
    "only from image 1. A single continuous image containing two full-body standing views of the same character side by "
    "side, of equal width, one seen from the front and one from directly behind, the grey background flowing "
    "continuously behind both, the same character in both views with identical face, hair and wardrobe, arms hanging "
    "loose and relaxed at the sides, hands open and resting against the thighs, feet planted, generous headroom. Plain "
    "smooth grey seamless studio background, exactly the same grey and the same lighting as image 2. Extremely even "
    "frontal illumination, soft open shadows, uniform brightness from edge to edge.")


# pass 1 = the portrait alone on a 4:5 canvas: only there does Klein copy picture 1 unsqueezed and keep its turn
api[T['W_sheet']]['inputs']['int'], api[T['H_sheet']]['inputs']['int'] = 896, 1120
api[T['Prompt_No_Body']]['inputs']['value'] = (
    "The character from image 1, in exactly the same visual style and medium as image 1. [CHARACTER PROMPT]")
api[T['Sheet_Layout']]['inputs']['value'] = (
    "A head and shoulders portrait that keeps the head exactly as it is in image 1, with the same turn, tilt and "
    "expression and the same framing, face sharp and clear, hair fully visible from the crown down. Plain smooth grey "
    "seamless studio background. Extremely even soft illumination, soft open shadows, uniform brightness from edge to edge.")
if sys.argv[3:] == ['turn']:
    api[T['Sheet_Layout']]['inputs']['value'] = (
        "A head and shoulders portrait of exactly the same person as image 1, the head and shoulders turned "
        "three-quarters toward the left side of the image, the face seen at a three-quarter angle with both eyes "
        "visible and the far cheek partly hidden. The face, features, skin, piercings, tattoos, hair, headwear, "
        "expression and clothing stay exactly as in image 1, the same framing, face sharp and clear, the whole head "
        "inside the frame, the hair and headwear exactly as in image 1. Plain smooth grey seamless studio background. "
        "Extremely even soft illumination, soft open shadows, uniform brightness from edge to edge.")


def n(i, cls, inputs, title=''):
    api[str(i)] = {'inputs': inputs, 'class_type': cls, '_meta': {'title': title or cls}}


n(102, 'VAEEncode', {'pixels': [dec1, 0], 'vae': [vae, 0]}, 'Encode portrait')
n(103, 'PrimitiveStringMultiline', {'value': P2}, 'Pass2_Prompt')
n(104, 'CLIPTextEncode', {'clip': [clip, 0], 'text': ['103', 0]}, 'Encode pass 2')
n(105, 'ReferenceLatent', {'conditioning': ['104', 0], 'latent': [enc1, 0]}, 'pass 2 ref 1 = picture 1')
n(106, 'ReferenceLatent', {'conditioning': ['105', 0], 'latent': ['102', 0]}, 'pass 2 ref 2 = portrait')
n(107, 'ConditioningZeroOut', {'conditioning': ['104', 0]})
n(108, 'CFGGuider', {'cfg': 1, 'model': [unet, 0], 'positive': ['106', 0], 'negative': ['107', 0]})
n(109, 'Flux2Scheduler', {'steps': 4, 'width': 896, 'height': 1120})
n(110, 'RandomNoise', {'noise_seed': api[T['RandomNoise']]['inputs']['noise_seed']})
n(118, 'EmptyFlux2LatentImage', {'width': 896, 'height': 1120, 'batch_size': 1})
n(111, 'SamplerCustomAdvanced', {'noise': ['110', 0], 'guider': ['108', 0], 'sampler': [T['KSamplerSelect'], 0],
                                 'sigmas': ['109', 0], 'latent_image': ['118', 0]})
n(112, 'VAEDecode', {'samples': ['111', 0], 'vae': [vae, 0]})
n(101, 'ImageStitch', {'image1': ['112', 0], 'direction': 'right', 'match_image_size': False, 'spacing_width': 0,
                       'spacing_color': 'white', 'image2': [dec1, 0]}, 'sheet [bodies | portrait]')
api[clear]['inputs']['passthrough'] = ['101', 0]
api[out]['inputs']['images'] = [clear, 0]
json.dump(api, open(sys.argv[2], 'w', encoding='utf-8'), indent=1)
print('ok')
