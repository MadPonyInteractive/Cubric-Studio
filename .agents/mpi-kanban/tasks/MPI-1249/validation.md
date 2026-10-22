# MPI-1249 validation

## 2026-10-22 (Moss image 8), Fabio in his app
- Enhancer style rule: Anime picked -> "A vibrant anime-style illustration depicts..." (no "photograph"). Verified.
- Anime + Gouache render clearly in style on BOTH Turbo and SFT (superhero prompt, 4 cards). Fabio: Turbo looks better for both ("SFT tries too hard"); Turbo 9-10 s vs SFT 28-29 s. Guide: recommend Turbo for these two, opposite of the LoRA authors (SFT-only tests).
- Still to check: Psychedelic Pop, Pixel Art.

## 2026-10-22 (Moss image 9)
- Psychedelic Pop + Pixel Art: Fabio's Turbo renders in project "Moss styles" are in style (Pixel Art as a full 896x1088 scene). All four styles verified.
- Picker previews: 5 WebP 512x640 in comfy_workflows/display/, styleLoraImages on the ModelDef; tests/style-rack-shape.test.cjs passes (every listed file on disk). 7ff572483.
- R2: all four LoRAs at cubric-models/vision/models/loras/moss/, rclone lsl byte-exact (74379584 x3, 148697280). Fabio's yes.
- SFT A/B (research/sftbench.py, shipped graph on G: :8188, leased): 50 steps == 25 steps at cfg 3 + skip; euler rejected by Fabio on Turbo; er_sde + cfg 3 + SLG single 22 0-0.5 shipped. Baked SFT == bench erslg pixel-exact; baked Turbo == pre-1249 Turbo pixel-exact (research/shippedsmoke.py). f87f85d33 + f1a5de626.
- Cosmo: "using moss image" searched the project for a moss picture (Fabio, twice). Model-rule clause "with/using/on a name = model or Flow; unknown -> list_models" (b9ed5143c). Fabio retested after restart: Cosmo picked MOSS-Image on Turbo. PASS.
- MOSS guide: "Better quality is turbo: false" replaced by Turbo-by-default (dbf20f20d).
- npm test 3521/0 and lint green on every commit; pre-push green on each push.
