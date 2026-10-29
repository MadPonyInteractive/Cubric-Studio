# MPI-1329 validation

- Live (2026-10-29): after a Video Edit install on a Pod, Cosmo said it would run the edit once
  the download finished, then sat idle. It ran at once when Fabio said it was installed.
  Nothing wakes the agent on a finished download; Fabio chose the wording fix over a wake.
- Change: `services/agentLoop.mjs` `DOWNLOAD_HANDBACK`, used by both the Flow and the model
  answer after Yes.
- `node --test tests/agent-loop.test.cjs`: 230 pass, 0 fail, 1 skipped. The two install
  assertions now require "let you know when it has finished".
- `npx eslint services/agentLoop.mjs tests/agent-loop.test.cjs`: clean.
