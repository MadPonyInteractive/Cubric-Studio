import json, sys
# Which nodes execute for each value of Picture 2's `loaded`, honouring MpiIfElse laziness.
api = json.load(open(sys.argv[1], encoding='utf-8'))
OUTPUTS = [k for k, v in api.items() if v['class_type'] in ('PreviewImage', 'PreviewAny')]


def run(loaded):
    seen = set()

    def visit(k):
        if k in seen:
            return
        seen.add(k)
        v = api[k]
        ins = dict(v['inputs'])
        if v['class_type'] == 'MpiIfElse':
            visit(ins['boolean'][0])
            ins = {'x': ins['true' if loaded else 'false']}
        for val in ins.values():
            if isinstance(val, list) and len(val) == 2 and isinstance(val[0], str):
                visit(val[0])

    for o in OUTPUTS:
        visit(o)
    return seen


on, off = run(True), run(False)
name = lambda k: f"{k}:{api[k]['class_type']}"
print('body-only nodes (skipped without a body):', sorted((name(k) for k in on - off), key=lambda s: int(s.split(':')[0])))
print('nodes only without a body:', sorted(name(k) for k in off - on))
assert not any(api[k]['class_type'] in ('SAM3_Detect', 'CheckpointLoaderSimple') for k in off), 'SAM3 runs without a body'
assert all(k in on | off for k in api), 'a node never runs in either mode'
print('OK: SAM3 branch skipped without a body; every node runs in one mode or the other')
