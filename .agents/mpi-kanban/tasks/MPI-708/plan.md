# MPI-708 — Rename the product to Cubric Studio

Parent: **MPI-677** (consolidate the Cubric family into Cubric Vision).
Gates: **MPI-595** (2.0 release readiness) — 2.0 cannot cut under the old name.
Brief (decision + repo-rename reasoning): `brief.md`.

## Current State

**2026-09-18 (session c3845e99): PHASE 2b CLOSED — Fabio verified it in his live app (Option 1,
"looks good": titlebar wordmark, About panel, landing kicker). The taskbar/pinned icon was
excluded from that check on purpose: Windows still shows Electron's and that is MPI-807, not a
Phase 2b defect.

**MPI-595 GATE A IS VERIFIED — the linuxbox run happened and it reproduced.** Fresh
`CubricVision-linux-x64-v1.5.0` on `/usr/bin/dash`, the install's own applier, no engine and the app
never started. Leg A (stock unwrapped launchers): the applier succeeded and dash then died on
`./update-from-zip.sh: 38: le: not found`, exit 127 — it resumed at its saved byte offset inside the
rewritten file. Leg B (wrapped, same install, same bundle): exit 0. The shipped v1.5.0 linux bundle
was confirmed to list all four root launchers, so the premise is a property of a release users
already have, not an inference. Full evidence + the two consequences (a perfect update reporting
FAILED, and MPI-422's symptom reached by a second route) in `validation.md` § MPI-595 Gate A.
**The 1.x fleet caveat was sent to MPI-595 as message `78a7f920`** — the wrap protects nobody on the
1.x -> 2.0 hop, because leg A IS that hop.

**HELD-FILE PASS DONE (`64bc0689`)** — MPI-774 and MPI-532 had released, so
`docs/agent-chat.md:90` and `docs/playbooks/add-flow/README.md:3` now say Cubric Studio. Two lines,
and the `.claude/skills/cubric-vision*` glob on that same agent-chat line stays as it is (real
directory, `agentCorpus` globs it). **That closes the non-renderer sweep batch entirely.**

**2026-09-18 later (same session): PHASE 3 IS GATED, and the next session does COLOUR.** Fabio
named the gates: MPI-532 (user flows), MPI-774 (in-app agent), the project registry cleanup
(**MPI-809**, raised by a peer mid-session — do NOT raise another; **MPI-810** is its sibling),
MPI-777 (mascots), and — new — **MPI-736 (UI colour)**. He also answered MPI-736's open
question: `--accent-warn` moves, `--video-accent` stays; `--accent-ok` vs `--accent-audio` is the
same shape and is still unruled. **PUSH IS BLOCKED:** master's CI is red on MPI-774's
`tests/desktop/agent-chat.spec.js:654`, and this tree also holds two UNPUSHED MPI-771 code commits
from a peer, so `--no-verify` would publish someone else's code onto a red master. Three commits sit
local: `625787ef`, `de2a4736`, plus the handoff commit.

**The next unit is Phase 3, the 2.0 release.** Still open on this card: the 2.0 release note
(`UNRELEASED.md`, was held by MPI-774 — recheck), the legacy `CubricVision-*` dual-publish step, the
skipped-bridge read-only check, and the 2.1 follow-up card. Mascots stay PARKED. **Not blocking, but
it belongs to the 2.0 cut:** re-run the Gate A check end-to-end through `update.sh` once a release
actually serves a FULL linux bundle — see `validation.md` § MPI-595 Gate A.

**2026-09-18 (session 09561fb8): PHASE 2b evidence.** Fabio's answer on the logo: **a still for now, swapping to the animations
once they land** — so the titlebar/About/icons take `Studio-Logo.png` (the head badge; the full-body
`Studio-Idle.png` is unreadable at the 16px titlebar size). Evidence in `validation.md` § Phase 2b:
12 files of strings, the new `assets/mascot/studio/logo.png`, and the whole icon set regenerated and
parsed back entry by entry. Two strings KEPT as "Cubric Vision" and now commented with why —
`MpiErrorDialog.js:149` (userData, pinned by `app.setName`) and `MpiNewProject.js:40` (Documents,
healed only on major >= 2). `npm test` 1337/0. **`npm run lint` whole-tree is RED on
`js/shell/navigation.js:398`, a duplicate `_restartPending` in a live peer's uncommitted MPI-805
work — not ours, do not fix; lint our own files instead.**

**The launcher self-rewrite fix (MPI-595 Gate A) is WRITTEN and the mechanism is proven, but the
real in-place update is still owed.** Root cause: `apply-update.cjs:253` `fs.copyFileSync` truncates
and rewrites the running launcher's own inode while `sh` reads it by byte offset (Windows is spared
because `copyFileSync` throws EBUSY and the evict path renames aside). All 8
`linux/*.sh` + `macos/*.command` now wrap their body in `main() { ... }` and end with
`main "$@"; exit $?` — the trailing `exit` is load-bearing, measured: without it the shell returns
from main and runs the REPLACEMENT file's body. Guarded by
`tests/portable-launcher-selfrewrite.test.cjs` (shape test + the measurement harness, 2/2).
**Next: `linuxbox` — Fabio will power it on.** Plan corrected by him: do NOT patch whatever version
is sitting there (he is unsure if it is still the 1.3.0 tree, and a 1.3 -> 1.5 hop may break for
unrelated reasons). **Fresh install instead.** And the hop that matters is not the released one:
the script that has to SURVIVE a rewrite is the one ALREADY INSTALLED, so a stock 1.4.4 -> 1.5.0
update exercises 1.4.4's UNWRAPPED launchers and proves nothing about the fix. The decisive shape is
A/B on one fresh install: run a minimal crafted bundle (manifest listing only the launcher files,
correct `appId`) over the STOCK launchers to reproduce the bug on real dash, then swap in the 8
wrapped ones and repeat. No ComfyUI, no engine, no generation — the applier only copies files, and
Fabio's standing constraint is that an engine install thermally kills that laptop.
**Open question for that run: is the self-rewrite the real root cause behind MPI-422?** MPI-422's
symptom was "the update applied and nothing ever reopened" and it was fixed by ADDING `relaunch()` —
but a truncated launcher would lose that call too. Check whether the linux/macOS update bundles
actually list the launchers (the win32 manifest lists `update.bat` at its root, so probably yes).
**Also note who the fix protects: nobody on 1.x today.** A currently-installed 1.x user updating to
2.0 runs their OWN unwrapped launcher, so the wrap only starts protecting people from 2.0 -> 2.1
onward. Worth telling MPI-595 before it treats Gate A as closing this for the existing fleet.

**MPI-807 raised 2026-09-18** (todo/planned, `brief.md`): the Windows exe PE rebrand, Phase 2.4 of
the 2026-04-30 portable plan, never built. `build-portable.mjs:505,529` copies `electron.exe` to
`CubricStudio.exe` byte-for-byte with no `rcedit`, so Explorer and any PINNED shortcut still show
Electron's icon, and `media/icons/cubric-vision.ico` has no consumer anywhere. macOS
(`build/icon.icns`), Linux (`.desktop` + hicolor png) and the Windows RUNNING window
(`BrowserWindow.icon` = `favicon.png`) are all wired and all still work — which is why the
three-platform check Fabio ran passed and why a plain launch will keep passing while MPI-807's
defect is present. That is also why a dev run always shows the Electron logo (Phase 2.5 never
landed either), so the taskbar icon is NOT checkable in dev.

After that: the held-file pass, Phase 3, mascots still parked.

**2026-09-17 (session 0408510a):** Fabio decided the exe question: **(c)**: keep
`CubricVision.exe` on updated installs at 2.0, delete it at 2.1, and the 2.0 release note tells
users to re-pin to `CubricStudio.exe`. He also OK'd `.claude/rules/components.md:3`. MPI-760 released
its claims; **MPI-774 still holds `index.html` + `assets/mascot/studio/logo.webp`, so Phase 2 is
still blocked.** **Parallel Batch DONE (5 of 5) and verified**, uncommitted at the time of
writing (evidence `validation.md`). The three remaining tasks ran with ownership NARROWED to exact
files (see Plan Drift). **Next:** (1) the held-file pass once their claims release:
`docs/agent-chat.md:90` (MPI-774) and `docs/playbooks/add-flow/README.md:3` (MPI-532), using the
same pattern as their siblings (the generate skill is done); (2) **Fabio's order: Phase 2b, then
the launcher fix.** Phase 2b = the NON-mascot half of Phase 2: the display strings (`appName.js` +
`.cjs`, `index.html:7,9,19,20,74`, `MpiAbout.js:44,45,48`, `updateChecker.js:184`,
`projectUI.js:75`, `MpiAudioRecorder.js:169`, `MpiErrorDialog.js:146`, `MpiNewProject.js:39`
(the default-folder hint must show the folder that is REAL, which is still `Cubric Vision` on 1.x),
`js/pages/components.js:633`, `models.js:1024`), plus the Studio logo (`Studio-Logo.png`
from Brand Assets) in the titlebar and About, and regenerated `build/icon.png`, `favicon.png`,
`media/icons/cubric-vision.{png,ico,icns}` (keep the filenames). Verify mode `user-ux`. **First ask
Fabio whether the logo is a still or is changing with the animation work** (if changing: do the
strings only). Then the **launcher self-rewrite fix** (MPI-595 Gate A, no card of its own; the
rename makes it fire): wrap each `scripts/portable/linux/*.sh` and `macos/*.command` body in a
function called on the last line, and verify with a real in-place update on `linuxbox`.
(3) Mascot work stays PARKED (Plan Drift, top). (4) Phase 3. `npm test` currently shows 4 failures, all in MPI-800's untracked in-flight
`tests/workflow-media-slots.test.cjs`, which is not ours.

**2026-09-17 (session ad10647f): PHASE 1 DONE and verified** (evidence: `validation.md` § Phase 1;
CI checkout proven on mpi-ci run `35222060391`, cancelled after checkout, 0 artifacts).
**Parallel Batch, 2 of 5 DONE and verified** (Documents heal, Build identity; `npm test` 1287/0;
evidence `validation.md` § Parallel Batch). **One open decision for Fabio: the old
`CubricVision.exe`** — see Plan Drift "RETIRED_PATHS is inert".
**Next unit is blocked by live peers, re-check `state/index.json` before starting:**
- Phase 2 (renderer): MPI-774 (Agent 7, active) claims `index.html` and
  `assets/mascot/studio/logo.webp` (it is already staging a Studio logo, so coordinate, don't
  duplicate); MPI-760 (active) has uncommitted edits in `MpiGroupHistoryBlock.js`.
- Parallel Batch: `routes/**`, `docs/**` and `.claude/**` overlap live claims (MPI-774:
  `routes/agent.js`, `routes/connector.js`, `docs/agent-chat.md`, `docs/llm.md`,
  `.claude/rules/component-*.md`; MPI-760: `docs/gif.md`, `docs/video-player.md`), so Main
  process, Docs sweep and Agent tooling wait (the two clear tasks are done). The Agent-tooling task
  edits `.claude/rules/`, which needs Fabio's OK per CLAUDE.md rule 5 (he gave it for `kanban.md` only).

Phase 1 detail: Fabio renamed both repos in GitHub Settings (hub first).
Verified: `gh repo view` resolves `Cubric-Connector` (private hub) and `Cubric-Studio` (public
product), and `.../Cubric-Vision` resolves to `Cubric-Studio`; the old slug's
`releases/latest` API 301s and serves v1.5.0 JSON. Remotes set: hub -> `Cubric-Connector`,
here -> `Cubric-Studio`; `git fetch` works in both. Commits: mpi-ci `e23112e` (both slugs),
hub `98310e0` (headings; repo description updated), MadPony-Identity `eb0ee38` (slugs only),
ComfyUi-MpiNodes: the README link rode a PEER's commit `060e78c` (already pushed; content correct),
Vision `c0972475` (tool/doc slugs, `build-portable.yml`, README "formerly Cubric-Vision" note
and mascot removed at Fabio's request).

**Earlier (session 53d9d605):** Phase 0 and Phase 0b are DONE (see Plan Drift). Fabio wants the handoff chain to keep going until the rename
lands: Cubric Vision ships as **Cubric Studio 2.0** ("Cubric Studio" in his speech already means
this repo). The two GitHub renames are outward-facing: Fabio does them, or gives an explicit go per
rename. MPI-708 is a Gate A member of MPI-595 (2.0 readiness), committed 2026-09-17.

Project mode: **scalable-foundation**. Full guardrails, no prototype shortcuts.

The family merged into one app (MPI-677), so the ecosystem name is free. 1.5.0 is the
last release named Cubric Vision; 2.0.0 is the first named Cubric Studio. The GitHub
repo is **renamed, not forked** — a rename 301-redirects the old URL including the API,
which is what keeps every shipped 1.x client's update check alive.

Four read-only investigations ran 2026-09-08. What they found changes the shape of the
work in five ways that were not visible from the brief:

**1. The artifact filename is load-bearing for the installed fleet — this is the highest
risk in the whole card.** Every installed 1.x client carries a hardcoded asset regex:
`scripts/portable/win-update.cjs:26` `^CubricVision-windows-x64-update-v.*\.zip$`,
`scripts/portable/linux/update.sh:74`, `scripts/portable/macos/update.command:19,21`.
If 2.0 publishes `CubricStudio-*` assets, every 1.x install detects the update, then
**fails to apply it** (`fetch-release.cjs:115-117` throws "no update asset matching"),
and the user gets the MPI-422 failure dialog. The repo rename does not cause this; an
artifact rename does. Handled by the 1.5.1 bridge plus a one-release dual-publish (D1) —
see Phase 0b.

**2. `appId: 'cubric.vision'` must not change.** `apply-update.cjs:246` hard-asserts it
and rejects any bundle that disagrees. It is also asserted in
`build-portable.mjs:699,1148`, all three `release-baselines/*.json`,
`resources/cubric/connector-manifest.json`, `tests/connector-responder.test.cjs` and
`tests/portable-update-apply.test.cjs`. It is an internal identifier no user sees.

**3. One CI gate breaks on the rename and a redirect does not rescue it.**
`mpi-ci/.github/workflows/cubric-vision-portable.yml:47,48` compares the repo slug by
**string equality**:
`ssh-key: ${{ inputs.source_repo == 'MadPonyInteractive/Cubric-Vision' && secrets.CUBRIC_VISION_DEPLOY_KEY || '' }}`.
Post-rename the deploy key silently drops out and the token path flips. It is coupled to
`.github/workflows/build-portable.yml:44`, which hardcodes the slug it dispatches — the
two must change together or the build loses its checkout auth.

**4. The mascot answer is cheap, and there are six render sites, not two.** The media type
is already in scope at the peek call site — `MpiGroupHistoryBlock.js:253-254`
`const isVideo = _group.type === 'video'; const modeKind = isVideo ? 'video' : 'image';`,
still in scope at the only `_mascotShow` caller (`:742`). Same story in the gallery, where
`group.type` is live in the card closure at `MpiGalleryGrid.js:1504-1507`. No plumbing.
The canonical enum is `MEDIA_TYPE` in `js/data/commandRegistry.js:23-27` —
`image | video | audio`. **Key off the three-value `modeKind`, not the boolean:** audio
groups already exist (`MpiGalleryGrid.js:1191,1289`), and `isVideo ? video : vision`
silently means "audio → Vision".

The six sites: History peek (`MpiGroupHistoryBlock.js:455,742`), gallery card peek
(`MpiGalleryGrid.js:1504-1507`, with an idle↔greet flip timer at `:1515-1521`), every
toast (`MpiToast.js:141-157`, the only consumer of `happy.png`), Model Library queued tile
(`MpiTileSheet.js:174`), engine-startup overlay (`MpiStartingComfy.js:24`), landing
empty-state (`js/shell/projectUI.js:205,226`). Only the first two have a generation in
scope; the other four are identity surfaces and take the Studio character.

**5. Weight.** One character is 13.7 MB across five PNGs, rendered into a 66px box
(`MpiGroupHistoryBlock.css:159-161`). `electron-builder.yml:8-9` ships `files: "**/*"`
with no `assets/` exclusion. Three more sets at this size is ~55 MB of PNG in the asar,
and the gallery flips a 1.8-3.8 MB PNG every 4-8s per generating card with no preload
layer. Downscale on the way in.

Also established, and each one removes work rather than adding it:

- **No test goes red on a display rename.** The only window-title assertion is
  `tests/desktop/electron-smoke.spec.js:23` `toHaveTitle(/Cubric/i)`, which matches both
  names. There is no wordmark or brand-text assertion anywhere in `tests/`.
- **`npm run release:check` passes unchanged** through a repo rename, a package-name
  change and a productName change — all seven checks in
  `scripts/release-health-check.mjs` are version/registry-driven.
- **`electron-builder.yml` is not in the shipping path.** `scripts/build-portable.mjs`
  produces the GitHub artifacts and never reads it; it is excluded from builds at
  `build-portable.mjs:119`. Fix it for consistency, but nothing ships from it.
- **The repo is already inconsistently branded.** Release notes say "Cubric Studio v0.0.1"
  and "Cubric Studio Vision" from v1.0.0; `build-portable.mjs:831` sets
  `displayName: 'Cubric Studio Vision'` while `:682,683` set the macOS bundle name to
  `'Cubric Vision'`; `.claude/rules/component-mounts.md:161` already reads
  `Cubric Studio · v${APP_VERSION}`. Three spellings in one build script.
- **`docs/PROJECT.md:83` is wrong today**, independent of this card: it says
  `<Documents>/Cubric Studio/Projects/` while `routes/shared.js:53` returns
  `Documents/Cubric Vision/Projects`. It sends agents and users to a folder that does not
  exist.
- **Website and docs sources are not in MadPony-Identity.** They are two separate repos:
  `MadPonyInteractive/Cubric-Studio-Website` (`C:\AI\Mpi\Cubric Studio (Website)`) and
  `MadPonyInteractive/Cubric-Studio-Docs` (`C:\AI\Mpi\Cubric Studio (Docs)`). ~66
  hardcoded strings across three files on the site, four per-app page directories to
  collapse, and the whole docs tree namespaced under `/vision/`. No data file, no CMS.

Sweep size, whole repo: **~62 lines to change, ~250 that are real identifiers and must
stay, ~634 historical that must never be rewritten** (`docs/archive/**` is 603 of those
and its own README declares it historical).

### Decisions taken, so implementation never stops to ask

| # | Decision | Why |
|---|---|---|
| D1 | **Ship a 1.5.1 bridge release that widens the updater, then rename the artifacts freely at 2.0 while ALSO publishing the legacy `CubricVision-*` names one last time.** Drop the legacy names at 2.1. | The updater that runs during an update is the one already installed (`main.js:1287` spawns `update/win-update.cjs` from the *installed* root), so 1.5.1's widened pattern is what executes on the 1.5.1 → 2.0 hop. The dual-publish covers anyone who skipped 1.5.1. Together they let the old names actually die instead of being carried forever. **Supersedes the earlier "never rename the artifacts" position.** |
| D2 | **Keep `appId: cubric.vision` through 2.0**, but widen the acceptance check in the 1.5.1 bridge so a future change is possible without a second bridge. | `apply-update.cjs:246` hard-asserts it today. Nothing user-visible depends on the value, so there is no reason to change it *at* 2.0 — only a reason to stop it being permanently frozen. |
| D3 | **Heal the Documents folder: rename `Documents/Cubric Vision` → `Documents/Cubric Studio` on first 2.0 boot, behind a resolver that falls back to the old name.** | Lower-risk than it first appeared — see the two findings below. The resolver is the safety net: a rename that fails or is skipped is then harmless, because resolution never assumes it happened. **This reinstates and replaces the cancelled `brief.md` §C.** |
| D3a | **Leave `app.setName('Cubric Vision')` and the AppData path alone.** | For portable installs — which is every released build — `main.js:283-292` overrides userData to `<portable root>/user-data` via `app.setPath`, so `app.setName` never determines where user data lives. `%APPDATA%\Cubric Vision` is the **dev** path. Renaming it would migrate developer machines and nothing else. |
| D4 | **Do not rename any local checkout folder.** | `C:\AI\Mpi\Cubric-Studio` already exists as a sibling; `package.json:29` resolves `file:../Cubric-Studio/packages/connector`, and `Cubric-Prompt/src/main/index.ts:222` hardcodes the `'Cubric-Studio'` path segment and fails soft into a misleading "Cannot find broker CLI". GitHub repo names and local folder names are decoupled. |
| D5 | **The four identity mascot sites take the Studio character**; only the two generation peeks are media-aware. | Toast, tile-sheet, engine overlay and landing empty-state have no generation in scope. |
| D6 | **Keep `appId: 'cubric.studio'` on the broker for now** (`Cubric-Studio/packages/broker/src/brokerServer.ts:295`). | It collides semantically with the new product name, but the connector is being deprecated by MPI-677. Renaming a dying identifier is churn. Revisit only if the CLI (MPI-593) adopts it. |

### Why the Documents heal is safe (verified, not assumed)

- **A custom projects folder is untouched.** `getProjectsRoot()` (`routes/shared.js:41-56`)
  checks `.engine-config.json` `projectsPath` **first** and returns it when it exists. The
  Documents folder is only the default, so any user who chose their own location is not in
  the blast radius at all.
- **`project-paths.json` holds *external* parent dirs by definition** (`routes/shared.js:59-73`)
  — directories the user added *outside* the default root. Renaming the default root does
  not invalidate them. The one edge case is a user who added a parent dir that happens to
  sit inside `Documents/Cubric Vision/`; the heal must rewrite any entry carrying that
  prefix, not just move the folder.
- **Same volume, so the rename is atomic and instant.** It must run before `APP_DOCUMENTS`
  reaches the server fork (`main.js:762`) and before anything opens a file underneath it.

The failure mode is what makes this worth doing properly: if a rename half-fails and the
resolver still assumes the new name, the app opens onto an empty projects list and the user
reads that as **data loss**, even though every file is still on disk. Hence the resolver
comes first and the rename is opportunistic, never load-bearing.

Parked by Fabio, explicitly out of scope: per-operation colours, media-type accent lines
on cards, and the Audio/Prompt mascots. Follow-up card only — no colour work here.

## Completed

- [x] Phase 0 and 0b (2026-09-17, session 53d9d605).
- [x] Phase 1: repo renames, CI gate, pointer sweep, README note + mascot removal
      (2026-09-17, session ad10647f; commits mpi-ci `e23112e`, hub `98310e0`,
      MadPony-Identity `eb0ee38`, Vision `c0972475`).
- [ ] **Hand-off for Fabio (outside this card):** Website repo links (`index.html`,
      `vision/index.html`, `scripts/vision.js:126`, `llms.txt`, `funding.json`) and regenerating
      `l/fr*` from `shortlinks.json`; socials and YouTube descriptions from MadPony-Identity.
      All redirect-safe, no deadline.

## Remaining Work

## Phase 0: Gate — 1.5.0 ships first

- [ ] Confirm MPI-706 has closed and 1.5.0 is published before any rename step runs.
      No *rename* may land in a 1.5.x patch — the 1.5.1 bridge in Phase 0b is the single
      deliberate exception, and it changes no user-visible name. **Verify:**
      `gh release view v1.5.0` returns a published release, and MPI-706 is in `done`.

## Phase 0b: The 1.5.1 bridge — teach the installed fleet the new names

> **Drift, 2026-09-08 (MPI-709).** The three updater changes above are DONE — they landed in
> MPI-709's working tree, with `tests/updater-rename-bridge.test.cjs` covering this phase's
> Verify clauses. The fourth is superseded rather than done: **there is no 1.5.1.** MPI-709
> found 1.5.0 had two downloads, both Fabio's, so it was deleted and is being RE-CUT carrying
> both the `fromVersion` fix and this bridge — no phantom version. Phase 0a's verify
> (`gh release view v1.5.0` returns a published release) therefore refers to the re-cut.

Ships under the old name, changes nothing a user sees. Its only job is to put a wider
updater on disk so 2.0 can rename artifacts freely. Everything here is in the *shipped*
updater scripts, which is why it cannot wait for 2.0: the updater that runs is the one
already installed.

**1.5.1 became urgent on 2026-09-08 for an unrelated reason: MPI-709**, a P0 where the
1.5.0 delta bundle silently corrupts any install more than one version behind. That card
owns the hotfix and the release cut; this phase's tasks ride along in the same release.
**MPI-709 also forces 1.5.1's update bundle to be FULL rather than delta**, which happens to
be the safest possible carrier for these updater changes. Sequence: MPI-709 lands first,
these tasks join the same cut.

- [x] Widen the asset pattern in all three platform updaters so both the legacy and the new
      artifact names match: `scripts/portable/win-update.cjs:26`,
      `scripts/portable/linux/update.sh:74`, `scripts/portable/macos/update.command:19,21`.
      **Verify:** a unit check asserts the widened pattern matches both
      `CubricVision-windows-x64-update-v2.0.0.zip` and
      `CubricStudio-windows-x64-update-v2.0.0.zip`, and still rejects an unrelated asset.
- [x] Widen the relaunch-exe resolution so a renamed executable is found: `win-update.cjs:64`
      hardcodes `CubricVision.exe`, and `scripts/portable/windows/update.bat:15,16,21` +
      `update-from-zip.bat:18,20` use it as the node runtime. Resolve the new name first,
      fall back to the old. **Verify:** the applier relaunches successfully against a staged
      tree containing only the new exe name, and again against one containing only the old.
- [x] Widen the appId acceptance in `scripts/portable/apply-update.cjs:246` to accept both
      values rather than the single hardcoded `cubric.vision` (D2). The value does not change
      at 2.0; this only stops it being frozen forever. **Verify:** `node --test tests/` passes,
      including `tests/portable-update-apply.test.cjs`.
- [~] Cut and publish 1.5.1 with legacy artifact names, via `/mpi-release`. **Verify:**
      `npm run release:check` passes and a real 1.5.0 portable install updates itself to
      1.5.1 through the in-app prompt.

## Phase 1: Repo renames and the CI gate (sequential — order is load-bearing)

- [x] Rename the hub repo on GitHub, `Cubric-Studio` → `Cubric-Connector`. This is what
      frees the name and must come first. Do **not** rename the local folder (D4). Update
      its git remote, and its own `README.md:1` / `AGENTS.md:1` / `CLAUDE.md:1,3,101,105,113`
      headings. **Verify:** `gh repo view MadPonyInteractive/Cubric-Connector` resolves and
      `MadPonyInteractive/Cubric-Studio` 404s as a distinct repo.
- [x] Rename `Cubric-Vision` → `Cubric-Studio` on GitHub. Update the local remote with
      `git remote set-url`. **Verify:** `git remote -v` shows the new slug, `git fetch`
      succeeds, and `curl -sI https://api.github.com/repos/MadPonyInteractive/Cubric-Vision/releases/latest`
      returns a 301 to the new slug.
- [x] Fix the CI auth gate in lockstep: `mpi-ci/.github/workflows/cubric-vision-portable.yml:9,47,48`
      and `.github/workflows/build-portable.yml:44`. These are string comparisons, not
      URLs — a redirect does not save them. **Verify:** dispatch a build with the new slug
      and confirm the checkout step authenticates (the run reaches the build stage rather
      than failing at checkout).
- [x] Sweep cross-repo pointers that a redirect would silently mislead rather than break.
      Highest value: `MadPony-Identity/workflows/community/feature-request-tier-label.md:73`
      passes `--repo MadPonyInteractive/Cubric-Studio`, which post-rename **succeeds** into
      the wrong repo. Also `MadPony-Identity/scripts/shortlinks.json:8,13,18`,
      `scripts/community-digest.config.json:5`, `scripts/feature-request-label.py:51`, and
      `ComfyUi-MpiNodes/README.md:7` (the only public link in a repo that ships to the
      ComfyUI registry). **Verify:** each edited reference resolves to the intended repo
      with no redirect hop.

## Phase 2: Renderer — mascots and display strings (sequential, NOT a parallel batch)

These cannot be split into parallel tasks: the mascot work and the string work both edit
`index.html`, `MpiAbout.js`, `MpiGalleryGrid.js` and `js/shell/projectUI.js`. Splitting
them by concern would give two workers overlapping ownership of the same files, so they
run as one owned phase. **Phase verify mode: `user-ux`.**

- [ ] Stage the mascot assets. Copy from `C:\AI\Mpi\Cubric Studio Brand Assets` into
      per-character folders — `assets/mascot/studio/`, `assets/mascot/vision/`,
      `assets/mascot/video/` — taking `Studio-*`, `Vision-*` and `Video-*`. **Downscale on
      the way in**: the render targets are 66px and the sources are 1.5-4.2 MB each.
      Leave `Audio-*` and `Prompt-*` out (parked). **Verify:** every file the code
      references exists on disk, and the combined weight of `assets/mascot/` is smaller
      than the 13.7 MB it is today despite holding three characters instead of one.
- [ ] Add a small mascot-path map keyed on `MEDIA_TYPE` (`js/data/commandRegistry.js:23-27`)
      — a new module under `js/data/`, **not** `js/utils/icons.js`, which is the SVG icon
      registry and does not take raster assets. Cover `image`, `video` and `audio` so an
      audio group cannot silently resolve to the Vision character. **Verify:** a unit-style
      check resolves all three media types plus the identity character.
- [ ] Point the two generation peeks at the map. History: `MpiGroupHistoryBlock.js:455`
      (initial src) and `:742` (`_mascotShow` in `_setGenerating`), keyed on `modeKind`
      from `:254`. Gallery: `MpiGalleryGrid.js:1504-1507` `MASCOT_SRC` and `_setMascotState`
      at `:1522`, keyed on `group.type`. Both values are already in closure scope — no new
      plumbing, no new event field. **Verify:** run an image generation and a video
      generation in the app and confirm the correct character appears in both the History
      peek and the gallery card.
- [ ] Point the four identity sites at the Studio character (D5): `MpiToast.js:141-157`,
      `MpiTileSheet.js:174`, `MpiStartingComfy.js:24`, `js/shell/projectUI.js:205,226`.
      **Verify:** trigger a toast of each variant, a queued model install, an engine start
      and the zero-projects landing state; all four show Studio.
- [ ] Swap the identity logo: `index.html:19` and
      `MpiAbout.js:44`. Regenerate the derived icons from the new logo — `build/icon.png`,
      `build/icon.icns`, `media/icons/cubric-vision.{png,ico,icns}` (**keep the filenames**,
      they are wired into `build-portable.mjs:570-571` and
      `scripts/portable/linux/setup-desktop.sh`), and `favicon.png`
      (`.github/readme/mascot-greet.png` is gone: Fabio had the mascot removed from the README
      2026-09-17). **Verify:** launch `npm run app:isolated` and
      confirm the titlebar, About screen, taskbar icon and browser-tab favicon all show the
      new logo.
- [ ] Sweep the renderer display strings. `js/core/appName.js:13` **and its `appName.cjs`
      CommonJS twin** (main.js cannot import the ESM one — they must stay in sync);
      `index.html:7,9,20,69`; `MpiAbout.js:45,48`; `updateChecker.js:184`;
      `js/shell/projectUI.js:72`; `MpiAudioRecorder.js:169`; `MpiErrorDialog.js:146`;
      `js/pages/components.js:630`; `js/data/modelConstants/models.js:1028`. The wordmark is
      already a component — `Cubric<span class="mpi-wordmark__suffix">Vision</span>` — so
      "Studio" drops into the same structure. **Do not touch `js/data/releaseNotes.js`** —
      those are shipped 1.x notes and rewriting them would misstate history. **Verify:**
      `grep -rn "Cubric Vision" js/ index.html` returns only `releaseNotes.js` and comments
      describing real on-disk paths; `npm run lint` and `npm run test:desktop` pass.

## Parallel Batch: Non-renderer sweep

Genuinely disjoint file ownership, safe to run concurrently. Every task must be briefed
with `/mpi-brief-rule` output plus the Critical Rules Snapshot before dispatch.

- [x] **Main process and server strings.** Ownership: `main.js`, `routes/**` **except
      `routes/shared.js`** (owned by the heal task below).
      Change `main.js:51,222`, `routes/remotePodState.js:153`, `routes/engine.js:52`
      (prose only — the `C:\CubricVision` path suggestion in that same line is a real path,
      leave it), `routes/system.js:323` `ISSUE_REPO`. **Keep `main.js:269`
      `app.setName('Cubric Vision')` exactly as it is** — D3a: for portable installs
      `main.js:283-292` overrides userData anyway, so this only names the dev path.
      `tests/issue-report-url.test.cjs:86` asserts the exact issue URL and must be updated in
      the same task. Briefings: root-cause. **Verify:** `node --test tests/` passes,
      including `issue-report-url.test.cjs`.
- [x] **Heal the Documents folder.** Ownership: `routes/shared.js` **only**, plus its test.
      Both `getProjectsRoot()` (`:41-56`) and `getProjectPathsRegistryFile()` (`:65-74`)
      independently join `APP_DOCUMENTS` with the literal `'Cubric Vision'` — factor that into
      one resolver they both call. The resolver **prefers `Cubric Studio`, falls back to
      `Cubric Vision` when only the old folder exists**, and returns the new name for a fresh
      install. Then rename opportunistically: if the old folder exists and the new one does
      not, `fs.rename` it (same volume, atomic) and rewrite any `project-paths.json` entry
      carrying the old prefix. **A failed rename must be a no-op, never a fresh empty
      folder** — the resolver's fallback is what makes that safe. Leave the
      `.engine-config.json` `projectsPath` branch untouched; a user with a custom location is
      not in scope. Briefings: root-cause. **Verify:** a test covering four cases — old
      folder only (resolves old, renames, rewrites registry entries), new folder only
      (resolves new), both present (resolves new, renames nothing), neither (resolves new) —
      plus a simulated rename failure that must still resolve to the old folder with the
      project list intact.
- [x] **Docs sweep.** Ownership: `docs/**`, `README.md`. Change the ~24 Class-A prose lines
      plus the four live files in `docs/releases/`. **Do not touch `docs/archive/**` (603
      hits, declared historical by its own README) or the 20 dated
      `docs/releases/YYYY-MM-DD-vX.Y.Z.md` files.** Leave every line describing a real
      artifact filename, on-disk path, repo slug, Docker image or RunPod template. Two
      specifics: fix `docs/PROJECT.md:83` **back** to `Cubric Vision` (it is wrong today),
      and re-author `README.md:156` — "Vision is the first app in the Cubric Studio family"
      becomes self-referential after the rename and needs new wording, not a substitution.
      Briefings: root-cause. **Verify:** no line in `docs/` outside `archive/` and the dated
      release notes describes the product as Cubric Vision, and every path/filename mention
      still matches what the code actually produces.
- [x] **Agent tooling and CI text.** Ownership: `.claude/**`, `.github/**`.
      The two that generate future artifacts matter most:
      `.claude/skills/mpi-version-bump/SKILL.md:335` is the release-notes header template
      (`# Cubric Vision vX.Y.Z — YYYY-MM-DD`) that stamps every future note, and
      `.claude/skills/mpi-release/references/build-dispatch.md:22` is the git tag
      annotation. Also the ~20 Class-A description lines across `.claude/rules/`,
      `.claude/agents/` and the skills. **Leave every hardcoded slug, absolute repo path,
      hook path, Docker image name, pod-name literal (`guard-runpod-create.py:8,24,53`
      matches `'cubric-vision'` exactly) and the `.claude/skills/cubric-vision/` folder
      name** — renaming that folder changes the skill's invocation name and breaks its
      cross-references. Briefings: root-cause, kanban. **Verify:** `claude plugin validate`
      passes where applicable, and a dry-run of the release-notes generator emits a
      Cubric Studio header.
- [x] **Build identity.** Ownership: `scripts/build-portable.mjs`, `electron-builder.yml`,
      `release-baselines/*.json`, `package.json`, `package-lock.json`.
      Change `package.json` `productName` and `electron-builder.yml:2` `productName`;
      resolve the three-way spelling drift in `build-portable.mjs` (`:682,683` macOS bundle
      name, `:831` `displayName`) onto one name. Rename the artifacts (D1): `exeName`
      (`:41`), the three `rootName` templates (`:1183,1192,1198`) and the
      `release-baselines/*.json` `rootName` + `files[]` entries. Also point the updaters'
      default repo at the new slug: `scripts/portable/win-update.cjs:25` `DEFAULT_REPO`,
      `linux/update.sh:18`, `macos/update.command:16` (redirect-safe until then). **Add the old
      `CubricVision.exe` to `RETIRED_PATHS` (`:82-95`)** or every updated install keeps both
      binaries on disk forever — the delta bundle lists the new file but nothing deletes the
      old one. **Do not change `appId`** in either file (D2). If the `.code-workspace` file
      is ever renamed, `build-portable.mjs:119` must be updated in the same commit or it
      stops being excluded and ships inside every build. Briefings: root-cause.
      **Verify:** `npm run build:portable:dry-run` completes, the staged tree carries the new
      exe name with the unchanged `appId`, and `RETIRED_PATHS` names the old exe.

## Phase 3: The 2.0 release

**BLOCKED — the cut waits on four things (Fabio, 2026-09-18).** This is a gate, not a
suggestion: `/mpi-release` does not run until all four read clear.

| Gate | Card | State |
|---|---|---|
| Agent work in user flows | **MPI-532** Community flow packages (`user_flows/`) | doing / in-progress |
| Agent work in the in-app agent | **MPI-774** In-app agent slice A | doing / validating |
| Project registry cleanup | **MPI-809** removed project-paths entry comes back + **MPI-810** specs register `%TEMP%` in the real registry | MPI-809 doing / in-progress, MPI-810 todo / planned |
| Mascot animations | **MPI-777** Animated mascots | todo / blocked on GIF cut-out assets (MPI-757; MPI-771 is the SAM3 cut-out, doing/validating) |
| **UI colour** — the app is Vision rose everywhere | **MPI-736** Per-media-type accent family | todo / planned, **unblocked 2026-09-18** |

**Colour is a gate as of 2026-09-18 (Fabio).** 2.0 cannot ship named Cubric Studio while every
primary action is Vision's rose: `--accent-heat` and `--vision-accent` are the same value
(`oklch(0.76 0.17 355)`), so the app's action colour IS one character's identity colour. MPI-736
holds the decision (Studio owns no hue; each workspace takes its character's colour) and the
measured work — ~30 hardcoded pinks that bypass the token, plus 259 `--accent-heat` references
that follow it. Colour work still does NOT happen on MPI-708; this card only gates on it.

MPI-777 blocks this card twice over: it is Phase 3's gate AND the reason Phase 2's mascot
half is parked, so MPI-708 cannot close on either path until the mascot chain lands.

**What is NOT blocked, and can land before the cut:** the release-note section and the 2.1
follow-up card below. Only the `/mpi-release` step itself waits. Mirror this gate list onto
**MPI-595**, which is the umbrella that owns "what must read clear before `/mpi-version-bump`
stamps the version".

- [ ] Write the 2.0 release-note section: separate apps were planned, they became one app,
      so the ecosystem name is now the product name. Say plainly that **the projects folder
      is renamed automatically and no action is needed**, that 2.1 will drop the legacy
      download filenames, and (decision (c)) that updated Windows installs keep the old
      `CubricVision.exe` for now but should **re-pin shortcuts to `CubricStudio.exe`** because 2.1
      removes it. **Verify:** `npm run release:check` passes and the rename appears
      in `whatIsNew`.
- [ ] Cut 2.0.0 via `/mpi-release`, **dual-publishing the legacy `CubricVision-*` artifact
      names alongside the new ones** (D1) so a user who skipped the 1.5.1 bridge still
      matches on their old narrow pattern. **Verify:** the release lists both filenames for
      all three platforms.
- [ ] Raise a follow-up card for 2.1 to drop the legacy artifact names **and delete the old
      `CubricVision.exe`** (full bundles must carry `RETIRED_PATHS`: `createUpdateManifest`
      `delete: delta?.deletes ?? []` ships `[]` today). Also drop mpi-ci's old-slug mapping.
      **Verify:** the card exists and names the three `rootName` templates and the exe delete.

**Not this card:** the website and docs repos (`Cubric-Studio-Website`,
`Cubric-Studio-Docs`) and the MadPony-Identity brand statements. Fabio drives those from
MadPony-Identity, not from here. Recorded in Preservation Notes so the scope is deliberate
rather than forgotten.

## Plan Drift

- 2026-09-18 (session 09561fb8), **the launcher fix needed one more line than the plan said.**
  The plan called for wrapping each body in a function called on the last line. Measured, that is
  only half the fix: the wrap saves the body, but the shell then returns from `main`, reads on from
  its saved byte offset into the REWRITTEN file and executes whatever now sits there. The last line
  must be `main "$@"; exit $?` on ONE line. Also established while confirming the root cause:
  `apply-update.cjs` uses `fs.copyFileSync`, so this is an in-place truncate of the same inode, and
  Windows escapes it only because `copyFileSync` throws EBUSY there and the applier renames aside.
- 2026-09-18 (session 09561fb8), **Phase 2b's string list was two files short.** The plan's
  `Current State` list missed two live product references in `js/data/recipes/illustrious.recipe.js`
  and `pony.recipe.js`; the sweep grep found them. `minimax-h3.recipe.js:71` is dated history and
  stayed. The plan also listed `MpiNewProject.js` and `MpiErrorDialog.js` as strings to sweep — both
  name REAL on-disk folders and were kept, with the reason now written beside each.
- 2026-09-17 (session 0408510a), **Phase 2 MASCOT work PARKED by Fabio** until the animation work
  lands: every character already has one or two "waiting" animations as VIDEO that still need
  converting (MadPony-Identity "Mascot animations" session, which is waiting on the GIF session).
  They are renamed **action** animations: the user waits, the agent acts. The code's `waiting` pose
  maps to them, so there is no still-image waiting question to answer. Doing stills now would be
  the same job twice.
- 2026-09-17 (session 0408510a), **Phase 2 has drifted; re-plan before building it.**
  MPI-774 committed `a7500498` and no longer claims `index.html`/logo. MPI-766 (`192711ab`)
  ALREADY staged downscaled per-character WebP sets: `assets/mascot/{vision,video,audio,prompt,studio}/`
  `{greet,happy,idle}.webp`, 624 KB in total, and `js/shell/heroCrew.js` `_poseSrc(key, pose)` is an
  existing key-to-path map; reuse or lift it instead of a new module. MPI-774 added
  `studio/logo.webp` (3.4 KB, the agent's head). **Still missing:** a `waiting` pose for any character
  except Vision (the Brand Assets folder has only `Vision-Waiting.png`), and it is the pose the
  History peek, gallery card, tile sheet and agent chat show while generating. Also still missing: a
  full-size Studio logo for the titlebar, About and icons (`Studio-Logo.png`). New render sites since
  the plan: `MpiAgentChat.js:63,110,114`, `MpiGalleryGrid.js:2065` (scope-empty). Line numbers moved
  (`MpiGalleryGrid.js:1617-1619`, `MpiGroupHistoryBlock.js:839,1150`, `MpiStartingComfy.js:32`,
  `projectUI.js:210,231`). `MpiGroupHistoryBlock.js` is still claimed by MPI-771 (uncommitted).
  Held-file pass: `cubric-vision-generate/SKILL.md` done (MPI-774 released it).
- 2026-09-17 (session 0408510a): **exe decision = (c)** (Fabio). The `RETIRED_PATHS` comment in
  `build-portable.mjs` now says so. Phase 3 gains two items (below): the 2.0 note's re-pin line,
  and the 2.1 card must make FULL bundles carry `RETIRED_PATHS` so the delete actually fires.
  **Batch ownership narrowed:** the globs (`routes/**`, `docs/**`, `.claude/**`) overlapped live
  MPI-774 / MPI-532 claims, but the files that actually hold the old name barely did. Exact-file
  ownership (claim `ac7d298e`) let three workers run; three held files are left for a later pass.
  Dated research docs (`docs/proprietary-models-research/`, `docs/recipes/research/`,
  `docs/plans/`) are historical records and stay unchanged. `docs/PROJECT.md:83` no longer
  "reverts to Cubric Vision": the Documents heal landed, so it describes the 2.x name plus the
  automatic rename.
- 2026-09-17 (session ad10647f), Parallel Batch run PARTIALLY (Fabio: "run what you can now"):
  only **Heal the Documents folder** and **Build identity**; the other three wait on MPI-774 /
  MPI-760 claims. Two corrections given to the workers:
  - **The heal is VERSION-GATED to app major >= 2.** D3 says "first 2.0 boot", and master (1.6.1)
    runs Fabio's live app and every agent's app from this tree: an ungated heal would rename his
    real `Documents/Cubric Vision` on his next restart, before 2.0 exists, and a released 1.5.0
    portable on the same box would then open onto an empty gallery. Lazy + memoized, never at
    `require` time (MPI-779 made requiring `shared.js` side-effect free).
  - **`release-baselines/*.json` `files[]` should NOT be renamed.** A baseline describes an
    already-shipped install, and the retire logic only deletes paths the baseline lists; renaming
    `CubricVision.exe` there would make `RETIRED_PATHS` never match. The worker verifies this and
    also checks that v1.5.0's INSTALLED applier survives being told to delete the running
    `CubricVision.exe` before `RETIRED_PATHS` gains it.
  - **Result: `release-baselines/` holds no JSON at all** (MPI-709 `2092f07e` dropped them so
    mpi-ci ships FULL bundles), so there was nothing to rename there.
  - **`RETIRED_PATHS` is inert for the exe — OPEN DECISION for Fabio.** The entry was added
    (v1.5.0's `applyDeletes` renames a running image aside, so it would be safe), but retire
    entries only fire through `applyDelta`, which needs a baseline that LISTS the file: a full
    bundle ships `delete: []`, and a baseline stamped from 2.0+ never lists `CubricVision.exe`.
    So today every updated Windows install keeps BOTH exes. That is functional (update bundles
    carry the Electron root, so `CubricStudio.exe` arrives; Electron is `^41.0.3` on both
    v1.5.0 and master, so the old exe still launches the new app) and it keeps a user's pinned
    taskbar/desktop shortcut to `CubricVision.exe` working. Deleting it would need full bundles
    to carry the retire list (`createUpdateManifest` `delete: delta?.deletes ?? []`) and would
    break those shortcuts. Options: (a) keep both through 2.x, say so in the release note;
    (b) make full bundles delete it at 2.0 and tell users to re-pin; (c) keep at 2.0, delete at
    2.1 with a note. The comment on `RETIRED_PATHS` now says this plainly.
  - **Still naming `CubricVision-*` / `CubricVision.exe`, owned by the WAITING batch tasks:**
    `.claude/skills/mpi-release/SKILL.md:194-196` and `references/build-dispatch.md:74-76`
    (upload globs — MUST change before the next release or the upload misses the new files),
    `.github/ISSUE_TEMPLATE/portable-validation.yml:46`, `README.md:94` ("run
    `CubricVision.exe`"), `main.js:259` comment and `main.js:1252` User-Agent.
  - `npm run build:portable:dry-run` never stages binaries (`PORTABLE_DRY_RUN.txt`
    placeholder), so the plan's "staged tree carries the new exe name" is proven by
    `tests/portable-win-layout.test.cjs` (`PLATFORM_CONFIG.win32.exeName`) instead; a real
    CI build proves it end to end at release. The dry-run left
    `D:\CubricStudio\Vision\Builds\CubricStudio-*-v1.6.1-dry-run` (scratch).

- 2026-09-17 (session ad10647f), Phase 1:
  - **No lockstep for the CI gate.** mpi-ci now maps BOTH slugs to the deploy key
    (`contains(fromJSON(...))`), pushed before either rename, so the order of the mpi-ci and
    `build-portable.yml` changes no longer matters. Drop the old slug at 2.1 (add to that card).
  - **The hub's remote is the trap, not its redirect.** Once Vision takes the `Cubric-Studio`
    name, GitHub drops the hub's old-name redirect; a hub push through the old remote then lands
    on the PRODUCT repo. `set-url` on the hub must precede step 2. Any other hub clone needs it too.
  - **`feature-request-tier-label.md:73` is left alone.** Feature-request Discussions exist only on
    the product repo, so `--repo .../Cubric-Studio` becomes correct after the rename
    (MadPony-Identity's MPI-80 brief reads it the same way). Brand PROSE in MadPony-Identity is
    MPI-80's; this card changed slugs only there.
  - **`shortlinks.json` is a source file.** The deployed `/l/fr*` redirect pages live in the Website
    repo (out of scope); they keep working through GitHub's redirect until Fabio regenerates them.
  - **Code slugs stay with their owners:** `main.js:1251`, `routes/system.js:323` + its test,
    `MpiErrorDialog.js:181`, and the three updater defaults (`win-update.cjs:25`,
    `linux/update.sh:18`, `macos/update.command:16`, not listed anywhere before; added to the
    "Build identity" task). All redirect-safe meanwhile.
  - **Website download links survive the rename (measured, not assumed)** on the renamed public
    repo `denoland/deno_std` -> `std`: `github.com/.../releases/latest` and
    `.../releases/download/<tag>/<asset>` 301 to the new slug; `api.github.com/repos/<old>/releases/latest`
    301s to `/repositories/<id>/...` with `Access-Control-Allow-Origin: *` on both hops, so the site's
    browser `fetch` in `scripts/vision.js:126` still resolves. Holds only while nobody re-creates a
    repo named `Cubric-Vision`. `initDownloads()` matches assets on the platform token
    (`windows-x64`) not the product name, so the 2.0 artifact rename does not break it either;
    with D1's dual-publish it takes whichever full zip comes first. The website can't be updated
    BEFORE the rename (the new slug is the private hub until then); update it after, for tidiness.
  - The auto-mode classifier refused `gh repo rename` ("Modify Shared Resources") even with
    Fabio's explicit go: the renames are his to click, or he adds a permission rule.

- 2026-09-17 (session 53d9d605): **Phase 0 is met** - v1.5.0 is published (2026-09-08) and MPI-706
  is `done`. **Phase 0b is met without a 1.5.1**: there is no 1.5.1 (MPI-709 re-cut 1.5.0; Fabio
  2026-09-11 on MPI-720: the 1.5.x line's next update is 2.0). Checked on the `v1.5.0` tag: the
  Windows, Linux and macOS updaters match `^Cubric(Vision|Studio)-...-update-v.*\.zip$` and
  `apply-update.cjs` accepts `cubric.vision` and `cubric.studio`. Master reads 1.6.1: dev-line
  markers (MPI-722, MPI-782), never published. **Phase 2 collides** with MPI-774 (live session
  d56a1cbe, Desktop tab "Agent 7"): its claim covers `MpiPromptBox/`, `MpiAgentChat/`,
  `js/shell/agentPanel.js` and the component-events rule files. Re-check claims before Phase 2.
  The MPI-595 gate annotation written 2026-09-08 had never been committed; committed now.
- 2026-09-08: the brief assumed the website and docs sources live in MadPony-Identity. They
  are two separate repos (`Cubric-Studio-Website`, `Cubric-Studio-Docs`) — but Fabio drives
  both from MadPony-Identity, so they leave this card's scope entirely rather than becoming
  a phase here.
- 2026-09-08, **second pass after Fabio pushed back on both freezes**. The first draft took
  the conservative line twice: never rename the artifacts, never move the Documents folder.
  Both were replaced by healing the installed base instead of freezing it.
  - **Artifacts.** The updater that runs during an update is the one *already installed*
    (`main.js:1287` spawns `update/win-update.cjs` from the installed root), so a 1.5.1
    bridge that widens the pattern is what executes on the 1.5.1 → 2.0 hop. That plus a
    one-release dual-publish lets the legacy names actually die. The original D1 would have
    carried `CubricVision-*` forever.
  - **Documents folder.** Re-read of `routes/shared.js:41-74` and `main.js:283-292` showed
    the risk was smaller than the first draft assumed: a custom `projectsPath` bypasses the
    default entirely, `project-paths.json` holds *external* dirs by definition, and portable
    installs never use the AppData path at all. The heal is now in (D3) and the AppData
    rename stays out (D3a) — for a different reason than the first draft gave.
  - `brief.md` §C was cancelled in the first draft and is now **reinstated in a different
    shape**: Documents only, resolver-first, AppData untouched.

## Verification

**Verify mode:** user-ux

The mascot and logo work has a visual surface only Fabio can judge — whether the right
character appears on the right operation, and whether the downscaled assets still look
right at 66px and at titlebar size. Phases 0, 1 and the Parallel Batch are `auto`.

End to end, 2.0 is ready on this card when:

1. `git remote -v` shows `MadPonyInteractive/Cubric-Studio`, and the old slug 301s.
2. A CI portable build completes with the new slug — proving the `mpi-ci` auth gate fix.
3. The running app shows Cubric Studio in the titlebar, About screen, update prompt and
   window title, with the Studio logo and taskbar icon.
4. An image generation shows the Vision character and a video generation shows the Video
   character, in both the History peek and the gallery card.
5. `npm run lint`, `node --test tests/`, `npm run test:desktop` and `npm run release:check`
   all pass.
6. `npm run build:portable:dry-run` produces the renamed exe with `appId: cubric.vision`
   unchanged, and `RETIRED_PATHS` names the old exe.
7. **The three-hop fleet test — the one that cannot be reasoned about.** On a real portable
   install, not a sandbox: install 1.5.0 → update in-app to 1.5.1 → update in-app to 2.0.0
   with renamed artifacts. Every hop must apply and relaunch. This is what the whole 1.5.1
   bridge exists for, and the bridge is unverifiable any other way.
8. **The skipped-bridge test:** a 1.5.0 install pointed straight at 2.0.0 must also apply,
   via the dual-published legacy filename. Covers everyone who never took 1.5.1.
9. **The Documents heal, on a real profile with projects in it:** the folder is renamed, the
   project list is intact afterwards, and a `project-paths.json` entry that pointed inside
   the old folder still resolves. Then the failure case — make the rename fail and confirm
   the app falls back to the old folder with the project list still intact, rather than
   opening onto an empty gallery.

## Preservation Notes

- `docs/PROJECT.md:83` is a live defect independent of this card — fix it even if the card
  stalls.
- Follow-up cards to raise at close-out: **2.1 drops the legacy artifact names**;
  per-operation colours and media accent lines (parked by Fabio); the Audio and Prompt
  mascots; whether the `pod.cubric.studio/vision/` and `models.cubric.studio/vision/`
  namespaces still make sense once Vision is Studio; the broker `appId: 'cubric.studio'`
  (D6) if the CLI adopts the connector.
- **Out of scope by Fabio's decision, not by oversight:** the `Cubric-Studio-Website` and
  `Cubric-Studio-Docs` repos and the MadPony-Identity brand statements (`SOUL.md:23`,
  `PRODUCT.md:39`, `DESIGN.md:344`, `docs/product-briefs/cubric-vision.md:421`). He drives
  those from MadPony-Identity. One thing to hand over when he does: `initDownloads()` in the
  website's `scripts/vision.js` reads the GitHub releases API and will 301 rather than
  break, so it is easy to leave stale.
- `.claude/rules/` mentions the product name in ~20 places. Per CLAUDE.md rule 5, ask
  before editing rule files.
