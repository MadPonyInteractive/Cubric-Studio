#!/usr/bin/env node
/**
 * install-flow-devkit.mjs — match a Flow developer's own ComfyUI to the engine
 * Cubric Studio ships (MPI-798).
 *
 * A Flow graph uses nodes from the custom-node packs the app pins. Build a graph
 * against a different pack version and it can carry a node or a widget the users
 * running Cubric Studio do not have, so it fails on their machines. This script
 * installs the exact pins a given release shipped, and `--check` reports drift
 * without writing anything.
 *
 * Usage:
 *   node scripts/install-flow-devkit.mjs <comfyui-folder> [options]
 *
 *   --version <tag>   Take the pins from that release tag (e.g. v1.5.0) instead of
 *                     this checkout's dev_configs/. The tag IS the app version.
 *   --check           Report only. Writes nothing. Exit 1 if anything drifted.
 *   --python <path>   Python executable for the pip pass. Default: autodetected.
 *   --skip-python     Node packs only; leave the Python environment alone.
 *
 * Exit 0 = matched, 1 = drift found or install failed, 2 = usage.
 *
 * Needs only Node 18+ and a `tar` that reads zip (Windows 10+, macOS, and Linux
 * with bsdtar) — deliberately no node_modules, so a developer can run it from a
 * single downloaded file. Format and rules: docs/flow-packages.md.
 */

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

// The public repo serves every release's pins at its tag, immutably. No build step
// publishes them, because it does not need to — see docs/flow-packages.md.
const RAW_BASE = 'https://raw.githubusercontent.com/MadPonyInteractive/Cubric-Studio';

// routes/shared.js:1032 — the app stamps this per pack after a successful extract, and
// compares it against the lock to detect drift. The devkit writes the same marker so a
// developer's ComfyUI answers the question the same way the app's engine does.
const NODE_COMMIT_MARKER = '.mpi_node_commit';
// routes/shared.js:610 — sits next to the python binary, holds sha256(python_deps.txt)[0..16].
const PYTHON_DEPS_MARKER = '.cubric_python_deps';

// ── args ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const opts = { root: null, version: null, check: false, python: null, skipPython: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--check') opts.check = true;
        else if (a === '--skip-python') opts.skipPython = true;
        else if (a === '--version') opts.version = argv[++i];
        else if (a.startsWith('--version=')) opts.version = a.slice('--version='.length);
        else if (a === '--python') opts.python = argv[++i];
        else if (a.startsWith('--python=')) opts.python = a.slice('--python='.length);
        else if (a.startsWith('--')) return { error: `unknown option "${a}"` };
        else if (opts.root === null) opts.root = a;
        else return { error: `unexpected argument "${a}"` };
    }
    if (!opts.root) return { error: 'a ComfyUI folder is required' };
    return opts;
}

function usage(msg) {
    if (msg) console.error(`install-flow-devkit: ${msg}\n`);
    console.error('Usage: node scripts/install-flow-devkit.mjs <comfyui-folder> [--version <tag>] [--check] [--python <path>] [--skip-python]');
    process.exit(2);
}

// ── locating things ──────────────────────────────────────────────────────────

/**
 * A developer may point at the portable root or at the ComfyUI folder inside it.
 * `custom_nodes` is what actually identifies the right level.
 */
function resolveComfyRoot(root) {
    const abs = path.resolve(root);
    if (existsSync(path.join(abs, 'custom_nodes'))) return abs;
    const nested = path.join(abs, 'ComfyUI');
    if (existsSync(path.join(nested, 'custom_nodes'))) return nested;
    return null;
}

/**
 * Portable ComfyUI ships `python_embeded/`; a source checkout usually carries a venv.
 * Both sit beside the ComfyUI folder as often as inside it, so look at both levels.
 */
function detectPython(comfyRoot) {
    const win = process.platform === 'win32';
    const candidates = [];
    for (const base of [comfyRoot, path.dirname(comfyRoot)]) {
        candidates.push(
            path.join(base, 'python_embeded', win ? 'python.exe' : 'python'),
            path.join(base, 'venv', win ? 'Scripts/python.exe' : 'bin/python'),
            path.join(base, '.venv', win ? 'Scripts/python.exe' : 'bin/python'),
        );
    }
    return candidates.find(existsSync) || null;
}

async function fetchText(url) {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return res.text();
}

/**
 * Both pin files come from the same place: this checkout, or one release tag. Never a
 * mix — a lock from one version with the Python set from another is the exact drift
 * this script exists to prevent.
 */
async function loadPins(version) {
    if (!version) {
        const lockPath = path.join(REPO_ROOT, 'dev_configs/node_lock.json');
        const depsPath = path.join(REPO_ROOT, 'dev_configs/python_deps.txt');
        if (!existsSync(lockPath)) {
            throw new Error(`no dev_configs/node_lock.json here — run from the repo, or pass --version <tag>`);
        }
        return {
            source: 'this checkout',
            lock: JSON.parse(await fs.readFile(lockPath, 'utf8')),
            pythonDeps: existsSync(depsPath) ? await fs.readFile(depsPath, 'utf8') : null,
        };
    }
    const tag = version.startsWith('v') ? version : `v${version}`;
    return {
        source: `release ${tag}`,
        lock: JSON.parse(await fetchText(`${RAW_BASE}/${tag}/dev_configs/node_lock.json`)),
        pythonDeps: await fetchText(`${RAW_BASE}/${tag}/dev_configs/python_deps.txt`),
    };
}

// ── node packs ───────────────────────────────────────────────────────────────

async function readMarker(dir) {
    try {
        return (await fs.readFile(path.join(dir, NODE_COMMIT_MARKER), 'utf8')).trim();
    } catch {
        return null;
    }
}

async function gitHead(dir) {
    try {
        const { stdout } = await execFileAsync('git', ['-C', dir, 'rev-parse', 'HEAD'], { windowsHide: true });
        return stdout.trim();
    } catch {
        return null;
    }
}

/**
 * States mirror routes/shared.js:1099 (`checkUniversalWorkflowDepsStatus`), with one
 * addition the app never needs: a DEVELOPER's packs are usually git clones (that is what
 * ComfyUI-Manager installs, and what the MPI bench carries), while the app only ever
 * zip-extracts. So git comes first and the marker is the fallback.
 *
 * This ordering is not cosmetic. On the MPI bench every pack is a clone sitting exactly
 * on its pinned commit, and marker-only inspection called all 21 of them drifted —
 * including ComfyUI-MpiNodes, whose stale marker disagreed with its own HEAD. Trusting
 * the marker there would have deleted 21 correct checkouts to reinstall the same code.
 */
async function inspectPack(customNodes, entry) {
    const dir = path.join(customNodes, entry.filename);
    if (!existsSync(dir)) return { state: 'missing', installed: null, dir, git: false };

    const git = existsSync(path.join(dir, '.git'));
    if (git) {
        const head = await gitHead(dir);
        if (head) return { state: head === entry.commit ? 'ok' : 'drifted', installed: head, dir, git: true };
        // A .git that cannot be read is not a clone we can steer — fall through to the marker.
    }

    const installed = await readMarker(dir);
    if (installed === entry.commit) return { state: 'ok', installed, dir, git };
    return { state: 'drifted', installed, dir, git };
}

/**
 * Windows ships bsdtar at System32\tar.exe (10 1803+), and that is what the app ends up
 * running (routes/downloadManager.js:106). A DEVELOPER'S shell often is not so lucky: Git
 * Bash and MSYS put GNU tar ahead of it on PATH, and GNU tar cannot read zip at all
 * ("This does not look like a tar archive"). It also treats `C:\dir\x.zip` as the remote
 * spec `host:path` and fails with "Cannot connect to C:". So name the System32 binary
 * outright rather than trusting PATH, and keep arguments colon-free for the fallback.
 */
function tarCandidates() {
    if (process.platform !== 'win32') return ['tar'];
    const sysRoot = process.env.SystemRoot || 'C:\\Windows';
    return [path.join(sysRoot, 'System32', 'tar.exe'), 'tar'];
}

async function extractArchive(zipName, cwd) {
    let last = null;
    for (const bin of tarCandidates()) {
        try {
            await execFileAsync(bin, ['-xf', zipName], { cwd, windowsHide: true });
            return;
        } catch (err) {
            last = err;
        }
    }
    throw new Error(
        `could not extract ${zipName} with \`tar\` (${String(last?.message || last).split('\n')[0]}). `
        + 'Needs bsdtar, which reads zip: Windows has it at System32\\tar.exe, macOS ships it, '
        + 'and on Linux it is libarchive-tools. GNU tar cannot do this.',
    );
}

/**
 * Move an existing clone onto the pinned commit instead of replacing it. A developer's
 * clone may carry their own branches, remotes or work in progress; deleting it to drop
 * in a zip of the same code would throw that away for nothing.
 */
async function checkoutPack(dir, entry) {
    const { stdout: status } = await execFileAsync('git', ['-C', dir, 'status', '--porcelain'], { windowsHide: true });
    if (status.trim()) {
        throw new Error('clone has uncommitted changes — commit, stash or move it, then re-run');
    }
    try {
        await execFileAsync('git', ['-C', dir, 'fetch', '--depth', '1', 'origin', entry.commit], { windowsHide: true });
    } catch {
        // Not every remote serves a bare commit fetch; a full fetch is the fallback.
        await execFileAsync('git', ['-C', dir, 'fetch', 'origin'], { windowsHide: true });
    }
    await execFileAsync('git', ['-C', dir, 'checkout', '--detach', entry.commit], { windowsHide: true });
}

/**
 * A GitHub /archive/<commit>.zip unpacks to `<repo>-<commit>`; the app renames that to
 * the lock's `filename`, and so must we, or ComfyUI never sees the pack.
 */
async function installPack(customNodes, id, entry, scratch) {
    const url = `https://github.com/${entry.repo}/archive/${entry.commit}.zip`;
    const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
    if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText}`);

    // The zip lands INSIDE the stage dir so `tar` can be handed a bare filename.
    const stage = path.join(scratch, id);
    await fs.rm(stage, { recursive: true, force: true });
    await fs.mkdir(stage, { recursive: true });

    const zipName = `${id}.zip`;
    await fs.writeFile(path.join(stage, zipName), Buffer.from(await res.arrayBuffer()));
    await extractArchive(zipName, stage);
    await fs.rm(path.join(stage, zipName), { force: true });

    const entries = await fs.readdir(stage, { withFileTypes: true });
    const top = entries.find((e) => e.isDirectory());
    if (!top) throw new Error('archive contained no folder');

    const target = path.join(customNodes, entry.filename);
    await fs.rm(target, { recursive: true, force: true });
    await fs.rename(path.join(stage, top.name), target);

    // Stamped LAST, so it only ever lands on a fully extracted pack (MPI-222).
    await fs.writeFile(path.join(target, NODE_COMMIT_MARKER), `${entry.commit}\n`);
    await fs.rm(stage, { recursive: true, force: true });
}

// ── python ───────────────────────────────────────────────────────────────────

function depsHash(contents) {
    return crypto.createHash('sha256').update(contents).digest('hex').slice(0, 16);
}

function runPip(python, args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(python, ['-s', '-m', 'pip', ...args], { stdio: 'inherit', windowsHide: true });
        proc.on('error', reject);
        proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`pip exited ${code}`))));
    });
}

/**
 * MPI-413: the app installs ONE curated set in a single --no-deps pass, NOT each pack's
 * own requirements.txt. Resolving per-pack requirements here would build a different
 * environment from the one every user has — the precise failure this kit prevents. The
 * lock's `installRequirements` flag is the Pod image's bake/volume split, not a signal
 * to run pip per pack.
 */
async function syncPython(python, pythonDeps, scratch, check) {
    const hash = depsHash(pythonDeps);
    const markerPath = path.join(path.dirname(python), PYTHON_DEPS_MARKER);
    let installed = null;
    try {
        installed = (await fs.readFile(markerPath, 'utf8')).trim();
    } catch { /* no marker — never installed, or predates the marker */ }

    if (installed === hash) return { state: 'ok', hash, installed };
    if (check) return { state: installed ? 'drifted' : 'missing', hash, installed };

    const reqPath = path.join(scratch, 'python_deps.txt');
    await fs.writeFile(reqPath, pythonDeps);
    await runPip(python, ['install', '-r', reqPath, '--no-deps', '--no-warn-script-location']);
    await fs.writeFile(markerPath, `${hash}\n`);
    await fs.rm(reqPath, { force: true });
    return { state: 'installed', hash, installed };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.error) usage(opts.error);

    const comfyRoot = resolveComfyRoot(opts.root);
    if (!comfyRoot) usage(`no custom_nodes folder under "${opts.root}" — point at a ComfyUI install`);
    const customNodes = path.join(comfyRoot, 'custom_nodes');

    let pins;
    try {
        pins = await loadPins(opts.version);
    } catch (err) {
        console.error(`install-flow-devkit: could not read the pins — ${err.message}`);
        process.exit(1);
    }

    const { lock } = pins;
    const packIds = Object.keys(lock.nodes);
    console.log(`Pins from ${pins.source}: ComfyUI ${lock.comfyui.core.tag}, ${packIds.length} node packs.`);
    console.log(`Target: ${comfyRoot}`);
    console.log(opts.check ? 'Mode: --check (nothing will be written).\n' : '');

    // Core version is advisory: bumping it is a different job (/mpi-bump-local-comfy on the
    // MPI bench), and a developer may be mid-upgrade on purpose.
    try {
        const head = await execFileAsync('git', ['-C', comfyRoot, 'describe', '--tags', '--abbrev=0'], { windowsHide: true });
        const localTag = head.stdout.trim();
        if (localTag && localTag !== lock.comfyui.core.tag) {
            console.log(`! ComfyUI core is ${localTag}, the release shipped ${lock.comfyui.core.tag}. Flows may still build fine; bump if a node fails to import.\n`);
        }
    } catch { /* not a git checkout (portable), or no tags — core check is advisory only */ }

    // Stage INSIDE custom_nodes, not os.tmpdir(): the final step is a rename, and a temp
    // dir on another volume (C: temp, ComfyUI on D:) makes every one of them EXDEV. Same
    // volume also keeps a few hundred MB of pack zips off the system drive.
    const scratch = path.join(customNodes, '.cubric-devkit-tmp');
    await fs.rm(scratch, { recursive: true, force: true });
    await fs.mkdir(scratch, { recursive: true });
    let problems = 0;
    let changed = 0;

    try {
        for (const id of packIds) {
            const entry = lock.nodes[id];
            const { state, installed, dir, git } = await inspectPack(customNodes, entry);

            if (state === 'ok') {
                console.log(`  ok       ${entry.filename}${git ? ' (git)' : ''}`);
                continue;
            }
            const was = state === 'missing' ? 'not installed' : `at ${installed ? installed.slice(0, 8) : 'no marker'}`;
            if (opts.check) {
                problems++;
                console.log(`  ${state.padEnd(8)} ${entry.filename} (${was}, pinned ${entry.commit.slice(0, 8)})`);
                continue;
            }
            process.stdout.write(`  ${git ? 'checkout' : 'install '} ${entry.filename} (${was}) ... `);
            try {
                if (git) await checkoutPack(dir, entry);
                else await installPack(customNodes, id, entry, scratch);
                changed++;
                console.log('done');
            } catch (err) {
                problems++;
                console.log(`FAILED: ${err.message}`);
            }
        }

        if (!opts.skipPython) {
            console.log('');
            const python = opts.python || detectPython(comfyRoot);
            if (!python) {
                console.log('  ! no Python found for this ComfyUI — pass --python <path>, or --skip-python.');
                problems++;
            } else if (!pins.pythonDeps) {
                console.log('  ! this checkout has no dev_configs/python_deps.txt — skipping the Python pass.');
            } else {
                try {
                    const r = await syncPython(python, pins.pythonDeps, scratch, opts.check);
                    if (r.state === 'ok') console.log(`  ok       python deps (${r.hash})`);
                    else if (r.state === 'installed') { changed++; console.log(`  installed python deps (${r.hash})`); }
                    else { problems++; console.log(`  ${r.state.padEnd(8)} python deps (have ${r.installed || 'none'}, pinned ${r.hash})`); }
                } catch (err) {
                    problems++;
                    console.log(`  FAILED   python deps: ${err.message}`);
                }
            }
        }
    } finally {
        await fs.rm(scratch, { recursive: true, force: true });
    }

    console.log('');
    if (opts.check) {
        console.log(problems
            ? `${problems} item(s) do not match ${pins.source}. Re-run without --check to fix.`
            : `Matched ${pins.source}. Flows built here will run on that release.`);
    } else {
        console.log(problems
            ? `${changed} installed, ${problems} failed.`
            : `Matched ${pins.source}${changed ? ` (${changed} installed)` : ''}. Flows built here will run on that release.`);
    }
    process.exit(problems ? 1 : 0);
}

// Importable for its helpers (scripts/lint-flow-package.mjs reuses inspectPack), so the
// CLI only runs when this file IS the entry point.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    await main();
}

export { inspectPack, resolveComfyRoot, loadPins, detectPython, NODE_COMMIT_MARKER };
