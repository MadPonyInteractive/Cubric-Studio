# One Library link on the landing page, with a Models | Flows switcher

## Current State

- Project mode: scalable-foundation.
- Landing nav (`js/shell/projectUI.js:67-79`) has two separate links, `Models` (`models:open`)
  and `Flows` (`flows:open`).
- Both libraries are lazy singletons in `js/shell.js:537-558` (`_modelLibrary`, `_flowLibrary`),
  each self-hosting an `MpiOverlay`; `el.open()` shows, `el.close()` hides
  (`MpiModelManager.js:1737`, `MpiFlowLibrary.js:1221`).
- `flows:open` runs `blockedByNoEngine()` (`js/services/engineGate.js`) before opening;
  `models:open` deliberately does not (MPI-856: cloud-only users browse models).
- Header titles: `MpiModelManager.js:70` (`Model Library`), `MpiFlowLibrary.js:141` (`Flows`).
- Landing vs project = `state.currentProject === null`.
- No spec clicks the landing Models/Flows links (grep of `tests/`), so nothing breaks there.

## Decisions (settled with Fabio, 2026-10-15)

- Landing shows ONE `Library` link, emitting `models:open` (Model Library is the default tab).
- Both library headers show a `Models | Flows` switcher **only when no project is open**;
  inside a project the plain `<h1>` title stays and nothing changes.
- The switcher is an existing `MpiRadioGroup` (`size: 'sm'`), value = the library it sits in.
  No new component.
- Switching lives in the SHELL, not the components: `models:open` closes `_flowLibrary`;
  `flows:open` closes `_modelLibrary` **after** `blockedByNoEngine()` passes. So with no
  engine, clicking Flows shows today's install prompt and the Model Library stays open.
  The switcher itself only emits the open event.
- Switcher visibility is re-evaluated on every `el.open()` (a singleton outlives project changes).
- A no-engine refusal leaves the Model Library's radio on `Models` (reset the value on refusal,
  or set it from the open event, not from the click).
- Out: remembering the last tab, combined search.

## Implementation

- [ ] Landing link, header switcher in both libraries, close-the-other in the shell's two
  open handlers, docs lines. **Verify:** `npm run lint` clean on touched files; in
  `npm run app:isolated` (own profile + port, never `:3000`): landing shows `Library`,
  it opens Models with the switcher, Flows/Models swap in place both ways, Escape closes;
  open a project → gallery Flows button and Tab open Flows with NO switcher; with the engine
  install skipped, clicking Flows shows the install prompt and Models stays open with
  `Models` still selected.

Files: `js/shell/projectUI.js`, `js/shell.js`,
`js/components/Organisms/MpiModelManager/MpiModelManager.{js,css}`,
`js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.{js,css}`, `js/components/types.js`
(JSDoc for both), `docs/model-library.md`, `docs/flows.md`.

## Completed

- [ ] Nothing yet.

## Remaining Work

- Implement the planned change end to end.

## Plan Drift

- None yet.

## Verification

**Verify mode:** user-ux

Look-and-feel surface: Fabio judges the switcher in the running app. Agent first runs lint
plus the isolated-app walk in `## Implementation`, screenshots landing + both tabs + the
in-project Flow Library, then hands over.

## Preservation Notes

- Doc drift: component wiring changes (two open handlers now close each other) → ask
  "Should I update `.claude/rules/`?" at close (component-events map).
- `js/events.js:191` still describes `models:open` as a slide-over; stale before this card,
  mention, don't fix unless asked.
