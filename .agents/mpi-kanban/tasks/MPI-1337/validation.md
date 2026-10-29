# MPI-1337 Validation

## What changed
- `dev_configs/node_lock.json`: ComfyUI-VideoHelperSuite pin removed.
- `js/data/modelConstants/nodesDeps.js`: entry removed, with a comment saying why it is gone.
- `js/data/modelConstants/models.js`: removed from Wan 2.2 I2V and Wan 5B `dependencies`.
- `tests/universal-nodes-remote.test.cjs`: no longer requires VHS in the Pod volume set.

## Why nothing needed it (2026-10-29)
- No `class_type` in `comfy_workflows/*.json` or JS is a VHS node (MPI-1344 audit).
- Resize Video runs on ffmpeg (`routes/toolResize.js`), not a VHS graph any more.
- The `VHS_latentpreview` clip marker the app listens for is sent by MpiNodes `preview.py`
  and KJNodes `ltxv_nodes.py`. VHS's own previewer hook only turns on when a prompt's
  `extra_pnginfo.workflow.extra.VHS_latentpreview` is set; the app never sets it.
- `imageio-ffmpeg` stays in `python_deps.in` (MpiSaveVideo needs it; it was only ever
  declared by VHS, and `--check` now lists it as "curated but not declared" — expected).
- Neither paid Flow (DramaBox, Head Swap) uses a VHS node.

## Evidence
- `node scripts/compile-node-deps.mjs --check` → OK.
- `node tests/universal-nodes-remote.test.cjs` → OK (11 code-only packs); `node-drift` → OK.
- `npm run lint` → exit 0. `npm test` → 3803 tests, 3799 pass, 2 fail — both Video Edit
  Flow tests, caused by the uncommitted `comfy_workflows/flow_video_edit.json` that the
  MPI-1335 session has claimed; not touched here.
- Scratch engine on :48199 (`--cpu --disable-all-custom-nodes --whitelist-custom-nodes`
  every pack except VHS, own temp/out/in/user dirs): all packs imported (only the
  pre-existing optional KJNodes PatchTritonVAE warning), and `/object_info` has every one
  of the 4,192 node instances in all 66 shipped workflows + both paid Flows' workflow.json.
  Script: `research/` of MPI-1344 (`check_nodes.py` in the session scratchpad).

## Not done
- No GPU generation: an `app:isolated` run shares the user's engine on 48188, which still
  has VHS loaded, so it could not prove the absence. A real no-VHS Wan render needs that
  engine stopped — optional, the node check above covers the graph.
- `c:\AI\Mpi\mpi-ci\cubric-vision-pod\node_lock.json` and `install_nodes.sh` still list VHS.
  It is a VOLUME (code-only) node, so the Pod never volume-installs it now (the app's set
  drives that); the image copy syncs at the next Pod image build.
