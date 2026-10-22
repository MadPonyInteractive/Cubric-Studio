# MPI-1245 validation

- `MpiModelPicker._mediaBlock` now applies the Model Library's stable featured-first sort.
- `moss-image` carries `featured: true`.
- Order check: importing `MODELS` and applying the sort lists Krea 2, Krea 2 NSFW, FLUX.2 Klein 9B, Qwen-Image 2.1, FLUX.3 Klein, MOSS-Image first; everything else keeps its declared order.
- `eslint` on both files clean; `npm test` 3512 pass, 0 fail.
- Not checked in the running app (look only).
