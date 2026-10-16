# Ask the shipped local describer (comfy_workflows/image_descriptor.json, Qwen3-VL 4B) the app's question, the
# way llmService.buildDescribeInjectionParams wraps it, on the G: bench. Run under the GPU lease:
#   python gpu_lease.py run -- python describe_bench.py asks.json
import json, sys, time, urllib.request

URL = 'http://127.0.0.1:8188'
REPO = sys.argv[2] if len(sys.argv) > 2 else 'C:/AI/Mpi/Cubric-Vision'


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


asks = json.load(open(sys.argv[1], encoding='utf-8'))
out = {}
for name, (image, question) in asks.items():
    g = json.load(open(f'{REPO}/comfy_workflows/image_descriptor.json', encoding='utf-8'))
    g['43']['inputs']['image'] = image
    g['38']['inputs']['value'] = f'<|im_start|>user\n<|vision_start|><|image_pad|><|vision_end|>{question}<|im_end|>\n<|im_start|>assistant\n'
    pid = call('/prompt', {'prompt': g, 'client_id': 'mpi1154-describe'})['prompt_id']
    while True:
        time.sleep(2)
        h = call(f'/history/{pid}')
        if pid in h:
            texts = [t for o in h[pid].get('outputs', {}).values() for t in o.get('text', [])]
            out[name] = {'image': image, 'question': question, 'answer': ' '.join(texts).strip(),
                         'status': h[pid].get('status', {}).get('status_str')}
            print(f'--- {name}: {out[name]["answer"]}', flush=True)
            break
print(json.dumps(out, indent=1))
