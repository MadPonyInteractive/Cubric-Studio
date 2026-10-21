# MPI-1236 validation

## Why

Fabio, 2026-10-21: users had no way to use an Ollama Cloud model. The agent model list shows only
what `ollama list` holds plus three recommended local models, and a cloud model gets there only by
`ollama pull <name>:cloud` in a terminal. Free cloud models (MiniMax M3.1 Flash scored 49/55 free on
Ollama Cloud) beat the local picks (ornith:9b 23/34 on the older tests).

## What shipped

- `GET /llm/ollama/cloud`: ollama.com's public catalogue (`/api/tags`), tool-calling models only, by
  local cloud name, sorted, `added` flag, Ollama sign-in via `POST /api/me`.
- `POST /llm/ollama/cloud/add { id }`: pulls only a catalogue name (a stub, nothing downloaded).
- "Add a cloud model" button under the agent model row (Ollama connection) opens the new
  `MpiOllamaCloudDialog`; an added model becomes the agent pick; cloud rows read
  "Runs on Ollama's servers", never "runs on your GPU".

## Evidence

- `node --test tests/ollama-cloud.test.cjs`: 5/5 (name mapping, filter + sort, list route signed in
  and signed out, add refuses a name the catalogue lacks without pulling).
- `npm run lint` clean; `npm test` 3505 pass, 0 fail (3507 tests, before the sort tweak; the cloud
  file re-run after it 5/5).
- Live, my `app:isolated` instance (port 53304) in the browser pane: list of 22 models, "Signed in
  to Ollama as fabioargoncalves1981"; Add on `minimax-m3.1-flash:cloud` turned the row to Added,
  status "Added ... It is now your agent model", the agent dropdown then showed it picked and labelled
  "Runs on Ollama's servers".

## Not verified

- The signed-out path: the 401 + `signin_url` shape is read from Ollama's source; this box is signed
  in and was not signed out to see it. Sign in falls back to ollama.com/signin when no link comes back.
- A Cosmo chat on an added cloud model through the app (the same route ran the MPI-1208 bench).

## CI

- Tests run 39622026934 on f29d8d820: success.
