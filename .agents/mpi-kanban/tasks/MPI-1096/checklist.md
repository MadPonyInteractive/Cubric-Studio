# MPI-1096 checklist

Research card: nothing ships until Fabio picks a route.

- [x] Pass 1 shortlist (`research/shortlist.md`, 2026-10-11)
- [x] Licence re-check 2026-10-13: Best-Face-ID still `license: other`, no terms
- [x] New candidate SyFe ID-LoRA (2026-08-14) checked and dropped: audio-only target modules (voice ID, face from start frame)
- [x] Bench Best-Face-ID on `G:\ComfyUi` (own :8199 instance, Fabio's bench untouched)
- [x] Same-seed A/B, man + woman, then man close-up on two seeds (Fabio: Ingredients + LoRA best; LoRA alone = different woman)
- [x] Two characters: five sheet layouts x 2 seeds; workflow comparison vs Lightricks' + Best-Face-ID's graphs; detailer / NAG / face-text probes
- [x] Mixed bench (2 characters + setting): one guide per picture collapses, two character guides 1/4 usable
- [x] Fabio's pick (2026-10-14): the shared sheet as shipped, at High, works fine -> no code change
- [x] Durable facts in `docs/models/ltx/reference-ingredients.md` § Face identity
- [x] Black-padding trap carded (MPI-1139)
- [x] Cleanup: Best-Face-ID LoRA (1.3 GB) and bench scratch deleted (Fabio, 2026-10-14); clips kept in `C:\AI\MPI-1096-out\` (160 MB)
