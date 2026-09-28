# MPI-913 validation

Built as MPI-941 Phase 5 (session 2f2883e4, 2026-09-27). Approved by Fabio ("go, use your tighter version").

## Finding (the card's "check first")
The agent's `generate` does NOT block by default (`pending.then(settle)`, `services/agentLoop.mjs`): the turn
takes a second chat round to reply, which kept (or reloaded) the Ollama model beside the render, and a message
typed mid-render loaded it again. So the release alone was not the fix; the waiting message is needed too.

## Fix
- `_gpuJobs`: a dispatch that is not billed (`_askSpend` null, or `batch.billed` from the batch's one quote) while
  `engineIsLocal()` (new, `services/agentTools.mjs`: no RunPod Pod) is a job on this PC's card.
- On such a dispatch with a local Ollama agent (`ollama`, not `-cloud`/`:cloud`): `releaseOwnModels()` (reused,
  once per answer), the turn ends under `GPU_WAIT_LABEL` (Fabio's copy) with no second round and no compaction.
- A message typed meanwhile waits in `runTurn` (`_waitForGpu`) until `_maybeDrained`, then opens on the note.
  A reset ends the wait and drops the message. A `wait: true` step frees the model and carries on after.

## Evidence
- `tests/agent-loop.test.cjs` `(m)`, 6 tests. RED first (4 of 5 failed before the code; the no-op case was green
  as it must be). GREEN after: 6/6. Mutation: dropping `billed` from `_runBatched` turns "billed batch" red.
- Full `npm test`: 2170 tests, 2167 pass, 1 fail. The failure is `tests/mask-tool-registry.test.cjs:785`
  (`el.loadEntry` not found in `MpiCanvasViewer`), caused by a PEER's uncommitted edit to
  `js/components/Organisms/MpiCanvasViewer/MpiCanvasViewer.js` (new `loadEntry` signature); not this card's file.
- **Live, Fabio 2026-09-28 ("it worked")**, agent `ornith:9b` on Ollama, ILL Anime t2i. Ollama's own `server.log`
  proves the release: render submitted 08:17:44Z, ornith NOT loaded again until 08:18:28Z (after the render and the
  auto-look, which loaded `qwen3-vl:4b`, his Ollama describer), exactly when his queued message ran. His "Let me know
  when it finishes" was answered after the image landed.
- **Found live, fixed:** the waiting line drawn TWICE. His message went in while the generate turn was still running,
  queued, and `_waitForGpu` drew a second line under the still-open one. Now it draws only when no line is open.
  Test: "a message typed during that render..." asserts one line (RED before the fix, GREEN after); the reset test
  proves a new conversation's message still gets its own line.
- Live check by Fabio: the duplicate-line fix (earlier brief kept below). Brief: Settings, agent on Ollama (a local model), "make an image with SDXL" (any
  local model). Expect the waiting line under the request, Task Manager GPU memory falling as the render starts,
  the line turning done and Cosmo reporting when it lands. Type while it renders: the message waits, then gets its
  answer.
- **CI green on the code commit** `1c1c83574` (run 36400280803, Tests, success, 2026-09-28). Closed by session ab46115b.
