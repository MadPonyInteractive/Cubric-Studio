# MPI-1237 validation

Commit `c0e7baf46` (fix), pushed 2026-10-22.

## What changed

- `js/utils/tileCount.js` `runTileCount(params, image)` - the ONE count: the status bar's stage
  total (`commandExecutor._tileStages`, now a call to it) and the quote both use it.
- `generation.quote` (`js/shell/agentDispatch.js`) answers `tiles: N` for a Use Tiles run, local or
  cloud (`tiles: null` = tiles on, size unreadable; absent = not a tile run).
- Cosmo (`services/agentLoop.mjs`): the quote is read once per generate; the started reply says
  "It runs as N tiles ... the status bar counts the same N", the running-now line of every later
  turn reads "<card>, N tiles"; null -> "point the user at the status bar, never guess".
- `docs/agent/upscaling.md`: never work the count out from the size.

## Proof

- Unit: `tests/tile-count.test.cjs` (runTileCount: 1920x1080 x2 = 15, tiles off / http / unreadable
  = 0) and `tests/agent-loop.test.cjs` "a Use Tiles run tells Cosmo its tile count, now and on the
  next turn" (40 in the started reply + next turn's running line; null -> status bar; no tiles ->
  no line). Related suites 221/0; `npm test` 3509 pass / 0 fail; eslint clean; pre-push gate green; CI run 39706763989 green on c0e7baf46.
- Live, own `app:isolated` (port 51421, never :3000), `POST /connector/quote` krea2 upscale with a
  1920x1080 picture: tiles 2x -> `{"billed":false,"tiles":15}` (42 ms), tiles 1x -> 6, tiles off ->
  no `tiles`. $0, no GPU. (The first quotes after boot stalled while that instance started its
  engine and downloads, tiles off included - not this change.)

## Not covered

- A real Cosmo turn (paid LLM + a GPU tile run) - the loop test drives the same path with a stub.
- Outside agents over MCP: `routes/mcp.js` generate does not call the quote, so they are not told.
- A batch (fan-out) upscale keeps no per-item count.
