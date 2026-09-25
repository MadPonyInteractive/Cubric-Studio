# MPI-934 Checklist

- [x] `placeContentAsset` renders a `.svg` to PNG with `rasterizeSvg` (the MPI-933 size rule) before hashing; stored and returned as `.png`.
- [x] Covers every caller: agent loop (`agentTools.placeAsset`, plain path), in-app agent (`agentDispatch`), Flow input drop (`MpiBaseFlow`, data URL).
- [x] Tests for the path and data-URL forms.
