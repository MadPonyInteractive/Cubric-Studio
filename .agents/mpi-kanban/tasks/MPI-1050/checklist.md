# MPI-1050 checklist

- [x] Drop `_didFirstConnectDriftCheck`; both heals run on every connect edge (`js/shell.js`)
- [x] Log each remote install's fetch set (`routes/downloadManager.js`)
- [x] Source-scan guard (`tests/remote-engine-assets.test.cjs`, guard 8)
- [x] Docs + rules wording ("first connect" / "latched")
- [x] Tests pass
- [x] Live: next Pod connect after an app restart installs the engine assets on `lpja78wof3`, and a reconnect re-runs it (fetching nothing)
