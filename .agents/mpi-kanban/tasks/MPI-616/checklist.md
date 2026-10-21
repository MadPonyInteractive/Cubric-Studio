# MPI-616 Checklist

## Measure first

The original plan here wanted a clean-install Windows 11 box with SAC enforced.
It turned out not to be needed — a signature census answers the go/no-go with no
SAC machine and no system changes. Superseded steps kept struck through so the
reasoning survives.

- [x] Census both trees with `Get-AuthenticodeSignature` — app 17/19 unsigned,
      engine 563/638 unsigned (2026-08-24, `validation.md`)
- [x] Establish which binaries can and cannot be signed by us
- [x] Decide without renting or borrowing a SAC box
- [ ] ~~Find/build a Windows 11 box with SAC enforced — clean install~~ — not required to decide
- [ ] ~~Download `CubricVision.exe` through a browser so it carries MOTW~~ — belongs to post-signing confirmation, not the decision

## Fix the release wording regardless of the outcome

- [x] `docs/releases/github-release-checklist.md`: hard-block branch added — no prompt, no "Run anyway", app never opens (§ "The third outcome")
- [x] Note that MOTW removal does **not** help against SAC
- [x] Note that SAC has no per-app allowlist
- [x] Correct the implication that one clean measurement generalises
- [x] Give release authors the CodeIntegrity query (3033/3076/3077/3118)

## Signing — gated on eligibility, not on further measurement

- [x] **Confirm MadPony Interactive's registration status** — sole trader vs limited
      company. Public Trust **Individual** validation is US/Canada only, so the UK
      route is **Organization / DBA**. Needs: legal/trading name matching public
      records, a business identifier (a UK VAT number qualifies), a website on a
      domain the entity owns, and **two contact emails on that same domain**.
      **Done 2026-10-20** (MadPony-Identity MPI-75): UK sole trader, no VAT.
      Business identifier = D-U-N-S **506528764**, resolving in D&B's public
      lookup as MAD PONY INTERACTIVE, Flat 2, 35 Nelson Road South, Great
      Yarmouth, NR30 3JA (enter the address exactly so). Website
      madponyinteractive.com. Emails `fabio@` + `contact@madponyinteractive.com`
      (Namecheap forwarding to Gmail, so they accept external links).
      The old "entity must be 3+ years old" note is **not** a real rule — absent
      from Microsoft's current docs (see brief).
- [x] Price it properly: $9.99/mo Basic (5,000 signatures/mo — 19 per release is
      nothing) plus Azure subscription, Entra tenant, app registration with an
      annually-rotated client secret, identity validation renewal every 2 years.
      Checked against the FAQ 2026-10-20: needs a **paid** subscription (free,
      trial, sponsored refused); billing is **not pro-rated** and starts at account
      creation, **before** validation (1-20 business days), so a failed validation
      still costs at least one month. Extra documents must be issued within the
      last 12 months; three upload attempts, then onboarding stops for good.
- [x] Re-read the quickstart 2026-10-20 (updated 2026-10-08). Two facts the card
      lacked: (1) **Organization validation also ID-checks the person** named on it -
      when the request goes to "Action Required", Fabio does an AU10TIX check
      (passport or driving licence + phone + Microsoft Authenticator). (2) If more
      documents are asked for, Microsoft wants business registration papers or a
      **domain invoice naming the entity and contact** - a sole trader has no
      registration papers, so check the Namecheap invoice for madponyinteractive.com
      names "Mad Pony Interactive" BEFORE submitting (three upload attempts only).
      No UK region: use **North Europe** (`https://neu.codesigning.azure.net`).
      **Checked 2026-10-20, passes:** registrant contact and the 2026-06-07
      registration invoice both read Fabio Goncalves / Mad Pony Interactive at the
      D&B address; invoice is good until 2027-06-07. PDF kept in `C:/AI/Mpi/_private/`,
      uploaded only if Microsoft asks.
- [x] Decide with Fabio - **yes, 2026-10-20**, Artifact Signing Basic $9.99/mo (Namecheap checks passed first)
- [ ] Fabio's own steps (account, payment and ID - never an agent's): Azure
      subscription (Pay-As-You-Go) -> register `Microsoft.CodeSigning` provider ->
      create Artifact Signing account, Basic, North Europe -> give himself
      **Artifact Signing Identity Verifier** -> Identity validations > Organization >
      New Identity > Public, with the D-U-N-S details above -> AU10TIX check when
      asked -> wait 1-20 business days -> certificate profile, type **Public Trust**
      **Progress 2026-10-20:** Pay-As-You-Go subscription ("Azure Plan") up, 2FA on
      the Microsoft account, `Microsoft.CodeSigning` registered, account
      **`madponysigning`** created (resource group `cubric-signing`, North Europe,
      Basic, endpoint `https://neu.codesigning.azure.net/`) - **billing started
      2026-10-20**. Identity Verifier role assigned. **Organization / Public identity
      validation submitted 2026-10-20**, In Progress; fields read back and match
      the D&B listing. **COMPLETED the same day (2026-10-20), expires 2029-01-22.**
      Trap seen: after the AU10TIX check the email/portal link reads "No Access -
      link used already" and Fabio believed the face check had failed; it had
      PASSED. A delete attempted then failed with "Request data is updated by some
      other source" (the pass being written) - luckily. Before deleting a request
      after a confusing ID check, wait and Refresh: it may already be Completed.
- [x] Certificate profile **`MadPonyPublicTrust`** (Public Trust) created
      2026-10-20, subject `CN=Mad Pony Interactive, O=Mad Pony Interactive,
      L=Great Yarmouth, S=Norfolk` - street + postcode boxes UNTICKED on purpose.
- [x] App registration **`cubric-ci-signing`** (single tenant) created; the
      **Artifact Signing Certificate Profile Signer** role is on the APP at the
      `madponysigning` account scope (confirmed by portal notification).
- [x] Client secret `mpi-ci`, 730 days (2026-10-20 -> ~2028-10-19). Rotation
      reminder: Google Calendar all-day 2028-09-19, email+popup T-2/T-1, event id
      `lhgjo9mpt2dm6iadmjdskc5ml0` (description also flags the identity
      validation expiry 2029-01-22).
- [x] **Fabio adds three Actions secrets to `MadPonyInteractive/mpi-ci`**:
      `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` - in 2026-10-20.
      The first client secret's Value showed in a chat screenshot, so it was
      rotated the same day: old one deleted in Azure, new secret re-created under
      the SAME name `mpi-ci` (730 days, not `mpi-ci-2`; Fabio confirmed
      2026-10-21) and set in GitHub. Calendar reminder 2028-09-19 still fits.
- [x] Wire the signing pass into `scripts/build-portable.mjs` (`--sign`, commit
      `6d64c2d2d`) — after the rebrand (rcedit would void an earlier signature),
      before the manifest hashes. Signs every non-Valid `.exe/.dll/.node` in the
      staged tree, re-reads Authenticode status, throws unless all Valid.
      mpi-ci workflow on branch `mpi-616-signing` (`18fc3ce`): signtool + dlib
      from NuGet, .NET 8, metadata.json with EnvironmentCredential only.
      Merge to mpi-ci `main` only after a green signed dispatch.
- [x] RBAC trap: assign **Artifact Signing Certificate Profile Signer** to the
      **app registration**, not to the user account (done, see above)
- [x] Re-run the census on a signed build — every app binary must read `Valid`
      (2026-10-20, run 39442831579: 24/24 Valid, 21 ours; see validation.md)
- [ ] ~~Confirm on an SAC-enforced box~~ — **dropped 2026-10-20**: neither Fabio nor
      the tester has an SAC box, and SAC's rule is "publicly trusted signed code
      runs", which the Valid census checks directly. Fallback if a user still
      reports a block: their CodeIntegrity log (3033/3076/3077/3118). A fresh
      Windows 11 VM can enable SAC if eyes-on is ever wanted.
- [x] ~~Only then drop the unsigned warning from the release notes~~ — moved to
      MPI-1210 (2.1.2 release readiness): it belongs to the first signed release

## Explicitly rejected

- [x] **A `.bat`/`.cmd` launcher is not an escape.** SAC hard-blocks scripts with no
      override (MPI-387 D — it is what broke clean Windows 11 installs, removed in
      1.3.0), and `.bat` cannot carry an Authenticode signature at all, so it has no
      path off the reputation lottery, ever. ComfyUI's `.bat` survives on enormous
      byte-identical download reputation that a per-release rebuild can never earn.
