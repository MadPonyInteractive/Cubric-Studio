/**
 * services/agentRoutines.mjs — saved operation chains ("routines") for the agent (MPI-970).
 *
 * A routine is a named list of `generate` args (`{ schema, name, summary, steps[], created_at }`)
 * the agent saves once and the app runs later on any card.  Two scopes: project
 * (`<project>/Agent/routines/`) and global (`<APP_USER_DATA>/agent/routines/`),
 * matching the two-scope pattern of agentMemory.mjs.
 *
 * File name = slug + `.json`; slug = `^[a-z0-9][a-z0-9-]{0,60}$`.  The store takes an
 * already-validated routine (full validation is Phase 3 / W1); it only checks structural
 * invariants: name is a valid slug, argument is a plain object, JSON-serialisable.
 *
 * D5 delete: moves the file to `routines/deleted/`.  A name that already sits in
 * `deleted/` has the older copy renamed with a ms-timestamp suffix before the new one
 * lands, so no prior copy is lost.  D6 cap: 50 routines per scope; `deleted/` does not
 * count; overwriting an existing name is always allowed, even at the cap.
 *
 * Only `routes/connector.js` will call this (Phase 3 wiring, a later card).
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const ROUTINES_DIR = 'Agent/routines';
export const MAX_ROUTINES = 50;
const DELETED_DIR = 'deleted';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;

export class RoutineError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

/** The project's routines folder.  The folder must be a Cubric Vision project. */
async function routinesDir(folderPath) {
    if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) {
        throw new RoutineError('BAD_REQUEST', 'folderPath must be an absolute path.');
    }
    try {
        await fs.access(path.join(folderPath, 'project.json'));
    } catch {
        throw new RoutineError('NOT_A_PROJECT', `No Cubric Vision project at ${folderPath}.`);
    }
    return path.join(folderPath, ROUTINES_DIR);
}

/** The global routines folder, in app data beside the agent memory folder. */
function globalRoutinesDir() {
    const base = process.env.APP_USER_DATA
        ? path.join(process.env.APP_USER_DATA, 'agent')
        : path.join(os.tmpdir(), 'cubric-agent');
    return path.join(base, 'routines');
}

/** A routine name must be a slug: `^[a-z0-9][a-z0-9-]{0,60}$`. */
function checkName(name) {
    if (typeof name !== 'string' || !SLUG_RE.test(name)) {
        throw new RoutineError('INVALID_NAME',
            'name must be a lowercase slug like "upscale-detail" (letters, digits, hyphens; ' +
            'must start with a letter or digit; at most 61 characters).');
    }
}

/** Read and parse a JSON file; returns null on any I/O or parse error. */
async function _tryRead(filePath) {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
        return null;
    }
}

/** Count .json files at the top level of dir (not in subdirs like deleted/). */
async function _countRoutines(dir) {
    try {
        const entries = await fs.readdir(dir);
        return entries.filter((e) => e.endsWith('.json')).length;
    } catch {
        return 0;
    }
}

/** Whether a file exists. */
const _exists = (p) => fs.access(p).then(() => true, () => false);

// ── internals ────────────────────────────────────────────────────────────────

async function _listIn(dir) {
    let entries = [];
    try {
        entries = await fs.readdir(dir);
    } catch { /* no routines yet */ }
    const routines = [];
    for (const entry of entries) {
        if (!entry.endsWith('.json')) continue;
        const routine = await _tryRead(path.join(dir, entry));
        if (!routine || typeof routine !== 'object' || Array.isArray(routine)) continue; // skip corrupt
        routines.push({
            name: entry.slice(0, -5), // strip .json
            summary: typeof routine.summary === 'string' ? routine.summary : '',
            steps: Array.isArray(routine.steps) ? routine.steps.length : 0,
        });
    }
    return { routines };
}

async function _readIn(dir, name) {
    const routine = await _tryRead(path.join(dir, `${name}.json`));
    if (routine === null) {
        throw new RoutineError('ROUTINE_NOT_FOUND', `No routine "${name}" found.`);
    }
    return { name, routine };
}

async function _writeIn(dir, routine) {
    if (!routine || typeof routine !== 'object' || Array.isArray(routine)) {
        throw new RoutineError('BAD_REQUEST', 'routine must be a plain object.');
    }
    const { name } = routine;
    checkName(name);
    let text;
    try {
        text = JSON.stringify(routine, null, 2);
    } catch {
        throw new RoutineError('BAD_REQUEST', 'routine could not be serialised to JSON.');
    }
    const filePath = path.join(dir, `${name}.json`);
    const exists = await _exists(filePath);
    if (!exists) {
        const count = await _countRoutines(dir);
        if (count >= MAX_ROUTINES) {
            throw new RoutineError('ROUTINES_FULL',
                `There are already ${MAX_ROUTINES} routines here. Delete a stale one, then save this.`);
        }
    }
    await fs.mkdir(dir, { recursive: true });
    // Atomic write: write to a tmp file, then rename into place.
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, text, 'utf8');
    await fs.rename(tmp, filePath);
    return { name, created: !exists };
}

async function _deleteIn(dir, name) {
    const filePath = path.join(dir, `${name}.json`);
    if (!await _exists(filePath)) {
        throw new RoutineError('ROUTINE_NOT_FOUND', `No routine "${name}" to delete.`);
    }
    const deletedDir = path.join(dir, DELETED_DIR);
    await fs.mkdir(deletedDir, { recursive: true });
    const destPath = path.join(deletedDir, `${name}.json`);
    // A name that already sits in deleted/ has the older copy timestamped so neither is lost.
    if (await _exists(destPath)) {
        await fs.rename(destPath, path.join(deletedDir, `${name}-${Date.now()}.json`));
    }
    await fs.rename(filePath, destPath);
    return { name, deleted: true };
}

// ── project scope ─────────────────────────────────────────────────────────────

/** `{ routines: [{ name, summary, steps }] }`, empty before the first routine. */
export async function listRoutines(folderPath) {
    return _listIn(await routinesDir(folderPath));
}

/** `{ name, routine }` of one routine. */
export async function readRoutine(folderPath, name) {
    checkName(name);
    return _readIn(await routinesDir(folderPath), name);
}

/**
 * Create a routine, or replace the one with the same name.
 * @param {string} folderPath — absolute path to a Cubric Vision project.
 * @param {object} routine — plain object with a `name` slug; must be JSON-serialisable.
 * @returns {Promise<{name: string, created: boolean}>}
 */
export async function writeRoutine(folderPath, routine = {}) {
    return _writeIn(await routinesDir(folderPath), routine);
}

/** Move the routine to `routines/deleted/`, keeping any prior deleted copy. */
export async function deleteRoutine(folderPath, name) {
    checkName(name);
    return _deleteIn(await routinesDir(folderPath), name);
}

// ── global scope ──────────────────────────────────────────────────────────────

/** The global routines: the same four calls, on app data instead of a project. */
export async function listGlobalRoutines() {
    return _listIn(globalRoutinesDir());
}

export async function readGlobalRoutine(name) {
    checkName(name);
    return _readIn(globalRoutinesDir(), name);
}

export async function writeGlobalRoutine(routine = {}) {
    return _writeIn(globalRoutinesDir(), routine);
}

export async function deleteGlobalRoutine(name) {
    checkName(name);
    return _deleteIn(globalRoutinesDir(), name);
}
