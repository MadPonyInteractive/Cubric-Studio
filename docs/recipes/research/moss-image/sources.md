# Source Manifest — MOSS-Image

Provenance for the `moss-image` recipe (MPI-1243). **Vendor-skill sourced** (playbook 08): the
system prompt is the one Comfy-Org ship in the official ComfyUI MOSS templates, written from
OpenMOSS's own prompt-enhancer skill. MIT, so it ships VERBATIM. No NotebookLM notebook exists for
MOSS-Image; not a blocker.

- **Model version researched:** MOSS-Image SFT (OpenMOSS, 5B single-stream DiT, Qwen3.5-9B text
  encoder), the t2i model Vision ships as `moss-image` (official SFT int8-convrot + the community
  SFT-Turbo merge).
- **Research date:** 2026-10-22.
- **Researcher:** agent (`gh api`, the installed `comfyui-workflow-templates-json` 0.1.115).

## Sources

| # | Title / URL | Authority tier | Accessed | Notes |
|---|---|---|---|---|
| 1 | Comfy-Org `workflow_templates`, `image_moss_image_t2i.json` + `image_moss_image_t2i_bboxes.json` (TextGenerate "Text (System prompt)" node, subgraph "Text to Image (MOSS-Image)"); read from the installed `comfyui_workflow_templates_json` 0.1.115 | official-docs | 2026-10-22 | **The `t2v` system prompt, verbatim** (identical in both templates). Repo licence MIT. One caption, a description not an instruction; keep everything given, fill the rest; quoted text verbatim with its placement; English prose, 1-3 paragraphs, **80-200 words** (the `wordBudget`), medium + subject first; no coordinates, lists, JSON, quality keywords or negative. The bboxes template's note: the upsampler can drop a layout, so it is turned off when boxes must survive (Vision wraps the caption into the layout after enhancing instead). |
| 2 | github.com/OpenMOSS/MOSS-Image `skills/moss-image-prompt-enhancer/SKILL.md` + `references/layout.md` (main @ `52b87fc`, 2026-10-20) | official-docs | 2026-10-22 | The vendor skill #1 was written from. Same rules, plus a Layout deliverable (pixel boxes compiled to `abs_centralized` `yxyx`) that is the APP's job here (`mossLayoutPrompt`). It says "avoid arbitrary word budgets"; #1's 80-200 is kept because the condense job needs a number to be checked. |
| 3 | github.com/OpenMOSS/MOSS-Image `USERGUIDE.md` § Prompt Guidelines + § Image Captioning | official-docs | 2026-10-22 | Training captions describe composition, subjects, actions, setting, colours, lighting, style, and every visible text verbatim with its layout (`caption.long`). Text line breaks: insert real newlines. Recommended negative `nsfw, worst quality, ...`: **rejected** (docs/models/moss/README.md hard rule; #1 says no negative). |
| 4 | github.com/OpenMOSS/MOSS-Image `assets/prompt_defaults.txt` | official-docs | 2026-10-22 | Their Gradio prefills `best quality, masterpiece`: **rejected**, #1 and #2 both ban quality tags. |
| 5 | `.agents/mpi-kanban/tasks/MPI-1180/validation.md` (bench 2026-10-21) | in-house measurement | 2026-10-22 | Every text line in the bench rendered as written; long structured captions held. |
| 6 | Community skills (`gh api search/repositories?q=moss-image+prompt`): `Moeblack/moss-image-prompt-skill` (93★, CC BY-NC-ND 4.0), `slmonker/ComfyUI-MOSS-PromptEnhancer` (24★), `ThetaCursed/ComfyUI-MOSSImageTextEncoder` (22★) | community-skill | 2026-10-22 | Phase 0 step 2. Moeblack's is the only prompting skill of note: **not adopted**, its licence forbids derivatives and the vendor's own skill outranks it. The other two are ComfyUI nodes, not prompting guidance. |

## Conflicts

- #2 says no word budget; #1 says 80-200 words. #1 wins (it is the vendor rule, already applied by
  Comfy-Org to an upsampler; the harness needs a number).
- #3/#4 recommend a negative and quality tags; #1/#2 ban both. #1/#2 win: a caption model trained
  on descriptions gains nothing from tags, and the bench showed no difference with the negative.
