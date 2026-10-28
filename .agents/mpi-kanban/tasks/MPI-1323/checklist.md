# MPI-1323 checklist

- [x] Server broadcasts `projects:changed` on /events/stream after /create-project and /project-groups
- [x] Landing reloads its list (no spinner flash) on that event, only while it is showing
- [x] Unit test for the broadcast
- [x] Live check in an isolated app: create a project over the connector while on the landing
