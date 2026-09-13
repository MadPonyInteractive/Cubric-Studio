# Head Swap

> Swap a selected head in a base image with the head from a reference character image.
> Card: **MPI-299** (child of MPI-259 Flows v2); re-engined from Qwen Edit to **FLUX.2 Klein
> 9B** by **MPI-744** (2026-09-13). Descriptor REGISTERED in `flowsRegistry.js`; carousel
> `steps` shipped in MPI-306 Phase 2. Runs on the local engine.
>
> Portable UI decisions made here live in [../ui/](../ui/), not in this file.

## Status — Klein 9B; Qwen RETIRED

**Qwen is DROPPED** (Fabio, 2026-09-13: slow and imprecise). The graph runs Klein 9B int8 +
the BFS head LoRA through crop-stitch, on `lcm` (the Klein sampler rule, MPI-746). First bench
run ~20 s. Klein darkens the box it returns; a changed-pixels composite takes the seam to 0
(§ The seam, below).

| Item | State | Notes |
|---|---|---|
| LoRA | **SETTLED** 2026-09-13 | `bfs_head_v1_flux-klein_9b_step3500_rank128` at strength **0.75** — better than 1.0 on the bench |
| R2 upload | **DONE** 2026-09-13 | 9B live, `Content-Length` byte-exact. The 4B file is on R2 too; no graph loads it yet |
| Qwen LoRA | **R2 copy DELETED** 2026-09-13 | never shipped. Dep entry kept DEPRECATED for the orphan sweep, `url` repointed at the upstream |
| Klein 4B | **DROPPED** 2026-09-13 | loses identity, and its seam fails on a high-key photo (Fabio). Ship 9B only. The 4B LoRA stays on R2, unloaded |
| Seam | **SOLVED** 2026-09-13 | changed-pixels composite + expand return, measured 0 on three photos (§ The seam) |
| Tile + hero | **OPEN** | both were cut from a Qwen run — re-cut via `/mpi-flow-graphics` or keep |
| RunPod verification | **OPEN** | never run against the remote engine |

> **Do not repeat this mistake:** MPI-306 Phase 2 was verified "by inspection, not by
> generating" on the inherited claim that the graph 404s. It did not — locally. The claim
> conflated *not uploaded to R2* with *not on disk*. One `ls` of the models folder settles it;
> check the disk before declaring a flow unrunnable. See memory
> `feedback_test_user_instinct_first`.

## Shape (from the authored graph, 2026-09-13)

- **Model:** `klein-9b`, no tier — the Qwen-era Speed radio (`Input_Tier`, three tiers) left
  with the graph that had it. `operationRegistry` `flowHeadSwap` is `1.1` for that removal.
- **Extra dependency:** a head-swap LoRA, flow-only. See § Dependency below.
- **Output:** `mediaType: 'image'`. The gallery card is `Output_Image`. The Flow shows
  `Output_Display` instead — both inputs stacked beside the result — per
  [../ui/result-pane.md](../ui/result-pane.md) § Output_Display (MPI-747). `result: { compare:
  'image1' }` stays declared (MPI-585) and the surface toggle still reaches it. The BEFORE is the
  plate being KEPT, never `image2`: the head donor shares no framing with the output.
- **No component, no fields (MPI-572, MPI-744).** The boxes are carousel STEPS (`kind:'box'`)
  that declare `param: 'box1'` / `'box2'`. See [../ui/box-gizmo.md](../ui/box-gizmo.md) and
  [../ui/carousel-frame/](../ui/carousel-frame/README.md).

### The UI, as shipped (MPI-306 Phase 2)

Four steps, all DATA on the FlowDef — no per-flow layout code:

| Step | Ticker | What |
|---|---|---|
| 0 | Inputs | two slots, labelled `Original` / `Face Reference` (`labels` on the media group) |
| 1 | Target head | `box` step, role `image1`, `param:'box1'`, `ratio:1` — "Mark where the new head goes" |
| 2 | Reference head | `box` step, role `image2`, `param:'box2'`, `ratio:1` — "Mark which head to take" |
| 3 | Generate | Generate → result |

**The box→node mapping is DECLARED on the step (`param`), not written in JS** (MPI-572). The
frame collects `{[role]: {box}}` and still never learns what a role means; which box masks and
which crops stays flow knowledge — the flow just says it in one word instead of a component.
Coords pass through **unconverted** — `MpiStepBox` already reports clamped top-left source
pixels — with only the `w`/`h` → `width`/`height` rename the injector's widget names need, and
that rename lives with the `box` KIND (`stepValueToParam`, `stepKinds.js`).

### Injection surface (`Input_*` / `Output_*`)

| Node | Kind | Notes |
|---|---|---|
| `Input_Image` | image (path-reading) | base image — the BODY, "Picture 1" in the prompt |
| `Input_Box` | `Mpi Box` | → `Mpi Box Mask` → Inpaint Crop |
| `Input_Image_2` | image (path-reading) | reference — the FACE, "Picture 2" |
| `Input_Box_2` | `Mpi Box` | → `Mpi Box Crop` |
| `Input_Seed` | int | |
| `Output_Image` | PreviewImage | the gallery card |
| `Output_Display` | PreviewImage | the Flow's view, never saved |

**The prompt is BAKED inline in an UNTITLED `CLIPTextEncode` (node 128) — never title it
`Input_Positive`:** a promptless Flow still sends `Input_Positive: ''` every run, wiping a baked
instruction (the outpaint trap); `tests/flow-output-display.test.cjs` pins it. BFS Klein order is
INVERTED from Qwen's ("head_swap: start with Picture 1 as the base image"). The reference image
is background-removed (BiRefNet) before encoding.

**KJNodes (`GrowMaskWithBlur`, `ImageConcanate`) and the `birefnet` weight stay OUT of
`requiredDeps`:** both install WITH the engine (`.claude/rules/comfy_engine.md`), and the Flow's
Uninstall frees exactly that list ([../04-overlay-and-shell.md](../04-overlay-and-shell.md)).

## Dependency — the flow-only LoRA

`klein-9b-lora-headswap` (`loraDeps.js`): `bfs_head_v1_flux-klein_9b_step3500_rank128`,
**632MB**, live on R2. **Source: `Alissonerdx/BFS-Best-Face-Swap`, licence MIT.** The local
sha256 equals the upstream blob's `lfs.sha256` (read 2026-09-13), so the upstream is the
`mirrorUrl` with no re-host.

Why rank128 over the rank64/step3750 twin: two separate trainings, the README picks neither,
and the author's later pipeline (LTX v2.0 workflow) loads rank128. The 4B pair on the same repo:
`bfs_head_v1_flux-klein_4b` (rank 128, README-recommended) and the undocumented
`v1.1_optional` (rank 512).

**It must NOT become a `klein-9b` dependency.** That would push 632MB onto every Klein user for
one flow. The scaling case that settles it: a flow wanting 30 style LoRAs would tax all users
~15GB. The flow *requires* it through `requiredDeps` (MPI-304).

**The Qwen predecessor** (`qwen-lora-headswap`, rank-32 fp32, 1.2GB) taught the lesson that
still applies: it shipped with **no `origin`**, so the MPI-429 mirror sweep could not place it
and it became the catalogue's only single-route dep until Fabio named the repo by hand.
**Record `<owner>/<repo>` + the upstream filename on every dep you add**;
[add-model/02-dependencies-r2.md](../../add-model/02-dependencies-r2.md) § `origin` is
LOAD-BEARING is the rule.

## The seam — Klein returns the whole box darker (SOLVED 2026-09-13)

Klein 9B hands the crop back 5-7 levels darker, uniform across RGB; the stitch blend only
softens the edge. Colour correction does not fix it: `MpiInpaintHeal` moves nothing (zero-mean
grain), KJNodes `ColorMatch` mkl still leaves -7/-5/-3 and shifts the head. A slower model does
not either: base 9B at its template (20 steps, CFG 5) darkens less raw but still shows the box
edge, at 297 s against 23 s.

The fix is Law 3 of [../blending-into-a-photo.md](../blending-into-a-photo.md) § The three laws,
adapted: only pixels that CHANGED return, onto the ORIGINAL crop. The `Seam:` nodes:

1. **Change** = `ImageBlend` difference both ways → `screen` → `ImageBlur 2/1.0` → R+G+B
   `ImageToMask` summed → `ThresholdMask 0.18`. Klein's drift sums to ~0.07; a green-only mask
   left holes where red hair turned brown.
2. **Gate** = BiRefNet on the decode + BiRefNet on the original crop, `GrowMask 60`, multiplied
   into the change; plus old person MINUS new person (hair that went).
3. `GrowMaskWithBlur 12/12` → `ImageCompositeMasked` decode onto the original crop → stitch.
4. **Expand return:** Inpaint Crop's `mask_expand_pixels` = `MpiMath floor(a * 0.12 + 0.5)` of
   the `Input_Box` width, `context_from_mask_extend_factor 1.1`. Without it the stitch cuts new
   hair at the box bottom.

Measured seam band median 0 on a dark, a bright-room and a high-key photo. Two traps:
`MpiMath` evaluates `math.*` only, so `int()`/`round()` raise and the node SILENTLY returns 0.0
(expand return off); `GrowMaskWithBlur` `fill_holes` fills the region to the whole gated area
and brings the dark decode background back, so leave it off. Evidence and harness: MPI-744
`checklist.md` § Bench round 3, `research/seam_bench/`.

## Region selection — settled

The user picks the head region with a box. The flow injects one `Mpi Box` node per image
(`x`, `y`, `width`, `height` — **top-left** anchored), and the graph's consumers do the rest.

**BOTH images get a box**, but they feed DIFFERENT consumers:

| Image | Box node | Consumer | Purpose |
|---|---|---|---|
| `Input_Image` (base) | `Input_Box` | `Mpi Box Mask` | mark which head gets replaced |
| `Input_Image_2` (reference) | `Input_Box_2` | `Mpi Box Crop` | cut out the head to take |

The base image needs a **mask** (full-frame, white rect at the box) for the edit; the
reference needs a **crop** (the region itself). Same box type, same injection, different
consumer — nothing flow-side distinguishes them.

Boxing the reference means the user supplies a **close-up portrait** and marks the head in
the flow, rather than pre-cropping outside it — no guessing whether the crop caught too much
or too little. Same gizmo twice, no extra UI.

Full contract, the verified centre-anchor finding, and the reasoning against a painted mask:
**[../ui/box-gizmo.md](../ui/box-gizmo.md)** — that is the portable record, do not duplicate
it here.

Why a box at all: the pipeline crops a square, so a non-square selection would clip the
result.

## Hair detector dead end — do not re-walk

Sequence that killed it (2026-07-17 → 18), recorded so nobody repeats the search:

1. Goal was to mask **face + hair** (= head). A face detector already ships; hair was missing.
2. **No hair-only detector exists** in the usual places — `Bingsu/adetailer` has face / hand /
   person but no head or hair; Ultralytics' own HF org ships base YOLO only, not ADetailer
   detectors.
3. Found `hair_yolov8n-seg_60.pt` (`jags/yolov8_model_segmentation-set`, 6.77 MB, apache-2.0,
   SHA256 `3112ced2bd21b48ca2a4357c2927b7e423d9ff851bc976de182a6c05f5851da0`; mirrored in
   `alexgenovese/ultralytics/segm`). It is a **segm** model → SEGM_DETECTOR slot.
4. **It fails on multi-person images** — the hair mask itself is bad, not merely ambiguous.
   Faces detect and select fine per-person; hair does not. This is what killed auto-detection.
5. Alternative `Anzhc HeadHair seg y8m.pt` (head+hair as one class, ~54.9 MB) exists but is
   **AGPL-3.0** — copyleft, flag before shipping.
6. Outcome: **manual box selection**, no detector dependency. A detector may later *seed* the
   box position (see [../ui/box-gizmo.md](../ui/box-gizmo.md) § Interaction) but must never be
   required.

**HF "Unsafe" flag is a non-issue** — it is the pickle-format scanner, and every YOLO `.pt`
trips it, including the face/hand/person detectors already shipped. Not a new risk.

## Open questions

- ~~Coord convention the gizmo hands the flow~~ — **SETTLED** (MPI-306 Phase 1): `MpiStepBox`
  reports **top-left anchored, absolute source pixels**, clamped to the image, which is what
  `Mpi Box` consumes unconverted. No conversion anywhere.
- Whether face detection seeds the initial box, or selection is fully manual in v1.
  (v1 default is the whole image; a step is never invalid.)
- Multi-output: does one run ever produce more than one image?

## Notes

- Head Swap is the **4th flow** → the dev-gate lifts at ≥4 (MPI-259 item F). Decide whether the
  three plumbing flows (Image Regen, SDXL 4K, Video Stitch) stay before that becomes public.
- This flow is the first to drive a real UI/UX pass, so its portable decisions seed
  [../ui/](../ui/) for every flow after it.
