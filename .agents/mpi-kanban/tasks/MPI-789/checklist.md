# MPI-789 checklist

`tests/desktop/llm-settings-remote.spec.js` went red on master CI (run 35150684500, commit
568f3ce6): the Enhancement model list resolved to 0 elements right after the spec opened it.

- [x] Read the CI failure: screenshot, trace, error context. The labels were right, the toggle ran,
      and the open list was gone.
- [x] Root cause: `MpiLlmSettings` runs `_init` in `setup` AND in `onOpen`, and `MpiSlideOver`
      calls `onOpen` right after mount, so every Remote open runs two full init passes. Each does
      its own `fetch('/llm/models')`; when the replies come back out of order, the late pass
      destroys and rebuilds every row after the early one painted, closing an open dropdown.
- [x] CI order reproduced once (late reply held until after the toggle): same 0-elements failure.
      The kept guard counts init passes, which is exact without any wait; mutation-tested red.
- [x] Fix: one init per open (`onOpen` only, the contract `MpiSettings` / `MpiRunpodSettings` keep).
- [x] Spec `--repeat-each=10` green locally.
- [x] Doc the single-init contract where the Remote panel is described (`docs/llm.md`).
- [x] Green CI run on master (35156000365, commit 6e7b7082).
