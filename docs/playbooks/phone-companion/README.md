# Phone companion — agent playbook (MPI-1300)

The desktop app serves a phone page; the user's phone opens it (over Tailscale, later) to chat
with Cosmo, browse the gallery, watch the queue and stop jobs. Brief, decisions and the approved
mockups: `.agents/mpi-kanban/tasks/MPI-1300/` (`brief.md`, `research/mockups/phone.html`).
**Built behind the dev gate across several releases; nothing reaches a user until every phase lands.**

## Where things live

| What | Where |
|---|---|
| The page | `phone.html` (repo root) — loads `styles/01_base.css` only, never `styles.css` (desktop shell partials) |
| Its entry | `js/phone/init.js` — NOT `js/init.js`. No desktop shell, router, hotkeys or engine gate |
| The frame | `js/components/Blocks/MpiPhoneShell/` — top bar, screen slot, Cosmo / Gallery / Queue tabs |
| The route | `routes/phone.js` — `GET /phone` (and `/phone.html`) |
| The dev gate | `routes/devMode.js` `devMode()` — same derivation as `APP_CONFIG.dev_mode` |

## Rules

1. **Dev-gated until the whole card ships.** `/phone` answers 404 unless `devMode()`. The route is
   registered BEFORE `express.static` in `server.js`; move it after and the static server hands out
   `phone.html` past the gate (`tests/phone-route.test.cjs` catches that).
2. **Everything the phone imports must load in a plain browser tab.** The desktop window has
   `nodeIntegration`, a phone does not. No module-level `window.require('electron')`; guarded calls
   (`typeof window.require === 'function'`) are fine. Never on the phone: `js/core/secretsClient.js`,
   `js/services/maskTempStore.js`, `js/shell/*`, `js/services/projectService.js` (fetch the route instead).
3. **Real components, not the mockup's CSS.** `ComponentFactory`, BEM, tokens, `MpiButton` for every
   tap target. A consumer stylesheet only sizes and places (`.claude/rules/components.md`).
4. **Thumb-sized targets:** 44px minimum. Safe areas via `env(safe-area-inset-*)`; height `100dvh`.
5. **The phone reads the desktop's state through routes**, never by importing desktop services.
   Phase 1 uses `GET /connector/current-project` (`{ ok, output: { name } }` or `NO_PROJECT`) and
   `GET /remote/mode` (`{ active, podId, … }`).

## Test it in your PC browser (DevTools device emulation)

1. Start your own instance, never `:3000`: `npm run app:isolated` with the Bash tool's
   `run_in_background`, own `CUBRIC_AGENT_PROFILE`. Wait for `READY http://127.0.0.1:<port>`.
2. Open `http://127.0.0.1:<port>/phone` in a browser. `routes/localOnly.js` lets a typed URL
   through (`Sec-Fetch-Site: none`); the page's own fetches are same-origin.
3. DevTools → device toolbar (Ctrl+Shift+M) → a phone preset (e.g. 390×844).
4. Agents: `playwright-cli -s=<name> open …`, `resize 390 844`, `screenshot`, `console` (expect 0
   errors). Run every `playwright-cli` call from the SAME working directory — the session lives in
   `./.playwright-cli/` and a call from elsewhere says the browser is not open. An edited module can
   come from cache: add `?v=<n>` to the page URL.
5. Close your browser session and stop the instance by its listener's PARENT (`scripts/launch-instance.mjs`).

## Phases

The plan is `.agents/mpi-kanban/tasks/MPI-1300/plan.md`. Each phase adds its own section here
(routes it exposes, how to test it). Phase 1 — the page on the PC browser — is everything above.
