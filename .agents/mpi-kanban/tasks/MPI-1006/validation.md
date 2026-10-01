# MPI-1006 Validation

Auto for recipe checks + tests; Fabio reads two Enhanced ref2v prompts before close.

## Phase 2 (build) - 2026-10-01, Agent 81

- Unit: `tests/llm-service.test.cjs` 32/32 (new `testEnhanceRunsTheOpsMode`: seedance ref2v -> r2v,
  i2v -> i2v, H3 ref2v_ms -> r2v, i2v_ms -> i2v, kling i2v -> i2v, wan ref2v -> t2v; the
  "Attached references" line is sent on r2v only), `recipe-registry` 10/10, `agent-corpus`
  11/11, `enhance-overlay` 19/19, `agent-prompt-budget` + `in-graph-enhance` 81/81.
- Every example prompt of all three modes passes the harness's deterministic checks; the new
  tag check catches a dropped, a re-cased and an invented tag (scratchpad `check-examples.mjs`).
- `npm test`: 2602/2605 at first run; the one real failure is MPI-1005's `agentReview`
  (master red on 2eb6bea46, not this card; messaged 28809bcb).

## Phase 3 (Stage 1 sweeps) - engine gemma-4-abliterated-12b, judge gemma-3-12b, 3 runs, local

| Sweep | Mode / tiers | Result | Change after it |
|---|---|---|---|
| s1 | r2v plain | 0/15: every run invented `@image1` on tag-less input | no-tag rule made explicit; t2v condense wording; voice tag without a line gets no braces |
| s1 | r2v ref (tags in text) | 10/12: overlong 225 words (walked the input, kept armour/hair, two lenses, invented a line; judge passed it) | (same) |
| s2 | r2v plain / ref | 2/15 / 11/12 (`35mm`) | framing: tags MAY appear; two named output shapes; t2v mm ban |
| s3 | r2v plain / ref | 12/15 / 10/12 (201 words; "35mm anamorphic") | a person named in words stays in words; condense 100; lens type stays a look |
| s4 | r2v plain / ref | 12/15 (directed 0/3: "the cowboy from @image1") / 11/12 (233 words) | escalated; Fabio picked (a): tell Enhance what is staged |
| confirm | t2v plain | **15/15** | none (only its ban list moved) |
| confirm | i2v plain | **15/15** | none |
| s5 | r2v ref (attached line, 2 untagged + 2 tagged) | **12/12** | |
| s5 | r2v plain (no line at all) | 0/15: absence read as "references exist, unnamed", all invent `@image1` | the app always sends the line on r2v, `none` when nothing is staged; harness mirrors it |
| s6 | r2v ref (attached line) | **12/12** (green twice with s5) | |
| s6 | r2v plain ("none" line) | 9/15 (4 invented tags, 1 `35mm`, 1 judge wanting anchor lines) | stopped: only reached by Enhance before anything is staged; Fabio rules Enhance edge cases non-blocking for video |
| s6 | **H3 r2v** plain, now with the line | **15/15** | none |

Final `npm test`: 2619 pass, 0 fail (master green again after MPI-1005's 79e7e7006).

Known limitations (read outputs, not the count):
- Enhance pressed before staging anything can still add an `@image1`.
- The condense tier can keep a tagged subject's looks, name an emotion, or write "masterpiece";
  the judge passes them. Seen in s6 overlong run 1.

## Close - 2026-10-01

- Fabio read the two Enhanced ref2v prompts (untagged cat, tagged samurai with its known looks leak): "1, close it".
- Claim audit: 9/9 claims proven, no findings.
- Code commit a33a41b35: CI run 36840547687 (tests.yml) **success**.
