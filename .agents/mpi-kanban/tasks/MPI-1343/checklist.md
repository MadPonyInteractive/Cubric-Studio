# MPI-1343 checklist

- [x] Port usdu/ (MpiUltimateSDUpscale) into MpiNodes
- [x] Port cropstitch/ (MpiInpaintCrop, MpiInpaintStitch)
- [x] Port lanpaint/ (MpiLanPaintImageEncode/ImageDecode/KSampler)
- [x] Port krea2edit/ (krea2edit + Ostris edit nodes)
- [x] Registry-safety scan + tests; commit, push, pin (MpiNodes 4d8b87e)
- [x] Swap class_types in the 46 Vision workflow files
- [x] Drop the 5 packs: node_lock, nodesDeps, models.js deps (mpi-ci Pod copy syncs at the Phase 3 image build)
- [x] Head Swap paid Flow re-export (1.1.1, Cubric-Flows)
- [x] lint + npm test green
- [x] Packs-gone scratch engine: all nodes present
- [ ] Fixed-seed A/B identical per node family (krea2 edit/inpaint/upscale x2, pano360)
- [x] Release note names removed classes
