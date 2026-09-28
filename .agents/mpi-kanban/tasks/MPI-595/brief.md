# MPI-595 — 2.0 release readiness umbrella

**There is no pre-release tier.** One GitHub-only release flow (`mpi-release` skill), so this
card IS the pre-release: the gate list that must read clear before `/mpi-version-bump` stamps
**2.0.0**. It re-parents nothing; every member keeps its own umbrella. A gate that does not
clear becomes a **known-issue line in the notes**, never a silent omission.

**REFRESHED 2026-09-27** (the 2026-09-08 text is in git history). Fabio, same day: *no more
models or Flows before 2.0 — get ready as soon as possible.* That freezes the model and Flow
list, which is the condition the smoke was waiting on (Gate B1). Two peers are still landing
features that ship in 2.0: gallery stacks (MPI-949) and the in-app agent (MPI-941).

Numbers rot; measure at pickup (`checklist.md` § ON PICKUP). Stable facts: last PUBLIC release
is **v1.5.0** (2026-09-08), cut from the 1.4.x line, NOT from master — so master carries every
commit since v1.4.2 and 1.5.0's ports (MPI-706, MPI-717's download fixes) are NOT new in 2.0.
The 1.6.x builds were private tester builds and do not count
(`project_next_public_release_is_2_0`).

## Gate A — must fix (code, or a product call on code)

| # | Card | Why it gates 2.0 | Who |
|---|---|---|---|
| A1 | **MPI-806** RunPod REST v1 -> v2 | **NEW 2026-09-27, HARD DATE.** v1 returns 410 on **2026-11-15**. The app's only client (`routes/runpodRemote.js`) is all v1, so every version shipped today loses the remote engine that day. Worse, the Pod runtime's idle watchdog (`mpi-ci/.../wrapper.py` `_self_stop`) POSTs v1 `/stop` and logs success without reading the status: after 11-15 an idle Pod never stops and **bills the user forever**. The watchdog ships as the Pod RUNTIME (`publish-runtime.sh`), so once promoted it protects every app version, 1.5.0 included. **2.0 itself must ship by ~2026-11-01** so users auto-update before the cutoff. | agent (code); live leg needs Fabio's go (rents a Pod) |
| A2 | **MPI-516** a vanished prompt hangs forever | Deferred TO this release by Fabio 2026-08-10. Still open: `comfyController.js` `_reconcileFromHistory` treats absent-from-history as "still running", so the remote poll spins forever and local has no poll. Port the smoke runner's three-signal detector WITH its re-read guard. | agent |
| ~~A3~~ | ~~**MPI-736** accent family~~ **DONE 2026-09-27** | Fabio: "The colours are all good, so that card should be done." It was MPI-708's last open rename gate, so the rename now waits only on the cut itself. | done |
| ~~A4~~ | ~~**MPI-780** paid-Flow chain~~ **DONE 2026-09-27** | Both Gumroad products are LIVE at £4, each with a 100-use 100%-off code set to apply automatically (MadPony-Identity MPI-81). Get it opens the plain product pages (`fe68f620d`, `MpiFlowLibrary.js` `PAID_FLOWS[].url`), so no code sits in this repo. The `cubric.studio/flows/*` redirect (**MPI-872**) was dropped: rejected, not needed. One check left, on the 2.0 build: B7. | done |
| A5 | **MPI-954** the 1.x -> 2.0 launcher hop | **Fabio 2026-09-27: fix it** (not a known-issue line). The wrap (`d2379a38f`) protects 2.0 -> 2.1 onward only: on the hop the INSTALLED 1.5.0 applier `copyFileSync`s the new launcher over the running one, `sh` resumes mid-file, and a perfect update reports FAILED (exit 127). The fix has to live in what the 2.0 bundle contains and what 2.0 does at boot. Evidence: MPI-708 `validation.md` § MPI-595 Gate A, message `78a7f920`. Real-hardware proof on the Linux box (the updater is remote-only work, so the box can do it). | agent (in doing), then Linux box |
| A6 | **MPI-591** H3 in Extend Video — **IN 2.0** | **Fabio 2026-09-27:** not finished, and wanted in 2.0 ("a lot of users are only going to install H3"); he finishes it in its own session. So it is a gate, and it must land BEFORE the smoke (B1). **Watch the engine pin:** the FL2VA design needs core `MiniMaxH3MotionContext`, which is not in ComfyUI v0.34.0/v0.34.2. If 591 needs a core bump, `node_lock.json` moves, python_deps re-compiles, and the smoke + Pod image cover the new core (`/mpi-bump-engine`). | Fabio's MPI-591 session |
| ~~A7~~ | ~~MPI-623 node packs~~ **DONE 2026-09-27, MPI-952 (`b3c25a678`)** | 3D scene is not in 2.0 (Fabio). ComfyUI-SplatKit + `click` left the lock and the curated set. **ComfyUI-Mickmumpitz-Nodes stays**: the shipped Outpaint Flow uses `MickmumpitzPanoHarmonizeBoundary` (the first sweep wrongly called it unused). MPI-623 restores SplatKit by reverting `b3c25a678`. | done |

**Cleared since 2026-09-08:** MPI-507 / MPI-515 (rejected by MPI-734 — PiD stays a model, badge
off, so there is nothing to remove); MPI-575 (done; Fabio: not a blocker); MPI-522 / 523 / 527;
MPI-708's Phase 3 gates MPI-532, MPI-774, MPI-809, MPI-810, MPI-777 (all done); MPI-873 (done).

## Gate B — must verify

| # | Item | Notes |
|---|---|---|
| B1 | **The smoke is owed, and now is its time** | `release:check` is RED: evidence recorded 2026-09-05, `node_lock.json` moved 2026-09-17, 58 node classes unattested. Fabio held it (2026-08-30) until the models and Flows landed; that condition is met 2026-09-27. Order: A6 and A7 first (they change graphs and the lock) -> sync `node_lock.json` AND `python_deps.txt` into `mpi-ci/cubric-vision-pod` -> `smoke-workflows.mjs --plan` (free, show Fabio) -> rebuild the DEV Pod image -> run, **including a video op** (PyAV major bump) -> **promote** a clean release Pod image (mandatory: an app at the new pin with the old released Pod means two ComfyUI versions, silently). RunPod spend: Fabio's go. |
| B2 | **MPI-953** Flows in the smoke | **Fabio 2026-09-27: test Flows in the smoke.** 13 Flows ship; the runner's matrix is `model x supportedOps`, so a green run says nothing about them. MPI-953 adds a Flow leg (selector, committed fixture media, `--plan` line). Runs as part of B1. |
| B3 | **MPI-559 phase 1**, the Linux leg — **REMOTE-ONLY** | **The Linux box cannot install ComfyUI** (thermal shutdown, no AVX2; Fabio 2026-09-27 and `feedback_runpod_serial_linuxbox_on_request`), so no local-engine leg exists. What it CAN prove on a real 2.0 Linux build: the in-app agent, DeepInfra cloud models, RunPod remote (the MPI-806 v2 live leg fits here), and the updater (MPI-954 A/B through `update.sh`). The box is off by default: Fabio turns it on, then `ssh linuxbox`. |
| B4 | Both suites green | `npm test`, `npm run test:desktop`. CI runs both on every push. |
| ~~B5~~ | ~~**MPI-656 Phase 1 runs on every install**~~ **CLEARED 2026-09-27 by reading** (every YAML writer goes through `writeExtraModelPathsYaml` -> `setRoots`; seed + parity tested in `tests/model-roots.test.cjs`) | `620627d3b` made `model_roots.json` the source of truth for `getCustomRoot()`, seeded from the YAML, with no UI. Meant to be behaviour-neutral (one root). Confirm on an install that HAS a custom models root before 2.0 puts it on every machine. |
| ~~B6~~ | ~~**MPI-710**~~ **CLEARED 2026-09-27 by reading** | The 1.5.0 -> 2.0 hop runs 1.5.0's applier, which lacks MPI-523's manifest copy, so the installed top-level `update-manifest.json` will stay stale. It does not matter: nothing load-bearing reads it. The applier keys its guard off `package.json` on purpose (`apply-update.cjs:88-100`), and main, routes and `updateChecker` never read the installed copy. |
| B7 | **Get it on the paid Flows** | On the 2.0 build, Get it on Head Swap and DramaBox opens its Gumroad page at £0 (the code applies itself; £4 once its 100 uses are spent). |

## Gate C — decide / notes (cheap, but the notes are false without it)

- **Claim audit of `UNRELEASED.md` against `v1.5.0`**, not v1.4.2: the last public tag. Anything
  1.5.0 already shipped is not new here. Gate 0 of `.claude/skills/mpi-release/references/copy-review.md`.
- **Coverage sweep.** Shipped with no bullet yet (2026-09-27): the MCP server + Settings >
  Connect an agent (MPI-593/947), dictation (946), the mascots (777, 906-909), stacks (949, when
  it lands), the agent's model-free image tools (941/904), 16K images (925/926/943), SVG import
  (933/934), the local server answering only itself (921/922). Short bullets (MPI-814).
- **The rename section** (MPI-708 Phase 3): projects folder renamed automatically, no action
  needed; updated Windows installs keep `CubricVision.exe` for now, re-pin to
  `CubricStudio.exe`; 2.1 drops the legacy names.
- **Flow-list reconcile — LAST, once, at notes freeze.** 13 ids in `FLOWS` today: ltx-extend,
  ltx-foley, ltx-upscale, scribble-object, scribble, character-sheet, outpaint, voice-changer,
  chatter-box, stems, object-stamp, minimax-music, sound-and-music. head-swap and drama-box are
  paid adverts (`PAID_FLOWS`), not built-ins.
- **Known-issue lines to decide:** macOS (no Mac to verify; the 1.4 `xcode-select --install`
  line, or drop macOS from the claim surface); unsigned exe vs Smart App Control (MPI-616 —
  signing is blocked on the business shape); A5 if not mitigated; installs that stay on 1.5.0
  lose the remote engine on 2026-11-15.
- **In or out:** MPI-543 / MPI-544 / MPI-569 (toasts). MPI-578 is out (no engine bump now).
- **Why major** — ANSWERED 2026-08-26: Flows, on audience not code. The rename (MPI-708) does
  owe a note, which is the rename section above.

## Agent connection (MPI-593)

2.0 is the first public release with `POST /mcp`; the public `cubric-studio-agents` repo already
says it needs 2.0. App `README.md` gets a "Use it from your AI agent" section (it says nothing
today); `UNRELEASED.md` gets its bullet; decide whether `mpi-release` step 6 still attaches a
second `.mcpb` (one home, the agents repo, is simpler); Claude Desktop directory submission goes
AFTER 2.0 is live, because reviewers test the released app.

## Gate D — hygiene at the cut

- `validating` cards resolved, not parked: MPI-845, MPI-827 (Fabio's eye), MPI-866 (phone push),
  MPI-720 (a 1.5.0 delta for one reporter — superseded by the 1.6.x builds? Fabio). MPI-603 is
  release-gated the other way round: delete the outpaint LoRA from R2/HF only AFTER 2.0 ships.
- Parked `doing` cards made honest: MPI-623, MPI-711, MPI-591, MPI-656 are not 2.0 work.
- The 1.6.0/1.6.1/1.6.2 `RELEASE_NOTES` entries and their `.approved-1.6.*.json` tokens are
  deleted at the fold: inert once APP_VERSION passes them, and `release:check` fails on their
  missing archival notes.
- MPI-708 Phase 3: dual-publish the legacy `CubricVision-*` artifact names; the 2.1 follow-up card.
- `python scripts/overtaken-cards.py`; push; commit by pathspec; `/mpi-version-bump` 2.0.0,
  `/mpi-release`.
- Release day, outside the repo: Claude Desktop directory submission. (The Gumroad products went live 2026-09-27, A4.)
- After the release: MPI-603's R2/HF delete, MPI-612 (old Klein style LoRAs).
