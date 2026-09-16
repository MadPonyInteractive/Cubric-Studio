# MPI-737 Brief - Remote providers, per-job model dropdowns, remote image descriptions

## Why this card grew (Fabio, 2026-09-16)

This was meant to land inside MPI-677 (the consolidation umbrella) and did not.
What shipped instead:

- **MPI-728** (done 2026-09-12) built `MpiLlmSettings` with an Enhancement row and an
  Image descriptions row, but hard-wired DeepInfra: backend value `'deepinfra'`,
  label `'DeepInfra (cloud)'` (`MpiLlmSettings.js:73`), and a DeepInfra-only key field
  (`secretsClient.setDeepInfraKey`). Image descriptions offer ComfyUI only.
- **MPI-774** (in-app agent, live) built a provider picker (OpenRouter, OpenAI, Ollama,
  custom) for the **agent only**.

Fabio's goal was never DeepInfra-specific, and never agent-only: the user connects
**any OpenAI-compatible endpoint once**, and every LLM job uses it.

## The spec

1. **One shared connection section** (Remote panel, Language Models). The user picks
   the infrastructure - presets DeepInfra, OpenRouter, OpenAI, Ollama (`/v1`), or a
   custom OpenAI-compatible base URL - adds the API key, and the app **probes the
   endpoint**. Connected -> the app lists the endpoint's models and hints which ones
   we recommend.
2. **Per-job dropdowns: Enhancement, Image descriptions, Agent.** The backend option
   reads **"Remote"**, never a vendor name. Under it, a **model dropdown** filled from
   the connected endpoint, our recommended models at the top, each prefixed
   **"(recommended)"**.
3. **Image descriptions run on Remote** with a vision model, so a description costs
   no local VRAM and never blocks a generation. This is the original scope below
   (image-passing path in the engines, `imageDescribe` routed through the chosen
   backend, honest ComfyUI gate). It is also the agent's eyes: MPI-774's `look` tool
   calls it (`tasks/MPI-774/brief.md` § Depends on MPI-737).
4. **The DeepInfra-specific surface goes:** the `'deepinfra'` backend value, its label,
   the DeepInfra-only key field. A key already stored in the DeepInfra slot migrates
   into the provider profile - the user never re-enters it.

## Ownership split with MPI-774

- **MPI-774** owns the shared connection section (it is building the provider
  profiles and the probe now) and the Agent row. Asked by message on 2026-09-16 to
  make that section shared, not agent-only.
- **MPI-737** (this card) owns the Enhancement and Image descriptions rows: the
  "Remote" relabel, the per-job model dropdowns, remote descriptions, the key
  migration. It consumes MPI-774's provider store; it does not build a second one.

## Open

- The recommended list per provider: today it is DeepInfra's tested ids in
  `MODEL_REGISTRY` (`services/llmEngines.mjs`). How a recommendation is matched on
  OpenRouter / OpenAI ids is undecided.
- Which describer model to recommend (criteria: `tasks/MPI-774/brief.md` § Describer
  criteria).
