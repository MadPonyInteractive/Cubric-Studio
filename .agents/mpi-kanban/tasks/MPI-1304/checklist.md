# MPI-1304 checklist

- [x] Replace the wmic probe in routes/platformEngine.js with Get-CimInstance Win32_VideoController
- [x] Update tests/gpu-detect-once.test.cjs to the new probe
- [x] Real probe on this machine (no wmic) returns the card name
- [x] npm test + lint green
