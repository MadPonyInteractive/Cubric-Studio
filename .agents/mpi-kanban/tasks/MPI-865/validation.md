# MPI-865 Validation

## Built — 2026-09-21

Three files, 34 lines. Automated checks, all green:

- `node --test tests/model-picker-cloud.test.cjs` — **9 pass, 0 fail**.
- `npm test` — **exit 0**, 1679 pass / 0 fail across 1681. The one item the runner lists
  under "failing tests" is `agent-video-attachment.test.cjs`, a `todo`-annotated known gap
  owned by **MPI-867** (MPI-817 lost its UI half to MPI-797 phase 3). It touches no file
  this card edits and does not move the `fail` count.
- `npm run lint:components` — exit 0, `--max-warnings=0`.

**The tests are proven non-vacuous, one fix at a time.** Each of the six changes was backed
out on its own and the suite re-run: every one turned the suite red with **exactly one**
failing test, and green again on restore. A suite covering six fixes otherwise proves one.

Two traps caught during that proof, both of which had the check passing while running
nothing — worth naming because each reads as success:

1. The backing-out script used LF-terminated needles against files that are **CRLF** on
   disk. Nothing matched, nothing was patched, and all six cases reported "green".
2. The replacement parser scraped node's `✖` marks through a pipe that decodes as
   **cp1252** on Windows. The mark is mangled, so the match found no failures whether the
   run passed or failed. Switched to the process exit code, which cannot lie that way.

## What changed

1. **The badge.** One row in `TILE_FLAGS` (`MpiTileSheet.js`), so the cloud marker lands in
   the same top-right stack as `--featured` and `--deprecated` rather than as a second
   mechanism. Not a `cloudImage`/`cloudVideo` pair: the tile root already carries
   `mpi-tile--video`/`--image`, so the family colour is one CSS descendant rule.
2. **The colour.** `--vision-accent` base, `--video-accent` under `.mpi-tile--video` —
   DESIGN.md's "colour states what a surface is ABOUT", the same rule MPI-853 gave the
   price chip. The test **resolves the cascade** (the override carries two class selectors
   against the base's one) rather than grepping for both rules and assuming.
3. **Bug 1, `CLOUD · BALANCED`.** A size tier is a *weight* class. A test asserts against
   the real ModelDefs that no cloud model has one, so the fallback described nothing.
4. **Bug 2, `LORA & UPSCALE`.** Dropped, not disabled. Verified against the ModelDefs: no
   cloud model declares LoRAs, none has an upscale op, and `MpiModelSettings` is entirely
   local `loras/` and `upscale_models/` folders a DeepInfra endpoint cannot reach. A
   disabled button would keep advertising a setting that is never coming. A test fails if a
   future cloud model ships with either, so the hidden control gets revisited rather than
   quietly lying.
5. **Folded in (discovered, same file, same rule).** The picker's subtitle read
   `24 installed`, counting sixteen models that were never downloaded — the exact fact
   MPI-853 already settled for the library's two counts. Now `8 installed · 16 cloud`, and
   **byte-identical to before when no key is saved**, so a user without one sees no change.

## For Fabio to look at

Open the model picker from the prompt box (not the Model Library — that is MPI-853's
surface and is unchanged).

1. A cloud tile carries a **badge in the top-right**, same slot and size as the featured
   star. Hover it: "Runs on your own API key".
2. **The badge's colour follows the media, not the price** — rose on Seedream / Nano
   Banana, Video orange on Seedance / Wan / Veo. Check one of each side by side.
3. **`CLOUD · BALANCED` is gone**; a cloud tile's second line reads just `CLOUD`.
4. **No `LoRA & Upscale` button on a cloud tile.** A local tile still has its.
5. **The subtitle** at the top now splits the count. Say if you would rather it read
   differently — this one is a judgement call I made from MPI-853's precedent, not
   something you asked for, and it is four lines to change or drop.

## Deliberately NOT touched

- **The media flags' colours** (`--mediaImage` / `--mediaVideo` / `--mediaAudio`). Shared
  with the Flow Library, and you already called repainting them "a wider colour pass, not
  that card".
- **The Model Library's paid tiles get no badge.** They sit under a "DeepInfra models"
  header with a price chip that already carries a cloud glyph, so the badge would be
  redundant there. The picker has no section header, which is exactly why it needs one.
- **`js/utils/icons.js`** — claimed, but untouched: the `cloud` glyph already existed.

## Approved — 2026-09-21

Fabio checked it in the app and signed off from the screenshot: *"Yeah, it looks nice."*

All five points confirmed visually in the picker: the cloud badge sits in the featured-star
slot; **rose on the sixteen image tiles and orange on the video row**, so the family colour
follows the media rather than the price; the second line reads `CLOUD` with no `BALANCED`;
no cloud tile carries `LORA & UPSCALE` while every local tile still does; and the subtitle
reads `7 installed · 16 cloud`.

The folded-in subtitle change was accepted as-is — no comment against it.

**Raised in the same breath, and NOT part of this card:** the `IMAGE` / `VIDEO` labels still
do not carry their family colours, which Fabio notes he has asked for more than once. That is
the wider colour pass this card's brief deliberately stayed out of. Opened as **MPI-868**.
