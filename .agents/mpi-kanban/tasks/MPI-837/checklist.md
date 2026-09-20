# MPI-837 checklist

- [x] The track is 28px by default and 44px only while the wave layer renders
- [x] The GIF bar's `--mpi-trim-bar-track-h` override is gone (it has nothing left to say)
- [x] Verify with the REAL modules: silent video 28px, wave set 44px, wave cleared 28px again
- [x] GIF workspace spec still green (its `{ wave: 0, track: 28 }` assertion now holds for the general reason)
- [x] `docs/video-player.md` Height bullet says what drives the height now
