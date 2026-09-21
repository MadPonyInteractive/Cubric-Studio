# MPI-874 — `cardName` is silently ignored on a Flow submit

Found on 2026-09-21 during MPI-864's tile art, from a screenshot of the gallery: five
outpaint runs and three model runs went out in the same session, every one of them carrying
a `cardName`. The three model cards are named. The five Flow cards are not.

## The evidence

| Card | Route | `cardName` sent | Landed as | `name` in the sidecar |
|---|---|---|---|---|
| `t2i_002` / `t2i_004` | model op | `MPI-864 Gemini 3 tile` | **`MPI-864 Gemini 3 ti…`** ✔ | set |
| `t2i_003` | model op | `MPI-864 Nano Banana 2 tile` | **`MPI-864 Nano Banana…`** ✔ | set |
| `flowOutpaint_001`…`_005` | `flowId: 'outpaint'` | `MPI-864 <model> 4:5` | `flowOutpaint_00N` ✘ | `None` |

Silent: the submit returns `ok: true` and the reply's `output` simply carries no `cardName`.
Nothing in the response says the name was dropped.

## What is already known

- `routes/connector.js:521` puts `cardName` on the input for BOTH shapes — `if (cardName
  !== undefined) input.cardName = cardName;` sits after the branch, so the Flow path carries
  it too.
- `js/shell/agentDispatch.js:565` — the Flow path's `onComplete` — does pass it:
  `onComplete: (done) => _reportDone(jobId, done, input.cardName)`. Compare the model path
  at `:322`, which passes the same thing plus a duration and a model id.
- `_reportDone` (`:115`) renames through `renameGroup(group.id, cardName)` and only when
  `group?.id` is truthy. **That is the first place to look**: if a Flow's `done` carries no
  `group`, the rename is skipped and the `undefined` check never fires.

So the plumbing is present end to end and something at the last step drops it. This is a
one-line bug with a two-line test, not a feature.

## What ships

- The fix, wherever `group` goes missing on the Flow path.
- A test that submits a Flow with a `cardName` and asserts the landed card carries it —
  the model-op twin of that assertion presumably already exists (MPI-776 added `cardName`);
  mirror it rather than inventing a shape.
- **If a name genuinely cannot be applied, say so** rather than returning `ok: true` with a
  silent drop. A named error beats a quiet no-op, which is the same rule the named params
  follow (`INVALID_RATIO` and friends).

## Documentation that is currently wrong

`.claude/skills/cubric-vision-generate/SKILL.md` § "Naming the card" states it plainly:
*"`cardName` names the card the moment the run lands, on a model op and on a Flow alike, and
the reply carries `output.cardName`."* Half of that is false today. Fix the code, not the
sentence.

Related: [[MPI-873]], found in the same run — an agent submit cannot name its project.
