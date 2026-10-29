# MPI-1333 validation

Added the pause rule to the Speech bullet of docs/agent/models/minimax-h3.md (Adapting what the user asked for).

Evidence, Fabio listening, 2026-10-29, project "Video edit showcase", low tier, turbo, 9:16:
- Works: silence as its own beat between two short quoted sentences, with a length and a face action ("Pause test - get it now", H3 Reference, 6 s).
- Fails: pause described up front inside one sentence ("Pause test A - pause described", H3 Reference, seed 3017395590): gibberish apart from "Cubric Studio".
- Fails: one sentence split around the pause ("Pause test B - split lines", same seed): an invented word filled the gap.
- One take per wording, so the rule is a strong lead, not a proven law.

The guide stays at 200 lines (tests/agent-corpus.test.cjs caps agent docs at 200): three short tail lines were joined to make room, no content removed. node --test tests/agent-corpus.test.cjs: pass.
