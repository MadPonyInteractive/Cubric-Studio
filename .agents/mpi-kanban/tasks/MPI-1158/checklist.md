# MPI-1158 checklist

Why: on 2026-10-16 at 08:07:55Z the Pod-volume gate refused an install with "need 15.9 GB, have 14.1 GB". It was read as Krea 2 NSFW billing files already on the volume. The netlog request body length (11233 bytes = the `krea2` request, 11270 = `krea2-nsfw`) proves the request was for Krea 2 SFW. Krea 2 SFW had been uninstalled at 07:36, so it really did need its 12.57 GiB transformer plus 4 shared style LoRAs: 15.9 GB with the margin. The gate was right. Neither the toast ("this model") nor the log line said which model it meant.

- [x] Failing test: both gates' toast and log line name the model (`tests/disk-gate-names-model.test.cjs`). 3/3 failed before the fix, 3/3 pass after
- [x] `routes/downloadManager.js`: `_installName` (model name, Flow/plugin title, else job key) in both gates' toast; `install <id> blocked` in both log lines
- [x] `npm test` green: 3362 tests, 3360 pass, 0 fail (2026-10-16)
- [x] Commit + push, CI green: `0697b91ae` on origin/master; Tests green on descendant `f823796d7` (2026-10-18)
