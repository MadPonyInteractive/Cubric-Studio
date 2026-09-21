# MPI-868 — The IMAGE and VIDEO labels do not carry their family colours

Fabio, 2026-09-21, on the finished model picker: *"The labels for image and video still don't
have the appropriate colours, which is something I've been asking for a while."*

This is the **wider colour pass** MPI-865's brief deliberately stayed out of, and which he had
previously called "a wider colour pass, not that card" during MPI-853. It has now been asked
for twice. It is not a one-file change: the same wrong colours are written out **five times
across four surfaces**, which is why fixing it in passing kept getting deferred.

## What is wrong

`DESIGN.md` § "The accent family" gives each media family its accent — **Vision rose** for
image, **Video orange** for video, **Audio green** for audio. None of the media labels use
them:

| Surface | Selector | Today | Should be |
|---|---|---|---|
| Tile media badge | `.mpi-tile__badge` / `--video` (`MpiTileSheet.css`) | image inherits muted ink; video its own | rose / orange |
| Tile media flags | `.mpi-tile__flag--mediaImage/Video/Audio` (`MpiTileSheet.css:137-140`) | `--ink-2` / `--accent-frost` / `--accent-warn` | rose / orange / green |
| Model picker head | `.mpi-model-picker__media-head--video` (`MpiModelPicker.css:81`) | `--accent-frost` | orange |
| Model Library head | `.mpi-model-library__media-head--video` (`MpiModelManager.css:133`) | `--accent-frost` | orange |
| Flow Library head | `.mpi-flow-library__media-head--video/--audio` (`MpiFlowLibrary.css:131-132`) | `--accent-frost` / `--accent-warn` | orange / green |

`--accent-frost` is a blue. Nothing in the accent family is blue, so a video label currently
reads as a fourth colour the design system does not have.

The image case has its own wrinkle, recorded in `MpiTileSheet.css:133-136`: image was given
`--ink-2` *because* it had no header colour of its own and the inherited muted ink was too dim
against a thumb. Vision rose answers that properly — but check the contrast on a light thumb
before assuming it does.

## Why it is one card and not five edits

The badge and the flags live in **`MpiTileSheet`, a Primitive shared by the Model Library, the
model picker AND the Flow Library**. Repainting it moves all three at once, which is the
point — but it also means a change that looks right in one library can be wrong in another.
Check all three, plus the Flow Library's audio row, which is the only surface with a third
media type.

## Before touching anything

1. **Read `DESIGN.md` § "The accent family"** for the exact tokens, and note the `color-mix`
   ban between two family accents.
2. **Never sample a colour off the mascot art or the website.** The values are written down,
   and `c:\AI\Mpi\Cubric Studio (Website)\styles\landing.css:30-34` wins any disagreement.
3. The three `__media-head` blocks were written to match each other on purpose
   (`MpiFlowLibrary.css:118-120` says so). Keep them matching — or collapse them, but that is
   a bigger change than this card asks for.

## Verify

Every media label — badge, flag and section head — reads its family accent in the Model
Library, the model picker and the Flow Library, including the Flow Library's audio row. No
hex, tokens only. `npm test` and `npm run lint:components` green. Then Fabio's eyes: this is
a colour judgement, so **verify mode is `user-ux`**.
