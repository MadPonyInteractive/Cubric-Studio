# MPI-919 checklist

- [x] `edit` op: slots 2-4 gated on `referenceCollage`
- [x] Nano Banana ModelDefs carry `referenceCollage`
- [x] cloudExecutor sends `imagePaths` in strip order
- [x] route collages 2-4 refs, one ref unchanged, ratio follows image 1
- [x] unit test green; full suite green
- [x] live paid run with 2, 3 and 4 refs, output read (see validation.md)
- [x] doc: no subsystem doc covers the cloud executor; the design lives in the headers of
      `routes/deepinfra.js` and `routes/deepinfraCollage.js`
- [x] in-app "provider could not complete": chips carry only `url`, executor read `filePath` (fixed, tested)
- [x] sweep: every cloud model's media input field vs schema_in, output vs schema_out; live paid
      run of every never-run media path except Veo and NB Pro/Seedance 2 (proxied)
- [x] FLUX-2 pro/max take bare base64; Seedream links, FLUX-2 `image_url`, Veo `videos` read
- [ ] Veo i2v live ($1.20 fast) - output path fixed from schema only (Fabio: spend?)
- [ ] in-app: four chips on a Nano Banana edit in the prompt box (Fabio)
