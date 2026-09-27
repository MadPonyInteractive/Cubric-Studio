# MPI-806 checklist

Spec: https://docs.runpod.io/api-reference-v2/migrate-from-v1 (v1 retires 2026-11-15).

- [x] App client `routes/runpodRemote.js` on `https://api.runpod.io/v2`: every `_rest()` call site mapped (pods, network-volumes, templates), start/stop via `POST /v2/pods/{id}/action`, list responses unwrapped (`{pods:[]}`, `{networkVolumes:[]}`), nested create spec (`gpu`, `cpu`, `mounts`), RFC 9457 errors
- [x] Every caller of the client re-read for v1 response-shape assumptions (remotePodLifecycle, remoteEngine, remoteHeaders)
- [x] Unit tests: request shapes asserted against the v2 docs, not against our own code
- [x] Pod runtime watchdog (`mpi-ci/cubric-vision-pod/wrapper/wrapper.py` `_self_stop`): v2 action call AND a status-code check - today a non-2xx is logged as "self-stop issued" and the Pod keeps billing
- [ ] Runtime: `./publish-runtime.sh dev` -> restart a Pod -> watchdog stop observed -> `promote` (Fabio's go: rents a Pod). NEVER `stable`
- [ ] Live app leg on v2 (Fabio's go: create/stop/delete a Pod, list volumes)
- [x] Docs: runpod-remote-engine.md names v2
