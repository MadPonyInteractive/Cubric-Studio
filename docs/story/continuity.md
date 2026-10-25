# Continuity — the Continue step (DESIGN)

> Part of [README.md](README.md). This is the core of **Infinite Video**.

## The idea (Fabio, 2026-10-13)

A model that cannot do 20 s still can, shot by shot: end each shot on a good **stopping point**
— a close-up, characters looking at each other, a held beat — then continue the idea with a
new prompt. Sometimes from the last frame, sometimes from nothing but the references: let the
character finish the close-up, then start the next shot fresh.

## One app step, every driver uses it

`continue(previousShot, nextShot) → take card`. The Storyboard, Cosmo, MCP and the Infinite
Video Flow all call the same route. Nothing chains clips its own way.

## Join modes (a shot's `join` field)

| Mode | When | Mechanism |
|---|---|---|
| `extend` | Continuous action that must not cut | Extend Video (MPI-591): latent path for our own output (full quality per link), pixel path for an imported clip |
| `bridge` | A continuous run longer than one generation (Fabio, 2026-10-25) | Roots generated first (same seed + duration + start ref), then this shot fills the gap from BOTH neighbours' motion latents — no drift. Short fixed prompt, extra length. Engine support unverified: `.agents/mpi-kanban/tasks/MPI-1134/research/obvpm-bridging.md` |
| `lastFrame` | Same moment, new prompt / new camera move | Previous take's last frame as the start frame (i2v / fl2va) |
| `newShot` | A new angle or beat in the same scene | References only (Element picks + optionally a captured frame) on H3 Reference |
| `cut` | New scene / location | Nothing carried over except the Elements |

Default is `newShot`/`cut`: short shots joined by cuts. `extend` only for continuous action.

## Choosing the stopping point

- Planned, not measured: when the shots are written, each shot's `stateAfter` says how it
  ends, and shot boundaries are placed on natural holds (close-up, a look, a beat of silence).
- The next shot's prompt is written FROM the previous `stateAfter` (who is where, facing what,
  mid-what action).
- A planner needs each model's limits to place boundaries — see Model limits below.

## Model limits the planner reads

Per model/op: max seconds, ref slots (images / videos / audio), start frame yes/no, extend
yes/no, latent continue yes/no. Check what `describe_model` already exposes before adding a
field. Calliope hard-coded an 8 s cap for every model; we read the real limit.

## Low-res chain, upscale at the end (from MPI-591 plan D4/D5)

Chain every link at one resolution with latents saved, upscale the finished latents once
through the windowed refine (`MpiWindowedSampler`, MPI-699). A resolution change mid-chain is
refused by `context_latent`; an upscale after the chain is not. This is the draft pass in
[shot-pipeline.md](shot-pipeline.md), with H3 Reference's framing caveat.
