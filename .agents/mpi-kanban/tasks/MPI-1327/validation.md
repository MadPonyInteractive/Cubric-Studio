# MPI-1327 validation

2026-10-29, `npm run agent:test -- --case words-only-on-reference-h3` (bench case added this card:
Singularity H3 the only video model, Fabio's talking-head line as a words-only ask). Real loop,
DeepInfra recommended agent model, fake tools, no GPU. Cost $0.0446 (billed $0.0197).

- No `install_model` in any of the 3 runs: the MiniMax H3 offer is gone.
- Runs 2 and 3: `generate minimax-h3-singularity / ref2v_ms`, words only. Pass.
- Run 1: went picture-first (a Krea 2 presenter still, to animate after). The bench's fake t2i always
  returns the fox fixture, so it regenerated until STEP_LIMIT. Bench artifact plus a legitimate
  route, not the install bug; counted as FAIL by the case's strict check.
- `--bite` (Singularity not installed must fail) NOT run: the spend passed the $0.01 quoted.

Unit: tests/agent-installed-kin.test.cjs + agent tests 590/590; lint clean.
