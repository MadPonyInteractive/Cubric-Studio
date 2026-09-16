/**
 * The server fork's ONE shutdown path (MPI-779).
 *
 * routes/shared.js used to register its own SIGINT/SIGTERM handlers at require time,
 * and they called process.exit(). server.js requires shared.js before registering its
 * own, so its handlers never ran: cancelAllDownloads() and the engine scratch cleanup
 * were dead on Ctrl+C (`npm run server`) and on SIGTERM (macOS/Linux quit).
 *
 * Each case runs in a child process, because the handler exits. The engine root is a
 * scratch dir: the owner branch really empties input/output.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { getComfyPath } = require('../routes/platformEngine');

const SHARED = path.join(__dirname, '..', 'routes', 'shared.js');

function runChild(body) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fork-shutdown-'));
    const staged = path.join(getComfyPath(root, 'input'), 'staged.png');
    fs.mkdirSync(path.dirname(staged), { recursive: true });
    fs.writeFileSync(staged, 'x');
    const env = { ...process.env, CUBRIC_ENGINE_ROOT: root, APP_USER_DATA: root, STAGED: staged, SHARED };
    delete env.CUBRIC_PORTABLE_ROOT;
    const r = spawnSync(process.execPath, ['-e', body], { env, encoding: 'utf8' });
    return { ...r, lines: r.stdout.split(/\r?\n/).filter((l) => l.startsWith('>')), staged };
}

for (const signal of ['SIGTERM', 'SIGINT']) {
    test(`${signal} stops server work, empties the owned engine's scratch, then kills the engine`, () => {
        const r = runChild(`
            const fs = require('fs');
            const shared = require(process.env.SHARED);
            shared.processState.activeComfyProcess = {
                kill: (sig) => console.log('>engine killed ' + sig + ', staged present: ' + fs.existsSync(process.env.STAGED)),
            };
            shared.installShutdown(() => console.log('>server work stopped'));
            process.emit('${signal}');
            console.log('>still running');
        `);
        assert.strictEqual(r.status, 0, r.stderr);
        assert.deepStrictEqual(r.lines, [
            '>server work stopped',
            '>engine killed SIGKILL, staged present: false',
        ]);
    });
}

test('requiring shared.js alone takes over no signal', () => {
    const r = runChild(`
        require(process.env.SHARED);
        console.log('>' + process.listenerCount('SIGTERM') + ' ' + process.listenerCount('SIGINT'));
    `);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.deepStrictEqual(r.lines, ['>0 0']);
});

test('a non-owner fork leaves the shared scratch alone on SIGTERM', () => {
    const r = runChild(`
        const shared = require(process.env.SHARED);
        shared.installShutdown(() => console.log('>server work stopped'));
        process.emit('SIGTERM');
    `);
    assert.strictEqual(r.status, 0, r.stderr);
    assert.deepStrictEqual(r.lines, ['>server work stopped']);
    assert.ok(fs.existsSync(r.staged), 'a non-owner deleted the staged input');
});
