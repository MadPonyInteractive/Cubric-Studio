# MPI-1323 validation

**Cause.** The landing loaded its project list only on arrival (`navigation.js` -> `loadProjectGrid`).
`/connector/create-project` and `/project-groups` (a card landing in a closed project) change
the list server-side, and nothing told the renderer. Fabio's B-roll, made by an agent while the
landing was showing, read "Recent - 71" against the server's 72.

**Fix.** `routes/eventStream.js` keeps its open streams and exports `broadcast()`. `/create-project`
and `/project-groups` send `projects:changed`. `projectUI.js` listens through `onStream` and,
500 ms after the last one and only while the landing is showing, reloads the list quietly (old
rows stay until the new list arrives, no spinner).

**Evidence.**
- `node --test tests/projects-changed-event.test.cjs tests/event-stream.test.cjs tests/project-groups-stack.test.cjs`: 5/5 pass.
- eslint on the four files: clean.
- Live, own `app:isolated` (scratch APP_DOCUMENTS, profile, engine root, port 63010): landing showed
  "No projects yet"; `POST /connector/create-project {"name":"B-roll test 1323"}`; 2 s later the
  landing read "Recent - 01 / B-roll test 1323", nobody navigated.
