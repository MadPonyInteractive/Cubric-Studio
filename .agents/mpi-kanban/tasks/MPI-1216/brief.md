# MPI-1216 - FLUX.3 edit keeps picture 1's exact size; masked box edits (decision)

Found 2026-10-21 by Fabio on the first RunPod run of FLUX.3 (MPI-1181, closed). Project
`C:/Users/Fabio/Documents/Cubric Studio/Projects/Flux 3 tests`: t2i_006 768x1376 -> edit_032
752x1360 -> edit_033 752x1376 (aspect changed). The Pod itself is PROVEN: t2i + two edits ran.

## 1. Edit size - APPROVED by Fabio ("If the model supports 4K, why a 1 MP reduction anyway")

Cause: with Custom size OFF the edit's latent is `MpiFlux3References` output 2 (core
`ReferenceMultiLatent`, `resolution: resize`, `megapixels: 1`) = reference 1 scaled to exactly
1 MP, each side floored to /16 separately. 768x1376 (1.057 MP) shrinks to 752x1360; 752x1360
(1.023 MP) grows to 752x1376. Every edit of a picture not at exactly 1 MP moves and stretches.

Fix (no new node): `comfy_workflows/flux3_t2i.json` already has the Custom size path - node 703
`MpiIfElse` picks `700` EmptyFlux2LatentImage(Input_Width 324, Input_Height 325) when 798
(`Input_custom_size` AND NOT has_mask) is true, else `694` output 2. With custom size OFF, feed
that path picture 1's OWN size: snapped to /16 (aspect kept), capped at the model's 4K tier
area. References stay at 1 MP (that is how 2K/4K custom-size edits already work). Do it in the
GRAPH (GetImageSize on 474 Input_Image + MpiMath), not the app, so app, Cosmo, MCP and
routines all get it. The runtime graph is GENERATED from the raw (`generate_flux3.py`, see
MPI-1181 validation.md top) - edit the generator, never the runtime by hand. Mask path
(has_mask) unchanged: a mask keeps the source frame already.
Check: an edit of 768x1376 returns 768x1376; of 752x1360 returns 752x1360; a 5000 px photo
is capped at the 4K area. GPU runs on Fabio's local app need the GPU lease / his go.

Also seen: Cosmo's t2i with no size sent, settings panel shut, ran at the graph's baked
768x1376 (9:16). Unpinned resolveNamedParams has no project, so nothing resolves a ratio.
Not raised by Fabio as a bug; mention it, do not fix unasked.

## 2. Masked box edits - DECIDED NO (Fabio, 2026-10-21)

"You would be fighting the whole purpose of the model having boxes." Boxes stay layout text
for the model; "change only here" is Mask edit's job. Do not re-raise.

No FLUX.3 box edit has ever been masked (all 33 edits in that project checked): boxes are
prompt text only (`withLayoutBoxes`, js/data/generationControls.js), so the model redraws the
whole picture. Measured edit_032 -> edit_033: mean abs change 13 inside the box, 8 outside
(part of the outside is the 1.2% stretch from bug 1); mean red rose 128 -> 132 -> 135 over two
edits. Fabio saw "reddish" box areas in earlier previews; likely new content (tiger, mouse)
showing early, not a mask - unmeasured.
Question for Fabio: should an edit box ALSO act as a soft-edged mask so only the box area
changes? Cost: a masked box edit cannot change anything outside the box. Agent pick: yes.
The graph's mask path (SetLatentNoiseMask 653, has_mask 296) is the reuse point.

## Noticed
