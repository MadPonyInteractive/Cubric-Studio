# MPI-878 - checklist

## Phase 1 - paths-ignore on tests.yml

- [ ] Add `paths-ignore` to `.github/workflows/tests.yml`, mirroring `.husky/pre-push`'s
      `DOCS_RE` (`^(docs/|\.agents/)|\.md$`) with ONE deliberate exception.
- [ ] The exception: `!docs/agent/**`. `tests/agent-corpus.test.cjs:74` asserts at least one
      `docs/agent/*.md` ships, and :139 requires `docs/agent/models/<recipeModelId>.md` per
      recipe - those .md files are real test INPUT, so they must keep triggering the suite.
      Verified by grep 2026-09-21; nothing else under docs/ or .agents/ is read by a test at
      runtime (documents-heal.test.cjs's `docs` is the user's Documents folder, not this dir).
- [ ] Pattern ORDER matters - last match wins, so the negation goes after both `**/*.md` and
      `docs/**` or it is overridden and the exception silently does nothing.
- [ ] Confirm the semantics: paths-ignore skips only when EVERY changed file matches. A push
      mixing code and docs still runs. A skipped push creates NO run record, so
      `gh run list --limit 1` returns the last real CODE verdict - strictly better for both
      gates than today, where a board commit overwrites the verdict.

## Phase 2 - shard the desktop suite

- [ ] `.github/workflows/tests.yml`: turn the desktop step into a 4-way matrix
      (`--shard=${ matrix.shard }/4`). Unit + lint stay on one job - they are 70s total.
- [ ] Each shard runs its own `globalSetup`, so each takes its OWN free CUBRIC_PORT
      (tests/desktop/globalSetup.js). No cross-shard collision. Confirm in the run logs.
- [ ] `playwright.desktop.config.js` stays `workers: 1` / `fullyParallel: false`: the
      parallelism is across RUNNERS, not inside one. Do not raise workers - specs share one
      port per process and an Electron app each.
- [ ] `retries: 2` on CI stays. A flake absorbed is the point.
- [ ] The artifact upload name must be per-shard or the four uploads collide.
- [ ] Public repo, GitHub-hosted: minutes are free. Optimise WALL-CLOCK, not minutes.

## Verification

- [ ] `npm run lint` clean locally.
- [ ] Push code, `gh run watch` to green - and read the step timings: desktop wall-clock
      must actually drop (baseline 16.1 min, run 35595318785, 11:42:28 -> 11:58:32).
- [ ] Prove phase 1 fires: push a board-only commit and confirm NO run is created for it
      (`gh run list --limit 3` - the newest run's headSha is still the code commit).
- [ ] Prove phase 1 does NOT over-fire: a commit touching `docs/agent/**` must still run.
