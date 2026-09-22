# MPI-890 — validation

Verify mode: `auto` for the wire, `user-ux` for what the agent then does with it.

The tests prove the workspace reaches the App state line and that the entry it names
resolves through `_images`. They cannot prove the agent stops calling `list_cards` when a
card is open — that is a live read, and it is Fabio's.

## Automated — 2026-09-22

Seven new tests in `tests/agent-loop.test.cjs`, suite `(e) the open workspace reaches the
agent`. Each half backed out **on its own**:

| Backed out | Result |
|---|---|
| the `standing` clause in `_appStateLine` | 1 fail — "the App state line names the card and the entry in front of the user" |
| the `_registerWorkspaceEntry` body | 1 fail — "the named entry resolves through the _images allowlist" |
| the Cards-rule clause | 1 fail — "the Cards rule stops list_cards and the attachment ask when a card is open" |
| control (nothing backed out) | 0 fail |

The containment check was **not** proved by back-out: removing it and then running the
suite is a deliberately weakened security path and the harness refused the run. It is
covered positively and negatively instead — an entry inside `Media/` survives and resolves
to an absolute path, one at `../../../secrets.png` is dropped while the turn survives, and
a turn with no project open drops it too.

Full suite: `npm test` → **1793 tests, 1791 pass, 0 fail, 1 skipped, 1 todo**. The todo is
the pre-existing MPI-867 entry in `agent-video-attachment.test.cjs`, which prints an
AssertionError and is counted by node as `todo`, not `fail`. `npm run lint` and
`npm run lint:components` both exit 0.

### Caught by an existing test, worth keeping

`tests/agent-sessions.test.cjs:185` went red on the first pass: the sanitiser's `await` sat
between `const queued = sessions.busy()` and the hand-off, which D4 forbids — a turn queued
after the running one had already ended would never be drained. Moved up with the staging
awaits. That test pins the ordering on the route's source because the route has no harness
of its own, and it earned its keep.

### Drift found in the card's own description

- `_appStateLine` is at `agentLoop.mjs:730`, not 747.
- The description names three touch points; the seam is five files, because `pinned`
  travels through `routes/agent.js` and `services/agentSessions.mjs` on the way. Same shape,
  more files.

## Live check — Fabio

1. Restart the app (not reload — `services/agentLoop.mjs` is server-side).
2. Open a project, open a card into its history view, select an entry.
3. Agent panel, Start Over, then: `edit this image — make the sky green`.
4. **Green:** it works on the entry in front of you — no `list_cards` call in the tool
   strip, and it never asks you to attach anything.
5. **Red:** it calls `list_cards`, asks for an attachment, or picks a different entry than
   the one you have selected.

Worth a second pass with the entry changed: select an older entry in the same card's
history and ask again. It should follow the selection, because the line is rebuilt per turn
from `group.selectedIndex`.

# Live read 1 — Fabio, 2026-09-22 — RED

Project "Agent tests", card "Boy fishing flat cartoon", history t2i_003 / edit_004 /
edit_005 / inpaint_005, **inpaint_005 marked ACTIVE**. Ask: *"make the sky a bit reddish,
like dawn, like the sun is setting, and place some red eyes in the forest, peeking behind
the trees."*

Tool strip: LOOKING THROUGH THE PROJECT (= `list_cards`), FETCHING SAVED IMAGE DESCRIPTION,
CHECKING AVAILABLE MODELS, READING: APP:MASKING, READING KLEIN-9B'S SETTINGS.

**MPI-890's own faults (the wire):**
1. It called `list_cards` with the card open — the exact thing the Cards-rule clause forbids.
2. It named **edit_003** as "the current picture". That is not the active entry
   (inpaint_005), and no entry of that name is even in this card's history.
3. It told him to "click the card in the gallery to open it, pick the Mask tool" — while he
   was standing in the card. It did not know it was in the history view at all.

All three read like the workspace line never reached the turn. **Diagnosis NOT started.**
First read: the live `app.log` — the live profile is `%APPDATA%\Cubric Studio\logs\`, NOT
`Cubric Vision` (userData moved 2026-09-17). Find this turn, and establish whether the App
state line carried "The user is looking at the card". Candidates, in order: (a) the app was
not RESTARTED after the edit, so the server-side loop is the old one — the renderer is
served from the tree and a reload picks it up, the loop is not; (b) `state.currentPage` /
`currentParams.groupId` do not hold what `_workspaceForTurn` assumes on this path;
(c) `_sanitiseWorkspace` dropped the entry — `item.filePath` may not be under
`<project>/Media` in the shape assumed, so `ownedMedia` returns null and the line goes
silent by design. (c) is the one the unit tests could not see: they fed it a
hand-built path.

**NOT MPI-890's faults — they are MPI-888's Route rule, and the rule is wrong, not ignored:**
4. **An edit model can make several changes in one pass.** The agent treated two asks as
   two separate masked jobs. Fabio: "This can be done in one go."
5. **A sky / time-of-day change is a WHOLE-IMAGE change**, not a part. Dawn light falls on
   everything. The Route rule's one question ("does it name a PART?") classified "the sky"
   as a part and forked. Fabio: "the sky change would need to be on the full image. The eyes
   in the forest could possibly be masked, but there's no point."
6. It was eight paragraphs. MPI-888's own green condition is ONE line with both routes and a
   recommendation. Red on that too.

## Diagnosis of live read 1 — 2026-09-22, session 8fc9b288

The project IS "Agent tests" (`project.json` name); its FOLDER is still `Anime Kids and Dog`,
because a rename does not move the folder. `inpaint_005` is `selectedIndex: 3` of card
`204f6a5b…`.

- **(a) not restarted — RULED OUT.** The four edited files were last written 12:00–12:06Z;
  the server booted 12:32Z and again 18:07:46Z; the red turn ran ~18:10:55Z. It ran the
  new code.
- **(b) wrong state keys — RULED OUT.** Every way into the history view
  (`MpiGalleryBlock.js:293,447`, `agentPanel.js:79`, `navigation.js:517`) calls
  `navigate(PAGE_GROUP_HISTORY, { groupId })`, and `router.js:40` stores that as
  `state.currentParams`.
- **(c) the sanitiser dropped the entry — ROOT CAUSE.** A hydrated MediaItem's `filePath`
  is a `/project-file?path=C%3A%5C…%5Cinpaint_005.png&v=1790062432237` url, not the
  relative `Media/…` the typedef and the unit tests assumed. `_sanitiseWorkspace` ran it
  through `path.resolve(folderPath, …)` first, which on Windows yields
  `C:\project-file?path=…`; `_decode` looks for `/project-file?` and no longer finds it, so
  `ownedMedia` returned null for **every** real entry and the App state line went silent by
  design. Probe on the real sidecar: old call → `null`, ref passed straight → the absolute
  `…\Media\inpaint_005.png`.
- `edit_003` came from a **cached `look`** logged at 18:10:55Z — a ref from an earlier turn
  of the same conversation, which is all the agent had once the workspace line was gone.

**Fix:** `routes/agent.js` passes the ref to `ownedMedia` as sent — the same way the
video-by-reference attachment at `:159` already does. Scratch probe against the real
project: real entry survives as the absolute path; a `/project-file` url decoding to
`<project>\..\secrets.png` → null; no project → null.

**Test:** the three route tests in `tests/agent-loop.test.cjs` now feed the real
`/project-file?path=…&v=…` url (the escape case is a url decoding to `<project>\..\secrets.png`).
Old route line swapped back alone → **1 fail**, exactly "an entry inside the project Media/
survives"; fix restored → 0 fail. (The file was briefly under 848fbbb5's MPI-876 claim;
released after 59777960, message 8ea8c49c.)

`npm test` → **1796 tests, 1794 pass, 0 fail, 1 skipped, 1 todo** (the pre-existing MPI-867
todo). `npm run lint` and `npm run lint:components` both exit 0.

## Live check 2 — Fabio

**Restart the app** (the fix is server-side: `routes/agent.js`, `services/agentLoop.mjs`).
Same card, same entry, Start Over, same ask. Green: no LOOKING THROUGH THE PROJECT in the
tool strip, it names inpaint_005, it never tells you to open the card — and (MPI-888) it
runs the sky and the eyes as ONE whole-picture edit, or offers that in one line.

# Live read 2 — Fabio, 2026-09-22 — the wire is GREEN, the landing is RED

Ask: dawn, an orangey sky, red eyes lurking in the forest. No `list_cards` in the tool
strip; it looked at the open entry, ran ONE whole-picture Klein 9B edit, and said so in one
sentence. MPI-890's wire and MPI-888's rewrite both held.

**Red:** the result landed as a NEW card ("Dawn sky with red eyes", `edit_007`), so the
workspace he was watching drew no latents. Cause: `agentDispatch.js` routed only a MASKED
submit into its card (MPI-877 round 3), on the premise "a maskless one names no card".
MPI-890 broke that premise — the agent now edits the open card's entry by name. The size
change (768x1024 → 880x1184) is expected: SDXL source, Klein's own resolutions (Fabio).

**Fix:** `workspaceGenerationOpts(mediaItems)` — when the user is in a card's history and the
edited picture (first media item, in declared slot order) is an entry of THAT card, the
submit takes the same `existingGroup` + `scope: 'groupHistory'` opts a Cue press there sends.
A card not open still goes to the gallery (navigating is MPI-891). Found on the way: on any
history route, the masked one included, `_reportDone` would have RENAMED the user's card to
the agent's `cardName`; a result added to an existing card now never renames it.

Evidence: 4 new tests in `tests/agent-mask-dispatch.test.cjs` on the real url shapes (busted
entry url with `%5C`, the agent's `_projectFileUrl`): lands in the card; gallery page → null;
reference-only or a foreign picture → null; a source pin on the wiring and the rename guard.
`npm test` 1800 / 1798 pass / 0 fail / 1 skipped / 1 todo; both lints 0.

## Live check 3 — Fabio

Restart. Open the card, select an entry, same kind of ask. Green: latents draw in the open
workspace, the result is the card's next entry, and the card keeps its name.
