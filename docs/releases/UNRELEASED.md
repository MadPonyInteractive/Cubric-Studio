# Unreleased — pending notes for the next version bump

> Scratchpad for changelog items accumulated between releases. When running
> `/mpi-version-bump`, fold every item below into the new
> `RELEASE_NOTES['<newVersion>']` entry in `js/data/releaseNotes.js` and the
> archival `docs/releases/YYYY-MM-DD-v<newVersion>.md`, then clear this file
> back to the header.
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


## What's new

- **Qwen-Image 2.1.** Makes and edits images, up to eight references in one edit, and can return a transparent background: turn on No Background in the prompt box settings, or ask the agent for a picture with no background. Eight styles work on every operation, and an edit with an empty prompt and a style restyles a photo like a filter. Research licence: the images are not for commercial use.
- **Character Sheet from Images, a new Flow.** Box the face in a picture of a character you already have, add a full-body picture if you like, and get the same three-view sheet as Character Sheet. Runs on Qwen-Image 2.1 or FLUX.2 Klein 9B.
- **Character Sheet Editor, a new Flow.** Change one thing on a character sheet you already have: the clothes, glasses or a hat, the hairstyle, a beaten-up or muddy look, the body shape or the age. All three views change together, the result is a new card, and your sheet stays as it was. Body shape and ages of 12 and under run on Qwen-Image 2.1 (not for commercial use) and need it installed; the rest runs on FLUX.2 Klein 9B. It has the LoRA cog wheel too.
- **Video Edit, a new Flow.** Swap the person, head or outfit in a clip, change its background, or make any edit you describe, from a picture or in words. Name a part under "Only change" and just that part is redrawn, the rest kept as filmed. Pick its resolution, from 576p up to 4K (2K and 4K need a very large GPU). Runs on MiniMax H3 Reference, and Cosmo can run it too. Keep clips short: 5 seconds can take 20 minutes.
- **Your own LoRAs in more Flows.** Upscale Video, Video Edit, Extend Video and Character Sheet from Images now have the cog wheel beside the model, which opens the same LoRA panel as that model's own generations.
- **Use Tiles, beside Use Grid in every model's Upscale.** It redraws the picture in 1024 px tiles, so very large pictures work, and at 1x it adds detail without enlarging. Cosmo and the MCP tools can use it too.
- **A child-safety check on every prompt.** Cubric Studio is for adults, and adult content is untouched. A prompt that puts someone under 18 in a nude, sexual or suggestive picture, or a child under 16 in swimwear, is refused before it runs, whether you typed it, the Enhancer wrote it, or Cosmo or another AI app sent it. Asking to undress someone in a picture or clip first checks that no one in it could be under 18.
- **What your Pod is costing, in the status bar.** While RunPod is connected, the bar at the bottom shows the spend so far next to REMOTE, and next to the timer while a job runs, so you can see it without going back to the home page.

## ComfyUI Engine

- **ComfyUI 0.39.0 (was 0.34.0).** It updates itself on first launch in about a minute, with no full re-download, and custom nodes you added yourself stay.

## Fixes

- **A picture in a Flow's inputs shows as a thumbnail.** It loaded at full size, again every time you went back to that step, so a big photo visibly loaded each time.
- **Character Sheet's headless front body no longer cuts bits of clothing away.** It searched the whole body for the head and its hat, so a bow or a strap could vanish with the head. It now searches only round the face.
- **RunPod stages a model as soon as it installs.** With "Stage all models on connect" on, a model you installed while connected waited for the next connect, so its first generation was slow.
- **Switching to a new RunPod volume mid-session gets the shared engine files too.** Klein previews looked like coloured noise there, and SAM3 masking and Describe had nothing to load until the app was restarted.
- **Compare labels each side with its History name.** An imported image showed its full file path instead.
- **Focus mode (F) shows your image again.** On an image it turned the whole screen black, with Compare on too.
- **Enhance and Describe work on ComfyUI without installing anything first.** Without the Image Describer plugin or a Krea 2 model, Enhance failed with an error and Describe asked for the plugin. Their 4.88 GB text encoder now installs with the engine, and the plugin is gone.
