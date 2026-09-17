# MPI-708 validation

## Phase 0 / 0b

Met 2026-09-17 (session 53d9d605): `gh release view v1.5.0` is published; the `v1.5.0` tag's
updaters match `^Cubric(Vision|Studio)-...-update-v.*\.zip$` and `apply-update.cjs` accepts
`cubric.vision` and `cubric.studio`. See plan.md Plan Drift.

## Phase 1 — PASSED 2026-09-17 (session ad10647f)

Renames done by Fabio in GitHub Settings (the auto-mode classifier refused `gh repo rename`).

1. **Hub rename.** `gh repo view MadPonyInteractive/Cubric-Connector` -> private hub. The old
   `Cubric-Studio` slug is now the product repo (name reused, so the hub's redirect is gone by
   design); hub remote set to `Cubric-Connector.git` first, `git fetch` OK. Hub `98310e0`
   (headings), repo description updated.
2. **Product rename.** `gh repo view MadPonyInteractive/Cubric-Studio` -> public product;
   `gh repo view .../Cubric-Vision` resolves to `Cubric-Studio`. `git remote -v` here shows
   `Cubric-Studio.git`; `git fetch` and `ls-remote` OK. Old slug:
   `curl -sI https://api.github.com/repos/MadPonyInteractive/Cubric-Vision/releases/latest` ->
   `301` to `/repositories/1197467902/releases/latest`; followed, it returns v1.5.0 with
   `CubricVision-windows-x64-v1.5.0.zip`. `github.com/.../Cubric-Vision/releases/latest` -> `301`
   to `.../Cubric-Studio/releases/latest`.
3. **CI auth gate.** mpi-ci `e23112e` accepts both slugs; Vision `c0972475` dispatches
   `source_repo=MadPonyInteractive/Cubric-Studio`. `gh workflow run build-portable.yml` ->
   dispatcher run `35222050796` success -> mpi-ci run `35222060391`: "Checkout source" = success
   on linux, macos and windows. Log (ubuntu job `105204381139`): `repository:
   MadPonyInteractive/Cubric-Studio`, `ssh-key: ***`, `git remote add origin
   git@github.com:MadPonyInteractive/Cubric-Studio.git`, fetch OK -> the deploy-key path was taken.
   Run cancelled after checkout (conclusion `cancelled`, 0 artifacts) to save Actions storage.
4. **Pointer sweep.** `MadPonyInteractive/Cubric-Vision` -> `Cubric-Studio` in MadPony-Identity
   `eb0ee38` (6 files, slugs only), ComfyUi-MpiNodes README (carried by a peer's pushed commit
   `060e78c`; HEAD line 7 reads the new slug), Vision `c0972475` (8 files). Deliberately left:
   `feature-request-tier-label.md:73` (already correct post-rename), code slugs owned by later
   tasks (redirect-safe), the Website repo (Fabio's; its links and API fetch keep working through
   the redirect, measured on `denoland/deno_std`).
5. **README** (Fabio's request): "formerly Cubric-Vision" note at the top; mascot image and its
   orphaned `.github/readme/mascot-greet.png` removed (`c0972475`).
