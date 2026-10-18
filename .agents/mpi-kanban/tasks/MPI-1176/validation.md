# MPI-1176 validation

## Problem

Fabio's Scribble run (project "New Cosmo tests", drawing `flowScribble_003`, a stick figure on a
bed with one knee up and one leg hanging off the edge) came back with both legs tangled on the
bed. The Flow already ran the MPI-746 Klein 9B config (lcm, 4 steps, cfg 1), so the sampler was
not the cause. Fabio ruled out steps (>4 overcooks) and asked for the prompt first.

## Bench (G:\ComfyUi, GPU lease held, lcm / 4 steps / cfg 1 untouched)

Same drawing, seeds 4051083280 (Fabio's), 111, 222. Shipped graph with only node 184 (Edit
Guardrails) and the user prompt varied:

| variant | change | result |
|---|---|---|
| A shipped | none | reproduced the bug: tangled hips/legs on seed 4051083280 |
| B pose | + stick-figure pose / natural-anatomy sentence | clean anatomy on all 3 seeds; leg still on the bed |
| C pose, softer guardrail | B minus "render every stroke" | worse: a third foot on seed 4051083280 |
| D shipped + prompt says the leg hangs | user words only | leg still on the bed |
| E B + D | | partial hang on 1 of 3 |
| F B + explicit pose in the prompt | | leg hangs over the edge on 3 of 3 |

Fabio eye-tested the sheet and chose B (2026-10-18).

## Shipped

- Node 184 in `comfy_workflows/flow_scribble.json` and its UI twin `comfy_workflows/raw/flow_scribble.json`
  now end with the B sentence; both equal the bench string byte for byte (checked in Python).
  Diff is one line per file.
- `node --test` over cloud-edit-graph, flow-output-versions, inject-params-titles, flow-legs,
  smoke-changed-only: 60/60 pass.
- `docs/releases/UNRELEASED.md` Fixes line.

## Left open

A pose the drawing cannot show clearly (a leg hanging toward the viewer) still needs words in
the prompt (variant F). Not built: an in-graph caption of the drawing.
