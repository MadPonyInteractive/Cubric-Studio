# MPI-1303 validation

- `npm run lint`: clean (max-warnings 0).
- `npm test`: 3742 pass, 0 fail.
- Live, own `app:isolated` instance in the browser pane, real MpiModelPicker over the real MODELS list
  (43 non-deprecated, 16 cloud): no filter 43 tiles; Cloud 16; close + reopen keeps Cloud lit with 16
  tiles and `mpi_model_picker_source` = `["cloud"]`; Local alone 27, stored `["local"]`.
- Header row is the same MpiFilterBar as the Model Library (Source tags left, search right).
- Not checked: Fabio's own eye on it inside a project workspace.
