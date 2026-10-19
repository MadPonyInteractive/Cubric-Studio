# MPI-1194 checklist

- [x] Prove it live: a 0.34.0 portable in a scratch CUBRIC_ENGINE_ROOT, PATH without git, upgrade -> in-place fails on ensureGit
- [x] Fix: on Windows, move the ComfyUI checkout with the portable's own pygit2 (embedded python), never host git
- [x] Unit test covers the git-less Windows branch
- [x] Live re-check: same scratch engine logs `In-place upgrade landed 0.41.0`, no full reinstall
- [x] Playbook 02-local-upgrade.md says how Windows moves the checkout
- [x] npm test (3413 pass) + CI green (run 39188042735 on b3689866b: unit + 4 desktop shards success)
