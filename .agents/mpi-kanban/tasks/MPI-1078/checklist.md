# MPI-1078 checklist

- [x] Shared helper in resolveModelDeps.js (held-outside-models set, partialInstall skips on-disk held deps)
- [x] MpiModelManager._computePartial uses it
- [x] modelUpdateCheck (toast + install proof) uses it
- [x] Test: Wan 2.2 with only umt5 + wan VAE on disk, Krea 2 with only the qwen3vl clip, read not-partial; a missing held dep stays in the denominator
- [x] npm test green (bar a peer WIP failure), committed, pushed (df631df91), CI green
