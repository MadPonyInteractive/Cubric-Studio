# MPI-1275 checklist

- [x] Find what stalls the 50-card batch queue on CI (passing runs ~1020 ms, failing 1697-1871 ms)
- [x] Fix the cause in the batch queue path (not the 1600 ms limit alone)
- [x] `node --test tests/agent-loop.test.cjs` green locally; `npm test` + `npm run lint` green
- [x] Push; CI green on master (run 40102049571)
- [x] Close MPI-1274 and this card
