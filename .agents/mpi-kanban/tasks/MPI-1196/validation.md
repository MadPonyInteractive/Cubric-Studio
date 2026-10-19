# MPI-1196 validation

## Stretch (the fix in a06a96432)

- Cause measured on Fabio's flowVideoEdit_008 (Swap the person, picture's room, imported_006 1232x2016 into a
  576x1024 render): frame 0 matched the picture squeezed to 576x1024, not centre-cropped.
- Fabio re-ran it with the picture pre-cropped to 9:16 (crop_001 1136x2016 -> flowVideoEdit_009): not stretched
  (Fabio, 2026-10-19). The graph now does that crop itself on template 6 (nodes 27-29).
- Builder == API on nodes 27-29 and 110; raw relinked (11 -> 28/29 -> 110); injection validator passes; 50 workflow tests pass.
- NOT yet: a run of the shipped graph itself (the in-graph crop has only run as Fabio's hand crop).

## Late start (open, not fixed)

- _008 and _009 both trail their clip (_006) by ~16 frames (0.7 s) for the WHOLE clip: the result holds the
  picture's own pose (arms down) for ~16 frames, then plays the dance from its first move, so every move is late
  against the music and the clip's last ~0.7 s of moves never appears (4-frame strips + motion-energy lag, +16/+17).
- _006 (same template, same settings, picture = an edit of a snapshot of the clip's frame 0) was in sync (lag 0).
- Same as MPI-1036 bench R3d/R3e (mirror-shot picture opened on its own pose ~0.8 s); R3f (front-facing picture
  whose pose was close to the clip's) opened clean. Wording did not move it (R3e). So the trigger is a picture whose
  pose differs from the clip's first frame, on template 6.
- _007 (Change the outfit, no picture, clip _006) was also late and changed the room: a different failure, not studied.
