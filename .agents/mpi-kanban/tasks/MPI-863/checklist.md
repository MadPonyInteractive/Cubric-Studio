# MPI-863 checklist

- [ ] `Storage.hasAutoStartComfy()` — distinguishes "never set" from an explicit `false`
- [ ] `_bootApp` seeds the pref from `/engine/version-check` the first time, after the boot gate has settled any install
- [ ] An explicit off (a real `false` in the store) never reseeds
- [ ] Remote auto-connect boots do not pay for the probe
- [ ] Test pins the tri-state + the seed rule
