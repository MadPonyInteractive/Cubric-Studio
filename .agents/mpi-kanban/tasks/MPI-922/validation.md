# MPI-922 validation

## The hole, measured

Two scratch ComfyUI processes from the app's own engine (`--cpu`, custom nodes off, own
temp/output/input/user dirs, ports 48198 and 48199, so the user's engine on 48188 was untouched).
48198 had the bare `--enable-cors-header`, 48199 did not. Everything else matched `routes/comfy.js`.

Raw requests carrying the headers a browser sends:

| request | with the flag | without it |
|---|---|---|
| foreign site, no-cors `text/plain` POST /prompt | **200, prompt queued** | 403 |
| foreign site, preflight OPTIONS /prompt | 200, ACAO `*` | 403 |
| foreign site, cors GET /history | 200, ACAO `*` | 403 |
| foreign site, no-cors GET /view (an `<img>`) | 404, ACAO `*` | 403 |
| other local origin `127.0.0.1:61209`, POST /prompt | 200, queued | 403 |
| Node client with no Origin (server routes, CLI, scripts) | 200 | 200 |
| Node `fetch()` POST /prompt | 200 | 200 |
| the renderer after main.js rewrites its Origin | 200 | 200 |

In real Chromium (an Electron page with no app hooks, served from `localhost:<port>` and from
`127.0.0.1:<port>`), the attack page was checked afterwards through `/history`:
- with the flag, the page read /history, opened /ws, and **its no-cors POST ran a workflow**.
- without the flag, all three were refused and the workflow never ran.

## The renderer needs no flag

An Electron 41 harness (the repo's own binary) installed `main.js`'s two `webRequest` hooks
verbatim, with only the port literal swapped, and loaded a page from its own origin, the way
`SERVER_ORIGIN` is loaded. It then made every request shape the renderer uses against :48199:

- ws `/ws` connect, then progress through to `execution_success`
- POST /prompt with JSON (preflighted)
- GET /history
- HEAD /view on a temp display (the Flow result pane probe), and a real 404 on a missing file
- a plain `<img>`, a `crossOrigin` `<img>` read back with `getImageData`, and a `crossOrigin`
  `<video>` (a Range request) read back with `getImageData`
- multipart POST /upload/image
- GET /queue, POST /queue, POST /interrupt

Results:
- **Hooks on, no flag:** all 13 pass.
- **Hooks off, no flag:** all 13 fail. So the hooks carry the renderer on their own.
- **Hooks off, flag on (today):** all pass. The hooks had been redundant until now.

Sweep of renderer requests to the engine (`comfyController`, `commandExecutor`, `memoryOps`,
`comfyOutputUrls`, and 17 `crossOrigin` media sites): they use no PUT, PATCH or DELETE, no
credentials, and no headers beyond `Content-Type`. Each shape is covered above. No custom node in
the engine adds its own middleware or ACAO (grep of `engine/.../ComfyUI/**/*.py`). Server-side
callers never forward a browser Origin (`remoteProxyForward` copies only content-type/length).

## Checks

- `node --test tests/comfy-port-lockstep.test.cjs`: 7/7 pass. This includes the new MPI-922
  guard, which fails against HEAD's `routes/comfy.js` ("passes --enable-cors-header to the local
  engine again").
- The `.bat` transform, lifted from `routes/engine.js`: a stock line, an old line patched with the
  flag (this machine's real `run_nvidia_gpu.bat`) and an already-new line all end up as
  `--listen 127.0.0.1 --preview-method taesd` with no flag. A re-run writes nothing.
- `npm test`: 1893 tests, 0 fail (1 existing todo).
- `npx eslint` on the six changed JS files with `--max-warnings=0`: exit 0.

## Live, on my own `app:isolated` instance (2026-09-25, Fabio stopped his engine)

- The instance (:62866, scratch `APP_DOCUMENTS`) spawned the engine itself on 48188. Its parent
  was my instance's `server.js`, and its command line was
  `--listen 127.0.0.1 --port 48188 --lowvram --preview-method taesd --extra-model-paths-config …`,
  with no CORS flag.
- Foreign origins against the live 48188:
  - raw requests: 403 with no ACAO for a no-cors POST /prompt, a preflight, a cors GET /history,
    an `<img>` GET /view, and another local origin's POST. A Node client with no Origin got 200.
  - real Chromium, from `localhost:<port>` and from `127.0.0.1:<port>`: /history, /ws and a
    no-cors POST /prompt were all refused.
  - `/history` afterwards: none of the foreign workflows ran.
- Generation through the app window's renderer (the connector relays to the window, and
  `comfyController` POSTs /prompt and holds the ws, through `main.js`'s hooks), under a GPU lease:
  - `sdxl-realistic` t2i: `ok`, and `t2i_001.png` landed. Prompt executed in 17.2 s, and the next
    submit went out 0.5 s later, so the ws completion events arrived.
  - Scribble Flow, fed that output: `ok`, and `flowScribble_001.png` landed after 26.0 s.
  - Both PNGs hold real content (channel means around 149/138/132, stdev around 70).
  - The instance log shows 0 origin 403s and 0 errors from the app across the run. The only
    refusals in it are the 5 from my own probes.
- Previews arrive as binary frames on that same ws. `main.js`'s hooks act only on the handshake,
  so a socket that delivered the completion events also delivered the frames. They were not
  counted one by one: `app:isolated` has no CDP.
- The Flow result pane touches the engine only through the `Output_Display` HEAD probe. Head Swap
  is the only Flow that uses it and is not installed here, so that probe is covered by the
  harness above (HEAD 200 on a temp display, a real 404 on a missing file). The pane's result
  itself is served by Express `/project-file`, which this change does not touch.
- The instance was stopped via its root `electron.exe` (the launcher's child), and 48188 was free
  again afterwards.

## Not covered

- `.bat` files already on users' machines keep the flag until the patch step runs again (on a
  re-provision). The app never launches that `.bat`; it only matters to someone who runs it by hand.
- The Pod: production binds loopback and keeps ComfyUI's strict default
  (`wrapper.py` adds the flag only on the MPI-192 debug door). The builder image
  (`mpi-ci/cubric-vision-builder`) passes it on purpose. Both are public with no auth by
  design, so CORS is not what exposes them.
