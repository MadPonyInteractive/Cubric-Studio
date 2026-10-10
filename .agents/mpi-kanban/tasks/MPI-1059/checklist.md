# MPI-1059 checklist

- [x] One shared cost gate (`js/utils/podCost.js`) so the hero strip and the status bar never disagree
- [x] Idle label reads `IDLE · REMOTE · $x.xx` while connected with cost data, plain `REMOTE` otherwise
- [x] Repaints on every feed tick while idle
- [x] Unit test
- [x] docs/shell.md line
