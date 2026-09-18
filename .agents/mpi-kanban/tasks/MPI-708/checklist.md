# MPI-708 checklist

- [x] Gate — 1.5.0 ships first
- [x] The 1.5.1 bridge — teach the installed fleet the new names (met without a 1.5.1, see plan drift 2026-09-17)
- [x] Repo renames and the CI gate
  - [x] mpi-ci checkout gate accepts both slugs (pushed before either rename)
  - [x] Hub renamed Cubric-Studio -> Cubric-Connector; its remote, description and headings updated
  - [x] Cubric-Vision renamed -> Cubric-Studio; local remote updated; old slug 301s
  - [x] build-portable.yml dispatches the new slug; a real dispatch passes checkout on all three legs
  - [x] Cross-repo pointer sweep (mpi-ci, hub, MadPony-Identity, ComfyUi-MpiNodes, Vision tool docs + kanban rule)
  - [x] README: "formerly Cubric-Vision" note; mascot removed (Fabio, 2026-09-17)
- [ ] Renderer — mascots and display strings
  - [x] Phase 2b: non-mascot display strings (appName.js + .cjs, index.html, MpiAbout, updateChecker,
        projectUI, MpiAudioRecorder, pages/components.js, models.js, illustrious/pony recipe headers)
  - [x] Phase 2b: Studio logo (assets/mascot/studio/logo.png) in the titlebar + About, and the
        regenerated icon set (favicon.png, build/icon.{png,icns}, media/icons/cubric-vision.{png,ico,icns})
  - [x] Phase 2b: MpiErrorDialog:149 and MpiNewProject:40 KEPT as "Cubric Vision" — real on-disk
        folders (userData is pinned by app.setName; Documents heals only on major >= 2), both commented
  - [x] Phase 2b: Fabio's own check — titlebar, About, landing kicker (verified 2026-09-18, Option 1);
        taskbar/pinned icon excluded on purpose — it is MPI-807, not a Phase 2b defect
  - [ ] Mascots: PARKED until the action animations land (plan drift, top)
- [ ] Parallel Batch: Non-renderer sweep
  - [x] Heal the Documents folder (version-gated to 2.x; routes/shared.js + tests/documents-heal.test.cjs)
  - [x] Build identity (exe, artifact names, productName, updater default repo, PRESERVE)
  - [x] Decision: old CubricVision.exe on updated installs: (c) keep at 2.0, delete at 2.1, re-pin note (Fabio, 2026-09-17)
  - [x] Main process and server strings
  - [x] Docs sweep (except docs/agent-chat.md, held by MPI-774, and docs/playbooks/add-flow/README.md, held by MPI-532)
  - [x] Agent tooling and CI text (except .claude/skills/cubric-vision-generate/SKILL.md, held by MPI-774)
  - [ ] Held-file pass: docs/agent-chat.md:90 (MPI-774), docs/playbooks/add-flow/README.md:3 (MPI-532) once their claims release; cubric-vision-generate/SKILL.md done
- [ ] The 2.0 release
