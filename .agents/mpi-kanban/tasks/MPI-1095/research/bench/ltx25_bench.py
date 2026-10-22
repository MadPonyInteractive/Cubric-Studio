"""MPI-1095 stage-1 bench: LTX 2.3 vs 2.5 on the SHIPPED graph, only the loaders re-pointed.

Graph: comfy_workflows/ltx_i2v_t2v_int8.json (the runtime split of raw/ltx_i2v_t2v_template.json), driven at API
level with the app's own title-keyed injections, full single run (is_preview / is_continue false).
Variants:
  23    the file untouched (fast card today)
  25    2.5 int8 transformer, Gemma 4 int8 (projection bundled -> CLIPLoader replaces DualCLIPLoader, the only
        node-type change 2.5 forces), 2.5 conv video VAE, 2.5 audio VAE, 2.5 spatial x2 upscaler, 2.5 Ingredients.
        The baked 2.3 LoRAs (merged / transition / talkvid) and the taeltx2_3 preview stay as shipped.
  25d   25 with the diffusion ("DFR") video VAE instead of the conv one
  25bare 25 with the merged 2.3 LoRA at strength 0 (is the merge doing anything on 2.5?)

usage (repo root, bench :8188 up, ONLY under the lease):
  python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Python314/python.exe" -I <this> 23:t2v 25:t2v ...
  python -I <this> --check          build every case offline, no POST
  python -I <this> --sbs t2v ...    hstack 23|25 into a VP9 webm for Fabio's eye
"""
import json, os, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../../..'))
sys.path.insert(0, os.path.join(REPO, '.agents/mpi-kanban/tasks/MPI-1060/research/bench-tools'))
from ingredients_run import WOMAN_CAFE  # noqa: E402  (MPI-1060's sheet prompt, so ref2v compares with that bench)

URL = 'http://127.0.0.1:8188'
OUT = 'C:/AI/MPI-1095-out'
SHIPPED = os.path.join(REPO, 'comfy_workflows', 'ltx_i2v_t2v_int8.json')
SHEET, START, END, VOICE = 'mpi1042art_cafe2_sheet.png', 'mpi1042art_cafe2.png', 'mpi1042art_cafe.png', 'mpi1060_voice.wav'

FISHER = ('a naturalistic medium shot of an old fisherman mending a net on a wooden pier at sunrise, gulls overhead, '
          'gentle waves, the camera slowly pushes in. the audio is waves, gulls and the rustle of the net, no music.')
TALK = ('a naturalistic medium close-up on a quiet city street in soft afternoon light. a woman in her late thirties with wavy '
        'copper-red hair and freckles, in an olive-green utility jacket over a mustard-yellow sweater, faces the camera and says '
        'in a tired but gentle voice: "I waited all afternoon, and you never even called." her lips move clearly with every word. '
        'the camera is steady on a tripod. the audio is her voice only, clear and close.')
CAFE = WOMAN_CAFE.split('### Target Description\n', 1)[1]  # the same scene with no sheet description

BASE = {'Input_Width': {'int': 960}, 'Input_Height': {'int': 512}, 'Input_Duration': {'int': 5}, 'Input_Seed': {'int': 42},
        'Input_Video_Latent': {'is_preview': False, 'is_continue': False}}
CASES = {
    't2v': {'Input_Positive': {'string': FISHER}},
    't2v_talk': {'Input_Positive': {'string': TALK}},
    'i2v_start': {'Input_Start_Frame': {'image': START}, 'Input_Positive': {'string': CAFE}},
    'i2v_end': {'Input_End_Frame': {'image': START}, 'Input_Positive': {'string': CAFE}},
    'i2v_both': {'Input_Start_Frame': {'image': START}, 'Input_End_Frame': {'image': END}, 'Input_Positive': {'string': CAFE}},
    'ref2v': {'Input_Image': {'image': SHEET}, 'Input_Positive': {'string': WOMAN_CAFE}},
    'voice_ref': {'Input_Use_Reference_Audio': {'boolean': True}, 'Input_Audio': {'audio': VOICE}, 'Input_Positive': {'string': TALK}},
    'audio_in': {'Input_Use_Input_Audio': {'boolean': True}, 'Input_Audio': {'audio': VOICE}, 'Input_Positive': {'string': TALK}},
}
V25 = {
    'Load Diffusion Model': {'unet_name': 'ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors'},
    'VAELoader KJ': {'vae_name': 'ltx-2.5-audio-vae-bf16.safetensors'},
    'Load Latent Upscale Model': {'model_name': 'ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors'},
    'Reference LoRA': {'lora_name': 'ltx-2.5\\ltx-2.5-22b-ic-lora-ingredients-0.9.safetensors'},
}


def build(variant, case):
    g = json.load(open(SHIPPED, encoding='utf-8'))
    T = {v['_meta']['title']: k for k, v in g.items()}
    if variant != '23':
        for title, ins in V25.items():
            g[T[title]]['inputs'].update(ins)
        vae = 'ltx-2.5-video-vae-bf16.safetensors' if variant == '25d' else 'ltx-2.5-video-vae-conv-bf16.safetensors'
        g['1']['inputs']['vae_name'] = vae  # '1' = the video VAE (both VAELoaders are titled "Load VAE"; 632 is the preview)
        g['408'] = {'class_type': 'CLIPLoader', '_meta': {'title': 'Load CLIP'},
                    'inputs': {'clip_name': 'gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors', 'type': 'ltxv', 'device': 'default'}}
        if variant == '25bare':
            g[T['Merged Loras']]['inputs'].update(strength_model=0, strength_clip=0)
    for title, ins in {**BASE, **CASES[case]}.items():
        g[T[title]]['inputs'].update(ins)
    return g, T


def run(tag):
    variant, case = tag.split(':')
    g, T = build(variant, case)
    name = f'{case}_{variant}'
    body = json.dumps({'prompt': g, 'client_id': 'mpi1095'}).encode()
    try:
        res = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})))
    except urllib.error.HTTPError as e:
        print(name, 'REJECTED', e.read().decode()[:2500], flush=True)
        return
    pid, t0 = res['prompt_id'], time.time()
    while True:
        time.sleep(5)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            break
    st = h[pid].get('status', {})
    saved = []
    for item in (v for lst in h[pid]['outputs'].get(T['Output_Video'], {}).values() if isinstance(lst, list) for v in lst):
        if isinstance(item, dict) and item.get('filename', '').endswith(('.mp4', '.webm')):
            q = urllib.parse.urlencode({'filename': item['filename'], 'subfolder': item.get('subfolder', ''), 'type': item.get('type', 'output')})
            urllib.request.urlretrieve(f'{URL}/view?{q}', f'{OUT}/{name}.mp4')
            saved.append(f'{OUT}/{name}.mp4')
    print(name, st.get('status_str'), '%.0fs' % (time.time() - t0), saved or json.dumps(st)[-2500:], flush=True)


def sbs(case, right='25'):
    a, b, o = f'{OUT}/{case}_23.mp4', f'{OUT}/{case}_{right}.mp4', f'{OUT}/{case}_23_vs_{right}.webm'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a, '-i', b, '-filter_complex',
                    '[0:v][1:v]hstack=inputs=2[v];[0:a][1:a]amerge=inputs=2,pan=stereo|c0=c0|c1=c2[a]',
                    '-map', '[v]', '-map', '[a]', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '32', '-c:a', 'libopus', o], check=True)
    print(o)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if sys.argv[1:2] == ['--check']:
        for v in ('23', '25', '25d', '25bare'):
            for c in CASES:
                g, _ = build(v, c)
        print('ok', len(CASES), 'cases x 4 variants')
    elif sys.argv[1:2] == ['--sbs']:
        for c in sys.argv[2:]:
            sbs(*c.split(':'))
    else:
        for t in sys.argv[1:]:
            run(t)
