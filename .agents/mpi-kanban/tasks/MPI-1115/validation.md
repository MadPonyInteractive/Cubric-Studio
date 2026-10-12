# MPI-1115 validation

## What shipped

- **Worker** `C:/AI/Mpi/mpi-ci/cubric-updates` (mpi-ci `c7b4661`), deployed 2026-10-12 at
  `https://updates.cubric.studio`. `GET /v1/posts` serves the latest 20 #dev-updates posts;
  `GET /v1/img/<msg>/<att>` proxies the images. Bot token is the Worker secret `DISCORD_TOKEN`
  (set by Fabio, never in chat or the repo).
- **App** (`776822f81`, `039cf5d28`): landing-nav bell with an unread badge, `MpiDevUpdates`
  slide-over (Organism), `MpiImageCarousel` (Compound: one image at a time, arrows, count,
  click for a big modal with arrows + close X), card X marks a post read, Mark all read,
  Join the Discord, "All caught up" empty state. `devUpdatesService.js` owns
  `state.devUpdates`; acknowledged ids in Storage; first launch = newest 3 unread.
- **Privacy page** (Website `dfd6754`): "Dev updates" section + the short-version list;
  wording signed off by Fabio; confirmed live on cubric.studio/privacy/.

## Evidence

- Worker: `node --test` 7/7 (mapping, cache, 502 not cached, image route refuses non-channel ids).
  Live: `/v1/posts` 200 with 18 real posts; one image 200 `image/png` 1,876,391 bytes,
  `Cache-Control: public, max-age=86400, immutable`; unknown route 404.
- App: `tests/dev-updates.test.cjs` (seed 3, acknowledge, feed slide + prune, offline keeps
  state, mark all). Full suite 3260 tests, 3258 pass, 0 fail, 2 skipped.
  CI green on `039cf5d28` (tests.yml run 38295313017).
- Isolated instance against the live feed: 3 unread on a fresh profile; carousel 1/5 -> 2/5;
  image opens the modal on 2/5, its arrow -> 3/5, its X closes it with no post marked read;
  card X -> 2 cards, badge 2. Earlier round: Mark all read -> empty state, badge hidden.
- Fabio's eye test 2026-10-12: "looks great".

## Not done

- No release-notes entry yet: proposed at close-out as a Your call line.
