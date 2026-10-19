import json, sys, urllib.request
# Which weight files each edit graph names that the bench ComfyUI's dropdowns do not list.
sys.stdout.reconfigure(encoding='utf-8')
oi = json.load(urllib.request.urlopen('http://127.0.0.1:8188/object_info'))
WF = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/'
EXT = ('.safetensors', '.gguf', '.pth', '.pt', '.bin', '.ckpt')
for f in ['klein_t2i', 'klein_9b_t2i', 'krea2_t2i_sfw', 'krea2_t2i_nsfw', 'qwen_image_2_1',
          'boogu_edit_high', 'boogu_edit_balanced', 'qwen_edit']:
    d = json.load(open(WF + f + '.json', encoding='utf-8'))
    miss = set()
    for n in d.values():
        if not isinstance(n, dict) or 'class_type' not in n: continue
        spec = oi.get(n['class_type'], {}).get('input', {})
        allspec = {**spec.get('required', {}), **spec.get('optional', {})}
        for k, v in n['inputs'].items():
            if isinstance(v, str) and v.lower().endswith(EXT) and k in allspec:
                opts = allspec[k][0]
                if isinstance(opts, list) and v not in opts and v.replace('\\', '/') not in opts:
                    miss.add(f'{n["class_type"]}.{k} = {v}')
    print(f, '->', sorted(miss) or 'all present')
