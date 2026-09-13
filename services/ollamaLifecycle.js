/**
 * services/ollamaLifecycle.js — starting Ollama, installing it, and downloading
 * models into it (MPI-728 phase 3).
 *
 * PORTED FROM Cubric Prompt `src/main/ollama.ts` (its MPI-8 ladder plus the MPI-17
 * model-folder fix), with three deliberate changes:
 *
 * 1. **On Windows the thing started is `ollama app.exe`, not `ollama serve`.**
 *    `ollama.exe` is a console program, and a DETACHED console child of this
 *    console-less server gets a terminal window that stays open for the whole life
 *    of the server: Windows ignores CREATE_NO_WINDOW under DETACHED_PROCESS, which is
 *    what `tests/windows-hide-spawn.test.cjs` exists to stop. The app is a GUI
 *    program, it is what Ollama's own installer starts at login (no arguments), and
 *    it hands its server the model folder the user picked, which fixes MPI-17 at the
 *    source. Measured 2026-09-13, Ollama 0.32.14: server up in 4-9s, all 9 models
 *    from a custom `H:\OllamaModels` listed, zero visible windows with and without
 *    `windowsHide`, and the app outlives the process that spawned it.
 * 2. **Nothing runs at boot.** Prompt started Ollama eagerly because it was that
 *    app's only local engine. Here ComfyUI is the default and Ollama is opted into,
 *    so this runs when the user picks Ollama or enhances on it.
 * 3. **No consent dialog and no remembered "no".** Prompt asked unprompted at boot,
 *    so it had to remember a refusal. Here an install or a download only ever starts
 *    from the user's own click in Remote -> Language Models, and that click is the
 *    consent (Fabio, 2026-09-13). Nothing asks unprompted, so nothing is remembered.
 *
 * NEVER STOPPED ON QUIT, and there is deliberately no teardown: Ollama is the user's
 * own service, it may have been running before us, and something else may be mid-run
 * on it.
 *
 * NEVER `OLLAMA_MODELS` AS A PERSISTENT VARIABLE: it would shadow whatever the user
 * later picks in the Ollama app and go stale. The one place it is set is the env of a
 * bare `ollama serve` child, read from the app's own `server.log` (MPI-17).
 */

'use strict';

// Destructured on purpose: the windows-hide scanner skips `obj.spawn(` call sites,
// so a namespaced call here would never be checked.
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../routes/logger');

/** Measured 4-9s for the app to bring its server up; a cold disk gets headroom. */
const HEALTH_TIMEOUT_MS = 30_000;
const POLL_MS = 500;
/** The `OLLAMA_MODELS:` marker sits near the head of `server.log`. */
const LOG_HEAD_BYTES = 8192;

let _enginesPromise = null;
function engines() {
    if (!_enginesPromise) _enginesPromise = import('./llmEngines.mjs');
    return _enginesPromise;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The Ollama desktop app, where its installer and winget both put it. Windows only. */
function ollamaAppPath() {
    return process.platform === 'win32'
        ? path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama app.exe')
        : null;
}

/**
 * The model folder a bare `ollama serve` must be told about, parsed from the app's
 * `server.log`. The app keeps the setting in its own `db.sqlite` and writes the
 * resolved path into every server it starts, Go-quoted with doubled backslashes:
 * `OLLAMA_MODELS:H:\\OllamaModels`. The last entry wins; `undefined` when none.
 */
function parseOllamaModelsDir(text) {
    const matches = String(text || '').match(/OLLAMA_MODELS:([^ \n\r]+)/g);
    if (!matches || !matches.length) return undefined;
    return matches[matches.length - 1].slice('OLLAMA_MODELS:'.length).replace(/\\\\/g, '\\');
}

function readOllamaModelsDir() {
    try {
        const fd = fs.openSync(path.join(process.env.LOCALAPPDATA || '', 'Ollama', 'server.log'), 'r');
        try {
            const buf = Buffer.alloc(LOG_HEAD_BYTES);
            return parseOllamaModelsDir(buf.toString('utf8', 0, fs.readSync(fd, buf, 0, LOG_HEAD_BYTES, 0)));
        } finally {
            fs.closeSync(fd);
        }
    } catch {
        return undefined;
    }
}

/** Launch Ollama's server. The returned child reports ENOENT when Ollama is not installed. */
function spawnServer() {
    const ollamaAppExe = ollamaAppPath();
    if (ollamaAppExe && fs.existsSync(ollamaAppExe)) {
        // A GUI binary never gets a console, so no `windowsHide`; `detached` is what
        // lets it outlive this app.
        return spawn(ollamaAppExe, [], { detached: true, stdio: 'ignore' });
    }
    const modelsDir = process.platform === 'win32' ? readOllamaModelsDir() : undefined;
    // ponytail: on Windows WITHOUT the app (a CLI-only install) the server is not
    // detached, because a detached console child shows a terminal for its whole life,
    // so it may stop when Cubric does. Elsewhere it is detached and lives on. macOS's
    // Ollama.app keeps its own model folder the way the Windows app does and a bare
    // `serve` will not see it (MPI-17's open question): launch the app there too if
    // that turns up in the field.
    return spawn('ollama', ['serve'], {
        detached: process.platform !== 'win32',
        stdio: 'ignore',
        windowsHide: true,
        ...(modelsDir && { env: { ...process.env, OLLAMA_MODELS: modelsDir } }),
    });
}

async function startIfStopped() {
    const { OllamaEngine } = await engines();
    const engine = new OllamaEngine();
    if (await engine.isRunning()) return 'running';

    let spawnErr = null;
    const child = spawnServer();
    child.once('error', (e) => { spawnErr = e; });
    child.unref();

    const deadline = Date.now() + HEALTH_TIMEOUT_MS;
    do {
        if (await engine.isRunning()) return 'started';
        if (spawnErr) {
            if (spawnErr.code === 'ENOENT') return 'missing';
            logger.error('system', `ollama launch failed: ${spawnErr.message}`);
            return 'failed';
        }
        await sleep(POLL_MS);
    } while (Date.now() < deadline);
    logger.error('system', `ollama launched but did not answer within ${HEALTH_TIMEOUT_MS}ms`);
    return 'failed';
}

let _starting = null;

/**
 * Make Ollama's server answer, starting it when it is installed and stopped.
 *   'running'  it already answered, and is used as-is whoever started it
 *   'started'  it was stopped, and answered once launched
 *   'missing'  not installed: the spawn's ENOENT IS the signal, no PATH or registry probing
 *   'failed'   it did not answer in time
 * Concurrent callers (the settings row and an enhance) share one attempt, so the app
 * is never launched twice.
 */
function ensureOllama() {
    if (!_starting) _starting = startIfStopped().finally(() => { _starting = null; });
    return _starting;
}

let _install = null;

/** The install in flight or last finished, `{ status: 'installing'|'failed'|'done', error? }`, or null. */
function installState() {
    return _install;
}

/**
 * Install Ollama silently through winget, then start it. Returns at once, because it
 * runs for minutes and reports through `installState()`. Windows only: false
 * elsewhere, and the settings row opens ollama.com/download instead.
 *
 * ponytail: winget or the download page. If winget turns out to be missing on real
 * machines (LTSC, some managed installs), the upgrade is fetching OllamaSetup.exe
 * and running it `/SP- /VERYSILENT /NORESTART` (Cubric Prompt's MPI-2 plan).
 */
function installOllama() {
    if (process.platform !== 'win32') return false;
    if (_install && _install.status === 'installing') return true;
    _install = { status: 'installing' };
    execFile('winget', [
        'install', '-e', '--id', 'Ollama.Ollama', '--silent',
        '--accept-source-agreements', '--accept-package-agreements',
    ], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, async (err) => {
        if (err) {
            logger.error('system', `ollama install (winget) failed: ${err.message}`);
            _install = { status: 'failed', error: err.message };
            return;
        }
        const status = await ensureOllama();
        _install = status === 'running' || status === 'started'
            ? { status: 'done' }
            : { status: 'failed', error: 'Ollama installed, but it did not start.' };
        logger.info('system', `ollama install finished, start: ${status}`);
    });
    return true;
}

const _pulls = new Map();

/** A model download in flight or finished, `{ completed, total, error, done }` in bytes, or null. */
function pullState(name) {
    return _pulls.get(name) || null;
}

/**
 * Download a model into the user's Ollama. Returns at once; progress is read back
 * through `pullState()`, so it survives the settings panel closing. A call for a model
 * already downloading joins that download instead of starting another.
 *
 * `total` sums every layer, each counted once by digest. Ollama reports layers one
 * at a time, so a bar driven by the latest line alone would fall back to zero at
 * each new layer.
 */
function startPull(name) {
    const current = _pulls.get(name);
    if (current && !current.done) return;
    const job = { completed: 0, total: 0, error: null, done: false };
    const layers = new Map();
    _pulls.set(name, job);
    engines()
        .then(({ OllamaEngine }) => new OllamaEngine().pull(name, (msg) => {
            if (!msg.digest || !msg.total) return;
            layers.set(msg.digest, { total: msg.total, completed: msg.completed || 0 });
            job.total = 0;
            job.completed = 0;
            for (const l of layers.values()) {
                job.total += l.total;
                job.completed += l.completed;
            }
        }))
        .then(() => {
            job.completed = job.total;
            logger.info('system', `ollama pull finished: ${name}`);
        })
        .catch((err) => {
            job.error = err.message;
            logger.error('system', `ollama pull ${name} failed: ${err.message}`);
        })
        .finally(() => { job.done = true; });
}

module.exports = {
    ensureOllama,
    installOllama,
    installState,
    startPull,
    pullState,
    parseOllamaModelsDir,
};
