# MPI-744 Validation

## Closed 2026-09-14 (session 7231419c)

**Engine, final (Fabio):** Head Swap ships Klein 9B DISTILLED int8 only. Rejected: Klein 4B (checklist 22),
Klein 9B base bf16 + turbo LoRA as a High tier (checklist 25-28: fails without the head LoRA, never as good as
distilled), Krea (Fabio's own tests; MPI-348 closed `rejected`), Qwen (too slow, checklist 6).

**Live run PASSED in Fabio's app:** Output_Display on the final stage, exactly one gallery card
(`flowHeadSwap_003`), Compare reachable, display back on reopen. Recorded in `tasks/MPI-747/validation.md` § Live.

**Optional Expression field (checklist 18):**
- `node scripts/validate-injection-rules.mjs comfy_workflows/flow_head_swap.json` -> conforms.
- `COMFY_URL=http://127.0.0.1:48188 node scripts/verify-workflow.mjs comfy_workflows/flow_head_swap.json` -> validates (61 nodes).
- `node --test tests/flow-output-display.test.cjs` -> 5/5. Sabotage: delimiter set to '' in the runtime file fails
  the delimiter assertion by name; file restored, `cmp` identical to the converted output. (Message reworded at
  close-out to "the join delimiter must be a space, or the expression glues onto the instruction".)
- `npm test` -> 970/970.
- Same-seed 8188 run (`expr_ab.py`, dark photo, seed 42): old graph vs empty field mean |d| 0.597 on 8.61% of
  pixels (trailing space from the join; identical by eye); empty vs "a big open-mouthed laugh" mean |d| 2.351,
  clean laugh, identity kept.
- Fabio in his app: the field reads "EXPRESSION (OPTIONAL)" above Generate; four runs followed the typed expression.

**R2:** `rclone lsl cubric-r2:cubric-models` shows the base bf16 and turbo LoRA were never uploaded; the unloaded
4B BFS LoRA was deleted by Fabio; only `bfs_head_v1_flux-klein_9b_step3500_rank128` remains.

**Not done here, by decision:** a RunPod pass (a separate all-Flows job, Fabio); tile + hero kept.
