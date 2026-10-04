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
- [ ] Fabio submits at claude.ai/directory/manage (Plugin bundle); portal Validate clean; review outcome

**Verify mode:** auto
