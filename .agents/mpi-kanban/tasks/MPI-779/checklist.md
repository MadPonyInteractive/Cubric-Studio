# MPI-779 checklist

- [x] Red: a node test proves server cleanup does not run on SIGTERM on HEAD
- [x] One shutdown path in routes/shared.js: server work, scratch clean (reads ownership while the handle is held), engine kill, exit
- [x] server.js installs it instead of registering its own dead SIGTERM/SIGINT handlers
- [x] Test green: both steps run on SIGTERM and SIGINT, in order; requiring shared.js alone installs no signal handler
- [x] npm test green
