# MPI-1117 validation

2026-10-12, isolated instance (`app:isolated`, own profile), driven over the page's own
`Events` / `Storage` modules:

- `comfy:starting` engine `local` → switch shown, checked = `Storage.getAutoStartComfy()`.
- Click → `getAutoStartComfy()` false; click again → true.
- Second `comfy:starting` (phase `python-deps`) while visible → switch re-mounted, one input, reads the stored value.
- `comfy:starting` engine `remote` → no switch, slot `display: none` (no stray gap).
- `comfy:ready` → switch destroyed with the popup.
- Switch off on the popup, then open Settings → "Auto-start ComfyUI on launch" reads off.
- eslint clean on both JS files.

Reopened 2026-10-12: the dev gallery calls `show()` with no flag, so no switch. Now part of the component by default; `shell.js` passes `autoStart: false` for a Pod boot. Re-verified: plain `show()` shows it, `{autoStart:false}` hides it (slot `display: none`), shell local shows, shell remote hides. eslint clean.
