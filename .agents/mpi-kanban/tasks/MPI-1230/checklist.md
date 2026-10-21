# MPI-1230 checklist

- [x] Find what closes the open dropdown on a slow runner (CI 39601605307)
- [x] Provoke it locally: spec fails before the fix
- [x] Fix in the shared harness (shellWindow) so every spec gets a fully booted window
- [x] Provoked race green after the fix
- [x] Full desktop suite, npm run lint, npm test green
- [x] Docs: testing.md / testing-desktop-specs.md
