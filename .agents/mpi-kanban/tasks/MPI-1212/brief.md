# MPI-1212 - FLUX.3 Klein in the Flows

Fabio, 2026-10-20 (closing MPI-1181): "integrating Flux into flows to check if Flux 3 can do the
same or a better job than Qwen Image 2.1 and Flux 2 9B."

## Goal

For each Flow that runs Klein 9B or Qwen-Image 2.1 today, bench FLUX.3 Klein (`flux3-klein`, edit
takes up to 10 references) against the current model on the Flow's own job. Where FLUX.3 wins,
add it to the Flow's `requiredModels` rack (or make it the default); where it loses, record why.

## Flows in scope (`js/data/flowsRegistry.js`, `requiredModels`)

- Klein 9B: scribble-object, scribble (rack: klein-9b, klein-4b, klein-9b-cloud, nano-banana-2-lite),
  outpaint, make-seamless, object-stamp, character-sheet-editor (clothes/condition/custom/age slot)
- Qwen-Image 2.1: character-sheet-from-images, character-sheet-editor (body/hair/... slot)

## Known going in (MPI-1181)

- FLUX.3 licence: FLUX Kommunity v1.0. Under US$5M gross a year (with affiliates) a user may run
  it in production AND sell the images (§1.e, §2.a.ii); above that, a paid BFL licence
  (corrected by Fabio 2026-10-20; `licences.js` FLUX_KOMMUNITY). Klein 9B (FLUX Non-Commercial
  v2.1) is the reverse shape: model use non-commercial, outputs commercial for everyone (§2.d).
  Qwen-Image 2.1 is research/evaluation only. Licence does NOT decide the default; the bench does.
- Turbo off (base, 50 steps) for photoreal people; Turbo ~4x faster, plastic skin.
- Edit keeps reference 1's frame unless Custom size is on.
- Box-edit relationships (who does what to whom) are the model's limit, not fixable by prompt.
- Bench evidence and scripts: `.agents/mpi-kanban/tasks/MPI-1181/research/`.

## Rules

- GPU benches only with Fabio's go, under `gpu_lease.py run --poll 2`, never beside his app.
- A Flow is wired per `/mpi-add-flow` playbook; a rack change touches the Flow's workflow inject map.

## Noticed
