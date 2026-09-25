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
- [x] Veo i2v live ($1.20 fast) - OK (validation.md)
- [x] paid outputs survive: prune matches `cubric-<uuid>` only; output not deleted on serve
- [x] native multi-reference: Seedream 5 Pro, FLUX-2 dev/pro (4), max (8); collage NB only
- [x] FLUX-2 pro/max priced per started MP incl. references; dev priced at its 50 steps
- [x] ratio picker on Seedream 4/4.5 + FLUX-2 pro/max edits
- [x] 422 / wrapped provider 4xx read PROVIDER_ERROR, not CONTENT_FILTERED
- [x] MPI-923 opened for Wan 3.0 reference-to-video
- [x] in-app: ratio picker on those edits, 8 chips on FLUX-2 Max, price tag per reference (Fabio: verified 2026-09-25)
- [x] FLUX-2 pro/max ratio rows <= 1 MiB; 16K references bounded and decodable
- [ ] in-app: four chips on a Nano Banana edit in the prompt box (Fabio)
