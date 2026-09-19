# MPI-816 — checklist

Full reasoning, the log extract and both fixes located to the line: `plan.md`.

- [ ] **Confirm which defect fired.** Log the dispatched `fields` object in `_submitFlow`
      (`js/shell/agentDispatch.js`), re-run Fabio's four-sheet request, capture what the agent
      actually sent for `Input_Recipe` and `Input_Quality`. Remove the log afterwards.
- [ ] **Fix A — a null value must not clobber a declared default.**
      `js/utils/declaredFields.js:500`, in `resolveFlowFieldValues`: skip `null` and `undefined`
      caller values so line 499's declared default survives.
- [ ] **Fix B — tell the agent what a field takes.** `js/shell/agentDispatch.js:488`: include
      `type`, `default` and `options` (`{v, label}`) per declared field. UI-only keys
      (`rows`, `icon`, `columns`, `inline`, `info`) stay out.
- [ ] **Sweep the shared primitive.** `resolveFlowFieldValues` serves every flow on the agent
      path. Check no flow relies on the current clobbering before landing Fix A.
- [ ] **Update `skills/cubric-vision-flows/SKILL.md`** to match the new `list-models` payload,
      and state that a null is treated as omitted.
- [ ] **Decide on the separate narration bug** (the agent reported four sheets as started after
      four dispatches had already failed) — fix here or its own card.
