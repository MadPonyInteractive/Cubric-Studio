# MPI-1286 validation: Storyboard run by Cosmo and by an outside agent

2026-10-27, my own Electron instance (own port 54793, profile, APP_DOCUMENTS; engine 48188 shared,
under the GPU lease, Fabio's yes in the turn). DeepInfra key seeded in that profile, deleted after.
Rig: `scratchpad/sb1286/run.cjs` (not committed).

## Run 1: Cosmo asked in words: PASS

"Make me a storyboard of a lighthouse keeper who finds a message in a bottle and rows out to a tiny
island. Three panels, 16:9, 1K, Turbo on."

- Cosmo (DeepInfra default model): `list_models` -> `list_cards` -> `read_knowledge app:flows` ->
  `describe_model storyboard` -> `generate {flowId:'storyboard', fields:{positive, panelCount:3, ratio, qualityTier, turbo}}`,
  everything in fields, no plan sent. Said it had started, then saved the brief to project memory.
- App planned on Cosmo's model (`flow-enhance` Storyboard on MiMo-V2.6-Flash, 46 s), drew 3 cast
  pictures (Cast stack), then 3 panels as Klein edits in ONE stack in story order, then the numbered
  sheet. The same keeper in all three panels; each panel's card note is its Intent line.
- Chat spend $0.0038 for the turn.

First attempt ended "no pictures" on the message: Cosmo read it as "don't draw" and only wrote a
memory note ($0.0033). My wording, not a defect: a user means "no pictures attached" rarely enough,
and Cosmo did see Storyboard in `list_models`.

## Run 2: MCP shape, `/connector/generate` with no plan: PASS

`POST /connector/generate {flowId:'storyboard', folderPath, cardName, fields:{positive:'A waitress in a late-night diner meets a stranger who knows her name.', panelCount:3, ratio:'16:9', qualityTier:'1k', turbo:true}}`

- One held answer after 197 s: `ok:true`, `stackId`, `cards` = panels 1-3 `{panel, groupId, itemId, filePath}`
  (edit_004..006), `sheet:true`, `plan` (CAST Mara / Stranger, PLACES Ruby's Diner, 3 PANELs).
- Status bar: "drawing Mara, Stranger, Ruby's Diner first ...", "6 generations finished",
  "... is ready: 3 panels in the stack, and a numbered sheet."

Rig traps hit on the way (not app defects):
- A `folderPath` the connector does not list answers `PROJECT_NOT_FOUND`: create the project by name
  under APP_DOCUMENTS and take the listed path.
- Node `fetch` drops a held `/connector/generate` at 300 s (`UND_ERR_HEADERS_TIMEOUT`); my harness
  then closed the app mid-run. Use `node:http`. The next boot reported that interrupted run's
  undrawn panels as "3 of 3 did not finish" (a visible end, as it should be).

## Noticed

- A 3-panel sheet is a 2x2 grid with one black cell (cosmetic).

Spend: about $0.01 DeepInfra (Cosmo turns $0.0071 measured, three planner calls on MiMo-V2.6-Flash).
GPU: ~13 Klein Turbo 1K images on the local 4060 Ti, ~10 min across three launches.

## 2026-10-27 - 1.5.0 -> 2.1.3 update gate (release 4 session)

- Gate test on D:\CVTest\v1.5.0-to-v2.1.3 (FULL bundle, buildInfo 55f8b45f4166 = tag v2.1.3): first engine start after the update came from the app itself, one start, 0 degraded, 0 IMPORT FAILED, :48188 = this install's own python, ComfyUI 0.42.1.
- Klein 4B t2i t2i_003.png opened: red bicycle with wicker baskets on a white brick wall, matches the prompt. (t2i_002 is an empty-prompt run: the test sent `prompt` instead of `positive`.)
- dev_configs/update-evidence.json rewritten for 2.1.3; `npm run release:check:publish` passed.
- Test install re-pointed the Start Menu "Cubric Studio.lnk" at D:\CVTest\v1.5.0-to-v2.1.3 (MPI-1209 trap) - fix after Fabio's own test.

## DeepSeek default

- 2026-10-27, Fabio: Cosmo's DeepInfra default is `deepseek-ai/DeepSeek-V4-Flash-0731` again (MiMo-V2.6-Flash took ~2 min for one video prompt, overloaded for testers); same 52/55 on the 55-case suite. `RECOMMENDED_REMOTE_MODELS.deepinfra`: `agent` moved to 0731, listed first. Users with no saved agent pick follow it; a saved MiMo pick stays.
- The agent dropdown row now reads `(recommended) deepseek-ai/DeepSeek-V4-Flash-0731` (same prefix as the enhance/describe rows). Checked on an isolated app (own port and profile) with the live DeepInfra catalogue: trigger and first option carry the flag, MiMo second.
- Vision: DeepInfra tags 0731 `chat, prompt_cache, reasoning`, no `vision` (MiMo, V4.1-Flash and V4.1-Flash-1017 do). On 0731 `_visionFor` is false, so `look` has no `see: true` and Cosmo only reads the describer's words (gemma-4-26B); it cannot compare two faces or judge grain itself. 2.1.2's "Cosmo can see pictures" no longer holds on the default. No workaround built.
- Fallback after a stall: 0731 -> MiMo, MiMo -> 0731, untested -> 0731.

## 2026-10-27 - re-cut 2: tag v2.1.3 -> b85d242fa (release 6 session)

- Tag moved on Fabio's go; mpi-ci run 40602289786 green on all three OSes; six files in D:\CubricStudio\Vision\Builds\v2.1.3\ (re-cut 1 set kept as v2.1.3.recut1); CI artifacts deleted.
- 1.5.0 -> 2.1.3 gate redone on a fresh 1.5.0 extract (D:\CVTest\v1.5.0-to-v2.1.3): bundle b85d242fa1d2, FIRST launch, one engine start, 0 degraded, Klein 4B t2i_004 opened (red bicycle, matches). update-evidence.json rewritten (9ab055cfe); release:check:publish passed.
- Fabio's copy D:\CVTest\v2.1.2-to-v2.1.3 re-extracted from the published 2.1.2 zip, engine moved across, update applied (Applied Cubric Studio update to 2.1.3). FRESH user-data: his DeepInfra key must be re-entered; old copy kept as v2.1.2-to-v2.1.3.recut1. Start Menu shortcut re-pointed at his copy.
- Left: Fabio retests (joining clips with a real generation, calm start picture, MPI-1316 style drop, DeepSeek default), then Gate 2 and publish.

## 2026-10-28 - re-cut 3: tag v2.1.3 -> 885d428d4 (release 8 session)

- Bench (Fabio OK'd each spend): join-pre-scene 3/3, join-between 3/3, --bite both bite. Fixes in 885d428d4: bare media ref refused by its shape; model id as flowId refused naming modelId; MAX_STEPS 16 -> 20; H3 guide example without "no cartoon or CG rendering"; joining-clips.md names clip B's FIRST frame. Bench spend this session $0.0901 billed, total $0.1685.
- Tag moved on Fabio's go; mpi-ci run 40623986346 green on all three OSes; six files in D:\CubricStudio\Vision\Builds\v2.1.3\ (re-cut 2 set kept as v2.1.3.recut2); CI artifacts deleted.
- 1.5.0 -> 2.1.3 gate redone on a fresh 1.5.0 extract (old copy kept as v1.5.0-to-v2.1.3.recut2, docs as docs-v2.1.3-test.recut2): bundle 885d428d4352, FIRST launch on CUBRIC_PORT 3077, one engine start, 0 degraded, 0 IMPORT FAILED, Klein 4B t2i_004 opened (red bicycle, matches). update-evidence.json rewritten; release:check:publish passed.
- (Superseded by re-cut 4 below.) Fabio's copy D:\CVTest\v2.1.2-to-v2.1.3 was still on the re-cut 2 build.

## 2026-10-28 - re-cut 4: tag v2.1.3 -> 7110ef089 (release 9 session)

- Why: MPI-1318 (wrong-vendor engine replaced, "GPU recognition issue" session, 82e97e46f) landed after re-cut 3. Its archive note changed but releaseNotes.js did not, so release:check refused; 7110ef089 synced the in-app line and Fabio re-approved the notes. The "YouTube bug reports" session changed no code.
- CI Tests green on 82e97e46f and 7110ef089. Tag moved on Fabio's go; mpi-ci run 40661423853 green on all three OSes (HEAD 7110ef089); six files in D:\CubricStudio\Vision\Builds\v2.1.3\ (re-cut 3 set kept as v2.1.3.recut3); CI artifacts deleted.
- 1.5.0 -> 2.1.3 gate redone on a fresh 1.5.0 extract (old copy kept as .recut3): bundle 7110ef089287, FIRST launch on :3077, one engine start, 0 degraded, 0 IMPORT FAILED, /engine/version-check needsUpgrade false on this NVIDIA card (MPI-1318 leaves a right engine alone), Klein 4B t2i_004 opened (red bicycle, matches). update-evidence.json committed (2473b6a07); release:check:publish passed.
- Closing the gate by killing the :3077 server PID leaves the Electron main process up, showing "Cubric Studio failed to start ... exited with code 1" (Fabio saw it). Not a bug: kill the parent (main) process tree instead.
- Fabio's copy D:\CVTest\v2.1.2-to-v2.1.3 re-extracted from the 2.1.2 zip, engine moved across from .recut2, update applied by its own applier (Applied Cubric Studio update to 2.1.3), buildInfo 7110ef089287. FRESH user-data: DeepInfra key to re-enter. Start Menu shortcut already pointed at it.
- Rule from Fabio (memory): later Cosmo/app fixes are tested by him on `npm start`, build once after.
- Left: Fabio's real test (pre-scene join, between-clips join, MPI-1316 style drop, DeepSeek default), then Gate 2 and publish.

## 2026-10-28 - Fabio's re-cut 4 pre-scene test: RELEASE HELD

- Fabio asked for a pre-scene before the crash clip (two schoolgirls talk, crash in the background). Cosmo (DeepInfra): two "Generation not started" rows (reasons not logged), then Krea 2 Edit of t2i_076 with the crash removed as an invented calm START frame (94 s), then minimax-h3 i2v_ms with the crash clip's frame as END frame. One `INVALID_FAST_MOTION` refusal (logged), resent.
- Fabio: the right plan was the crash clip's FIRST frame as END frame of H3 plus a prompt, no invented start picture. Impossible today: every i2v op has `startFrame` `required: true` (js/data/commandRegistry.js:826). He will not ship 2.1.3 with this, because the changelog announces the joins.
- H3 i2v first attempt FAILED (09:41:47): `MpiH3ImageToVideo failed: RuntimeError: HostBuffer.read_file_slice failed`; aimdo `xfer_file_read_at: GetOverlappedResult failed error=1450` + `MemoryError` at offset ~17.7 GB of the 26.4 GB TE `qwen3vl_32b_h3_ultra_uncensored_heretic_int8_convrot.safetensors` (M:\CubricModels). ONE `Requested to load MiniMaxH3TEModel_` for that prompt, so NOT the MPI-1029 double load; it came right after the Krea 2 Edit job (RAM 32/64 GB shown). Cosmo's automatic retry (09:42:03) loaded the TE fine and was sampling at handoff. Fabio: the blocking "Generation failed" modal should not have appeared for an attempt the agent retried itself. Log: D:\CVTest\v2.1.2-to-v2.1.3\user-data\logs\app.log lines ~282-518. Next session: keep it as .recut2, re-extract the published 2.1.2 zip, move the engine across, apply the re-cut 3 update bundle, re-point the Start Menu shortcut (he must re-enter his DeepInfra key). Then Fabio generates both join scenarios for real (build gate), Gate 2, publish.

## 2026-10-28 - Pre-scene fixes on master, for Fabio's npm start test (not committed)

- Crash cause: Windows error 1450 while staging H3's 25 GB TE, with Krea 2's ~18 GB still held in RAM (ComfyUI 0.42.1 evicts pins on Windows only under 512 MB free or swap >= 5%); aimdo 0.5.6 does not retry the read. Retry 20 s later ran clean. Not reproduced on a second engine: the error is nondeterministic and the GPU was Fabio's.
- Fix (Fabio's go): comfyController `_freeOtherModelFamily` posts `/comfy/unload {deep:true}` before a LOCAL generation whose unet/ckpt/clip/vae files share none with the last generation's. Text-output ops (imageDescribe, promptEnhance, speechTranscribe) never pass `freesOtherModels` (commandExecutor), so a describe or enhance never unloads the working model. Live proof needed: `New model family: freeing ...` in logs/app.log on Krea -> H3, and the RAM bar drops.
- End frame alone: `i2v_ms` startFrame carries `satisfiedBy: 'endFrame'` (all four i2v_ms graphs load both frames with block_if_empty off; the PromptBox pill, MPI-466, already did it). resolveAgentMedia honours it; describe_model reports startFrame `required:false, orRole:'endFrame'`. VIDEO_OPS, joining-clips.md and the minimax-h3 / ltx-2.3 / ltx-2.5 / wan-2.2 notes no longer tell Cosmo to invent a start picture.
- Fabio: a frame decoded from a clip goes through the imageUpscale tool (Siax realistic, AnimeSharp cartoon, x2) before a frame slot; a clip made from a picture sends that picture. Tools already take a clip + `frame: "last"` (connector `_firstFrames`), so this is agent knowledge only.
- npm test 3778 pass 0 fail; eslint clean. Still open: the "Generation failed" modal on an agent-recovered failure.
