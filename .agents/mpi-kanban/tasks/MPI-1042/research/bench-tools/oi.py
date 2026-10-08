import json, sys, urllib.request, urllib.parse
# usage: oi.py Class1 Class2 ...  -> prints required/optional input names + outputs from the live bench
for c in sys.argv[1:]:
    url = 'http://127.0.0.1:8188/object_info/' + urllib.parse.quote(c)
    d = json.load(urllib.request.urlopen(url, timeout=10)).get(c)
    if not d:
        print(c, 'MISSING'); continue
    req = {k: (v[0] if isinstance(v[0], str) else 'COMBO') for k, v in d['input'].get('required', {}).items()}
    opt = {k: (v[0] if isinstance(v[0], str) else 'COMBO') for k, v in d['input'].get('optional', {}).items()}
    print(c, '| req', req, '| opt', opt, '| out', list(zip(d['output_name'], d['output'])))
