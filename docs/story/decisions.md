# Decisions log (DESIGN)

> Part of [README.md](README.md). Newest last. A reversal gets a new dated line; never edit an
> old one.

## 2026-10-13 — brainstorm with Fabio (MPI-1134)

- **Project = episode / sequence block, not the whole movie.** A movie or series is several
  projects; Elements are global and carry identity across them.
- **Story is a gallery card** (recipe in sidecar, Mix/GIF pattern), ~30 s - 3 min, importable
  between projects. Rejected: one story per project file (no import, no alternates); chat-only
  (no place to see the shot list).
- **Storyboard fully editable; Cosmo is a helper.** MCP gets the same routes.
- **The Story casts Elements only**; a character sheet is a file inside the Element.
- **Dialogue = voice by reference on H3 Reference.** Rejected: TTS + lip sync (three
  generations and hope). Lip sync MPI-538 deferred.
- **Character shots on H3 only** for now; LTX / Wan 2.2 for B-roll and location shots. LTX 2.5
  needs ~3 takes where H3 lands one.
- **Shots 1-5 s**, longer only when required.
- **Draft → upscale → detail, each reviewed, each a history entry.** Nothing final after upscale.
- **Cloud shots render final directly** (no latent, no cheap draft), marked as costing money.
- **Low-res chain then upscale** (MPI-591 D5) promoted from "later" to the core draft pass,
  subject to H3 Reference's canvas-sets-framing finding.
- **Blocked on Singularity H3 research** (MPI-1135) and the video detailer (MPI-557).
- **Infinite Video Flow: build it**, outputting a Story card. Rejected: graph-only chaining.
- **Multi-angle locations: covered** by MPI-1039 + the 3D Scene / 360 pano (MPI-623).
- **Passes as history entries on the same card: Story shots only.** Finish / Continue elsewhere
  keep landing a new card; app-wide is a later call.
- **Ships on master behind `dev_mode`, no branch.** Rejected: a long-lived feature branch with
  cherry-picked fixes (shared checkout, drift on the hottest files, and it would undo the
  one-release-per-change-from-master rule of 2026-10-05). Standalone pieces release ungated.

## Prior art — Calliope (github.com/benjiyaya/Calliope, read 2026-10-13)

Taken:
- Scene (screenplay unit) vs clip (render unit); `dialog_lines_covered`, every line once.
- A continuity ledger: project overview (style, pace, soundscape, camera grammar, lighting)
  + per-shot entries with `state_after`.
- Compile every prompt first, user reviews, then queue all jobs.
- Structured `ask_user` cards with a scope (render / destructive) — we already do this as app
  confirm cards.

Where we beat it:
- Their continue-from-previous was removed; extension is manual per clip. Ours is automatic.
- Fixed 8 s cap for every model; we read real model limits.
- No audio pipeline (only H3's in-prompt dialogue), export is a flat ffmpeg stitch with 0.5 s
  crossfades. We have voice refs, Stable Audio, and Mix.
- Whole-board continuity rewrite in one LLM call; ours updates per shot.

Not copied: permissions granted by regex over the user's prose; silently stripping images or
tools when a provider refuses them (see memory `reference_calliope_competitor_agent`).
