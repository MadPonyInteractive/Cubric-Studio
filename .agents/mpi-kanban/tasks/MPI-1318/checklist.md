# MPI-1318 checklist

- [x] Read the installed engine torch build and compare it with the detected GPU vendor
- [x] A mismatch makes /engine/version-check report needsUpgrade and /engine/upgrade take the full reinstall
- [x] Unit tests for the build reader and the mismatch rule
- [x] npm run lint + npm test green
- [x] Release note line in 2.1.3
