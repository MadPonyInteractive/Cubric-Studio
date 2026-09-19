# MPI-819 Checklist

- [ ] `.husky/pre-push`: a push that moves a card to `done` is refused while the card's own code commit is unjudged, in flight, or brought NEW failing specs
- [ ] it does NOT block a close during someone else's red (same failing specs as the run before)
- [ ] fails open: no gh, no runs, shallow history
- [ ] `tests/pre-push-done-gate.test.cjs`: MPI-811's real close replayed against fixture runs - blocked, and the three pass cases
- [ ] `close-out.md` points at the gate
- [ ] pushed, run green, THEN closed (the gate applies to this card too)
