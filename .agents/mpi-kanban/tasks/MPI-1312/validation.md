# MPI-1312 validation

- Cause: the `@` picker arms only on slots carrying a `tag`, and only the reference-video ops
  (`ref2v`, `ref2v_ms`) had one. Every image op taking 2+ pictures (`edit`, `kleinEdit`,
  `krea2Edit`, `qwenEdit`, `control`) had none, so 24 model ops never offered `@`.
- Fix: those slots carry `tag: 'Image n'` + `tagInProse`; `refTagHandle` writes `image 2`, or
  `<image2>` on Qwen-Image 2.1 (`capabilities.qwenRefTags`, the vendor PE-I2I form).
- `tests/ref-tag-picker.test.cjs`: 13/13, incl. a guard listing any model op with 2+ untagged
  reference slots (start/end frames excluded).
- `tests/desktop/prompt-box-edit-ref-picker.spec.js`: 1/1 on an isolated app (port 53446) —
  Qwen-Image 2.1 writes `<image2>`, FLUX.3 and Klein 9B write `image 2`.
- `npm run lint` clean; `npm test` 3768 pass, 0 fail.
- Playbook: add-model README checklist + `04-ops-and-controls.md` checklist.
