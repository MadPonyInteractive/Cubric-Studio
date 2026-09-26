# MPI-874 validation

## Root cause (2026-09-26, session b5b35494)

The brief said a Flow submit drops `cardName`. It does not; the evidence was misread.

1. **The unnamed cards are copies.** The five `flowOutpaint_00N` cards in "Deepinfra model
   tests" were made by the gallery's Add to project: `app-20260921-110111.log` has
   `[MpiContextMenu] select add-to-project` at 10:54:41Z and 10:58:05Z; cards 001-004 carry
   `createdAt` 10:54:44.053-.067Z (14 ms apart), while their PNGs landed one per run from
   10:43 to 10:54. `routes/projects.js` `add-from-cards` wrote `customName: null`, and the
   gallery sent no name. The runs themselves landed in "Cubric Studio Mascots" (the replies'
   `filePath`); those originals were later deleted, so nothing on disk shows their names.
2. **The agent's replies were truncated by its own script**: the MPI-864 harness printed
   `JSON.stringify(out.output).slice(0, 300)`, and `cardName` is the last key after a long
   `filePath`, so every reply ended at `"model`.
3. **Run 5 was a real miss, already fixed.** It completed at 10:55:15Z with its origin
   closed (`card registered in the project it was dispatched in`); `renameGroup` only sees
   the open project. `nameCard`'s closed-project write (MPI-873, `c016e500e`) covers it.
4. "`name` in the sidecar: set" was a misread: the sidecar `name` is null on the named
   `t2i_002` too. A card's name lives only on the group in `project.json`.

## Fix (A) and tests (B), 2026-09-26

- A: `MpiGalleryBlock.js` sends `customName` with each copied card; `routes/projects.js`
  `add-from-cards` writes it (a trimmed string, else null). The gallery half is one property
  and has no unit test; the route is covered.
- `node --test tests/project-copy-item.test.cjs tests/agent-target-project.test.cjs` -> 13/13:
  new `add-from-cards keeps each card's name, and only a real one` (named, unnamed, and an
  object that is not a name) and `a card name reaches a card in the open project through the
  project, not the server` (B: `nameCard`'s open branch, no `/project-groups` write).
- `npm test` -> 1987 tests, 1986 pass, 0 fail, 1 skipped.

## Live (C) PASSED, 2026-09-26 19:40Z

`app:isolated` on :63451, `APP_DOCUMENTS` = session scratch (`/connector/projects` came back
empty first; no `MPI874*` folder reached `Documents`), `dev_configs/` pins unchanged, ComfyUI
queue on 48188 empty before the run, GPU lease held, no cancel. Driven over `/mcp` as an
outside agent drives it (scratchpad `live874.mjs`, `live874.log`):

| step | result |
|---|---|
| `create_project` A and B, `open_project` A | current project = A |
| `generate` `flowId: outpaint`, `folderPath` = B (closed), `cardName: "MPI-874 banana 1:1"`, `media: [{ role: image1, path: <a 928x1152 png outside the project> }]`, `params.frame.ratio: 1:1` | `running`, then `wait_generation` -> `output.cardName: "MPI-874 banana 1:1"`, 1152x1152, 19.2 s |
| B `project.json` | 1 card, `customName: "MPI-874 banana 1:1"`; `list_cards { folderPath: B }` names it |
| A `project.json` | 0 cards; the view stayed on A |

The isolated `app.log` has `card registered in the project it was dispatched in` at
19:40:50.329Z, so the card went through the closed-project path and `nameCard`'s server
write named it. That is the Flow-into-a-closed-project path MPI-873 left unproven live.
