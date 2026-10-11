# MPI-1095 - Land LTX 2.5 in the app

## Fabio's scope (2026-10-11)

Research first, then tests, then a plan. Three rules:

1. **Capability parity.** Check that LTX 2.5 can do everything we ship on LTX 2.3.
2. **LoRA parity.** Check that every LTX 2.3 LoRA we ship has a matching 2.5 LoRA, or that the 2.3 one loads on 2.5.
3. **One base workflow.** Build the 2.5 base workflow FROM the existing 2.3 workflow
   (`comfy_workflows/raw/ltx_i2v_t2v_template.json`): re-point its loaders and change only what 2.5 forces.
   Never author a new workflow from scratch. MPI-1060 built the `ref2v_ms` path so that 2.5 is a loader re-point.

Replace 2.3 or sit beside it stays open until the research answers 1 and 2.

## What 2.3 ships today (the parity checklist, inventoried 2026-10-11)

Models (`js/data/modelConstants/models.js`): two LTX 2.3 cards (balanced bf16 / fast int8), ops `t2v_ms`,
`i2v_ms` (start / end / both frames), `ref2v_ms` (Ingredients), all on ONE graph per card
(`ltx_i2v_t2v.json`, `ltx_i2v_t2v_int8.json`). Synchronized audio, reference-voice and direct-audio modes.
Six user LoRA slots (`Input_Lora_1..6`, model + clip strength).

Weights (`js/data/modelConstants/modelDeps.js`, `assetDeps.js`): transformer bf16 / fp8 / mxfp8, video VAE,
audio VAE, TAEHV preview decoder, text projection, Gemma text encoder, spatial upscaler.

Baked LoRAs (`js/data/modelConstants/loraDeps.js`):
- `ltx23-lora-merged` - Soft + Abliterated + Detailer merge
- `ltx23-lora-transition` - i2v motion / lipsync enabler
- `ltx23-lora-talkvid` - ID LoRA TalkVid-3K (voice ID)
- `ltx23-lora-foley` - Foley V2A (video to audio)
- `ltx23-lora-ingredients` - Ingredients IC-LoRA (reference to video; Lightricks say it also runs on 2.5)

Flows on LTX (`js/data/flowsRegistry.js`): Extend Video (`ltx-extend`), Add Foley (`ltx-foley`), Upscale Video
(`ltx-upscale`, `ltx_video_upscale.json`). Raw-only: `ltx_v2v_lipdub_template.json` (no app caller found).

Waiting on this card: the Video Edit LTX option (MPI-1061 / MPI-1063). Related: MPI-578 (2.5 latent upscalers +
the new DiffVAE, which may fix 2.3's VAE "swim"), MPI-707, MPI-745 (BFS head swap IC-LoRA, 2.3).

## Research questions

- Does 2.5 load on the shipped engine (ComfyUI v0.39.0)? MPI-578's blocker was an older ComfyUI.
- Per op above: does 2.5 do it, through the same nodes? Audio included (2.5 ships its own audio VAE).
- Per baked LoRA above: a 2.5 build exists? If not, does the 2.3 file load on 2.5 and still work?
- Weights: sizes, licence (gated on HF), and which quant tiers exist for the fast card.

## Tests (on the G: bench before any app work)

Same prompts, seeds and inputs as the 2.3 cards, op by op, 2.3 vs 2.5 side by side for Fabio's eye. The bench
needs the right ComfyUI: `/mpi-bump-local-comfy` for the bench, `/mpi-bump-engine` only when shipping.
