# MPI-1039 plan - camera-angle bench

## Goal
Find which local edit model turns one picture into believable new camera angles of the same
character / room, and which prompt wording does it. Bench first; a Flow only if one wins.

## Bench - STAGED (Fabio 2026-10-22: small first, widen only for what passes)
- Models (Fabio, only these): `flux3-klein` (edit, base), `klein-9b` (kleinEdit), `qwen-image-2-1` (edit, 1k).
- Stage 1 - face: one FLUX.3 t2i head-and-shoulders source (face + some chest, clothes, jewellery),
  LOPSIDED details (hoop in her left ear only, mole on right cheek, side parting) so a real turn is
  told apart from a mirror. Per model: front -> 3/4, front -> profile, its OWN 3/4 -> low angle.
  9 runs + 1 source, seed 1234, one camera-wording prompt (FLUX.3 guide: "Shift the camera viewpoint").
- PROMPT RULE (Fabio 2026-10-23): the user's photo may already be angled, so a prompt NAMES THE TARGET VIEW
  (side, degrees from where the subject faces, camera height and tilt), never "shift/rotate by X" from the
  current view. Proof: the same target prompt from two different inputs (front, 3/4) lands the same view
  (`angles.py <port> sweep2`, sheet `sweep2_2k.jpg`). `sweep` (FLUX.3 wordings) predates the rule: p1/l1 are
  relative and do not count.
- Stage 2 - full body, only the models that pass stage 1.
- ~~Stage 3 - rooms / scenery~~ DROPPED (Fabio 2026-10-23): a stationary camera looking round a place is the
  360 Panorama Flow (MPI-623). This card is the ORBIT: camera moves round a subject (person, face close-up, object).

## Product shape (Fabio 2026-10-23)
An orbit Flow on FLUX.3: horizontal orbit (yaw: the 8-point strip front, 3/4 front L/R, profile L/R, 3/4 back
L/R, back) x vertical orbit (pitch, 5 levels: extreme low, low, level, high, extreme high). The user generates
every angle (a full strip / grid, e.g. LoRA training sets) or one requested angle, picked on a small 3D gizmo:
two sliders (X yaw, Y pitch) and a tiny 3D view of the camera round a stand-in subject.
Agent notes: the model cannot hit an exact degree, so the sliders SNAP to the tested stops; each stop maps to a
prompt template (side + FRAME direction + 2-3 visible consequences + "only the camera moved"); one edit per view
from a FRONT picture, angled input -> front view first, seed retry on a miss.
Open: pitch x yaw combinations, the extreme stops, objects (no left/right of their own - frame terms only).
Fabio 2026-10-23 on the agent notes: (1) step sliders, yes. (2) one slider moved = one edit; BOTH moved = two
edits (yaw step, then pitch step) - so the bench must also prove a pitch edit on a yaw result. (3) objects: a
short prompt hint for the user, or a quick pass that checks what the subject is before picking the templates.
- Driver: `research/angles.py <port>` through an isolated app (`/connector/generate`) under
  `gpu_lease.py run --poll 2`; results `research/out/stage1.json`, sheet `research/sheets/stage1.jpg`.
- Cards land in project "FLUX3 Flow Bench", named `angles <model> <shot>`.

## Verification
**Verify mode:** user-ux
Sheets in `research/sheets/`; Fabio judges which model + wording holds identity and moves the camera.

## Current State
2026-10-23: stage 1 (face) + stage 2 (full-body orbit) DONE on FLUX.3 Turbo 1K - results, recipe, pass rates
in validation.md. Driver `research/angles.py` (modes: fast vN, body bN, b4, b5, b6, best, b6sheet); results
in `research/out/*.json`, sheets in `research/sheets/`, cards in project "FLUX3 Flow Bench".
NEXT (Fabio said "not yet", await his go): vertical-orbit bench - 5 pitch levels (extreme low, low, level, high,
extreme high) x 3 yaws (front, 3/4 front L, 3/4 back L) on the face (`stage1_2k.json` source) and the full body
(`body.json` source), ~30 runs ~11 min; plus pitch-on-a-yaw-result (the two-step case). Objects after.
Isolated app is DOWN (Fabio closed it): relaunch with `CUBRIC_AGENT_PROFILE=%LOCALAPPDATA%\Temp\cubric-agent-profile-mpi1212
node scripts/launch-instance.mjs` (run_in_background), use the printed port. Every GPU run under
`gpu_lease.py run --poll 2 --timeout <long>`; a peer often holds the GPU.

## Remaining Work
- [ ] Stage 1 (face, 9 runs) + Fabio's eye test
- [ ] Stage 2 full body, stage 3 rooms
- [ ] Decide: Flow or not

## Completed

## Plan Drift
