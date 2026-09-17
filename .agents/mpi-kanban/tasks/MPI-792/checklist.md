# MPI-792 checklist

- [x] Diagnose the quiet windows (brief.md), 7z event probe run.
- [x] `js/utils/elapsedTicker.js` - elapsed clock + quiet hints, unit test (negative-controlled).
- [x] `MpiEngineInstall`: steps, spinner swap, per-meter bar colour, ETA, labels, keep-open line.
- [x] `MpiStartingComfy`: elapsed clock + quiet hints.
- [x] Server (after MPI-791 landed): dropped HEAD pre-size, 7z percent, post-unpack status, node counter; engine provisioners own the label. (`patching` is mapped client-side, server string unchanged.)
- [x] Real `/engine/download` against a scratch engine, recorded SSE stream replayed through the real component (dark theme only - the app has no light theme).
- [x] `npm test` green.
- [x] Docs: `docs/download-manager.md` new section + the MPI-231 paragraph.
- [x] Rule files updated with the user's approval (`.claude/rules/downloads.md`, `comfy_engine.md`, `component-events-primitives.md`).
- [x] User signed off on the look.
- [x] Quit warning covers every engine job (`routes/engineJobs.js`, `main/quitWarning.cjs`), verified in a real Electron app.
