# Shot pipeline (DESIGN)

> Part of [README.md](README.md). Model facts cited from `docs/models/h3/`.

## Which model makes which shot

| Shot kind | Model | Audio |
|---|---|---|
| Speaking / character | **MiniMax H3 Reference** (`minimax-h3-ref2va`, local). Cloud alternatives: Seedance 2, Wan 3 refs | Voice from the character Element's Voice group as an audio reference; the model speaks the new line in that voice |
| B-roll, location | LTX 2.3 / 2.5, Wan 2.2, or H3 (i2v / t2v) | Not needed; Wan has none |
| Ambience, music | Stable Audio 3, laid UNDER the shots in Mix | — |

- H3 Reference takes ≤9 images, ≤3 videos, ≤3 audio clips. Sheet + reference audio was judged
  to give a matching voice and good likeness (`docs/models/h3/ref2va.md`).
- **LTX is not used for characters** for now: H3 usually lands on the first take where LTX 2.5
  needs about three, and 2.3 is weaker. Revisit only if LTX 2.5 proves good with references.
- The H3 base may be replaced by **Singularity H3** (MPI-1135). This table follows that result.

## Shot length

1-5 s per shot; longer only when a scene truly needs it. Small cards can generate, big cards
generate fast, and most joins become cuts between short shots.

## The passes — every one reviewed, every one a history entry

```
prompt review → draft → review → [edit] → upscale → review → [detail / edit] → review → approved
```

- **Draft:** render and **save the latent**, so the upscale refines it instead of re-rolling.
- **Upscale** refines the saved latent. Keeps pass 1's audio, so lip sync holds
  (`docs/models/h3/ref2va.md`: take audio from pass 1, images from the refiner).
- **Detail:** the video detailer (MPI-557) on faces / hands / any SAM3 region.
- **Edit:** the existing Video Edit Flow (MPI-1036), at draft or final resolution.
- Each pass appends a history entry to the shot's take card. The user marks `approved`.
- **Cloud shots** (Seedance, Wan 3 on DeepInfra) return finished MP4s: no latent, no cheap draft.
  They render final directly, and the Story marks them as costing money before they run.

## Draft resolution — not settled

- **H3 Reference picks its framing from the stage-1 canvas.** Refs never become frames, so
  nothing pins composition: the same prompt + seed framed a head close-up at 672×384 and the
  whole scene at 1344×768. The upscale then LOCKS IN what the draft chose. So an H3 Reference
  draft must be at a canvas where framing is right, and it is a true preview of the final.
- First-frame models (i2v, fl2va) are pinned by the frame, so a genuinely low-res draft is safe.
- 1344×768 may be higher than needed. Decided by the Singularity research (MPI-1135) together
  with its upscalers, H3 video upscale (MPI-688) and the H3 refiner (MPI-477).

## Rejected

Text-to-speech + lip sync for dialogue: three generations (video, audio, combine) and hoping the
sync lands. Voice-by-reference does it in one. Lip sync (MPI-538) is deferred.
