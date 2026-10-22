# MPI-1250 Validation

Shipped in `1b3f8b24d` (master, 2026-10-22).

- `tests/licence-gate.test.cjs`: 12/12, incl. the new pin that `nvidia-pid` resolves to a
  descriptor with `nonCommercial: true` and the bundled `/licences/pid/LICENSE.txt`; the
  existing "every descriptor carries what the gate renders" test proves the file exists on disk.
- Bundled licence blob sha256 `5a974fcf...82af` = Comfy-Org/PixelDiT LICENSE = nvidia/PixelDiT-1300M-1024px LICENSE.
- Pre-push hook: lint + unit tests green on `1b3f8b24`.
- CI: no run of its own (superseded by the next push). The run on `4677f4b15` is RED on a
  MOSS style-rack test from MPI-1249's commits stacked on top; not this card's files. Its owner
  (session "Moss image 8") was told.
- Not eye-tested in a running app: the gate dialog and tile flag are the same data-driven
  path Qwen-Image 2.1 (MPI-936) already exercises; this card adds data only.
