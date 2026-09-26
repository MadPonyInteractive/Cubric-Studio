# MPI-943 checklist

- [ ] `routes/imageImport.js`: `POST /image-import/probe` (header-only size, EXIF-upright) + `POST /image-import/reduce` (sharp, limitInputPixels off, to a temp copy)
- [ ] register the router in `server.js`
- [ ] `mediaUploadService.js`: `prepareImageImport(files)` - one dialog per drop for images over 4K; `uploadMediaFile` reduces per decision, and takes a pathed image's size from the probe instead of a full renderer decode
- [ ] `MpiOkCancel`: optional `select` prop (MpiDropdown) + `selectValue` in the payload; props in `types.js`
- [ ] batch call at the multi-file drop sites (gallery, history, agent chat)
- [ ] test: `tests/image-import-reduce.test.cjs`
- [ ] live: a real 16K file through `app:isolated`
- [ ] docs: `docs/gallery.md`
