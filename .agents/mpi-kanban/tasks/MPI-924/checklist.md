# MPI-924 checklist

- [x] `MpiPromptBox.js`: the `+` card mounts for the gallery box too (history keeps `stageMedia`; the "Add to history" toggle stays history-only)
- [x] `MpiPromptBox.js`: the card is seated in the strip at creation — an empty strip's first render took the same-set fast path and never appended it
- [x] `types.js`: drop "gallery keeps drag-drop as its only origin"
- [x] Lint clean; `tests/desktop/media-picker-to-history.spec.js` gains a gallery test, 5/5 green
