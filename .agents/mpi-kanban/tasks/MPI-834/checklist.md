# MPI-834 checklist

- [x] Reproduce: no `wavePath` paints a solid `--ink-4` slab cap to cap (real CSS, real browser)
- [x] `MpiTrimBar`: the wave layer renders nothing when there is no wave (silent video AND GIF)
- [x] GIF control bar: track back to 28px, video bar stays 44px
- [x] Verify with the REAL `MpiTrimBar` module in a browser: no wave, wave set, wave cleared
- [x] `tests/desktop/gif-workspace.spec.js` asserts the GIF bar's wave paints nothing and the track is 28px
- [x] `docs/video-player.md` Height bullet corrected (it said the GIF bar "lays out fine")
