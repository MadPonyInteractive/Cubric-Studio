"""MPI-800 commit 1 through a PRIVATE index (shared tree, live peers).

HEAD + my whole files + board.json/events.jsonl blobs built as HEAD + MPI-800 only.
Moves master with update-ref <new> <old>, so a peer commit in between fails loudly.
"""
import json, os, subprocess, sys

REPO = r'C:\AI\Mpi\Cubric-Vision'
SCR = r'C:\Users\Fabio\AppData\Local\Temp\claude\C--AI-Mpi-Cubric-Vision\0d43f404-1bda-4421-9ca6-f90c159755a3\scratchpad'
os.chdir(REPO)
IDX = os.path.join(SCR, 'commit1.index')
ENV = {**os.environ, 'GIT_INDEX_FILE': IDX}
DRY = '--dry' in sys.argv


def git(*args, env=None, inp=None):
    r = subprocess.run(['git', *args], cwd=REPO, env=env or os.environ, input=inp, capture_output=True)
    if r.returncode:
        raise SystemExit(f'git {" ".join(args)} failed: {r.stderr.decode("utf-8", "replace")}')
    return r.stdout.decode('utf-8')


WHOLE = [
    'routes/comfy.js',
    'js/services/comfyController.js',
    'js/components/Compounds/LandingPages/MpiSettings/MpiSettings.js',
    'scripts/sync-raw-workflows.mjs',
    'scripts/validate-injection-rules.mjs',
    'tests/comfy-stage-media.test.cjs',
    'comfy_workflows/scripts/workflow_generation/generate_h3.py',
    'comfy_workflows/scripts/workflow_generation/registry.py',
]
WHOLE += [p for p in git('diff', '--name-only', '--', 'comfy_workflows/raw').split('\n') if p]
card = '.agents/mpi-kanban/tasks/MPI-800'
for root, _, files in os.walk(card):
    for f in files:
        WHOLE.append(os.path.join(root, f).replace('\\', '/'))

old = git('rev-parse', 'HEAD').strip()
if os.path.exists(IDX):
    os.remove(IDX)
git('read-tree', 'HEAD', env=ENV)

for p in WHOLE:
    assert os.path.isfile(p), p
    mode_line = git('ls-tree', 'HEAD', '--', p).strip()
    mode = mode_line.split()[0] if mode_line else '100644'
    sha = git('hash-object', '-w', f'--path={p}', p).strip()
    git('update-index', '--add', '--cacheinfo', f'{mode},{sha},{p}', env=ENV)

# board.json: HEAD + next_id 801 + MPI-800 at the top of doing
B = '.agents/mpi-kanban/board.json'
head_b = subprocess.run(['git', 'show', f'HEAD:{B}'], cwd=REPO, capture_output=True).stdout
text = head_b.decode('utf-8')
assert '"MPI-800"' not in text.split('"updated_at"')[0], 'MPI-800 already on the HEAD board'
assert text.count('"next_id": 800,') == 1
text = text.replace('"next_id": 800,', '"next_id": 801,', 1)
anchor = '"doing": [\n'
assert text.count(anchor) == 1
text = text.replace(anchor, anchor + '      "MPI-800",\n', 1)
cols = json.loads(text)['columns']
assert cols['doing'][0] == 'MPI-800' and sum(c.count('MPI-800') for c in cols.values()) == 1
assert len(text.encode('utf-8')) - len(head_b) == len('      "MPI-800",\n')
blob_b = text.encode('utf-8')

# events.jsonl: HEAD bytes + every MPI-800 line from the worktree, in order, LF
E = '.agents/mpi-kanban/events.jsonl'
head_e = subprocess.run(['git', 'show', f'HEAD:{E}'], cwd=REPO, capture_output=True).stdout
assert head_e.endswith(b'\n')
mine = []
for raw in open(E, 'rb').read().split(b'\n'):
    line = raw.rstrip(b'\r')
    if not line.strip():
        continue
    ev = json.loads(line.decode('utf-8'))
    if ev.get('id') == 'MPI-800':
        mine.append(line)
assert all(l not in head_e for l in mine), 'an MPI-800 event is already in HEAD'
blob_e = head_e + b''.join(l + b'\n' for l in mine)
[json.loads(l) for l in blob_e.decode('utf-8').split('\n') if l.strip()]
print(f'events: +{len(mine)} MPI-800 line(s)')

for path, data in ((B, blob_b), (E, blob_e)):
    sha = git('hash-object', '-w', '--no-filters', '--stdin', inp=data).strip()
    assert subprocess.run(['git', 'cat-file', 'blob', sha], cwd=REPO, capture_output=True).stdout == data
    git('update-index', '--cacheinfo', f'100644,{sha},{path}', env=ENV)

staged = git('diff', '--cached', '--no-renames', '--stat', 'HEAD', env=ENV)
print(staged)
names = [l for l in git('diff', '--cached', '--no-renames', '--name-status', 'HEAD', env=ENV).split('\n') if l]
print(len(names), 'paths')
for l in names:
    st, p = l.split('\t', 1)
    assert p in WHOLE or p in (B, E), f'unexpected path {p}'
if DRY:
    print('DRY RUN - nothing committed')
    sys.exit(0)

tree = git('write-tree', env=ENV).strip()
msg = os.path.join(SCR, 'commit1.msg')
new = git('commit-tree', tree, '-p', old, '-F', msg).strip()
git('update-ref', 'refs/heads/master', new, old)
# Mirror the committed blobs into the SHARED index for my paths, so status shows no staged revert.
for p in WHOLE + [B, E]:
    line = git('ls-tree', new, '--', p).strip()
    mode, _, sha = line.split('\t')[0].split()
    git('update-index', '--add', '--cacheinfo', f'{mode},{sha},{p}')
print('committed', new)
