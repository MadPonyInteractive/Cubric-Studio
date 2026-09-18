# MPI-805 — validation

## Why this exists (verified, not assumed)

- `git show ee034559 -- routes/comfy.js`: MPI-800 removed `reloadExtraPathsWhenReady(yamlPath)`
  and the `POST /mpi/reload-extra-paths` call, replacing them with the `restartNeeded` flag.
  Before that, a folder change applied live and said nothing.
- **Before this card** (at `ee034559`), `_restartEngine` in `js/shell/navigation.js` was reached
  only from `_syncRadial`, gated on `APP_CONFIG.dev_mode`. No other caller, so no shipped user
  could restart the engine. **That is no longer true, by design:** `e925c9fc` added
  `Events.on('engine:restart', () => _restartEngine())` at `js/shell/navigation.js:320`, ungated,
  which is what the new button fires. `_restartEngine` itself is now at line 347 — the original
  note said 340, which the same commit's 7 added lines shifted.

## The drag-drop path does NOT need a restart — verified

- `POST /comfy/import-model` (`routes/comfy.js:1065`) copies the dropped file into an already
  configured folder. `grep -c 'writeExtraModelPathsYaml|restartNeeded'` over the handler: **0**.
- `folder_paths.cached_filename_list_` (engine, `folder_paths.py:496`) compares
  `os.path.getmtime(folder)` against the cached value and drops the cache when it differs.
  Dropping a file changes the folder's mtime, so the new LoRA is picked up with no restart.
- A folder ADDED to the yaml is a different case: it is not in `folder_names_and_paths` at all
  until boot, which is exactly what the restart ask covers.

## Automated checks — PASSED

- `npm test` + `npm run test:desktop`: green in CI on **`e925c9fc`**, the commit that carries this
  card's code (`gh run list` -> conclusion `success`, 2026-09-18T10:02Z). CI does not run
  `lint:components`, so it was re-run locally at close-out: `eslint js/components/ --max-warnings=0`
  **clean**, 2026-09-18.

## Fabio's check (2026-09-18) — found a real defect, card reopened

He asked the in-app agent for a video, added a folder, pressed **Restart engine**, and *nothing
happened*. He wrote most of a message about it before two refusal toasts finally appeared —
two, because he had pressed the button again when the first press did nothing.

**Root cause, not a guess.** `waitForIdleQueue` (`comfyController.js`) polls `/queue` every 2s
and can only answer "still busy" by running out its `timeoutMs`. Both human-facing callers
passed **30000**, so the button was silent for a full thirty seconds before it could say
anything. Each press started its own 30s wait, which is why two toasts landed together. The
comment above both calls claimed the short timeout was "refuse fast and let them decide" — the
intent was right and the constant contradicted it.

**His call on the behaviour:** don't refuse at all. A restart the user asked for is *scheduled*.

## The fix (2026-09-18)

- `_restartEngine` probes with `timeoutMs: 0` — one `/queue` read, no sleep, because the
  deadline has already passed when it lands. Idle → restart now. Busy → toast **"Restart
  scheduled for when your generations finish or are cancelled."** and arm a wait with
  `timeoutMs: Infinity`, which restarts the moment the queue drains. A finite deadline there
  would drop the user's restart in silence.
- A second press while one is armed **re-toasts but does not arm a second waiter**
  (`_restartPending`) — the toast first, so the button still feels alive, then the guard.
- The stop/start half moved into `_performRestart(remote)`; both paths call it.
- **Same 30s silence existed at the other call site**, `repairPythonDeps` — one primitive, both
  fixed in this pass. That one still *refuses* rather than scheduling: a deps repair reinstalls
  packages under the engine and wants a human present, not a queue drain an hour later.
- `waitForIdleQueue`'s JSDoc now states the `0` / `Infinity` contract its callers depend on,
  including that the deadline check must stay AFTER the read or `0` stops probing at all.

Known ceiling, marked `ponytail:` in the source: one probe cannot tell *busy* from *unreadable*
(the method needs three missed reads, ~6s, to call an engine unreachable), so a **wedged** engine
shows the scheduled toast and then restarts ~6s later off the armed wait. The restart still
happens; only the wording is briefly wrong, and only on the dev radial — the Settings button is
reachable only with a running engine. Upgrade path if it ever bites: return
`'idle' | 'busy' | 'unreachable'` instead of a boolean.

| check | result |
|---|---|
| `node --test tests/engine-restart-schedule.test.cjs` | **6/6 pass**. The single-probe behaviour is exercised for real against `waitForIdleQueue` (1 fetch, 1ms) rather than pinned by regex; the two call sites and the double-press guard are source-pinned |
| red on pre-fix code | `git show HEAD:` on both files still matches `timeoutMs: 30000`, which the new test asserts is absent |
| `npm test` | tests **1329**, pass **1328**, fail **0**, skip 1 |
| `npx eslint` on the three touched files | clean (it caught a duplicate `_restartPending` declaration first) |

## Pending

- [ ] **Fabio's re-check** — same sequence that found the bug: start a generation, add a model
  folder, press **Restart engine**. Expect the scheduled toast **immediately**, and the engine to
  restart by itself when the generation finishes (or when you cancel it). Pressing twice should
  toast twice and restart once. `**Verify mode:** user-ux`, so no agent evidence closes this.
