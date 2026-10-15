# MPI-1146 Validation

- `tests/import-model-subfolder.test.cjs` passes: file lands in `loras/krea-2/`, created on the fly; `..`, `.`, `../escape`, `a/b`, `a\b` refused with 400; empty subfolder = root. `extra-model-folders.test.cjs` still passes; eslint clean. Shipped in `1db5015cc`.
- Fabio, live app 2026-10-15: Krea 2 Model Settings shows both drop zones as `G:\CubricModels\loras\krea-2` and `C:\AI\loras\krea-2`; a drop on the `C:\AI\loras` zone created `krea-2` there and the LoRA showed up under it in the slot picker.
- Extra (user-added) folders get the model subfolder too. Fabio confirmed that is wanted: the folder name is the app's, and the label shows the exact path before the drop.
