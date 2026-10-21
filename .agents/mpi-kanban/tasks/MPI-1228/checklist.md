# MPI-1228 checklist

- [x] Test: a model installed outside the agent (the list re-read says installed) gets no install card from install_model
- [x] Fix: install_model's model branch refuses ALREADY_INSTALLED off its own re-read, as the MCP twin and the Flow branch already do
- [x] npm run lint + npm test green
- [x] Committed by pathspec (the agentLoop.mjs hunk alone; peer MPI-1226 edits the same file)
