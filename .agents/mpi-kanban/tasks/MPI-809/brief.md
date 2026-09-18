# MPI-809 — A removed project-paths entry comes back, and there is no unregister UI

Found 2026-09-18 while clearing ten stale agent-scratch parents out of the
external-project registry. Nine stayed removed. The tenth — a bare
`C:/Users/Fabio/AppData/Local/Temp` — was back within two minutes, with no user
action in between.

## Two defects, one card

### 1. The registry cannot be cleaned (the expensive one)

`list-projects` migrates **every caller-supplied `extraPaths` entry** into the
durable registry, unconditionally:

```js
// routes/projects.js:829-831
const normExtra = extraPaths.map(p => String(p).replace(/\\/g, '/'));
for (const p of normExtra) {
    await addProjectPathToRegistry(p);
}
```

The renderer sends its localStorage mirror (`mpi_extra_project_paths`) on every
call (`js/services/projectService.js:251`). The registry itself is a single
shared file under `<Documents>` that every app instance and every connector
client writes to.

So a removed entry only stays removed once **no client anywhere** still holds it
in its own mirror. Clearing one renderer's localStorage fixes one copy; the next
`list-projects` from any other client puts the entry straight back. There is no
sequence of user actions that removes an entry for good.

The self-heal was added so external projects survive a portable-folder delete or
reinstall (`docs/project-integrity.md` § External Projects). That goal is already
met by the registry being durable and in `<Documents>` — the mirror is the part
that has outlived its purpose.

### 2. Nothing calls `/remove-project-path`

The route exists (`routes/projects.js:900`) and works. Nothing in `js/` calls it
— grepped the whole renderer. The only registry pruning a user can reach is the
`delete-project` side effect, which prunes a parent only when no sibling
`project.json` remains under it (`routes/projects.js:1012`).

Consequence: a parent that holds no project directly — such as a bare `%TEMP%` —
can never be pruned through the UI at all, because there is no project under it
to delete. Clearing the ten entries needed a DevTools console call by hand.

## Why the `%TEMP%` entry is worth fixing, not just removing

`%TEMP%` holds **970 folders with a `project.json` directly inside it** (851
`gif-test-*`, 111 `gif-cutout-test-*`, 8 `agent-memory-*`), left by
`tests/gif-frames.test.cjs`, `tests/gif-cutout.test.cjs` and
`tests/agent-memory.test.cjs`, which all `mkdtemp` into `os.tmpdir()` directly.

Those fixtures never touch the registry — they are not the writer, and they are
not this card. But while `%TEMP%` is registered, every `list-projects` readdirs
the whole temp tree and stats a `project.json` for each entry, and each hit is a
candidate project with a thumbnail scan behind it. That is what made this the
worst of the ten.

## Evidence (2026-09-18, local times; app.log stamps are UTC)

- 14:05 — `[ui] [MpiContextMenu] select delete`, the scratch project removed.
- ~14:07 — ten parents unregistered by hand; registry read back as **1 entry**.
- 14:09:22 — registry mtime; `%TEMP%` **back**, registry now 2 entries.
- Only one app instance was running throughout (Electron, started 13:41).
- Ruled out as the writer: the temp fixtures above (no registry calls) and
  `scripts/agent-test.mjs` (stubbed project tools, `fakeTools`, line 107).
- A second agent session was driving the app in the same window (a `userFlows
  install` at 14:15 from another session's scratchpad). Suspected holder of the
  stale mirror, not proven.

## Fix options

1. **Drop the localStorage mirror.** The registry is already the source of truth
   and already durable; `extraPaths` then stops being an input to
   `list-projects` at all. Removes the whole class. Touches
   `js/services/projectService.js` (3 call sites), `js/core/storage.js`,
   `js/core/storageKeys.js`, `routes/projects.js`.
2. **Stop the route trusting caller input** — keep the mirror for migration but
   make the write one-shot (a migration flag) rather than every-call.

(1) is the smaller end state. Either way the two `Storage.setExtraProjectPaths`
writers in `openProject` / `addProjectByFolder` go, since their only consumer is
the send-back.

Separately, expose unregister in the UI, or accept that it is server/API-only
and say so in the docs (done — `docs/project-integrity.md`, commit `8f477ab9`).

## Verification

A removed entry must still be absent after: a Landing reload, a project open and
return, and a second client (connector or a second instance) calling
`list-projects`. Today the third step alone re-adds it.

Out of scope: the 970 temp fixture folders. Worth its own card — the specs
should `mkdtemp` into a subfolder, not the temp root.
