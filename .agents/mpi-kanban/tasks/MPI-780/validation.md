# MPI-780 validation — umbrella close, 2026-09-27

Closed by session 44454a65 (MadPony-Identity MPI-81) at Fabio's request. An umbrella
carries no code, so this records what closed each link and what the umbrella leaves behind.

## Members

| Id | Outcome |
|---|---|
| MPI-532 | done: the `user_flows/` loader, manifest schema, validator |
| MPI-781 | done: Head Swap and DramaBox packaged in the private `Cubric-Flows` repo, out of the app |
| MPI-872 | **rejected** 2026-09-27: no `cubric.studio/flows/*` redirect. Each Gumroad product applies its code automatically, and Get it opens the plain product page (`fe68f620d`, `MpiFlowLibrary.js` `PAID_FLOWS[].url`), so no code is in this public repo |

## Brief § Fabio only

- **Products + codes:** both LIVE at £4 (MadPony-Identity MPI-81), each with a 100-use
  100%-off code locked to that product and applied automatically. Checked logged out
  2026-09-27: each page shows £4 struck through and "100% off will be applied at checkout".
- **Terms + refund policy:** `Cubric-Flows/LICENCE` v1.0 (Fabio: "Licence is okay",
  2026-09-27), shipped inside each zip as `<id>/LICENCE.txt` by `build-zips.py`; a one-line
  licence summary on each page; per-product refund policy, 30-day money back guarantee plus
  fine print. All three checked on the live pages logged out 2026-09-27. The licence never
  mentions commercial use (stance: `.agents/mpi-kanban/private/paid-flows-licence-stance.md`).
- **VRAM numbers:** derived 2026-09-19 from `footprint.js` (MPI-81 brief), on both pages.

## Left behind

- **MPI-595 Gate A row A4** still describes the redirect. `tasks/MPI-595/` is claimed by live
  session 3749bdc4 ("Release 2.0 blockers 2") with uncommitted work, so the exact edit went to
  it as message `beafbdfe` (A4 done, new Gate B row B7, Gate D release-day line).
- **B7, on the first 2.0 build:** Get it on both paid tiles opens Gumroad at £0.
- MPI-743 and MPI-828 (licence gate / attribution on a paid Flow's path) were never members;
  they stay under MPI-560.
