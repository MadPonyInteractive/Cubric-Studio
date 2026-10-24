# MPI-1269 validation — Qwen-Image 2.1 control takes subject images

## What changed

- `comfy_workflows/raw/qwen_image_2_1.json` + runtime: node 148 `Text Encode (control subjects)`,
  a clone of the prompt-only encoder (36) that reads Reference 2/3 (`Input_Image_2/_3`) as its
  `image_1/_2` and feeds `KSampler (control)` (112). No other node moved (pos/size asserted).
- `models.js`: `qwen-image-2-1` declares `depthSubject` + `depthSubject3`.
- `commandRegistry.js`: `controlSubjectParagraph()` adds the subject line to the control guide for
  every model with the slot (also fixes Krea2 and Qwen Edit, which had the slot and no word of it).

## Evidence

- `node scripts/validate-injection-rules.mjs comfy_workflows/qwen_image_2_1.json` — conforms.
- `npm run lint` exit 0; `npm test` 3567 pass, 0 fail, 2 skipped. New test:
  `tests/op-strip-availability.test.cjs` "control subject slots and their guide line follow
  capabilities.depthSubject".
- G: bench (:8188, ComfyUI 0.42.1), pose control, seed 1269, Fabio's go 2026-10-24:
  - pose picture + subject portrait (`mpi1033_sheriff_portrait.png`) on the NEW graph: the man from
    the portrait (face, moustache, canvas jacket) comes out in the pose picture's arms-raised pose.
    121 s cold.
  - pose picture alone, same seed and prompt, OLD graph (HEAD) vs NEW graph: **pixel-identical**
    (max abs difference 0 over 1344x768 RGBA). The one-image control path is unchanged.
- Images not committed: the pose source is a frame of a third-party clip, and the board is public.
