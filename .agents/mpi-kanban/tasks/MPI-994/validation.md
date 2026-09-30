# MPI-994 validation

## Root cause

`.mpi-agent-chat__entry--message` is a flex column with `align-items: flex-start`, so its
`.mpi-md` child is sized fit-content, floored at its MIN-content width. A `pre` block or a
long unbroken URL has a min-content as wide as its longest line (`overflow-wrap: break-word`
does not lower min-content), so one of them widened the whole reply past the transcript and
every paragraph wrapped at the wider width and scrolled sideways.

Separately, the shared `.mpi-md ol` indent (22px) is narrower than "1. " in JetBrains Mono at
15px, and the landing transcript has no left gutter, so its scroll box clipped the numbers.

## Fix

`MpiAgentChat.css`: `.mpi-agent-chat__entry--message > .mpi-md { max-width: 100% }` and
`.mpi-agent-chat__entry--message .mpi-md ol { padding-left: 4ch }`. Component-level, so the
landing chat and the side panel both get it.

## Evidence

Static repro page loading the real `01_base.css`, `markdown.css` and `MpiAgentChat.css`, a
378px standalone transcript holding a numbered list, a long URL and a long `curl` code block:

| | transcript clientWidth | scrollWidth | reply width | ol indent |
|---|---|---|---|---|
| before | 368 | 580 | 580 | 22px, numbers clipped |
| after (edited file, cache busted) | 378 | 378 | 374 | 36px, numbers whole |

After: the URL wraps (p scrollWidth = clientWidth = 374); only the code block scrolls, inside
itself (pre 372 visible / 578 content). `node --test tests/agent-ui-surfaces.test.cjs` 14/14.
