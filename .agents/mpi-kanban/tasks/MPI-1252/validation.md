# MPI-1252 Validation

- Change: `.mpi-prompt-box-media-strip__tag` (plain name and the clickable outlined toggle) now sits on `var(--surface-0)`, the Gallery's background; the plain tag gained the toggle's `0 var(--s-1)` side padding; the toggle's hover mixes the accent into `--surface-0` instead of `transparent`, so it stays opaque. The filled "start frame" look is unchanged.
- Throwaway desktop spec (isolated Electron, own port): LTX ref2v + H3 ref2v prompt boxes, 3 pictures each. All 6 tags (3 plain, 3 toggle) compute `background-color: oklch(0.5 0.022 350)` = `--surface-0`.
- `tests/desktop/prompt-box-start-frame-toggle.spec.js`: pass. `npm run lint`: clean.
- Remaining: Fabio's eye-test over a real picture.
