# MPI-1210 validation - 2.1.2 release

## 2026-10-21 preconditions

- master `APP_VERSION` 2.1.1 = latest release v2.1.1; origin/master...master 0/0; last 3 `Tests` runs success.
- `release-baselines/` holds README.md only.
- Pod runtime manifests dev and stable identical (wrapper 0.2.48, same three sha256).
- `routes/mcp.js` TOOLS keys = `mcp/cubric-studio/manifest.json` tools (28, manifest 0.3.2).
- `dev_configs/node_lock.json` since v2.1.1: MpiNodes commit + UltimateSDUpscale submodule only, core tag unchanged.
- No op registry change since v2.1.1: quick-path bump.
- FLUX.3 Klein Pod-proven by Fabio 2026-10-21 (MPI-1181 validation). MPI-1207 edit graphs benched locally, not Pod-smoked.

## 2026-10-21 bump to 2.1.2

- Hotkey fix MPI-1238 (`92a5c410f`) on master before the bump. UNRELEASED folded, plus 12 fixes since
  v2.1.1 that never passed through it (MPI-1216/1220/1221/1223-1226/1228/1229/1234/1236/1238); each
  "used to" claim checked against `v2.1.1` (compaction 128k cap, card at half, wake + auto-look existed).
- Gate 1: Fabio approved the notes as written; he ran `release:approve` (hash 2f9247e7...).
- `release:check` passed. `npm test` 3506 pass, 0 fail. eslint clean on edited files.
- `release:deps`: 1 dead MIRROR, `krea2-lora-accelerator` (HF repo renamed to
  `TheDivergentAI/Krea2-Turbo-Distill-8step-LoRA`, file `krea2_turbo_distill_8step_r128.safetensors`,
  HF lfs sha256 + size = ours). mirrorUrl updated; re-run: all 345 URLs reachable.
- `test:desktop`: 247 passed, 2 failed on 30 s timeouts (flow-chain-toggle, nodev-flag) while unit runs and
  release:deps ran beside it; both re-run alone: 4/4 pass (11 s, 3 s).
- First push refused by pre-push: agent-loop "a waited step frees the model too" lost a fixed 1200 ms
  race on a loaded box, its late release counted in the next test. Fixed to poll (`40c077e03`); 4 parallel
  copies 0 fail; push green; CI Tests 39650665612 success on 40c077e03.

## 2026-10-21 build

- Annotated tag `v2.1.2` on 40c077e03 (Fabio authorized after CI green). Dispatcher 39653025296 ->
  mpi-ci 39653037573 success on win32 / linux / darwin, each log `HEAD is now at 40c077e03`.
- 6 assets in `D:\CubricStudio\Vision\Builds\v2.1.2\`; all three update bundles FULL (`fromVersion: null`),
  Windows update zip 553.7 MB vs 2.1.1's 552.1 MB (every bundle has been FULL since 2.0.1, so the brief's
  "larger delta" note does not apply; dropped from the archival note).
- Signature census on the extracted Windows zip (`Get-AuthenticodeSignature`): 24/24 .exe/.dll/.node `Valid`:
  21 Mad Pony Interactive, d3dcompiler_47.dll + dxil.dll Microsoft, uv\uv.exe OpenAI OpCo.
- CI artifacts left on mpi-ci run 39653037573 (deleting them is Fabio's call).

## 2026-10-21 update leg (Fabio closed his app)

- Published 1.5.0 zip (BUILD_HASH 43b22c407b61) -> 2.1.2 FULL bundle via its own update-from-zip.bat; engine
  copied read-only from the dev engine (0.42.1). One engine start, 0 IMPORT FAILED, no degraded.
- Klein 4B t2i on first launch, 29.2 s under the lease: red bicycle, two wicker baskets, white brick wall
  (opened). SDXL Realistic refused OP_UNAVAILABLE first (not installed in M:), nothing ran.
- Rollback set 0 user-data files; 18/29 byte-identical after the run, 11 = Chromium runtime files.
- `dev_configs/update-evidence.json` written; `release:check:publish` passed. Test app closed via
  CloseMainWindow, 3000/48188 free; Fabio told to reopen.

## 2026-10-21 published

- Gate 2: Fabio approved the body after dropping the pre-1.5.0 "check your version first" section (and
  the RunPod 15 November line inside it). `gh release create v2.1.2 --latest` with the 6 CubricStudio-*
  assets: https://github.com/MadPonyInteractive/Cubric-Studio/releases/tag/v2.1.2
- `releases/latest`: tag_name v2.1.2, prerelease false, draft false; 6 assets `uploaded`, sizes equal
  to the local files.
- Update prompt proven: fresh published 2.1.1 (BUILD_HASH b60ed53033cc) logged
  `[update] update available: v2.1.1 -> v2.1.2, prompting`; closed via CloseMainWindow.
- Website `0d1de08` pushed (9ca2de1..0d1de08); live cubric.studio/privacy/ shows "Last updated
  21 October 2026" and the token line, "The token is not saved" gone.
- README + github-release-checklist + install-test say signed since 2.1.2 (`e9a020e3b`).
- Not done here: CI artifacts on mpi-ci run 39653037573 (Fabio's delete); comms (MadPony-Identity workflow).
