# MPI-1065 Validation

## 2026-10-10/11, session 9bbf1e2f

- Unit: tests/model-update-check.test.cjs, 10/10. Real ModelDefs: LTX High installed + the
  Ingredients LoRA added to both tiers names only "LTX 2.3 High"; Qwen 2.1 missing its new VAE
  names only "Qwen-Image 2.1" (never the Boogu tiers that share its 8.7GB encoder); under 1 GB
  own on disk, fully installed, never touched, and custom nodes never qualify.
- npm test: 3050 pass, 0 fail. eslint clean on the 5 touched files.
- Live, own app:isolated (profile in scratchpad, idle engine, no generation): faked Qwen 2.1's
  Texture-Fix VAE missing in the page's dep cache, emitted models:checked. Toast:
  "Qwen-Image 2.1 (676MB) is missing files from an update, so it is hidden from the model
  pickers. Open Models and press Install to get it back." + OPEN MODELS button. A second
  models:checked added no second toast. The button emitted models:open once, the Model Library
  opened, the toast closed.
- Found live and fixed: the first cut named both Boogu Image Edit tiers (20.9GB, 11.7GB), never
  installed here: once Qwen read unusable, nothing owned the shared encoder. Now only weights no
  other model uses prove an install. Also the tier now shows only when two cards share a name
  (it read "Qwen-Image 2.1 Balanced").
- Fabio 2026-10-11: "The wording is fine". CI run 38093896385 on 246106ac2: success.
