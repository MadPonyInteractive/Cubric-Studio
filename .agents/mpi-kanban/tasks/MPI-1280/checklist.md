# MPI-1280 checklist

- [x] Failing test first: a slow model round after generate, the start line must reach the chat before it
- [x] Loop: text riding with a generate (or gif / routine) call is shown once the call has started, dropped if it was refused
- [x] An empty final reply draws no empty bubble
- [x] Voice rule: the start line rides with the call
- [x] Memory nudge no longer costs a round before the user hears anything
- [x] `npm run lint` and `npm test` green
- [x] MiMo-V2.6-Flash bench x1 (55 cases): 51/55 with one DeepInfra-blocked, recorded median 52; ask-first 1/4 noted in validation.md
