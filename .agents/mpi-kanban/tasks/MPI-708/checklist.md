# MPI-708 checklist

- [x] Gate — 1.5.0 ships first
- [x] The 1.5.1 bridge — teach the installed fleet the new names (met without a 1.5.1, see plan drift 2026-09-17)
- [ ] Repo renames and the CI gate
  - [x] mpi-ci checkout gate accepts both slugs (pushed before either rename)
  - [x] Hub renamed Cubric-Studio -> Cubric-Connector; its remote, description and headings updated
  - [x] Cubric-Vision renamed -> Cubric-Studio; local remote updated; old slug 301s
  - [ ] build-portable.yml dispatches the new slug; a real dispatch passes checkout on all three legs
  - [x] Cross-repo pointer sweep (mpi-ci, hub, MadPony-Identity, ComfyUi-MpiNodes, Vision tool docs + kanban rule)
  - [x] README: "formerly Cubric-Vision" note; mascot removed (Fabio, 2026-09-17)
- [ ] Renderer — mascots and display strings
- [ ] Parallel Batch: Non-renderer sweep
- [ ] The 2.0 release
