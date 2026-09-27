'use strict';

/**
 * MPI-947 — routes/agentConnect.js connects each known agent through that agent's own install
 * channel. The CLI runner and fetch are fakes and every agent path points into a temp home, so
 * nothing here reaches a real Claude, Codex or Antigravity install.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-connect-'));
process.env.USERPROFILE = home;
process.env.LOCALAPPDATA = path.join(home, 'Local');
process.env.APPDATA = path.join(home, 'Roaming');

const route = require('../routes/agentConnect');
const mcp = require('../routes/mcp');

const REPO = 'MadPonyInteractive/cubric-studio-agents';
const put = (file, text = '') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };

// The fake CLIs: every command line run, and a tiny model of what is installed.
const ran = [];
const installed = { claude: true, codex: false };
const onPath = { claude: true, codex: false };
let failOn = null;
route._setRun(async (line) => {
    ran.push(line);
    const ok = (stdout = '') => ({ ok: true, stdout, stderr: '' });
    if (line === failOn) return { ok: false, stdout: '', stderr: 'Cloning...\nfatal: unable to access github.com' };
    const [cli, , verb] = line.split(' ');
    const probe = line.match(/^(?:where|command -v) (\w+)$/);
    if (probe) return onPath[probe[1]] ? ok(`C:\\npm\\${probe[1]}.cmd`) : { ok: false, stdout: '', stderr: 'not found' };
    if (line === 'claude plugin list --json') return ok(JSON.stringify(installed.claude ? [{ id: 'cubric-studio@cubric-studio', version: '0.1.0', enabled: true }] : []));
    if (line === 'codex plugin list --json') return ok(JSON.stringify({ installed: installed.codex ? [{ pluginId: 'cubric-studio@cubric-studio', version: '0.1.0', installed: true, enabled: true }] : [], available: [] }));
    if (['install', 'add'].includes(verb)) installed[cli] = true;
    if (['uninstall', 'remove'].includes(verb)) installed[cli] = false;
    return ok();
});

// The app launcher: records what would start. Never a real spawn: a CI runner has an `open` of
// its own on PATH, so a test leaning on the launch FAILING passed here and went red there.
const launched = [];
let launchFails = false;
route._setLaunch(async (exe, args) => {
    launched.push([exe, ...args]);
    if (launchFails) throw new Error(`spawn ${exe} ENOENT`);
});

// fetch: the test's own server is real, GitHub is a fake that answers with the URL it was asked.
const realFetch = global.fetch;
const fetched = [];
global.fetch = async (url, opts) => {
    if (String(url).startsWith('http://127.0.0.1')) return realFetch(url, opts);
    fetched.push(String(url));
    return new Response(`from ${url}`);
};

let base;
let server;
test.before(async () => {
    const app = express();
    app.use(bodyParser.json());
    app.use(mcp);
    app.use(route);
    await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => {
    server.close();
    global.fetch = realFetch;
    fs.rmSync(home, { recursive: true, force: true });
});

const get = (p) => realFetch(base + p).then((r) => r.json());
const post = (p, body = {}) => realFetch(base + p, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}).then((r) => r.json());
const client = (status, id) => status.clients.find((c) => c.id === id);

test('status finds each agent where it installs, and never runs a CLI that is not there', async () => {
    put(path.join(home, 'Local', 'Microsoft', 'WindowsApps', 'claude-desktop.exe'));
    // The MSIX build keeps it in the package's LocalCache; %APPDATA%\Claude does not exist.
    put(path.join(home, 'Local', 'Packages', 'Claude_pzs8sxrjxfjjc', 'LocalCache', 'Roaming', 'Claude', 'Claude Extensions',
        'local.mcpb.mad-pony-interactive.cubric-studio', 'manifest.json'), '{"version":"0.2.0"}');
    ran.length = 0;

    const s = await get('/agent-connect/status');

    assert.match(s.url, /^http:\/\/127\.0\.0\.1:\d+\/mcp$/);
    assert.deepEqual(
        s.clients.map(({ id, detected, connected, version }) => ({ id, detected, connected, version })),
        [
            { id: 'claude-desktop', detected: true, connected: true, version: '0.2.0' },
            { id: 'claude-code', detected: true, connected: true, version: '0.1.0' },
            { id: 'codex', detected: false, connected: false, version: undefined },
            { id: 'antigravity', detected: false, connected: false, version: undefined },
        ],
    );
    assert.equal(client(s, 'claude-desktop').canDisconnect, false, 'Claude Desktop removes its own extensions');
    assert.match(client(s, 'codex').getIt, /ChatGPT/, 'a ChatGPT user learns Codex is theirs');
    assert.match(client(s, 'antigravity').getIt, /Gemini/, 'a Gemini user learns Antigravity is theirs');
    assert.ok(!ran.includes('codex plugin list --json'), 'no Codex on PATH, so no Codex command');
    assert.ok(!ran.some((l) => l.includes('mcp list')), '`claude mcp list` health-checks the live app');
});

test('Claude Code connects through its own CLI over https, and a failed step stops the rest', async () => {
    installed.claude = false;
    ran.length = 0;
    const r = await post('/agent-connect/claude-code/connect');
    assert.equal(r.ok, true);
    assert.equal(r.note, 'Restart Claude Code to load it.');
    assert.deepEqual(ran.filter((l) => !l.startsWith('where') && !l.includes('list')), [
        `claude plugin marketplace add https://github.com/${REPO}.git`,
        'claude plugin install cubric-studio@cubric-studio',
    ]);

    installed.claude = false;
    failOn = `claude plugin marketplace add https://github.com/${REPO}.git`;
    ran.length = 0;
    const bad = await post('/agent-connect/claude-code/connect');
    failOn = null;
    assert.equal(bad.ok, false);
    assert.match(bad.error.message, /unable to access github\.com/);
    assert.ok(!ran.includes('claude plugin install cubric-studio@cubric-studio'), 'no install after a failed marketplace add');
});

test('a disconnect runs every step even when one fails, and is judged by the status after', async () => {
    onPath.codex = true;
    installed.codex = true;
    failOn = 'codex plugin marketplace remove cubric-studio';
    ran.length = 0;
    const r = await post('/agent-connect/codex/disconnect');
    failOn = null;
    assert.equal(r.ok, true);
    assert.equal(r.client.connected, false);
    assert.ok(ran.includes('codex plugin remove cubric-studio@cubric-studio'));
    assert.ok(ran.includes('codex plugin marketplace remove cubric-studio'));

    ran.length = 0;
    assert.equal((await post('/agent-connect/codex/connect')).ok, true);
    assert.deepEqual(ran.filter((l) => l.includes('add')), [
        `codex plugin marketplace add ${REPO}`,
        'codex plugin add cubric-studio@cubric-studio',
    ]);
});

test('Antigravity gets the plugin folder from the public repo, and loses only that folder', async () => {
    put(path.join(home, 'Local', 'Programs', 'antigravity', 'Antigravity.exe'));
    const plugins = path.join(home, '.gemini', 'config', 'plugins');
    put(path.join(plugins, 'someone-else', 'plugin.json'), '{}');
    fetched.length = 0;

    const r = await post('/agent-connect/antigravity/connect');
    assert.equal(r.ok, true);
    assert.equal(r.note, 'Restart Antigravity to load it.');
    const skill = `https://raw.githubusercontent.com/${REPO}/main/plugins/cubric-studio/skills/cubric-studio/SKILL.md`;
    assert.equal(fs.readFileSync(path.join(plugins, 'cubric-studio', 'skills', 'cubric-studio', 'SKILL.md'), 'utf8'), `from ${skill}`);
    assert.equal(fetched.length, 3);

    assert.equal((await post('/agent-connect/antigravity/disconnect')).ok, true);
    assert.ok(!fs.existsSync(path.join(plugins, 'cubric-studio')));
    assert.ok(fs.existsSync(path.join(plugins, 'someone-else', 'plugin.json')), 'another plugin is untouched');
});

test('Claude Desktop is handed the latest release .mcpb, and a launch that fails says so', async () => {
    fetched.length = 0;
    launched.length = 0;
    const mcpb = path.join(os.tmpdir(), 'cubric-studio.mcpb');
    const r = await post('/agent-connect/claude-desktop/connect');
    assert.deepEqual(fetched, [`https://github.com/${REPO}/releases/latest/download/cubric-studio.mcpb`]);
    assert.equal(fs.readFileSync(mcpb, 'utf8'), `from ${fetched[0]}`);
    assert.deepEqual(launched, [[path.join(home, 'Local', 'Microsoft', 'WindowsApps', 'claude-desktop.exe'), mcpb]]);
    assert.equal(r.ok, true, 'installed only once the user clicks Install, so a started launch is ok');
    assert.match(r.note, /click Install/);

    launchFails = true;
    const bad = await post('/agent-connect/claude-desktop/connect');
    launchFails = false;
    assert.equal(bad.ok, false);
    assert.match(bad.error.message, /spawn/);

    assert.equal((await post('/agent-connect/claude-desktop/disconnect')).ok, false, 'no uninstall for Claude Desktop');
    assert.equal((await post('/agent-connect/__proto__/connect')).ok, false);
});

test('on macOS: `command -v`, Claude.app, its Application Support extensions, and `open -a` for the .mcpb', async () => {
    const real = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    try {
        const app = path.join(home, 'Applications', 'Claude.app');
        put(path.join(app, 'Contents', 'Info.plist'));
        put(path.join(home, 'Library', 'Application Support', 'Claude', 'Claude Extensions',
            'local.mcpb.mad-pony-interactive.cubric-studio', 'manifest.json'), '{"version":"0.3.0"}');
        fs.rmSync(path.join(home, 'Local', 'Programs', 'antigravity'), { recursive: true, force: true });
        put(path.join(home, '.gemini', 'antigravity', 'installation_id'));
        ran.length = 0;

        const s = await get('/agent-connect/status');
        assert.deepEqual([client(s, 'claude-desktop').connected, client(s, 'claude-desktop').version], [true, '0.3.0']);
        assert.ok(ran.includes('command -v claude') && !ran.some((l) => l.startsWith('where')));
        assert.equal(client(s, 'antigravity').detected, true, 'found by ~/.gemini/antigravity, not an install path');

        launched.length = 0;
        await post('/agent-connect/claude-desktop/connect');
        assert.deepEqual(launched, [['open', '-a', app, path.join(os.tmpdir(), 'cubric-studio.mcpb')]]);
    } finally {
        Object.defineProperty(process, 'platform', real);
    }
});

test('the clientInfo an agent sends on initialize shows as last seen; an unknown agent under its own name', async () => {
    const init = (name) => post('/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', clientInfo: { name, version: '9.9' } } });
    await init('claude-code');
    await init('zed');

    const s = await get('/agent-connect/status');
    assert.equal(typeof client(s, 'claude-code').lastSeen, 'number');
    assert.equal(client(s, 'claude-desktop').lastSeen, null);
    assert.deepEqual(s.others.map(({ name, version }) => ({ name, version })), [{ name: 'zed', version: '9.9' }]);
});
