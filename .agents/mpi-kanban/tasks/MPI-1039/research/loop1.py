"""Hop loop round 1 (Fabio 2026-10-27): Qwen + angle LoRA runs 4 of its 8 steps, a one-jump x0 peek shows where the
camera landed, the DeepInfra describer (viewread3's question + rules) reads which way she faces and
MoGe's floor pitch (pitch.py) reads the camera height, then either the step-4 latent
goes to the locked Krea finish (Raw 18 + skin pass + Turbo upscale) or Qwen finishes steps 4-8 to a picture and the
next hop starts from it.

  python loop1.py <tag> <in_image> <turn> <height> [max_hops]   turn = front tq_fl tq_fr pr_l pr_r tq_bl tq_br back,
                                                                height = lo level hi
  python loop1.py read <picture>                                 one read (describer + MoGe on the GPU)

Words name the END view (validation.md "OUTDOOR END-VIEW ROUND"). Krea refs are bench-specific (split1.krea_graph:
Fabio's bedroom picture + outfit), so the finish only fits mpi1039_split_person.png. Log: out/loop1_<tag>.json.
DEEPINFRA_API_KEY in the env; one read ~ $0.0002.
"""
import json, os, shutil, sys

import split1 as s
import viewread as v1
import viewread3 as v3
import pitch

VIEW = {'front': 'front view', 'tq_fl': 'front-left quarter view', 'tq_fr': 'front-right quarter view',
        'pr_l': 'left side view', 'pr_r': 'right side view', 'tq_bl': 'back-left quarter view',
        'tq_br': 'back-right quarter view', 'back': 'back view'}
HEIGHT = {'lo': 'low-angle', 'level': 'eye-level', 'hi': 'high-angle'}
# eye-level never lifts a low camera (validation.md, indoor round): from low, ask for elevated (+30) instead
NUDGE = {('lo', 'level'): 'elevated'}
CUT = 4
PITCH = {'low': 'lo', 'level': 'level', 'high': 'hi'}


def read(path, tag):
    # turn = the LLM (viewread3); height = MoGe floor pitch (pitch.py) - the LLM read a high camera as level
    q = v1.ask().replace(v1.EXTRA, '') + v3.EXTRA
    text, usage = v1.read(path, q, os.environ['DEEPINFRA_API_KEY'])
    deg = pitch.pitch(path, tag)[0]
    height = PITCH.get(pitch.label(deg)) if deg is not None else v3.view(v3.cues(text))[1]
    return (v3.view(v3.cues(text))[0], height), f'PITCH: {deg}\n{text}', usage


def words(turn, height, have):
    h = NUDGE.get((have[1], height), HEIGHT[height]) if have else HEIGHT[height]
    return f'<sks> {VIEW[turn]} {h} shot medium shot'


def peek_hop(prompt, tag, image, seed):
    # steps 0-4 saved as the hand-off latent, then one Euler jump 4 -> 0 = the x0 guess (split1 'peek', same graph)
    g = s.qwen_graph(prompt, tag, 8, (CUT,), image)
    g['14']['inputs']['noise_seed'] = seed
    g['21']['inputs']['sigmas'] = f'{s.q_sigmas(8)[CUT]}, 0.0'
    g['51']['inputs']['filename_prefix'] = f'mpi1039_split/{tag}_peek{CUT}'
    outs = s.submit(g)
    lat = f'mpi1039_split_{tag}_q8_k{CUT}.latent'  # split1 'raw <tag>' loads this name
    shutil.copyfile(s.files(outs, 'latents')[0], os.path.join(s.COMFY, 'input', lat))
    return s.files(outs, 'images')[0], lat


def finish_qwen(prompt, tag, image, lat):
    g = s.qwen_graph(prompt, tag, 8, image=image, peek=(lat, CUT))
    g['20']['inputs']['sigmas'] = ', '.join(str(x) for x in s.q_sigmas(8)[CUT:])
    g['51']['inputs']['filename_prefix'] = f'mpi1039_split/{tag}_qwen'
    img = s.files(s.submit(g), 'images')[0]
    name = f'mpi1039_split_{tag}.png'
    shutil.copyfile(img, os.path.join(s.COMFY, 'input', name))
    return img, name


def main(tag, image, turn, height, max_hops=3):
    want, log = (turn, height), {'want': [turn, height], 'input': image, 'hops': []}
    out = os.path.join(s.HERE, 'out', f'loop1_{tag}.json')
    have, text, _ = read(os.path.join(s.COMFY, 'input', image), f'{tag}_in')
    log['input_read'] = {'view': have, 'text': text}
    print('input reads', have, flush=True)
    seed = s.SEED
    for n in range(1, max_hops + 1):
        prompt, htag = words(turn, height, have), f'{tag}_h{n}'
        peek, lat = peek_hop(prompt, htag, image, seed)
        got, text, usage = read(peek, htag)
        hop = {'n': n, 'in': image, 'words': prompt, 'seed': seed, 'peek': peek, 'read': got, 'text': text,
               'usage': usage}
        log['hops'].append(hop)
        json.dump(log, open(out, 'w'), indent=1)
        print(f'hop {n}: {prompt!r} -> reads {got}', flush=True)
        if tuple(got) == want:
            hop['krea'] = s.files(s.submit(s.krea_graph(lat, CUT, 'two', f'{htag}_q8', steps=18,
                                                        start=s.q_sigmas(8)[CUT], cfg=2.0, refine=(2, 0.30),
                                                        usdu=(1.5, 0.2, True))), 'images')[0]
            json.dump(log, open(out, 'w'), indent=1)
            print('LANDED, krea', hop['krea'], flush=True)
            return
        if tuple(got) == tuple(have):
            seed += 1  # nothing moved: the same words on the same seed would land the same place
        hop['qwen'], image = finish_qwen(prompt, htag, image, lat)
        json.dump(log, open(out, 'w'), indent=1)
        have = got
    print('NOT LANDED after', max_hops, 'hops', flush=True)


if __name__ == '__main__':
    if sys.argv[1] == 'read':
        v, text, usage = read(sys.argv[2], 'read')
        print(v, usage)
        print(text)
    else:
        main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]) if len(sys.argv) > 5 else 3)
