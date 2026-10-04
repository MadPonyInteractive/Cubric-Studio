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

## Portal, 2026-10-04 (Fabio, guided)

| Check | Result |
|---|---|
| Portal Validate on `90af543` | 7 checks pass (fetched, 13 files 122.7 kB, plugin.json valid, 1 skill, 1 MCP server, directory lints, name + publisher). 0 Blocking. Warnings: `documentationUrl`, `supportUrl`, `privacyPolicyUrl` unrecognized by Claude Code (the directory reads them, "No action needed"); `icon` cross-tool ("No action needed"); note: `icon.png` passed without a code check |
| Listing details | Name, skill, files, `app_url` setting all right. "Listed on: Claude Code, Cowork, Claude apps (web, desktop, mobile)" is derived, not choosable. "1 server unregistered": unavoidable (a connector listing needs a public https server) |
| Chat surfaces | Per claude.com/docs/plugins/platform-support, chat IGNORES an MCP server whose url holds a `${user_config.*}` reference, so in chat the plugin is skill-only. Fixed in `0e119a4` (0.2.1): README says where it works; the skill answers "no cubric tools" per surface. `claude plugin validate --strict` passes plugin + marketplace |
| Portal Validate on `0e119a4` | re-validated, same 4 warnings, 0 Blocking, "No local code execution" |
| Submitted | 2026-10-04 ~22:13Z: v0.2.1 detected, status Scanning. Data handling No / No / Under 30 days / No; Scheduled check only; auto-publish off. Page: claude.ai/directory/manage/plugins/d4fe24cf-06b4-41cf-9882-ea2adacb8916 |

| Security scan | PASSED ~4 min after submit ("Scan passed, with directory policy warnings" = the 4 above). Status **In review**: "Version passed, ready to publish v0.2.1 0e119a4"; Fabio's Publish click is recorded as a request to the reviewer |

Closes the card: submitted, scan passed, not rejected. Outside this card: the reviewer's
decision (Anthropic emails Fabio's Gmail); a rejection lists Requested changes on the Review tab,
fix in the agents repo, bump `version`, then Resubmit for review. Cowork is untested: it loads the
server with the default address, and whether its session reaches the host's 127.0.0.1 is unknown.
