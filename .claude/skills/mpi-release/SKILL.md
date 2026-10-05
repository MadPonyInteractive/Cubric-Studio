---
name: mpi-release
description: Cut a Cubric Studio release — the single GitHub-only release flow, one release per change, cut from master. Bump the right version digit (3rd = routine: a model, a Flow, a fix, an engine update; 2nd = a big visible step like a new workspace; 1st = a new generation, Fabio's call), stamp the files via mpi-version-bump, build the portable artifacts in CI, and publish a GitHub Release with the full builds + update bundles. Use when the user says "cut a release", "ship a release", "make a release", "publish the release", "release to GitHub", "ship this version", "release the fixes", or indicates master is ready to go public. There is ONE release flow now — no pre-release tiers, no branch merging.
user-invocable: true
---
# mpi-release — the one GitHub-only release flow

Cubric Studio ships from **master** to a **public GitHub Release**. That's it —
one branch, one channel. Every release is the **same mechanical operation**; only
the version digit differs:

| Digit | When | Example |
|---|---|---|
| **3rd** | Every routine release: a new model, a new Flow, a new op, a fix, an engine update | `2.0.1 → 2.0.2` |
| **2nd** | A big visible step: a new workspace, a main-screen redesign, a project schema change | `2.0.9 → 2.1.0` |
| **1st** | A new product generation — Fabio's call only | `2.4.3 → 3.0.0` |

Adopted 2026-10-05 (Fabio): the digits are read by users, so they follow size, not
semver — a 2nd digit per model would reach 2.300. Rationale and the full matrix:
`docs/versioning.md`.

Pick the digit, then run the exact same steps below. There is no separate
"promote", "patch", or "publish" skill — this is all of them.

**One release per change, always cut from master (Fabio, 2026-10-05).** Add a
Flow → release. Add a model → release. Fix a bug → release. No batching work up
for a big cut, no maintenance branches. The version bump lands on **master**, so
Fabio's own dev app shows the version users just got. Every release ships a FULL
update bundle (`release-baselines/README.md` § Current baselines) because users
skip versions and a delta serves only installs exactly one behind.

Read the two references in this skill's `references/` before running:
`build-dispatch.md` (CI build + artifact download) and `copy-review.md` (the two
mandatory user-facing copy gates). The version file edits belong to
**`mpi-version-bump`** — this skill calls it, it does not re-implement it.

## Invariants (do not skip)

- **Prep all, then STOP before each live op.** Version edits, notes, and the copy
  drafts are fine to do autonomously. PAUSE and wait for the user before: `git
  push`, pushing the `v*` tag (fires the CI build), and `gh release create` (the
  public moment). These are irreversible / public-facing.
- **Two copy-review gates are mandatory** — the in-app changelog and the GitHub
  release body. The user rewrites dev-speak into user-speak before it ships. See
  `references/copy-review.md`.
- **Shared git tree.** Commit by explicit pathspec (`git commit --only <paths>`),
  never `git add -A` (see `.claude/rules/git.md`).

## Preconditions

- **You cut from master, at the version you're bumping *from*.** `git show
  master:js/core/appVersion.js` equals the latest `gh release list` tag. Master
  carries no half-finished work between releases now, so there is nothing to
  branch around. **Maintenance branches are retired (2026-10-05):** `1.4.2`,
  `1.5.0` and `2.0.0` were the last; never cut from them or create another. (They
  existed because 1.2.0 could not be hotfixed past a master full of unfinished
  features — the one-change-per-release cadence removes that cause.)
- **`release-baselines/` holds no `*.json`.** One there makes CI emit a delta,
  which strands every install more than one release behind. Delete it before
  building and do not restamp after publishing.
- **`1.6.x` is the PRIVATE VERIFICATION LINE — never cut a public 1.6 release.**
  Master was stamped `1.6.0` on 2026-09-11 (MPI-722) so a build hand-delivered to
  one beta tester orders above every published release and still takes the 2.0
  prompt. Nothing on this line is published: no tag, no GitHub Release, no
  manifest. **Further hand-delivered builds bump the patch digit — 1.6.1, 1.6.2
  (Fabio, 2026-09-11)** — so each supersedes the last on the tester's machine
  without ever entering the public ordering. Each one still needs its own
  `RELEASE_NOTES` entry and `.approved-<ver>.json` token: `build-portable.mjs`
  refuses a non-dry-run build without both, and the changelog overlay fires once
  per `APP_VERSION`, so write the entry for that single reader. Leave
  `docs/releases/UNRELEASED.md` alone — it belongs to 2.0.
  A genuine 1.6.x cut from the release line would collide with installs already
  reporting that version, and `assertBundleApplies`
  (`scripts/portable/apply-update.cjs`) would then match a delta against the wrong
  build. Master's next real release is 2.0.0 — and that release owes a **full**
  bundle (`fromVersion: null`) alongside its delta, because the ordinary
  1.5.0 → 2.0.0 delta correctly refuses any 1.6.x install.
- The user-facing changes are feature-complete and `docs/releases/UNRELEASED.md`
  holds the accumulated notes since the last release.
- You know the digit to bump (table above).
- **Pod runtime channel is not drifted (MPI-340).** Released Pods boot the R2 `stable`
  runtime; dev work lands on `dev`. An un-promoted dev `wrapper.py`/`start.sh` means the
  new app ships against the OLD Pod runtime and every user breaks on their next Pod boot.
  Compare the two manifests (they carry a sha256 per file):
  ```bash
  curl -s https://pod.cubric.studio/vision/dev/manifest.json
  curl -s https://pod.cubric.studio/vision/stable/manifest.json
  ```
  Shas differ → **STOP and ask the user**: promote first
  (`c:/AI/Mpi/mpi-ci/cubric-vision-pod/publish-runtime.sh promote`), or confirm the dev
  runtime work is deliberately not shipping in this release. **Never auto-promote** — it
  is a live op affecting released users, same class as `git push`. (A dev-only Pod IMAGE
  tag needs no action: released builds resolve the frozen `POD_IMAGE_VERSION` pins.)
- **The Claude Desktop bundle lists the tools this release ships (MPI-1009).** The bridge
  passes the app's live `tools/list` through, so clients work regardless, but the `.mcpb`
  manifest's declared `tools` is what the extension directory shows. Compare the `TOOLS`
  names in `routes/mcp.js` with `mcp/cubric-studio/manifest.json` `tools`. They differ →
  refresh the manifest, bump ITS `version`, and cut a new bundle on the
  `cubric-studio-agents` repo + `server.json` + Registry publish, per `docs/mcp-server.md`
  § The Claude Desktop bundle. Deferred to here on purpose (Fabio, 2026-10-01): tools keep
  arriving while the agent is tested, and one refresh per release beats one per tool. It is
  public, so it waits for the user's go like the publish itself.
- **A bumped engine has smoke evidence (MPI-467).** If `dev_configs/node_lock.json`'s
  `comfyui.core.tag` moved since the last `v*` tag, `npm run release:check` **refuses the
  release** unless `dev_configs/smoke-evidence.json` proves a workflow actually RAN on the
  new pin — right version, zero FAILs, newer than the pin change. This is an enforced code
  gate in `scripts/release-health-check.mjs`, not a checklist line. Produce it with:
  ```bash
  node scripts/smoke-workflows.mjs --plan   # resolve the matrix, spend nothing
  node scripts/smoke-workflows.mjs          # the real run (RunPod GPU Pod, ~1h)
  ```
  Full procedure: [`docs/playbooks/bump-engine/`](../../../docs/playbooks/bump-engine/README.md).
  MPI-465 shipped a completely dead LTX for six days because nothing executed a graph and
  ComfyUI's own validation passed it. **Pod-green is not Windows-green** — the local
  portable half is the playbook's gate 5 and this check does not cover it.
  **The full matrix is for an engine move only (Fabio, 2026-10-05).** A release that adds
  one model smokes that model alone — `node scripts/smoke-workflows.mjs --models <id>`
  (`--flows <id>` for a Flow) — and a fix with no graph or engine change needs no Pod smoke.

## Private 1.6.x build (hand-delivered, never published)

None of the numbered Steps below apply: no `mpi-version-bump`, no CI, no tag, no
GitHub Release. The recipe is a card checklist, done three times (MPI-720, MPI-782,
MPI-938); **copy [`MPI-938/checklist.md`](../../../.agents/mpi-kanban/tasks/MPI-938/checklist.md)
into a new card and follow its `validation.md` as the worked example.** In short:
stamp the version triple by hand, add `RELEASE_NOTES['<ver>']` for its one reader, build
from the detached worktree `D:/tmp/cv-720` with `--clean --platform win32 --arch x64
--from-manifest <previous *.baseline-manifest.json in Builds> --no-source-manifest`,
apply the delta over a copy of the previous stage **with that stage's own
`update-from-zip.bat`**, hash the patched tree against the new full manifest, then save the
new baseline and a `READ-ME-FIRST.md` beside the zip. Two traps:

- **Fabio writes the approval token, not you.** `release-notes-approval.mjs approve
  --yes` is classifier-denied for agents even on the private line. Show him the entry,
  hand him `npm run release:approve -- --version <ver>`, and build only after.
- **A delta over a pre-rename baseline retires `CubricVision.exe`.** Any baseline that
  lists it (every 1.6.0/1.6.1 one) makes the delta delete it via `RETIRED_PATHS`; the
  running exe is evicted to `CubricVision.exe.old`, which is never swept. The note must
  tell the tester to launch and re-pin `CubricStudio.exe`.

## Steps

### 1. Stamp the version — via mpi-version-bump
Run **`mpi-version-bump`** for the chosen digit. It bumps `appVersion.js` +
`package.json` + `package-lock.json`, updates the operation/model registries and
`operation_registry.json` if ops changed, folds every `docs/releases/UNRELEASED.md`
item into the `js/data/releaseNotes.js` block + a new archival
`docs/releases/YYYY-MM-DD-v<ver>.md`, then clears UNRELEASED back to its header.
Hold `release:approve`/`check` until after Gate 1.

> Derived stage (`js/core/appStage.js`) is automatic: every `X.Y.Z` with X ≥ 1 is
> "Release", `0.x.x` is "Alpha". You don't set it.

### 2. 🛑 Gate 1 — user reviews the in-app changelog
Present the `releaseNotes.js` block rendered the way `MpiChangelogDialog` shows it
(kicker `<Stage> · v<ver>`; fixed section order Breaking → Important → What's new →
Fixes → Engine; each item plain text). Apply the user's edits to `releaseNotes.js`
AND the archival md so they stay aligned (`references/copy-review.md` Gate 1). Then
`npm run release:approve` + `npm run release:check`.

> **Do not approve on a red suite.** `mpi-version-bump` step 6 runs `npm test` +
> `npm run test:desktop`; confirm both came back green before approving. Good copy
> on a broken build is still a broken build — 1.3.0 shipped with the LoRA and
> upscale pickers dead and every static check passed (MPI-443).

> ⚠️ **`release:approve` must be the LAST thing you touch before building.** The
> build step hashes `releaseNotes.js` against the committed approval stamp
> (`.approved-<ver>.json`); ANY edit after approving (even a one-word copy fix)
> re-drifts the hash and the CI build FAILS with *"Release notes … changed after
> approval"*. `release:check` does NOT catch this — a green check is not proof the
> build will pass. If you touch the notes after approving, re-run
> `release:approve`, re-commit the stamp, THEN build. `release:approve` prompts
> y/N — the USER runs it; agents are classifier-blocked.

### 3. Commit master (explicit pathspec) — then 🛑 STOP for push
Commit only your files (shared tree — never `git add -A`). Pushing master is a
live op: stop, let the user push (or run it once authorized). CI builds the
*pushed* ref, so master must be pushed before the build.

### 4. 🛑 Build — push the `v<ver>` tag, then download artifacts
Per `references/build-dispatch.md`: the `v<ver>` tag push is the build trigger
(`push: tags: v*` → private mpi-ci build). Pushing the tag is user-authorized —
stop first. When CI finishes, download the **6 artifacts** (3 full builds + 3
update bundles) to `D:\CubricStudio\Vision\Builds\v<ver>\`, verify they landed,
then delete the CI run's artifacts (storage hygiene).

> The tag publishes **nothing** on its own — it only fires the private artifact
> build. The public moment is `gh release create` in Step 6.

> **Rebuilt via `workflow_dispatch`? The tag no longer matches the artifacts.**
> Any rebuild round dispatched by `ref` leaves the tag behind, and the release
> would then claim provenance on code that was never built. Before Step 6, check
> `git rev-parse 'v<ver>^{}'` against the SHA CI actually built, and move it if
> they differ (`git tag -f -a v<ver> <build-sha>` + force-push — user-authorized;
> agents are classifier-blocked on `push --force`). Measured 2026-08-01: five
> rebuild rounds left v1.3.0's tag 63 commits stale.

### 5. 🛑 Gate 2 — user reviews the GitHub release body
The release body is user-facing → present it for review/rewrite
(`references/copy-review.md` Gate 2). The body bundles the accumulated changelog
blocks since the last release (each version added its own block; a release that
skips versions lists all of them). Keep within the claim boundary in
`docs/releases/github-release-checklist.md` (image + video gen allowed; no
unshipped-roadmap claims; Vision is local image/video, not an assistant) and
follow the platform-disclosure rule in that checklist.

### 6. 🛑 Publish — create the GitHub Release

> **Install-test the update bundle first, then `npm run release:check:publish`.** Run the
> update leg in
> [`docs/playbooks/install-test/README.md`](../../../docs/playbooks/install-test/README.md)
> § 3 — an in-place update from an install **at least two released versions behind**,
> followed by a real generation whose output you open and look at — and record
> `dev_configs/update-evidence.json`. The publish-mode check refuses the release without it.
> A one-behind test proves nothing: a delta's `fromVersion` IS that install. 1.5.0 shipped a
> delta that silently corrupted every install further back, and the old checklist line
> asserted only that `user-data\` survived — which it did, on a build that never got past
> the landing screen (MPI-709).

With the user's authorization, create the release on the existing tag and attach
all 6 artifacts (full builds **and** update bundles — the update bundles are how
existing users patch in place via the online `update.*` script; without them
every update is a full re-download):
```bash
gh release create v<ver> --repo MadPonyInteractive/Cubric-Studio \
  --title "v<ver>" --notes-file <body.md> --latest \
  D:/CubricStudio/Vision/Builds/v<ver>/CubricStudio-*-v<ver>.zip \
  D:/CubricStudio/Vision/Builds/v<ver>/CubricStudio-*-v<ver>.tar.gz \
  D:/CubricStudio/Vision/Builds/v<ver>/CubricStudio-*-update-v<ver>.zip
```
Use the canonical asset names from `docs/releases/github-release-checklist.md`: the six
`CubricStudio-*` assets and nothing else. **No legacy `CubricVision-*` set at 2.0.0**
(Fabio 2026-09-29, MPI-972): 2.0 updates in place from 1.5.0, and older installs download it
fresh. **No `.mcpb` either** (Fabio 2026-09-29): the Claude Desktop extension's one home is
the `cubric-studio-agents` release (`docs/mcp-server.md`), which the Settings page
(`routes/agentConnect.js` `MCPB_URL`), the agents README and the MCP Registry all read.

> **Title = the bare tag.** Every published release is named `v1.2.0` / `v1.1.0` /
> `v1.0.1` — name equals tag. Corrected 2026-08-01 (this step used to say
> `Cubric Vision v<ver>`, which no release has ever used). Check
> `gh release list` before inventing a title.

### 7. Verify the release is REACHABLE — do not skip
Publishing is not proof users can see it. `check-for-update` ([main.js](../../../main.js))
reads `releases/latest`, which **excludes drafts and prereleases** — a slip there leaves
every installed app silently seeing the old version, with no error surfaced anywhere.
```bash
curl -s https://api.github.com/repos/MadPonyInteractive/Cubric-Studio/releases/latest \
  | grep -E '"tag_name"|"prerelease"|"draft"'
```
Wants `"tag_name": "v<ver>"`, `"prerelease": false`, `"draft": false`. Anything else →
fix on GitHub before announcing.

Then prove the prompt fires: launch a portable build of the **previous** version and
confirm the "Update available" dialog appears. MPI-334 shipped code-verified only and
could not be tested before 1.3.0 (a 1.2.0 install correctly saw 1.2.0 as latest), so
treat the first real observation as the validation. **Windows builds older than 1.3.0
cannot be reached this way at all** — Smart App Control blocks the update scripts; the
release body must tell those users to download the full zip
(`docs/releases/github-release-checklist.md`).

### 8. Summary
Report the published tag, release URL, and attached assets. **Comms are out of
scope** — announcement copy (Patreon / Discord / YouTube / Gumroad) is owned by
the MadPony-Identity launch-comms workflow, a separate manual step the user
drives. (Patreon is a comms/support channel only — it no longer gates release
downloads.)

### 9. Post-publish — nothing to restamp, no branch to cut
**Retired 2026-10-05 (MPI-1026).** This step used to restamp
`release-baselines/*.json` to the shipped manifests and cut a `<ver>` maintenance
branch. Both are gone with the one-change-per-release cadence: baselines stay
deleted so every update bundle is FULL, and a fix ships from master as the next
release. Master already carries the bumped version, so the step is done.
