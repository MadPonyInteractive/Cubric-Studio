# MPI-1321 checklist

- [ ] Feed polls every 15 min (was 30)
- [ ] A post that arrives during the session (not at boot) emits `dev-updates:arrived`
- [ ] Shell toasts it with one button, View changes -> landing page + Dev updates panel
- [ ] The app-update check reruns on arrival so the panel's Update button is current
- [ ] Test covers boot fetch = no arrival, later new post = arrival
- [ ] lint + tests green; seen live in an isolated app
