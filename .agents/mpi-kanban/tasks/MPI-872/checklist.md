# MPI-872 Checklist

- [ ] Read how `Cubric Studio (Website)` already does redirects — do not invent a mechanism.
- [ ] Build `/flows/<id>` as a PATTERN, not two special cases (MPI-799 brings more Flows).
- [ ] Wire both ids against the plain product URLs first; the coded ones can land later.
- [ ] Get the two coded URLs from Fabio (MadPony-Identity MPI-81, Gumroad is manual-only).
- [ ] Verify in a browser: both URLs land on the right product WITH the discount applied.
- [ ] Verify from inside a released 2.0 build by clicking the Flow Library tiles.
- [ ] Tick link 4 of the MPI-780 chain in MPI-595's Gate A checklist.
- [ ] **Any release cut BEFORE this card lands, not just 2.0** — the tiles have no version
      gate, so either the redirects resolve first (a placeholder page counts) or that
      release's notes carry a known-issue bullet. Plan.md § "The gate says 2.0; the code
      says every build".
