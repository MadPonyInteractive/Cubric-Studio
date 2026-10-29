"""Append the LTX 2.5 integration scope to MPI-1348's task.json description (format-preserving).

  python set_desc.py   (run from the repo root)
"""
import datetime
import json

p = ".agents/mpi-kanban/tasks/MPI-1348/task.json"
raw = open(p, encoding="utf-8").read()
t = json.loads(raw)
add = (" SCOPE ADDED 2026-10-29 (Fabio, via the LTX 2.5 umbrella MPI-1267): once the bench shows it beats"
       " our refine, wire it into MiniMax H3 only, dev-gated until the LTX 2.5 release. LTX 2.5 keeps its"
       " own upscaler (tiled Native Resolution route, MPI-578).")
t["description"] = t["description"].split(" SCOPE ADDED")[0] + add
t["updated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
with open(p, "w", encoding="utf-8", newline="\r\n" if "\r\n" in raw else "\n") as f:
    f.write(json.dumps(t, indent=2, ensure_ascii=False) + "\n")
print(t["description"][-200:])
