"""MPI-1086 phase B: the REAL describer (the app's imageDescribe graph, comfy_workflows/image_descriptor.json, Qwen3-VL
4B) asked the hairstyle question of each reference: the buns photo and Fabio's seven Pinterest pictures.
Writes <out>/h12_describe.json {ref: answer}. usage: qh12.py <out>. Under gpu_lease only (posts to the bench :8188).
"""
import copy, json, os, sys, time, urllib.request

URL = 'http://127.0.0.1:8188'
API = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/image_descriptor.json'
ASK = ('Describe only the hairstyle of the person in this picture: its length, its shape, how it is worn (loose, tied '
       'up, braided, in buns or bunches), the fringe if there is one, and the hair colour. Answer with one phrase that '
       'starts with the hair colour, and nothing else.')
REFS = ['mpi1086_ref_buns.png'] + [f'mpi1086_pin{n}.png' for n in range(5, 12)]


def prompt(question):
    """llmService.buildDescribeInjectionParams, verbatim."""
    return f'<|im_start|>user\n<|vision_start|><|image_pad|><|vision_end|>{question}<|im_end|>\n<|im_start|>assistant\n'


def describe(ref, question=ASK):
    g = copy.deepcopy(json.load(open(API, encoding='utf-8')))
    T = {v['_meta']['title']: k for k, v in g.items()}
    g[T['Input_Image']]['inputs']['string'] = ref
    g[T['Input_Describe_Prompt']]['inputs']['value'] = prompt(question)
    body = json.dumps({'prompt': g, 'client_id': 'mpi1086'}).encode()
    pid = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body,
                                                                  {'Content-Type': 'application/json'})))['prompt_id']
    while True:
        time.sleep(2)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            break
    out = h[pid]['outputs'].get(T['Output_prompt'], {})
    return ' '.join(str(x) for x in (out.get('text') or out.get('string') or [json.dumps(out)])).strip()


if __name__ == '__main__':
    out = sys.argv[1]
    res = {}
    for ref in REFS:
        res[ref] = describe(ref)
        print(ref, '->', res[ref], flush=True)
    json.dump(res, open(f'{out}/h12_describe.json', 'w', encoding='utf-8'), indent=1)
