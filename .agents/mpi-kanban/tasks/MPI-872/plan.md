# MPI-872 — The cubric.studio/flows redirects

**Umbrella:** MPI-780 phase 3 (which is itself a member of the MPI-560 Flow track).
**Gate:** MPI-595 Gate A, the MPI-780 chain, link 4. **2.0 does not cut until this holds.**

## The problem

Cubric Studio 2.0 advertises two Flows it does not ship: Head Swap and DramaBox left the app
in MPI-781 and are sold as Gumroad packages. MPI-831 phase 4 put a **Get it** tile for each
into the Flow Library, and those buttons open:

```
https://cubric.studio/flows/head-swap
https://cubric.studio/flows/drama-box
```

Neither resolves today. A user who clicks gets a 404 **on our own domain**, which is worse
than never advertising the Flows at all.

## Why the app does not just link to Gumroad

Asked and settled twice (MPI-831 `## Decided`, and the correction to MadPony-Identity
MPI-81's brief). The first 100 buyers of each Flow get it free through a **100-use 100%-off
offer code carried IN the URL**. Cubric-Vision is a public AGPL repo, so a coded URL
committed here could be found and spent to zero by people who never open the app — the
hundred free copies would go to scrapers. The redirect also lets the code be changed or
retired without shipping an app release, which matters because the app cannot see how many
uses remain.

So the app links to our own domain, and the coded URL lives in website config only.

## What to build

Two redirects in `c:\AI\Mpi\Cubric Studio (Website)`, each pointing at the coded Gumroad
URL for that product. Shape follows whatever that repo already does for redirects — read it
before choosing; do not invent a mechanism.

`/flows/<id>` is deliberately a pattern, not two special cases: MPI-799 opens a community
Flow registry at 2.0 and more paid Flows may follow, so a third product should be one config
line, not another card.

## Blocked on

The two coded URLs, which only Fabio can produce — Gumroad has no write API, so creating the
products and their offer codes is manual (MadPony-Identity MPI-81). **Until those exist this
card cannot finish**, but the route and the config can be built and tested against the plain
product URLs first.

## Verify

Not by reading config. Load both URLs in a real browser and arrive at the right Gumroad
product page **with the discount applied**. Then do it once more from inside a released 2.0
build, by clicking the tiles in the Flow Library — that is the path a buyer actually takes,
and it is the only one that proves the app, the redirect and the product agree.

## The gate says 2.0; the code says every build (Fabio, 2026-09-21)

**There is no version gate on the two Get-it tiles.** `PAID_FLOWS` in
`js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js` is a plain constant with no
`APP_CONFIG.dev_mode` check and no version comparison, so the tiles render in **any** build
cut from master — a 1.6.2 hotfix included. The MPI-595 Gate A chain that blocks on this card
names **2.0 only**, which is narrower than the code's reach.

So the failure mode the chain exists to stop (a user clicks Get it and 404s on our own
domain) is reachable before 2.0, by a release nobody attached the gate to. `minAppVersion`
does not help: the packages declare `2.0.0`, which only means a buyer on 1.6.x installs a
*disabled* tile — it says nothing about the advert, and the advert is what 404s.

Whoever cuts the next release, whatever its number, owns one of these:

- these redirects resolve first (the cheap version is a placeholder landing page for
  `/flows/<id>` ahead of the Gumroad products — a real page beats a 404 even with nothing to
  buy on it yet); or
- a known-issue bullet in that release's notes saying the two tiles are adverts for products
  that are not on sale yet.

Not proposing a code gate: Fabio settled that the tiles ship as they are, and adding one
would mean shipping an app release to remove it later.

## Order on release day

2.0 published → these redirects resolve → the Gumroad products published. A product live
before its redirect is harmless; a redirect pointing at nothing is a dead end.
