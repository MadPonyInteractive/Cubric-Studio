# Unreleased — pending notes for the next version bump

> Scratchpad for changelog items accumulated between releases. When running
> `/mpi-version-bump`, fold every item below into the new
> `RELEASE_NOTES['<newVersion>']` entry in `js/data/releaseNotes.js` and the
> archival `docs/releases/YYYY-MM-DD-v<newVersion>.md`, then clear this file
> back to the header.
>
> **Cleared 2026-09-01 after 1.4.3 shipped.** All three fixes were folded into
> `RELEASE_NOTES['1.4.3']` and `docs/releases/2026-09-01-v1.4.3.md`. Note this file is
> the *branch's* scratchpad — 1.4.3 was cut from the `1.4.2` maintenance branch, so it
> held only the three issue-#2 fixes, never master's accumulated backlog.
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
> **Before writing a "used to / previously / no longer" claim, check it against the
> last released tag** (`git show v<prev>:<path>`), per bullet. Code that changed two
> or three times inside one unreleased version reads like user-visible history but
> never shipped, and the entry is then simply false. Full gate:
> `.claude/skills/mpi-release/references/copy-review.md` § Gate 0.
>
> **Cleared 2026-09-07 after 1.5.0 shipped.** Everything below was folded into
> `RELEASE_NOTES['1.5.0']` and `docs/releases/2026-09-07-v1.5.0.md` - 3 important
> changes, 5 new, 13 fixes, plus an engine note for the ComfyUI 0.31.0 -> 0.34.0 bump
> and the matching Pod-image move. Like 1.4.3 this was cut from the `1.4.2`
> maintenance branch, so it carried the H3 + non-Flow image work and never master's
> Flow backlog.

<!--
Gate 0 re-run against v1.5.0 on 2026-09-15 (MPI-761):
  - Inpaint guide: v1.5.0's `commands.inpaint.help` says "The model can NOT see what is
    under your mask" and "Leave the prompt EMPTY to remove", while all nine inpaint graphs
    it ships run LanPaint_KSampler. v1.4.4's klein_t2i.json has 0 LanPaint nodes and
    v1.5.0's has 1, so the old copy was TRUE through 1.4.4 and wrong from 1.5.0 on:
    "since 1.5.0" is accurate. Text ported from master's c7493555 (MPI-367).
-->

## Fixes

- The Inpaint guide now describes how Inpaint actually works. Since 1.5.0 the model sees
  the whole picture under your mask, an empty prompt does nothing, and removing something
  means naming it, for example "remove the tattoo". The guide still said the opposite of
  all three. The Detail guide, which compared itself to Inpaint, is corrected too.
