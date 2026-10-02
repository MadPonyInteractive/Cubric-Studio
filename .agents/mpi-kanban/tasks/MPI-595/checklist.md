# MPI-595 — 2.0 gate checklist

Refreshed 2026-09-27 (the 2026-09-26 list is in git history). Reasoning per item: `brief.md`.
Order: A -> B -> C -> D. A gate that will not clear gets a **known-issue bullet**.

## WAITING ON (Fabio 2026-09-29) — the cut starts when these land

"We are almost ready." Every gate that needs no one else is clear; what is left:

- [ ] **NEW 2026-09-30 (Fabio):** an umbrella-organising agent found MORE work that must land
  before 2.0. Reviewed 2026-09-30 (session 0e08597e): the sweep itself (MPI-985/986) names no new
  2.0 gate (986 is post-2.0 by its own card); the candidates came from open cards naming 2.0 and
  were put to Fabio. He takes them ONE AT A TIME. Decided so far:
  - [x] **MPI-856 the cloud-only user — 2.0 GATE (Fabio 2026-09-30).** DONE 2026-09-30:
    `d5a783ce7`, CI green (run 36685592716), Fabio "1" after a cloud image + cloud video in an
    isolated no-engine app. Projects open with no engine; one refusal for every engine action
  - [x] **MPI-743 + MPI-828 + MPI-742, the Flow licence surface — 2.0 GATE (Fabio 2026-09-30),
    his picks: no message on Cancel, one only when an install fails.** 828's row had shipped in
    MPI-666 (doc fixed); 743 = decision recorded + the drawer pick now repaints the tile; all seen
    in isolated `:51518` (MPI-742 validation.md). Fabio "looks good" 2026-09-30; code `850a823b6`,
    CI green (run 36691311222), all three closed
  - [x] **MPI-970 Routines — 2.0 GATE (Fabio 2026-09-30).** DONE (board `done`, read 2026-10-01).
    Built by its own session (runner live
    2026-09-30; left: W2 `routine` tool, B1 paid agent suite on his yes, docs + his look). The docs
    site's Routines page rides on it
  - [x] **MPI-965 community benchmark — 2.0 GATE (Fabio 2026-09-30).** DONE `026fef227` (CI green
    on `961b8599e`, Fabio's look passed). App half already on master
    (`fe90d30f0`), service live; left: his shared Ollama run + copy look, privacy page push on his
    yes, stamp the Ollama scores
  - **Split of work (Fabio 2026-09-30):** the session titled **"Agent 70"** owns the in-app agent and
    everything around it (MPI-965, MPI-970, the Ollama/agent-chat cards). THIS umbrella takes
    everything else; relieve Agent 70 only when nothing else is left
  - [x] **MPI-841 registry browsing — NOT 2.0; a 2.1 BLOCKER (Fabio 2026-09-30)**, noted atop its
    plan.md. Same talk: Head Swap + DramaBox listed in the public registry as paid-lane entries
    (entry files only, Gumroad links, zip sha256) — registry PR #2, on his yes
  - [x] **MPI-971** board `done` (read 2026-10-02; closed with MPI-962, see Big photos below).
    Was: has no owner — a 2.0 gate nobody had picked up; this umbrella takes it
    (Fabio 2026-09-30: "go plan MPI-971"). PLANNED 2026-09-30: `tasks/MPI-971/plan.md`, 4 phases,
    two picks for Fabio (P-A upscale refuses an output over 16384; P-B Detail composites back),
    Fabio 2026-09-30: YES to both. **Phase 1 DONE
    2026-09-30** (`doing`): model-resolution ops on a 16K send the engine a 4096 copy, live-proven
    (Klein Edit + H3 i2v). Next: Phase 2, localised edits crop/stitch (Fabio's look ends it)
  - [x] **Registry PR #2** (cubric-flows-registry, Head Swap + DramaBox paid entries) MERGED
    2026-10-02 on Fabio's go (squash `a7460019a`, lint green; no main-branch build to wait on)
  - [x] **MPI-708 mascots — NOT a 2.0 gate (Fabio 2026-09-30):** the still logo stays; the
    animated crew already shipped (MPI-777). The candidate list is now EMPTY
  - Housekeeping found: `secrets:endpoint-changed` landed (`js/events.js:187`), message
    `ec93cbba` already resolved by its peer; MPI-951 (2.1) still assumes 2.0 dual-publishes CubricVision-* (dropped
    2026-09-29, MPI-972) and needs rewording before 2.1
- [x] **Website revamp — MPI-973** DONE 2026-09-29 (built, Fabio signed off, `a34d787ad`). Held
  unpublished: **MPI-983** publishes cubric.studio AND docs.cubric.studio the moment 2.0 is
  released (docs first, `e526d10fa`) — a CUT step now
- [ ] **Docs website** — built by Fabio's agent; publishes with MPI-983 at the cut. **Fabio
  2026-10-01: its session is almost finished, small adjustments only.** NOT finished
  (checked 2026-09-30): Docs-repo card MPI-19 is `doing`, branch `docs-2.0` last commit 2026-09-29;
  3 items left — re-audit the rewritten pages, a Routines page (waits on MPI-970), Slice 7 claim audit
- [ ] **In-app agent** — Fabio has an agent on what is left. MPI-941 (umbrella 2) itself closed 2026-09-29 (`f622892db`): check its UNRELEASED line landed (Gate C) and which card holds the rest
- [x] **Big photos — MPI-962** (umbrella) — closed 2026-09-30 with its last member **MPI-971** (16K engine ops, app-side sizing; Fabio verified locally + on a Pod, CI green `e752180c3`; `docs/big-photos.md`). MPI-1001 (Pod WS wedge) closed the same day
- [x] **MPI-1000 small Flow + media fixes** — **CLOSED 2026-10-01** (`cb0b3bff5`: every member done; MPI-1004 `b639dd345`) (umbrella by Agent 74: MPI-997 Character Sheet split,
  MPI-998 Object Stamp flip, MPI-999 recording silence strip) — **folded into THIS umbrella by
  Fabio 2026-09-30, picked up AFTER MPI-971 closes.** Plan `tasks/MPI-1000/plan.md`: 998 + 999 in
  parallel, 997 waits on MPI-603 (`validating` on 2026-09-30). **A 2.0 gate — Fabio 2026-09-30.**
  NEXT, now that MPI-971 is closed
- [ ] Then **the cut**: Gate D below, top to bottom. Costs ~nothing (CI + R2); it needs Fabio's yes
  because it is public and one-way (promote reaches every released Pod; the release reaches every updater)

## EVERY CARD IN `doing` IS FOLDED HERE (Fabio 2026-10-01 — no card left on the side)

Fabio 2026-10-01: two sessions own everything until the smoke and the release, by handoffs —
THIS umbrella and the session titled **"Agent 85"** (MPI-513). Split proposed by Agent 85 and
accepted 2026-10-01. A card nobody is named on is NOT out of 2.0 — only Fabio takes one out.
**Order: every card below lands, THEN the smoke (B1 re-run if the lock moved), THEN the release.**

THIS umbrella:
- [x] **MPI-918** CLOSED 2026-10-02 (`7f2d91ff7`, CI green on `5dd3e2c2b`), **MPI-985 closed with
  it.** Final cloud slots: Scribble Klein cloud + Nano Banana, Draw It In + Outpaint Klein cloud,
  Object Stamp none. No `comfy_workflows/` file changed (the cloud stage is built at run time).
  Was: cloud edit models inside image Flows (Klein 9B on DeepInfra + Nano Banana slot
  candidates) — last open member of **MPI-985** (910/923/1006/856 done), so 985 closes with it.
  **Fabio 2026-10-01: TWO-PASS, no new MpiNodes node, so NO pin move** (plan.md); Head Swap out.
  Phase 1 DONE 2026-10-01 (`klein-9b-cloud` ModelDef + price + guide; also fixed `formatPrice`
  quoting $0.015 as "$0.01"; live edit on Fabio's yes billed $0.015 = the quote).
  Phases 2-4 next (the seam edits the four Flow graphs, so the smoke still runs after it). Paid
  live runs on Fabio's yes. THE LONG POLE
- [x] **MPI-668 live leg handed to Agent 86** (2026-10-01, via Agent 85's handoff); CI green on
  `922ce37a1` / `ecd112ad1` (inside green `747341588`) and `ec18c1086`
- [x] **MPI-918** CLOSED again 2026-10-02 (`197cd10a3`, CI green run 37001533612; live Seedream 4
  at the new size 2368x1792, framing kept; Seedream spend $0.219).
  Was: **REOPENED 2026-10-02** (Fabio's test): every cloud edit sent no size, so FLUX 2
  dev/pro/max and Klein 9B came back a 1024 square that centre-cut the source. Fixed `476c6fb67`
  (route sends image 1's shape), CI green. Outpaint's cloud slot REMOVED (Fabio, `bf9588d59`).
  Klein edit: Fabio ran it, fine. Seedream check ($0.179): 4 + 4.5 came back a 2048 square
  from a 4:3 source (5 Pro kept it) — fixed in `buildSizeFields` 'size', tests green
- [x] **MPI-1011** Outpaint — CLOSED 2026-10-02 (CI green on `bf9588d59`, run 36995557115).
  Was a 2.0 GATE (Fabio 2026-10-02). REBUILT `bf9588d59`: Klein's picture
  is the result (paste-back + harmonizer removed, Fabio's option 2: ~1 MP, no seam), passes at
  a third per side now actually chain (pass 2 never started before), no cloud model. Fabio's
  look PASSED ("Fantastabomb."). Its graph
  change keeps `outpaint` in the cut's scoped re-smoke (B1)
- [x] **MPI-894** 2.0 SCOPE DONE 2026-10-02, card parked `todo`/`deferred` (541/183/349 after
  2.0). Saved RAM floors stay as set (Fabio 2026-10-02). Was: remote GPU umbrella — v2 + 1b + 1c done. **Fabio 2026-10-01: MPI-668 IN**,
  MPI-541 / MPI-183 / MPI-349 OUT of 2.0 (reasons in MPI-894 plan.md). `publish-runtime.sh
  promote` stays a cut step
  - [x] **MPI-668** CLOSED 2026-10-01 by Agent 86 (`d6bfdf2f4`): live leg passed on the Linux box
    (1.5.0 Pod on v0.23.0-cpu -> in-place update to master -> Connect logged "recreating it",
    delete 204, new Pod on the same volume ready in 28 s; v2 GET `/pods/{id}` carries `image`,
    no `imageName`; < $0.01)
- [x] **NEW BREAKER 2026-10-01: release-line fixes missing from master.** Resolved: ported +
  CI green; the release image pin is the Gate D step `release:check` enforces. 1.4.3/1.4.4/1.5.0 were
  cut from branch `1.5.0`; 34 of its commits are not on master as-is. Confirmed one: `18a9b9215`
  set released Pods to image `v0.23.0` (core 0.34.0); master still pins `v0.21.0`
  (`routes/remotePodLifecycle.js:157,191`), so 2.0 as-is would send users to an OLDER image than
  1.5.0. **Audited 2026-10-01** (all 34): 2 user-facing missing, 4 internal, rest PRESENT /
  SUPERSEDED / N/A. **Ported in `ecd112ad1`:** `43b22c407` applier (UNKNOWN busy code + skip
  sha-identical files — else a 2.x Windows install dies on its next FULL bundle after evicting
  the exe; test RED on master's applier) + its update-evidence gate + install-test playbook;
  smoke runner `4ba6241c8` (delete Pod before the volume prompt) + `3d1126f94` (CPU refusal
  waits); `5b6074186`'s guard test. NOT ported: `a9c4906d0` (master keeps python_deps
  byte-identical to the Pod repo). `18a9b9215` stays the cut's release-image step, now
  ENFORCED: `release:check` fails while `POD_IMAGE_VERSION(_CPU)` is older than the last public
  tag's (red today: v0.21.0 < v0.23.0) — the cut builds a clean stable image at the lock
  (`v0.24.0`+, baking ChatterBox/MelodramaBox/Mickmumpitz, no SplatKit) and pins it here
- [x] **NEW BREAKER 2026-10-01 (Agent 85, live on the Linux box)** — CI green on `ec18c1086`, live
  RUNNING-attach leg PASSED (B3 line below). Was: reconnect deleted a Pod left
  RUNNING by a crash (v2 answers `start` on RUNNING with a non-400 error). Fixed in this
  umbrella (MPI-894 lane): a RUNNING Pod attaches without `startPod` and skips the availability
  gate; tests RED-proven. Pushed `ec18c1086`; CI on it to confirm before close
- [x] **NEW BREAKER 2026-10-02 (Fabio): a video dragged onto a cloud video model made no chip**
  (Seedance 2.0, Wan 3.0). `isTextOnlyOp` judged by REQUIRED inputs, so `ref2v` (all slots
  optional) read as text-only: the box moved a staged video to `i2v` and pruned it. Fixed at
  the rule (slot-based) + its inline copies in `MpiPromptBox.js` (`_pickFallbackOp`, op
  strip, `_pickOpForModel`; a video on `i2v` now moves to `ref2v` too). History's MPI-281
  "requires input" filters kept as they were. RED-proven: `tests/text-only-op.test.cjs` +
  `tests/desktop/prompt-box-video-ref.spec.js` (failed on HEAD, passes); `npm test` 2673/0; `22fef2823` CI green (run 37005121706)
- [ ] **MPI-801** eyedropper Pick in the Flows' paint step (Scribble, Draw It In) — a 2.0 ask
  Fabio remembered 2026-10-02 (folded into MPI-801 on 10-01, never listed here). Built +
  spec-proven, `validating`: Fabio's look in his pre-cut smoke, then CI + done. Hold-Alt pick
  stays on the card, not 2.0
- [ ] **Fabio's own smoke in the app BEFORE the re-smoke (Fabio 2026-10-02):** item 1 (lock:
  MelodramaBox sync + Mickmumpitz drop + release image build + pin) runs in a fresh session;
  item 2 (paid scoped re-smoke) and everything after wait for his green light
- [ ] **The cut** (Gate D below) once both lists are empty; MPI-983 sites publish is a cut step

Agent 85:
- [x] **MPI-513** CLOSED by Agent 85 (`a1552ef08`, members folded). Was: install state that lies to the user (umbrella: 497/397/320) — Fabio 2026-10-01:
  "we might pick that up". Fixes done + tested, commit next; left: Pod remote-resume test (Fabio's
  pick), close 497, MPI-397 product call, MPI-320 follow-ups in/out
- [x] **MPI-866, MPI-593, MPI-708** CLOSED by Agent 85 (`ee6e94d97`, pushed 2026-10-01). Left
  here: 593's Claude Desktop directory submission (release-day line) + `llms.txt` (under MPI-983);
  708's `~/Documents/Cubric Vision` rename check on the real bundle (B3 line)
- [ ] **MPI-603** (`validating`) — stale handoff `779c959c` resolved; card stays OPEN until 2.0
  ships: v1.5.0 Klein 4B still lists `klein-lora-outpaint`, so the R2/HF delete (bottom "After"
  line) breaks 1.5.0 installs if done before the release
- [x] **MPI-1007** + MPI-894 overlay: GPU picker bullet added to `UNRELEASED.md` by Agent 85
  (2026-10-01). UNRELEASED.md is back with THIS umbrella

Not 2.0 (checked 2026-10-01): MPI-841 (2.1 blocker, Fabio 2026-09-30); MPI-560's description
calls MPI-531 a "RELEASE BLOCKER" but 531 is archived — stale line, not a gate
- [x] **MPI-1010** `done`, stamp `8e93f72ae` on origin/master, no claim left on the version files
  (checked 2026-10-02). Was: 1.6.3 hand-delivered build — its own session. Its stamp `8e93f72ae` (unpushed
  2026-10-01) makes the Gate D fold 1.6.0-**1.6.3**, and it CLAIMS `appVersion.js` /
  `package.json` / `package-lock.json` / `releaseNotes.js`: the 2.0 bump cannot start until it
  releases them

## ON PICKUP (measure, never read counts from prose)

- [ ] `git rev-list --count v1.4.2..HEAD`, `git status --short`, `git log --oneline @{u}..HEAD`
- [ ] `npm run release:check` (RED on 2026-09-27: stale smoke evidence + missing 1.6.x archival notes — both expected, see B1 and D)
- [ ] `gh release list | head -3` — latest public is v1.5.0; nothing cut since
- [ ] Who is in `doing`, and which files are claimed

## Gate A — must fix

- [x] **A1 MPI-806** RunPod REST v2 — app client + tests + watchdog source: Vision `97f729c5e`, mpi-ci `e62a9aa`
  - [x] Pod runtime watchdog `_self_stop` on v2 with a status check; dev-proven on a CPU Pod, promoted 2026-09-27 on Fabio's yes
  - [x] Live app leg on v2: create / stop / start / delete a Pod, list + grow a volume (Fabio's go) — DONE 2026-09-29 on the Linux box (B3), through the app's own `/runpod/*` routes: volume `jqsme9kzz5` create 200 -> PATCH grow 10->11 200 -> CPU Pod `mwz9urn3vk2mph` (cpu3c x2, $0.06/hr, EU-RO-1, volume mounted) create 200 RUNNING -> stop 200 EXITED -> start 200 RUNNING -> delete 200, GET 404 -> volume delete 200. v2 reports `status`, not `desiredStatus`; the app reads both (`remotePodLifecycle.js:633`). Transcript `~/b3/runpod2.out` on the box
    - [x] 2026-09-27 GPU leg (create via GraphQL RAM floor, v2 reads/start/delete) + CPU create; volume grow not run
    - [x] REST v2 GPU create live — 2026-09-29 23:35Z (MPI-894 live test): app.log `RAM floor 62GB requested (v2 gpu.minRamPerGpu)` -> `createPod REST -> http 201` Pod `kpmt17d2gqe7mt` RTX 5090; also volume create + DELETE (404 after) through the app. Still not run: stop/start and volume GROW
  - [x] **GraphQL retires early 2027** — Fabio 2026-09-27: create moves in 2.0 (done, above); picker catalogue is a **2.1 blocker** (MPI-894 phase 1b), not a 2.0 gate
  - [x] Runtime `promote` — Fabio's yes 2026-09-27; stable `wrapper_sha256` = `27fcd294…` = dev, served hash verified
  - [ ] 2.0 ships by ~2026-11-01
- [x] **A2 MPI-516** vanished-prompt detector, with the re-read guard: `c3a0f839d`, CI green
- [x] **A3 MPI-736** colour — Fabio 2026-09-27: all good, closed
- [x] **A4 MPI-780** chain, done 2026-09-27
  - [x] packages exist (MPI-781) · [x] app advertises them (MPI-831)
  - [x] Gumroad products LIVE at £4, 100-use codes applied automatically (MadPony-Identity MPI-81)
  - [x] ~~**MPI-872** redirects~~ rejected: Get it opens the plain Gumroad pages (`fe68f620d`). Build check is B7
- [x] **A5 MPI-954** 1.x -> 2.0 launcher hop — `37e5eca77`; PROVEN on the Linux box 2026-09-27 (control exit 127, fixed exit 0 on both paths, boot heal in 2 s). macOS not run (no Mac)
- [x] **A6 MPI-591** H3 in Extend Video — closed 2026-09-27 (`8975ff6d6`); B1 is unblocked on A6
- [x] **A7 MPI-952** SplatKit out of 2.0 (`b3c25a678`); Mickmumpitz stays for Outpaint
- [x] Cleared: MPI-507/515 (rejected, MPI-734), MPI-575, MPI-522/523/527, MPI-873, MPI-708's gates 532/774/809/810/777
- [ ] Every A item that did not clear has its known-issue bullet

## Gate B — must verify

- [ ] **B1 smoke** (after A6 + A7):
  - [x] **GATE FIXED 2026-10-01 (Fabio: "go ahead, B1"):** `assessPinMove` now lets a third-party
    pin move through only when `dev_configs/engine-attestation.json` `packs.<name>` signs off that
    exact from/to hop (expires when either end moves; any unattested pack is still the blunt
    refusal). MelodramaBox `9ebb44be` -> `529c4be` attested (17 `DramaBox*` classes, none under
    `comfy_workflows/`). `npm run release:check`: smoke line clear ("attested packs:
    ComfyUI-MelodramaBox"); only the 1.6.x archival notes (Gate D) remain. `tests/engine-drift.test.cjs`
    6/6, the 2 new ones proven RED on the old gate. STILL OWED, AT THE CUT (not a question
    before then; Fabio 2026-10-01): sync `node_lock.json` into `mpi-ci/cubric-vision-pod`, then
    the clean release image build at that lock (the "release Pod image PROMOTED" line below)
  - [x] ~~**REOPENED 2026-10-01 by MPI-1008**~~ (`bff32c628`): `node_lock.json` repinned ComfyUI-MelodramaBox `9ebb44be` -> `529c4be` (DramaBox device-mismatch fix). A third-party pin move is the blunt verdict in `scripts/engine-drift.mjs` `assessPinMove`, so the 09-28 evidence reads STALE (proven) and a scoped run cannot merge into it. Owed before the cut: sync `node_lock.json` into `mpi-ci/cubric-vision-pod` (still `9ebb44be`; the Pod image BAKES MelodramaBox, so until a rebuild a 2.0 app on a Pod toasts "Pod image is stale - rebuild needed") - folds into the release image build below, no extra build. **A re-smoke is NOT needed for this move (Fabio asked 2026-10-01):** no `comfy_workflows/*.json` loads a DramaBox class (DramaBox is a package Flow since MPI-781), so the pin cannot reach a smoked graph; the gate is blunt only because it cannot diff third-party packs. Fix the GATE instead (attest a third-party pack no shipped graph loads, or narrow by class_type), so `release:check` stops reading the 09-28 evidence as stale. Image publish: Fabio's go
  - [x] sync `node_lock.json` AND `python_deps.txt` into `c:\AI\Mpi\mpi-ci\cubric-vision-pod\`, re-measure the drift, commit there — 2026-09-28 mpi-ci `5ba9eb8` (MpiNodes cff4c3b -> bc92a1b, SplatKit out, core v0.34.0 unchanged); byte-identical to Vision. pushed 2026-09-29 with mpi-ci `57a31c0` (MPI-894)
  - [x] `node scripts/smoke-workflows.mjs --plan --flows all` 2026-09-28, shown to Fabio: 13 models / 38 ops / 290.5 GB + 14 Flows (+64.1 GB) = **400 GB volume**; lock in sync; MpiNodes + required-inputs sweeps clean; 1 SKIP `flux-schnell-cloud/t2i` (cloud, no workflow). **Re-run right before the real smoke** (sync LAST rule)
  - [x] DEV Pod image rebuilt at the lock (`/build-pod-image`), app restarted, Pod reports the pinned core — `v0.24.0-dev` (cu130 Docker Hub + cpu GHCR), CI run 36408333772, both pull-verified; `POD_IMAGE_VERSION_DEV`/`_CPU_DEV` in `6311ce8b9`; Fabio restarted the app (boot 11:16:51Z). Local cpu boot smoke not run (Docker daemon down). Pod-reports-core is asserted by the runner's gate 7 in the live run
  - [x] matrix run incl. a VIDEO op; `smoke-evidence.json` fresh; `release:check` green on that line — **2026-09-28 GREEN: PASS 51 · SKIP 1 · FAIL 0 across 52 ops** (37 model ops incl. every video op + 14 Flows; SKIP = `flux-schnell-cloud/t2i`, cloud, no workflow). Engine 0.34.0 proven. RTX 5090 (55.88 GiB host, placed at `--min-ram 60`) 19:35-19:56Z; H3 Extend retried on A100 PCIe 20:04-20:24Z after the probe clip went 1 frame -> 48 (MpiH3MaskedPrefix needs >=39). `release:check`: smoke line clear; only the 1.6.x archival notes (gate D) remain. Spend ~$0.95 (5090 $0.35, A100 $0.53, CPU Pods cents)
    - 2026-09-28 run 1 (`--flows all`) installed all 13 models + Flow models, then ABORTED before the GPU leg: `flow dep install failed: flow:voice-changer, flow:chatter-box` — every chatterbox dep `invalid model type` (a `targetPath` weight reaches the wrapper with an empty type; `_SUBDIR_RE` rejects it). NOT a regression: MPI-607 (2026-08-24, Fabio-approved) made both Flows honest-missing on remote; neither the image nor the volume path can supply them. Run 2 = same matrix, `--flows` minus those two (12 Flow entries) — ALSO aborted, on run 1's leftover failed jobs (runner bug). **Fabio 2026-09-28: B — 2.0 cannot ship a Flow that works locally and not remotely.**
    - [x] B fix: Vision `43eab1c33` (`wrapperDepPath` maps `targetPath: models/<type>/<sub>` to a real wrapper type at status/install/uninstall; `_withRegistryDef` resolves `targetPath` + `bakedOnPod` by id for stripped callers; runner counts only its own jobs; `tests/remote-target-path-deps.test.cjs`; npm test 2190/0 fail). mpi-ci start.sh links `/opt/ComfyUI/models/chatterbox` -> volume `mpi_models/chatterbox`, published to R2 **dev** (served bytes verified = committed). mpi-ci `b131c0a` pushed 2026-09-29 with `57a31c0`. `promote` to stable at release
    - [x] run 3: `--flows all` after an app restart (routes changed); chatter-box + voice-changer PASS on the Pod is the live proof of the symlink (not testable on Windows) — chatter-box 21s + voice-changer 8s PASS on the 5090 Pod 2026-09-28
  - [ ] **Drop `ComfyUI-Mickmumpitz-Nodes` from `node_lock.json` at the cut (Fabio 2026-10-02):**
    no shipped graph loads it since MPI-1011's Outpaint rebuild. Same lock edit as the
    MelodramaBox sync, so it rides into the one release image build below
  - [ ] release Pod image PROMOTED (clean rebuild, never a renamed `-dev` tag)
  - [ ] **Scoped re-smoke at the cut (found 2026-10-02):** two shipped Flow graphs changed AFTER
    the 09-28 run — `flow_h3_extend.json` (MPI-974, `d8f23a421`; Flow `ltx-extend/minimax-h3`) and
    `flow_character_sheet.json` (MPI-997 split, `09f49a278` + `6f342280c`; Flow `character-sheet`).
    `release:check` still reads the smoke line clear (it dedupes by MODEL class_type, not by Flow
    graph), so nothing gates this. Plan, free: `--plan --models minimax-h3 --flows
    ltx-extend,character-sheet` = 3 Flow legs + ~63 GB of Flow models, all resolve. The runner
    REFUSES to rent today: "POD LOCK IS BEHIND — ComfyUI-MelodramaBox" — so it rides AFTER the lock
    sync + image build above. Never smoked: `flow_character_sheet_headless.json` (MPI-997's chained
    SAM3 leg 2; the runner smokes only FLOWS entries, and leg 2 is an op, not a Flow)
  - [x] RAM floor 80 -> 62: app default `b5b20a042`; smoke runner `MIN_RAM_GB` 62 + playbook 01 (2026-09-29, Fabio: yes; evidence = B1's H3 PASS on a 55.88 GiB 5090 host, `dev_configs/smoke-run.txt:166-167`). Runner `--self-check` OK. Saved 80 GB user floors NOT migrated (Fabio did not ask; default pick: leave them)
  - [x] Runner fix, same session: `--plan` / `--self-check` no longer truncate the committed `dev_configs/smoke-run.txt` (both did; this session's `--install-only` + `--self-check` wiped the B1 transcript, restored from HEAD, blob `d6f247a` re-verified after a plan + self-check). `tests/smoke-*.test.cjs` 54/54
- [x] **B2 MPI-953** Flow leg in the smoke runner — `49564ad53`: real FLOWS, stages each Flow's models + deps, volume counts only what Flows add; runs for real inside B1 with `--flows all`
- [ ] **B3** Linux box, REMOTE-ONLY (no ComfyUI there): agent, DeepInfra, RunPod v2 (MPI-806 live leg), updater A/B through `update.sh` on a real 2.0 bundle
  - 2026-09-29 started (Fabio: yes, paid legs capped at **$0.25**). Box is now `192.168.0.210` (router restart; same host key on .199/.210; `~/.ssh/config` updated). Build: master `f74855990` -> mpi-ci run `36504709115`. Plan: fresh v1.5.0 extract in `~/b3/` -> in-app `update.sh` with `~/mpi954/fetch-release-stub.cjs` pointed at the CI Linux update zip -> that updated install runs the legs. **Fabio pastes the DeepInfra + RunPod keys into Settings on the box himself** (agents never type real keys). Legs: FLUX Schnell 1 image (~$0.0005), 1 agent turn, RunPod create/stop/start/delete + volume create/grow/delete (~$0.10-0.20). The real-2.0-bundle updater run stays a cut step
    - [x] Update rehearsal PASSED 2026-09-29 00:56Z (dash): CI artifact `CubricStudio-linux-x64-update-v1.6.2.zip` (sha256 `ca056d6b…`, full bundle, `fromVersion: null`, launchers under `update/pending-launchers/`) through the INSTALLED 1.5.0 `update.sh` (only `fetch-release.cjs` stubbed; kit `~/b3/b3-inapp.sh`): exit 0, 1.5.0 -> 1.6.2, relaunch served :3000 200, boot heal installed all 4 launchers (app.log 00:57:34Z), update check "up to date". 1.5.0 was booted once first so real `user-data/` rode the update
    - [x] DeepInfra leg PASSED 2026-09-29 01:09Z: `flux2-dev-cloud` t2i via connector generate into project "B3 Linux test", 11.5 s, card landed, image checked by eye, **$0.018** (app-reported `costUsd`). (`flux-schnell-cloud` is `devOnly`: UNKNOWN_MODEL in a packaged build, correct)
    - [x] Agent leg PASSED 01:12Z: `/agent/message` on profile `deepinfra`, answered correctly (named the installed cloud models, offered to install local ones)
    - [x] **BREAKER FOUND + FIXED (uncommitted):** saving the DeepInfra key in Remote -> Language Models never re-read the cloud-key mirror (`modelRegistry.js refreshCloudKey` ran only on the model disk-check edge, which a no-engine/no-Pod machine never reaches), so every cloud model stayed `installed:false` until restart. Proven live: key saved -> `/connector/models` all 14 cloud `false`; restart, nothing else changed -> all `true`. Fix: `secretsClient.js` emits `secrets:endpoint-changed` after any ok endpoint key/profile change; `modelRegistry.js` re-reads on it. `tests/cloud-key-refresh.test.cjs` 2/2, proven RED without the listener ("models:checked never fired"); eslint clean; `npm test` 2226 pass / 0 fail / 2 skip. NOT live-verified on the box (would mean clearing Fabio's real key there). **Committed + pushed `621f90c48`** (Fabio: commit now). Event doc: Fabio said add the line; its home is `MpiEventMap` in `js/events.js:183` (runtime source of truth, `.claude/rules/events.md` points there), which live peer `8d7c61a8` (MPI-941) claims -> asked it by message `ec93cbba`. Open until that lands
    - [x] Keyring notice ("no OS secure key store") is a LAUNCH artifact, not a bug: A/B probe with the box's Electron — over SSH `available=false backend=basic_text`; with the desktop's `XDG_CURRENT_DESKTOP=ubuntu:GNOME` `available=true backend=gnome_libsecret`. Recorded on MPI-856 too
    - [x] RunPod leg PASSED 01:3xZ (see A1 above). An earlier run polled v1's `desiredStatus`, was interrupted, and its `finally` deleted Pod + volume (404 / 200)
    - Spend: DeepInfra $0.018 image + one agent turn (<$0.01); RunPod two CPU Pods ~3.5 min total at $0.06/hr (~$0.004) + two 10-11 GB volumes for minutes. **Total ~$0.03 of the $0.25 cap**
    - The box keeps the updated test install at `~/b3/` with Fabio's two keys in its `user-data/` (app-level encrypted); reuse it for the cut-time run
    - [x] Reconnect recreate leg (MPI-668): DONE 2026-10-01 by Agent 86 on a master build (above)
    - [x] **RUNNING-attach leg (`ec18c1086`) - PASS 2026-10-01, Agent 86, Linux box** (Fabio's
      yes): `~/m668` master build (mpi-ci 36920031079 at `a1552ef08`) made CPU Pod
      `0uqv9pv5uuh6km` (v0.21.0-cpu, EU-RO-1, 10 GB volume), RUNNING; app SIGKILLed with it
      RUNNING, relaunched; `POST /remote/pod/reconnect` -> `{"recreated":false,"podId":
      "0uqv9pv5uuh6km"}`, ready at once; app.log only `Pod reconnect requested` -> `Pod resume
      kicked off`, no `resume failed`, no `Pod delete`; v2 `startedAt` identical before and after
      (no `start` sent). Torn down, < $0.01. Side proof: a stray second connect made a 2nd Pod and
      the create path's `orphan sweep deleted 1 stray Pod(s)` cleaned it
    - [ ] At the cut, on the REAL 2.0 bundle: also check `~/Documents/Cubric Vision` -> `Cubric Studio` rename. It did NOT happen on the rehearsal and must not: it runs only at app major >= 2 (`routes/shared.js:132`), and the rehearsal build is 1.6.2
- [x] **B4** `npm test` and `npm run test:desktop` green — 2026-09-29: CI run 36497353233 on `804107f52` (last code commit; later ones are board-only) unit + desktop shards 1-4 all success; local `npm test` at HEAD 2215 pass / 0 fail / 2 skip. **Re-check at the cut** (code keeps landing)
- [x] **B5** MPI-656 Phase 1 — CLEARED by reading 2026-09-27: every YAML writer (`comfy.js:855/864/934`, `engine.js:671/678`) goes through `writeExtraModelPathsYaml` -> `setRoots`, so `model_roots.json` cannot drift from the YAML; the yaml-only seed and the both-equal rule are tested (`tests/model-roots.test.cjs:213,252`)
- [x] **B6** MPI-710 — CLEARED by reading 2026-09-27: nothing load-bearing reads the installed top-level manifest (the applier keys its guard off package.json on purpose, `apply-update.cjs:88-100`; main, routes and updateChecker never read it). Stays a research card, not a gate
- [ ] **B7** on the 2.0 build, Get it on Head Swap and DramaBox opens Gumroad at £0

## Gate C — decide / notes

- [x] Claim audit of `UNRELEASED.md` against **v1.5.0** (copy-review Gate 0) — done 2026-09-28 11:00 in `c6937e50f` (pushed; this line was never ticked). Bullets added after it: `89d7b92ba` (stacks, MPI-949) and `e774a5895` (Fits my GPU, MPI-967) — both post-1.5.0 features, so new by definition; re-run Gate 0 only on bullets added after `e774a5895`
- [x] Coverage sweep 2026-09-27 (`ec7b81cb3`): agent panel, Connect an agent, GIF workspace, 16K + SVG. Dictation, MCP, mascots, local-only server were already there
- [x] **MPI-949 close-out**: the two Cue all bullets become stacks — done (`c6937e50f` + `89d7b92ba`; `grep -i "cue all" UNRELEASED.md` empty 2026-09-29, Stack bullet at :159)
- [x] Agent image tools (MPI-941) get their line at 941 close-out — 2026-10-01: the agent bullet
  now names upscale / crop / remove background over many cards and looking at videos and GIFs
  (checked at HEAD: `js/shell/agentToolOps.js` ops, `agentLoop.mjs` clip contact sheet). Says
  "in one go", never "no model": those tools still run on the engine (MPI-941 validation.md:195)
- [x] Rename section (`ec7b81cb3`), plus Vision -> Cubric Studio in four user-facing bullets
- [x] Known-issue lines: macOS · unsigned exe / SAC (MPI-616) · A5 if unmitigated · 1.5.0 installs lose the remote engine on 2026-11-15
  - [x] DRAFTED 2026-09-29 in `UNRELEASED.md` § "Known issues (GitHub release page ONLY)": RunPod cutoff (Updating?), SAC (First launch, Windows), xcode-select (First launch, macOS), macOS untested (Platform support). A5 needs no line (MPI-954 fixed). They are release-BODY lines, not in-app: 1.5.0's update prompt shows no notes (`git show v1.5.0:js/services/updateChecker.js`, OK/Cancel only)
  - [x] Fabio reviewed the four lines 2026-09-29: "lines are good". Copy them into the release body at Gate 2 as written
- [x] MPI-543 / MPI-544 / MPI-569 — OUT of 2.0 (Fabio 2026-09-29). 544 was seen once, in the 2026-08-11 download-Pod incident (bot-driven installs), never reproduced; Fabio reads it as smoke-run-only. Cards stay on the board as they are
- [ ] Flow-list reconcile — LAST, once, at notes freeze (13 ids on 2026-09-27; still 13 and
  matching the 13 lines on 2026-10-02)
- [ ] **Changelog clean-up (2026-10-02, session c6543d87), Fabio's look pending:** em dashes out
  of every user-facing bullet; 1.6.x tester notes cross-checked against v1.5.0, gaps added
  (lost-prompt hang MPI-516, camera-rotated photos MPI-959, eyedropper MPI-960/964, big-photo
  History/landing MPI-963, masked area only MPI-971); `## Engine` added (core v0.34.0
  unchanged, 4 packs added). Upscaler line kept (matches MPI-791; the 1.6.2 note was looser).
  Then the Docs site compares its pages against these notes (Fabio)

## Agent connection (MPI-593)

- [x] App `README.md` "Use it from your AI agent" section (`ec7b81cb3`, says it needs 2.0)
- [x] `UNRELEASED.md` bullet — now points at Settings > Connect an agent
- [x] `.mcpb` home: agents-repo release ONLY (Fabio 2026-09-29). Every link already read it (`routes/agentConnect.js` `MCPB_URL`, agents README, MCP Registry `server.json`); the app-release copy is gone from `mpi-release` SKILL step 6 and `github-release-checklist.md`. The website gets a download button for it (MPI-973)
- [ ] Claude Desktop directory submission AFTER 2.0 is live
- [x] MPI-873 done

## Gate D — hygiene at the cut

- [x] `validating` resolved: ~~MPI-845~~, ~~MPI-827~~, ~~MPI-866~~, ~~MPI-720~~
  - MPI-866 taken OFF the 2.0 gate (Fabio 2026-09-29): CI tooling, not user-facing; it stays `validating` until master next goes red on its own
  - [x] MPI-827 DONE 2026-09-29: Fabio "We can see the latents in the gallery" (agent-run Flow)
  - [x] MPI-845 DONE 2026-09-29: Fabio "845 looks good" (titlebar mark, chip hover, reference-chip X)
  - [x] MPI-720 DONE 2026-09-29: Fabio confirmed the reporter downloads at normal speed on the fixed build (evidence in its `validation.md`)
- [x] MPI-623 / 711 / 591 / 656 out of `doing`, or scoped into 2.0 explicitly — 2026-09-29 Fabio: 623/711/656 post-2.0 -> `todo`/`deferred`; 591 was already done (A6)
- [ ] 1.6.0 / 1.6.1 / 1.6.2 / **1.6.3** (MPI-1010, 2026-10-01) `RELEASE_NOTES` entries + `.approved-1.6.*.json` deleted at the fold — `release:check` 2026-10-01 names all four, nothing else
- [x] ~~MPI-708 Phase 3: dual-publish `CubricVision-*` at the cut~~ DROPPED: Fabio 2026-09-29 (MPI-972, `f74855990`) no legacy set at 2.0; 2.0 updates in place from 1.5.0. The `mpi-release` SKILL still said "also attaches legacy copies" — fixed this session
- [ ] `python scripts/overtaken-cards.py`; unpushed pushed; commit by pathspec — overtaken run
  2026-10-01: 3 candidates, none overtaken (MPI-775 board-save commit, MPI-560 live Flow
  umbrella, MPI-249 a question answered). Re-run at the cut
- [ ] `publish-runtime.sh promote` (mpi-ci `cubric-vision-pod/`): dev -> stable = wrapper 0.2.45 (MPI-894 async hot-store, live-proven 2026-09-29) + `b131c0a` chatterbox link. Fabio 2026-09-29: at the cut, not before. Harmless to 1.5.0/1.6.x (they never send `async`), useless to them until 2.0's app
- [ ] `/mpi-version-bump` -> **2.0.0**, then `/mpi-release`
- [ ] Release day: Claude Desktop directory submission (Gumroad already live, A4)
- [ ] Release day: **MPI-983** publish docs.cubric.studio, then cubric.studio (both built and held)
  - [ ] **`llms.txt` for docs.cubric.studio** rides with it (from MPI-593, handed over by Agent 85
    2026-10-01). Docs repo = Fabio's no-push repo with its own live session: ask THAT session (or
    Fabio) to add it, never write there. The pages exist on `docs-2.0`: `agent/`, `settings/`
- [x] Before the notes are written: `github-release-checklist.md` § Scope Guard may still forbid "assistant" claims — CHECKED 2026-10-01: fixed by `0f6d75f09` (the section now says the agent and MCP are fair to name)
- [ ] Ask Fabio again, near the release: a Discord/Patreon post warning 1.5.0 users about the 2026-11-15 RunPod cutoff (Fabio 2026-09-29: "no to the post right now, maybe closer to the release")
- [ ] After: MPI-603 R2/HF delete; MPI-612
