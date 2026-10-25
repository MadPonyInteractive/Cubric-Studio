# MPI-1291 validation

## 2026-10-25 - property verified, sitemap submitted
- Fabio added `cubric.studio` as a **Domain** property in Google Search Console (his Google account).
- Verified via Cloudflare Domain Connect ("Authorize DNS records from Google", one-time, no future access):
  Google added one TXT at the apex, DNS only. Search Console: "Ownership verified", method "Domain name provider".
  Do not remove that TXT record - verification drops with it.
- Sitemap: `sitemap.xml` already existed in `Cubric Studio (Website)` and `robots.txt` points to it. It lists all
  19 indexable pages incl. local-ai-image-generator and uncensored-ai-image-generator; the 7 pages not in it
  (audio, prompt, video, vision, l/fr, l/fr-ea, l/fr-pro) are all `noindex`, so they are correctly left out.
  No website change needed.
- Submitted `https://cubric.studio/sitemap.xml`. Search Console showed "Couldn't fetch" right after submit; the live
  file returns 200 `application/xml`, 19 `<loc>`, fetched with a Googlebot UA - so that is first-read lag, not a fault.

- Recorded in MadPony-Identity `ops/ONLINE-DIRECTORY.md`: a Google Search Console row under Services (where to look,
  login, Domain property, sitemap, data start date), a never-delete note on the Cloudflare TXT record, and a pointer
  from the cubric.studio row. Not committed yet.

## Left before close
- ~2026-10-28: sitemap status reads Success; first look at Performance > Queries and Pages recorded on MPI-1288.
