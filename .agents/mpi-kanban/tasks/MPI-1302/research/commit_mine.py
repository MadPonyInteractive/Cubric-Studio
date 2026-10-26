"""Commit HEAD + only this card's work through a private index (shared-tree recipe).

usage: python commit_mine.py <repo> <msgfile> <card-id> <whole-file>...
Whole files are taken from the worktree. board.json and the root events.jsonl are
rebuilt as HEAD + this card's own changes only.
"""
import json, os, subprocess, sys, tempfile

repo, msgfile, card, *whole = sys.argv[1:]
BOARD = '.agents/mpi-kanban/board.json'
EVENTS = '.agents/mpi-kanban/events.jsonl'


def git(*args, inp=None, env=None):
    r = subprocess.run(['git', *args], cwd=repo, input=inp, capture_output=True, env=env)
    if r.returncode:
        sys.exit(f'git {args[0]} failed: {r.stderr.decode("utf-8", "replace")}')
    return r.stdout


head = git('rev-parse', 'HEAD').decode().strip()
staged = git('diff', '--cached', '--name-only').decode().split()
if staged:
    sys.exit(f'shared index holds staged paths, refusing: {staged}')

# board.json: HEAD + next_id bump + the card at the top of its column
head_board_bytes = git('show', f'{head}:{BOARD}')
hb = json.loads(head_board_bytes)
wb = json.loads(open(os.path.join(repo, BOARD), 'rb').read())
assert json.dumps(hb, indent=2) + '\n' == head_board_bytes.decode().replace('\r\n', '\n'), 'board format differs'
col = next(c for c, ids in wb['columns'].items() if card in ids)
for ids in hb['columns'].values():
    if card in ids:
        ids.remove(card)
hb['columns'][col].insert(0, card)
hb['next_id'] = max(hb['next_id'], int(card.split('-')[1]) + 1)
board_blob = (json.dumps(hb, indent=2) + '\n').encode()

# events.jsonl: HEAD bytes verbatim + this card's lines from the worktree, byte for byte
head_ev = git('show', f'{head}:{EVENTS}')
if not head_ev.endswith(b'\n'):
    head_ev += b'\n'
mine = []
committed = {l.rstrip(b'\r') for l in head_ev.split(b'\n')}  # compare without EOL
for line in open(os.path.join(repo, EVENTS), 'rb').read().split(b'\n'):
    line = line.rstrip(b'\r')
    if line.strip() and json.loads(line).get('id') == card and line not in committed:
        mine.append(line)
events_blob = head_ev + b''.join(m + b'\n' for m in mine)

idx = tempfile.mktemp(prefix='idx-')
env = {**os.environ, 'GIT_INDEX_FILE': idx}
git('read-tree', head, env=env)


def put(path, data=None):
    if data is None:
        sha = git('hash-object', '-w', f'--path={path}', path).decode().strip()
    else:
        sha = git('hash-object', '-w', '--no-filters', '--stdin', inp=data).decode().strip()
    mode = (git('ls-tree', head, '--', path).decode().split() or ['100644'])[0]
    git('update-index', '--add', '--cacheinfo', f'{mode},{sha},{path}', env=env)
    return mode, sha


entries = [(BOARD, *put(BOARD, board_blob)), (EVENTS, *put(EVENTS, events_blob))]
entries += [(p, *put(p)) for p in whole]
tree = git('write-tree', env=env).decode().strip()
commit = git('commit-tree', tree, '-p', head, '-F', msgfile).decode().strip()
git('update-ref', 'refs/heads/master', commit, head)
for path, mode, sha in entries:  # keep the shared index in step with the new HEAD
    git('update-index', '--add', '--cacheinfo', f'{mode},{sha},{path}')
os.remove(idx)
print(commit, f'events +{len(mine)}')
