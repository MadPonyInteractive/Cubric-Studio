import json, sys
a = json.load(open(sys.argv[1], encoding='utf-8'))
b = json.load(open(sys.argv[2], encoding='utf-8'))


def walk(x, y, at):
    if isinstance(x, dict) and isinstance(y, dict):
        for k in sorted(set(x) | set(y)):
            if k not in x:
                print(f'+ {at}.{k} = {json.dumps(y[k])[:120]}')
            elif k not in y:
                print(f'- {at}.{k} = {json.dumps(x[k])[:120]}')
            else:
                walk(x[k], y[k], f'{at}.{k}')
    elif isinstance(x, list) and isinstance(y, list) and len(x) == len(y):
        for i, (p, q) in enumerate(zip(x, y)):
            walk(p, q, f'{at}[{i}]')
    elif x != y:
        print(f'~ {at}: {json.dumps(x)[:100]} -> {json.dumps(y)[:100]}')


walk(a, b, '')
print('compared', len(a), 'cases')
