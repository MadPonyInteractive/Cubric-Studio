# MPI-515 - validation

## Closed REJECTED — Fabio, 2026-09-13

Never started. There is nothing to remove: PiD keeps its `ModelDef` and stays in the model
picker (`tasks/MPI-507/validation.md`, `tasks/MPI-734/validation.md`). Its deprecation badge was
taken off under MPI-734.

The dep-entry rule this card carried still holds for any FUTURE model removal: keep the dep
entries, because `_orphanedDepIds` can only reclaim a weight that still has one
(`docs/playbooks/add-model/README.md` § "Removing or re-tiering a model").
