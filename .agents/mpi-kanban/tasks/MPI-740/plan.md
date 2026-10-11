# MPI-740 Plan

The fix is brief.md § The fix; run as MPI-986 Parallel Batch 1.

## Implementation

- [ ] Fix both twins per brief.md. Ownership: `js/components/Primitives/MpiFader/**`.

## Verification

**Verify mode:** user-ux

From 0 dB one wheel tick leaves zero on the components page and in `MpiVolumeControl`; a pointer drag still feels the detent; `el.destroy()` releases every listener.
