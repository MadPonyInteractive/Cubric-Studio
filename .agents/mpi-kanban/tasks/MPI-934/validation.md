# MPI-934 Validation

`tests/svg-import.test.cjs`: `place-preview-asset` with an 800x600 SVG, once as an agent path and once as a Flow-drop data URL, stores and returns a 2048x1536 `.png` and leaves no `.svg` in `Media/.preview-assets`. Both red before the fix ("stored as .png"), green after. Existing `content-addressed-store` and `agent-no-delete` tests pass. Full `npm test`: 1934 pass, 0 fail.

Detection is by the extension the caller sends, which is what names the stored file. An SVG sent under another extension is not caught.

## CI

Run 36168074371 on `001c3c81`: success.
