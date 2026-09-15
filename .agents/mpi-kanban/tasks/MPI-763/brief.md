# MPI-763 - show every GB in decimal units

## Decision (Fabio, 2026-09-15)

Decimal GB everywhere (1 GB = 1,000,000,000 bytes), matching the RunPod console, Hugging Face
and macOS. Accepted trade-off: a local-disk figure will not match Windows Explorer, which labels
binary sizes "GB".

## Why

Found closing MPI-762. The app labels two different units "GB". The gates compare raw bytes, so
no install is wrongly allowed or refused; only the displayed numbers disagree, by about 7%.

- DECIMAL today: RunPod volume size, the Settings volume badge and size field, the Pod disk bar
  (`js/services/podDiskBar.js` `_gb`), the remote gate's total (`sizeGb * 1e9`).
- BINARY today, labelled "GB":
  - `_fmtGb` in `routes/downloadManager.js`: both disk-full toasts (local and Pod volume) and
    the free-space / write-probe log lines. A 55 GB volume reads "49.6 GB free of 51.2 GB".
  - `js/utils/formatBytes.js`: model and file sizes (Model Manager, installed display, project
    UI, Ollama setup, GIF tool options).

Worst visible case: the Model Library on a Pod puts the decimal disk bar next to binary model
sizes, so adding up model sizes under-counts what the bar shows.

## Scope notes for whoever plans it

- Grep for other `1024 ** 3` / `1073741824` / `/ 1024` display sites before trusting the two above
  (`routes/comfy.js`, `routes/shared.js` and `downloadService.js` parse size STRINGS with binary
  multipliers; decide whether those are display or data).
- Update the "Units (MPI-756, measured)" note in `docs/runpod-remote-engine.md` section 5, which
  documents today's mismatch.
- Tests that pin formatted strings, e.g. `tests/disk-full-message.test.cjs`.
- Log lines in `app.log` change units too; say so in the card so nobody compares an old log's
  numbers with a new one's.
