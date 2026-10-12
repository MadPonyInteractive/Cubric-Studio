# MPI-1115 checklist

- [x] Worker `C:/AI/Mpi/mpi-ci/cubric-updates/`: `GET /v1/posts`, `GET /v1/img/...`, logic tested (mpi-ci c7b4661)
- [x] App: dev updates service (fetch, unread, acknowledge, first-launch seed)
- [x] App: bell + badge in the landing nav
- [x] App: MpiDevUpdates slide-over (cards, acknowledge, mark all read, Join the Discord, empty state)
- [x] Tests green (3243 pass, 0 fail; Worker 7/7); clicks checked in an isolated instance on stub posts
- [x] Deployed 2026-10-12 at `updates.cubric.studio`; token set by Fabio; live: 18 real posts, images proxied (200 image/png)
- [x] Privacy page names the new call: Fabio signed off the wording 2026-10-12, Website dfd6754 ("Dev updates" section + the short-version list)
- [ ] Fabio's eye test on real posts in the real app
