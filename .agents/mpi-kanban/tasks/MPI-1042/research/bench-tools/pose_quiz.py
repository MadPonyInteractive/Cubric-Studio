import copy, json, sys, time, urllib.request
# pose_quiz.py <question> <image>...   (images = MpiLoadImage strings under the bench input/)
# Asks the app's LOCAL describer (comfy_workflows/image_descriptor.json, Qwen3-VL 4B) one question per picture,
# exactly as llmService.buildDescribeInjectionParams wraps it, and prints the answer.
URL = 'http://127.0.0.1:8188'
base = json.load(open('comfy_workflows/image_descriptor.json', encoding='utf-8'))
q = sys.argv[1]
for img in sys.argv[2:]:
    g = copy.deepcopy(base)
    g['43']['inputs']['string'] = img
    g['38']['inputs']['value'] = f'<|im_start|>user\n<|vision_start|><|image_pad|><|vision_end|>{q}<|im_end|>\n<|im_start|>assistant\n'
    body = json.dumps({'prompt': g, 'client_id': 'mpi1042'}).encode()
    pid = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})))['prompt_id']
    t0 = time.time()
    while True:
        time.sleep(1)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            break
    out = h[pid]['outputs'].get('37', {}).get('text', ['NO OUTPUT'])
    print(f'{img:45s} {time.time() - t0:4.0f}s  {(out[0] if isinstance(out, list) else out).strip()!r}', flush=True)
