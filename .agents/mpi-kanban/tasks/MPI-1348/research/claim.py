"""Write a file-claim record for this session and list it in the index.

  python claim.py <path> [<path> ...]    (run from the repo root)
"""
import datetime
import json
import os
import sys
import uuid

sid = os.environ["CLAUDE_CODE_SESSION_ID"]
cid = str(uuid.uuid4())
rec = ".agents/mpi-kanban/state/files/%s.json" % cid
json.dump({"schema": "mpi-kanban/file-claim/v1", "id": cid, "paths": sys.argv[1:], "status": "claimed",
           "claim_kind": "write", "owner_session": ".agents/mpi-kanban/state/sessions/%s.json" % sid,
           "task_card": "MPI-1348",
           "heartbeat_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")},
          open(rec, "w", encoding="utf-8"), indent=2)
idx_path = ".agents/mpi-kanban/state/index.json"
raw = open(idx_path, encoding="utf-8").read()
idx = json.loads(raw)
idx.setdefault("active_file_claims", []).append(rec)
with open(idx_path, "w", encoding="utf-8", newline="\r\n" if "\r\n" in raw else "\n") as f:
    f.write(json.dumps(idx, indent=2) + "\n")
print(rec)
