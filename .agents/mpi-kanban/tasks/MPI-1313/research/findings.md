# MPI-1313 research findings (2026-10-27)

Card is parked until after 2.1.3 (Fabio 2026-10-27: "Do not wire anything"). Nothing below is wired.

## 1. FLUX.3 bench: one box per character fixes the duplicates

Same failing case as MPI-1309 bench 1 (Fabio's robot-crew panel 1): FLUX.3 Klein Turbo edit, the 5 FULL
character sheets (uncropped) + Film Set + Clapperboard, seeds 101/202/303/404, local RTX 4060 Ti,
isolated instance. Prompts hand-written (`bench3.mjs`, full text inside), sent through `/connector/generate`
with no `boxes` param, so the table rode the prompt as text. Cards edit_025-036 in the
"MPI-1309 sheet bench" project; contact sheet `bench3.jpg` (rows R, T, R16).

| Variant | Exactly 5 robots | Notes |
|---|---|---|
| Bench 1 baseline (no boxes, best wording) | 0-1/4 | Prism twice, back-view twins |
| T  today's boxed edit: prompt + keep line + rows `{id,bbox,desc}`, first ref's size | 4/4 (029-032) | s303: a ghost film-frame behind Reel's head |
| R  BFL i2i_bbox: `<cosmo_1> from <ref_image_0>`, rows `{id,from,src_bbox:[0,0,1000,1000],tgt_bbox,desc}`, first ref's size | 4/4 (025-028) | cleanest |
| R16 = R at custom size 16:9 1K | 4/4 (033-036) | as clean as R; ~115 s vs ~160 s |

Each robot drawn once, short legs kept, placed in its box. Counts from 900 px tiles + two full-size checks.

What it means:
- The fix is a box PER CHARACTER whose desc names the character's looks. That already works with
  today's row shape (T). The `from`/`src_bbox` binding (R) was a little cleaner, not decisive.
- Custom size 16:9 did NOT break R16, so the "first reference's own size" lead from MPI-1309 is not
  the cause on this panel.
- The descs were written by hand from the sheets (looks per robot). NOT tested: boxes with bare
  names and no looks, i.e. whether the box or the desc does the work. Test that first when resumed:
  if the box alone works, the Storyboard planner only has to place boxes.
- T's keep line ("Keep everything else ... the same") did no visible harm here, but it is still wrong
  for a new composition; R's "Create ..." voice is BFL's trained one for refs drawn into a new frame.

## 2. MOSS-Image cannot take a reference

Confirmed in code: ComfyUI core `comfy/model_base.py:2799-2809` (`MOSSImage.extra_conds` passes only
`c_crossattn`, no reference latents), `comfy_extras/nodes_moss_image.py` (`MOSSImageLayoutPrompt`, no
image input), repo docs `docs/models/moss/README.md` ("nothing in MOSS reads a reference picture").
Upstream USERGUIDE (github.com/OpenMOSS/MOSS-Image) layout items have `label, caption, text, bbox`, no
image field; a reference-capable fine-tune is only announced. So refs-on-boxes is FLUX.3 only for now;
MOSS can only describe the subject in the box's caption.

## When resumed (after 2.1.3)

1. Bench T without looks in the descs (box + name only), same panel, 4 seeds.
2. Then wire, smallest first: optional picture number per box -> `from`/`src_bbox` row + "<id> from
   <ref_image_N>" cite (node already renumbers past empty slots, flux3.py `rewrite_prompt_tags`);
   drop the keep line under Custom size; picture picker per box row in the panel.
3. Storyboard (MPI-1309): the planner places one box per pictured character.
