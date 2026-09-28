# MPI-913 plan

Built as MPI-941 Phase 5. The plan lives in `.agents/mpi-kanban/tasks/MPI-941/plan.md` § Phase 5.

Approved by Fabio 2026-09-27 ("go, use your tighter version"): on a local Ollama agent, a job that runs on
this PC's GPU (not billed, no Pod) releases Ollama at dispatch, ends the turn under a waiting line instead of
a second chat round, and a message typed meanwhile waits for the drain. Copy: "A generation is running on your
graphics card. Cosmo runs on the same card, so Cosmo waits for it to finish. Press Stop on the generation to
talk now."
