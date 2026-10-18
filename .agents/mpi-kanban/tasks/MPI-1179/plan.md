# MPI-1179 plan - New Models to Test

Umbrella, Fabio 2026-10-18. The one home for every new model we want to test or integrate.
**It is a menu, not a sequence:** no phases, no running order. Each model has its own member
card (or a few, when one model needs more than one job); pick any row whose blocker is clear.

## How to use it (Fabio, 2026-10-18)

1. **Pick up:** move MPI-1179 `todo -> doing` and ask the agent "which models are under
   MPI-1179?". It reads the menu below and answers row by row: model, card, state, blocker.
2. **Choose one model.** Work happens on that model's member card (move IT to `doing`, claim
   its files), never on this card.
3. **Finish:** when the model is integrated (or rejected with findings), close its member
   card(s), remove the row, and move MPI-1179 back to `todo`.
4. **Never close or archive MPI-1179.** It is permanent. A new model found anywhere gets a
   member card and a row here.

**Umbrella rule:** every new-model card's `description` starts with
`UMBRELLA: MPI-1179 - New Models to Test. Menu: tasks/MPI-1179/plan.md.` and has a row below.
A member that passes its bench becomes the wiring job (`/mpi-add-model` or `/mpi-add-flow`) on
the same card or a new member card; one that fails closes with its findings.

## The menu

| Model | Card(s) | Kind | Blocked on |
|---|---|---|---|
| LTX 2.5 | MPI-1095 Land LTX 2.5 in the app (models, LoRA parity, the LTX Flows follow) | integrate | Nothing known: confirm 2.5 loads on the shipped engine first |
| LTX 2.5 upscalers + DiffVAE | MPI-578 Adopt the 2.5 latent upscalers | integrate | MPI-1095 (and the engine, if 2.5 needs a newer one) |
| Singularity H3 | MPI-1135 Base model swap, its upscalers, Story draft resolution | test | Nothing. Story (MPI-1134) waits on it |
| H3 w4a8_mixed DiTs | MPI-518 Is there a real win, and where do they land? | test | GPU time |
| MOSS-Image | MPI-1180 Bench MOSS-Image (5B text-to-image) | test | ComfyUI v0.42.0 |
| FLUX.3 Klein | MPI-1181 One card, Turbo button (distilled int8 / base int8), dev-gated | test | Engine on >= v0.41.0 |
| Fish Audio Drama 3 | MPI-1182 int8 experts in RAM, ComfyUI-Drama3 pack | test | Engine on >= v0.40; ~48 GB system RAM |
| InfiniSplat v2 | MPI-1183 Multi-view feed-forward splat on a 3D Scene path video | test | After 2.1 |
| ATAS on MiniMax-H3 | MPI-1184 World memory across shots; spike before any adapter | scope | Parked; the spike needs Fabio's yes on ~$1.50 |
| PiD 1.5 | MPI-1185 Newer nvidia-pid upscaler: REPLACE, ADD or DROP | test | Nothing known |
| NSFW LTX 2.3 | MPI-1186 CivitAI 10Eros + int8 conv-rot + DMD: licence first | test | Licence check; may be moot once LTX 2.5 lands |

## Notes per model (only what the member card does not say)

- **LTX 2.5:** MPI-1095 is the main card; MPI-578 is only its upscalers and the new VAE. Video
  Edit's LTX option (MPI-1061, umbrella MPI-1063) waits on MPI-1095. MPI-578 was moved here
  from the Upscale and refine umbrella (MPI-895) on 2026-10-18.
- **Engine bump timing (Fabio, 2026-10-18):** MOSS-Image, FLUX.3 Klein and Drama 3 all clear on
  one ComfyUI v0.42.0 bump. Do that bump BEFORE 2.1's full Pod smoke (MPI-1044) if v0.42.0 is out
  by then, so one bump and one smoke cover 2.1 and 2.2 brings the models with no second bump.
- **FLUX.3 Klein:** dev-gated, not a 2.1 item (Fabio, 2026-10-18).
- **InfiniSplat v2 vs ATAS:** both are candidates for the 3D Scene lift-back MPI-623 dropped;
  weigh one against the other before picking either. Both have non-commercial weights.
- **PiD 1.5, NSFW LTX 2.3, H3 w4a8:** came from MPI-343 (Model upgrade evaluation queue), merged
  here on 2026-10-18. Its `plan.md` keeps the shared evaluation method for "is this newer build
  worth shipping": licence first, measure (n=1 is not a measurement), REPLACE vs ADD explicit,
  never delete a dep entry.

## Related, not members

Feature or Flow work that USES a model we already ship, so it lives with its feature:
MPI-745 (LTX 2.3 BFS head swap IC-LoRA, solo by Fabio 2026-09-14), MPI-1061 (LTX 2.3 in Video
Edit), MPI-707 (De-RoPE, a technique), MPI-860 (MiniMax cloud via BYO key, an API),
MPI-1040 (decision LLMs via DeepInfra), MPI-775 (YuE2 song model brainstorm, under the Mix and
audio umbrella MPI-986).
