# MPI-1122 validation

- New section "Keeping an adult reading as an adult" in `docs/agent/models/illustrious.md` and `pony.md`: age as `mature female`, face shape (round, small = young), adult clothes, hair, setting, and how to explain a picture-check `CHILD_SAFETY` refusal.
- Cosmo receives it: `services/agentCorpus.mjs` `listCorpus()` serves `guide:illustrious` and `guide:pony` with the new text (checked 2026-10-13).
- `tests/agent-corpus.test.cjs` green.
- Cues come from Fabio's own runs on ILL Anime (2026-10-13): "45 year old" changed nothing, `mature female` + pencil skirt read older and passed the picture check on LTX.
- Docs-only: takes effect in the running app without a restart (read per call).
