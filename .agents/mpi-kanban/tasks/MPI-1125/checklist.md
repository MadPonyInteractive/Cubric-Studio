# MPI-1125 checklist

Decided by Fabio 2026-10-13 (brief.md). Order = cheapest and safest first.

- [x] 3. Compaction at a fixed cap (128k tokens) instead of 30% of a 1M window
- [x] 4. Wake turns send the full tool list; open/create project refused in-loop on a wake
- [x] 1. One-line `covers:` per `app:*` doc, shown in the index instead of the bare title
- [x] 5. GIF tools + make_sheet folded into one tool, its detail behind `app:gifs`
- [x] 2. Repeat, Duration, Shape, Text, Settings detail move into the tool results that need them
- [x] Harness: quote, then `npm run agent:test` on the recommended model
- [x] Chat-length card: app-shown at ~half the compaction point, once per chat;
      Start fresh (notes first) / Compact / Keep going
- [x] Budgets lowered to measured sizes; docs/agent-chat.md updated
- [x] Live check of the floor (tokens + cache) after the change

- [x] `docs/releases/UNRELEASED.md`: the long-chat card line under What's new.
