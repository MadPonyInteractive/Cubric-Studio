# MPI-1157 checklist

- [x] Route validates, answers 202 at once, runs the uninstall in the background (both engine twins)
- [x] Success reported on `download:uninstalled`; failure on `download:uninstall-failed`
- [x] MPI-1142 per-dep in-flight re-check kept
- [x] Renderer: `downloadService.uninstall()` shows a Transfers row (runCpuJob, moving sweep) and resolves when the broadcast lands
- [x] Failure visible: `ui:warning` with the reason
- [x] Every caller (MpiFlowLibrary, MpiModelManager x3) still awaits the finished uninstall
- [x] Tests for the new contract; `npm test` green
- [x] Live check in `npm run app:isolated`
