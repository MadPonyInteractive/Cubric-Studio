# MPI-917 research: workspace and components (2026-09-25)

Read-only investigation. The line numbers are from 2026-09-25; re-check them before
trusting them.

## The GIF workspace is not a page
- MPI-769 added no page and no lazy-load branch. The router has three pages
  (js/router.js:11-13), and `_importView` knows only Gallery and History
  (js/shell/navigation.js:539-553).
- **GIF is a mode inside `MpiGroupHistoryBlock`** (3,676 lines):
  - `historyKind` via `kindOfItem()` (:294-302)
  - a viewer table (:471-481)
  - a strip and control bar mounted into `#controls-mount` (:540-633)
  - `MpiHistoryTools.js:250`
  - the accent set from `group.type` (navigation.js:311)
- **Files MPI-769 touched:** see `.agents/mpi-kanban/tasks/MPI-769/files.json`.
- **Mix is a NEW PAGE** (Fabio, 2026-09-25). The History grid is left rail / centre /
  options / list, and it can't start empty.
- **Every place a new page must be added:**
  - `router.js`
  - `handleNavigation` + `_importView`
  - `_updateBreadcrumb`: back label, stats, accent, Record visibility
  - `focusModeService.js:35-39`
  - the `when` gates on radial Tab / Ctrl+Tab (hotkeyRegistry.js:390, 409)
  - `agentService.js:173`
- **How cards open.** Gallery `open-group` (MpiGalleryBlock.js:287-294). **Audio is
  excluded** (:288), so an audio mix card needs that exception.
- **Make GIF**, the entry-point model: MpiGalleryGrid.js:1573 → `POST /gif/make` → `addGroup`
  → `navigate(PAGE_GROUP_HISTORY,{groupId})` (MpiGalleryBlock.js:412-447).
- **Combine today:** MpiGalleryGrid.js:1510 (the gate: 2 or more cards, all video), :1571
  (menu item), :1624 (`emit('combine', {groups})`).

## Reuse
| Component | Tier | Notes |
|---|---|---|
| `MpiFader` | Primitive | dB fader: `orientation`, `min=-60`, `max=12`, `unity`, `snap`, `setDb`/`getDb`/`getGain`; emits `input`/`change` with `{db, gain}`. Only used on the dev page so far. |
| `MpiLevelMeter` + `meterAnalyser(analyser, el)` | Primitive | Meters (types.js:986) |
| `MpiWaveform` | Primitive | Baked mask stretched to 100% (MpiWaveform.css:28); `mask`, `progress`, `duration`, emits `seek`. **It cannot show a trimmed window of the mask.** Accent use at :45. |
| `MpiTrimBar` | Compound | In/out handles, playhead, `wavePath`, one draw per frame, `range-preview`/`seek-preview` (types.js:2065). The model for clip trim edges. |
| `MpiResizeHandle` | Primitive | `resize-start`/`resize`/`resize-end` with `{x, y}` (types.js:1023) |
| `MpiAudioPlayer` | Organism | `hotkeys:false` when several are on screen |
| `MpiVolumeControl` | Compound | Mute plus a linear 0-100 flyout. **Not a mixer control** (types.js:2144) |
| `MpiAudioRecorder`, `showAudioRecorder()`, `recordAudioIntoProject()` | Block folder | Blocks only. types.js:1601 wrongly says Compound. |
| `MpiMediaPicker` | Compound | `mediaType:'audio'|'video'`, `onPick`, `onImport`; an audio slot shows the Record card (types.js:1624-1682) |
| `MpiVideoSurface` / `MpiVideoViewer` / `MpiVideoControlBar` | Compound / Organism / Organism | `loadVideo(url, meta)` |
| `MpiMediaDropOverlay` | Primitive | A drop area that calls you back |
| `MpiContextMenu.show({x, y, items, onSelect})` | Compound | A Compound must emit `ui:context-menu` instead of calling it |
| `MpiButton` | Primitive | `toggleable`, `icon`, `iconActive` |

- **Icons present:** `mic`, `upload`, `video`, `audio`, `plus`, `volumeOff`/`volumeHigh`,
  `loop`, `merge`.
- **Icons missing:** solo, link/unlink, headphones.

## Must be built new
- **Primitives:**
  - `MpiKnob`: bipolar pan with a centre detent
  - `MpiTimeRuler`
  - a playhead, possibly part of the ruler
  - `MpiFadeHandle`: a corner triangle plus a curve overlay
  - a windowed `MpiWaveform`: an `{in, out}` prop
- **Compounds:**
  - `MpiClipBlock`: waveform, trim edges, fade handles, name
  - `MpiChannelStrip`: fader, meter, mute, solo, knob, with a `master` variant
- **Organisms:** `MpiTrackLane`, `MpiTimeline` (ruler + lanes + scroll/zoom), `MpiMixer`,
  `MpiMixVideoLane`.
- **Block:** `MpiMixBlock`. It is the only tier that may call `showAudioRecorder`, the picker
  or routing.
- **Non-UI:** a Web Audio engine in `js/services/`, and a shared maths module in `js/data/`.

## Undo
- There is no generic undo. `UndoStack` (Primitives/MpiCanvas/managers/UndoStack.js) stores
  pixel-rectangle patches only.
- The GIF editor stages edits instead, with Discard / Update / Apply (docs/workspaces.md:65-76,
  MpiFrameStrip.js:54).
- The mask Ctrl+Z bindings (hotkeyRegistry.js:196-220) use a `when: !isTyping` gate.
  **Copy it**, or Ctrl+Z gets eaten inside text fields.

## Hotkeys
- The registry is `js/managers/hotkeyRegistry.js`. `Hotkeys.bind(id, fn)` returns an unbind
  function (hotkeyManager.js:104).
- **There are no scopes.** Every handler bound to a key fires on each press (:137-212).
- **Gate each handler** on `el.isConnected && el.getClientRects().length > 0`
  (MpiVideoControlBar.js:301, 436-447; docs/video-player.md:163).
- Space can reuse `video.playPause` (hotkeyRegistry.js:547).

## Output device
- `js/utils/audioOutput.js` handles `<audio>`/`<video>` only:
  - a `play` capture listener calls `setSinkId` (:150-157)
  - `devicechange` re-applies it (:168)
  - `_reresolve()` looks the device up again by label (:69-75, the MPI-824 fix)
- **Add `applyContextSink(ctx)`** that reuses `_reresolve` and keeps a set of live contexts
  re-pointed on `setOutputDevice()` / `devicechange`. Electron ^41 has
  `AudioContext.setSinkId`.
- Once a video's sound goes through `createMediaElementSource`, the element's own sink is
  ignored, so the context's sink is the one that counts.

## Web Audio today
Metering and recording only: MpiSettings.js:513, MpiAudioRecorder.js:252, and
`OfflineAudioContext` decoding in toWavFile.js:47 and MpiAudioRecorder.js:46. Nothing
plays through the speakers.

## Accent
- The `[data-accent]` rules rebind `--accent-heat`/`-hi` (styles/01_base.css:224-243);
  `audio` maps to `--accent-audio` (:126).
- Navigation sets the attribute on `_appShell` (navigation.js:294, 311).
- Fabio chose Audio green for Mix.

## Memory
- Decoding long tracks into `AudioBuffer`s conflicts with the MPI-631/633 memory rule.
  Stream each clip through a media-element source in the live preview.
- The waveform mask is 1,260 px wide, which is coarse on long clips at high zoom. That is
  acceptable for v1.
