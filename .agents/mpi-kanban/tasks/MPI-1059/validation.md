# MPI-1059 validation

Fabio, 2026-10-10: put the Pod spend next to REMOTE in the status bar, so it is visible
without going back to the home page.

## What shipped

- `js/utils/podCost.js` - `podSessionCost({ uptimeSeconds, pricePerHr })`, the one gate:
  dollars, or null unless both are known. Lifted out of `heroStats.js` (MPI-80) so the hero
  strip and the status bar can never disagree on whether there is a number.
- `js/shell/statusBar.js` - the `remote:connection` listener keeps the spend; the idle label
  reads `IDLE · REMOTE · $0.59` while connected with cost data, plain `REMOTE` before the first
  feed tick carries it. The connected feed already re-emits every ~5s, and the listener already
  repainted idle on every emit, so the number climbs with no new timer.
- Idle only: a running job owns the label (unchanged), same as REMOTE itself.

## Evidence

- `node --test tests/status-bar-spend.test.cjs tests/status-bar-accent.test.cjs tests/status-bar-idle-clears-pulse.test.cjs`:
  11/11 pass. The new file covers the gate's null cases (Settings/boot emits send null
  uptime/price) and pins both surfaces to the shared import.
- Live, off-screen isolated Electron (desktop config, own port, Fabio's :3000 untouched),
  throwaway spec driving fake `remote:connection` ticks, deleted after: label went
  `IDLE · Local` -> `IDLE · Remote` -> `IDLE · Remote · $0.59` (14m20s @ $2.49/hr) ->
  `IDLE · Remote · $2.49` (1h) -> `IDLE · Disconnecting` -> `IDLE · Local`, no page errors.
- eslint clean on the three changed JS files.
