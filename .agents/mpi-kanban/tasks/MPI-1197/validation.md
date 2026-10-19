# MPI-1197 validation

Earlier runs (_007, _008, _009, W1 swap LoRA on, W2): `../MPI-1196/validation.md`.

## Bench, 2026-10-19 (the app's engine :48188 under the GPU lease, never the app)

Every run = _009's exact prompt (template 6, picture crop_001 = the hallway girl, seed 27347941, its Input_Look),
ONE thing changed. Lag read from 4-frame strips (hands-to-face) and motion-energy cross-correlation.

- F = the clip swapped for Fabio's REAL footage (resizeVideo_001, the clip _006 was made from): 340 s, +12 frames
  late. So the re-fed H3 clip is NOT the cause: the real footage is late too with this picture.
- A = _006 with grain + slight blur (look filmed): 340 s, +17 late. D = _006's person cut out onto grey (BiRefNet,
  no moving beach): 380 s, +16 late. Neither changes it.
- W2 (MPI-1196) is CONFOUNDED, not a pose test: it swapped the picture to _006's frame 0 but kept the hallway
  girl's Input_Look, and drew a third person in a third room.
- What does separate in-sync from late: in sync = _006 (template 6, its picture an edit of a snapshot of the clip's
  frame 0, so the same pose and words to match) and _005 (op 1 keeping the video's room). Late = every template 6 run
  with the hallway picture, whatever the clip. In the late runs the result holds the picture's arms-down pose
  ~12-16 frames, then plays the dance FROM ITS START, shifted, so the clip's last ~0.6 s of moves never appear.
  Same as MPI-1036 bench R3d/R3e (picture's own pose held ~0.8 s). Fabio met it only via _006 because the hallway
  picture was only ever used with _006.

## The fix: a 17-frame still lead-in (template 6, whole frame), cut from the result

- L = F's real footage with 17 stills of its frame 0 in front (offline), result's first 17 frames cut: hands-to-face
  within ~2 frames of the footage (2-frame strips), vs F ~8-10 late on the same move.
- Built into the graph (builder nodes 36-39, 45-47, 123; API + raw patched from the builder, builder == API on every
  node, raw links consistent; injection validator; 50 workflow tests pass). Bench on the builder graph:
  - V1 = _009 exactly: 450 s (vs 342 s for _009), 73 frames + soundtrack, lag 0 (corr 0.70), in step by eye.
  - V2 = _006's own in-sync run (real footage, edit_001, its seed and words): 440 s (vs 368 s), lag -1: still in step.
- NOT yet: Fabio's eye test in the app.
- PASSED: Fabio re-ran _009 in the app on ca982394f - in sync with the music (2026-10-19). CI 39196400277 green.
