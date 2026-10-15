# MPI-1149 validation

**Bug (Fabio, live, 2026-10-15):** Video Edit, "Change the background", cartoon monkey on a horse clip + a
mountain picture, was refused with the child-safety "picture" message. `app.log`:
`[childSafety] refused a user run of flowVideoEdit (picture)`, right after `Input_Look` and `Input_Kept`
were described.

**Root cause:** `Input_Kept` is the describer's account of the clip's own subject, asked for "every garment
and accessory". For an unclothed animal it writes "wears no clothes" / "no clothing", which `asksForNudity`
reads as a nudity request (probe: all four such phrasings hit; the user's own words and the mountain
description do not). That woke the picture check, and the age question did not answer a bare NO on the
cartoon frame. The exact describer text was not captured; the trigger path is proven by the probe and the log.

**Fix (Fabio's pick):** `lookTexts(config)` = `configTexts` minus a `*_Kept` param. The picture-check trigger
(`needsPictureCheck`, `lookWanted` in `generationService.enqueueGeneration` / `_judgeThenQueue`) reads it;
the text tier still reads `configTexts`, Kept included.

**Evidence:** `node --test tests/child-safety.test.cjs tests/child-safety-gate.test.cjs` → 44 pass, 0 fail.
New tests both ways:
- kept "monkey wearing no clothes", describer set to YES → queued at once, no describe call;
- kept "a young boy, naked" → refused by the text tier;
- the same unclothed words in `Input_Look` (a change) → looked at, refused on YES;
- unit: `lookTexts` drops only `Input_Kept`, `configTexts` still has it.

**Not covered here:** why the age question did not say NO about a monkey and a horse (animal and creature
characters), and Fabio's suggestion to look for genitalia in the picture instead. Follow-up.
