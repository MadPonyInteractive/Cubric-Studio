# MPI-880 — validation

Fabio's call, 2026-09-21: a fixed-length model shows a line, it does not get a fixed
slider. So the control returns after its label row and no `MpiProgressBar` is mounted —
the `(value - min) / (max - min)` NaN the card warned about is never reached, and there is
nothing to guard.

## What shipped

| Change | Where |
|---|---|
| `CLIP_SECONDS` WINS over a supplied `opts.duration` | `js/data/modelConstants/deepinfraPricing.js:179`, `:196` |
| `fixedDurationFor(endpointId)` exported — the 8 is never retyped | `deepinfraPricing.js:125` |
| `durationBoundsFor` collapses a fixed model to `{min: 8, max: 8}` | `PromptBoxControls.js:109` |
| The duration control returns before mounting a slider at `min === max` | `PromptBoxControls.js:643` |

The pricing half is not redundant with the UI half: `Input_Duration` has a second writer
(`generationControls.js:484`, the agent path), so the control alone would still leave an
agent-dispatched Veo run quoted at whatever it asked for.

`Input_Duration` is still injected, now always as 8 — `buildSizeFields` drops it for Veo
(no `duration` field in the contract), so the body the provider sees is unchanged.

## Evidence

- `node --test tests/cloud-duration-bounds.test.cjs tests/deepinfra-pricing.test.cjs
  tests/cloud-price-tag.test.cjs tests/control-snapshot-injection.test.cjs
  tests/deepinfra-catalogue.test.cjs` — 80 pass, 0 fail.
- `npm test` — 1732 tests, 1730 pass, **0 fail** (1 `todo`, `agent-video-attachment`,
  pre-existing and unrelated).
- `npx eslint` on both edited source files — clean.
- **Both halves proven RED on pre-fix code, backed out ONE AT A TIME:**
  - pricing precedence restored to `opts.duration || CLIP_SECONDS[modelId]` → only
    `a supplied duration cannot move a fixed-length price (MPI-880)` fails.
  - the `bounds.min === bounds.max` return removed → only
    `Veo mounts a static line` fails.
- The money, through `estimateRunCost` — cloudExecutor's own field derivation, the same
  path the price tag calls, carrying a 3 in the shared duration bucket:

  | model | control injects | tag | tag with a raw `Input_Duration: 30` |
  |---|---|---|---|
  | `veo-31-cloud` | 8 | about $3.20 | about $3.20 |
  | `veo-31-fast-cloud` | 8 | about $1.20 | about $1.20 |

  Before: $1.20 quoted against a $3.20 bill at the shipped default, $12.00 at 30.

- The mount itself ran (a minimal document stub, in the spec): the host's only child is
  `.mpi-prompt-box__slider-lbl`, reading `Duration` / `8 s`. No track, no bar.

## Not done, on purpose

- The Model Library tile already asked Veo bare and reads "per clip"
  (`MpiModelManager.js:729`) — untouched, and unaffected by the precedence swap.
- No CSS: the label row is the existing `slider-lbl` markup. `MpiPromptBox.css` is
  MPI-852's claimed file and was not opened.
