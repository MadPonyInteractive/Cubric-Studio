# MPI-1154 validation

## Cause

Video Edit's Change the background (op 4, with a picture) fills `Input_Kept` from the clip's first frame. Its
question was a fixed string, "Describe only the main person: ...", so it never saw Which characters
(`Input_Who`). With "The monkey and the horse" the app's describer (Gemma 4 26B on DeepInfra, the pick in
Remote) answered the monkey alone (flowVideoEdit_001 sidecar), and template 4 said "{who} ... who stays exactly
as filmed: {kept}" with two named and one described.

## Fix

- `flowEnhance.describeAsks`: a describe entry's `ask` may be a function of the run's values; it is resolved
  there, so the cache key and the describer both get the final text.
- `flowsRegistry.js` video-edit: the op-4 `Input_Kept` ask names `Input_Who` itself ("Describe only <who>,
  each of them in turn if that is more than one: what they are, apparent age and gender, face and skin or fur,
  hair, garments ... Leave out the place around them."). Fallback "the person" (the field default) when blank.
- The place line: the first bench answer ended the horse "standing still in a grassy field", and a kept text
  naming the clip's place keeps it (MPI-1036 V4c). With the line, no place.

## Bench (G: ComfyUI 0.39.0, 4060 Ti, GPU lease), 2026-10-16

Describer: the shipped LOCAL describer (`comfy_workflows/image_descriptor.json`, Qwen3-VL 4B), the question
wrapped as `llmService.buildDescribeInjectionParams` does (`research/describe_bench.py`, `research/asks.mjs`
reads the registry, so the asked text is the shipped one). Gemma on DeepInfra was NOT asked (paid; Fabio's app
asks it on his next run). `research/describe_qwen2.log`:

| case | answer |
|---|---|
| monkey + horse, OLD question | "A cartoon monkey ... rides atop a white horse; the monkey has short, spiky orange hair and wears no clothing" (horse as a prop) |
| monkey + horse, NEW, who "The monkey and the horse" | "A cartoon monkey with brown fur ... is riding a white horse with a blonde mane and tail; the monkey wears no clothing or accessories, while the horse has a brown saddle." |
| dancer, NEW, who "the blonde woman" | "A blonde woman with long, straight hair, wearing a black short-sleeved top and dark green shorts, stands with both hands placed on her stomach." |
| dancer, NEW, who "the person" (default) | same, "hands clasped over her stomach" |

Single subject reads as before. No place in any NEW answer.

H3: `research/run_kept.py K1_monkey_horse_kept_both` = MPI-1151's M5 preset (today's template 4 = M6, his
seed 515488481, Gemma's look from the _001 sidecar) with the two-subject kept text above. Node 19 `Input_Kept`
in the queued graph carried it (checked in /history). 290 s, 576p.

- Side-by-side `logs/mpi1154/mpi1154_source_before_after.webm` (source | before = M6 run, monkey-only kept |
  after = K1), stills `logs/mpi1154/frame_2.png`, `frame_20.png`, `frame_36.png`, clip
  `logs/mpi1154/K1_monkey_horse_kept_both_00001.mp4`.
- Looked at: the picture's mountains, sun, lake and pines come over in both; monkey, horse and moves as filmed.
  After is near frame-identical to before.
- **The horse's head over the monkey's face (frame 36) is IN THE SOURCE CLIP**: the horse turns its head
  across him at the same moment. Not drift from the edit, and not caused by the missing description.

## Tests

- `node --test` flow-describe, flow-legs, agent-flow-handover, child-safety-gate, inject-params-titles,
  flow-make-seamless, character-sheet-editor, workflow-media-slots: 135/135.
- Full `npm test` in the shared tree: 3363/3376, the 11 failures in agent-prompt-budget, agent-no-delete,
  agent-bench, project-copy-item, scene/splat-companion, gif-frames: peers' UNCOMMITTED work (agentTools.mjs,
  routes/projects.js); none imports flowsRegistry or flowEnhance.

- Pushed `cb37d7984`; CI `Tests` run 38954185483: success (unit + desktop 1-4).

## Eye test (Fabio)

Open `logs/mpi1154/mpi1154_source_before_after.webm`: the right column should still pass as M6 did.
