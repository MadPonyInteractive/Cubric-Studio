# MPI-828 checklist

Fabio 2026-09-30 (via MPI-595): a 2.0 gate.

- [x] Re-checked the premise: the Flow drawer ALREADY renders the licence row. MPI-666
  (`2b0249e60`, 2026-09-01) added `buildLicenceRows` in `js/utils/flowLicences.js` - name,
  `poweredBy`, Read the licence, Request authorization, report link - mounted by
  `MpiFlowLibrary._licenceFieldHtml` / `_mountLicences`, and `''` for an ungated flow. This card
  was filed 2026-09-19 off the stale playbook note, not the code.
- [x] `docs/playbooks/add-flow/01-descriptor-and-ops.md` no longer says the drawer has no row
- [x] Seen in a running app: the H3 row on Extend Video in the isolated app (MPI-742 run)
