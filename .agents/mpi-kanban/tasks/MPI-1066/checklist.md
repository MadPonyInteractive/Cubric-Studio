# MPI-1066 Checklist

- [x] Find the cause: the 2-px checker is in every Qwen 2.1 output (t2i too), Siax amplifies it
- [x] Fabio OKs the Texture-Fix-VAE download (free, research licence like 2.1 itself)
- [x] A/B on the bench under the GPU lease: stock VAE vs Texture-Fix VAE on the same latents; alpha still works
- [x] Fabio's eye on the side-by-side (2026-10-10: "the fix actually works. No more cross-hatch")
- [x] Ship: swap the 2.1 VAE dep (licence gate unchanged) and/or a cleaner defaultUpscale; tests
- [x] assetDeps.js: new 'vae-qwen-image-21-texturefix' (HF, sha256 = HF LFS oid); stock entry kept, DEPRECATED
- [x] Graphs: raw qwen_image_2_1 + both Character Sheet Flows switched, synced (raw 6700de2d0 local), verify-workflow clean on Fabio's engine
- [x] Docs (qwen-image-2 README) + UNRELEASED.md line; decoder copied into G:/CubricModels/vae (sha verified)
- [x] models.js qwen-image-2-1 dependencies: vae-qwen-image-21 -> vae-qwen-image-21-texturefix (peer MPI-1060 holds the claim, message sent)
- [x] npm test, commit, push, CI green, close
