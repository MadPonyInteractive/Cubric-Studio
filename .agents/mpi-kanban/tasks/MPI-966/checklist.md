# MPI-966 checklist

- [x] Measure what the landing waits on after the window shows (list-projects, engine gate)
- [x] Renderer tells main when the landing has content (projects listed + boot past the engine gate, or the gate's own modal is up)
- [x] main.js holds the splash for that signal; the 30s backstop stays
- [x] Browser dev path (no Electron) unaffected - `_revealWhenLandingReady` returns when there is no `window.require`
- [x] Verified on an isolated instance: no empty landing on reveal (validation.md)
- [x] docs/DEVELOPMENT.md boot paragraph updated
- [x] Fabio confirms on his own launch (2026-09-28)
