# MPI-1229 checklist

- [x] `agent.list-models` names a cloud model's `provider`, so no gate has to guess "cloud" from 0 GB
- [x] Cosmo's install_model: a keyless cloud model answers NOTHING_TO_DOWNLOAD (add the key), no card
- [x] MCP install_model: decides cloud by `provider`, not by 0 GB (a local model missing only nodes is not "cloud")
- [x] App install route: a keyless cloud model answers NOTHING_TO_DOWNLOAD, not ALREADY_INSTALLED
- [x] Tests for Cosmo + MCP; npm run lint + npm test green; committed and pushed
