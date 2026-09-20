# MPI-859 — checklist

- [x] A method run LANDS AS A CANDIDATE, not as the frame's mask — `Cut out` stays locked until it is committed (the image workspace's MPI-426 rule: a bare detection is a proposal)
- [x] `Mask` runs; while a candidate waits the row shows **Add** and **Subtract**, and `Clear` is untouched
- [x] Add composes: `track = track OR candidate`. Subtract composes: `track = track AND NOT candidate`. Soft edges survive both (no binary cut)
- [x] The scope radio (All / Frame / Selected) says which frames the run AND its commit touch; frames outside it keep what they had
- [x] Background → By colour on one frame keeps BOTH (Fabio's report), and the third method stacks on the second
- [x] The Mask Brush still composes on top: `(track OR manual) AND NOT subtract`, and an open brush frame picks the new track up (`_refreshEditBase`)
- [x] A candidate is DROPPED by every exit: method change, tool teardown, a frame-list change, and Clear
- [x] The tint and the strip show the candidate while it waits, and the committed mask once it lands. **Written expecting one rule; it turned out to be two.** A proposal is drawn AS ITSELF (no Grow, no Invert flip) — it is the one time the highlight is not "what goes", because nothing has gone anywhere yet, and flipping it would mark the whole frame for a SAM3 subject. The hint line says so while the commit row is up. Whether it also wants its own COLOUR is Fabio's call (validation.md)
- [x] It did: **a proposal wears `--accent-ok` green, a committed mask stays `--mask-fill` white** (Fabio, 2026-09-20, board message `2a2cfb4f`). Both surfaces — the CSS tint during playback and `MpiCanvas.setMaskDisplayProposal()` on the canvas that is up while the tool is. The two comments asserting the dead carve-out (`styles/01_base.css:142`, `MpiGifViewer.css:91`) are rewritten, and `commitMask()` in `gif-cutout.spec.js` asserts the colour changes hands on every landing run — proven red by backing the flag out
- [ ] **Fabio's own eyes on a real clip.** The green is on screen far more here than in the image workspace, which is the argument he overrode. Reload is enough; `routes/` is untouched
- [x] `tests/gif-frame-masks.test.cjs` covers the candidate lifecycle (7 pass); the compose math is proven on real pixels in Chromium, which Node cannot do. **The red-without-the-fix proof is not these** — a new API is trivially red — it is the two `gif-cutout.spec.js` alpha assertions that read the opposite before this: `f2(C,C)` 0 → 255 and `k1(SZ-7,SZ-7)` 255 → 0
- [x] `docs/masking-sam3-gif.md` records the candidate + commit model (it is already over the 200-line cap — a split may be the honest answer)
