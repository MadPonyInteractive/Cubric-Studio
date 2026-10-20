# MPI-1214 validation

Done 2026-10-21. Wrapper 0.2.48 promoted to stable (Fabio's yes in chat).

- App: `remoteInstallDep` sends `submodules` (b574b881e). `tests/remote-install-submodules.test.cjs` passes; related node tests 32/32.
- Wrapper (mpi-ci c757aab): `_install_node_submodules` before the commit marker. `wrapper/test_node_submodules.py` passes (fill, sha mismatch refused, escaping paths refused, no staging left).
- Real archive: Coyote-A @2322caa4 zip sha256 = 0797d41b... = node_lock pin.
- Live, RTX PRO 4500 Pod on Fabio's 50 GB volume, dev channel, `wrapperVersion: 0.2.48`:
  - The volume lacked the node, so connect installed it fresh through the new body ("universal nodes: installed ... ComfyUI-UltimateSDUpscale ... ComfyUI restart -> 200").
  - ComfyUI `/internal/logs` from that restart: `comfyui_ultimatesdupscale` imported in 0.8 s, no IMPORT FAILED, 0 lines matching "coyote" / "downloading it".
  - Klein 4B t2i then upscale x2 in project "pod wrapper tests": 1024 -> 2048 in 22 s; log shows USDU "Canva size: 2048x2048".
- `publish-runtime.sh promote`: stable manifest wrapper 0.2.48, sha c59896a5... = tested dev bytes.

Limit: a volume whose USDU folder the pack already filled from master (wrapper < 0.2.48) keeps those files; no drift fires for it. Works, just unpinned.
