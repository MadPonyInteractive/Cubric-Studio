# MPI-965 checklist

- [x] A1: the Worker in mpi-ci/cubric-bench (validate, median, aggregate, page), tested under `wrangler dev --local`
- [x] A2: the app shares a clean whole run, keeps no errored run, shows the community score, links the page
- [x] A3: the privacy page draft, committed locally in the Website repo, never pushed
- [x] Go live: Worker + D1 on Fabio's free Cloudflare account, smoke from Node fetch, bench.cubric.studio attached on his yes
- [x] Live check + publish: Fabio's shared Ollama run shows on the page, he judges the copy, privacy page pushed on his yes (2026-10-01: granite4.1:8b 14/34 on the page; redesign judged and deployed on his yes)
- [x] Stamp the Ollama benchmark scores (qwen3.6:35b, ornith:9b, gemma4:12b, granite4.1:8b) into RECOMMENDED_REMOTE_MODELS.ollama with the suiteHash (2026-10-01: ornith 23/34, gemma4 18/34, granite 14/34; qwen3.6:35b skipped, 22.6 GB does not fit the 16 GB card)
