# MPI-1055 Validation

## Runner + playbook (65e54f16)

- `scripts/bench-gpu-klein.mjs`: keys from `RUNPOD_API_KEY`/`RUNPOD_ENV_FILE` and
  `HF_TOKEN`/`HF_TOKEN_FILE`, nothing machine-specific in the file (grep for local paths and
  key prefixes: none). `--plan` ran clean with no spend; `--calib` refuses a card that is not
  in `GPU_GEN_SECS`; a missing key exits with `set RUNPOD_API_KEY or RUNPOD_ENV_FILE`.
- `docs/playbooks/gpu-benchmark/README.md`, routed from `docs/README.md` (RunPod section),
  `docs/runpod-remote-engine.md` and the `GPU_GEN_SECS` comment.

## First run of the repo runner (2026-10-09, Fabio's yes, $1 cap)

No check card: same setup and same day as MPI-1054's two passing checks (A40, A5000).

| Card | s/img (new prompt, shipped) | cached prompt | create -> ComfyUI up |
|---|---|---|---|
| RTX PRO 4500 Blackwell Server Edition | 3.64 | 3.19 | 3.9 min |
| A100 80GB PCIe | 4.02 | 2.88 | 4.1 min |
| L40 | 4.22 | 3.71 | 4.9 min |

Spend ~$0.33 (rate x wall time). No Pod left running.

## Checks

- `node --test tests/gpu-picker.test.cjs`: 8 pass, 0 fail.

## Red master met on the way (1973b7c6)

Pushing 65e54f16 was refused: master's last Tests run (37995369387, MPI-623's bdfc432f) was
red. `tests/desktop/scene-viewer.spec.js` read `.mpi-scene-block__readout`, which MPI-623's
new `#path-readout` also carries, so Playwright strict mode failed. Fixed the spec to read
`#readout` (passes locally, own port), pushed with the runner, messaged the MPI-623 session
(`state/messages/3ef574fd-...json`).
