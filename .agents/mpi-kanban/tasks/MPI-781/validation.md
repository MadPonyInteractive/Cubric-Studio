# MPI-781 Validation

Implemented 2026-09-19. Phases 1–4 done in the app repo; the live proof is Fabio's.

## Ran and passed

| Check | Result |
|---|---|
| `COMFY_URL=http://127.0.0.1:48188 node scripts/lint-flow-package.mjs <both packages>` | ✓ both clean — graph rules, markup rule, ids, injector, and every node class present on the SHIPPED engine. The only reported problem is the deliberate `minAppVersion: 2.0.0` floor against this 1.6.1 checkout; with the floor lowered in a scratch copy both report `✓`. |
| `node --test` in `c:\AI\Mpi\Cubric-Flows` | ✓ 7 tests, 0 fail — the ported graph guards |
| `npm test` (app repo) | ✓ **1348 pass, 0 fail**, exit 0. Run twice cleanly. (A `fail 4` appeared once when two suites were launched inside one shell invocation — port/SSE contention, not a real failure. Two clean single runs are green.) |
| The 3 edited desktop specs — `flow-packages`, `flow-library-skips-drawer`, `flow-close-destroys-instance` | ✓ **6 passed**, on port 50946 with a private `--output` dir. `npm test` does NOT run these, so they would have gone red unnoticed. Includes the repointed *"a packaged Draw It In shows the licence gate the built-in one does"*. |
| `npm run release:check` | Four failures, **byte-identical to the run before this card's first edit**: missing 1.6.0/1.6.1 archival release notes, and smoke-evidence stale against the 0.34.0 engine pin. **No operation-registry, universal-workflow or command-registry failure** — that is the half this card touches, and it is clean. |
| Package built from `scribble-object` the way `flow-packages.spec.js` builds it | ✓ lints clean, which is what proved the spec's new fixture valid (object-form `requiredModels` is accepted) |

## Not verified — needs Fabio (`user-ux`)

The plan's phase 1 live proof. No sandbox can stand in for it:

1. Drop `c:\AI\Mpi\Cubric-Flows\head-swap` and `…\drama-box` on the Flow Library.
2. Both appear as tiles and run a real generation.
3. Head Swap's drawer shows the **Klein 9B licence gate**, unaccepted, before it will run.

**This cannot be done until the app is stamped 2.0** — both manifests declare
`compat.minAppVersion: 2.0.0` and this checkout is 1.6.1, so the loader refuses them by
design. Either land MPI-708's version stamp first, or lower the floor in a scratch copy of
each folder for the test and restore it after. The floor is correct for the shipping
artifact and was left at 2.0.0 deliberately.

## Known, deliberate, and left

- **`flowHeadSwap` / `flowDramaBox` stay in `operationRegistry.js` + `operation_registry.json`,
  marked `deprecated: true`.** Required by `docs/playbooks/add-model/README.md` § "Deprecating
  ONE operation": the keys exist so a history item written by a dev build still validates.
  `release-health-check.mjs` excludes deprecated ops from its command-registry cross-check,
  which is what lets the commands go while the keys stay. Fabio has run Head Swap in his own
  app this month, so this is not hypothetical.
- **Every dep entry survives** — `klein-9b-lora-headswap`, the 16 `dramabox-*` assets and the
  `ComfyUI-MelodramaBox` pin, each now carrying a comment saying nothing in the app declares
  it and why it must not be deleted. `_orphanedDepIds` iterates `DEPS`; deleting an entry
  strands the weight on users' disks forever.
- **`headSwapInjector.js` and its `index.js` registration stay.** The package reaches it by
  name (`"injector": "headSwap"`); deleting it would take the boxes with it.
- **Guards that moved rather than died.** Four assertions needed the departed graphs and now
  live in `c:\AI\Mpi\Cubric-Flows\checks.test.cjs` (7 tests, zero dependencies): the box
  overflow/pad pairing, the `Input_Positive` join after the baked instruction, DramaBox's
  sampler fork, and its baked negative. Each app-repo site left a comment pointing there.
- **One law is now one-sided.** `tests/flow-required-media.test.cjs` could check both
  directions while DramaBox shipped — a slot may declare `required: false` only when the
  graph forks. No surviving flow has an optional media slot, so the sweep can now only catch
  a `required: false` without a fork, never a fork wrongly marked required. Said out loud in
  the file.
- **`tests/desktop/flow-library-skips-drawer.spec.js` lost half its CI trap.** Its fixture
  moved to `scribble-object`, which declares no deps, so the dep-cache stub is a no-op. The
  stub is kept and reads off the descriptor, so a future dep re-arms it. Noted in the header.

## Adjacent fix, made deliberately, not silently

`docs/releases/UNRELEASED.md` said "Fourteen to start with" and listed fourteen Flows, but
never listed **Song** (`minimax-music`), which ships. Removing two Flows meant the count had
to change, so rather than write a new wrong number the list now names Song and reads
"Thirteen", which matches the registry.

## Not pushed

The commit is on local `master` and **`.husky/pre-push` refused it**: master's last CI run
is `failure`, and the hook fails open, so that is a real red. It is not this card's —
`gif-cutout.spec.js` ("Pick shows its label") and `radial-menu.spec.js` ("element(s) not
found"), both peers' in-flight work (MPI-757/771, MPI-811), red since before the first edit
here. `--no-verify` is for when you ARE the fix; this is not that. Push once master is
green, or once whoever owns that red says to go.

## Still open, reported not actioned

- `tests/fixtures/agent/connector-models.json` is a **recorded** connector response that still
  contains both Flows, and `tests/agent-loop.test.cjs` / `agent-generation-relay.test.cjs`
  drive it by those ids. They pass — the fixture is a recording, not the registry — but
  re-recording it needs a live app. It is the one surviving category of grep hit outside the
  dep registries.
- `scripts/agent-test.mjs` § `over-boxed-head` is a live agent eval that asks for a head swap.
  It now **passes for the wrong reason** on a profile without the package installed. A comment
  says so at the scenario; it is not part of `npm test` or CI.
- MPI-780 open question 1 (should the Library show the two paid Flows as link tiles?) is
  untouched and still needs Fabio.
