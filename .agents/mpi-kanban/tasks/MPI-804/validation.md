# MPI-804 Validation

## The bug

With "Auto-start ComfyUI on launch" on, clicking a project did nothing until the engine
finished booting. Reported as "the app looks broken".

## Cause (measured, not assumed)

`reconcileAndHydrate` asked the server TWICE PER HISTORY ITEM — `/load-meta`, then
`/file-exists` — awaited one after the other, and `openProject` does not navigate until
that chain ends. Against the user's own project folder:

    153 items (306 calls) - cowboys
    150 items (300 calls) - Cubric Studio Mascots
    103 items (206 calls) - test
    41 projects, median 18 items

Those requests queue under Chromium's 6-per-host cap on HTTP/1.1, and during an engine
auto-start the queue in front of them is at its worst: the landing grid's preview videos
each hold a connection until they decode (and `releaseProjectGrid()` only ran at
navigation, i.e. AFTER the open), `/connector/jobs/stream` holds a permanent slot
(MPI-774), and `ComfyUIController` polls `/comfy/status` once a second for the whole
startup. Engine ready -> poll stops, thumbs finish, chain drains, project opens.

Ruled out with measurements: the `/project-stats` fan-out (41 projects, 1248 `stat()`
calls = 21 ms), node-drift repair (pin matched the installed marker), and the auto-start
path itself (fire-and-forget, `background: true`, no overlay).

## Fix

- `POST /load-meta-batch` (`routes/projects.js`): every id's sidecar plus whether its
  media is still on disk, in one request.
- `js/managers/projectReconciler.js`: one call for the whole project; the per-item loop is
  now in memory. The Media listing behind synthetic (uploaded) items is fetched once, not
  per missing sidecar. Dead helpers removed (`_fetchMeta`, `_checkFileExists`,
  `_extractAbsPath`).
  A failed request THROWS rather than returning nothing: an empty answer reads as "no
  sidecar" for every item, which would rebuild them as synthetic `uploaded` entries, drop
  groups and persist that to project.json.
- `js/shell/projectUI.js`: the row click cancels the grid's in-flight loads before opening
  (freeing the connections its own requests need), and a failed open now says so instead
  of silently doing nothing.

## Evidence

`tests/project-hydrate-batch.test.cjs` — 4 tests, all passing:
batch answers hydrated/orphaned/unknown ids; the client makes exactly ONE request for a
40-item project (was 80); a failed request rejects instead of rewriting; a request with no
ids is refused.

End-to-end against the real modules (real reconciler + real routes, scratch project,
counting fetch):

    items in: 151 | hydrated out: 150 | wasModified: true
    HTTP requests for the whole open: 3  (was 302 before)
    hydration took 76 ms
    orphan dropped: true | sidecar-less id kept as synthetic: true

(3 = the batch, the Media listing for the sidecar-less item, and the orphan's delete.)

Full suite: 1320 passing, 0 failing. `npx eslint` clean on all four files.

## Left for Fabio

One human check only: restart the app (the new route lives in the server, so a renderer
reload is not enough) with auto-start on, and click a project while the engine is still
coming up. Expected: it opens immediately, and the "Starting ComfyUI Engine..." overlay
appears at generation time as it used to.
