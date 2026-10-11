# MPI-1094 checklist

Fabio, 2026-10-11: Combine on image cards packs them into one sheet (a character or
clothes sheet from views he already has, or a mood board up to 16K). Example: two portrait
shots of one dress, the wider one cropped, ending on a 1:1 sheet.

- [x] `js/utils/sheetLayout.js`: pure packer, shared by the dialog preview and the server.
      Slicing trees (the LTX sheet's idea: exact-aspect cells leave no padding inside) for up
      to 8 pictures, plus order-keeping rows and columns for any count. Shape Auto picks its
      own outer shape; a fixed shape stretches the tree and each cell cover-crops.
- [x] Per picture: Bigger (double weight), framing by drag (pan) and wheel (zoom) in its cell.
- [x] `routes/imageSheet.js`: POST /combine-images renders the dialog's tree at the chosen
      long edge (2K / 4K / 8K / 16K), writes the card's sidecar + thumb.
- [x] Selection bar Combine enabled for 2+ stills; videos keep the old concat.
- [x] `MpiImageSheet` dialog (Compound): preview, Shape, Size, Cancel / Combine.
- [x] Tests: packer coverage + order, route renders a real-pixel sheet with the crop.
- [x] Fabio eye-test in the app.
