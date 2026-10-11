"""R2 audit: which objects in cubric-models could be deleted? Read-only; a human decides.

  python r2_audit.py [extra-ref ...]     (run from the Cubric-Vision repo root;
                                          extra refs = hand-delivered tester builds)

Two lists, checked against master and the newest release tags:
  A. No build references the URL at all - strong candidates.
  B. Master lists the URL only in a dep entry that nothing in this repo names (not a model,
     not a Flow, not an engineAsset). Usually a DEPRECATED entry kept so the orphan sweep can
     reclaim the file from users' disks - but a paid Flow PACKAGE names deps from outside this
     repo (klein-9b-lora-headswap), so READ the entry's comment before calling it dead.
     Deleting a B object also needs its url/mirrorUrl dropped from the entry (MPI-698 shape),
     or check-dep-urls.mjs turns release:check red.
Either way, delete only when the "newest build" column is OLDER than the support floor:
v1.5.0 (Fabio 2026-10-11) - anything only a pre-1.5.0 build installs may go.
"""
import re, subprocess, sys

CONF = r'C:\Users\Fabio\.secrets\rclone-r2.conf'
CODE = ['js', 'routes', 'services', 'main', 'main.js', 'server.js', 'engine', 'comfy_workflows',
        'dev_configs', 'operation_registry.json']
URL = re.compile(r'models[.]cubric[.]studio/([^\s\'"`)]+)')
ENTRY = re.compile(r"^\s{4}'([\w.-]+)':\s*\{(.*?)^\s{4}\}", re.M | re.S)
DEPFILE = re.compile(r'/(model|lora|asset|nodes)Deps\.js$|/dependencies\.js$')  # not resolveModelDeps.js


def git(*a):
    return subprocess.run(['git', *a], capture_output=True, text=True, encoding='utf-8',
                          errors='replace').stdout


def scan(ref):
    """-> (every URL in the code, URLs a build would install, {url: dep id})"""
    files = [f for f in git('ls-tree', '-r', '--name-only', ref, '--', *CODE).split('\n')
             if f.endswith(('.js', '.mjs', '.cjs', '.json'))]
    every, named, owner, other, deps = set(), set(), {}, [], {}
    for f in files:
        body = git('show', f'{ref}:{f}')
        every.update(URL.findall(body))
        if DEPFILE.search(f):
            for dep_id, block in ENTRY.findall(body):
                live = [u for line in block.split('\n') if not line.strip().startswith('//')
                        for u in URL.findall(line)]
                deps[dep_id] = (live, 'engineAsset: true' in block)
                owner.update((u, dep_id) for u in live)
        else:
            other.append(re.sub(r'^\s*//.*$', '', body, flags=re.M))  # "'id' DROPPED" notes
            named.update(URL.findall(body))
    text = '\n'.join(other)
    for dep_id, (urls, engine) in deps.items():
        if engine or f"'{dep_id}'" in text or f'"{dep_id}"' in text:
            named.update(urls)
    return every, named, owner


out = subprocess.run(['rclone', '--config', CONF, 'lsl', 'cubric-r2:cubric-models',
                      '--s3-no-check-bucket'], capture_output=True, text=True, encoding='utf-8')
if out.returncode:
    sys.exit(f'rclone lsl failed: {out.stderr.strip()}')
objs = {}
for line in out.stdout.splitlines():
    p = line.split(None, 3)
    objs[p[3].strip()] = int(p[0])

tags = [t for t in git('tag', '--sort=-creatordate').split() if t.startswith('v')][:6]
refs = ['master', *sys.argv[1:], *tags]
res = {r: scan(r) for r in refs}
owner = res['master'][2]

total = sum(objs.values())
print(f'{len(objs)} objects, {total / 1e9:.1f} GB, ~${max(total / 1e9 - 10, 0) * 0.015:.2f}/month')
print(f'refs: {", ".join(refs)}')
for title, test in (('A. no build references the URL', lambda k: k not in res['master'][0]),
                    ('B. master lists it, nothing in-repo names its dep - read the entry',
                     lambda k: k in res['master'][0] and k not in res['master'][1])):
    print(f'\n{title}')
    gb = 0
    for k, sz in sorted(objs.items(), key=lambda kv: -kv[1]):
        if not test(k):
            continue
        gb += sz
        newest = next((r for r in refs[1:] if k in res[r][1]), 'none of these')
        dep = f'  [dep {owner[k]}]' if k in owner else ''
        print(f'{sz / 1e9:7.2f} GB  {k}{dep}\n            newest build installing it: {newest}')
    print(f'  = {gb / 1e9:.1f} GB')
