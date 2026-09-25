# MPI-919 checklist

- [x] `edit` op: slots 2-4 gated on `referenceCollage`
- [x] Nano Banana ModelDefs carry `referenceCollage`
- [x] cloudExecutor sends `imagePaths` in strip order
- [x] route collages 2-4 refs, one ref unchanged, ratio follows image 1
- [x] unit test green; full suite green
- [x] live paid run with 2, 3 and 4 refs, output read (see validation.md)
- [x] doc: no subsystem doc covers the cloud executor; the design lives in the headers of
      `routes/deepinfra.js` and `routes/deepinfraCollage.js`
- [ ] in-app: four chips on a Nano Banana edit in the prompt box (Fabio)
