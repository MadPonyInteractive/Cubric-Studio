# MPI-1013 validation

## Change
- Tile label beside the Gen speed bar: `Gen speed` -> RunPod's measured seconds per image,
  one decimal (`2.3 s/img`). Bar kept. Overlay note says lower is faster.

## Checks
- `node --test tests/gpu-picker.test.cjs`: 8/8 pass.
- `npx eslint js/components/Compounds/MpiGpuPicker/MpiGpuPicker.js`: clean.
- Rendered the real `MpiGpuPicker` + `styles.css` from a scratch static server (no app, no
  engine): RTX 5090 reads 2.3 s/img, RTX PRO 4500 3.4 s/img, 4090 3.8, H100 SXM and PRO 6000
  1.5 each, RTX 2000 Ada 13.2; L4 (unbenchmarked) shows no bar and no number. Label fits the
  tile at the old label's width.

## Eye test
- Waiting on Fabio in his app.
