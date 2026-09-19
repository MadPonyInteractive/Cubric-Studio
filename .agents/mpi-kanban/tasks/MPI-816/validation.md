# MPI-816 — validation

*Nothing built yet. This file states what each item has to PROVE, written before the work so the
bar cannot drift to whatever happened to pass.*

## The evidence this card was opened from

Fabio, 2026-09-19 ~06:24, testing the in-app agent. He asked it to create a project with an 1870s
cowgirl narrative and four character sheets for four sisters. Four `generation.submit` jobs, four
instant failures, and the agent then described all four sheets as on their way.

From `%APPDATA%\Cubric Studio\logs\app.log`, four times:

```
[comfy] [ERROR] * MpiInt 671:
[comfy] [ERROR]   - Failed to convert an input value to a INT value: int, None, ...
[comfy] [ERROR] * MpiInt 770:
[comfy] [ERROR]   - Failed to convert an input value to a INT value: int, None, ...
[comfy] [WARNING] invalid prompt: {'type': 'prompt_outputs_failed_validation', ...}
```

Node 671 is `Input_Recipe`, node 770 is `Input_Quality` (by `_meta.title` in
`comfy_workflows/flow_character_sheet.json`; both carry valid ints on disk, 3 and 1). They select
`Recipe_Select` and the `Width_Select`/`Height_Select` banks, so a null there takes the whole
graph down — outputs 882, 493 and 673 all ignored.

## What each item must prove

**Confirm step.** The captured `fields` object, quoted verbatim, showing what the agent sent for
those two ids. This is the one fact the diagnosis is missing; everything else is read off the code.

**Fix A.** A unit assertion that `resolveFlowFieldValues` with `{Input_Quality: null}` returns
`Input_Quality: 1` (the declared default), AND that a real value still wins over the default. Both
directions, or the guard could be a blanket ignore of caller input.

**Fix B.** The connector's model list, fetched for real, showing Character Sheet's `Input_Quality`
carrying `type: 'radio'`, `default: 1` and both options. Not a unit test of the mapper — the
payload as an agent receives it.

**Sweep.** Name every flow with a defaulted non-string declared field and confirm none depended on
the old clobbering. A list, not an assurance.

✅ **The end-to-end verify — PASSED 2026-09-19, 09:45–09:48Z.** Ask the agent, in Fabio's own words,
for four character sheets of four sisters. **Four cards landed.** A green unit suite with no image
on screen is not a fix — the unit tests here all passed before the bug existed, because none of them
exercised the agent path. This one did.

**Where it ran.** Fabio's own app on `:3000`, his DeepInfra key, his engine, his GPU, after he handed
the run over ("you know what the tests are, I'm going to leave it in your hands"). Driven over
`POST /agent/message`, the same route the chat box uses, with his exact wording as the prompt.

**The tool sequence** (`GET /agent/history`), which is the whole fix visible in one line:

```
create_project → list_models → describe_model(character-sheet)
→ read_knowledge(guide:krea-2) → write_memory → generate ×4 → look ×4
```

`describe_model` is what Fix B became after the catalogue diet (MPI-774 Phase 7): the field specs it
returns for `character-sheet` are exactly what this card added, now fetched for the one Flow the
agent picked instead of shipped for all 21 models. Each `generate` carried
`{Input_Recipe: 1, Input_Quality: 1, Input_is_Turbo: true, Input_Remove_Head: true}` — real declared
values, no nulls, which is the failure this card existed to fix.

**The four cards, from `project.json` after the run** (project `Cowgirl Sisters - Western 1876`,
created and opened by the agent in the same turn):

| card | `customName` | media |
|---|---|---|
| `flowCharacterSheet_001` | Eldest Sister — Leader | 1,754 KB |
| `flowCharacterSheet_002` | Second Sister — Sharp-shooter | 1,762 KB |
| `flowCharacterSheet_003` | Third Sister — Tracker | 1,917 KB |
| `flowCharacterSheet_004` | Youngest Sister — Wildcard | 1,784 KB |

Engine times 47.4s, 33.8s, 33.2s, 33.3s, all `Prompt executed`, no error line in `app.log`.

**The image was opened, not just the log.** `flowCharacterSheet_001.png` is a real sheet — front,
back and portrait panels — and it matches the note the agent wrote before generating: early thirties,
near-black hair in a low practical braid, long duster over a leather vest, holster. The front view's
face is masked grey because the Flow's own shipped default is `Input_Remove_Head: true`
(`comfy_workflows/flow_character_sheet.json` node 737), which the agent passed rather than overrode.

**Also cleared, same run:** the project note landed in the project the agent had just created, not in
a neighbouring project of the same name (MPI-774 Phase 7, `create_project` now opens what it made),
and the narration matched reality — four dispatches, four cards, nothing claimed that did not happen.

## Not to be confused with MPI-774 fix 8

Different failure, different layer. Fix 8 was `hostbuf_file_reader_read failed` inside the engine
during weight streaming, closed unreproduced 2026-09-19. This one never reaches the GPU: ComfyUI
rejects the graph at validation, before execution. If a flow run fails here, read which of the two
error strings is in the log before reasoning about either.
