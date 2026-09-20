# MPI-835 validation

## Root cause

A brushed GIF frame stores a `composed` mask, exported from the canvas by
`MaskManager.getURL('black', 'white')`. That overload is BINARY: any alpha above 0 becomes
full white (image mode's inpaint contract). A GIF frame's base layer is the engine mask, whose
soft falloff is the edge, and `routes/gifCutout.js` `applyMaskAlpha()` reads luma as alpha and
keeps it. So the first brush stroke on a frame swapped that frame's soft track for a binarised
composite: the whole mask grew by the feather width, in the tint AND in the real cut, while
untouched frames stayed soft.

## Evidence

- **Fabio's real run** (engine `temp/ComfyUI_temp_jcktx_00062_.png`, 1536x640, BiRefNet):
  10,951 px sit between luma 1 and 127 (5,553 of them under 16). Keep area at `>= 128` is
  335,636 px; at `> 0` it is 346,587 px - 3.3% growth, all of it on the outline. Only 38,800 px
  are a full 255, so the mask is soft nearly everywhere.
- **Red on the pre-fix export, green on the fix**: `tests/desktop/gif-cutout.spec.js` "a brushed
  frame exports the engine soft edge as coverage". With the soft branch neutralised it fails
  `x=8: 255 vs 200` - the halo, one pixel at a time. With the fix: passes, plus the painted and
  erased fixes land (255 / 0), the playing tint is the exact complement, and the binary overload
  still returns 255 across the ramp (image mode untouched).
- `node --test` gif-frame-masks / mask-adjust / mask-tool-registry: 56 pass. ESLint on the
  touched folders: clean.

## Call-site sweep of `getURL(bg, fg)`

| Call site | Kind | Change |
|---|---|---|
| `MpiGifViewer._saveEdit` | GIF composite sent to the cut | soft |
| `MpiGifViewer._recompose` (headless, after a re-track) | same composite, second producer | soft |
| `MpiGifViewer._hideEditCanvas` (playing tint under the flip) | display of the same mask | soft |
| `MpiCanvasViewer` x2 + its `_buildCompositeFromTemp` twin | image inpaint mask, binary by contract | untouched |

## Not mine, seen while testing

`gif-cutout.spec.js:446` ("real Track dispatch + real Cut-out round trip") fails on this box at
line 724 (Cut out lands no history entry) WITH AND WITHOUT this change - proven by neutralising
the fix and re-running. CI is green on it at the parent commit, so it is local to this machine
or to a long `--output` path. Not chased here.

## What a user has to know

Masks live in renderer memory. Picking the fix up means a reload, and a reload drops the
session's masks - frames brushed BEFORE the fix keep their binarised composite until then.
