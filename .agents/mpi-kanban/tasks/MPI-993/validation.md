# MPI-993 validation

## What shipped

- Ollama connection: every recommended model is listed even when the user's Ollama lacks it (`installed: false`, "Not downloaded"); picking one mounts `MpiOllamaSetup` under that row (enhance, describe, agent) and the list re-reads once the download is seen landing.
- `POST /llm/ollama/pull` downloads only `_pullable` models (registry + `RECOMMENDED_REMOTE_MODELS.ollama`).
- Describe on Ollama recommends `huihui_ai/qwen3-vl-abliterated:4b` (Fabio's call: the Image Describer plugin's own model).
- `gemma4:26b` recommended for enhance + describe only on cards with 24 GB or more (`minVramGb`, nvidia-smi read by the route); after the defaults.
- Recommended rows sorted by table order: a row's first recommendation is the model the server runs for an empty pick. Found on the way: DeepInfra's enhance row showed `gemma-3-12b` while the server ran `gemma-4-26B`.
- Toast `action` button (`MpiToast`, `StatusBar.notify`, `ui:*`): runs, then closes through the same click-dismiss path; the rest of the toast only dismisses.
- `js/shell/llmPickCheck.js`, started at boot by `js/shell.js`: on project open, once per session, a warning toast when a pick on the Ollama connection is not downloaded, naming the Remote tab, with an Open Remote button. Silent when Ollama does not answer.

## Evidence

- `npm test`: 2368 tests, 2366 pass, 0 fail (2026-09-30, after the shell.js line).
- `node --test tests/llm-connection.test.cjs`: 18 pass, incl. MPI-993 listing, VRAM gate at 16/unknown/24, table order vs `recommendedModel` for every DeepInfra job, `_pullable` refusal.
- `tests/llm-pick-check.test.cjs`: 4 pass (which picks count as missing; message names model, job, Remote tab).
- Desktop (`playwright.desktop.config.js`): `toast-click-dismiss.spec.js` 2/2 (action runs once and closes; message click only dismisses; a throwing action still closes), `toast-mascot`, `toast-serial-countdown`, `llm-settings-remote.spec.js` 4/4 (Download row appears, clears on another pick, pull names the model, row goes after the download; project-open toast with NO manual start(), so the boot wiring is proven; once per session).
- LIVE, no stubs, real Ollama + real 16 GB card: `qwen3-vl-abliterated:4b` manifest moved out of `H:/OllamaModels` -> toast text correct, Open Remote opened the panel, row "about 3.3GB", `gemma4:26b` absent, real pull 1.9 s, row gone, "Not downloaded" gone, no page errors. Manifest restored byte-identical (sha256 `613879139bf1…`).
- CI: `fa00002e8` Tests success.

## Not covered

- A real multi-GB download with a moving progress bar (the live pull only re-fetched a manifest). The bar is `MpiOllamaSetup`'s, unchanged from MPI-728.
- `gemma4:26b` as a recommended row on a real 24 GB card (unit-tested with `vramGb: 24`).
