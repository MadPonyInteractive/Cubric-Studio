# MPI-756 checklist

- [x] Remote gate test: dep whose own reclaimBytes covers the shortfall is allowed (failed before fix)
- [x] Remote gate test: same volume, no reclaimBytes field, still refused
- [x] Local gate test: queued dep with a marker-blessed partial is credited (failed before fix)
- [x] App remote gate bills max(0, size - reclaimBytes)
- [x] App local gate bills max(0, size - getPartialBytes(localPath))
- [x] Wrapper `_is_complete_on_disk` path: status returns allocated reclaimBytes (.part + .part.hfstage tree)
- [x] Wrapper `_download_hf` removes stale .part at start
- [x] Wrapper delete removes .part.hfstage
- [x] docs/download-manager.md HF staging consequences updated
- [x] Wrapper self-check `test_partial_reclaim.py` passes after the fix (user-run 2026-09-15)
- [x] Live Pod leg (user-run): publish-runtime dev, interrupt HF install, retry passes gate (2026-09-15, 43.8 GB leftovers vs 5.08 GB free, installed)
