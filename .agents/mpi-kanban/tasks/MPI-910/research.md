# MPI-910 research - where Seedance 2.0 references can come from (2026-09-30, Agent 77)

Umbrella MPI-985. Question from the card: references are "URLs or asset:// ids, never uploads",
so how does the app hand a local file to the provider?

## Answer

- **DeepInfra** (`api.deepinfra.com/models/ByteDance/Seedance-2.0`, keyless): `reference_images` /
  `reference_videos` / `reference_audios` are arrays of strings, "URLs (or asset:// IDs)". No upload
  endpoint is published. `first_frame_image` / `last_frame_image` are binary (base64 or data URL),
  which is what `seedance-2-cloud` i2v already sends.
- **BytePlus ModelArk** (the upstream; `docs.byteplus.com/en/docs/modelark/video-generation-tutorial`
  § Limitations > Omni reference input, read in the browser pane, page dated 2026-09-29):
  - Images: "Image URL, Base64 string of image, or asset ID". < 30 MB each, 300-6000 px, aspect
    0.4-2.5, request body <= 64 MB.
  - Videos: "Video URL or asset ID" - **no base64**. MP4/MOV (H.264/H.265), 2-15 s each, up to 3,
    **15 s in total**, <= 200 MB, 24-60 fps, w x h in [407,696, 8,295,044].
  - Audio: "Audio URL, Base64 string of audio, or asset ID". WAV/MP3, 2-15 s each, up to 3, 15 s total.
  - `asset://` ids come from ByteDance's own asset library (public-URL registration); DeepInfra
    exposes no way to create one on its account, so they are unusable here.
  - Prompts address references as `Image n` / `Video n` / `Audio n`, per type, array order: the
    SAME names Wan 3.0 reads, so the `ref2v` op's tags (MPI-923) fit Seedance unchanged.
  - Real human faces in reference images/videos are refused by input moderation.
- OpenRouter's Seedance route answers a `data:video/mp4` reference with HTTP 400 "Only HTTPS URLs are
  allowed" (github.com/Reid-Surmeier/Image-generation-pipline issue 101): same upstream rule.

## Proven live (2026-09-30, Fabio's yes, 1 run)

DeepInfra `ByteDance/Seedance-2.0`, `reference_images: ['data:image/png;base64,...']`, 480p 5 s
16:9: **accepted**. Output 5.06 s, 864x496, audio track, the Vision mascot from `Image 1` in every
frame. Billed $0.390 (`inference_status.cost`) against the snapshot quote of $0.37.

## So

1. **Images: data URLs work** (proven above). Audio: upstream takes base64 too; not yet run.
2. **Reference videos need a public HTTPS URL.** The app has none. Options, each Fabio's call:
   (a) ship Seedance `ref2v` with image + audio wells only, videos off (no hosting);
   (b) host the clip ourselves (e.g. a short-lived presigned R2 URL) - a new outbound service,
   so the privacy policy changes, plus storage cost and user media on our bucket;
   (c) a third-party temp host - same privacy change, and a dependency we do not control.
   Recommendation was (a). **Fabio picked (b), 2026-09-30.** Plan: `plan.md`.
