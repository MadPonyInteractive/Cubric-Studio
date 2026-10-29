# Unreleased — pending notes for the next version bump

> Scratchpad for changelog items accumulated between releases. When running
> `/mpi-version-bump`, fold every item below into the new
> `RELEASE_NOTES['<newVersion>']` entry in `js/data/releaseNotes.js` and the
> archival `docs/releases/YYYY-MM-DD-v<newVersion>.md`, then clear this file
> back to the header.
>
> **Cleared 2026-10-27 at the 2.1.3 bump (MPI-1286).** Every item was folded into
> `RELEASE_NOTES['2.1.3']` and `docs/releases/2026-10-27-v2.1.3.md`, cut short and merged where they
> belonged together, plus MPI-1239, MPI-1249 (MOSS styles), MPI-1294 and AUDIT B1 straight from their commits.
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

- **The queue docks beside the gallery.** In the gallery it opens as a right-hand panel that moves the gallery aside instead of covering it, with a toggle in the gallery toolbar, and stays open as you come and go. (MPI-1320)
- **Dev updates reach you mid-session.** A new post pops up as a notice while you work, and View changes opens it, with the Update button there when a new version is out. (MPI-1321)
- **A project an agent makes shows on the home screen at once.** A project created by an agent, or a picture it adds to a project you have closed, now appears in the home list straight away, without leaving and coming back. (MPI-1323)
- **Video models reach the voice library.** On any model that takes a sound, such as LTX or MiniMax H3, the + in the prompt box now offers the Voice library next to your own media. (MPI-1325)
- **Cosmo makes a words-only clip with the H3 you have.** With only H3 Reference or Singularity H3 installed, a text-to-video ask now runs on it instead of offering the 21 GB MiniMax H3 download. (MPI-1327)
- **Cosmo uses the models you have before offering a download.** It no longer offers to install a model you didn't ask for when one you have does the same job; name the model and it still offers. For pictures, Qwen-Image 2.1, FLUX.3 Klein and MOSS Image now come right after Krea 2. (MPI-1332, MPI-1346)
- **A lighter engine: the Impact Pack and Impact Subpack are gone.** Face, person and tile detailing and Auto Mask now run on our own nodes, with the same results. A Flow you got elsewhere that uses BboxDetectorSEGS, DetailerForEachPipe, FromBasicPipe, ToBasicPipe, ImpactDilateMask, ImpactMakeTileSEGS, ImpactSEGSLabelAssign, ImpactSEGSToMaskList, ImpactSegsAndMask, ImpactSimpleDetectorSEGS, MaskDetailerPipe, MaskToSEGS, SAMLoader, SEGSPreview, SegsToCombinedMask or UltralyticsDetectorProvider needs the Mpi node of the same name. (MPI-1339)
- **Three more node packs gone: Mickmumpitz Nodes, Audio Separation and Frame Interpolation.** The 360 Panorama and Stems Flows and Interpolate run on our own nodes. A Flow you got elsewhere that uses MickmumpitzPanoWarp, MickmumpitzPanoHarmonizeBoundary, MickmumpitzPanoKrea2Reference, MickmumpitzPanoRollHorizontal, MickmumpitzPanoSeamMask, AudioSeparation or RIFE VFI needs MpiPanoWarp, MpiPanoHarmonizeBoundary, MpiPanoKrea2Reference, MpiPanoRollHorizontal, MpiPanoSeamMask, MpiAudioSeparation or MpiRifeVFI instead. The RIFE weight (20 MB) downloads once more into its new folder. (MPI-1342)
- **KJNodes is gone too, the biggest pack left.** Resize, colour match, mask grow, frame ranges, batch joins and LTX's guidance and audio masks run on our own nodes, with the same pixels. **Head Swap owners: download Head Swap 1.1.0 again from Gumroad**, because 1.0.0 needs KJNodes and stops working. A Flow you got elsewhere that uses ColorMatch, GetImageRangeFromBatch, GrowMaskWithBlur, ImageBatchExtendWithOverlap, ImageBatchMulti, ImageResizeKJv2, ImageConcanate, LTX2_NAG, LTXVAudioVideoMask, LoraExtractKJ or VAELoaderKJ needs MpiColorMatch, MpiImageRange, MpiGrowMaskBlur, MpiImageBatchExtend, MpiImageBatchMulti, MpiImageResize, MpiImageConcat, MpiLTX2NAG, MpiLTXAudioVideoMask, MpiLoraExtract or MpiVAELoader instead. (MPI-1341)
- **The floating window shows live video latents.** Minimise the app during a video generation and the floating Latents window now loops each step's latent clip, like the gallery does, labelled with the model's name, instead of freezing on one frame. (MPI-1345)
- **The video length slider stops at 15 seconds.** On every video model, including Wan 3.0, which allowed 30. That is as long as MiniMax H3 is trained to go; longer clips are coming as their own setting. A length you saved or reuse above 15 opens at 15. (MPI-1349)
