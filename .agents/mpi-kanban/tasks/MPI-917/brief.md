# MPI-917 - Scene workspace: video lane, audio tracks and mixer

Designed in a brainstorm with Fabio on 2026-09-25. **Nothing starts before the 2.0 release.**

## Why this exists

Fabio, 2026-09-25: *"Generating 3- and 5-second videos to create a scene is never going to
have a coherent score. That's why generating without a score and then having somewhere we
can place the score underneath is somewhat essential."*

- Clips are generated short and **without a score**. The score goes underneath afterwards,
  across all the clips, so the scene holds together.
- **The agent is the main user.** The long-term goal: the user and the agent write a story
  for a series or a film, the agent generates every scene (the user approves stills), and
  the agent assembles videos of 5, 10 or 30 minutes with music, sound effects and
  commentary. This card builds the tools the agent will need for that.
- Today users are forced into DaVinci Resolve for this step.
- This is the first real step towards the DAW that the 2026-08-17 audio decision (MPI-573)
  deliberately deferred. The components built here are the DAW's parts.

## Decisions (all Fabio, 2026-09-25)

1. **The main job is finishing a video**, not making music. Audio serves the clips.
2. **Its own scene kind plus its own workspace, following the GIF pattern** (MPI-768
   foundation, MPI-769 workspace). **Not a Flow**, for two reasons:
   - Flows have no custom UI any more. MPI-572 removed the per-Flow `uiComponent`; a
     Flow is declared fields on a carousel, and a timeline with lanes and a mixer is not
     a field.
   - Flows run ComfyUI graphs (every FlowDef names a `workflow`). Scene assembly is
     local ffmpeg: no GPU, no engine, no Pod. Through ComfyUI, a remote Pod would have to
     upload every clip just to mix them.
3. **The recipe is kept in the sidecar**, like a DAW project: ins, outs, tracks and
   volumes. Reopening a scene with Reuse restores it for editing, so the agent can swap
   clip 7 or nudge the music and render again instead of rebuilding the whole scene.
4. **Free tracks.** A new scene starts as an **empty mixer with a + button**, with no
   assumed tracks. An audio-only mix is a normal use.
5. **The + button offers four sources:**
   - **Record:** a mic track. Reuse `MpiAudioRecorder` (`js/components/Blocks/`),
     `js/utils/wavEncoder.js` and `js/utils/toWavFile.js`.
   - **From project:** audio cards already in the project.
   - **Upload:** an audio file from disk.
   - **Video:** a video card. It goes onto the video lane.
6. **The video lane sits at the top**, shown only when a video has been added. Chained
   videos play one after another; the join is a cut or a crossfade.
7. **One linked "Video audio" track, like Resolve.** Each video's own sound lands as a clip
   on that one track, directly under its video. Moving or trimming the video moves or trims
   its sound too. **Link and unlink** like Resolve: an unlinked sound clip can move onto
   another track for its own fader, and any single clip's sound can be deleted or muted.
   One track, not one per video, because 200 clips must not become 200 channel strips.
8. **A mixer at the bottom:** a channel strip per track (fader, mute, solo, pan) plus the
   **master fader**.
9. **Fades work like DaVinci Resolve:** a small handle at the start and end of each audio
   clip. Dragging it inward draws the fade in or the fade out. No fade fields to type into.
10. **The output follows the content.** Any video on the lane means a video card comes out;
    no video means an audio card.

## The data model

**Track:** one mixer channel.
- name, volume, mute, solo, pan

**Clip:** a media item placed on a track.
- the source card
- start time on the scene
- trim in and trim out
- its own volume
- fade in and fade out lengths, set by the fade handles
- loop to fill

**Video lane:** ordered video clips.
- trim in and out per clip
- the join to the next clip: a cut or a crossfade
- each clip is linked to its sound clip on the "Video audio" track until it is unlinked

**Master:** a volume fader, plus a limiter that is always on.

Every volume lives in the recipe. The recipe is the single source for both the live
preview and the final render.

## The engines

- **Live preview (in the workspace):** the Web Audio API mixes in real time. Each track
  gets a `GainNode` and a `StereoPannerNode`; the master gets a `GainNode` and a limiter.
  It is synced to the video preview. Moving a fader must be heard at once, or the mixer is
  useless.
- **Render:** an ffmpeg server job reads the same recipe. It works like
  `routes/videoConcat.js` (`/combine-videos`): progress over SSE, the output lands as a
  gallery card, and the sidecar carries the recipe.
- **Preview vs render must agree.** The fade curve, the pan law and the limiter are
  defined once and used by both engines. A test renders a short scene and checks each
  track's level against the preview's volumes.
- **Trap: ffmpeg `amix` divides every input by the input count** unless it is given
  `normalize=0`. Three tracks at 0 dB come out quieter than one, and adding a sound-effects
  track makes the music drop. The mixer owns the volumes; `amix` must not.

## The agent

- **One connector route takes the whole scene recipe as JSON** and renders it. This is the
  piece that makes long, consistent videos possible.
- A new page in the cubric-vision skill family teaches the agent to assemble scenes.

## What already exists and is reused

- `MpiWaveform` and `MpiAudioPlayer`, plus the baked waveform masks
  (`docs/gallery-audio-cards.md`).
- `extractAudioWaveform()` in `services/ffmpegThumb.js`.
- `routes/videoConcat.js`: server-side concat with SSE progress and a sidecar output.
- The GIF kind: a recipe in the sidecar and its own history workspace (`docs/gif.md`).
- `MpiAudioRecorder`: mic capture.
- Flow Reuse from the sidecar (`docs/playbooks/add-flow/03-storage-and-reuse.md`), as the
  model for reopening a scene.

## Build order

1. **Foundation (server, no UI):**
   - the scene recipe in the sidecar
   - the ffmpeg render route
   - SSE progress
   - a video or audio card as the output
   - the connector route for the agent
   - tests that render sample scenes
2. **Components**, as reusable organisms and primitives for the DAW later:
   - time ruler and playhead
   - track lane, reusing `MpiWaveform`
   - clip block with trim edges and Resolve-style fade handles
   - channel strip: fader, mute, solo, pan
   - master strip
3. **Scene workspace:**
   - video preview on top, track lanes in the middle, mixer at the bottom
   - the + button with its four sources
   - video audio linked and unlinkable
   - live preview, Render, and Reuse to reopen a scene
4. **The agent skill page.**

## Decisions, round 2 (Fabio, 2026-09-25, after the investigation)

1. **The name is "Mix".** `scene` was taken: `kind:'scene'` is the 3D Scene
   (`js/utils/assetKinds.js:65`), and `PAGE_SCENE` is reserved for the 3D viewer. The kind id
   is `mix`, the sidecar field is `mix` and the page is `PAGE_MIX`. They are frozen once
   released. The rest of this brief says "scene"; read it as "mix".
2. **Undo is Ctrl+Z; redo is Ctrl+Shift+Z.** A new snapshot stack: every edit pushes a copy
   of the recipe. The existing `UndoStack` only stores pixel patches, so it can't be used.
3. **A missing source works like DaVinci Resolve.**
   - The clip shows red in the timeline.
   - The render still runs and skips that stretch: silence for audio, black frames for
     video, with the clip's full length kept so everything after it stays in sync.
   - **Warn on delete:** a new global card, **MPI-920**, covers the delete dialog warning
     whenever a card is used by reference anywhere (a mix, a Flow Reuse, and so on).
4. **Uploads and mic recordings land as normal gallery cards**, the same as Record does
   today.
5. **The accent is Audio green.** Fabio's call; it overrides the DESIGN.md rule that
   mixed-media surfaces use Studio cream.
6. **The way in is the gallery right-click menu. Combine becomes the Mix entry point.**
   - Combine today joins 2 or more **video** cards into a new file straight away
     (`MpiGalleryGrid.js:1510-1624`). From now on it opens the Mix workspace with the selected
     cards already placed.
   - **Videos** go on the video lane in click order, with their sound on the linked "Video
     audio" track.
   - **Audio cards** are layered: one track each, every clip starting at 0:00.
   - A **mixed selection** of video and audio cards does both.
   - It works from a single card: one video or one audio file opens a mix with just that
     card.
   - **An empty mix:** a new right-click menu on empty gallery space, with "New mix". The
     gallery has no background menu today; only cards have one.
   - The `/combine-videos` route stays. GroupHistory and the GIF routes still use it; only
     the menu item changes.
7. Accepted as proposed:
   - its own page (`PAGE_MIX`), not a mode inside History
   - rendering on the server, with its own progress and cancel; the renderer only lands the
     card
   - a staged render
   - one shared audio-maths module
   - explicit mono-to-stereo conversion
   - `alimiter` with `level=0` (the default pushes the mix back up to 0 dB)
   - the preview plays through the app's pinned output device

## Not in this card

- The YuE2 piano roll: MPI-775. Its home is this workspace, as a later panel or track type.
- Automatic music ducking under dialogue.
- Effects and VSTs.
- The full DAW.
- Flows for single steps such as "Add music to a video". A Flow must run a ComfyUI graph
  today, so this waits on a separate decision.
