# MPI-1077 validation

- `tests/desktop/lora-rack-settings-button.spec.js` (new): button shown with LoRAs set (sdxl-realistic) and with none (krea2), click emits `settings` with the model id, flat `LORAS` label gone; hidden for `showSettings: false` (nvidia-pid) and a cloud model. Pass, 2026-10-11.
- Regression: `model-settings-popup.spec.js`, `flow-lora-button.spec.js`, `node --test tests/lora-bypass-inject.test.cjs tests/flow-lora-rack.test.cjs` pass; eslint clean on the four touched JS files.
- Remaining: Fabio's eye test of the button in the cog popup (look and placement).
