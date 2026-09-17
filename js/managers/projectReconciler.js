/**
 * js/managers/projectReconciler.js
 *
 * Client-side reconciliation: loads .meta/<uuid>.json files for each history
 * ID, drops entries where the meta or media file is missing, and returns
 * fully hydrated in-memory item objects.
 *
 * Runs after server-side migration (openProject flow):
 *   1. projectManager.openProject() calls POST /migrate-project
 *   2. /migrate-project runs server migrations and writes updated project.json
 *   3. Client loads the migrated project, then calls reconcileAndHydrate()
 *   4. reconcileAndHydrate() asks POST /load-meta-batch for every .meta/<uuid>.json
 *      at once, with the media file's presence alongside each one (MPI-804)
 *   5. Broken entries are silently removed; groups that become empty are dropped
 *
 * The reconciled project is then persisted back to project.json if anything
 * was removed (so the disk state stays clean).
 */

import { createDefaultLoras, getLoraStages } from '../data/projectModel.js';

/**
 * Reconcile a migrated project: load .meta/ files, drop broken entries,
 * hydrate history with full item objects.
 *
 * @param {Object} project — Migrated project (history = UUID string arrays)
 * @returns {{ project: Object, wasModified: boolean }}
 *   project: fully hydrated in-memory project ready for state
 *   wasModified: true if any entries/groups were removed (needs re-persist)
 */
export async function reconcileAndHydrate(project) {
    let wasModified = false;
    const projectWithSettings = _upgradeStagedLoraSettings(project);
    const folderPath = projectWithSettings.folderPath;
    const groups = projectWithSettings.itemGroups ?? [];
    const hydratedGroups = [];

    // ONE request for the whole project (MPI-804). This was two round-trips per
    // item, awaited in series — 300 of them for a 150-item project — and they
    // queue behind everything else the renderer has open (Chromium's 6-per-host
    // cap). With the engine auto-starting, clicking a project did nothing at all
    // until it finished booting.
    const hydration = await _fetchHydration(groups.flatMap(g => g.history ?? []), folderPath);
    // Listed once, and only if some item turns out to have no sidecar.
    let mediaFiles = null;

    for (const group of groups) {
        const hydratedHistory = [];

        for (const id of (group.history ?? [])) {
            const { meta = null, exists = false } = hydration[id] ?? {};

            if (!meta) {
                // No .meta/ file found. This can happen for:
                //   a) uploaded: true items (imported by user — no .meta/ by design)
                //   b) items whose .meta/ was accidentally deleted
                // In both cases, try to construct a minimal synthetic item from
                // the media file itself so the entry isn't silently lost.
                wasModified = true;
                if (!mediaFiles) mediaFiles = await _listMediaFiles(folderPath);
                const synthetic = _constructSyntheticItem(id, mediaFiles);
                if (synthetic) {
                    hydratedHistory.push(synthetic);
                }
                continue;
            }

            // The media file is gone from disk
            if (!exists) {
                // Orphaned meta — clean it up
                await _deleteMeta(id, folderPath);
                wasModified = true;
                continue;
            }

            hydratedHistory.push(meta); // Full object in memory
        }

        if (hydratedHistory.length === 0) {
            wasModified = true;
            continue; // Drop empty group
        }

        hydratedGroups.push({
            ...group,
            history: hydratedHistory,
            selectedIndex: Math.min(group.selectedIndex ?? 0, hydratedHistory.length - 1),
        });
    }

    return {
        project: { ...projectWithSettings, itemGroups: hydratedGroups },
        wasModified,
    };
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _upgradeStagedLoraSettings(project) {
    const settings = project.modelSettings ?? {};
    let nextSettings = settings;

    for (const [modelId, modelSettings] of Object.entries(settings)) {
        const stages = getLoraStages(modelId);
        if (!stages || !Array.isArray(modelSettings?.loras)) continue;

        const stagedLoras = createDefaultLoras(modelId);
        const firstStage = stages[0]?.key;
        if (firstStage) stagedLoras[firstStage] = modelSettings.loras;

        if (nextSettings === settings) nextSettings = { ...settings };
        nextSettings[modelId] = {
            ...modelSettings,
            loras: stagedLoras,
        };

    }

    return nextSettings === settings
        ? project
        : { ...project, modelSettings: nextSettings };
}

/**
 * Every item's sidecar and media-file presence, in one request (MPI-804).
 *
 * THROWS when the request fails, and deliberately so. An empty answer would read
 * as "no sidecar" for every item — each one rebuilt as a synthetic `uploaded`
 * entry, every group whose media could not be found dropped, and `wasModified`
 * true, which is what persists that back to project.json. A project must not be
 * rewritten because one request did not land; the caller reports it instead.
 *
 * @param {string[]} ids
 * @param {string} folderPath
 * @returns {Promise<Record<string, { meta: Object|null, exists: boolean }>>}
 */
async function _fetchHydration(ids, folderPath) {
    if (!ids.length) return {};
    const res = await fetch('/load-meta-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath, ids }),
    });
    if (!res.ok) throw new Error(`Could not read this project's items (HTTP ${res.status}).`);
    const data = await res.json();
    if (!data?.items) throw new Error("Could not read this project's items.");
    return data.items;
}

/**
 * Try to construct a minimal synthetic item for entries that have no .meta/ file.
 * This preserves uploaded items (which don't get .meta/ files) and items whose
 * .meta/ was accidentally deleted. The media file must exist.
 *
 * @param {string} id — Item UUID
 * @param {Array<{name: string, type: string, path: string, resolution?: string}>} files
 *   The project's Media listing, fetched once by the caller.
 * @returns {Object|null} Synthetic item, or null if media file not found
 */
function _constructSyntheticItem(id, files) {
    const hit = files.find(f => {
        const base = f.name.replace(/\.[^.]+$/, '');
        return base === id;
    });

    if (!hit) return null; // Can't locate the media file

    const isVideo = hit.type === 'video';
    return {
        id,
        type: hit.type,
        filePath: `/project-file?path=${encodeURIComponent(hit.path)}`,
        operation: 'imported',
        displayName: hit.name.replace(/\.[^.]+$/, ''),
        prompt: '',
        negativePrompt: '',
        seed: -1,
        modelId: null,
        createdAt: new Date().toISOString(),
        name: null,
        uploaded: true,
        flowId: null,   // Flow provenance parity (MPI-256) — synthetic/imported items are never Flow gens
        flowInputs: null,
        pixelDimensions: hit.resolution
            ? _parseResolution(hit.resolution)
            : (isVideo ? { w: 0, h: 0 } : { w: 0, h: 0 }),
        generationMs: null,
    };
}

/**
 * Parse "WxH" resolution string to { w, h }.
 */
function _parseResolution(resolution) {
    const [w, h] = (resolution || '0x0').split('x').map(Number);
    return { w: w || 0, h: h || 0 };
}

/**
 * List media files in a project's Media directory (client-side scan via route).
 * Returns array of { name, type, path } objects.
 */
async function _listMediaFiles(folderPath) {
    try {
        const url = `/project-media/temp?folderPath=${encodeURIComponent(folderPath)}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return data.files || [];
    } catch {
        return [];
    }
}

/**
 * Delete a .meta/<uuid>.json sidecar file via the server.
 */
async function _deleteMeta(id, folderPath) {
    try {
        await fetch(`/delete-meta?id=${encodeURIComponent(id)}&folderPath=${encodeURIComponent(folderPath)}`, {
            method: 'DELETE',
        });
    } catch {
        // Non-fatal — best effort cleanup
    }
}
