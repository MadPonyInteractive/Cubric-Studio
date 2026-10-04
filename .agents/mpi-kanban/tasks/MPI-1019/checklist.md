# MPI-1019 Checklist

Repo: `C:\AI\Mpi\cubric-studio-agents` (PUBLIC), plugin folder `plugins/cubric-studio/`.

- [x] Prove how Codex reads the shared `.mcp.json` before changing it (scratch `CODEX_HOME`): literally
- [x] `.mcp.json` url passes the directory check (`${user_config.app_url}`) without breaking Codex (own `.codex-plugin/` + `.codex.mcp.json`)
- [x] `plugin.json`: `userConfig` app address (default `http://127.0.0.1:3000/mcp`), version 0.2.0, `displayName`, `icon`, directory listing fields
- [x] `plugins/cubric-studio/README.md`: 321 words, what the plugin runs/sends, a "Privacy Policy" section
- [x] `claude plugin validate --strict` passes on the plugin and the marketplace root
- [x] Claude Code connects through the setting to a live 2.0 app (3417); Codex resolves the literal address; Antigravity files untouched
- [x] Commit + push the agents repo (`90af543`); fresh GitHub installs give 0.2.0 in both clients
- [x] Portal answers drafted for Fabio: `submission.md`
- [x] Portal Validate clean (0 Blocking, 4 "no action" warnings)
- [x] 0.2.1 (`0e119a4`): README + skill say where it works (chat ignores a `${user_config}` MCP url); re-validated
- [x] Fabio submitted (2026-10-04, v0.2.1, scheduled check, auto-publish off)
- [x] Security scan passed; In review (reviewer outcome arrives by email, outside this card)

**Verify mode:** auto
