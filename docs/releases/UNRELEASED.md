# Unreleased — pending notes for the next version bump

> Scratchpad for changelog items accumulated between releases. When running
> `/mpi-version-bump`, fold every item below into the new
> `RELEASE_NOTES['<newVersion>']` entry in `js/data/releaseNotes.js` and the
> archival `docs/releases/YYYY-MM-DD-v<newVersion>.md`, then clear this file
> back to the header.
>
> **Cleared 2026-10-21 at the 2.1.2 bump (MPI-1210).** Every item was folded into
> `RELEASE_NOTES['2.1.2']` and `docs/releases/2026-10-21-v2.1.2.md`, plus MPI-1216, MPI-1220, MPI-1221,
> MPI-1223 to MPI-1226, MPI-1228, MPI-1229, MPI-1234, MPI-1236 and MPI-1238 straight from their commits.
>
> **Cleared 2026-10-19 at the 2.1.1 bump (MPI-1044).** MPI-1199 (the RunPod volume create) was
> folded into `RELEASE_NOTES['2.1.1']` and `docs/releases/2026-10-19-v2.1.1.md`; the re-cut added
> MPI-1201, MPI-1202, MPI-1203, MPI-1205 and MPI-1206 straight from their commits (none passed through this file).
>
> **Cleared 2026-10-19 at the 2.1.0 bump (MPI-1044).** Every item was folded into
> `RELEASE_NOTES['2.1.0']` and `docs/releases/2026-10-19-v2.1.0.md`; the engine line was
> corrected to 0.41.0 and the CubricVision.exe line moved to Important.
>
> **Cleared 2026-10-06 at the 2.0.1 publish (MPI-1026).** The one item here (the Settings
> microphone, MPI-1034) was folded into `RELEASE_NOTES['2.0.1']` and
> `docs/releases/2026-10-06-v2.0.1.md`; the other six 2.0.1 fixes never passed through this
> file and were written into those two files straight from their commits.
>
> **Cleared 2026-10-04 at the 2.0.0 bump (MPI-595).** Every item was folded into
> `RELEASE_NOTES['2.0.0']` and `docs/releases/2026-10-04-v2.0.0.md`, cut to one or two
> lines each; the Known issues lines (release body only, never `releaseNotes.js`) moved to
> that archival note's last section. The 1.6.x private-build entries were deleted, not
> folded: their content was already here.
>
> **Cleared 2026-08-15 after 1.4.2 shipped.** All nine items (4 new + 5 fixes) were
> folded into `RELEASE_NOTES['1.4.2']` and `docs/releases/2026-08-15-v1.4.2.md`.
>
> **Cleared 2026-08-11 after 1.4.1 shipped.** All nine bullets (1 new + 8 fixes)
> were folded into `RELEASE_NOTES['1.4.1']` and
> `docs/releases/2026-08-11-v1.4.1.md`, including the first-run entry an earlier
> commit (`e2b0ddbf`) had filed for 1.5.0 — Fabio retargeted the whole scratchpad
> at the patch, because nothing pending was a feature.
>
> **The reset is part of the bump and it got missed in 1.4.0** — the fold ran, the
> clear did not, which would have re-folded all of 1.4.0 into the next version and
> shipped every bullet twice. If you are folding a release and this file still holds
> the last one's items, that is the bug, not a backlog.
>
> **KEEP EVERY BULLET SHORT.** One or two lines: what it is, and why the user would care.
> The rule and what it looks like are in `docs/releases/README.md` § Content → "Length".
>
> **Before writing a "used to / previously / no longer" claim, check it against the
> last released tag** (`git show v<prev>:<path>`), per bullet. Code that changed two
> or three times inside one unreleased version reads like user-visible history but
> never shipped, and the entry is then simply false. Full gate:
> `.claude/skills/mpi-release/references/copy-review.md` § Gate 0.

## Important

- LTX 2.3 now comes in one version, the faster Balanced one. The High version is retired: it looked no better in our tests. If you only had High, install LTX 2.3 again in Models; High's 39 GB file is cleared the next time you uninstall a model (MPI-1095).
- LTX quality steps moved up one size. Medium is now 1216x704 (what High used to be), Low and Very Low are the old Medium and Low, and a new High of 1536x896 sits above. The old Very Low is gone. A clip on the same setting now comes out sharper and takes longer (MPI-1095).
- The NVIDIA PiD Upscaler is licensed by NVIDIA for research or evaluation only, so it is not for commercial work. Installing it now shows the licence first, and its tile in Models carries the non-commercial flag. If you already have it, use the SDXL models' upscale for work you sell or do for a client (MPI-1250).

## New

- New model: MOSS-Image, a text-to-image model that writes exact lettering on signs and posters, with a fast Turbo mode and Boxes for placing things. It also does image-to-image, inpaint, detail and upscale on your pictures (MPI-1243).
- Boxes can now read a picture for you, to make a new one laid out the same way (a magazine cover, a poster). Right-click a card and pick Create boxes: each thing in the picture gets its own named box, with what it is and any lettering written out, the shape follows the picture, and the prompt is replaced by a caption for the whole scene. While that picture is in Boxes the prompt box stays on text to image; Remove picture in the Boxes panel frees the other modes. Works on MOSS-Image and FLUX.3 Klein (MPI-1253).
- Use Tiles is redone: pick a Tile size (smaller tiles, more detail), and Describe each tile (on by default) names what fills each tile in a few words before the upscale, so grass is redrawn as grass. People and faces get their own gentle passes and are never described, so they keep their look. Use Grid is gone: Use Tiles replaces it, and an old Use Grid setting opens as Use Tiles (MPI-1232).
- When an update is ready, the Dev updates panel (the bell) shows an "Update to v…" button at the top, naming the version the posts below talk about (MPI-1242).

## Fixes

- The Model picker now lists featured models first, the same order as the Model Library, and MOSS-Image is featured (MPI-1245).
- The child-safety check reads more wording: plural body words and clothing "pulled aside" now get the picture looked at (MPI-1241).
- Cosmo now tells you how many tiles a Use Tiles upscale runs, up to the number the status bar counts (MPI-1237).
- Flow steps with a drawing area (Crop, Cut-out, Place, Paint, Edges) open at full width at once, instead of widening a pixel at a time for a few seconds (MPI-1255).
- Less noise in the log: the mascot freeze warnings now appear only with speed diagnostics on, and a RunPod connect that stops early no longer logs a false freeze (MPI-1255).
