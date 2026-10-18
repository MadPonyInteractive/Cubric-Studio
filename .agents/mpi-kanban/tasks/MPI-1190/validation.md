# MPI-1190 validation

2026-10-18, session "New character sheets 47". All live runs: `npm run agent:test` (real DeepSeek-V4-Flash on
DeepInfra, fake tools, no GPU). Spent $0.054 total across every run below.

- New bench case `sheet-soft-area-mask` ("The dragon tattoo on her back came out smudged and blurry." on a sheet):
  **3/3 pass** with the final wording (no generate; the reply recommends a mask over the back view and says how to paint it).
- `--bite` on it: the flip ("Add a dragon tattoo across her upper back.") runs the Flow, the check FAILS as it must.
- Baseline WITHOUT the Route rule clause (flows.md line only): **2/3** - run 1 re-ran Character Sheet Editor
  ("sharp, crisp, clearly defined dragon tattoo"). So the clause is load-bearing.
- Regression `sheet-editor-shirt` ("Change the shirt to blue." on a sheet -> the Flow's Clothes): **3/3 pass**.
- Offline: `node --test tests/agent-*.test.cjs` 518 pass, 0 fail. System prompt 11,885 bytes (budget raised from
  11,796 with its note); `docs/agent/flows.md` held at its 200-line cap.

Not covered: the run AFTER the user paints (masked Qwen `edit` + reference on a sheet card) - that path is the
existing masked-edit route and Fabio's own edit_011 proved it by hand; no bench dispatches a mask.

CI: tests.yml run 39155215477 on f823796d7 - success. Claim audit: 5 proven, 0 false (bench numbers unverifiable from git).
