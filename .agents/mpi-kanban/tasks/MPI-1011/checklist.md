# MPI-1011 Checklist

Plan: `plan.md`. A 2.0 gate under MPI-595.

- [x] Phase 1: harmonizer mask grown in decode space (graph), proof (real nodes); live run = Fabio's look
- [x] Phase 2: Outpaint passes re-armed (`maxGrow`), tests; live multi-pass run = Fabio's look
- [x] Fabio's first look (2026-10-02): pass 2 never started; a seam where the edge cut the subject
- [x] Pass 2 fixed: `composeNextPass` reads the finished item's `filePath` (both twins), RED test first
- [x] Option 2 (Fabio): Klein's decode is the result; paste-back, harmonizer and mask chain removed
- [x] Outpaint has no cloud model (Fabio; MPI-918's slot)
- [x] Fabio's second look: a multi-pass fill lands every pass and shows no seam ("Fantastabomb.")
- [ ] CI green on the commit, then the done move
