"""Two-picture height check (Fabio 2026-10-27): the one-picture describer read a plain high camera as eye level
(loop1 lp1), so show the describer the input AND the result together and ask which way the camera moved.

  python heightcheck.py test <out.json>   the known pairs below (truth = my read of each sheet, validation.md)
DEEPINFRA_API_KEY in the env; one call = two pictures ~ $0.0003.
"""
import base64, json, os, sys, urllib.request

import viewread as v1

ASK = ('Picture 1 and picture 2 show the same person in the same place, photographed from two camera positions. '
       'Ignore which way the person faces; judge only the HEIGHT of the camera.\n'
       'Clues: a camera that moved UP looks down more - more floor or ground behind the person, the ceiling or sky '
       'gone, the head looks bigger than the feet. A camera that moved DOWN looks up more - more ceiling or sky, '
       'the legs look long and the head small.\n'
       'Answer in exactly these lines:\n'
       'MOVED: up, down or same (from picture 1 to picture 2)\n'
       'CAMERA_2: where the camera is in picture 2: low (below her waist, looking up), level (at her eye level), '
       'high (above her head, looking down)')

S = 'D:/WORK/Images/Outputs/mpi1039_split/'
IN_ROOM, IN_PLAZA = 'G:/ComfyUi/ComfyUI/input/mpi1039_split_person.png', 'G:/ComfyUi/ComfyUI/input/mpi1039_split_photo_rear.png'
PAIRS = [  # (name, picture 1, picture 2, moved, camera_2)
    ('room front eye', IN_ROOM, S + 'in_front_eye_qwen_00001_.png', 'same', 'low'),
    ('room side r', IN_ROOM, S + 'in_side_r_qwen_00001_.png', 'same', 'low'),
    ('room back', IN_ROOM, S + 'in_back_qwen_00001_.png', 'same', 'low'),
    ('room front hi', IN_ROOM, S + 'in_front_hi_qwen_00001_.png', 'up', 'high'),
    ('room lp1 peek', IN_ROOM, S + 'lp1_h1_peek4_00001_.png', 'up', 'high'),
    ('plaza side r', IN_PLAZA, S + 'out_side_r_qwen_00001_.png', 'same', 'level'),
    ('plaza back', IN_PLAZA, S + 'out_back_qwen_00001_.png', 'same', 'level'),
    ('plaza fl low', IN_PLAZA, S + 'out_fl_low_qwen_00001_.png', 'same', 'level'),
    ('plaza high', IN_PLAZA, S + 'out_high_qwen_00001_.png', 'up', 'high'),
    ('plaza front hi', IN_PLAZA, S + 'out_front_hi_qwen_00001_.png', 'up', 'high'),
    ('REV room front hi', S + 'in_front_hi_qwen_00001_.png', IN_ROOM, 'down', 'low'),
    ('REV room lp1 peek', S + 'lp1_h1_peek4_00001_.png', IN_ROOM, 'down', 'low'),
    ('REV plaza high', S + 'out_high_qwen_00001_.png', IN_PLAZA, 'down', 'level'),
]


def check(p1, p2, key):
    pic = lambda p: {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{v1.jpeg(p)}'}}
    body = {'model': 'google/gemma-4-26B-A4B-it', 'temperature': 0, 'max_tokens': 200, 'messages': [{'role': 'user',
            'content': [{'type': 'text', 'text': 'Picture 1:'}, pic(p1), {'type': 'text', 'text': 'Picture 2:'},
                        pic(p2), {'type': 'text', 'text': ASK}]}]}
    req = urllib.request.Request('https://api.deepinfra.com/v1/openai/chat/completions', json.dumps(body).encode(),
                                 {'Content-Type': 'application/json', 'Authorization': f'Bearer {key}'})
    d = json.load(urllib.request.urlopen(req, timeout=120))
    text = d['choices'][0]['message']['content']
    first = lambda f: (v1.field(text, f).split() or [''])[0]  # the model echoes the option's gloss
    return first('MOVED'), first('CAMERA_2'), text, d.get('usage', {})


if __name__ == '__main__':
    out, key = sys.argv[2], os.environ['DEEPINFRA_API_KEY']
    done = json.load(open(out)) if os.path.exists(out) else {}
    for name, p1, p2, moved, cam in PAIRS[:int(sys.argv[3]) if len(sys.argv) > 3 else None]:
        if name not in done:
            m, c, text, usage = check(p1, p2, key)
            done[name] = {'moved': m, 'cam': c, 'truth': [moved, cam], 'text': text, 'usage': usage}
            json.dump(done, open(out, 'w'), indent=1)
        d = done[name]
        print(f"{name:20} truth {moved:5}/{cam:6} read {d['moved']:5}/{d['cam']:6}"
              f"{'' if d['moved'] == moved else '   <-- MOVED WRONG'}{'' if d['cam'] == cam else '  <-- CAM WRONG'}")
    cost = sum(d['usage'].get('estimated_cost', 0) for d in done.values())
    print(f"moved {sum(d['moved'] == d['truth'][0] for d in done.values())}/{len(done)} "
          f"cam {sum(d['cam'] == d['truth'][1] for d in done.values())}/{len(done)} cost ${cost:.4f}")
