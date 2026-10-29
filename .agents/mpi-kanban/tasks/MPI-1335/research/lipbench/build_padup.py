# MPI-1335 step 1: the bench builder's graph (soundtrack + pad up, cut back) as a bench graph, seed pinned like the
# other variants. Builder output is API JSON the app runs as is (V1_shipped == builder before these edits).
#   python -I build_padup.py   -> P1_padup.json
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', 'MPI-1036', 'research', 'bench'))
import flow_graph as fg  # noqa: E402

w = fg.graph()
w['17']['_meta']['title'] = 'Bench_Seed'
w['17']['inputs']['int'] = 3362804242
with open(os.path.join(HERE, 'P1_padup.json'), 'w', encoding='utf-8', newline='\n') as f:
    json.dump(w, f, indent=2)
    f.write('\n')
print('P1_padup', len(w), 'nodes')
