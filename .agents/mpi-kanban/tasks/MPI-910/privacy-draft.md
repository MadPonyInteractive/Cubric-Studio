# MPI-910 Phase 2 - privacy page draft (for Fabio's sign-off)

Target: `C:/AI/Mpi/Cubric Studio (Website)/privacy/index.html` (identical on `main` and `site-2.0`, checked
2026-09-30). Pushing the Website repo needs Fabio's explicit yes. Status: **SIGNED OFF by Fabio 2026-09-30,
word for word, backstop left unnamed. Publish WITH the app release that ships Phase 3 (Seedance reference
videos), not before.** Apply to both `main` and `site-2.0` (or whichever branch is live by then).

Why it changes: the page says "We run no server that receives your prompts, images, videos or projects" and "The
one thing it can upload to us is an anonymous benchmark result". The relay makes both false the day the app
sends it a clip.

## 1. Header comment (line 4, add a line)

  Re-audited 2026-09-30 for the reference-video relay (MPI-910, relay.cubric.studio).

## 2. Meta description

What Cubric Studio and cubric.studio send, where it goes, and why. No account, no analytics, and nothing uploaded
to us except a benchmark result you choose to share, or a reference video you attach to a cloud video, deleted
within the hour.

## 3. "Last updated"

The day the page goes live.

## 4. Intro paragraph

Cubric Studio has no account, no sign-up, no analytics and no crash reporting. It uploads only two things to us,
and only when you ask it to: an anonymous benchmark result, if you tick a box to share it, and a reference video
you attach to a cloud video generation, which we delete within the hour. This page lists every time the app or
this website talks to someone else, what goes with it, and why.

## 5. "The short version", first two bullets

- We keep none of your prompts, images, videos or projects. The one exception is brief: a reference video you
  attach to a cloud video generation passes through our server so the video model can fetch it, and is deleted
  within the hour.
- The app only goes online to download things, to look up community benchmark scores (at most once a day), to
  share a benchmark result if you tick the box, to pass a reference video to a cloud video model, or because you
  connected your own account with another service (DeepInfra, RunPod or an AI provider). The services you
  connected handle your data under their own privacy policies, not ours.

## 6. New section, after "Cloud generation (optional, your DeepInfra key)"

### Reference videos for cloud video (optional, your DeepInfra key)

Some cloud video models, such as Seedance 2.0, only take a reference video as a web link, not as a file. When
you add a video to one of these generations, the app uploads that clip to our own service at
`relay.cubric.studio`, which runs on Cloudflare, and sends DeepInfra the link instead of the file. DeepInfra, and
the company that made the model, fetch the clip from that link to make your video. The link is a long random
address that is never listed or published. The app deletes the clip as soon as the generation ends, whether it
worked or not. If the app cannot (for example, it closes mid-run), our service stops answering the link after 55
minutes and deletes the clip within the hour. Clips can be at most 30 seconds long. We do not look at, copy or
keep them, and nothing records who uploaded one. Like any web service, the relay sees your IP address. We use it
only to limit uploads to 10 a minute, and it is never written down. Reference images and audio do not come to
us: they go straight to DeepInfra with your request, as described above. Cloudflare's privacy policy applies to
the hosting.

## 7. "If you support us or get in touch"

Opening line:
Apart from the IP addresses our two services see and the reference videos that pass through the relay (both
described above), this is the only personal data we receive:

"Why we may use it" (add the relay):
... to answer you, keep our downloads working, pass a reference video you attached to the model you chose, and
limit uploads to the benchmark service and the relay (legitimate interests), and to keep tax records (legal
obligation).

"How long" (add at the end):
Reference videos, less than an hour.

## Decided (Fabio, 2026-09-30)

- Backstop: an R2 storage rule also deletes anything left after 1 day, in case our hourly clean-up ever breaks.
  Not named on the page (the hourly clean-up is the promise).
- When it goes live: with the app release that ships Seedance reference videos (Phase 3), not before.
