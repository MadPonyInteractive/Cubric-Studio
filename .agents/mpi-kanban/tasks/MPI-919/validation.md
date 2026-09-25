# MPI-919 validation

## Unit (2026-09-25)

`node --test tests/deepinfra-collage.test.cjs` 6/6: sheet geometry for 2 and 4 refs with each
colour in its numbered cell; contain-not-crop; output ratio = image 1's; preamble numbering;
only `referenceCollage` models get more than one `edit` slot (lite 4 yes / 5 no, Boogu 1 yes /
2 no); executor sends every path in strip order and 4 refs price the same as 1.
Full suite: 1880 tests, 1878 pass, 0 fail (1 skipped, 1 todo - MPI-867, unrelated).

## Live, paid, real `routes/deepinfra.js` + NB2 Lite (total ~$0.10)

| refs | prompt | billed | result |
|---|---|---|---|
| 4 shapes | draw every shape | $0.0339065 | all four drawn in one row: the model read every cell |
| 3 photos | tiger -> dog (img 2), kaiju (img 3) in the sea | $0.0339085 | ONE picture, 4:5 = image 1's ratio, kaiju placed; dog swap IGNORED |
| 2 photos | tiger -> dog (img 2) | $0.0339015 | dog from image 2 swapped in, 4:5, one picture; the scene was RE-DRAWN (same idea, different beach) |

Cost is flat: a sheet bills the same as one reference ($0.03388 measured single, 2026-09-20).

**Findings.** Cell numbering works (image 2 and image 3 each reached the right place). Lite
carried out one of two instructions in the 3-ref run, and it regenerates rather than edits the
scene when fed a sheet: image 1 gets only part of the model's input resolution. Untested: NB2 /
Pro on the same inputs, and a layout that gives image 1 a bigger cell.

## Layout A/B -> image 1 gets the big cell (2026-09-25, ~$0.17 more)

Same beach photo as image 1; image 2 = the dog CROPPED out of its photo (the uncropped one
has a woman in swimwear, which NB2's filter refuses). Layout "hero" = image 1 in a 1536
square on the left, the rest stacked in a 640-wide column.

| model | layout | refs | billed | result |
|---|---|---|---|---|
| lite | hero (scratch script) | 2 | $0.0339 | scene KEPT (same framing, beach, pose), clean dog swap |
| lite | hero (scratch script) | 3 | $0.0339 | BOTH instructions done (dog + kaiju); scene shifted a little |
| NB2 | hero (scratch script) | 3 | $0.0679 | best: scene kept, the right dog (face mask matches), kaiju in the sea |
| lite | hero (SHIPPED route) | 2 | $0.0339 | scene kept perfectly, but a dog-tiger HYBRID (dog front, tiger body/tail) |

Hero replaced the grid in `routes/deepinfraCollage.js`. Caveat: the grid runs used the
uncropped dog, so the dog-swap half of the comparison is not perfectly controlled; the scene
preservation difference is not plausibly explained by image 2's crop. The last row repeats the
first with the same layout and prompt: Lite is inconsistent run to run on multi-reference edits,
NB2 held up on the hardest case (one sample). Pro not run (Fabio: too expensive, NB2 passing
is the proxy).

## Fabio's in-app run found the reference never arrived (2026-09-25)

Kaiju Giant Bowl edit_003..007 (Lite and NB2, 1 and 2 refs): every output an unrelated NEW
scene at 1408x768, ignoring image 1 (1088x896). Billed $0.033602 = output tokens only, ZERO
input tokens: the image never reached the provider, so each "edit" was a paid text-to-image.

Root cause: `cloudExecutor` sent the staged card's `filePath`, which is the renderer URL
`/project-file?path=<encoded>`, and the route reads a DISK path. Broken since MPI-851 (with a
matching server it fails "could not be read"); Fabio's running server predated this card, read
the old `imagePath` field, saw nothing, and generated without the image. Fixed at the source
(`extractAbsPath` in `_imagePaths`), and the route now refuses an op whose `requiresImages`
exceeds the refs it received, before any key or spend, so a mismatch can never again bill a
silent text-to-image. Re-run of edit_006's exact request (Lite, "Replace the boat With a
warship", t2i_002.png) through the route: a real edit, same kaiju scene, sailboat -> warship,
image 1's ratio, $0.033882 (input tokens present). Suite 1882: 1880 pass, 0 fail.

**The running app must be RESTARTED** - its server process holds the old route.

## The in-app "provider could not complete" was the SAME bug, one field over (2026-09-25)

Live log (`%APPDATA%\Cubric Studio\logs\app.log`, not `Cubric Vision`): two
`PROVIDER_ERROR` at 11:16/11:17Z with NO `deepinfra generate: ... answered HTTP` line, so the
route refused before any provider call. A prompt-box chip is `{ id, url, file, mediaType,
source }` (`_tryAddMedia`, also the pinned chip and agent media); `_imagePaths` read
`filePath || path`, so every in-app cloud edit sent `imagePaths: []`. Before 214955b7 that
billed a text-to-image; after it, the route's "none arrived" refusal, shown as the generic
PROVIDER_ERROR copy. The earlier test used the SIDECAR shape (a later clone that has
`filePath`), so it passed. Fix: `url` first. Test pins the real chip shape and that the price
tag now counts the reference (it quoted a text-to-image). The executor's log line now carries
the route's message, so a refusal and a provider fault no longer read the same.

## Cloud media sweep (2026-09-25, ~$0.60 total)

Every input field and type checked keyless against each endpoint's `schema_in`: all match
(binary string; Wan's typed list fixed in 6b83283f). Outputs checked against `schema_out`.
Live, real route, Fabio's `Kaiju Giant Bowl/Media/t2i_002.png`, "pencil sketch" edit:

| model | before | after (billed) |
|---|---|---|
| FLUX-2 dev edit | OK | - ($0.018) |
| Seedream 4 / 5 Pro edit | "OK" + 121/166-byte garbage file: `images` holds LINKS, decoded as base64 | real 2048x2048 / 2176x1792 JPEG ($0.04 / $0.099) |
| Seedream 4.5 edit | (harness sent 1024: provider floor is 3,686,400 px; the app sends no size on an edit) | real 2048x2048 ($0.04) |
| FLUX-2 pro / max edit | HTTP 500: BFL cannot decode a data URL; and `image_url` was never read | real 1024x1024 ($0.045 / $0.10) |
| NB2 Lite edit (regression) | OK | real 1127x928 ($0.034) |
| Seedance 1.5 Pro i2v | OK, first frame = input | same, h264+aac 640x640 ($0.047) |

Fix in `routes/deepinfra.js`: `cloud.imageBareBase64` for FLUX-2 pro/max; one output reader for
base64, data URLs and links in `images` / `image_url` / `video_url` / `videos`; bytes sniffed,
and bytes of no known media type are refused, never saved as a card. Unit test pins every
shape and the Seedream garbage case. Suite 1893: 1891 pass, 0 fail.

Not run: NB Pro (NB2 proxy), Seedance 2 (same field as 1.5), Wan (6b83283f).

**Veo 3.1 Fast i2v** (Fabio okayed one run): OK through the fixed route, $1.20, 65 s, a real
1280x720 8 s h264+aac clip whose first frame is the input. The 1088x896 input is PILLARBOXED
into 16:9 - Veo offers only 16:9 / 9:16, so the ratio the user picks matters.

**Fabio, in the app, 2026-09-25 after restart:** the 2-image Nano Banana 2 Lite edit works
(edit_008, "Replace the boat with the bowl.", 1152x928, the ratio of image 1).

## Next phase (session 949bf2cd, 2026-09-25, ~$0.75 paid probes + live runs)

1. **Paid outputs survive.** Root cause `main.js` `pruneStaleMaskTemp` matched `cubric-*`; now
   only `cubric-<uuid>`. `/deepinfra/output` no longer deletes on serve; `_sweepOutputs` ages
   files out after 24 h. `tests/deepinfra-output-retention.test.cjs`; desktop spec
   `mask-temp-ipc.spec.js` (run with private TEMP): stale uuid dir pruned, a file in
   `cubric-deepinfra` kept - 2/2 pass.
2. **Native multi-reference.** `cloud.imageFields` + `multiReference` / `multiReference8`: Seedream
   5 Pro 4, FLUX-2 dev/pro 4, max 8, NB 4 (collage). Live via the real route, 2 refs: FLUX-2 pro
   OK $0.06 (= 2 ref units: the 2048^2 ref was shrunk to 1 MP, unshrunk it is $0.105),
   Seedream 5 Pro OK $0.1023 (= $0.099 + the $0.0033 second-image fee: `image_2` arrived),
   FLUX-2 dev OK $0.01785. The two refs were the same scene, so the pictures prove nothing; the
   bills do for pro and Seedream. `tests/deepinfra-multiref.test.cjs`.
3. **Prices measured** (direct calls, `inference_status.cost`): FLUX-2 pro 1024^2 t2i $0.03,
   1280x1024 $0.045, 1 MP + 2048^2 ref $0.09, + two 1 MP refs $0.06; max 1024^2 t2i $0.07.
   = BFL per started 2^20-px megapixel, output + every input. Tiles quoted pro $0.015 and max
   $0.10: both wrong. FLUX-2 dev billed $0.01785 = 0.01 x 50/28: it runs its default 50 steps
   against a price set at 28 - every dev quote was 1.79x low. Now priced from the snapshot's
   step default. `tests/deepinfra-pricing.test.cjs` pins all of it.
4. **Ratio picker on edits** for Seedream 4/4.5, FLUX-2 pro/max. Every picker row sends a valid
   size (Seedream 4.5 >= 3,686,400 px, FLUX-2 multiple of 32 in 256-1440). Live 16:9 edits:
   Seedream 4 2752x1536 $0.04, FLUX-2 pro 1376x768 $0.06 (= quote: 1.008 MiB is 2 units).
5. **HTTP 500 classification.** Captured: a Gemini refusal is 500 "…returned no image data"; a
   garbage image is 422 (pydantic) on Seedream, 500 wrapping Google's `status: 400` on NB, and a
   bare 500 "inference error" on FLUX-2 dev. 422 and a wrapped non-safety 4xx now read
   PROVIDER_ERROR; the log line adds the wrapped status and the provider HOST only.
6. MPI-923 opened (Wan 3.0 reference-to-video; base64 media, no hosting question).

Full unit suite: 1908 tests, 1906 pass, 0 fail.

**Follow-ups (Fabio, same session):**
- FLUX-2 pro/max ratio rows capped at 2^20 px (`_cloudRatios` `maxArea`, sides snap DOWN; the
  rows live on flux2-pro-cloud and max resolves them through the shared `type: 'flux2pro'`). The
  model does NOT snap on its own: 1376x768 came back 1376x768 and billed 2 output units. New
  rows: 1024^2, 864x1152, 896x1120, 768x1344 (and landscape twins), all <= 1 MiB.
- 16K references (photographers). Reproduced: a 16384^2 JPEG failed the FLUX shrink AND the NB
  collage ("Input image exceeds pixel limit", sharp's 268 MP default), and every other model
  would have sent a 126 MB file raw. Now every reference is bounded (4096^2 area, or re-encoded
  past 10 MB; FLUX-2 pro/max 1 MP), decoded with no pixel ceiling, EXIF-upright without a crop;
  the collage reads image 1's size from the header (was a full ~800 MB decode). Live, real route,
  a 126 MB 16384x10922 photo: NB2 Lite edit OK $0.0339, FLUX-2 pro OK $0.045 (1 ref unit), NB
  collage with a 16384^2 image 1 OK $0.0339. Unit tests pin 16K + EXIF. Suite 1918: 1916 pass, 0 fail.

**Fabio, 2026-09-25: verified ("1")** - closes the in-app checks below. Code commit a0e6b58a.

## Previously open (closed by Fabio's verification above)

- The prompt box itself accepting four chips on a Nano Banana model (in the app). The slot count
  is data-driven (`getAvailableCommands`, unit-tested), but no one has clicked it.
- In the app: the ratio picker showing on a Seedream 4 / FLUX-2 pro edit, eight chips on FLUX-2
  Max, and the price tag moving as references are added (FLUX-2 pro +$0.015 each).
