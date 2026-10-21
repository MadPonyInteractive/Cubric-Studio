# MPI-1236 checklist

- [x] Server: `GET /llm/ollama/cloud` lists Ollama's cloud models that can call tools (from ollama.com/api/tags), local names (`name:cloud` / `name:tag-cloud`), which are added, and the Ollama sign-in state (`POST /api/me`)
- [x] Server: `POST /llm/ollama/cloud/add { id }` pulls only a name from that list (a stub, nothing downloaded)
- [x] UI: "Add a cloud model" button under the agent model row on the Ollama connection opens a dialog (new Compound `MpiOllamaCloudDialog`)
- [x] Dialog: sign-in line (+ Sign in when signed out), one row per model with Add, honest "runs on Ollama's servers, uses your Ollama plan" note, every end visible
- [x] Added model is picked as the agent model; its rows say Ollama's servers, never "runs on your GPU"
- [x] Test: unit test for the name mapping + list filter; lint + npm test
- [x] Live: isolated app, add a model, see it in the agent list
- [x] Docs: docs/llm.md
