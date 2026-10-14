# MPI-1096 research pass 1: face identity for LTX 2.3 (2026-10-11)

**Status: UNVERIFIED.** A web-research sub-agent's reading of model cards and posts; no link opened by hand, no
licence read, nothing run. Verify each claim before acting on it.

## No official option
Lightricks' LTX-2.3 IC-LoRA collection (as read): Ingredients, Motion-Track-Control, LipDub, Union-Control, HDR. No
face-identity IC-LoRA for 2.3 or 2.5.

## Ranked shortlist
1. **LTX-Best-Face-ID** (Alissonerdx) - https://huggingface.co/Alissonerdx/LTX-Best-Face-ID. Reference-to-video
   identity LoRA for LTX-2.3 22B, one reference photo, ArcFace identity loss + TASS-RoPE (arXiv 2606.02441). ~1 GB.
   Nodes: ComfyUI-BFSNodes `LTXIdentityOverlapConditioning` (installs insightface); for i2v, 10S-Comfy-nodes
   `LTXFaceIdentityReinforcer`. Licence NOT stated; insightface/ArcFace weights historically non-commercial. Card
   notes: face bleeds into background, weaker on wide/full-body shots.
2. **AviadDahan LTX-2.3-ID-LoRA-CelebVHQ-3K** - https://huggingface.co/AviadDahan/LTX-2.3-ID-LoRA-CelebVHQ-3K, nodes
   https://github.com/ID-LoRA/ID-LoRA-LTX2.3-ComfyUI. ~1.1 GB. Trained on CelebV-HQ (dataset is research-only:
   commercial risk). Self-reported benchmarks only. CHECK: may be the same "ID-LoRA" family as our talkvid voice
   ID-LoRA (docs/models/ltx/audio-input.md).
3. **Face-dominant reference** (no new weights): big head-and-shoulders crop on the sheet; for i2v a good face still
   as frame 0. Community advice, no evidence quality. **Ref2v half tested 2026-10-11, did not fix it:** `ref2v_003`
   (X2.3 references, Pod, high 1216x704, sheet ONLY so it passes untouched, face crop ~1/3 of the sheet). Agent read
   it as another man; **Fabio, side by side: "I think it's the same guy this time around. His face seems a bit wider
   and with more detail, but that can be attributed to the camera lens and aperture."** So identity carries when the
   face is big on the sheet and drifts when it shares the sheet with a setting (`ref2v_002`, same pictures + forest:
   "not the same guy"). Size alone does NOT explain it: `layoutSheet` puts the face panel at ~783 px wide alone vs
   ~665 px with the forest beside it (-15%). A/B `ref2v_005`: ref2v_002's prompt AND seed (2876282417), sheet only:
   agent's read of frame 1 = much closer to the sheet (narrow face, thin brows, light eyes). **Fabio: "that looks more
   like the same guy."** So a second picture on the sheet costs identity beyond the 15% pixel loss; a bigger face
   crop is not the lever. Candidate: give the character(s) far more of the sheet, or its own sheet.
4. **Face-swap second pass** - an LTX-2.3 face-swap workflow listed on RunComfy; LoRA and licence unknown. No
   ReActor/FaceFusion + LTX pipeline found.
5. **Per-character LoRA** via LTX Trainer (https://ltx.io/model/ltx-trainer): 20-30+ images, 500-2000 steps, 32 GB
   VRAM floor (RunPod, not user hardware), Linux. Strongest for a recurring character; per-version retrain.

## Licence check (2026-10-11, HF API + both README.md read by hand)
- **Best-Face-ID:** `license: other` with NO terms anywhere in the README: no grant = all rights reserved, so we cannot
  ship or re-host it without the author's written permission. Three files: `Best_FaceID_v1.0_LoRA`,
  `Best_FaceID_CharacterSheet_v1.0_LoRA` (continuation trained on a 4-panel sheet: face close-up + full-body
  front/side/back on white, carries clothing too; README: add the base LoRA at ~0.2 if identity is weak) and an
  optional ArcFace projector (unused by the sheet LoRA). Training used InsightFace `buffalo_l` ArcFace (non-commercial
  models) as a LOSS; the BFS node auto-installs insightface, so check whether inference needs its weights. Example
  references are celebrity clips (likely CelebV-HQ-style data). Created 2026-07-05. README limits: reference can look
  "pasted" (first-frame/mask tendency), identity weak with a generic prompt, base checkpoint biased to close-ups.
- **AviadDahan CelebVHQ-3K:** `license: other`, no terms. NOT a face LoRA for our case: it is the CelebV-HQ sibling of
  the TalkVid-3K ID-LoRA we already ship (`ltx23-lora-talkvid`, voice-ID; same paper arXiv 2603.10256, strategy
  `audio_ref_only_ic`). CelebV-HQ is a research-only dataset. Drop it.

## Searched, nothing found
PuLID / InstantID / IP-Adapter / ConsisID / Phantom / Lynx / Stand-In ports to LTX; ReActor/FaceFusion with LTX
output; any LTX-2.5 identity LoRA.

## Open questions for the bench
- Licence of each candidate (commercial use) and of insightface if a node pulls it in.
- Does a face LoRA stack with the Ingredients IC-LoRA and the talkvid voice ID-LoRA in one graph? Nobody has published it.

# Pass 2 (2026-10-13, session b0dbd1a3)

## New live evidence (Fabio, "it doesn't seem implemented")
`Qwen 2.1/ref2v_002` (ltx-23-balanced ref2v_ms, 960x512, 20 s, seed 3599064130): TWO character sheets, no setting
picture (`flowCharacterSheet_031` woman, `flowCSFI_007` man). Costume, hair colour, braids, backpack carry; faces do
not (man's swept hair turns curly, face softer; woman reads as a different, younger face). So identity drifts even
with characters only on the sheet: the setting-off-the-sheet idea alone will not fix it.

## Re-checks
- Best-Face-ID: still `license: other`, no terms (HF API 2026-10-13, last modified 2026-07-17). Unshippable as-is.
- CharacterSheet LoRA needs NO insightface: README says leave the projector at None; the node imports insightface
  only for the projector. It reads the sheet at a fixed 1536x1024 (`ref_resize_mode=native_resolution`), so the
  reference keeps detail whatever the clip size. Our Ingredients sheet is resized to the CLIP size (960x512 on
  Medium), which may be part of why faces drift.
- NEW candidate checked, DROPPED: `SyFeee/LTX-2.3-SyFe-ID-LoRA` (2026-08-14, LTX-2 community licence). LoRA target
  modules are audio + audio-video cross-attention only; face comes from first-frame conditioning
  (`first_frame_conditioning_p 0.9`). A voice ID-LoRA like our talkvid, not a face adapter.
- Lightricks has published LTX-2.5 (2026-10-11) and a 2.5 Ingredients IC-LoRA (2026-09-10); no face-ID IC-LoRA in
  either collection.

## Bench (Fabio's OK 2026-10-11), set up without touching his `:8188` bench
- Node: BFSNodes `72af0aa` `ltx_identity_overlap.py` + `reference_temporal_offset.py` only, copied to the session
  scratchpad and loaded by a SECOND ComfyUI from `G:\ComfyUi` on `:8199` via `--extra-model-paths-config`
  (own input/temp/output/user dirs). Code read: no network, no subprocess, insightface only for the projector.
  The running `:8188` bench keeps BFSNodes 1.4.0.
- LoRA: `C:\AI\loras\LTX2.3\best-face-id\Best_FaceID_CharacterSheet_v1.0_LoRA.safetensors`, 1,308,756,480 B,
  sha256 `4c780426...7ef93ffa` = HF lfs oid. Kept OUT of `G:\CubricModels` so the app's orphan sweep never sees it.
- Graph: shipped `ltx_i2v_t2v_int8.json`; FaceID branch = LoraLoaderModelOnly(901) -> LTXIdentityOverlapConditioning
  (source_id 2, overlap, native) re-pointing 258/277/293/330, so both stages and the ID-LoRA path get it (the author
  applies it at both stages too). Prompt `ref_t2v: <description>. <scene>` per README.
- Cases (960x512, 5 s, seed 3599064130): `ing_*` = today's app path (sheet as Input_Image, Ingredients prompt),
  `fid_*` = Best-Face-ID only, `both_*` = both; man and woman separately (the LoRA holds one identity).
- Script: session scratchpad `faceid_bench.py` (copy into `research/` when done); clips `C:\AI\MPI-1096-out\`.

## Bench result (2026-10-13, all 6 ran: 130-185 s each on the 4060 Ti; side-by-sides `compare_man/woman.webm`)
Agent's read of stills at 1 / 3 / 4.5 s (Fabio's eye test pending, his read wins):
- **Best-Face-ID alone is WORSE than today's app path.** Woman: a rounder, younger generic face; man: curly top,
  different face. Not worth the licence email on this evidence.
- **Both** = closest to the man's sheet (swept hair, brows, beard line); for the woman ~ same as the app path.
- **App path with ONE character on the sheet already holds the face** (woman ~ the sheet's face panel, man close).
  Fabio's drifting clip had TWO characters sharing the sheet (+ 20 s). So the lever looks like characters SHARING
  the sheet, not the adapter. Next bench to propose: same two sheets, one-per-sheet vs shared, same seed.
- **Fabio's eye test (2026-10-13): BOTH (Ingredients + LoRA) is the best.** LoRA alone on the woman: "a different
  woman, a younger woman". Man: LoRA a bit better but hard to judge, the app-path clip had him far away. -> rerun
  the man with a chest-up close-up prompt on two seeds (`*_manclose`, `*_manclose_s2`; seed 2 = X2.3 ref2v_009's).
- Close-up result (6/6 ran, 130-180 s; `compare_manclose*.webm`), agent's read at 3 s: the app path ALONE holds the
  man's face on both seeds (swept hair, brows, beard line, even the face panel's head tilt). Best-Face-ID alone =
  a different man again (wavier hair, rounder face). Both ~ app path; seed 1 maybe a touch closer on jaw/brows.
  So with a BIG face the sheet already carries identity; the drift in Fabio's clips tracks a SMALL face (two
  characters sharing the sheet, wide framing). Fabio's eye test on the close-ups pending.

## Two characters (Fabio 2026-10-13: "try two characters, two sheets"; + compare the LoRAs' workflows with ours)
- **Role-label finding:** with untagged lines (Fabio's ref2v_002 prompt) `sheetRoles` marks ONLY Picture 1 as
  Character; the man becomes a bare `**Right Panel:**` (no "(Character)", outside the composer's character set).
  By design (help: Picture 1 bare, `setting:`/`prop:` on the others), but a second PERSON has no default. Measured
  by `two_sharedchar` (both tagged) vs `two_shared` (as Fabio typed).
- **Sheet finding:** shared 16:9 sheet = two 16:10 character sheets side by side, 56% coverage, grey bands; each
  face ~1/5 of its half. The Character Sheet Flow's woman sheet has a BLANKED face on the full-body front view.
- Cases (`two_sheets.cjs` builds them with `routes/ingredientsSheet.js`; 960x512 unless noted; 5 s; seeds
  3599064130 and 1816753443; one medium two-shot prompt, faces visible): `shared` (app today), `sharedchar`,
  `faces` (+ a face crop per character, all four tagged character, 67% coverage), `high` (shared at 1216x704),
  `guides` (each character's sheet as its OWN IC guide, stage 1 and 2 chained: 925/930 after 905/910).

- **Result (10/10 ran; grids `two_layouts.webm`, `two_layouts_s2.webm`), agent's read at 3 s:**
  - `guides` (each sheet its own IC guide) = the man's face matches his sheet on BOTH seeds (swept hair, brows,
    beard, skin); woman good. Catch: both seeds frame both characters frontal, looking at camera, despite "facing
    each other" - possible reference-pose copying; check the whole clip. Cost: 250 s vs 160 s (two guides).
  - `shared` / `sharedchar` (app today): seed 2 the man is a DIFFERENT man (darker skin, curly hair); seed 1 close
    but curlier. The "(Character)" label makes no visible difference.
  - `faces`: man closer than shared but turned away / profile both seeds. `high`: closer than Medium, not as close
    as `guides`.

## Proposal (Fabio approved the direction 2026-10-13): one reference per CHARACTER
Each character = its own IC guide (its sheet whole); settings + props share one more sheet as today; a cap on
character guides set by VRAM (each guide adds a clip-length of reference tokens: 2 guides 250 s vs 160 s, Medium).
Roles: role words when given, else the MPI-1084 describe step (person/creature = character). Off-label (the LoRA
was trained on ONE sheet), so the bench must clear pose copying first.
- Bench (`two_mix*`, seeds as above): 2 characters + beach setting (`X2.3 references/imported_006.jpg`), side-on
  walk along the shoreline; `mixshared[hi]` = the app's one sheet (all tagged), `mixsplit[hi]` = woman, man,
  beach as three guides; Medium 960x512 and High 1216x704; peak VRAM (whole card, nvidia-smi) and time logged.
- **Times / VRAM:** shared M 155/148 s, H 242/234 s; three guides M 285 s, H 528 s. Peak VRAM ~14.8-15.5 GB in every
  case (ComfyUI fills the card), so VRAM does not separate them; TIME does (~2x at High).
- **FAILURE, my bench shortcut:** the raw PORTRAIT beach (736x1308) as its own guide gets padded by #903 to the
  landscape clip with BLACK: a mostly-black guide -> seed 1 Medium = an ALL-BLACK clip (every frame), High = one
  dark static portrait of a merged third person, no beach. The two seed-2 splits were interrupted (`/interrupt` on
  the bench's own :8199). Rerun as `mixsplitfix[hi]` with the beach COVER-cropped to 16:9 (`sheets/beach_169.png`).
  Same trap exists in the app TODAY: one picture "is the sheet, sent as it is", so a lone portrait picture on a
  landscape clip is padded black by #903. Any per-reference design must fill each guide (grey-card sheet or crop).
- **Three guides, beach filled (`mixsplitfix[hi]`, seed 1): BROKEN either way.** Medium 300 s: the clip CUTS between
  the woman alone and the man alone (never together), man's face drifts. High 478 s: a ghosted copy of the
  references (both character sheets blended over the beach picture). So 3 guides is past what the LoRA tolerates.
- Seed 2 (268 / 479 s) confirms: Medium = ONE merged figure (the woman's body, the man's bearded face); High = an
  empty beach, no people. Shared sheet seed 2: man drifts (darker, curly) at both sizes. Grids `two_mix[_s2].webm`.
- `mix2g[hi]` = the two character guides only, the beach in TEXT (M 232/200 s, H 342/342 s; grids
  `two_final[_s2].webm`). **1 of 4 usable:** seed 1 Medium = both in frame, man matches his sheet, woman holds;
  seed 1 High = both in frame but the man is a DIFFERENT younger man; seed 2 Medium = ONLY the man for the whole clip;
  seed 2 High = ONLY the woman for the whole clip. Beach from text works every time. No clip walks side-on: all
  static, near-frontal (the forest pose-copy again).
- **Verdict: one reference per character is NOT a product route.** 3 guides collapse; 2 guides drop a character or
  swap a face half the time and ignore the action. The shared sheet keeps both characters and follows the action,
  but faces drift. Proposal withdrawn; levers left on the shared sheet: face crops, High, detailer off (each small).
- Untested and most promising: a START FRAME that already has both faces right (an image editor with the sheets,
  e.g. Klein Edit / Nano Banana), then ref2v with that start frame + the shared sheet (doc: "start frame ... identity
  holds"). Also LTX 2.5's Ingredients IC-LoRA (2026-09-10) on the same bench.

## Workflow comparison (sub-agent report `scratchpad/workflow-compare.md`, checked by hand 2026-10-13)
- CONFIRMED in our int8 graph, ABSENT from Lightricks' official Ingredients example
  (`ComfyUI-LTXVideo/example_workflows/2.3/LTX-2.3_ICLoRA_Ingredients_Single_Stage_Distilled.json`):
  #387 `LTX23_softenhance_abliterated_detailer_merged` at model 1 / clip 1; #426 `LTX2_NAG` nag_scale 11.
- Official example: dev bf16 + distilled LoRA 0.5, SINGLE stage, 960x544, plain CLIPTextEncode (its
  GemmaAPITextEncode nodes 5020/5021 are bypassed, mode 4, unconnected, NO image input: the agent's "Gemma sees the
  face" claim is WRONG). Its per-panel lines are far richer (skin tone, hair parting, expression).
- Best-Face-ID: TextGenerate prompt enhancer reads the reference; reference at native 1536x1024 (its own token path,
  not applicable to the Ingredients guide, which must match the clip latent).
- UNVERIFIED from the report: BFID's SolidMask(0)->SetLatentNoiseMask before stage 2; int8 vs Q6 face detail.
- **Probe result (6/6 ran; grids `two_probes.webm`, `two_probes_s2.webm`), agent's read at 3 s:** detailer off =
  the man somewhat closer on both seeds (straighter hair, lighter skin on seed 2) but a softer/hazier look overall;
  NAG off = no visible change; face details in the prompt = marginal. None comes near `guides`.
- Probes queued (sharedchar sheet, 2 seeds): `two_nodetail` (#387 at 0), `two_nonag` (NAG switch #627 -> #269),
  `two_richdesc` (face details appended to each character line).

## Verdict (Fabio, 2026-10-14)
"The app today, as is, with one shared sheet, works fine in higher resolutions." No code change. Card closed;
the black-padding trap moved to MPI-1139. Best-Face-ID LoRA + bench scratch deleted at Fabio's request.
