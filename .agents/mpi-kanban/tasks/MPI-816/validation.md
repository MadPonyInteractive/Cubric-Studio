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

🔴 **The end-to-end verify, and it is the only one that closes this card.** Ask the agent, in
Fabio's own words, for four character sheets of four sisters. **Four cards land.** A green unit
suite with no image on screen is not a fix — the unit tests here all passed before the bug existed,
because none of them exercised the agent path.

## Not to be confused with MPI-774 fix 8

Different failure, different layer. Fix 8 was `hostbuf_file_reader_read failed` inside the engine
during weight streaming, closed unreproduced 2026-09-19. This one never reaches the GPU: ComfyUI
rejects the graph at validation, before execution. If a flow run fails here, read which of the two
error strings is in the log before reasoning about either.
