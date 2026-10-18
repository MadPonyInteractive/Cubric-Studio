# MPI-1186 Brief - Bench NSFW LTX 2.3

Member of MPI-1179 (New Models to Test). Split out of MPI-343's "NSFW LTX 2.3" entry on
2026-10-18, when MPI-343 merged into MPI-1179 (MPI-343 had absorbed MPI-339 for it on
2026-08-01). MPI-343's `plan.md` keeps the shared method and its `brief.md` the original notes;
read both before starting.

## The candidate

CivitAI 10Eros LTX 2.3, plus an int8 conv-rot build and a DMD workflow. A possibly-better
`sulp` variant is also linked. MPI-339's archived card may hold the original links.

## Order

1. **Licence flags first.** This is the entry most likely to fail on licensing rather than on
   quality. CivitAI lookups need Fabio's VPN on (UK region block): ask, run, then tell him so he
   can turn it off. Do the CivitAI half BEFORE any R2 work, the VPN throttles uploads ~15x.
2. Same measured-delta bar as every other member: REPLACE vs ADD vs DROP against what we ship.

LTX 2.5 (MPI-1095) may make this moot: if 2.5 replaces 2.3, a 2.3 finetune is a dead end.
Check MPI-1095's state before spending a GPU hour here.

## Done means

A written REPLACE / ADD / DROP decision backed by a licence check and a measured delta. A "no"
is a complete answer and closes the card.
