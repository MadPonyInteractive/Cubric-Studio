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

## So

1. **Images + audio: data URLs should work** (upstream takes base64; DeepInfra passes strings). Not
   yet proven through DeepInfra: one paid run settles it (480p 5 s, about $0.37 by the snapshot).
2. **Reference videos need a public HTTPS URL.** The app has none. Options, each Fabio's call:
   (a) ship Seedance `ref2v` with image + audio wells only, videos off (no hosting);
   (b) host the clip ourselves (e.g. a short-lived presigned R2 URL) - a new outbound service,
   so the privacy policy changes, plus storage cost and user media on our bucket;
   (c) a third-party temp host - same privacy change, and a dependency we do not control.
   Recommendation: (a) now; revisit (b) only if users ask for video references on Seedance.
