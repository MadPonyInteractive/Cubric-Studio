# MPI-1151's M5 (= the shipped template 4) with the two-subject kept text the MPI-1154 question gets back. Runs
# MPI-1036's run_flow.py with one preset added, so the graph is the bench's own. Under the GPU lease:
#   python gpu_lease.py run -- G:/ComfyUi/python_embeded/python.exe run_kept.py K1_monkey_horse_kept_both
import os, sys

BENCH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../MPI-1036/research/bench')
sys.path.insert(0, BENCH)
src = open(os.path.join(BENCH, 'run_flow.py'), encoding='utf-8').read()
head, tail = src.split('\nfor name in sys.argv[1:]:', 1)
ns = {'__file__': os.path.join(BENCH, 'run_flow.py'), '__name__': 'run_flow'}
exec(compile(head, 'run_flow.py', 'exec'), ns)  # ponytail: run_flow has no main guard; split it at its loop
P = ns['PRESETS']
# describe_qwen2.log, monkey_horse: the shipped local describer asked the new question about the clip's first frame.
P['K1_monkey_horse_kept_both'] = dict(P['M5_monkey_bg_template4'], kept=(
    'A cartoon monkey with brown fur, large round eyes, and a wide smiling mouth is riding a white horse with a '
    'blonde mane and tail; the monkey wears no clothing or accessories, while the horse has a brown saddle.'))
exec(compile('for name in sys.argv[1:]:' + tail, 'run_flow.py', 'exec'), ns)
