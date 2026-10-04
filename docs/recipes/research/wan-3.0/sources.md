# Source Manifest — Wan 3.0

Provenance for the `wan-3.0` recipe.

- **Model version researched:** Wan 3.0 (`Wan-AI/Wan3.0-Video`)
- **Ops covered:** t2v, i2v (first frame + optional last frame), ref2v
- **Research date:** 2026-10-04
- **Researcher:** agent (Phase 0 search + Phase 1 synthesis)

Authority tiers (highest first): `official-docs`, `official-example`,
`community-skill`, `community-deep-dive`, `comparison`.

## Sources

| # | Title / URL | Authority tier | Accessed | Notes |
|---|---|---|---|---|
| 1 | Alibaba Cloud Model Studio — "Wan3.0 Video Generation Prompt Guidelines", https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-prompt-guide | **official-docs (model author)** | 2026-10-04 | The complete official prompting specification from Alibaba/Wan-AI. Defines the full structured format, shot syntax, dialogue notation, audio handling, and negative-list position. This source outranks all others. |
| 2 | Alibaba Cloud Model Studio — "Wan3.0 Video Generation API Reference", https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference | **official-docs (model author)** | 2026-10-04 | Settles parameter names, limits, and the absence of a `negative_prompt` field. `input.prompt` max 20,000 characters. Confirms `reference_image`, `reference_video`, `reference_audio`, `first_frame`, `last_frame` media roles. |
| 3 | DeepInfra model page — `deepinfra.com/Wan-AI/Wan3.0-Video` | official-example (serving platform) | 2026-10-04 | Confirms media-type parameter names as served and that `prompt_extend` is on by default. No prompting guidance beyond confirming the `Image N` / `Video N` citation form. |
| 4 | `babicat4242-svg/wan3-prompt-skills` (★4) — `skills/wan3-pe/SKILL.md` | community-skill (packages official Alibaba material) | 2026-10-04 | Structured-request organiser built from the official Alibaba wan3-pe download. Confirms: `Image N`, `Video N`, `Audio N` numbering per modality in upload order; 20,000 char limit; no padding of the negative section; aspect/duration are API parameters not written into the prompt. Adopted as corroboration of srcs 1–2, not as a primary source. |
| 5 | `babicat4242-svg/wan3-prompt-skills` (★4) — `skills/wan3-creative/SKILL.md` | community-skill (unofficial extension of src 4) | 2026-10-04 | Korean-first creative expansion of the official wan3-pe skill. References the official API (src 2) and prompt guide (src 1). Corroborates: first_frame/last_frame mutually exclusive with reference modes; prompt_extend default true. Not used as a primary source. |

## Phase 0 search — what was found and not found

| Search | Result |
|---|---|
| `gh api orgs/Wan-Video/repos` | 6 repos: `Wan2.1`, `diffusers`, `Wan2.2`, `Wan-skills`, `Wan-Dancer`, `Wan-Animate-2`. No Wan 3.0 repo. |
| `Wan-Video/Wan-skills` tree | Only `skills/wan2.7-image-skill/` and `skills/wan-pptx-generator/` — no Wan 3.0 video skill. |
| HuggingFace `Wan-AI/Wan3.0-Video` model card | 401 Unauthorized — gated; not readable. |
| GitHub `q=wan+3+video+prompt+skill` etc. | Top results are API gateway pricing pages; no high-star prompting skill found. See below. |
| Higgsfield Wan 3.0 skill search | OSideMedia/higgsfield-ai-prompt-skill (★683) covers Seedance exclusively, not Wan. |

**No Wan 3.0 vendor-shipped prompting skill on GitHub** comparable to MiniMax-H3's
`.claude/skills/h3-prompt-writing/`. No high-star community skill exists for Wan 3.0
(contrast: Seedance's top skill has 3,315 stars). The official Alibaba Cloud docs (src 1)
are the closest available specification.

## Decisions applied in the recipe (resolved by the MPI-1018 dispatcher)

1. **Reference citation form:** `<Image 1>` / `<Image N>` — the form the app's `@` picker inserts
   (via `refTagHandle`, `js/data/commandRegistry.js`). The official guide uses bare `Image 1`;
   OpenArt uses `@Image1`. The recipe tells the enhancer to cite whatever form is in the
   Attached references line, as the Seedance 2.0 recipe does.
2. **Official structure wins over OpenArt's four-part order** where they conflict. See `research.md`.
3. **Timestamps are allowed** — the official guide explicitly shows `Shot 1 [0-3s]` syntax and
   recommends it for multi-shot; the Seedance ban does not apply here.
4. **Millimetre focal lengths are allowed** — the official guide uses `85mm telephoto`; the
   Seedance degrees-not-millimetres rule does not apply here.
5. **Audio is on by default** — Wan 3.0 generates dialogue, effects, and music simultaneously.
   Write what the user asked for; suppress only when they asked to suppress.
