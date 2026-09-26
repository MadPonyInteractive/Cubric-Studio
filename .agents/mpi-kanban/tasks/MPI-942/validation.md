# MPI-942 validation

Isolated instance (`npm run app:isolated`), renderer in the browser pane at 1920x1032, project
"Desktop ref test".

| | before | after |
|---|---|---|
| `#agent-panel-mount` top | 84 | 84 |
| `.mpi-gallery-grid__grid` top (scroll clip) | 90 | 84 |
| grid `padding-top` | 16px | 0px |
| first card top | 106 | 84 |

Same numbers with the agent panel closed. Focus mode (`f`): tool-container 0px, grid keeps
16px top padding, first card 16px under the viewport top, as before.
