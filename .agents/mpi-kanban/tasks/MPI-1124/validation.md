# MPI-1124 Validation

## Evidence (2026-10-13)

- 14 guides + `/guides/` hub on website branch `guides-mpi-1124` (commits `8deaacd`, `0b21fde`,
  `f85de75`, `3ed419f`, `97e1db6`), NOT pushed.
- Headless Chrome (playwright) over all 16 pages at 375px: JSON-LD parses, FAQ markup count ==
  FAQPage count, no broken internal links, no em dash, no horizontal page overflow. ALL PASS.
- Every guide's primary CTA clicked: lands on the homepage `#download` section (top 80-81px).
  The Claude browser pane cannot prove this: smooth scroll never runs while the pane is hidden.
- Claim audit (mpi-kanban claim-auditor) on the 7 product-heavy pages: 27 proven. Fixed: the
  Character Sheet style is "3D animation"; Qwen-Image 2.1 alpha only on make and edit. Held as
  true: the under-18 refusal (ships in 2.1, the publish date), Krea 2 NSFW "trained mostly on
  photos" (`docs/agent/models/krea-2.md:7`), Head Swap on Klein 9B (`head-swap.md` status).

## Moved elsewhere

- Publishing (merge + push at the 2.1 cut, re-check dated competitor facts, ask before the
  re-crawl ping): MPI-1044 § "After the cut".
- Third-party listings (awesome-list PR, AlternativeTo, Reddit): Fabio deferred, "another stage".
