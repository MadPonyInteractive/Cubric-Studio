# MPI-1349 checklist

- [x] One cap: `DURATION_MAX = 15` in `generationControls.js`; the slider's app range reads it
- [x] Cloud ranges clamped to min(provider max, 15)
- [x] Prompt reuse clamps to 15
- [x] A saved 20 s lands at 15 (mount clamp)
- [x] Tests updated; lint + test green
- [x] Isolated app: slider tops at 15 on H3 and a cloud video model
