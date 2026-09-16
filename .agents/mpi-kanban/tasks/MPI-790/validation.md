# MPI-790 validation

Rule added to `.claude/rules/dos_and_donts.md` on the user's approval (2026-09-16), after MPI-788:

- CSS & Styling: new entry "Never remove an element ONLY on `transitionend`" with the
  `getAnimations()` wait, the no-timeout note, and the MPI-788 incident.
- Sub-Agent Briefing: one bullet with the same rule, so dispatched workers get it.

Documentation only; nothing to execute. The recipe it names is the one MPI-788 shipped and
verified in `js/components/Primitives/MpiToast/MpiToast.js` (see `tasks/MPI-788/validation.md`).
