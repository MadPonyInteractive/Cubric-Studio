# MPI-866 Validation

Fabio picked option 1 from the brief, the scheduled watcher, 2026-09-21.

## What shipped

`.github/workflows/red-master-watch.yml`. A cron every 30 minutes reads master's last
**completed** `tests.yml` run and either raises or clears:

- **failure, nothing open** → create the `red-master` issue, then push to ntfy.
- **failure, already open** → do nothing at all. The open issue IS the dedupe state.
- **success, an issue open** → close it with the green commit and run URL.
- **success, nothing open** → do nothing.
- **anything else** (cancelled, timed_out, no completed run) → leave state alone. A
  cancelled run is not a verdict, so it must neither raise an alarm nor clear one.

Two decisions worth keeping:

1. **It queries exactly what `.husky/pre-push` gates on** — last *completed* `tests.yml` run
   on master. If the two queries ever diverge, the watcher says one thing while the hook does
   another, which is worse than no watcher.
2. **It pushes to ntfy itself instead of relying on `notify-new-issue.yml`.** GitHub does not
   fire workflow events for objects created with `GITHUB_TOKEN` (anti-recursion), so an issue
   opened by this workflow would never have triggered that one and the phone would never have
   rung. Found by reading `notify-new-issue.yml` rather than by shipping it and waiting.

## What ran, 2026-09-21

```
python -c "yaml.safe_load(...)"              -> parses; jobs/permissions/triggers correct
gh run list --status completed --limit 1     -> returns sha/conclusion/url, tab-split cleanly
gh issue list --label red-master             -> exit 0, empty, WITH THE LABEL ABSENT
```

That last one is the first-tick case and the one most likely to have blown up under
`set -euo pipefail`. It does not.

**Branch logic: 7 of 7 cases pass.** The shipped `run:` block is extracted from the YAML (not
retyped, so it cannot drift) and executed against stubbed `gh`/`curl`. Each case asserts what
must appear AND what must not:

| case | asserts |
|---|---|
| red, nothing raised | creates label + issue, pushes ntfy |
| **red, already raised** | **silent: no issue, no ntfy, no label** |
| red, no NTFY_TOPIC | issue still opened, no ntfy, job still green |
| green, alarm open | closes it, creates nothing |
| green, nothing open | does nothing |
| cancelled | neither raises nor clears |
| no completed run | neither raises nor clears |

**Negative control, and it bites.** Deleting the `exit 0` from the already-raised branch on a
copy makes that case fail with `leaked=['gh issue create', 'curl -> ntfy']` — which is
precisely the regression that would buzz the phone every 30 minutes while somebody fixes
master. 6/7 on the broken build, 7/7 on the real one.

Harness: `<scratchpad>/watchtest.py` (+ `negctl.py`). Re-run with
`python <scratchpad>/watchtest.py`. It needs `pyyaml` and hardcodes Git Bash at
`C:/Program Files/Git/bin/bash.exe`, because plain `bash` on this box resolves to WSL's and
cannot see `/bin/bash`.

## Deliberately not done

**No CI-level regression guard.** The harness is Windows-and-python specific and the repo's
suite is `.cjs`, so shipping it under `tests/` would mean a rewrite for a 100-line ops
workflow. The real end-to-end check is `workflow_dispatch`, which is on the workflow for
exactly that reason. If this file rots, it rots quietly — accepted, and recorded here rather
than pretended away.

## For Fabio

1. The watcher is live on the schedule. Nothing to do while master is green.
2. **Confirm the phone push works** the first time master actually goes red, or force it with
   a `workflow_dispatch` run while red. `NTFY_TOPIC` is the same secret
   `notify-new-issue.yml` already uses, so no new secret was added.
3. The issue it opens is labelled `red-master` and closes itself on green.
