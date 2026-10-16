# MPI-1161 validation

Cause: the prompt box `+` opened Choose media with `mediaType: 'image'` whatever the model
took, and the picker hid every kind whose type was not that one. 3D Scenes are typed `image`
(assetKinds.js), so they always opened visible.

Fix: the box passes `mediaTypes` = every type the active op accepts (`_acceptsMediaType`);
the picker hides kinds outside them plus 3D Scenes (`pickerHiddenKinds`, galleryFilter.js);
the upload input accepts all of them and an import keeps the file's own type. The `+`
reads "Add a reference" when it takes more than images.

Evidence (2026-10-16):
- `node --test tests/gallery-filter.test.cjs` — 15/15 pass, incl. the new MPI-1161 case.
- `npx playwright test --config=playwright.desktop.config.js` on media-picker-slot-types,
  media-picker-cards, media-picker-to-history, prompt-box-voice — 13/13 pass.
- eslint clean on the three changed JS files.
