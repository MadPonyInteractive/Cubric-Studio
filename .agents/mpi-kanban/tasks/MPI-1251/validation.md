# MPI-1251 validation

Root cause: a fullscreen `<video>` gets Chromium's own media UI, which toggles play on a click a beat after the event. Our click handlers (MpiVideoSurface's toggle; the model drawer thumb's force-play) ran first, so the native toggle undid them and the video stayed paused.

Fix: both handlers stand down while `document.fullscreenElement` is their video; the native controls own the click there.

Evidence (Playwright Chromium, video fullscreened from a click, two clicks on the picture, 800 ms apart):

- old handler: paused -> paused -> paused (the bug)
- native only: paused -> playing -> paused
- with the guard: paused -> playing -> paused

Not eye-tested in the Electron app itself; same Blink media controls.
