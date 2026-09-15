# MPI-763 checklist

Scope decision (2026-09-15, this session): only byte-to-text DISPLAY of storage sizes changes.

- Dep `size` strings stay parsed as 1024-based. They are DATA: `computeDepHashes.py --sizes`
  regenerates them from measured bytes on that base (`docs/playbooks/add-model/02-dependencies-r2.md`),
  so `sizeToGb` / every `_parseSizeToBytes` returns true bytes. Display converts those bytes.
- RAM / VRAM stays binary (`heroStats`, `MpiMemoryMonitor`, `footprint`, the RunPod RAM/VRAM
  metric `_gbToBytes`): a "24 GB" card is 24 GiB.
- Speeds (`MB/s`) unchanged: not GB, and the ETA parses speed and bytes on one base.
- Correctly labelled KiB/MiB (`MpiToolOptionsGif`) unchanged.

## Steps

- [x] `_fmtGb` and the resume-offset log in `routes/downloadManager.js` to 1e9
- [x] UW-deps total log in `routes/engine.js` to 1e9
- [x] `js/utils/formatBytes.js` to base 1000 (Model Manager, installed display, project UI, Ollama)
- [x] `MpiModelManager`: download stats `gb`, plugin tile size, plugin uninstall confirm (raw `size` strings)
- [x] `MpiFlowLibrary`: uninstall confirm + extra-dependencies label
- [x] `MpiProjectName` `_formatBytes` to base 1000
- [x] `tests/desktop/flow-uninstall-button.spec.js` re-derives the new text
- [x] `tests/decimal-gb-units.test.cjs` pins decimal output
- [x] `docs/runpod-remote-engine.md` § 5 Units note
- [x] `docs/releases/UNRELEASED.md` fix entry
- [ ] Unit tests + desktop spec pass

## Note for log readers

`app.log` lines from `download` (`free space`, `install blocked`, `write probe skipped`,
`resuming ... from N GB`) and `engine` (`UW deps total size`) switch to decimal GB with this
card. An older log's GB figures are ~7% smaller for the same bytes; do not compare them raw.
