# MPI-1161 checklist

- [x] Prompt box `+` passes every media type the active op accepts (image/video/audio) to the picker
- [x] Picker hides kinds outside those types, and 3D Scenes always (no op takes one)
- [x] Upload card accepts every accepted type; an imported file keeps its own type
- [x] Unit test for the hidden-kinds rule (tests/gallery-filter.test.cjs)
- [x] Desktop spec: SDXL opens on images only, LTX shows audio, H3 references show image+video+audio, 3D Scene never (tests/desktop/media-picker-slot-types.spec.js)
