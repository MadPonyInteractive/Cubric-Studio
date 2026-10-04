# MPI-1019 Validation

2026-10-04, agents repo `90af543` (pushed), plugin 0.2.0.

| Check | Result |
|---|---|
| Codex reads `.mcp.json` literally | PROVEN (scratch `CODEX_HOME`): `url: ${user_config.app_url}`, so Codex gets its own manifest |
| Codex with `.codex-plugin/plugin.json` -> `.codex.mcp.json` | wins over `.claude-plugin/`; `url: http://127.0.0.1:3000/mcp`; skill installed |
| `claude plugin validate --strict` (Claude Code 2.1.284) | plugin + marketplace root both pass |
| Claude Code default address | `claude mcp list` resolves `http://127.0.0.1:3000/mcp` (nothing listening on 3000, refused as expected) |
| Claude Code override | `--config app_url=http://127.0.0.1:3417/mcp` against a live 2.0 instance: `✔ Connected` |
| Install with no option (the app's Connect button) | exit 0, prints "1 userConfig option not yet set" |
| Fresh install from GitHub | Claude Code 0.2.0; Codex 0.2.0 with the literal address |
| Antigravity | `plugin.json` + `mcp_config.json` unchanged |
| Directory checklist self-audit | README 321 words in the plugin folder with a Privacy Policy section; license in plugin.json; 9 files, text + one 118 KB PNG; no `.gitattributes`; no launcher, no `bin/` |

Left: Fabio submits (portal answers in `submission.md`); the portal's own Validate is the
authoritative check, and a reviewer may hold the first version.
