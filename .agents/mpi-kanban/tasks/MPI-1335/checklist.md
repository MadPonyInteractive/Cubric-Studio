# MPI-1335 Checklist

- [x] Step 2b: lip bench (as shipped / soundtrack / swap LoRA / both) on ref2v_004, template 6
- [x] Steps 1 + 2 shipped (pad up / cut back + soundtrack): raw c68d25ac4, synced API == builder, npm test green (API staged, commit at handoff)
- [ ] Windowed edit pass with MPI-1336 (pad up, cut back as the last window's rule; RAM per window)
- [ ] Steps 1-3 per window: grid pad, soundtrack wired, words decision
- [x] Step 4: Reuse repro - DROPPED by Fabio 2026-10-29 (not reproduced on 3 paths; reopen only if it happens again). No-dialog Reuse fixed 0dca51d4e
- [ ] Step 5: re-run showcase sections, Fabio judges by eye and ear
