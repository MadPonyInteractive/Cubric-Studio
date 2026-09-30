# MPI-993 checklist

Scope (Fabio 2026-09-30): card description, plus the toast action button (same session).

- [x] `RECOMMENDED_REMOTE_MODELS.ollama` gains `huihui_ai/qwen3-vl-abliterated:4b` for `describe` (the Image Describer plugin's own model)
- [x] `listRemoteModels` (ollama only) appends recommended models the user's Ollama lacks, `installed: false`
- [x] `GET /llm/ollama` reports the recommended Ollama ids too; `POST /llm/ollama/pull` accepts them (allowlist `_pullable`, never an arbitrary name)
- [x] Settings: a missing model reads "Not downloaded"; picking one mounts `MpiOllamaSetup` under that row (enhance, describe, agent); the list refreshes when the download lands
- [x] Toast action: `MpiToast` `action: { text, onClick }` button; the button runs the action and closes the toast; a click anywhere else still dismisses (MPI-784)
- [x] `StatusBar.notify(..., { action })`, and `ui:*` events forward `action`
- [x] `js/shell/llmPickCheck.js`: on project open, once per app session, a selected Ollama-connection model not downloaded -> warning toast naming it and the Remote tab, with an "Open Remote" button; silent when Ollama does not answer
- [ ] `js/shell.js` one-line start: held by the MPI-856 session's live claim; asked in message `de63e6ac` (add it, or reply "yours")
- [x] Tests: listRemoteModels append, pull allowlist, pick check pure logic, toast action desktop spec, Settings Download row + project-open toast desktop specs
- [x] Docs: `docs/llm.md`, `docs/toasts.md`, `docs/component-contracts.md` § MpiToast
- [x] Eye check in an isolated instance (toast + Download row screenshots)
- [x] Round 2 (Fabio): `gemma4:26b` recommended for enhance + describe on 24 GB+ cards only (`minVramGb`); recommended rows sorted in table order (fixes the row showing one default while the server ran another)
- [x] LIVE, no stubs (2026-09-30): moved the qwen3-vl-abliterated:4b manifest out of H:/OllamaModels -> toast fired, Open Remote opened the panel, row read "about 3.3GB", gemma4:26b absent on the 16 GB card, real pull 1.9 s, row gone; manifest back byte-identical (sha256 6138791…)
