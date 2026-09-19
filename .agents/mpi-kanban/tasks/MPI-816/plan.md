# MPI-816 — Agent flow runs die on declared fields it was never told how to fill

**Umbrella: MPI-817 (in-app agent reliability), Phase A.** This card keeps its own plan, checklist
and validation; the umbrella carries the phase ordering.

*Found live 2026-09-19 by Fabio, testing the in-app agent. Diagnosed same day, session a2e84759.
Not built — the diagnosis below is complete to the line, the confirm step is one logged dispatch.*

## What he saw

He asked the agent, from the main page, to create a project with an 1870s cowgirl narrative and
four character sheets for four sisters. The agent did everything right — created the project, read
its skills, wrote four briefs, dispatched four generations — and **all four failed instantly**.
Chat said "The generation failed. See the app log for the cause." four times, then cheerfully
reported all four sheets were on their way. Nothing was.

From `%APPDATA%\Cubric Studio\logs\app.log`, 2026-09-19 06:24:47-48, four times:

```
[connector] Agent job 8dd64d3d-...: generation.submit
[comfy] [ERROR] Failed to validate prompt for output 882:
[comfy] [ERROR] * MpiInt 671:
[comfy] [ERROR]   - Failed to convert an input value to a INT value: int, None,
                   int() argument must be a string, a bytes-like object or a real number,
                   not 'NoneType'
[comfy] [ERROR] * MpiInt 770:
[comfy] [ERROR]   - Failed to convert an input value to a INT value: int, None, ...
[comfy] [WARNING] invalid prompt: {'type': 'prompt_outputs_failed_validation', ...}
[comfy] Workflow failed: flowCharacterSheet / null — Error: Prompt outputs failed validation
```

`flowCharacterSheet / null` is normal — a Flow runs with `model.id: null` by design.

In `comfy_workflows/flow_character_sheet.json` those two nodes are, by `_meta.title`:

| node | title | template value |
|---|---|---|
| 671 | `Input_Recipe` | `3` |
| 770 | `Input_Quality` | `1` |

Both carry valid ints on disk and both arrived as `None`. They drive `MpiAnySwitch` banks
(`Recipe_Select`, and `Width_Select`/`Height_Select` which pick 1280x800 vs 1792x1120), so a null
there takes out the whole graph — outputs 882, 493 and 673 all ignored.

## Two defects, both real, either one alone is enough to break it

### A. A null caller value clobbers a declared default

`js/utils/declaredFields.js:493-507`, `resolveFlowFieldValues`:

```js
const resolved = {};
decls.forEach((f) => { if (f.default !== undefined) resolved[f.id] = f.default; });
Object.entries(values || {}).forEach(([k, v]) => { if (declared.has(k)) resolved[k] = v; });
```

Line 499 applies the declared defaults correctly (`Input_Recipe` default 1, `Input_Quality`
default 1 — both live in the flow's top-level `fields`, and `flowDeclaredFields` does include
those). Line 500 then lets **any** caller value overwrite them, `null` and `undefined` included.
There is no guard. The UI never sends null — every widget holds a resolved value — so this is
reachable only from the agent connector, which is why it has never bitten before.

`skills/cubric-vision-flows/SKILL.md:39` states the contract this breaks: *"Omitted fields take the
flow's default."* A field sent as null is morally omitted and must take the default too.

**Fix (one line, at the shared resolver both surfaces use):**

```js
Object.entries(values || {}).forEach(([k, v]) => {
    if (declared.has(k) && v !== null && v !== undefined) resolved[k] = v;
});
```

Root cause, not a symptom patch: the resolver is the single place the field dialect is interpreted
(MPI-580 extracted it precisely so there is one). Do NOT null-guard at the injection site.

### B. The agent is told field ids and labels, and nothing else

`js/shell/agentDispatch.js:488` — `agent.list-models` advertises each flow's fields as:

```js
fields: flowDeclaredFields(flow).map(f => ({ id: f.id, label: f.label || f.id })),
```

No `type`, no `default`, no `options`. So the agent is handed `Input_Quality` / "Quality" and
`Input_Recipe` / "Style" with no way to know they are 1-indexed ints into a switch bank, that
Quality accepts only 1 or 2, or that omitting them is safe. It cannot construct a valid value and
cannot know it should stay silent.

**Fix:** include `type`, `default` and `options` (the `{v, label}` pairs) for every declared field.
The data is already on the FlowDef; this is a projection change, not new state. Keep it to what a
caller needs to choose a legal value — `info` strings and UI-only keys (`rows`, `icon`, `columns`,
`inline`) do not belong in an agent payload.

**Then update `skills/cubric-vision-flows/SKILL.md`** so the vocabulary it documents matches what
`list-models` now returns, including that a null is treated as omitted.

## Not yet confirmed

**Which of the two actually fired on his run.** Either the agent sent explicit nulls for the two
fields (defect A alone), or it sent something else that resolved to null. The connector logs job
ids only, not payloads (`routes/connector.js:480` passes `fields` straight through). One line of
logging on the dispatched `fields` object, then re-run his exact request, settles it. Fix both
regardless — B is why the agent could not get it right, A is why getting it wrong is fatal instead
of falling back.

## Checklist

- [ ] Log the dispatched `fields` in `_submitFlow`, re-run the four-sheet request, capture what the
  agent actually sent. Remove the log afterwards.
- [ ] Fix A — null/undefined no longer clobbers a declared default, in `resolveFlowFieldValues`.
      **Verify:** a unit assertion that `resolveFlowFieldValues(characterSheet, {Input_Quality: null})`
      returns `Input_Quality: 1`, and that a real value still wins over the default.
- [ ] Fix B — `agent.list-models` returns `type`, `default` and `options` per field.
      **Verify:** `GET` the connector's model list, assert Character Sheet's `Input_Quality`
      carries `type: 'radio'`, `default: 1` and both options.
- [ ] Update `skills/cubric-vision-flows/SKILL.md` to match.
- [ ] **The real end-to-end verify, and it is the only one that counts:** ask the agent, in his own
      words, for four character sheets of four sisters. Four cards land. Anything less is not fixed.

## Sweep — this is a shared-primitive bug

`resolveFlowFieldValues` serves EVERY flow on the agent path, not just Character Sheet. Any flow
with a defaulted non-string field has the same hole: `Input_Recipe`, `Input_Quality`,
`Input_is_Turbo`, `Input_Remove_Head` here, and the equivalents on Text to Speech, Drama Box,
Head Swap and Outpaint. One fix at the resolver covers all of them — check no flow depends on the
current clobbering behaviour before landing it.

## A separate, smaller thing seen in the same transcript

The agent reported all four sheets as started and described them in detail **after** four
`generation.submit` calls had already failed. Worth a look while in here: a dispatch that failed
should not be narrated as success. May belong on its own card.
