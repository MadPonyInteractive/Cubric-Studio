# MPI-859 — checklist

- [ ] A method run LANDS AS A CANDIDATE, not as the frame's mask — `Cut out` stays locked until it is committed (the image workspace's MPI-426 rule: a bare detection is a proposal)
- [ ] `Mask` runs; while a candidate waits the row shows **Add** and **Subtract**, and `Clear` is untouched
- [ ] Add composes: `track = track OR candidate`. Subtract composes: `track = track AND NOT candidate`. Soft edges survive both (no binary cut)
- [ ] The scope radio (All / Frame / Selected) says which frames the run AND its commit touch; frames outside it keep what they had
- [ ] Background → By colour on one frame keeps BOTH (Fabio's report), and the third method stacks on the second
- [ ] The Mask Brush still composes on top: `(track OR manual) AND NOT subtract`, and an open brush frame picks the new track up (`_refreshEditBase`)
- [ ] A candidate is DROPPED by every exit: method change, tool teardown, a frame-list change, and Clear
- [ ] The tint and the strip show the candidate while it waits, and the committed mask once it lands — one rule, still "the highlight is what goes"
- [ ] `tests/gif-frame-masks.test.cjs` covers the compose math and the candidate lifecycle, and is red without the fix
- [ ] `docs/masking-sam3-gif.md` records the candidate + commit model (it is already over the 200-line cap — a split may be the honest answer)
