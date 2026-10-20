# MPI-1215 - Save the Hugging Face token encrypted

Fabio, 2026-10-21: "We can't be asking users to keep inserting a token... Can't we just save the token like we do with DeepInfra and RunPod?"

Reverses the MPI-357 "token used once, never stored" decision. The token is only proof of HF access (the weights come from our R2).

- `main/secretsStore.js`: `hfToken` slot, set/has/clear IPC, fork bridge get/set.
- `routes/licences.js`: no token in the request = use the saved one; a typed token that passes is saved.
- `MpiLicenceGate`: with a token saved the field is optional; a failure with the saved token shows the field to paste a replacement.
- Settings > External Connections: clear the saved token.
