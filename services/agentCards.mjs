/**
 * services/agentCards.mjs - what is already in a project, read off disk (MPI-817).
 *
 * The agent's image refs are a per-session allowlist: attachments, and that session's own
 * results. After a restart or a Start Over it is empty, so an agent sitting in a project
 * full of cards could see none of them. Live, 2026-09-19: asked to redo the duck clip, it
 * answered "I can't see the duck image in this turn" while its own note named the file, and
 * Fabio attached the picture by hand.
 *
 * Two hops, on purpose (Fabio: never load the whole thing). `listCards` is one short row a
 * card; `readCard` is one card in full: the whole prompt, the settings that ran and the
 * media it was made from, which is how the lineage of a project gets worked out.
 *
 * Everything here comes from `project.json` and `Media/.meta/<itemId>.json`. The prompt and
 * the settings are in the SIDECAR and nowhere else.
 */

import path from 'path';
import fs from 'fs/promises';
import { MemoryError } from './agentMemory.mjs';
import { CARD_MARKS, markOf } from '../js/utils/galleryFilter.js';

export const DEFAULT_LIMIT = 12;
export const MAX_LIMIT = 30;
const ROW_PROMPT_CHARS = 200;

/** The absolute path behind a `/project-file?path=…` url, or the string itself. */
function _decode(ref) {
    if (typeof ref !== 'string' || !ref) return null;
    if (!ref.includes('/project-file?')) return ref;
    try {
        return new URL(ref, 'http://127.0.0.1').searchParams.get('path');
    } catch { return null; }
}

/**
 * A file the project owns, or null. A project folder can come from anywhere and its
 * sidecars are plain JSON, so a path one of them names is NOT trusted to stay inside the
 * project: every ref this module hands out is registered for `look` and `generate`, which
 * ship the file to the engine, and that engine may be a remote Pod.
 */
function _ownedMedia(folderPath, ref) {
    const abs = _decode(ref);
    if (!abs || !path.isAbsolute(abs)) return null;
    const media = path.resolve(folderPath, 'Media') + path.sep;
    const resolved = path.resolve(abs);
    return resolved.toLowerCase().startsWith(media.toLowerCase()) ? resolved : null;
}

/** The same check for `POST /agent/message`, which takes a video by reference. */
export const ownedMedia = _ownedMedia;

async function _readJson(file) {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}

async function _project(folderPath) {
    if (typeof folderPath !== 'string' || !path.isAbsolute(folderPath)) {
        throw new MemoryError('BAD_REQUEST', 'folderPath must be an absolute path.');
    }
    const project = await _readJson(path.join(folderPath, 'project.json'));
    if (!project) throw new MemoryError('NOT_A_PROJECT', `No Cubric Vision project at ${folderPath}.`);
    return project;
}

/** The item id of the version the card is SHOWING - `selectedIndex`, not the newest. */
function _selectedId(group) {
    const history = Array.isArray(group.history) ? group.history : [];
    const itemId = history[group.selectedIndex ?? 0] ?? history[history.length - 1];
    return typeof itemId === 'string' && /^[\w-]+$/.test(itemId) ? itemId : null;
}

/** That version's sidecar. */
async function _selected(folderPath, group) {
    const itemId = _selectedId(group);
    return itemId ? _readJson(path.join(folderPath, 'Media', '.meta', `${itemId}.json`)) : null;
}

/** `{ role, ref }` for each picture a generation was made from, where the project still has it. */
function _inputs(folderPath, meta) {
    const items = meta.generationSettings?.mediaItems || meta.flowInputs?.mediaItems || [];
    return items
        .map((m) => ({ role: m.role, file: _ownedMedia(folderPath, m.url || m.filePath) }))
        .filter((m) => m.file)
        .map((m) => ({ role: m.role, ref: path.basename(m.file) }));
}

function _row(folderPath, group, meta) {
    const file = meta && _ownedMedia(folderPath, meta.filePath);
    const prompt = String(meta?.prompt || '').replace(/\s+/g, ' ').trim();
    return {
        groupId: group.id,
        name: group.customName || group.name,
        kind: group.type,
        createdAt: group.createdAt,
        versions: Array.isArray(group.history) ? group.history.length : 0,
        // `markOf`, never `.favourite` raw: a pre-MPI-785 project stored the heart as `true`.
        ...(markOf(group) ? { mark: markOf(group) } : {}),
        // The ref `look` and `generate` take. Absent when the file is not the project's own.
        ...(file ? { ref: path.basename(file) } : {}),
        ...(meta?.uploaded ? { uploaded: true } : {}),
        ...(meta?.flowId ? { flowId: meta.flowId } : {}),
        ...(meta?.modelId ? { modelId: meta.modelId } : {}),
        ...(meta?.operation ? { operation: meta.operation } : {}),
        ...(meta?.pixelDimensions ? { size: `${meta.pixelDimensions.w}x${meta.pixelDimensions.h}` } : {}),
        ...(meta?.duration ? { durationSeconds: meta.duration } : {}),
        ...(prompt ? { prompt: prompt.length > ROW_PROMPT_CHARS ? `${prompt.slice(0, ROW_PROMPT_CHARS)}…` : prompt } : {}),
        _file: file || null,
        // What the GIF routes name a card by. The model never sees it: it says `ref`, and
        // the loop looks the item id up from the same allowlist entry.
        _itemId: _selectedId(group),
    };
}

function _groups(project) {
    return (Array.isArray(project.itemGroups) ? project.itemGroups : [])
        .filter((g) => g && typeof g.id === 'string' && g.archived !== true);
}

/** `_file` and `_itemId` are for the caller's allowlist and never part of what the model reads. */
function _split(rows) {
    const files = {};
    const cards = rows.map(({ _file, _itemId, ...row }) => {
        if (_file && row.ref) files[row.ref] = { path: _file, modelId: row.modelId || null, itemId: _itemId };
        return row;
    });
    return { cards, files };
}

/**
 * The project's cards, newest first, one short row each.
 * @returns {Promise<{cards: object[], total: number, files: Record<string, {path: string, modelId: string|null}>}>}
 */
export async function listCards(folderPath, { limit = DEFAULT_LIMIT, mark } = {}) {
    const project = await _project(folderPath);
    const n = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
    if (mark && !CARD_MARKS.some((m) => m.id === mark)) {
        throw new MemoryError('BAD_REQUEST', `mark must be one of: ${CARD_MARKS.map((m) => m.id).join(', ')}.`);
    }
    const groups = _groups(project)
        .filter((g) => !mark || markOf(g) === mark)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const rows = await Promise.all(groups.slice(0, n)
        .map(async (g) => _row(folderPath, g, await _selected(folderPath, g))));
    return { ..._split(rows), total: groups.length };
}

/**
 * Rows for the group ids the RENDERER named, in ITS order: the gallery's visible set
 * (`GET /connector/visible-cards`). Deliberately not `_groups()` — the archived scope shows
 * exactly the cards that filter drops. `total` is how many are showing, before `limit`.
 */
export async function cardsByIds(folderPath, ids, { limit = MAX_LIMIT } = {}) {
    const project = await _project(folderPath);
    const byId = new Map((Array.isArray(project.itemGroups) ? project.itemGroups : []).map((g) => [g?.id, g]));
    const groups = (Array.isArray(ids) ? ids : []).map((id) => byId.get(id)).filter(Boolean);
    const n = Math.min(Math.max(Number(limit) || MAX_LIMIT, 1), MAX_LIMIT);
    const rows = await Promise.all(groups.slice(0, n)
        .map(async (g) => _row(folderPath, g, await _selected(folderPath, g))));
    return { ..._split(rows), total: groups.length };
}

/** One card in full: the whole prompt, what ran, and what it was made from. */
export async function readCard(folderPath, groupId) {
    const project = await _project(folderPath);
    const group = _groups(project).find((g) => g.id === groupId);
    if (!group) throw new MemoryError('UNKNOWN_CARD', `No card "${groupId}" in this project. Use a groupId from list_cards.`);
    const meta = await _selected(folderPath, group);
    const { cards, files } = _split([_row(folderPath, group, meta)]);
    const inputs = meta ? _inputs(folderPath, meta) : [];
    for (const m of meta?.generationSettings?.mediaItems || meta?.flowInputs?.mediaItems || []) {
        const file = _ownedMedia(folderPath, m.url || m.filePath);
        if (file) files[path.basename(file)] = { path: file, modelId: null };
    }
    return {
        card: {
            ...cards[0],
            ...(meta?.prompt ? { prompt: meta.prompt } : {}),
            ...(meta?.negativePrompt ? { negativePrompt: meta.negativePrompt } : {}),
            ...(meta?.seed !== undefined ? { seed: meta.seed } : {}),
            ...(meta?.generationMs ? { generationMs: meta.generationMs } : {}),
            settings: meta?.generationSettings?.injectionParams || meta?.flowInputs?.injectionParams || {},
            madeFrom: inputs,
        },
        files,
    };
}
