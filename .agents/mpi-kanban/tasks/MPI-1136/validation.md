# MPI-1136 validation

## Round 3 (2026-10-16): how Fabio picks the cards he sends

Fabio: "send these last two cards that we created to a new project, and let's continue from
there. Or send all the cards that are audio to a new project, or all the cards that are video,
or all the cards that are marked with a dot, triangle, or whatever." On Cosmo AND MCP.

- ONE tool name and ONE route on both surfaces: `send_cards` -> `POST /connector/send-cards`.
  Cards by hand (MCP `groupIds`, Cosmo refs; a stack or a dropped selection sends all its cards),
  or picked with `kind` (image / video / audio), `mark` (dot / square / triangle, via `markOf`, so
  a legacy heart is a dot) and `newest` (the last N made), newest first. The route picks them off
  disk (`agentCards.selectCards`: stack members in, archived and stacks out) and copies them all
  in ONE call to the gallery's Add to project route.
- Target: `folderPath` (open or closed; the view stays put), or `newProject`, which the route
  creates and then OPENS once the cards are in ("let's continue from there"). Cosmo's chat then
  moves to that project's own conversation, as `create_project` does today.
- `list_cards` (both) already shows kind, mark and createdAt, newest first: unchanged.
- MCP `import_card` (round 1) is now `send_cards`; Cosmo's pull-in tool stays gone (round 2).
- Cosmo tool-schema budget: 15,323 -> 16,121 (+798).

## Round 1 (kept): the shared copy

The gallery's `add-from-cards` route also answers the new cards hydrated (`groups`), so a copy into
the OPEN project goes through `addGroup` and is not lost to the next save.

## Evidence

- `npm test` green; tests/import-card.test.cjs pins `selectCards` (newest, kind, mark, legacy
  heart, stacks, archived) and Cosmo's `send_cards` (refs, set refs, a generation's own result,
  attachment refused, made-up target refused, new project opened); tests/mcp.test.cjs the MCP tool.
- Live over MCP, 2026-10-16, own `app:isolated` (scratch profile + APP_DOCUMENTS), projects
  "MPI-1136 Source" (Red, Green, Blue; Green marked triangle) and "MPI-1136 Target":
  - two cards by hand to the CLOSED Target: copied 2, view stayed on Source;
  - `mark: triangle` to Target: Green only;
  - `kind: image, newest: 2, newProject: "MPI-1136 Episode 3"`: Blue + Green copied, Episode 3
    became the open project;
  - from the now-closed Source into the OPEN Episode 3, `cardName: "Blue again"`: landed, and a
    rename through the renderer afterwards kept it on disk;
  - `kind: audio` -> NO_CARDS; a made-up groupId -> NO_SUCH_CARD. Source untouched throughout.
- Cosmo live: PASSED by Fabio in his own app, 2026-10-17 (eye-test steps 1-4): "Cosmo tests
  tested and passed."
- MCP live: PASSED by Fabio, 2026-10-17 ("All right, cool. Everything passed."). In a fresh
  Claude Code chat (no repo) over the cubric-studio plugin: a pasted image went in with
  import_media and landed full size (768x1152) in "3D Cartoon Test" as imported_001.jpg; then
  "grab the photos from 3D Cartoon Test and create a new project named 3D Characters with it"
  made 3D Characters holding all three cards (bear, tiger, the imported image).
- Note, not a blocker: the imported card kept its filename, imported_001.jpg, as its name
  (import_media behaviour from MPI-1140, not this card).

## Eye test for Fabio (restart the app on this commit first)

1. Make two pictures with Cosmo, then: "send the last two cards we made to a new project called
   Test Ep 3, and let's continue from there". Test Ep 3 opens holding both, names kept.
2. Mark a card with a triangle, then: "send every triangle to <another project>". You stay put;
   open the other project: the card is there.
3. In a project with clips: "send all the videos to <another project>" (and once with audio).
4. Drag two cards into the chat: "take these to <another project>".
5. From Claude Desktop / Claude Code: the same asks over MCP (`send_cards`). Passed 2026-10-17.
