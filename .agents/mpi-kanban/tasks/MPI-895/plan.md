# MPI-895 Plan - Upscale and refine evaluation

> **Umbrella created by `/mpi-project-refresh` on 2026-09-22 (MPI-893).** These cards were
> already on the board and stay there; this card is the shared context and the running
> order, not a replacement. Nothing here has been re-scoped - read each member's own card
> before touching its files.

## Members

| Card | Title | State |
|---|---|---|
| MPI-707 | De-RoPE temporal super-resolution as an optional final pass (H3, later LTX 2.5 / WAN 2.2) | `todo` / `deferred` |
| ~~MPI-578~~ | LTX 2.5 upscaler - MOVED to MPI-1179 (New Models to Test), 2026-10-18 | - |
| MPI-477 | H3 refiner: the PIXEL-space route, after latent upscaling was disproven | `todo` / `research` |
| ~~MPI-478~~ | --lowvram on the local engine - DECLINED by Fabio 2026-10-18 (disproven, inert) | - |
| ~~MPI-343~~ | Model upgrade evaluation queue - MERGED into MPI-1179 (New Models to Test), 2026-10-18; PiD 1.5 is MPI-1185 | - |
| ~~MPI-688~~ | Video Upscale: add H3 alongside LTX - MERGED into MPI-578 (Upscale Video Flow, LTX 2.5 + H3), Fabio 2026-10-29 | - |

## Why these belong together

Five cards, one question: **what actually improves a finished frame, and is it worth the
seconds?** Today each would be benchmarked on its own, against the same models, on the same
GPU, with its own ad-hoc timing - and the answers would not be comparable, which is the
whole point of asking.

MPI-477 exists because latent upscaling was already DISPROVEN for the H3 refiner. That is
the shape of this umbrella: most members will end in evidence and a `rejected`, not in code.
Treat a negative result as the deliverable.

## Phases

1. **Build the comparison harness first.** One prompt set, one seed set, one GPU, one
   end-to-end timing method. **Verify:** two runs of the SAME config land within noise -
   until that holds, nothing measured after it means anything.
2. **Measure the four candidates against it** (the Parallel Batch below).
3. **Write the verdicts down on each member card.** (MPI-343, the old verdict queue, merged
   into MPI-1179 on 2026-10-18; new-model benches such as PiD 1.5 and LTX 2.5 live there now.)

## Parallel Batch

After phase 1. Each owns its own evidence file under its card folder; none writes app code
in this batch.

- **MPI-707** - De-RoPE temporal super-resolution as an optional final pass.
- **MPI-477** - the H3 PIXEL-space refiner route.
- **MPI-478** - whether the local engine's `--lowvram` still costs anything (inert today).

## The one BUILD member: MPI-688 (MERGED into MPI-578, 2026-10-29)

MPI-688 is not an evaluation - it adds H3 to the shipped Upscale Video Flow (`ltx-upscale`,
MPI-584) with H3's own latent upscaler (`MinimaxH3LatentUpscaler3D`) in the upsampler slot. It
does not wait for the harness; it follows `docs/playbooks/add-flow/` and its own brief. Its
output is a finished-frame route, so once it ships it is one more row the harness measures.
Ownership: `comfy_workflows/ltx_video_upscale.json`, the `ltx-upscale` entry in
`js/data/flowsRegistry.js`, plus the H3 flows sweep its card describes.

## Traps already known

- **Quote END-TO-END time, never the sampler's.** `tool_benchmark_comfy_graph_changes.md`
  lists five ways a graph benchmark lies.
- A change ARRIVING in the graph is not the same as it TAKING EFFECT - diff the dispatched
  graph from Comfy `/history`.
- Any shell command that actually executes a generation takes the **GPU lease**
  (`gpu_command_patterns` in `.agents/mpi-kanban.local.md`). The lease is machine-global.
- Never cap the work to fit one card - the user's GPU is the limit, and a warning is the
  obligation.
