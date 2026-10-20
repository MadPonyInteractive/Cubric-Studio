# MPI-1211 — bench.cubric.studio: an owner key that skips the 10-a-day upload limit

Fabio, 2026-10-20: "we are the boss, why don't we get more?" Our own batch uploads (MPI-1208: 3 runs per
model, several models a day) hit the per-sender limit of 10 POSTs a day; users never do (one in-app run =
one POST, ~15 min each).

- Worker `c:\AI\Mpi\mpi-ci\cubric-bench`: a POST carrying header `X-Owner-Key` equal to the `OWNER_KEY`
  secret skips the rate limit (and never reads the IP). Wrong or missing key = the normal limit, no hint.
- Key lives in `C:/Users/Fabio/.secrets/bench-owner.txt` and in the Worker secret, nowhere else.
- Done: test for both paths, `npm test` green, deployed, one real owner POST past today's limit.
