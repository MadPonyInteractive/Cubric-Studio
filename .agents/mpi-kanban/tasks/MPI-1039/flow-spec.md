# Multi-angle Flow - spec draft (for Fabio's approval)

Status: DRAFT 2026-10-25, written from the bench (rounds 1-34, validation.md; prompt words = `research/angles.py`). People only; objects deferred.
Nothing here is built. Every claim names the round that proved it.

## What the user gets
One picture of a person in, the same person seen from another camera position out, same place, same style
(photo or 2D drawing). The user picks the camera on two step sliders - TURN and HEIGHT - with a pre-rendered
3D Cosmo preview per stop (Flow UI notes, plan.md). "All angles" runs every stop (e.g. a LoRA training set).

## The stops
- TURN (8): front, 3/4 front L/R, profile L/R, 3/4 back L/R, back.
- HEIGHT (proven: 3): low (worm's-eye from just above the ground), level, high (looking steeply down).
  Overhead (top-down) works on the front only and not reliably on a plain studio (round 19: man 4/4, woman ~2/4).
  Extreme low is not a separate stop: the proven low already is a ground-level worm's-eye.

## Which model runs each stop (the split, Fabio 2026-10-24; rounds 29-34)

| Turn \ Height | level | low | high |
|---|---|---|---|
| front | the source | Qwen, 1 edit (r29-30, 4/4) | FLUX.3, 1 edit (r7/r23) |
| 3/4 front L/R | FLUX.3, 1 edit (r27, r31) | FLUX.3 turn, then Qwen low (r30-31) | FLUX.3 turn, then Qwen high (r32-34) |
| profile L/R | FLUX.3, 1 edit (stage 2 b6 28/28; r35-36: R 4/4, L photo 6/6, L anime MIRRORED 0/6) | FLUX.3 turn, then Qwen low (r35, 8/8) | FLUX.3 turn, then Qwen high (r35, 8/8) |
| 3/4 back L/R | FLUX.3, 1 edit (r25, r31) | FLUX.3 turn, then Qwen low (r30-31) | FLUX.3 turn, then Qwen high (r32-35) |
| back | FLUX.3, 1 edit (r24-25) | FLUX.3 turn, then Qwen low (r31) | FLUX.3 turn, then Qwen high (r35, 4/4) |

Every cell has now been run (r35, 2026-10-25). OPEN BLOCKER (r36-37): some turns come out as MIRROR IMAGES - the
right side of the body drawn on the wrong side (the watch / bag check in validation.md). Clear on the anime left
profile 0/6 (FLUX.3 and Qwen both), seen on approved anime cells too (r27 3/4 front L, r25 3/4 back R 222) and maybe
one photo cell. Mirroring was never graded before round 36; an audit of every turn cell comes before this spec locks.

Why two edits on a turned + pitched stop: FLUX.3 will not change the height of an already-turned picture (r31-32,
0/16), and Qwen overshoots or pastes the ref's room when it turns (r29). FLUX.3 owns turns, Qwen owns height changes
on a turned picture and the front low. Each edit is its own queue row (Fabio's slider rule: both sliders moved =
two edits).

Model settings: FLUX.3 = flux3-klein edit, Turbo, 1K; Qwen = qwen-image-2-1 edit with NO ratio and NO tier (the edit
then keeps image 1's own frame). Speed: FLUX.3 ~33 s, Qwen ~55-60 s per edit on the bench GPU.

## The prompt recipe (one template per stop, filled in by the Flow's agent)
Every prompt = MOVE + END STATE + REVEAL + KEEP, naming the TARGET view, never "rotate by X from here" (prompt rule,
Fabio 2026-10-23: the source may already be angled).
1. MOVE: "Shift the viewpoint of the first image <around the subject / up / down> to match the mannequin reference
   in the second image: ..." For a Qwen height step on a turned picture: "keep the same <three-quarter side /
   rear three-quarter / back> view of the woman as in the first image, but the view <rises high above her /
   drops to just above the floor>".
2. END STATE: what the frame shows, in FRAME terms (frame-left/right) plus the subject's own left/right - which
   shoulder is near, where the feet point, how much face shows; for heights, what is large at the top/bottom.
   The 3/4 front turn uses the "almost side-on" overshoot words (r27): the model under-turns, so the words aim past 45.
   Lows add "with her whole head still in frame" (r31: no head crop).
3. REVEAL: name what the new view shows of the PLACE (r15, r25, r30, r33) - without it the place freezes on turns or
   drops on heights. The agent reads the source first and writes it: on a turn, which landmarks swap sides or leave
   the frame; on a low, what is above (sky, power lines, signs / studio ceiling + softbox); on a high, the ground
   from above (paving, kerb, shop-front bases + that turn's landmarks).
4. KEEP: "Take only the viewing angle from the mannequin reference. The subject is still the same <real person /
   drawn anime woman> from the first image ... keep identity, pose, the place, the light and the image style
   unchanged." For a drawing, "flat 2D style ... It stays a drawing, not a photo" (r23: style held 20/20).
5. FRAMING (Qwen high steps only): "The camera stays as close to her as in the first image: she still fills most of
   the frame height." Without it Qwen pulls the camera back (r32-33); with it she keeps her size 8/8, the high holds
   7/8 (r34, Fabio's eye test pending).

## The reference image (second input)
- A pre-rendered doll (Fabio's unisex ControlNet doll, `blender/doll_build.py`), one render per stop, from the SAME
  Blender cameras as the Cosmo previews. FLUX.3 steps use the doll in its room (`out/doll/`); Qwen steps use the doll
  on plain white (`out/doll_plain/`) - Qwen copies the ref's background (r30).
- Turned + pitched stops have their own twin cameras (low/high at the turned angle, `blender/plain_build.py`).
- Size rule (Fabio 2026-10-24): output = the user's custom size, or the source's size; the ref is padded to it
  (Resize Image v2, edge pixels), r20.

## Safety
Qwen is the model that can ADD nudity; FLUX.3 cannot, and both keep a naked source as-is (Fabio 2026-10-25). Every
Qwen step runs behind the child-safety gate like any other edit. No NSFW round run.

## Known weak spots (open, not blocking a first version)
- 3/4 front: the overshoot words land near profile on the 2D source, a real 3/4 on photos only 2/4 (r27-28).
- Results are seed-sensitive (stage 2 b5): the Flow offers "try again" per view (a new seed).
- Not benched: overhead on turned stops, zoom in the Flow (r21 says zoom works in words on a real place, weak on a
  plain studio).
- Profile turns on the anime street: the street keeps running away behind her instead of across the frame (r35).
- Every chained edit costs a little likeness (stage 2 b6) - two edits is the maximum per stop.

## Decision asked of Fabio
Build it as a Flow with this routing and these stops? And: show only the benched cells (greyed-out others), or
offer every cell and accept the untested ones as best effort?
