# MPI-939 — checklist

Close-out heals from MPI-938, approved by Fabio 2026-09-26 ("yes to all three").

- [x] `CLAUDE.md` router row "Debugging a live app bug": a source/dev run logs to
      `%APPDATA%\Cubric Studio\logs\app.log`; every portable build (released or hand-delivered,
      v1.5.0 included) logs to `<install>\user-data\logs\app.log`
- [x] `.claude/skills/mpi-release/SKILL.md`: a "Private 1.6.x build" recipe pointing to MPI-938,
      with its two traps (the user writes the approval token; a delta over a pre-rename baseline
      retires `CubricVision.exe`)
