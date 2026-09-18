# MPI-708 validation

## Phase 0 / 0b

Met 2026-09-17 (session 53d9d605): `gh release view v1.5.0` is published; the `v1.5.0` tag's
updaters match `^Cubric(Vision|Studio)-...-update-v.*\.zip$` and `apply-update.cjs` accepts
`cubric.vision` and `cubric.studio`. See plan.md Plan Drift.

## Phase 1 — PASSED 2026-09-17 (session ad10647f)

Renames done by Fabio in GitHub Settings (the auto-mode classifier refused `gh repo rename`).

1. **Hub rename.** `gh repo view MadPonyInteractive/Cubric-Connector` -> private hub. The old
   `Cubric-Studio` slug is now the product repo (name reused, so the hub's redirect is gone by
   design); hub remote set to `Cubric-Connector.git` first, `git fetch` OK. Hub `98310e0`
   (headings), repo description updated.
2. **Product rename.** `gh repo view MadPonyInteractive/Cubric-Studio` -> public product;
   `gh repo view .../Cubric-Vision` resolves to `Cubric-Studio`. `git remote -v` here shows
   `Cubric-Studio.git`; `git fetch` and `ls-remote` OK. Old slug:
   `curl -sI https://api.github.com/repos/MadPonyInteractive/Cubric-Vision/releases/latest` ->
   `301` to `/repositories/1197467902/releases/latest`; followed, it returns v1.5.0 with
   `CubricVision-windows-x64-v1.5.0.zip`. `github.com/.../Cubric-Vision/releases/latest` -> `301`
   to `.../Cubric-Studio/releases/latest`.
3. **CI auth gate.** mpi-ci `e23112e` accepts both slugs; Vision `c0972475` dispatches
   `source_repo=MadPonyInteractive/Cubric-Studio`. `gh workflow run build-portable.yml` ->
   dispatcher run `35222050796` success -> mpi-ci run `35222060391`: "Checkout source" = success
   on linux, macos and windows. Log (ubuntu job `105204381139`): `repository:
   MadPonyInteractive/Cubric-Studio`, `ssh-key: ***`, `git remote add origin
   git@github.com:MadPonyInteractive/Cubric-Studio.git`, fetch OK -> the deploy-key path was taken.
   Run cancelled after checkout (conclusion `cancelled`, 0 artifacts) to save Actions storage.
4. **Pointer sweep.** `MadPonyInteractive/Cubric-Vision` -> `Cubric-Studio` in MadPony-Identity
   `eb0ee38` (6 files, slugs only), ComfyUi-MpiNodes README (carried by a peer's pushed commit
   `060e78c`; HEAD line 7 reads the new slug), Vision `c0972475` (8 files). Deliberately left:
   `feature-request-tier-label.md:73` (already correct post-rename), code slugs owned by later
   tasks (redirect-safe), the Website repo (Fabio's; its links and API fetch keep working through
   the redirect, measured on `denoland/deno_std`).
5. **README** (Fabio's request): "formerly Cubric-Vision" note at the top; mascot image and its
   orphaned `.github/readme/mascot-greet.png` removed (`c0972475`).

## Parallel Batch (partial: 2 of 5) — PASSED 2026-09-17 (session ad10647f)

Two workers, disjoint ownership, orchestrator-reviewed diffs.

- **Heal the Documents folder** (`routes/shared.js`, `tests/documents-heal.test.cjs`): one
  memoized, lazy resolver `_getDocumentsFolder()` behind `getProjectsRoot()` and
  `getProjectPathsRegistryFile()`; heal only when the app major is >= 2 (package.json, test seam
  `CUBRIC_TEST_APP_VERSION`); failed rename -> warn + old folder. No other runtime reader of the
  Documents folder exists (grep of main.js, server.js, routes/, services/, scripts/).
  `node --test tests/documents-heal.test.cjs` 7/7 (old-only v2 rename + registry rewrite, new-only,
  both, neither v1/v2, old-only v1 no rename, EBUSY fallback);
  `tests/fork-shutdown.test.cjs` + `tests/model-roots.test.cjs` 26/26 (require stays side-effect free).
- **Build identity**: `productName` (package.json, electron-builder.yml) -> Cubric Studio;
  `exeName` -> `CubricStudio.exe`; root/update archive names -> `CubricStudio-*`; macOS bundle and
  manifest `displayName` -> Cubric Studio; updater `DEFAULT_REPO` (win/linux/macos) ->
  `MadPonyInteractive/Cubric-Studio`; `PRESERVE` gains the Cubric Studio Documents paths;
  `RETIRED_PATHS.win32` gains `CubricVision.exe` (inert, see plan drift); `appId` and package
  `name` unchanged; every both-names bridge fallback kept.
  Portable tests (`portable-win-layout`, `portable-update-apply`, `portable-dry-run-isolation`,
  `updater-rename-bridge`) pass; `npm run build:portable:dry-run` succeeded, manifest `appId`
  `cubric.vision`, `displayName` `Cubric Studio` (dry-run stages no binaries).
- Orchestrator re-run: the six targeted test files 28/28; `npm test` 1287 pass, 0 fail, 1 skipped.

## Parallel Batch (remaining 3 of 5) — PASSED 2026-09-17 (session 0408510a)

- Ownership narrowed to exact files (claim `ac7d298e`); three files held by live peers left for a later pass.
- Main process: `main.js` (error-box title, exe comment, updater API slug + User-Agent), `routes/engine.js:52`, `routes/remotePodState.js:153`, `routes/system.js:323` `ISSUE_REPO` + `tests/issue-report-url.test.cjs:86`. `app.setName('Cubric Vision')` kept (D3a). `issue-report-url` 5/5. eslint clean on touched JS.
- Docs: 20 of 28 owned files changed; kept lines are real paths (dev `%APPDATA%\Cubric Vision`, pre-2.0 Documents), local folders (D4), the RunPod template name, and dated history. `PROJECT.md:83` + `project-integrity.md` describe the 2.x name plus the automatic rename. Release docs name `CubricStudio-*` assets plus the 2.0-only legacy dual-publish; "1.5.1 bridge" corrected to 1.5.0 (checked: `v1.5.0` updaters match `^Cubric(Vision|Studio)-`).
- Tooling: 21 files. `mpi-release` upload globs and tag annotation now `CubricStudio-*` / `Cubric Studio v<ver>`; `mpi-version-bump` header template `# Cubric Studio vX.Y.Z`; no script parses that header. Skill folder names and `name:` unchanged; cubric-vision* descriptions say "Cubric Studio (formerly Cubric Vision)". The four `.github` YAML files parse (PyYAML).
- Decision (c) recorded on the `RETIRED_PATHS` comment in `scripts/build-portable.mjs` (comment only).
- `npm test`: 1306 pass, 4 fail, 1 skipped. All 4 failures are in `tests/workflow-media-slots.test.cjs`, an UNTRACKED in-flight MPI-800 test (claim `8a806506`) that fails on that session's own uncommitted `comfy_workflows/raw/` edits; the main-process worker's earlier run, before that file appeared, was 1303/0.

## Phase 2b — strings, logo, icons — PASSED 2026-09-18, VERIFIED BY FABIO (session c3845e99)

Verify mode is `user-ux`, so this phase is not closed until Fabio has looked at the running app.

- **Strings** (12 files): `js/core/appName.js` + `appName.cjs` (twins in sync), `index.html:7,9,19,20,74`,
  `LandingPages/MpiAbout/MpiAbout.js:44,45,48`, `js/services/updateChecker.js:184`,
  `js/shell/projectUI.js:75`, `MpiAudioRecorder.js:169`, `js/pages/components.js:633`,
  `js/data/modelConstants/models.js:1024`, and two live product references in
  `js/data/recipes/{illustrious,pony}.recipe.js` (found by the sweep grep, not in the plan's list).
- **Kept as "Cubric Vision", each now carrying the reason inline:** `MpiErrorDialog.js:149` (the
  userData logs folder — pinned by `app.setName()` in `main.js:251`, so it never follows the display
  rename) and `MpiNewProject.js:40` (the Documents hint — `routes/shared.js` heals only on app
  major >= 2). `js/data/recipes/minimax-h3.recipe.js:71` and `js/data/releaseNotes.js` are dated
  history and stay. `js/services/projectService.js:426` names the real Documents path.
- **Sweep grep:** `grep -rn "Cubric Vision" js/ index.html` now returns only those five, as the plan
  requires.
- **Logo + icons**, all rendered from `Brand Assets/Studio-Logo.png` (2000x2000, the head badge —
  the full-body `Studio-Idle.png` is unreadable in a 16px titlebar): new
  `assets/mascot/studio/logo.png` (256px, 52 KB) for the titlebar and About; `favicon.png` and
  `build/icon.png` (1024px, 526 KB each, down from 1.4 MB); `media/icons/cubric-vision.png` (256px);
  `media/icons/cubric-vision.ico` rebuilt with the same 7 sizes (16/24/32/48/64/128/256, PNG
  payloads); `media/icons/cubric-vision.icns` (icp4/icp5/icp6/ic07/ic08/ic09/ic10) and
  `build/icon.icns` (ic11/ic12/ic07/ic13/ic08/ic14/ic09/ic10). Filenames unchanged — they are wired
  into `build-portable.mjs:600,719` and `setup-desktop.sh`. Every container was parsed back: header
  lengths self-consistent, each entry a real PNG of the declared size, and the 16px ICO entry
  renders as a legible robot head.
  The legacy raw `is32/il32/s8mk/l8mk` entries in `build/icon.icns` were NOT carried over; macOS
  10.7+ reads the PNG types.
- **Checks:** `eslint` clean on all 12 touched JS files (`npm run lint` whole-tree is RED on
  `js/shell/navigation.js:398` — a duplicate `_restartPending` declaration in a live peer's
  uncommitted MPI-805 work, not ours and not touched). `npm test` 1337 pass, 0 fail, 1 skipped.
  `npm run test:desktop` 118 passed, 1 failed — `flow-library-filters.spec.js` timed out waiting for
  its window under load; it passes on its own (re-run: 1 passed in 8.4s), so it is a flake, not a
  regression.
- **Real pixels**, `npm run app:isolated` on its own port (51914) and profile, driven with
  playwright-cli: the titlebar shows the robot badge + "Cubric **Studio**", the landing kicker reads
  "CUBRIC STUDIO · V1.6.1", the 18+ gate copy says "Cubric Studio runs uncensored AI models", and the
  About panel shows the badge, the "Cubric **Studio**" wordmark and "Cubric Studio is built for
  open-ended creation". Instance stopped afterwards via the listener's PARENT pid; port confirmed closed.
- **Left for Fabio (the `user-ux` gate):** the Electron window/taskbar icon and the browser-tab
  favicon, which a Chromium page cannot show.
- **FABIO VERIFIED 2026-09-18 (Option 1, "looks good"):** he reloaded his live app and checked the
  titlebar wordmark, the About panel and the landing kicker. Phase 2b is CLOSED. The taskbar/pinned
  icon was deliberately outside this check — Windows still shows Electron's, which is MPI-807
  (the exe PE rebrand, never built), not a Phase 2b defect.

## MPI-595 Gate A — launcher self-rewrite — PASSED 2026-09-18 on linuxbox (real dash, real applier, fresh 1.5.0)

- **Root cause confirmed, not assumed:** `scripts/portable/apply-update.cjs:253` writes every bundle
  file with `fs.copyFileSync`, an in-place truncate + rewrite of the SAME inode. The update bundle
  ships the running launcher itself (the win32 manifest lists `update.bat` / `update-from-zip.bat` at
  its root, so the Linux/macOS ones list their `.sh` / `.command` twins), and `sh` reads a script by
  byte offset. Windows never saw this because `copyFileSync` throws EBUSY there and the applier's
  evict path renames the file aside instead.
- **Measured** with a stand-in applier rewriting a live script: an unwrapped script prints its first
  line then dies with `unexpected EOF` — for `update.sh` that means the `relaunch` after a successful
  apply never runs, the MPI-422 failure shape. Wrapped in `main() { ... }` the tail runs.
- **The wrap alone is not enough**, which the harness caught: with a bare `main "$@"` last line the
  shell returned from main and then executed the REPLACEMENT file's body from its saved offset. The
  last line is therefore `main "$@"; exit $?`, on one line, and the harness asserts the replacement
  body never runs.
- **Applied to all 8 launchers**: `scripts/portable/linux/{start,start-with-terminal,update,update-from-zip,setup-desktop}.sh`
  and `scripts/portable/macos/{start,update,update-from-zip}.command`. All 8 pass `sh -n`, all are LF,
  and `git diff --summary` shows no mode change (exec bits intact). `setup-desktop.sh`'s heredoc body
  stays at column 0 — indenting it would write leading whitespace into the `.desktop` file.
- **Regression guard:** `tests/portable-launcher-selfrewrite.test.cjs` — a shape test over all 8 files
  plus the measurement harness itself (2/2 pass). The harness asserts the NAKED case still loses its
  tail, so it fails if the premise ever stops holding rather than passing vacuously.
- **THE OPEN QUESTION IS ANSWERED, from the SHIPPED artifact, not by inference (2026-09-18, session
  c3845e99):** `CubricVision-linux-x64-update-v1.5.0.zip` (the real GitHub release asset) carries a
  manifest of 121 files whose `.sh` entries are exactly `start.sh`, `start-with-terminal.sh`,
  `update.sh`, `update-from-zip.sh` — all four root launchers, plus `update/apply-update.cjs`. So the
  running launcher IS in the bundle that overwrites it, on linux, in a release users already have.
  (`resources/setup-desktop.sh` is NOT listed — it is staged by the build but never shipped in a
  delta, so it cannot self-rewrite.) That bundle is a **delta**, `fromVersion 1.4.4 -> 1.5.0`, which
  is exactly why it cannot be reused for the A/B: `assertBundleApplies` refuses it on any install
  that is not 1.4.4.
- **A/B kit BUILT and validated against the real applier (not yet run on the box):**
  `scratchpad/ab-kit/` — a crafted bundle as a DIRECTORY (the applier accepts a directory, so
  `extract-zip` never loads), `appId cubric.vision`, `platform linux`, **`fromVersion: null`** (a full
  bundle applies onto any installed version), `files` = the four root launchers at HEAD. `stock/` is
  the four launchers extracted from the shipped v1.5.0 zip — asserted UNWRAPPED, so leg A is not
  vacuous; `wrapped/` is HEAD — asserted wrapped, LF-only, mode 755 in the tarball.
  `node apply-update.cjs` against that crafted bundle on a fake portable root: **exit 0**, "Applied
  Cubric Studio update to 1.5.0-selfrewrite-ab", `update-from-zip.sh` rewritten in place 1664 ->
  2497 bytes and now wrapped. So a rejection on the box would be a real finding, not a bad manifest.
- **RUN ON `linuxbox`, 2026-09-18 — REPRODUCED AND FIXED, on real dash (session c3845e99).**
  Box: `Linux 6.8.0-136-generic x86_64`, **`/bin/sh -> /usr/bin/dash`**, no `curl` (only `wget`), no
  system `node` — the applier ran through the install's own bundled Electron, as a user's would.
  Fresh `CubricVision-linux-x64-v1.5.0.tar.gz` unpacked to `~/mpi595/` (the box's old 1.3.0/1.4.0
  trees were left untouched; nothing was patched). The install's four launchers were confirmed STOCK
  before the run — 0 lines matching `^main`, sizes 2272/1153/3553/1664 byte-identical to the copies
  extracted from the shipped zip. No ComfyUI, no engine, the app was never started.

  ```
  LEG A - stock v1.5.0 launchers (unwrapped, 1664 bytes)
    Applied Cubric Vision update to 1.5.0-selfrewrite-ab.
    ./update-from-zip.sh: 38: le: not found
    -- exit status: 127 --

  LEG B - MPI-595 wrapped launchers (2497 bytes), same install, same bundle
    Applied Cubric Vision update to 1.5.0-selfrewrite-ab.
    -- exit status: 0 --
  ```

  Leg A is the bug in the open: the applier completed successfully, and only THEN did dash resume at
  its saved byte offset — inside the rewritten, LONGER file — and execute the fragment `le`, a slice
  of a word that now sits at that offset. `exit 127`, and the script's tail never ran. Leg B is the
  same bundle over the same install with the wrap in place: clean `exit 0`. The applier that ran is
  the one the user has installed (it still prints "Applied Cubric **Vision** update"), which is the
  point — the shipped applier is what rewrites the shipped launcher.
- **What leg A means for a real user, and it is worse than a lost chmod:** `update.sh` calls
  `"$ROOT/update-from-zip.sh" ... || fail "applying the update bundle failed"`. A non-zero status from
  a bundle that applied PERFECTLY therefore reports the update as failed and writes `ok:false` into
  `update/update-result.json`. And `update.sh` is itself in the manifest and itself running at that
  moment, so its own tail — `echo "Update applied successfully."` and `relaunch` — is lost the same
  way. **That is the MPI-422 symptom ("the update applied and nothing ever reopened") reached by a
  second, independent route**, which the `relaunch()` fix could never have covered: a truncated
  launcher loses the new call along with everything else. Measured for the child here; for `update.sh`
  itself it follows from the same mechanism plus the manifest listing, and is covered per-file by
  `tests/portable-launcher-selfrewrite.test.cjs`. Reaching it end-to-end through `update.sh` needs a
  GitHub release serving a FULL linux bundle, which does not exist yet — worth re-checking at the 2.0
  cut, when one will.
- **Who this protects, unchanged by the run:** nobody on 1.x today. A currently-installed 1.x user
  updating to 2.0 runs their OWN unwrapped launcher — leg A is exactly that hop, and it fails. The
  wrap only starts protecting people from 2.0 -> 2.1 onward. MPI-595 must hear this before it treats
  Gate A as closing the issue for the existing fleet.
- **Left on the box** (disposable, powered on for this): `~/mpi595/` — the fresh install, the kit, and
  two rollback stamps under `update/rollback/`. Re-runnable as
  `~/mpi595/mpi595-ab-kit/ab-selfrewrite.sh ~/mpi595/CubricVision-linux-x64-v1.5.0`.

## Held-file pass — PASSED 2026-09-18 (session c3845e99)

- The two files the docs sweep (`d8ffa03d`) had to skip, done once their holders released:
  `docs/agent-chat.md:90` "the Cubric Vision skills" -> "the Cubric Studio skills", and
  `docs/playbooks/add-flow/README.md:3` "into Cubric Vision" -> "into Cubric Studio". Two lines, two
  words; `git diff --stat` = 2 files, 2 insertions, 2 deletions.
- **Claims checked first, not assumed:** `state/index.json` had zero live claims over either path
  (MPI-774 and MPI-532 both released), and the pass took its own write claim `92bf122f` before editing.
  Both paths added to the card's `files.json`.
- **Same pattern as the siblings, and the limit of it:** the PRODUCT name changes; an on-disk path,
  a folder name or an external artifact name does not. So `.claude/skills/cubric-vision*` on that same
  line is deliberately untouched (it is the real skills directory, and `agentCorpus` globs it) — asserted
  by the edit script, not eyeballed. Matches `add-model/README.md:3`, which the sweep had already
  rewritten to the identical sentence.
- Neither file has any remaining "Cubric Vision" prose. `node --test tests/agent-ui-surfaces.test.cjs`
  (the only test naming `agent-chat`) 5/5 — it asserts chat UI, not doc text, so it is a
  no-regression check rather than proof of this edit.
