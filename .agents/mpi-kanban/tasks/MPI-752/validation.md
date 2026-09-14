# MPI-752 validation

## Root cause

`_startRemoteDownload` builds `toInstall` from the Pod's status pre-check. When that check
throws, or `foldBackWrapperStatus` drops a short answer, `statusResults` is empty and every
dep is sent (harmless: the wrapper answers already_installed). The disk-full gate summed the
same list, so files already on the volume were billed as new downloads. Unknown install
state was read as absent. A `requirementsOnly` node re-run was billed at full size too.

The live Pod refusal that prompted the card was not replayed: its log line had rotated out
(local logs only reach back to 2026-09-03). This is the only mechanism found that bills a
full model size on a volume already holding its shared deps.

## Evidence

- Offline probe, real `_startRemoteDownload`, wrapper stubbed, 30GB free: status check OK ->
  install starts; status check throws -> refused at 46.3GB (need was 20.5GB).
- `tests/remote-disk-gate-unknown-state.test.cjs`: 3 of 5 failed before the fix (short
  answer 46.3GB, requirements-only node 41.5GB), 5 of 5 after. The nothing-installed case
  still refuses, so the gate still works.
- `npm test` 977/977.
- Local twin: install state comes from a disk stat (`isDepInstalledOnDisk`), no unknown arm.
  User's live LTX 2.3 High install was refused at 60.7GB needed / 30.3GB free - unchanged.

## Model panel

- First cut computed `onDiskBytes` but never returned it from `_modelState`, so the line
  never rendered; lint did not flag it. Caught by the user, fixed in ec780dd4. A scan of every
  `st.<field>` read against the return object found no other gap.
- User-verified 2026-09-14 on Krea 2 NSFW: `12.1GB on disk · 12.3GB to download` under
  Disk 24.4GB, matching a direct G: measurement (11.9GB of weights present plus nodes,
  12.25GB transformer missing). To-download figure in --ink-1, approved.

## Commits

- e09b8a14 remote gate + panel line + docs + release note + test
- ec780dd4 panel line renders, always states the download, colour, never-sum doc note

## Not done

- A stranded `.part`/`.hfstage` from an interrupted Pod install still counts as used volume
  space (docs/download-manager.md, "The disk gate counts a dep's own stranded .part").
