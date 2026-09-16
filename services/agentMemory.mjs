/**
 * services/agentMemory.mjs — the agent's per-project notes (MPI-774 Phase 3b, item 5).
 *
 * `<project>/Agent/README.md` is the index, one line per note: `- [Title](file.md): hook`.
 * Each note is `<project>/Agent/<file>.md`, plain Markdown the user can open and edit.
 * The folder travels with the project, so the agent remembers it after a restart.
 *
 * Only `routes/connector.js` calls this: the loop reaches it over HTTP like every other
 * tool, and a CLI agent gets the same routes. There is no delete: agents never delete
 * (Fabio, 2026-09-16), and a note the user no longer wants is theirs to remove.
 *
 * ponytail: no lock. The in-app loop writes one note at a time; two CLI agents writing the
 * same project at once can lose an index line. Add a per-project lock if that ever happens.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

export const MEMORY_DIR = 'Agent';
export const INDEX_FILE = 'README.md';
export const MAX_NOTE_BYTES = 4096;
export const MAX_NOTES = 100;
const MAX_TITLE = 80;
const MAX_HOOK = 160;

const FILE_RE = /^[a-z0-9][a-z0-9-]{0,60}\.md$/;
const LINE_RE = /^- \[(.+)\]\(([a-z0-9][a-z0-9-]{0,60}\.md)\)(?::\s*(.*))?$/;

const INDEX_HEADER = [
    '# Agent notes',
    '',
    'What the Cubric agent remembers about this project, one line per note. The notes sit',
    'beside this file. You can edit or delete any of them.',
    '',
].join('\n');

export class MemoryError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

/** The project's notes folder. The folder must be a Cubric Vision project. */
async function notesDir(folderPath) {
    if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) {
        throw new MemoryError('BAD_REQUEST', 'folderPath must be an absolute path.');
    }
    try {
        await fs.access(path.join(folderPath, 'project.json'));
    } catch {
        throw new MemoryError('NOT_A_PROJECT', `No Cubric Vision project at ${folderPath}.`);
    }
    return path.join(folderPath, MEMORY_DIR);
}

/** A note name is a bare lowercase slug, so it can never leave the notes folder. */
function checkFile(file) {
    if (typeof file !== 'string' || !FILE_RE.test(file) || file === 'readme.md') {
        throw new MemoryError('BAD_REQUEST', 'file must be a lowercase slug ending in .md, like "main-character.md".');
    }
}

function parseIndex(text) {
    return text.split(/\r?\n/)
        .map((line) => line.match(LINE_RE))
        .filter(Boolean)
        .map(([, title, file, hook]) => ({ title, file, hook: hook || '' }));
}

/** One line of text: the index keeps one note per line. */
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** `{ notes: [{ title, file, hook }] }`, empty before the first note. */
export async function readIndex(folderPath) {
    const dir = await notesDir(folderPath);
    let text = '';
    try {
        text = await fs.readFile(path.join(dir, INDEX_FILE), 'utf8');
    } catch { /* no notes yet */ }
    return { notes: parseIndex(text) };
}

/** `{ file, text }` of one note. */
export async function readNote(folderPath, file) {
    checkFile(file);
    const dir = await notesDir(folderPath);
    try {
        return { file, text: await fs.readFile(path.join(dir, file), 'utf8') };
    } catch {
        throw new MemoryError('UNKNOWN_NOTE', `No note "${file}" in this project.`);
    }
}

/**
 * Create a note, or replace the one with the same file name, and keep its index line
 * current. Every other line of the index (the user may have edited it) is left alone.
 * @returns {Promise<{file: string, created: boolean}>}
 */
export async function writeNote(folderPath, { file, title, hook, text } = {}) {
    checkFile(file);
    title = oneLine(title).replace(/[[\]]/g, '');
    hook = oneLine(hook);
    if (!title || title.length > MAX_TITLE) {
        throw new MemoryError('BAD_REQUEST', `title is required, at most ${MAX_TITLE} characters.`);
    }
    if (hook.length > MAX_HOOK) {
        throw new MemoryError('BAD_REQUEST', `hook is at most ${MAX_HOOK} characters.`);
    }
    if (typeof text !== 'string' || !text.trim()) {
        throw new MemoryError('BAD_REQUEST', 'text is required.');
    }
    if (Buffer.byteLength(text, 'utf8') > MAX_NOTE_BYTES) {
        throw new MemoryError('NOTE_TOO_LONG', `A note holds at most ${MAX_NOTE_BYTES} bytes. Keep what matters, or split it.`);
    }

    const dir = await notesDir(folderPath);
    const indexPath = path.join(dir, INDEX_FILE);
    let index;
    try {
        index = await fs.readFile(indexPath, 'utf8');
    } catch {
        index = INDEX_HEADER;
    }

    const lines = index.split(/\r?\n/);
    const line = `- [${title}](${file})${hook ? `: ${hook}` : ''}`;
    const at = lines.findIndex((l) => l.match(LINE_RE)?.[2] === file);
    if (at >= 0) {
        lines[at] = line;
    } else {
        if (parseIndex(index).length >= MAX_NOTES) {
            throw new MemoryError('MEMORY_FULL', `This project already has ${MAX_NOTES} notes. Update or merge existing notes instead.`);
        }
        while (lines.length && lines[lines.length - 1] === '') lines.pop();
        // A note line directly under prose would read as part of that paragraph.
        if (lines.length && !LINE_RE.test(lines[lines.length - 1])) lines.push('');
        lines.push(line, '');
    }

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, file), text.endsWith('\n') ? text : `${text}\n`);
    await fs.writeFile(indexPath, lines.join('\n'));
    return { file, created: at < 0 };
}
