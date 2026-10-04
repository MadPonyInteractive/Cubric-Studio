# MPI-801 checklist

2.0 scope (Fabio 2026-10-02: "an eyedropper on the scribble flow", asked before 2.0):

- [x] Flows' paint step (`MpiStepPaint`, Scribble + Draw It In): `MpiColorField` (swatch + Pick on
  the native EyeDropper) replaces the bare `MpiColorPicker`
- [x] Test, eslint, desktop spec
- [x] Fabio's look in the app: Pick in Scribble's "Draw it" step samples a colour into the brush
  (PASSED 2026-10-04, his pre-cut smoke; CI green on `df16648ad`)

Not in 2.0 unless Fabio adds it: hold-Alt pick on the History Paint tools and the Flow canvas
(the original 2026-09-17 ask, `brief.md` scope 1 and the Alt half of scope 2).
