# MPI-1130 validation

- Key-safety claims checked against code: main/secretsStore.js (safeStorage, AES-256-GCM fallback, no renderer get channel, keys only via fork bridge), routes/secretRedaction.js used by routes/logger.js and routes/system.js. No HTTP route returns a key (grep of res.json in routes/).
- Dropped a claim: the weak-encryption warning shows only in RunPod settings (MpiRunpodSettings.js), not for DeepInfra/LLM keys, so the copy no longer says the user is told.
- Private vulnerability reporting: gh api .../private-vulnerability-reporting returned {"enabled":true} after the PUT.
- Checksums: no CI change needed. gh api releases/latest shows a sha256 digest on all six v2.0.1 assets; GitHub shows them on the release page. Documented in SECURITY.md and llms.txt.
- Website (Cubric Studio (Website), branch guides-mpi-1124, commit c09525f, NOT pushed): llms.txt Security section + commercial-reuse line; home FAQ entry + JSON-LD (parsed OK). Goes live with the 2.1 guides publish (MPI-1044).
- SECURITY.md committed in Vision.
