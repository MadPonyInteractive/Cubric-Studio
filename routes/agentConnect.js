'use strict';

/**
 * routes/agentConnect.js — Settings > Connect an agent (MPI-947).
 *
 * One click connects the agent apps we know to this app's MCP server, each through its OWN
 * install channel, so the agent owns what it installed and the user can remove it the usual
 * way: Claude Code and Codex through their plugin CLIs, Claude Desktop through its own install
 * screen for the `.mcpb`, Antigravity by the plugin-folder copy its docs describe. Every file
 * comes from the public repo `cubric-studio-agents`, so nothing here drifts from what a user
 * installing by hand gets. Any other agent uses the plain URL the page shows.
 * Evidence for each path: `.agents/mpi-kanban/tasks/MPI-947/research/connect-paths.md`.
 *
 * Windows is proven on a real machine. The macOS and Linux branches come from each app's own
 * code and docs (Claude's `open-file` handler, Antigravity's `~/.gemini`), unrun on a real
 * machine: the macOS and Linux builds are blocked on the same missing hardware.
 */

const { exec, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const logger = require('./logger');
const { seenClients } = require('./mcp');

const router = express.Router();

const PLUGIN = 'cubric-studio@cubric-studio';
const MARKETPLACE = 'cubric-studio';
const REPO = 'MadPonyInteractive/cubric-studio-agents';
const MCPB_URL = `https://github.com/${REPO}/releases/latest/download/cubric-studio.mcpb`;
const RAW = `https://raw.githubusercontent.com/${REPO}/main/plugins/cubric-studio`;
const ANTIGRAVITY_FILES = ['plugin.json', 'mcp_config.json', 'skills/cubric-studio/SKILL.md'];

const isWin = () => process.platform === 'win32';
const isMac = () => process.platform === 'darwin';
const localAppData = () => process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const appData = () => process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');

// A Mac app started from the Dock gets launchd's bare PATH, without the folders npm, Homebrew
// and Claude's own installer put their CLIs in (`gitProvision.js` probes the same way).
// ponytail: a CLI installed through nvm/volta/asdf can still be missed; running each line
// through the user's login shell is the upgrade if that is reported.
const cliPath = () => [
    process.env.PATH, '/usr/local/bin', '/opt/homebrew/bin',
    path.join(os.homedir(), '.local', 'bin'), path.join(os.homedir(), '.npm-global', 'bin'),
].filter(Boolean).join(path.delimiter);

// lstat, not existsSync: the MSIX alias is a reparse point that stat refuses (EACCES), so
// existsSync says false for an installed Claude Desktop.
function exists(p) {
    try { fs.lstatSync(p); return true; } catch { return false; }
}

/**
 * Run an agent CLI. The npm installs are `.cmd` shims, which Node refuses to start without a
 * shell (EINVAL), so this goes through one. Every command line here is a fixed literal: never
 * put a user string in one.
 */
let run = (cmdline) => new Promise((resolve) => {
    const env = isWin() ? process.env : { ...process.env, PATH: cliPath() };
    exec(cmdline, { env, windowsHide: true, timeout: 180_000 }, (err, stdout, stderr) =>
        resolve({ ok: !err, stdout: String(stdout), stderr: String(stderr) }));
});

const onPath = async (bin) => (await run(`${isWin() ? 'where' : 'command -v'} ${bin}`)).ok;

/** Start a GUI app and settle once it started, or reject when it could not. A test seam like `run`. */
let launch = (claudeDesktopExe, args) => new Promise((resolve, reject) => {
    const child = spawn(claudeDesktopExe, args, { detached: true, stdio: 'ignore' });
    child.once('spawn', () => { child.unref(); resolve(); }).once('error', reject);
});

const parseJson = (text) => { try { return JSON.parse(text); } catch { return null; } };

/** Run CLI steps in order. A connect stops at the first failure; a disconnect runs them all. */
async function steps(lines, { all = false } = {}) {
    for (const line of lines) {
        const r = await run(line);
        if (!r.ok && !all) {
            const why = (r.stderr || r.stdout).trim().split('\n').slice(-3).join(' ');
            throw new Error(`\`${line}\` failed: ${why}`);
        }
    }
}

async function download(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
}

// Linux has no Claude Desktop, so it is never found there.
const findClaudeDesktop = () => (isWin() ? [
    path.join(localAppData(), 'Microsoft', 'WindowsApps', 'claude-desktop.exe'), // MSIX alias
    path.join(localAppData(), 'AnthropicClaude', 'claude.exe'), // older installer
] : isMac() ? [
    '/Applications/Claude.app',
    path.join(os.homedir(), 'Applications', 'Claude.app'),
] : []).find(exists);

/**
 * Where Claude Desktop keeps installed extensions. The MSIX build's AppData lives in its
 * package's private LocalCache: from outside the package `%APPDATA%\Claude` does not exist.
 * A process started FROM Claude (a Claude Code session in the desktop app) sees the redirected
 * view instead, which is how testing from one read the wrong folder as right.
 */
function claudeExtensionDirs() {
    if (!isWin()) {
        return [path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'Claude Extensions')].filter(exists);
    }
    const pkgs = path.join(localAppData(), 'Packages');
    const msix = exists(pkgs) ? fs.readdirSync(pkgs).filter((d) => d.startsWith('Claude_')) : [];
    return [
        ...msix.map((d) => path.join(pkgs, d, 'LocalCache', 'Roaming', 'Claude', 'Claude Extensions')),
        path.join(appData(), 'Claude', 'Claude Extensions'), // older installer
    ].filter(exists);
}

const antigravityDir = () => path.join(os.homedir(), '.gemini', 'config', 'plugins', 'cubric-studio');

const CLIENTS = {
    'claude-desktop': {
        name: 'Claude Desktop',
        seenAs: /^claude-ai/i,
        detect: async () => Boolean(findClaudeDesktop()),
        status: async () => {
            for (const dir of claudeExtensionDirs()) {
                const ext = fs.readdirSync(dir).find((d) => /cubric-studio$/.test(d));
                if (!ext) continue;
                const manifest = parseJson(fs.readFileSync(path.join(dir, ext, 'manifest.json'), 'utf8'));
                return { connected: true, version: manifest?.version };
            }
            return { connected: false };
        },
        // On Windows Claude registers no `.mcpb` file type, so opening the file would not reach
        // it; it reads the path from its command line and shows its own install screen. On
        // macOS `open -a` delivers the file to its `open-file` handler, the same screen.
        connect: async () => {
            const file = path.join(os.tmpdir(), 'cubric-studio.mcpb');
            fs.writeFileSync(file, await download(MCPB_URL));
            await (isMac() ? launch('open', ['-a', findClaudeDesktop(), file]) : launch(findClaudeDesktop(), [file]));
        },
        waitsForUser: 'Claude Desktop is showing its install screen: click Install there.',
        disconnectHint: "open Claude Desktop's Settings > Extensions and remove Cubric Studio.",
    },
    'claude-code': {
        name: 'Claude Code',
        seenAs: /^claude-code/i,
        detect: () => onPath('claude'),
        status: async () => {
            const p = parseJson((await run('claude plugin list --json')).stdout)?.find?.((x) => x.id === PLUGIN);
            return p ? { connected: p.enabled !== false, version: p.version } : { connected: false };
        },
        // https, never owner/repo: Claude Code clones that over SSH and fails without a key.
        connect: () => steps([`claude plugin marketplace add https://github.com/${REPO}.git`, `claude plugin install ${PLUGIN}`]),
        disconnect: () => steps([`claude plugin uninstall ${PLUGIN}`, `claude plugin marketplace remove ${MARKETPLACE}`], { all: true }),
        restart: 'Restart Claude Code to load it.',
    },
    codex: {
        name: 'Codex',
        seenAs: /codex/i,
        detect: () => onPath('codex'),
        status: async () => {
            const list = parseJson((await run('codex plugin list --json')).stdout)?.installed;
            const p = list?.find?.((x) => x.pluginId === PLUGIN && x.installed);
            return p ? { connected: p.enabled !== false, version: p.version } : { connected: false };
        },
        getIt: 'Codex comes with ChatGPT plans: use it if you use ChatGPT.',
        connect: () => steps([`codex plugin marketplace add ${REPO}`, `codex plugin add ${PLUGIN}`]),
        disconnect: () => steps([`codex plugin remove ${PLUGIN}`, `codex plugin marketplace remove ${MARKETPLACE}`], { all: true }),
        restart: 'Restart Codex to load it.',
    },
    antigravity: {
        name: 'Antigravity',
        seenAs: /antigravity|jetski|gemini/i,
        // `~/.gemini/antigravity` is its own data folder on every OS, so it finds Linux too,
        // where the install location varies by package.
        detect: async () => [
            path.join(os.homedir(), '.gemini', 'antigravity'),
            path.join(localAppData(), 'Programs', 'antigravity', 'Antigravity.exe'),
            '/Applications/Antigravity.app',
        ].some(exists),
        getIt: "Antigravity is Google's agent app, free with a Google account: use it if you use Gemini.",
        status: async () => ({ connected: exists(path.join(antigravityDir(), 'plugin.json')) }),
        // Antigravity has no CLI and no install link: a plugin is a folder it reads at start.
        connect: async () => {
            const files = await Promise.all(ANTIGRAVITY_FILES.map((f) => download(`${RAW}/${f}`)));
            ANTIGRAVITY_FILES.forEach((f, i) => {
                const to = path.join(antigravityDir(), f);
                fs.mkdirSync(path.dirname(to), { recursive: true });
                fs.writeFileSync(to, files[i]);
            });
        },
        disconnect: async () => fs.rmSync(antigravityDir(), { recursive: true, force: true }),
        restart: 'Restart Antigravity to load it.',
    },
};

const lastSeen = (client, seen) => Math.max(0, ...seen.filter((s) => client.seenAs.test(s.name)).map((s) => s.at)) || null;

async function describe(id) {
    const c = CLIENTS[id];
    const detected = await c.detect();
    const state = detected ? await c.status().catch(() => ({ connected: false })) : { connected: false };
    return {
        id, name: c.name, detected, ...state,
        lastSeen: lastSeen(c, seenClients()),
        canDisconnect: Boolean(c.disconnect),
        disconnectHint: c.disconnectHint, restart: c.restart, getIt: c.getIt,
    };
}

router.get('/agent-connect/status', async (req, res) => {
    const seen = seenClients();
    const clients = await Promise.all(Object.keys(CLIENTS).map(describe));
    const others = seen.filter((s) => !Object.values(CLIENTS).some((c) => c.seenAs.test(s.name)));
    res.json({ ok: true, url: `http://127.0.0.1:${req.socket.localPort}/mcp`, clients, others });
});

router.post('/agent-connect/:id/:action', async (req, res) => {
    const { id, action } = req.params;
    const c = Object.hasOwn(CLIENTS, id) ? CLIENTS[id] : null;
    if (!c || !['connect', 'disconnect'].includes(action) || !c[action]) {
        return res.status(404).json({ ok: false, error: { message: 'Unknown agent or action.' } });
    }
    logger.info('agent-connect', `${action} ${id}`);
    try {
        await c[action]();
        const client = await describe(id);
        const ok = action === 'connect' ? client.connected || Boolean(c.waitsForUser) : !client.connected;
        // Claude Desktop's install screen always waits for the user, connected already or not.
        const note = action === 'connect' ? (c.waitsForUser || c.restart) : undefined;
        if (!ok) logger.warn('agent-connect', `${action} ${id} ran but status says connected=${client.connected}`);
        res.json({ ok, client, note, error: ok ? undefined : { message: `${c.name} still reads as ${client.connected ? 'connected' : 'not connected'}.` } });
    } catch (err) {
        logger.warn('agent-connect', `${action} ${id} failed: ${err.message}`);
        res.json({ ok: false, error: { message: err.message } });
    }
});

module.exports = router;
// Test seams: the suite swaps the CLI runner and the app launcher, so no test reaches a real
// agent install or starts a real app (a runner can have an `open` of its own on PATH).
module.exports._setRun = (fn) => { run = fn; };
module.exports._setLaunch = (fn) => { launch = fn; };
