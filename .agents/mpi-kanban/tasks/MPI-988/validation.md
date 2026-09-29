# MPI-988 validation

**Symptom (live, 2026-09-29):** an agent `klein-9b:inpaint` with a mask painted on a 1920x1080 snapshot
came back 1344x768. Its sidecar `injectionParams` held `Width 1344, Height 768, Ratio_Label 16:9`, and the log
read `ratio=16:9 (asked)`.

**Root cause:** the PromptBox mounts the ratio picker only on an op whose `components` list `ratio`, and then
only where `modelShowsRatio` allows it. `resolveNamedParams` / `isValidRatio` / `namedParamsFor` asked
`modelShowsRatio` alone, and that checked only the model's `imageSizedOps`. So the agent path accepted and
injected a size wherever the op carries no picker and the model did not list it: `inpaint` on every local
model, `detail` and `upscale` on Klein 4B/9B, `edit` on Boogu and the Seedream / FLUX.2 cloud editors, and
`pid`. Listed by running the old gate against the registry. `qwenEdit` was never affected (qwen-edit lists
it in `imageSizedOps`); the `7915e2894` commit message wrongly names it.
Proof that no size means the source's size: every non-agent inpaint sidecar in the user's projects has no
Width/Height and comes back at the source's size (Blue Lagoon 1744x1088, cowboys 1936x1088 and 1792x1120).

**Fix:** `7915e2894`. `modelShowsRatio` returns false first when `getCommandComponents(op)` lacks `ratio`.
That is the one shared gate, so all three agent-side callers follow it. The UI already filtered by components,
so nothing changes there.

**Evidence**
- New test `tests/agent-model-params.test.cjs` "an op takes a ratio only where the PromptBox would show the
  picker". It FAILED before the fix (`sdxl-realistic/inpaint takes a ratio the UI never offers`) and passes after.
- Full unit suite: 2276 pass, 0 fail.
- Docs healed: `docs/models/lanpaint-inpaint.md` (the "the op never mounts it" assumption),
  `docs/playbooks/add-model/04-ops-and-controls.md` (the gate row).

**Not re-run live.** An agent inpaint needs an app reload to pick this up. What remains is that the next
masked agent inpaint lands at the source size. The sidecar evidence above says the graph already does that
when no size is injected.
