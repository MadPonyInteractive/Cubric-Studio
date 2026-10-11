# MPI-1077 validation

- `tests/desktop/lora-rack-settings-button.spec.js` (new): button shown with LoRAs set (sdxl-realistic) and with none (krea2), click emits `settings` with the model id, flat `LORAS` label gone; hidden for `showSettings: false` (nvidia-pid) and a cloud model. Pass, 2026-10-11.
- Regression: `model-settings-popup.spec.js`, `flow-lora-button.spec.js`, `node --test tests/lora-bypass-inject.test.cjs tests/flow-lora-rack.test.cjs` pass; eslint clean on the four touched JS files.
- CI: Tests run 38123928635 on 045cc307c green.
- Eye test: Fabio, 2026-10-11, "looks good" (button in the cog popup, Qwen-Image 2.1).
