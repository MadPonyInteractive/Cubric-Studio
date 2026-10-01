# MPI-1007 validation

## Source
- RunPod measured ComfyUI benchmarks: runpod.io/articles/guides/best-gpu-for-comfyui
  (Secure Cloud Pods, Jul 3 - Sep 10 2026, single user, median s/img). Numbers read from the
  page's raw HTML table, not a summary.
- Neither API has a speed field (checked 2026-10-01): v2 `GpuType` = id, name, pool,
  manufacturer, memory, secure, community, price, maxCount, availability, dataCenters,
  cudaVersions; GraphQL `gpuTypes.throughput` exists but is null on all 49 cards.
- No Krea2 in RunPod's set; Klein 9B bf16 used as the ranking proxy. Video (Wan 2.2,
  LTX-2.3) was "Coming Soon" on the page, though its summary already quotes a few video
  figures (B200 119 s Wan 2.2 T2V A14B; 4090 cheapest on distilled LTX-2.3). No table yet.
- GPU ids matched against RunPod's catalogue display names (RTX PRO 4500 = the 32 GB
  `NVIDIA RTX PRO 4500 Blackwell`, RTX PRO 6000 SE = `... Server Edition`).

## Checks
- `node --test tests/gpu-picker.test.cjs`: 7/7 pass (gen speed table finite, L4 has none,
  measured order pinned: PRO 6000 SE beats B300).
- `npx eslint` on `MpiGpuPicker.js` + `runpodGpuSpecs.js`: clean.
- No caller of `gpuTflops` / `GPU_TFLOPS` left in js/routes/services/tests/scripts.
- Rendered the real `MpiGpuPicker` with the real `styles.css` from a scratch static server
  (no app, no engine): bars green (`--accent-ok`), labelled "Gen speed", H100 SXM full bar,
  L4 and A100 PCIe show no bar, overlay note names the source.

## Remaining
- Fabio's eye test of the green bar and label in his app.
