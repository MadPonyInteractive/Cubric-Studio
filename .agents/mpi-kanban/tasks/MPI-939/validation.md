# MPI-939 — validation

Doc-only heals from the MPI-938 close-out, approved by Fabio 2026-09-26.

- **`CLAUDE.md` router row "Debugging a live app bug"** now separates a source/dev run
  (`%APPDATA%\Cubric Studio\logs\app.log`) from a portable build
  (`<install>\user-data\logs\app.log`). Evidence: `main.js` sets portable `userData` to
  `<portable>/user-data` (`git show v1.5.0:main.js` line 276 has the same fallback, so the
  old "released v1.5.0 still writes there" was wrong too), and MPI-938's patched 1.6.2 install
  wrote `D:\tmp\cv162-apply\CubricVision\user-data\logs\app.log`. The 1.6.1 READ-ME had sent the
  tester to `%APPDATA%\Cubric Vision\logs\app.log` on the strength of the old row.
- **`.claude/skills/mpi-release/SKILL.md`** gains "Private 1.6.x build (hand-delivered, never
  published)": points at `MPI-938/checklist.md` + `validation.md` as the recipe, and names the two
  traps MPI-938 hit (the approval token is user-written; a pre-rename baseline makes the delta
  retire `CubricVision.exe`). Relative link checked: `../../../.agents/mpi-kanban/tasks/MPI-938/checklist.md`
  resolves from the skill folder.
