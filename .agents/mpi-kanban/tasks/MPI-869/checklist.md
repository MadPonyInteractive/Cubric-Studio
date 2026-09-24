# MPI-869 Checklist

- [x] Pre-flight credit gate in `POST /deepinfra/generate`: estimate vs spendable balance and monthly-limit room, read from `/payment/checklist` numbers only
- [x] Renderer sends the price-tag estimate with the dispatch; toast names the cost and what is left
- [x] Offline test of the balance/limit arithmetic, proved red
- [x] Live: Seedance 2.0 1080p (about $1.90) refused with the toast (Cue) and in chat (agent), nothing billed
- [x] Fabio confirms the dashboard balance matches the derived spendable figure ($1.56)
- [x] Live: OVER_LIMIT toast (Fabio lowers the limit to $3.00, Cues a run between $0.10 and $1.54, restores $5.00)
