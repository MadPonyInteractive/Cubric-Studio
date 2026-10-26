# MPI-1299 - Draw It In: seams, and FLUX.3 / Qwen-Image 2.1 against Klein 9B

Fabio, 2026-10-26: "Draw It In workflow needs fixing. There are visible seams. Perhaps we haven't
applied our correction nodes to it. Also, I want to try Qwen 2.1 on this as well as Flux3 ... Flux3
has a very specific way of prompting. BFL needs to be followed." Ships with LTX 2.5 (member of the
MPI-1267 umbrella). **Wiring anything into the app is blocked until 2.1.3 is out** (MPI-1286).
Research and benches may run now; GPU only on Fabio's go, under `gpu_lease.py run --poll 2`.

## 1. The seams

Known going in (read `docs/playbooks/add-flow/existing-flows/scribble-to-object.md` first):

- `comfy_workflows/flow_draw_it_in.json` grades the patch back with KJ `ColorMatch` (mkl, strength 1,
  ref = the WHOLE original crop), then `InpaintStitchImproved` with a 32 px feather. No MpiNodes
  grade node.
- The doc names its own ceiling: the ColorMatch reference includes the pixels the subject replaced,
  so a subject that fills much of the crop drags the patch tone toward the old background.
- Newer correction nodes exist and are pinned (`dev_configs/node_lock.json` MpiNodes `291bf3d`):
  `MpiGradeMatch` (fits gain + offset on the band AROUND a mask, then composites; built for the Video
  Edit Flow's pasted box, MPI-1036) and `MpiGradeBack` (whole-frame fit, refitted without what the
  edit changed; FLUX.3 edit, MPI-1216). `MpiGradeMatch` fits the paste-seam case exactly: it reads only
  pixels outside the subject.
- Not proven yet which one causes Fabio's seam: a tone step (grade) or an edge line (feather / return
  box). First step is to look at Fabio's run (the card and its sidecar), measure same-material bands
  across the box edge, then fix the cause. Not a feather bump if it is a grade.

### Fabio's failing run (2026-10-26)

Project "Draw it in improvements", source card `control_001` (1024x1024, a hotel room: woman centre,
door at the back left, carpet floor). He drew a man by the door. Result: **very noticeable seams on
the floor**, and a weak shadow. He deleted that card and will re-run it to reproduce. Note this
contradicts the doc's "textured ground stitched with no visible seam" (that was sand, outdoors): a
carpet in perspective, under warm indoor light, is a new case.

**Re-run 2026-10-26: `FLOWDRAWITIN_002`** from `control_c6213e9f`, Klein 9B, prompt "a man opening his
coat", box 320x610 round a ~335 px tall drawing of a man in the doorway. The latent preview showed the
WHOLE picture re-rendered, with the woman turned into a man opening his coat. Stitched result: a man
walking away at the door, a grey coat sleeve on the woman's arm (the box's right edge cuts through
her), and a light/tone step across the carpet along the box's bottom edge.

**Cause (graph read, no GPU):** `Context Factor` (node 183) = `4.267 * drawing / box`, and the crop
grows the BOX by that factor, so crop side = 4.267 x the drawing's size, whatever the box is. The rule
was measured on a 4000x3000 photo with a small drawing. On a 1024 picture any drawing over ~240 px
asks for a crop wider than the picture, so the "crop" IS the whole picture. Klein then sees the woman
plus "a man opening his coat" and edits the obvious person; ColorMatch (ref = that whole crop)
matches global stats, not the floor at the edge; the stitch returns only the box, so everything the
model changed inside the box (her arm's coat, the re-lit carpet) lands against untouched pixels
outside it. The seam is the symptom; the oversized crop is the cause.

Fix direction to bench: the crop must not grow past the box by more than a small margin when the
drawing is already big enough to anchor (the 200 px rule is a FLOOR for anchoring, not a target to
widen to); then a local grade (`MpiGradeMatch` on the band round the box) instead of whole-crop
ColorMatch. Check the box-edge cut through another subject too: it should be warned or the box
trimmed to what the drawing needs.

**Fabio's idea (2026-10-26): FLUX.3 with Boxes for Draw It In** (and Object Stamp). The box gives
FLUX.3 where; the model renders the whole scene so light and shadow come out right with no stitch, no
seam to fix. CORRECTION: FLUX.3 edit already works at picture 1's own size up to the 4K area (~8.4 MP,
`docs/models/flux3/README.md` "Edit frame"), not at 1 MP, so the "re-renders faces at 1 MP" worry
does not hold up to 4K. Cost: ~519 s Turbo for an ~8.6 MP edit on a 16 GB card.

**Fabio's design (2026-10-26), no box step for the user:**
1. The app finds the drawing (the paint mask) and makes the layout box itself: the drawing's bbox
   plus padding so it does not touch the strokes.
2. A second, bigger box the app also makes: the window FLUX.3 sees and may edit, a square centred
   on the drawing's box, about a QUARTER of the picture's side (Fabio, 2026-10-26): 16K picture ->
   4K window, 4K picture -> 1K window, a ~1K picture goes in whole at 1K. Ceiling 4K. The window
   must still hold the drawing's box with room round it, so a big drawing grows it.
   **Gate: the window edge must show no seam. If it does and we cannot fix it, this approach is
   rejected** (Fabio).
3. FLUX.3 renders the whole window with the box as "where", so light and shadow come out right.

**Simpler variant (Fabio, 2026-10-26, brainstorm):** drop box 1. Only the window, with the drawing
centred where the picture allows, and the prompt just asks FLUX.3 to turn the drawing into what the
user typed. Fabio is testing by hand how FLUX.3 responds first; his findings decide which variant
gets benched. Everything in this section is brainstorm until then.

- Fabio hand test 1 (2026-10-26, FLUX.3 edit, whole 1K picture, no mask): one Box `man` = "A man With
  grey hair" round the yellow doodle, prompt "Replace the yellow doodle with <man> keeping the pose of
  the doodle." WORKED: grey-haired man in a suit at the door, arms out as drawn, no doodle left, floor
  and light continuous (no stitch, so no seam). BUT the whole picture was re-rendered: the carpet
  pattern beside the woman changed (Fabio, comparing with the clean original).
- Fabio hand test 2 (same box + prompt, plus a rectangular mask over the doorway region, its right
  edge crossing her arm, bottom edge on the carpet): only the masked area changed, carpet elsewhere
  intact, the man added. Pose NOT followed as well: arms down, not out as drawn. Open: why the masked
  route weakens the pose (my re-noise guess was WRONG, see test 3); whether
  the mask's edges show (on the carpet, and where it crosses her arm). Ideas: mask = the doodle's
  padded box only (edges away from other people), the drawn-on picture also fed as reference 2 to
  carry the pose.
- Fabio hand test 3 (masked again, a follow-up generation, same prompt): the pose IS followed (arm
  out as drawn). So the mask route can hold the pose; it varies run to run. Fabio's read: the prompt
  is the lever. Next: a BFL-shaped prompt that names the pose the doodle shows, over several seeds,
  to make it reliable. Masked FLUX.3 edit + a better prompt is the lead route.
- Fabio hand test 4: "removing the colour of the doodle also worked" (read as: the prompt no longer
  names the doodle's colour, "Replace the doodle with <man> ..."; to confirm). Good for the Flow: the
  generated prompt need not know what colour the user painted with.

To settle in the bench: (a) the window edge on big photos is a stitch line, but far from the subject
and with nothing asked to change there; MpiGradeBack then a feather should hold it. (b) Everything
in the window is re-rendered, other people included (her face, here). Idea to test: return only what
CHANGED (diff of output vs input after MpiGradeBack, grown and feathered), so the shadow comes back
wherever it falls and untouched people stay bit-exact. (c) Window size could follow the quality tier
(1k/2k/4k) so a slow GPU can pick speed; warn, never cap. (d) Does the drawn pose survive: send the
drawn-on picture as the edit image, the box as the place. (e) Prompt in BFL's shape.

**GPU: not before the MOSS umbrella's last card is finished** (Fabio, 2026-10-26: it has precedence
and needs the GPU). Until then only no-GPU work: read the graph, measure Fabio's re-run once it exists.

## 2. Model bench (Klein 9B is the baseline)

- **FLUX.3 Klein**: MPI-1212 round 1 ran Draw It In with Klein's wording only (dii1 squirrel: Klein
  won, FLUX.3 drew a small grey squirrel; dii2 cap: tie). Its BFL-prompt round (`bfl.py`) did not
  include Draw It In. Redo with prompts written to BFL's i2i rules (`docs/models/flux3/README.md`
  § prompt upsampler; MPI-1212 `research/bfl.py` for the shape), and try the grade fix on its output.
- **Qwen-Image 2.1**: never tried on Draw It In. Note its licence is research/evaluation only, and
  replacing Qwen where FLUX.3 holds is a goal of its own (MPI-1212); a Qwen win still needs Fabio's
  call before it becomes a slot.
- Inputs: MPI-1212's dii1/dii2 cases plus Fabio's seam run. Bench harness: MPI-1212
  `research/flowbench` (local port 48188 under the lease).

## Follow-up after Draw It In: Object Stamp (Fabio, 2026-10-26)

Object Stamp (`flow_object_stamp.json`, same Klein crop/ColorMatch/stitch shape as Draw It In) does
a poor job with shadows. Once Draw It In is done, carry its seam/grade fix over, and try moving Object
Stamp onto FLUX.3 using the Boxes system (`docs/models/flux3/README.md` § Boxes: on edit an added
object lands in its box), with BFL-shaped prompts. Same rules: bench on the GPU only after the MOSS
umbrella's last card is done, no wiring until 2.1.3 ships.

## Done means

Seam gone on Fabio's run and on the vintage plate (measured and his look); a verdict per model on
`validation.md`; winners wired after 2.1.3 ships, still dev-gated with the LTX 2.5 release.
