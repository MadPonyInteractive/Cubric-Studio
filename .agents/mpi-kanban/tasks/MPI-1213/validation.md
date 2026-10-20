# MPI-1213 validation

Fix: `6797446c8` (node_lock `submodules` pin, `_installNodeSubmodules`, drift on an empty submodule, devkit, docs).

## Evidence

- **Pin.** GitHub contents API on ssitu/ComfyUI_UltimateSDUpscale@bebd5696 names the gitlink
  `repositories/ultimate_sd_upscale` -> Coyote-A/ultimate-upscale-for-automatic1111@2322caa4.
  Its archive downloaded twice: same sha256 `0797d41b...`, 19,299 bytes. Coyote-A master is that
  same commit today, so the files match what the node fetched before; now they are pinned.
- **Unit:** `tests/node-submodules.test.cjs` 4/4 (pin complete for every declared submodule;
  empty submodule = drift, filled = not; installer fills from a verified archive and skips a
  filled one; a wrong sha256 is refused and the folder stays empty, no staging left).
  Mutation: disabling the drift branch fails test 2.
- **Full suite:** `npm test` 3472 pass, 0 fail; `npm run lint` clean.
- **Live, real bytes:** the real `runCustomNodeInstall` loop on a scratch engine with the real
  GitHub node zip: submodule folder filled (`.gitignore, LICENSE, README.md, scripts`),
  `scripts/ultimate-upscale.py` present, marker stamped AFTER it, drift check clean.
- **No fetch at import:** the node's own `__init__.py` submodule check run with every socket
  connect forbidden: passes on the installed folder; on a copy with the submodule emptied it
  raises `NETWORK USED` (negative control).
- **CI:** run 39506052455 on `6797446c8`: success (unit + desktop 1-4).

## Not covered

- **Pod:** the wrapper volume-installs the node from the plain GitHub archive, so on a Pod the
  pack still fetches Coyote-A master at import. Linux SSL succeeds there, so it works, but it
  is unpinned. Fixing it is a wrapper change (read `submodules` from the install body) plus a
  runtime publish and a Pod test: separate card.
- Not run on the tester's machine; 2.1.2 carries it. On that build his engine reads the empty
  folder as drift and the boot repair re-installs the node with the submodule.
