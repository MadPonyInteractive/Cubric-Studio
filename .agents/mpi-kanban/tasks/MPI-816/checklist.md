# MPI-816 — checklist

Full reasoning, the log extract and both fixes located to the line: `plan.md`.

- [x] ~~**Confirm which defect fired.** Log the dispatched `fields` object in `_submitFlow`~~
      **Not needed, and dropped deliberately.** The unit test now reproduces the failure from
      the resolver's own behaviour: `resolveFlowFieldValues(character-sheet, {Input_Recipe: null})`
      returned `null`, which is exactly the `MpiInt 671: int, None` in his log. Defect A is
      confirmed as sufficient on its own; which value the agent sent only decides whether B was
      *also* in play, and B is fixed regardless. A temporary log plus a live four-sheet re-run to
      learn nothing that changes the work is not worth Fabio's GPU.
- [x] **Fix A — a null value must not clobber a declared default.**
      `js/utils/declaredFields.js`, in `resolveFlowFieldValues`: `null` and `undefined` caller
      values are skipped so the declared default survives.
      **Verified:** red then green — `{Input_Recipe: null, Input_Quality: undefined}` now resolves
      to `1`/`1`; a real value (`Input_Recipe: 3`) still wins; `0` is still a value, not an absence.
- [x] **Fix B — tell the agent what a field takes.** Now `agentFieldSpecs(flow)` in
      `js/utils/declaredFields.js`, called from `js/shell/agentDispatch.js`: `{id, label, type}`
      plus `default`, `options` (`{v, label}`) and `min`/`max` where declared. `info`, `note` and
      the UI-only keys stay out.
      **Verified:** Character Sheet's `Input_Quality` carries `type: 'radio'`, `default: 1` and
      both options; chatter-box ships its 23 languages; a test asserts no UI-only key leaks.
      **Moved out of the call site on purpose** — `agentDispatch.js` imports the router, state and
      six services, so it cannot be loaded outside a renderer, and an untestable projection is how
      this bug shipped. `declaredFields.js` is where the dialect already lives (MPI-580).
- [x] **Sweep the shared primitive.** `resolveFlowFieldValues` has exactly ONE non-test caller —
      `js/shell/agentDispatch.js:288`, the connector path. The UI collects from live widgets and
      never reaches it, so nothing depended on the clobbering. Full suite: 1360 pass, 0 fail.
- [x] **Update `skills/cubric-vision-flows/SKILL.md`** — the `fields` row states that a declared
      field sent as `null` is omitted (and that `0`/`''` are not), and a new paragraph documents
      the self-describing field payload plus the trap that an option is chosen by its `v`, not its
      label.
- [ ] **The end-to-end verify, and it is the only one that counts:** ask the agent, in Fabio's own
      words, for four character sheets of four sisters. **Four cards land.** Needs his app and his
      GPU — nothing an agent can substitute.
- [ ] **Decide on the separate narration bug** (the agent reported four sheets as started after
      four dispatches had already failed). Fabio's call: here, or MPI-774 Phase 7, or its own card.
