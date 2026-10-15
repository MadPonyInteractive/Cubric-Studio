# MPI-1146 Checklist

- [x] `POST /comfy/import-model` takes `subfolder` (one plain folder name, created if missing; `..`, `/`, `\` refused)
- [x] `MpiFolderDrop` sends `subfolder` and shows it in the folder label
- [x] `MpiModelSettings` maps `model.type` to the shipped LoRA folder (`_LORA_FOLDER_BY_TYPE`, fallback = type) for the LoRA drop zones only
- [x] `tests/import-model-subfolder.test.cjs` passes; `extra-model-folders.test.cjs` still passes; eslint clean
- [x] `docs/models-path.md` + `docs/releases/UNRELEASED.md`
- [ ] Fabio: drop a LoRA on the Krea 2 LoRA & Upscale drop zone; it lands in `loras\krea-2` and shows under that folder in the slot picker
