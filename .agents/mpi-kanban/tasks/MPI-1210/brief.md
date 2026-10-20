# MPI-1210 - 2.1.2 release readiness

Release this week (Fabio, 2026-10-20). Current shipped version 2.1.1.

## Signing (from MPI-616)

Signing is LIVE: every portable dispatch from mpi-ci `main` (`4796a48`) passes
`--sign`, and the build fails if any .exe/.dll/.node is not Valid. Proven 2026-10-20
on run 39442831579 (24/24 Valid, MPI-616 validation.md).

- [x] MPI-616's test dispatch green, Windows census 24/24 `Valid`
- [x] mpi-ci signing workflow merged to `main`
- [ ] If the release build fails at signing: read the log for `AADSTS` (an Azure
      login error hides behind signtool's bare "unexpected internal error"); the
      client secret expires ~2028-10-19 (calendar reminder 2028-09-19)
- [ ] After the release build: download the Windows zip and re-run the census
      (`Get-AuthenticodeSignature` over every .exe/.dll/.node -> all Valid)
- [ ] Flip the "unsigned" wording once the 2.1.2 release is public (not before: 2.1.1
      is still the unsigned download). Every place that says it, found 2026-10-20:
      - `README.md:141-143` (public: "builds are not code-signed ... Smart App Control
        may have blocked it ... code signing is the fix")
      - `docs/releases/github-release-checklist.md` ~L89-207: the SAC test notes, the
        release-body text that says "not code-signed", and "the standing fix is code
        signing". Rewrite as: signed by Mad Pony Interactive since 2.1.2.
      - the 2.1.2 release body itself
      Keep: SAC still blocks `.bat/.vbs` update scripts (they cannot carry a
      signature), so the pre-1.3.0 "download the full zip" advice stays.
      SmartScreen caveat: a NEW publisher identity can still get a SmartScreen
      "unrecognised app" prompt until download reputation builds - say "signed", not
      "no more warnings".
- [ ] Note: the first signed update bundle carries every signed binary again in
      full (signing changes their bytes), so the 2.1.2 delta is larger than usual

## Release

Follow `/mpi-release` for the rest.
