# MPI-970 validation

Verify mode: user-ux for Phase 5 F2 only; Phases 1-4 auto (plan.md § Verification).

## Evidence

- 2026-09-29 Phase 1 spike (c4eb2969), live in an own isolated Electron (own profile/port/Documents, CDP-driven,
  jobs on the shared :48188 engine under a GPU lease): S1 one card, 5 steps (resize, crop, imageUpscale, klein-4b
  i2i, Scribble Flow via an in-page passthrough) = 1 new card with 5 History versions; S2 closed project = new
  card + version 2, survives an open; S3 2 cards x 3 steps = 1 stack of 2, 3 versions each, settled on drain.
  Evidence lines: plan.md § Phase 1 findings. Spike code stayed in the scratchpad; no product file changed.
- 2026-09-30 Foundations batch (26163994, two parallel workers, then re-run by the orchestrator):
  `node --test tests/routine-model.test.cjs tests/agent-routines-store.test.cjs` -> 44 pass / 0 fail (T1 30:
  a legal 3-step chain, every refusal code, image->video->image `MEDIA_KIND_BREAK`, t2i `NOT_BATCHABLE` first and
  later; T2 14: write/list/read/overwrite/delete in both scopes, the 50 cap incl. overwrite at the cap, bad slug,
  `NOT_A_PROJECT`, a double delete keeping both copies). `npm test` from Git Bash: 2336 pass / 0 fail / 2 skipped.
  (Run from PowerShell, `tests/pre-push-done-gate.test.cjs` fails 7 because `bash` there resolves to WSL - shell,
  not code.)
- 2026-09-30 R1 core (26163994): `node --test tests/routine-runner.test.cjs tests/routine-model.test.cjs
  tests/history-completion-live-card.test.cjs` green; `npm test` (Git Bash) 2347 pass / 0 fail / 2 skipped. Not yet
  live: the runner has no renderer `deps` until the agentDispatch split + routineDispatch.js land.
- 2026-09-30 D9 + R1 wiring (d46a8d69): `node --test tests/routine-model.test.cjs tests/routine-runner.test.cjs
  tests/agent-pinned-settings.test.cjs tests/agent-mask-dispatch.test.cjs` 79 pass / 0 fail (D9: a legal reference +
  `{text}` routine, 13 save refusals, a Flow-field placeholder; runner: inputs filled identically on every card with
  the card still in the required slot, a card-id input, `INPUT_MISSING` / `INVALID_INPUT` before any queueing, quote
  refusal; denoise forwarded). `npm test` (Git Bash) 2366 pass / 0 fail / 2 skipped. ESLint clean on the four files.
  LIVE, own isolated app on the :48188 engine under gpu_lease (queue empty before): downscale -> klein-4b kleinEdit
  (character card as `inputImage2`, `{mood}`) -> Scribble Flow on 2 cards = one settled stack of 2, 3 versions each,
  `/get-project` on disk == live, input cards untouched, 71 s; the edit's sidecar holds the filled prompt ("warm
  golden-hour") and the character as `inputImage2`. A first run stopped one card at step 1 with `ALREADY_SMALLER`
  (D3 as designed), stack of 1.
- 2026-09-30 D10 + R2 + W1 routes (bd66b68e): `node --test tests/routine-runner.test.cjs` 14/14 (3 new D10: step 1
  skipped -> next step makes the new card and it still joins the stack; a later skip makes no version; nothing to do
  anywhere refuses, no stack); `tests/connector-routines.test.cjs` 5/5 (save checked by the app and stored AS
  CHECKED, refused save stores nothing, quote/run carry the STORED routine + cards + inputs + folderPath, global scope,
  400 without folderPath); store list carries `inputs`. `npm test` (Git Bash) 2375 pass / 0 fail / 2 skipped; ESLint
  clean on the 7 files. LIVE, own isolated app (port 62823, never :3000) on the :48188 engine under gpu_lease, queue
  empty, project CLOSED, driven by a scratch script over the connector only: save (+ an UNKNOWN_FLOW save refused by
  the app's check), list, quote (`count: 3` = a stack of 2 expanded + 1 card), run `shrink-and-square` (downscale
  0.5 MP -> crop 1:1) = one new stack of 3, 2 versions each, 1.3 s. First try exposed a real bug (fixed): a closed
  project's `/get-project` history is item ids, so the runner answered CARD_NOT_FOUND - `routineDeps.readProject` now
  hydrates a closed project via `reconcileAndHydrate` (an imported card has no sidecar). D10 live: the same routine on
  that result stack (squares now under 0.5 MP) -> every card `skipped: [1]`, crop made each new card, stack of 3. Both
  closed-project stacks read `expected` until the project opened, then settled on open (by design, `project:changed`);
  screenshot `shot-r2-gallery.png` (scratchpad bd66b68e).
- 2026-09-30 W2 + W3 + D12 + F1 (8cbb0199): master CI run 36691311222 (on 4b4b8960b) confirmed green first.
  `node --test tests/agent-routine-tool.test.cjs` 7/7 (save gated on app:routines and saved in the connector's
  words; missing model refused by name with no card; ONE spend card for 3 cards, set ref + attachment value
  resolved, held run, one `[Routine finished]` note naming the skipped and failed step per card, `agent:drained`;
  a No runs nothing; global fallback; list both scopes; D7/D12 in the description). Mutation: the save gate off ->
  the gate test red. `tests/agent-prompt-budget.test.cjs` green: system 10,227 / 10,250 (unchanged budget), tools
  18,198 / 18,250 (raised by the tool's measured +949). `npm test` (Git Bash) 2382 pass / 0 fail / 2 skipped;
  ESLint clean on the 6 changed files. LIVE, own isolated app (:56034, never :3000) on the :48188 engine under
  gpu_lease, queue empty: the REAL AgentLoop + REAL agentTools, no LLM - list, save refused then saved (the app's
  check answered the chain summary), run crop -> downscale on 2 cards = note "2 new cards in the new stack 4b5c1622"
  + `agent:drained`, delete, list clean; `/get-project`: the stack holds 2 members, 2 versions each. F1: every path
  `docs/routines.md` names exists.
- 2026-09-30 B1 (8cbb0199, Fabio's yes: 20 conversations): `node scripts/agent-test.mjs --case routine-*` on
  DeepSeek-V4-Flash-0731: routine-list 3/3, routine-save 3/3 (read the guide after the gate, 2 steps in order, the
  real validator accepted them), routine-run 3/3 (ONE run over the dropped set of 3, no generate), routine-delete 3/3
  (only the one asked); routine-in-capabilities 0/3 with D12 only in the tool description -> moved to the system
  prompt's Routines rule (SYSTEM_BUDGET 10,390, measured 10,341; TOOLS_BUDGET 18,210, measured 18,162).
  `--bite`: all 5 flips fail as they must. Spent $0.0199 + $0.0160 = $0.0359. `npm test` after the move
  2382 pass / 0 fail. Re-run of routine-in-capabilities after the move (Fabio's second yes): 3/3, $0.0015. B1 total
  $0.0374, 23 conversations. Left: F2, Fabio's look in his own app.
- 2026-09-30 D13 (7026c025, Fabio's yes to the Routines dropdown with every pick): `npm test` (Git Bash) 2383 pass /
  0 fail; `tests/routine-runner.test.cjs` 15/15 incl. `routineChoice` (runs / whole-run price / wrong kind / not
  ready / needs an input / illegal); ESLint clean on the 7 changed JS files; system prompt 10,370 / 10,390. LIVE, own
  isolated app (:55374, never :3000) on the :48188 engine under gpu_lease, queue empty: select 2 cards -> "Routines"
  beside Stack at the same 34 px height; options = the project's 3 then the global one; the input routine greyed,
  hovering it puts "Needs a picture (the character) each run. Ask the agent to run this one" in the status bar, a
  click on it does nothing; pick `d13-square-shrink` -> selection ends, trigger reads "Routines" again, a new stack
  "d13-square-shrink" of 2 cards, 2 versions each, in 3 s. Pick `d13-global-shrink` on that stack (already 0.1 MP) ->
  nothing queued, the refusal as a status-bar "HEADS UP". Left: U4, Fabio's look.
- 2026-09-30 U4 round 1 (Fabio, his app, 1920 px): the dropdown ran the full bar width; asked to rename, his agent saved
  a copy (`9-16-crop-and-upscale` beside `crop-to-916-and-upscale-2x`), then said it cannot delete routines and sent
  him to delete one from the selection bar. Fixed (7026c025): the bar's dropdown `width: auto; flex: none` (the
  primitive is `width: 100%`); a `rename` action (store `renameRoutine` moves the file + its name, `NAME_TAKEN`
  refuses, route `POST /connector/routines { rename }`, loopback, tool `newName`); the limits line "My own routines
  are the exception: I rename and delete those."; the Routines rule "... which only runs them"; guide section
  "Listing, renaming and deleting". SYSTEM 10,454 / 10,460, TOOLS 18,232 / 18,240 (both raised, reasons in the
  constants). `npm test` 2390 pass / 0 fail; ESLint clean. Bench `routine-rename` (new) and `routine-save` (menu check)
  dry-run FREE with a scripted model: right behaviour passes, Fabio's copy-and-refuse fails, flip fails. LIVE, own
  isolated app (:56516, never :3000): rename through the REAL loop + loopbacks + route + store -> renamed, a taken
  name `NAME_TAKEN`, list shows one copy; at 1920 px the dropdown is 96 px (Stack 63), its list 178 px. Not run: the
  paid bench (needs Fabio's yes). Left: his look again.
- 2026-09-30 U4 round 2 (Fabio, his app on Ollama): "Okay, this works." Asked to delete `9-16-crop-and-upscale`, the
  agent listed, deleted it, and said so; the Routines dropdown is label-sized beside Stack and lists the one left. His
  screenshot does not show a rename. He then asked whether routines can move between the global and project scopes.
- 2026-09-30 MOVE (7026c025, Fabio: "yes, build move"): tool `move` (no direction: out of the project if there, else
  out of the global ones; `scope` ignored), store `moveRoutine` (write to the other scope first: cap + `NAME_TAKEN`
  refuse before anything moves; source to `deleted/`; not `fs.rename`, two drives), route `move: true`, loopback,
  limits line "I rename, move and delete those", guide bullet, bench `routine-move`. SYSTEM 10,460 / 10,470, TOOLS
  18,239 / 18,250. `npm test` 2392 pass / 0 fail; ESLint clean. Bench dry run FREE (scripted model): right passes,
  a save-a-copy-then-delete fails, flip fails. LIVE, own isolated app (:65325, never :3000), REAL loop + loopbacks +
  route + store: project -> global (with `scope: 'global'` sent, as a model would) -> project; a global one down and
  back up; unknown `ROUTINE_NOT_FOUND`; the lists end as they began; both sources in `deleted/`. Not run: the paid
  bench (Fabio's yes needed: routine-rename/-move/-delete/-save). Left: Fabio's look at move, in a fresh session.
- 2026-09-30 GLOBAL ONLY (b08f2626, Fabio: "routines should always be global ... we just keep globals"): the project
  scope, `move` and the two-scope reads removed (store, routes, loopbacks, tool, bench fakes, the bar's
  `readSavedRoutines`, docs). `node --test` store 12/12, connector-routines 4/4, agent-routine-tool 8/8 (new: list,
  save and delete with NO project open, a run refused `NO_PROJECT` with nothing quoted; a run's body carries no
  `scope` even when the model sends one), budget 5/5 (SYSTEM 10,454 / 10,460, TOOLS 18,178 / 18,190, both lowered).
  `npm test` (Git Bash) 2392 pass / 0 fail / 2 skipped; ESLint clean on the 7 changed JS files. Bench dry run FREE
  (scripted model): routine-list/-delete/-rename/-save/-run right answers pass; delete-both, rename-as-copy,
  invented menu, generate-per-card fail; the list flip passes only because a scripted reply names the routine (a
  real model cannot). LIVE, own isolated app (:54345, never :3000): 2 saves with no folderPath -> in app data, NOT
  in the project; the list = the 3 global routines, the 3 project files left from D13 not listed; the selection bar
  on 2 cards lists exactly those 3, the input one greyed with its reason in the status bar (screenshot
  `g-hover.png`, scratchpad b08f2626). Not run: the paid bench. Left: Fabio's look.
- 2026-09-30 U4 VERIFIED (Fabio, his app, DeepSeek; b08f2626): asked to save "this process" (crop 9:16, upscale 1.5x), Cosmo
  saved `crop-9x16-upscale-15` in app data (`agent/routines/`: steps `crop {ratio 9:16}`, `imageUpscale {factor 1.5}`);
  it is listed under Routines in ANOTHER project (Kaiju Giant Bowl) and ran on 2 cards there. Measured on disk: crops
  432x768 and 648x1152, upscales 648x1152 and 972x1728 (exactly x1.5; sidecars `Upscale_Factor: 1.5`). His "x2" was the
  earlier DIRECT generate in My Agent Tests (sidecar `Upscale_Factor: 2`, the default: the agent sent no factor), which
  the agent then reported as "the 1.5x boost": nothing told it what a tool ran with. Fixed: a tool's generate result
  names every setting it runs with, defaults marked ("It runs with: upscaler 4x-NMKD-Siax (default), factor 2
  (default)."); `tests/agent-loop.test.cjs` "a tool result names every setting it runs with" (fails without the fix:
  the old note was empty for a tool). `npm test` 2393 pass / 0 fail; ESLint clean. His "resize, not crop" is the card
  NAME only (the crop runs on the `resize` op, `keep_proportion: crop`): brief.md § Noticed. Ornith (Ollama 9B) failing
  the same request is the model (free replay: invented a model, never used the crop tool); no app change.
