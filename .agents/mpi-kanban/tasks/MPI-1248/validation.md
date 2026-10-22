# MPI-1248 Validation

## Evidence (2026-10-22)

- Website `main` fast-forwarded to `009cf8a` (commits `ea50c09` guides, `009cf8a` commercial-use
  FAQ) and pushed on Fabio's yes, after his copy review.
- Live: `cubric.studio/ai-image-generator-agent/` and `/mcp-image-generation/` return 200;
  `/local-ai-image-generator/` serves the new commercial-use FAQ.
- Pre-push checks on 6 pages: JSON-LD parses, FAQ JSON-LD count == `<details>` count, no broken
  internal links, no em/en dashes, no horizontal overflow at 375px.
- IndexNow: 8 URLs POSTed to api.indexnow.org, HTTP 200; key file served live (200).

## Decided by Fabio

- Commercial use stays general on the site: the app sets no limit, each model's licence applies,
  most allow it, a few are non-commercial, some ask larger companies for a direct agreement.
  No per-model table.

## Moved elsewhere

- NVIDIA PiD research-only licence, ungated and unflagged in the app: its own session
  ("PiD upscaler: research-only licence, ungated").
- Third-party listings (awesome-mcp-servers, Glama / PulseMCP / Smithery, Reddit answers):
  Fabio posts; drafts on request.
