# MPI-921 validation

## Who needed cross-origin access: nobody

- The Electron renderer loads `http://127.0.0.1:<port>` (`main.js` `SERVER_ORIGIN`), which is the server's own origin. `js/` has no absolute URL to the server.
- The two `file://` windows (`splash/splash.html` and `main/float-latent.html`) make no HTTP requests.
- Nothing in the sibling repos calls the server from a browser: Cubric-Prompt, the Cubric-Studio hub and broker, the website, Cubric-Flows, Cubric-UI and ComfyUi-MpiNodes have no fetch to :3000. MadPony-Identity scripts, `services/agentTools.mjs`, `routes/connector.js` self-calls, the MPI-593 CLI and the tests all run in Node, where CORS never applied.

So there is no allowlist. `cors()` and the `cors` dependency are removed, and `routes/localOnly.js` is mounted first. It refuses:
- a foreign Host (DNS rebinding)
- a foreign Origin
- any Sec-Fetch-Site other than same-origin or none

## Evidence

- `node --test tests/local-only.test.cjs`: 4/4 pass.
- `npm test`: 1893 tests, 0 fail. The only ✖ listed is the existing MPI-867 `todo`.
- `npx eslint server.js routes/localOnly.js tests/local-only.test.cjs --max-warnings=0`: exit 0.
- Live on an `app:isolated` instance (:49991), with raw Node requests:
  - 200: Node client, `localhost` Host, same-origin renderer, typed URL. This includes `/connector/projects`, which calls `/list-projects` back over loopback.
  - 403 with no ACAO header: cross-origin fetch, preflight, cross-site text/plain POST, no-cors GET, rebound Host.
- Real Chromium (playwright-cli) on a page from another origin (`127.0.0.1:61209`):
  - fetch rejects with "Failed to fetch".
  - A no-cors POST to `/create-project` arrives and is refused server-side (logged with `sec-fetch-site=same-site`).
  - An `<img>` load of `/favicon.png` fails.
  - Control: the same browser at the app's own origin loads the landing page, and `fetch('/connector/projects')` returns `ok true`.
- In-app agent (local gemma4:e4b, GPU lease held): the `list_projects` tool ran over loopback with status `done` and the reply was delivered.
- The instance log shows 13 refusals, exactly the 10 Node probes plus the 3 browser probes. There are 0 refusals from the app, the renderer or the agent.

## Not covered

- `npm run test:desktop` was not run. The renderer is same-origin, and the live instance logged no refusals of its own traffic.
- The user's running app on :3000 keeps the old `cors()` until it restarts.
- Follow-up raised: the local ComfyUI engine runs with a bare `--enable-cors-header` (`routes/comfy.js:647`), which is the same kind of hole on :48188.
