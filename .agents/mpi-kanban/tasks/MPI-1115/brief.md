# MPI-1115 - Dev updates bell

## Why

The Discord has a few thousand members, almost all from before Cubric Studio, and the app
links to it nowhere (only the README does). Fabio now posts dev updates in `#dev-updates`
several times a day and nobody who uses the app sees them. The What's New dialog is not the
place: it fires once per version and already carries a long log.

## Product shape (Fabio, 2026-10-12)

- A **bell icon** in the landing nav, beside Models / Flows / Settings / Remote / Hotkeys /
  About (`js/shell/projectUI.js:65-75`).
- A **badge** top-right of the bell with the number of dev updates not yet acknowledged.
- Clicking the bell opens an overlay (the slide-over the other nav items use is the obvious
  fit). Each update is a **card: its images and its text**.
- Clicking a card **acknowledges** it and it leaves the list. When all are read the list is
  empty.

Agreed additions:

- **First launch is not a wall of 40.** On a fresh install only the latest ~3 posts count as
  unread; everything older is marked seen.
- **Mark all read**, for days with several posts.
- A permanent **Join the Discord** button at the foot of the overlay; the empty state reads
  "All caught up" with the same button. The invite is the public one in `README.md`.
- An update's image/link opens the original Discord message, as another way in.
- Acknowledged ids are per-viewer, local (Storage), never sent anywhere.

## Where Fabio writes: Discord itself

No new authoring tool. Fabio keeps posting in `#dev-updates` (drag, paste, text). Rejected:
posting through a Claude session (pasted chat images never land on disk as files) and a
custom posting page (needs auth + a backend for what Discord already does).

## Pipeline

1. **Discord bot** (Fabio creates it - his account): read-only, View Channel + Read Message
   History on `#dev-updates` only.
2. **Cloudflare Worker** on Fabio's existing Cloudflare account (same as R2), free tier. Holds
   the bot token as a Worker secret - the token never ships in the app or this repo. Returns
   the latest N posts as JSON (id, timestamp, text, image list, message URL), cached ~10 min.
   It also **proxies the images**: Discord attachment URLs are signed and expire, and proxying
   means the app never contacts Discord directly.
3. **App** polls the Worker on launch and on an interval; unread = posts not in the local
   acknowledged set.

## Must-dos

- **Privacy policy:** a new outbound call. cubric.studio/privacy/ must name it in the same job
  (see the Website repo).
- Render post text as plain text / the existing safe markdown (`js/utils/markdown.js`) - it
  is remote content.
- A failed or offline fetch is quiet: bell with no badge, never an error toast on the landing
  page.
- Component rules apply: BEM, `ComponentFactory`, icons from `js/utils/icons.js` (add a bell
  there if missing), CSS vars only.

## Blocked on Fabio

The bot token. Code for the overlay can start against a stub feed; the Worker needs the bot.
