# Unreleased — pending notes for the next version bump

> Scratchpad for changelog items accumulated between releases. When running
> `/mpi-version-bump`, fold every item below into the new
> `RELEASE_NOTES['<newVersion>']` entry in `js/data/releaseNotes.js` and the
> archival `docs/releases/YYYY-MM-DD-v<newVersion>.md`, then clear this file
> back to the header.
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

## New

- **FLUX.3 Klein.** Black Forest Labs' new model: text to image, edits with up to ten reference images, and an edit can now pick its own frame size. A Turbo button switches between the fast and the more natural base model, up to 4K. A Boxes button slides up a panel behind the prompt box where you draw where things go, while the prompt and ratio stay usable: name each box (cat, dog, woman) and mention it in the prompt as `<cat>` (type `@` to pick one), add an optional short description, darken a bright picture to see the boxes, and Enhance plans the picture around them. An edit with boxes and nothing typed in the prompt writes its own instruction from the boxes, so the rest of the picture stays. Moving, adding or removing a box after Enhance switches the Enhance button off again, so a run never uses words planned for the old boxes; press Enhance again. Reuse brings the boxes back. (MPI-1181)
- **Custom size on edit.** Klein 4B and 9B, Krea 2, Qwen-Image 2.1, Boogu, Qwen Edit and cloud Seedream 4 / 4.5, FLUX-2 Dev and Klein 9B can now pick the edited picture's frame: a Custom size button, off by default, unlocks the ratio and resolution. A drawn mask keeps the original frame. (MPI-1207)

- **Cosmo now sees pictures, on a cheaper model.** Cosmo's default model is now MiMo-V2.6-Flash: it scores as well as the old default on our agent tests at about 25% less per chat, and can look at a picture itself when a description is not enough (is this the same face, how grainy is it). Scores for every tested model are at bench.cubric.studio. (MPI-1208)

## Fixes

- **A gated model asks for your Hugging Face token only once.** FLUX.3 Klein and Klein 9B each asked for a token and then forgot it; the first token that checks out is now saved, encrypted, like your API keys, and the next licence verifies with it. Settings > External Connections can clear it. (MPI-1215)

- **Cosmo can ask FLUX.3, Krea 2 and LTX for their real resolutions (1K, 2K, 4K), and an edit it runs keeps the picture's own frame unless a size is asked for.** (MPI-1208)

- **The Windows app is now signed.** Every program in the Windows download carries a Mad Pony Interactive signature, so Smart App Control should no longer block Cubric Studio from opening. SmartScreen may still ask once while the new signature earns its reputation. (MPI-616)

- **Ultimate SD Upscale no longer breaks the engine on a fresh Windows PC.** The app now installs the upscaler's missing part itself, so the engine no longer reports "Part of the engine did not install" when Windows rejects the download. An engine already showing it repairs itself on the next start. (MPI-1213)

- **An engine update started twice no longer deletes the engine.** A second update, repair or install asked for while one runs now waits on the running one instead of starting its own, which could collide with it and wipe the engine. (MPI-1204)
