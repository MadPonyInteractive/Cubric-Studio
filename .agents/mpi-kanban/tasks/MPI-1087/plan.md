# MPI-1087 plan

## Current State

2026-10-11. Fabio passed MPI-1089 and asked for two things here, on ALL THREE Character Sheet Flows:
1. One Headless front body control (brief: option A drops the IMAGE button; Fabio's 2026-10-11 message says "the
   button from the left" - asked him which).
2. Compare must be switchable: a Flow whose only surface is compare (Editor, Scribble Object, Object Stamp) offered
   no toggle (`_mountSurfaceToggle` needs 2+ surfaces), so every head on/off check meant dragging the bar.

## Steps

- [ ] Compare <-> Result toggle when compare is the only surface (`MpiBaseFlow.js` `_resultModes`)
- [ ] One Headless control, per Fabio's answer, on Character Sheet, from Images, Editor

## Verification

**Verify mode:** user-ux
- Existing MpiBaseFlow tests pass; Fabio's eye test on the three Flows.

## Completed

## Plan Drift
