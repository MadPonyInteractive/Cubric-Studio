"""Print every node of an API-format ComfyUI graph: id, class, title, literal inputs, links.

  python dump_graph.py <graph.json>
"""
import json
import sys

g = json.load(open(sys.argv[1], encoding="utf-8"))
for k, v in sorted(g.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0):
    t = v.get("_meta", {}).get("title", "")
    ins = {a: b for a, b in v["inputs"].items() if not isinstance(b, list)}
    links = {a: b for a, b in v["inputs"].items() if isinstance(b, list)}
    print(k, v["class_type"], "|", t, "|", json.dumps(ins)[:170], "|", json.dumps(links)[:170])
