# MPI-900 brief

Outpaint runs on FLUX.2 Klein 9B only, in one pass, with the baked instruction
"Replace the black area with the rest of the image." The crop step leaves the new area
transparent; ComposeColorMatch (Grade match) pastes Klein's fill over the untouched original,
so the original pixels never change colour.

**Waiting on:** Fabio's live run in the app (Ctrl+R) — original pixels unchanged, no seam at
the border, output is the frame at source resolution.
