# MPI-901 brief

Two holes in the remote (RunPod) completion backstop in `js/services/comfyController.js`.

1. `_reconcileFromHistory` returns early on `!status.completed` BEFORE its `status_str === 'error'`
   branch. ComfyUI writes `completed: false` for BOTH an execution error and an interrupt, so the
   error branch is unreachable: a remote prompt that FAILS while its terminal WS event is lost is
   polled every 5s forever and its store job never settles (lane stays busy).
2. `execution_interrupted` is handled nowhere. A Stopped prompt's listener, resolver, rejector and
   history poll leak for the life of the app.

Found while tracing a field report (queue slot stuck on RunPod until Stop); that report turned
out to be environmental, these two are real regardless.
