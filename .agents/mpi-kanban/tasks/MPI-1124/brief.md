# MPI-1124 Brief: search articles so AI search agents find Cubric Studio

## Why

Fabio asked DuckDuckGo's AI assistant for "ComfyUI alternatives" (2026-10-13). It cited
Fuser, Layer and Griptape; Cubric Studio never came up. These assistants run an ordinary web
search and summarise the top pages. For "easier alternative to ComfyUI local" the top 10 were all
"ComfyUI alternatives" articles, two written by the tools themselves (fuser.studio, tendre.ai).
cubric.studio never said "ComfyUI" on its homepage, so it could not match.

## What shipped (draft, website repo branch `guides-mpi-1124`, NOT pushed)

`c:\AI\Mpi\Cubric Studio (Website)`, commit `8deaacd`:

- `/comfyui-alternative/`, `/local-ai-image-generator/`, `/local-ai-video-generator/`,
  `/uncensored-ai-image-generator/`: each built around real autocomplete phrases (Google + DDG
  suggest, 31 seeds), repeated in title, H1, H2s and FAQ questions. Each has 4 CTAs to `/#download`,
  FAQPage + Article JSON-LD, and links to the other three.
- `styles/article.css` (reading column on top of landing.css).
- `sitemap.xml`, `llms.txt` (Guides section, ComfyUI-alternative + content-policy lines), homepage
  footer "Guides" nav, homepage names its ComfyUI engine once.

Verified: JSON-LD parses on all 5 pages, no broken internal links, no em dashes, no horizontal
overflow at 375px, and the CTA lands on the homepage download section (headless Chrome, 1280
and 375). The Claude browser pane cannot test this: smooth scroll never runs while it is hidden.

## Part B: stale pages were already fixed

`cubric.studio/{vision,video,audio,prompt}/` and `docs.cubric.studio/vision/*` already redirect
live (noindex + meta refresh). Search engines still show the old titles only because they have
not re-crawled. The fix is a re-crawl request (IndexNow / Bing Webmaster Tools; DuckDuckGo uses
Bing's index), which is an outward action and Fabio's call.

## Open, Fabio's call

1. Review the copy, then merge to `main` and push (push = live on GitHub Pages).
2. The uncensored page states the under-18 refusal, which ships in **2.1** (UNRELEASED.md). Publish
   it with 2.1, or reword that line first. The ComfyUI page's FAQ has the same line.
3. Use the word "uncensored" in public copy (drafted that way because it is the searched word).
4. Re-crawl request (IndexNow key file + one ping, or Bing Webmaster Tools) after the push.
5. Listings: PR to `light-and-ray/awesome-alternative-uis-for-comfyui`, AlternativeTo, Unstore,
   media.io, r/StableDiffusion / r/comfyui. All public, all his.

## Next wave of articles (from the autocomplete data)

- consistent character AI / AI character sheet generator (Character Sheet Flow, no LoRA training)
- AI head swap with hair (Head Swap Flow, paid)
- Midjourney / Runway alternative free; Automatic1111 / Fooocus alternative (own pages)
- AI image generator for Mac (only once 2.x is tested on macOS)
- NOT claimed anywhere: AMD support (unverified; "comfyui alternative for amd" is a real query)
