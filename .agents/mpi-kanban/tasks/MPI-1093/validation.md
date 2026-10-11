# MPI-1093 validation

Approved by Fabio 2026-10-11 ("yes to both", then "add them to the card", then "do MPI-1093 now").
Support floor he set: 1.5.0 - anything only a pre-1.5.0 build installs may be deleted.

## Code (commit 4174c7354)

- Six dep entries keep their ids and filenames (the orphan sweep keys off `filename`) but no
  longer carry `url`/`mirrorUrl`; the old URLs are kept as comments (MPI-698 shape).
- `scripts/check-dep-urls.mjs:52` skips a dep with no `url`, so release:deps cannot go red on
  the deleted objects.
- `node --test "tests/**/*.test.cjs"`: 3127 tests, 3125 pass, 0 fail, 2 skipped.
- CI on 4174c7354: Tests run 38162542056, conclusion success.

## R2

- `rclone delete --files-from-raw` on the 7 keys: rc=0, 7x "Deleted".
- `research/r2_audit.py c2f47ac8` afterwards: 137 objects, 451.6 GB (~$6.62/mo, was 532.7 GB /
  ~$7.84 before this card and the MPI-612 leg). None of the 7 keys listed.
- What remains in the audit is deliberately kept: boogu-qwen3vl-8b-clip (installed by every
  release incl. 2.0.1), klein-9b-lora-headswap (a paid Flow package names it), klein-lora-outpaint
  (installed BY 1.5.0, MPI-603).

## Not done

- HF copies (Wan t2v pair on Mad-Pony-Interactive/cubric-studio): not approved, R2 only.
- Stray key `..` + `/cubric-pod-runtime/vision/_reloadtest/start.sh`: auto mode refused the
  deletefile; empty, costs nothing. Fabio can remove it from the Cloudflare dashboard.
