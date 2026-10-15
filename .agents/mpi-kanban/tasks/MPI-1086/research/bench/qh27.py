"""MPI-1086 round 27: a hairstyle that TAKES HAIR AWAY, in words. Fabio's eye test 3: "silver Mohawk" on Klein (lock 2)
recoloured the old hair silver and kept its shape (braids -> silver braids; a ponytail -> a slicked silver ponytail),
on a render-like sheet (C, flowCSE_013) and a photo-real one (R, flowCSFI_006) alike.
  k_ship   Klein, the builder's string as shipped ("Give the character silver Mohawk, ...")   = the failure
  k_spell  Klein, the style spelled out (shaved sides, one strip on top, the old hair gone)
  q_ship   Qwen words route (no picture), the shipped string
  q_spell  Qwen, spelled out
Runs on the APP's engine (:48188, Fabio's go 2026-10-15; the :8188 bench was down): the sheets are uploaded to it.
usage: qh27.py <out> [only...]. Under gpu_lease only.
"""
import json, os, sys, urllib.request, uuid
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, KLEIN, QWEN, KEEP

qh26.URL = 'http://127.0.0.1:48188'
MEDIA = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Qwen 2.1/Media/'


def upload(src, name):
    b = uuid.uuid4().hex
    body = (f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\nContent-Type: image/png\r\n\r\n'
            ).encode() + open(src, 'rb').read() + f'\r\n--{b}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{b}--\r\n'.encode()
    print(json.load(urllib.request.urlopen(urllib.request.Request(qh26.URL + '/upload/image', body,
                                                                  {'Content-Type': f'multipart/form-data; boundary={b}'}))))

SHEETS = {'R': ('mpi1086_csR.png', 42), 'C': ('mpi1086_csC.png', 2585967065)}
TAIL = 'Make the same change in the close-up portrait on the right. ' + KEEP
SHIP = 'Give the character silver Mohawk, with the head uncovered and no hat, so the new hair shows. ' + TAIL
SPELL = ('Give the character a silver mohawk haircut: both sides of the head shaved down to the skin, and one narrow '
         'strip of silver hair standing up along the middle of the head, from the forehead to the back of the neck. '
         'The old hair is gone, no braids, no ponytail and no long hair. The head is uncovered, no hat. ' + TAIL)


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    upload(MEDIA + 'flowCSFI_006.png', 'mpi1086_csR.png')
    upload(MEDIA + 'flowCSE_013.png', 'mpi1086_csC.png')
    for s, (sheet, seed) in SHEETS.items():
        for name, api, words in (('k_ship', KLEIN, SHIP), ('k_spell', KLEIN, SPELL),
                                 ('q_ship', QWEN, SHIP), ('q_spell', QWEN, SPELL)):
            tag = f'h27_{s}_{name}'
            if (only and not any(tag.startswith(o) for o in only)) or os.path.exists(f'{out}/{tag}_Output_Image.png') \
                    or os.path.exists(f'{out}/{tag}_Output_Image_2.png'):
                continue
            ins = {'Input_Image': {'string': sheet}, 'Input_Seed': {'int': seed}, 'Input_Positive': {'string': words},
                   'Input_Reference': {'boolean': False}, 'Input_Headless': {'boolean': False}}
            if api == KLEIN:
                ins['Input_Lock'] = {'int': 2}
            run(out, tag, api, ins)
