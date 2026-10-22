# MPI-1249 — MOSS-Image style LoRAs

Fabio, 2026-10-22 (session "Moss image 7"): ship four community style LoRAs with MOSS-Image, Krea2 pattern
(`docs/playbooks/add-model/05-prompt-and-styles.md` §9). LoRAs with an unknown licence (the CivArchive ones) are
DROPPED for now: CivitAI is region-blocked from here, so their `allowCommercialUse` could not be read.

## The four LoRAs (all Apache-2.0, all Hugging Face)

Local copies: `M:/CubricModels/loras/moss/` (ComfyUI lists them as `moss/...`).

| Style | File | Source | Size | Trigger | Card's settings |
|---|---|---|---|---|---|
| Anime (seinen) | `MOSS-Image-Anime-LoRA-ComfyUI.safetensors` | huggingface.co/axiomofmind/Moss-image-anime-lora | 74.4 MB | `moss_seinen_style` OPTIONAL: author says better WITHOUT it, natural "anime character" wording | strength 1.0 |
| Gouache | `MOSS-Image-Gouache-LoRA-ComfyUI.safetensors` | huggingface.co/axiomofmind/Moss-image-gouache-lora | 74.4 MB | `moss_vgouache_style` at the START of the prompt | 1.0, SFT, cfg 3, 30 steps |
| Psychedelic pop | `MOSS-Image-Psychedelic-LoRA-ComfyUI.safetensors` | huggingface.co/axiomofmind/Moss-image-psychedelic-lora | 74.4 MB | `moss_psychpop_style` at the START | 1.0, SFT |
| Pixel art 16x16 | `MOSS-Image-PixelArt-16x16-ComfyUI.safetensors` | huggingface.co/Angais/MOSS-Image-PixelArt-16x16 | 148.7 MB | `pixel art 16x16 game icon, <object>, plain magenta background` | trained on Base, 512x512, 50 steps, cfg 3 |

- The three axiomofmind files are the authors' own `-ComfyUI` versions (`diffusion_model.` key prefix). Their root
  `pytorch_lora_weights.safetensors` uses Diffusers keys and loads NOTHING in ComfyUI.
- **Pixel art was re-keyed here**: the repo ships only bare `layers.N...` keys, and ComfyUI's MOSS map
  (`comfy/lora.py`, the `MOSSImage` branch) matches only `diffusion_model.` / `lora_unet_` keys. I rewrote the
  header with a `diffusion_model.` prefix (tensor bytes untouched, verified identical with ComfyUI's torch).
  The R2 copy must be THIS converted file, and its sha256 is of the converted file. Script:
  header-only rename, `prefix_lora.py` logic (8-byte padded header) — redo it if re-downloaded.
- **No CLIP side.** All four have 0 text-encoder keys (504 diffusion keys each), so model strength only, CLIP
  unconnected (`loraStrengths: ['model']` already). Same holds for every FLUX/Chroma/Qwen LoRA on M:.
- Also Apache-2.0 but NOT picked: bunnycore/MOSSArt (aggressive, 0.2-0.4). NC, never: quarterturn/moss_danbooru40k.

## State at handoff

- Fabio un-bypassed and wired the style-LoRA nodes himself and saved `comfy_workflows/raw/moss_t2i_template.json`
  (uncommitted; his ComfyUI save reformatted it, +16.5k lines). READ IT before touching anything: confirm the
  `Input_Style_Selector` triggers (one line per style, index-aligned) and the four slots point at `moss/...`.
- Nothing else done: no generate, no deps, no ModelDef change, no R2.

## To do

1. Read the raw; regenerate via `generate_moss.py` -> `comfy_workflows/moss_t2i.json`; check node count + the
   style selector survives the prune.
2. Deps in `modelDeps.js` (sha256 of the local files), R2 upload ~372 MB = **Fabio's yes first (money)**,
   `rclone lsl` byte-exact check.
3. ModelDef: `styleLoras: true`, `styleLoraLabels`, `styleLoraImages` (index-aligned, 4:5 WebP 512x640 in
   `comfy_workflows/display/`, named after the dep: `moss-style-anime.webp` ...), styleSelect control.
4. **Fabio makes the Styles-panel preview images in the app** himself (his words: "I need to create some images in
   the app for displaying the styles in action"). Agent crops/encodes what he hands over.
5. Guide `docs/agent/models/moss-image.md` + `docs/models/moss/README.md`: the styles, triggers, pixel art's
   magenta background and 512 size. Check whether the Enhancer recipe needs a line so it never strips a trigger.
6. Verify: lint, npm test, one render per style in `npm run app:isolated` (GPU lease), Fabio's eye.

## Noticed
