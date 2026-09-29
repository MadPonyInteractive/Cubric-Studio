# MPI-965 checklist

- [x] A1: the Worker in mpi-ci/cubric-bench (validate, median, aggregate, page), tested under `wrangler dev --local`
- [x] A2: the app shares a clean whole run, keeps no errored run, shows the community score, links the page
- [x] A3: the privacy page draft, committed locally in the Website repo, never pushed
- [x] Go live: Worker + D1 on Fabio's free Cloudflare account, smoke from Node fetch, bench.cubric.studio attached on his yes
- [ ] Live check + publish: Fabio's shared Ollama run shows on the page, he judges the copy, privacy page pushed on his yes
- [ ] Stamp the Ollama benchmark scores (qwen3.6:35b, ornith:9b, gemma4:12b, granite4.1:8b) into RECOMMENDED_REMOTE_MODELS.ollama with the suiteHash
