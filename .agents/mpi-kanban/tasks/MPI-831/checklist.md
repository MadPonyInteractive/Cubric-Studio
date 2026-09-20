# MPI-831 Checklist

- [x] The Third-party Flows section
- [x] The media flag (planned as a source flag — the section header says source, so the
      badge carries media instead)
- [x] Dimmed uninstalled tiles
- [ ] The two paid tiles
- [ ] Sync `js/components/types.js` — the `MpiTileSheetItem` typedef is three keys behind
      (phase 2's `mediaImage`/`mediaVideo`/`mediaAudio`) plus phase 3's `dimmed`, and the
      instance-method list is missing `setDimmed`. Deferred, not forgotten: MPI-857 and
      MPI-859 both held fresh write claims on that file through phase 3.
