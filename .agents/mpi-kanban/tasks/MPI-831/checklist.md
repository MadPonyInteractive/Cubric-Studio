# MPI-831 Checklist

- [x] The Third-party Flows section
- [x] The media flag (planned as a source flag — the section header says source, so the
      badge carries media instead)
- [x] Dimmed uninstalled tiles
- [x] The two paid tiles — built, automated checks green, awaiting Fabio's look
- [ ] Sync `js/components/types.js` — the `MpiTileSheetItem` typedef is three keys behind
      (phase 2's `mediaImage`/`mediaVideo`/`mediaAudio`) plus phase 3's `dimmed`, and the
      instance-method list is missing `setDimmed`. Deferred, not forgotten: MPI-857 and
      MPI-859 both held fresh write claims on that file through phase 3.
- [ ] Move `.mpi-tile__chip--purchase` from `MpiFlowLibrary.css` into `MpiTileSheet.css`
      beside the other four chips and drop the `.mpi-flow-library` scope. It is parked
      because MPI-853 held a live write claim on that file through phase 4; message
      `86e7cdf6` asks that session to move it or hand it back. Two lines.
