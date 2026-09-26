# MPI-944 - a two-picture edit goes to Boogu, which takes one image

## The job that failed

Two photos of one room from different angles: A furnished, B empty. Ask: "put A's furniture
into B, placed as seen from B's angle". Same shape as the character case: a character in shot A,
the same place from another angle empty in B, put the character into B where they belong.

Right call: an editor with a second image slot, B as `inputImage` (the picture edited), A as
`inputImage2` (the reference). Slots per op, from `mediaRolesFor`:

| Op | Image slots |
|---|---|
| Boogu `edit` (high, balanced) | **1**: `inputImage` only |
| `kleinEdit` (klein-9b, klein-4b) | 3 |
| `qwenEdit` | 3 |
| `krea2Edit` | 2 |
| cloud `edit` with `multiReference` (Nano Banana family, collaged into its one image by `routes/deepinfra.js`; Seedream / FLUX-2 native numbered fields) | 4 (8 on `multiReference8`) - PAID-ranked, picked only when the user names one |

## Seen live (tester's 1.6.2 app.log, 2026-09-26)

The agent tried `klein-9b:kleinEdit` first, twice: `input_asset_deleted` (21:22), then
`OP_UNAVAILABLE` while the Pod was gone (21:33). It then fell back to `boogu-edit-high:edit`
for `edit_001` to `edit_003`: one image by construction, so the furniture was invented from text.
`edit_004` to `edit_012` ran `kleinEdit`; the log cannot say with how many images. The record is
the sidecar's `generationSettings.mediaItems`, never app.log (`docs/agent-findings.md` rule 4).

## Reproduced offline (2026-09-26)

`scripts/agent-test.mjs` machinery, real agent model (`deepseek-ai/DeepSeek-V4-Flash-0731`),
fake tools, 3 runs each, $0.05 total. Cases: `research/refs-cases.mjs`.

| Case | Editors installed | Both pictures sent, B as `inputImage` |
|---|---|---|
| `room-friend` | boogu-edit-high + klein-9b | **1/3** |
| `room-all` | boogu-edit-high, klein-9b, qwen-edit, krea2 | 3/3 (always qwenEdit) |
| `character-angle` | same as `room-all` | 2/3 |

Every failure is the same: `boogu-edit-high:edit` with B only. The agent had looked at both
pictures and understood the task. Its prompt still said "the same furniture as in the other
photo", and its reply claimed "taking the woman from your first photo": a claim about an image
the model never received. Every pass put B in `inputImage` and A in `inputImage2`.

## Root cause

1. `modelPriority.js` ranks `boogu-edit-high:edit` #1 for the `edit` task. Its note says
   "takes exactly one image" but not what that rules out, so the rank wins.
2. `docs/agent/models/flux-2.md` § Pick it when sends "copied out of a second or third image"
   to `qwenEdit` only. With Qwen not installed, nothing names `kleinEdit` / `krea2Edit`, and
   the pick falls back to rank 1.

Same family as MPI-916: an op note has to say what the op is NOT, at the moment it is chosen.

## Fix (data the agent reads, no system-prompt line: agent-findings rules 1-2)

1. `modelPriority.js` NOTES for both Boogu tiers: add that it is never for bringing something
   in from another picture; that needs an editor with a second image slot (`kleinEdit`,
   `qwenEdit`, `krea2Edit`).
2. `flux-2.md` Pick it when: the second-image line names `qwenEdit`, or `kleinEdit` /
   `krea2Edit` when Qwen is not installed. Add the load order in one line: the picture being
   changed is `inputImage`, the picture holding the content is `inputImage2`.
3. Move the three cases into `scripts/agent-test.mjs` (flip = only B attached, so the
   assertion can see a one-image run). Done = 3/3 on all three, and `--bite` bites.
4. Only if 1-2 do not reach 3/3: a tool-result line when an op with one image slot runs in a
   turn with 2+ pictures attached. Not before.

Run `tests/agent-prompt-budget.test.cjs` after (notes ride in the tools catalogue). Outside
agents over MCP read the same `GET /connector/models` notes, so the fix reaches them too.
Add a finding to `docs/agent-findings.md` when it ships.

## Out of scope

Whether the models can actually redraw the content from a reversed viewpoint. This card is
routing only. `flux-2.md` already records about one in three multi-reference placements
silently dropping a subject on Klein 9B. A real-render test with two real photos is its own job.
