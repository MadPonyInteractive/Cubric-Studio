# MPI-1253 brief

## Noticed

- 2026-10-23: an `app:isolated` instance with its own profile still points its renderer at a ComfyUI on :48188 that is not its own (a peer's or Fabio's engine): a Create boxes read on the default `comfy` describe backend POSTed `/prompt` there. A plain browser page was stopped by CORS; whether the Electron window is stopped too was not checked. Pin `cubric.llm.describeBackend` = `endpoint` (or block off-origin fetches) before driving a describe in an isolated instance.
