# MPI-1066 Checklist

- [x] Find the cause: the 2-px checker is in every Qwen 2.1 output (t2i too), Siax amplifies it
- [ ] Fabio OKs the Texture-Fix-VAE download (free, research licence like 2.1 itself)
- [ ] A/B on the bench under the GPU lease: stock VAE vs Texture-Fix VAE on the same latents; alpha still works
- [ ] Fabio's eye on the side-by-side
- [ ] Ship: swap the 2.1 VAE dep (licence gate unchanged) and/or a cleaner defaultUpscale; tests
