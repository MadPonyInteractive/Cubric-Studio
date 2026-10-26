# MPI-1304 checklist

- [ ] Replace the wmic probe in routes/platformEngine.js with Get-CimInstance Win32_VideoController
- [ ] Update tests/gpu-detect-once.test.cjs to the new probe
- [ ] Real probe on this machine (no wmic) returns the card name
- [ ] npm test + lint green
