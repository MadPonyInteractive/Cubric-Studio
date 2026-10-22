"""MPI-1243: do the app's MOSS boxes (layoutBoxes.js `mossLayoutPrompt`) steer the real model, and does 2K hold?

The layout JSON comes from the app's own code (node), then goes into the bench graph's prompt node.
    gpu_lease.py run --poll 2 -- python -I .agents/mpi-kanban/tasks/MPI-1243/research/boxbench.py
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'MPI-1180', 'research'))
import mossbench as mb

PROMPT = 'A sunny park with a <dog> and a <cat>, a wooden sign reads exactly "OPEN DAILY".'
BOXES = {  # swapped between runs: the dog and cat should swap sides
    'dog_left': [{'x': 0.05, 'y': 0.45, 'w': 0.4, 'h': 0.5, 'desc': 'a golden retriever', 'name': 'dog'},
                 {'x': 0.6, 'y': 0.5, 'w': 0.3, 'h': 0.4, 'desc': 'a black cat', 'name': 'cat'}],
    'dog_right': [{'x': 0.55, 'y': 0.45, 'w': 0.4, 'h': 0.5, 'desc': 'a golden retriever', 'name': 'dog'},
                  {'x': 0.1, 'y': 0.5, 'w': 0.3, 'h': 0.4, 'desc': 'a black cat', 'name': 'cat'}],
}


def layout(boxes, w, h):
    js = ("import('./js/data/layoutBoxes.js').then(m => process.stdout.write("
          f"m.mossLayoutPrompt({json.dumps(PROMPT)}, {json.dumps(boxes)}, {w}, {h})))")
    return subprocess.run(['node', '-e', js], cwd=REPO, capture_output=True, text=True, check=True).stdout


mb.OUT = os.path.join(HERE, 'boxes')
for tag, boxes in BOXES.items():
    mb.PROMPTS[tag] = layout(boxes, 1024, 1024)
mb.PROMPTS['photo2k'] = mb.PROMPTS['photo']
mb.VARIANTS['turbo'] = {'690': ('boolean', True)}
mb.run(['turbo'], [1], ['dog_left', 'dog_right'])
mb.BASE_INJECT.update({'324': ('int', 1472), '325': ('int', 1472)})
mb.run(['turbo'], [1], ['photo2k'])
