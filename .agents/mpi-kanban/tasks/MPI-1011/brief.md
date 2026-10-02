# MPI-1011 brief

Outpaint, a 2.0 gate. Fabio's call on 2026-10-02: Klein's picture is the result (no paste-back,
so no seam; ~1 MP, original repainted), big frames fill in passes of a third per side, and no
cloud model. Details: `plan.md` Current State, evidence: `validation.md`.

## Noticed

- `ComfyUI-Mickmumpitz-Nodes` still installs on every engine, but no shipped graph loads it
  since this card (SplatKit's position before MPI-952). Dropping its `node_lock.json` pin re-pins
  the engine, so it belongs with a cut that re-smokes anyway.
