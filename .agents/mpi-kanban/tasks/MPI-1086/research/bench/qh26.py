"""MPI-1086 round 26: the SHIPPED one-graph-per-route files (patch_raw_versions.py + one-file converts), run as the app
injects them. Every capture is saved (<tag>_Output_Image*.png), with the run time and the nodes ComfyUI served from
cache, so the versions, the mannequin skip and the mannequin cache can all be read off.
  q_photo  Qwen, sheet W + the pink-buns photo, Headless on       -> mannequin, edit, headless (3)
  q_words  the same, ONLY the words changed, run right after       -> the mannequin served from cache
  q_mann   Qwen, a mannequin as the reference, Input_Is_Mannequin -> edit, headless (2); Klein never runs
  q_body   Qwen, Body shape, no picture, Headless on              -> edit, headless (2)
  k_words  Klein, hair in words (lock 2), Headless on             -> edit, headless (2)
  k_off    the same, Headless off                                 -> edit only (1)
usage: qh26.py <out>. Under gpu_lease only.
"""
import copy, json, os, sys, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh16
import qh21

URL = 'http://127.0.0.1:8188'
REPO = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/'
KLEIN, QWEN = REPO + 'flow_character_sheet_edit.json', REPO + 'flow_character_sheet_edit_qwen.json'
KEEP = 'Keep everything else exactly as it is.'


def run(out, tag, api, inputs):
    g = copy.deepcopy(json.load(open(api, encoding='utf-8')))
    T = {v['_meta']['title']: k for k, v in g.items()}
    for title, ins in inputs.items():
        g[T[title]]['inputs'].update(ins)
    body = json.dumps({'prompt': g, 'client_id': 'mpi1086-qh26'}).encode()
    res = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})))
    if res.get('node_errors'):
        print(tag, 'NODE ERRORS', json.dumps(res['node_errors'])[:1500], flush=True)
        return
    pid, t0 = res['prompt_id'], time.time()
    while True:
        time.sleep(3)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            break
    st = h[pid].get('status', {})
    cached = next((m[1].get('nodes', []) for m in st.get('messages', []) if m[0] == 'execution_cached'), [])
    saved = []
    for title in sorted(t for t in T if t.startswith('Output_Image')):
        for im in h[pid]['outputs'].get(T[title], {}).get('images', []):
            q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
            urllib.request.urlretrieve(f'{URL}/view?{q}', f'{out}/{tag}_{title}.png')
            saved.append(title)
    klein = [k for k, v in g.items() if 'Klein' in v['_meta']['title'] or 'mannequin' in v['_meta']['title']]
    print(tag, st.get('status_str'), '%.0fs' % (time.time() - t0), 'saved', saved,
          'cached mannequin nodes', sorted(set(klein) & set(cached), key=int), 'of', len(klein), flush=True)
    if st.get('status_str') != 'success':
        print(json.dumps(st)[-1500:], flush=True)


def recheck(out):
    """r26b, after patch_raw_clearvram.py: with the cache FLUSHED, Body shape and a given mannequin must not load
    Klein (no "Requested to load Flux2" in the engine log between their prompts); the photo route still builds one."""
    urllib.request.urlopen(urllib.request.Request(URL + '/free', json.dumps(
        {'unload_models': True, 'free_memory': True}).encode(), {'Content-Type': 'application/json'}))
    time.sleep(5)
    desc = json.load(open(f'{out}/h22_describe.json', encoding='utf-8'))
    sheet, _, photo = qh16.SHEETS['W']
    words = desc[photo].strip().rstrip('.')
    q = {'Input_Image': {'string': sheet}, 'Input_Seed': {'int': 7}, 'Input_Headless': {'boolean': True}}
    run(out, 'h26b_q_body', QWEN, {**q, 'Input_Reference': {'boolean': False}, 'Input_Positive': {'string':
        "Make the character's body heavyset. Make the same change in the close-up portrait on the right. " + KEEP}})
    run(out, 'h26b_q_mann', QWEN, {**q, 'Input_Image_2': {'string': 'mpi1086_man4_pin5.png'},
                                   'Input_Reference': {'boolean': True}, 'Input_Is_Mannequin': {'boolean': True},
                                   'Input_Positive': {'string': qh21.q1(words)}})
    run(out, 'h26b_q_photo', QWEN, {**q, 'Input_Image_2': {'string': photo}, 'Input_Reference': {'boolean': True},
                                    'Input_Positive': {'string': qh21.q1(words)}})


if __name__ == '__main__':
    out = sys.argv[1]
    if sys.argv[2:] == ['recheck']:
        recheck(out)
        sys.exit()
    if sys.argv[2:] == ['final']:   # r26c, after patch_raw_one_clear.py: one MpiClearVram, the run's last step
        desc = json.load(open(f'{out}/h22_describe.json', encoding='utf-8'))
        sheet, _, photo = qh16.SHEETS['W']
        run(out, 'h26c_q_photo', QWEN, {'Input_Image': {'string': sheet}, 'Input_Seed': {'int': 3},
                                        'Input_Headless': {'boolean': True}, 'Input_Image_2': {'string': photo},
                                        'Input_Reference': {'boolean': True},
                                        'Input_Positive': {'string': qh21.q1(desc[photo].strip().rstrip('.'))}})
        run(out, 'h26c_k_words', KLEIN, {'Input_Image': {'string': sheet}, 'Input_Seed': {'int': 3},
                                         'Input_Lock': {'int': 2}, 'Input_Reference': {'boolean': False},
                                         'Input_Headless': {'boolean': True}, 'Input_Positive': {'string':
            'Give the character a short blonde bob haircut, with the head uncovered and no hat, so the new hair shows. '
            'Make the same change in the close-up portrait on the right. ' + KEEP}})
        sys.exit()
    desc = json.load(open(f'{out}/h22_describe.json', encoding='utf-8'))
    sheet, _, photo = qh16.SHEETS['W']
    words = desc[photo].strip().rstrip('.')
    q = {'Input_Image': {'string': sheet}, 'Input_Seed': {'int': 42}, 'Input_Headless': {'boolean': True}}
    run(out, 'h26_q_photo', QWEN, {**q, 'Input_Image_2': {'string': photo}, 'Input_Reference': {'boolean': True},
                                   'Input_Positive': {'string': qh21.q1(words)}})
    run(out, 'h26_q_words', QWEN, {**q, 'Input_Image_2': {'string': photo}, 'Input_Reference': {'boolean': True},
                                   'Input_Positive': {'string': qh21.q1(words + ', dyed blue')}})
    run(out, 'h26_q_mann', QWEN, {**q, 'Input_Image_2': {'string': 'mpi1086_man4_pin5.png'},
                                  'Input_Reference': {'boolean': True}, 'Input_Is_Mannequin': {'boolean': True},
                                  'Input_Positive': {'string': qh21.q1(words)}})
    run(out, 'h26_q_body', QWEN, {**q, 'Input_Reference': {'boolean': False}, 'Input_Positive': {'string':
        "Make the character's body heavyset. Make the same change in the close-up portrait on the right. " + KEEP}})
    hair = ('Give the character a short blonde bob haircut, with the head uncovered and no hat, so the new hair shows. '
            'Make the same change in the close-up portrait on the right. ' + KEEP)
    k = {'Input_Image': {'string': sheet}, 'Input_Seed': {'int': 42}, 'Input_Lock': {'int': 2},
         'Input_Reference': {'boolean': False}, 'Input_Positive': {'string': hair}}
    run(out, 'h26_k_words', KLEIN, {**k, 'Input_Headless': {'boolean': True}})
    run(out, 'h26_k_off', KLEIN, {**k, 'Input_Headless': {'boolean': False}})
