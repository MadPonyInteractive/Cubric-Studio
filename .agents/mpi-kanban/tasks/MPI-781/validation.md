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

## The live check — done, on a private profile (2026-09-19)

Run with a throwaway desktop spec that seeded the **real** package folders from
`c:\AI\Mpi\Cubric-Flows` into a private profile, on **port 61624**, with the dev app on
3000 left alone. The copies had `compat.minAppVersion` lowered to `1.0.0`; the repo
manifests were not touched and still declare `2.0.0`, which is correct for the shipping
artifact. The spec was deleted after the run — it pointed at a sibling repo, so it could
never live in CI.

Result — **passed**, no page errors, no console errors:

| | Head Swap | DramaBox |
|---|---|---|
| registers | ✓ `user:head-swap` | ✓ `user:drama-box` |
| title | Head Swap | DramaBox |
| `filePrefix` | **`flowHeadSwap`** | **`flowDramaBox`** — the title-derived-filename trap avoided |
| tile in the Library | ✓ | ✓ |
| `flowAvailability().reason` | **`null`** — fully available, every model and dep resolved | **`null`** |
| licences | **`klein-9b`, `accepted: false`** | none |

Head Swap's drawer shows **"FLUX Non-Commercial License v2.1"** with `Open` / `Uninstall`.
That is the gate MPI-780 depends on, firing on a package exactly as it did built-in.

`FLOWS` now holds **13** built-in flows and neither departed id is among them.

### A REAL generation from the package — ran and passed (2026-09-19)

Fabio asked for DramaBox. Run on an isolated instance (`npm run app:isolated`, port 56295,
own profile) with **`APP_DOCUMENTS` pointed at a scratch dir**, so the project, the
project-paths registry and the landing list were all scratch — the dev app on 3000 was
never touched and nothing reached `Documents`. Dispatched `flowId: "user:drama-box"` through
`/connector/generate` under `gpu_lease.py`.

```
HTTP 200 after 40.3 s
{"ok":true,"output":{"type":"audio","filePath":"…/Media/flowDramaBox_001.flac",
 "seed":970733971,"generationMs":39792,"cardName":"MPI-781 package proof"}}
```

- **`flowDramaBox_001.flac`** — the explicit `op.filePrefix` did its job. Without it the file
  would have been named off the title. That was the single most likely way to ship this
  package wrong, and it is now proved right end to end.
- Real audio, not silence: 48 kHz stereo FLAC, 313 KB, `mean_volume -16.3 dB`,
  `max_volume 0.0 dB` (measured with `volumedetect`; `ebur128` reads the silence floor).
- **6.09 s for a 6 s ask** — upstream's 8n+1 latent grid at 25 fps, exactly as the FlowDef
  documents. Not drift.
- The card landed named, in the gallery, with a sidecar.

So the package path is proved whole: authored outside the app → validated → installed →
listed → gated → dispatched → a real file on disk with the right name.

**Head Swap's own generation was not run** (two plates and two boxes to stage, and the GPU
cost). Everything short of the pixels is proved for it: registers, tiles, `reason: null`,
and the FLUX Non-Commercial gate unaccepted.

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

## Pushed

`3adf2d5e` is on `origin/master`. The first push attempt was refused by `.husky/pre-push`
because master's last CI run was `failure` — not this card's (`gif-cutout.spec.js` and
`radial-menu.spec.js`, peers' in-flight work). `--no-verify` is for when you ARE the fix, so
it waited. Master went green and a peer's push carried the commit up with theirs.

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
