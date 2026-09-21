# MPI-866 Checklist

- [x] A scheduled watcher that sees a red master with nobody pushing
- [x] It raises exactly once, and clears itself when master goes green
- [x] Detection logic proven against the real repo (7/7 cases, negative control bites)
- [ ] Fabio confirms the ntfy push the first time master actually goes red
