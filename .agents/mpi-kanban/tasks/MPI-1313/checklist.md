# MPI-1313 checklist

Standby until 2.1.3 has shipped. Design and bench: `research/findings.md`.

- [x] FLUX.3 bench: one box per character, 4/4 clean in every variant
- [x] MOSS-Image: takes no reference (FLUX.3 only)
- [x] UI design chosen by Fabio (findings.md § "The design Fabio chose")
- [ ] Bench boxes with bare names, no looks in the desc
- [ ] Wire: box -> picture (`from`/`src_bbox` row, `<id> from <ref_image_N>` cite), drop the keep line under Custom size
- [ ] Panel: name click selects the row (no more cite), selected-row background, + adds a picture to the selected box, thumbnail under the field with X, click opens the gallery picker
- [ ] **Close-out: tell Fabio that MPI-1314 (stuck box-name field, same panel) is the NEXT card to do.** Fabio 2026-10-27: do not let it be forgotten.
