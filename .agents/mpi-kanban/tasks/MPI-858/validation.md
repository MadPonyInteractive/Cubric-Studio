## VERIFIED by Fabio — 2026-09-21

**His words:** *"I just did a test to verify 858. It's verified. It does not come out black."*

Run live in his own app on `gif_113` (Cubric Studio Mascots, 79 frames, 1536x640). That was the
one live check this card was held for: cutting an already-transparent clip no longer returns a
black background.

Code shipped as `e83b219e`, which is an ancestor of `1d4215bd` — CI Tests run **35541611838**,
conclusion `success`.

Closed on his verification. The card's workspace was under session `0d099d28`'s write claim,
stale since 2026-09-20T19:22Z; Fabio overrode it explicitly (*"858 can be parked. It's done"*),
which is the user decision the lifecycle rules defer to on a stale claim.
