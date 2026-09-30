/**
 * services/agentRoutines.mjs — saved operation chains ("routines") for the agent (MPI-970).
 *
 * A routine is a named list of `generate` args (`{ schema, name, summary, steps[], created_at }`)
 * the agent saves once and the app runs later on any card.  One folder for every project,
 * `<APP_USER_DATA>/agent/routines/`: projects are thrown away, routines are kept (Fabio,
 * 2026-09-30).  A run still lands in whichever project it names.
 *
 * File name = slug + `.json`; slug = `^[a-z0-9][a-z0-9-]{0,60}$`.  The store takes an
 * already-validated routine (full validation is Phase 3 / W1); it only checks structural
 * invariants: name is a valid slug, argument is a plain object, JSON-serialisable.
 *
 * D5 delete: moves the file to `routines/deleted/`.  A name that already sits in
 * `deleted/` has the older copy renamed with a ms-timestamp suffix before the new one
 * lands, so no prior copy is lost.  D6 cap: 50 routines; `deleted/` does not count;
 * overwriting an existing name is always allowed, even at the cap.
 *
 * Only `routes/connector.js` calls this.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const MAX_ROUTINES = 50;
const DELETED_DIR = 'deleted';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;

export class RoutineError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

/** The routines folder, in app data beside the agent memory folder. */
function routinesDir() {
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

/** `{ routines: [{ name, summary, steps, inputs }] }`, empty before the first routine. */
export async function listRoutines() {
    const dir = routinesDir();
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
            // What a run must be given (D9), so the agent can ask before it runs.
            inputs: Array.isArray(routine.inputs) ? routine.inputs : [],
        });
    }
    return { routines };
}

/** `{ name, routine }` of one routine. */
export async function readRoutine(name) {
    checkName(name);
    const routine = await _tryRead(path.join(routinesDir(), `${name}.json`));
    if (routine === null) {
        throw new RoutineError('ROUTINE_NOT_FOUND', `No routine "${name}" found.`);
    }
    return { name, routine };
}

/**
 * Create a routine, or replace the one with the same name.
 * @param {object} routine — plain object with a `name` slug; must be JSON-serialisable.
 * @returns {Promise<{name: string, created: boolean}>}
 */
export async function writeRoutine(routine = {}) {
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
    const dir = routinesDir();
    const filePath = path.join(dir, `${name}.json`);
    const exists = await _exists(filePath);
    if (!exists) {
        const count = await _countRoutines(dir);
        if (count >= MAX_ROUTINES) {
            throw new RoutineError('ROUTINES_FULL',
                `There are already ${MAX_ROUTINES} routines. Delete a stale one, then save this.`);
        }
    }
    await fs.mkdir(dir, { recursive: true });
    // Atomic write: write to a tmp file, then rename into place.
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, text, 'utf8');
    await fs.rename(tmp, filePath);
    return { name, created: !exists };
}

/** Move the routine to `routines/deleted/`, keeping any prior deleted copy. */
export async function deleteRoutine(name) {
    checkName(name);
    const dir = routinesDir();
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

/**
 * Give a routine a new name, in place: the file moves and its `name` follows. A save under
 * the new name plus a delete made the agent retype every step from memory (`list` shows a
 * step count), and one that could not delete left the old copy (Fabio, 2026-09-30).
 * Refused `NAME_TAKEN` rather than overwrite one.
 */
export async function renameRoutine(name, newName) {
    checkName(name);
    checkName(newName);
    const dir = routinesDir();
    const from = path.join(dir, `${name}.json`);
    const routine = await _tryRead(from);
    if (!routine) throw new RoutineError('ROUTINE_NOT_FOUND', `No routine "${name}" to rename.`);
    const to = path.join(dir, `${newName}.json`);
    if (await _exists(to)) {
        throw new RoutineError('NAME_TAKEN', `A routine "${newName}" already exists. Pick another name, or delete that one first.`);
    }
    await fs.rename(from, to);
    await fs.writeFile(to, JSON.stringify({ ...routine, name: newName }, null, 2), 'utf8');
    return { name: newName, renamed: name };
}
