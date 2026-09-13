# MPI-731 Checklist

Eight items, in order. 1 → 4 are the player; 5 and 6 are the consistency pass Fabio asked
for; 7 and 8 close it. Full detail and every trap live in `plan.md` — this is the state, not
the spec.

- [ ] **Implementation**
  - [x] 1. `MpiProgressBar` gains `orientation: 'vertical'` — additive, horizontal path
        untouched, `writing-mode: vertical-lr` (native in Chromium 142 / Electron 41)
  - [x] 2. `MpiVolumeControl` compound — mute button + hover-reveal vertical volume, owns no
        media element, three consumers (flyout signed off; wheel always on, 5 per tick)
  - [x] 3. `MpiAudioPlayer` compound — `play │ waveform(+time) │ volume`, owns ONE `<audio>`,
        mounts MPI-730's `MpiWaveform` as its scrub track (committed; behaviour Fabio-approved;
        joined layout approved on his second look 2026-09-13; time legibility: near-black
        was worse, light digits with a dark halo approved)
  - [x] 4. Wire it into the Flow's result pane and floating dock — `_sharedAudioPlayer`
        keyed by URL, MOVED not rebuilt (MPI-727 holds). Specs 6/6 + MPI-727 1/1 + node
        961/961; the pane's fit/pan/wheel skip an audio result. Fabio verified live
  - [x] 5. `MpiVideoControlBar` adopts `MpiVolumeControl` — hotkeys `M` / volume± keep working
        (spec test 3 green + falsified; Fabio approved live). Plus: zero reads as muted, and a
        click at zero restores the pre-gesture level
  - [x] 5b. Video workspace: transport bar moves BELOW the PromptBox, so the PromptBox's
        upward panel stops covering the bar's buttons (Fabio, 2026-09-12) — shell slot
        `#controls-mount`, spec test 4 green + falsified, Fabio verified live
  - [x] 6. ~~`MpiGalleryGrid` adopts it~~ — DROPPED by Fabio 2026-09-13: the gallery's own
        volume stays. `MpiVolumeControl` has two consumers, not three
  - [x] 7. `tests/desktop/flow-audio-player.spec.js` + the MPI-727 regression spec + a live
        check in Fabio's own app (Stems + Text to Speech, painted waves, "1" 2026-09-13).
        Item 6 brings its own gallery checks
  - [ ] 8. Registrations (`preloadStyles.js`, `types.js` — no longer claimed) and
        `docs/gallery-audio-cards.md` (`MpiVolumeControl.css` preload line already landed with 5)

## Waiting on nobody

Items 1–5 touch only unclaimed files. Two things are deliberately deferred rather than
blocked: the `types.js` / `preloadStyles.js` registrations (MPI-728's claim) and the demo-page
variant (MPI-739's claim on `js/pages/components.js`). Neither gates the feature.

## Not in this card

`MpiFader`'s wheel defects are **MPI-740**, filed from the same conversation: it crawls at
0.1 dB per tick and cannot leave the unity detent at all. Independent in both directions.
