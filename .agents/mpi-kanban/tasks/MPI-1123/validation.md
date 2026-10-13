# MPI-1123 validation

- `docs/agent/posting-check.md` served to Cosmo as `app:posting-check` ("Posting check") through the app-knowledge index `_buildSystemPrompt` already lists; `tests/agent-corpus.test.cjs` green. No code changed.
- The guide's own question, read off the file, run on `google/gemma-3-12b-it` (DeepInfra, the describer `docs/child-safety.md` benches for Fabio's app), 3 of Fabio's pictures, $0.00007 total, 2026-10-13:
  - Fanvue `t2i_001` (naked anime adult, shower): nude / nipples / suggestive / suggestive / adult -> Explicit. Right.
  - test `t2i_037` (mature teacher, explicit): partial / genitals / sexual / suggestive / adult -> Explicit. Right; the mature cues read adult, matching the picture check passing it.
  - Cowgirl on a Bull `t2i_010` (Pixar-style girl, dressed): covered / none / neutral / neutral / under18 -> Safe. Right: young and dressed is not the first row.
- Found by the run and fixed: the describer opens with a preamble line, which the first wording counted as a failed check.
- Not run: the under-18-AND-exposed row (no such picture was sent to a third-party API on purpose; the app's own picture check already refuses that case with the same describer), and Cosmo end to end in a live chat (Fabio's app is his; an eye-test).
