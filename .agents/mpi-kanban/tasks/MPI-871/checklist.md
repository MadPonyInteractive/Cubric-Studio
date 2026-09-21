# MPI-871 - checklist

- [ ] Ask Fabio: playback clamps to the trim (a), or whole-clip with the outside dimmed (b)
- [ ] Feed the resolved range into MpiGifViewer as a public input
- [ ] Wrap lands on the in-handle, not frame 0
- [ ] Step / setFrameIndex respect the range
- [ ] Loop count counts passes of the RANGE
- [ ] Range survives a reorder / delete
- [ ] Desktop spec asserts the rendered index never leaves [in, out]
