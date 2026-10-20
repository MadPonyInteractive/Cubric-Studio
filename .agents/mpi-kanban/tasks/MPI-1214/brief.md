# MPI-1214 - Ultimate SD Upscale on the Pod: the wrapper installs the pinned submodule, not the node at import

On a RunPod Pod the wrapper volume-installs comfyui_ultimatesdupscale from the plain GitHub archive, which leaves
`repositories/ultimate_sd_upscale` empty, so the pack's `__init__` fetches Coyote-A master with Python urllib on first
import: unpinned and unhashed. MPI-1213 fixed the local engine and recorded the pin in `dev_configs/node_lock.json`.

Done = on a fresh Pod volume `repositories/ultimate_sd_upscale` holds the pinned files before ComfyUI imports the pack,
the ComfyUI log shows no "downloading it from https://github.com/Coyote-A" line, and an upscale runs.

1. App: `routes/remoteModels.js` `remoteInstallDep` sends `submodules` from `getNodeSubmodules(dep.id)`.
2. Wrapper (`mpi-ci/cubric-vision-pod/wrapper/wrapper.py` `_run_node_install`): download each, sha256-check, extract
   into `<node>/<relPath>` (reject a relPath escaping the node folder), before stamping `.mpi_node_commit`.
3. Runtime: `publish-runtime.sh dev`, restart a Pod, test, `promote`. Never `stable`. A Pod test costs money: Fabio's yes first.
