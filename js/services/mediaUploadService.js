/**
 * mediaUploadService.js — Shared media-file upload helper.
 *
 * Extracted from MpiPromptBox so Gallery + PromptBox share one ingest path.
 * Uploads a File to the project's media folder, creates its sidecar with
 * measured pixel dimensions, and returns stable URL + identifiers.
 */

import { clientLogger } from './clientLogger.js';
import { Events } from '../events.js';
import { measureMediaDimensions } from '../utils/mediaDimensions.js';

/**
 * Absolute disk path of a File, or null when it has none — a File synthesised from a
 * Blob (a canvas snapshot, a recorded take) is not backed by disk, and callers pass
 * plenty of those. Same `webUtils` accessor MpiFolderDrop/MpiProjectDropOverlay use;
 * null in browser dev mode, which keeps those on the base64 path.
 */
function _sourcePathFor(file) {
    try {
        if (typeof window.require !== 'function') return null;
        const webUtils = window.require('electron').webUtils;
        return webUtils?.getPathForFile(file) || null;
    } catch (_) {
        return null;
    }
}

// ── Very large images (MPI-943) ──────────────────────────────────────────────
// Past 4K most tools crawl or fail: ComfyUI loads an image as float32, so a 16K photo
// is a ~3.2 GB tensor before a model runs, and masking a canvas that size crawls.
// One dialog per drop offers to shrink them; routes/imageImport.js does the pixels.
const LARGE_IMAGE_PX = 3840 * 2160;
const MP = 1024 * 1024; // 1 MP = 1024x1024, the size the models are built around
const REDUCE_MP = [1, 2, 3, 4, 5];
// ponytail: remembered for the session only; persist through state.js if users ask.
let _lastReduceChoice = '2';

/** File -> { w, h, maxPixels } from the header probe; maxPixels 0 = import as is. */
const _importPlan = new WeakMap();

// A GIF would lose its animation and an SVG is rasterised by the upload route already.
const _isReducible = (file) => /^image\/(?!gif|svg)/.test(file?.type || '') && !!_sourcePathFor(file);

const _fitDims = ({ w, h }, maxPixels) => {
    const s = Math.min(1, Math.sqrt(maxPixels / (w * h)));
    return `${Math.round(w * s)} × ${Math.round(h * s)}`;
};

/** @returns {Promise<string|null>} an MP value from REDUCE_MP, 'keep', or null on cancel */
async function _askReduce(sizes) {
    const biggest = sizes.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    const one = sizes.length === 1;
    // Dynamic, like commandExecutor's confirm: a service does not pull a component in at load.
    const { MpiOkCancel } = await import('../components/Compounds/MpiOkCancel/MpiOkCancel.js');
    return new Promise((resolve) => {
        let settled = false;
        const finish = (v) => { if (!settled) { settled = true; resolve(v); } };
        const dlg = MpiOkCancel.mount(document.createElement('div'), {
            title: one ? 'This image is very large' : `${sizes.length} images are very large`,
            text: `${one ? 'It is' : 'The largest is'} ${biggest.w} × ${biggest.h}. Most tools in Cubric Studio work best `
                + `at 1 to 2 megapixels, and images this big can be slow or fail. Reduce ${one ? 'it' : 'them'} on import?\n`
                + (one ? 'Your original file is not changed.' : 'Your original files are not changed.'),
            select: {
                value: _lastReduceChoice,
                // Keep first: the list shows five rows, and a sixth at the bottom sits below the fold.
                options: [
                    { label: 'Keep original size', value: 'keep' },
                    // In the label, not `meta`: meta is a short-tag slot that clips a size.
                    ...REDUCE_MP.map(mp => ({ label: `${mp} MP (${_fitDims(biggest, mp * MP)})`, value: String(mp) })),
                ],
            },
            okLabel: 'Import',
        });
        const _hide = dlg.el.hide;
        dlg.el.hide = () => { _hide(); finish(null); }; // Escape / backdrop = cancel
        dlg.on('ok', ({ selectValue }) => finish(selectValue));
        dlg.on('cancel', () => finish(null));
        dlg.el.show();
    });
}

/**
 * Ask ONCE for a whole drop whether to shrink images past 4K. Call before a multi-file
 * import loop; `uploadMediaFile` asks per file for any image not planned here, so a
 * drop site that skips this still asks, just once per file.
 * @param {File[]} files
 * @returns {Promise<boolean>} false = the user cancelled, import nothing
 */
export async function prepareImageImport(files) {
    const todo = files.filter(f => _isReducible(f) && !_importPlan.has(f));
    if (!todo.length) return true;
    let sizes = [];
    try {
        const res = await fetch('/image-import/probe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paths: todo.map(_sourcePathFor) }),
        });
        sizes = (await res.json()).sizes || [];
    } catch (e) {
        clientLogger.warn('mediaUploadService', 'image size probe failed', e);
    }
    const large = [];
    todo.forEach((f, i) => {
        if (!sizes[i]) return; // unreadable header: import as before
        _importPlan.set(f, { ...sizes[i], maxPixels: 0 });
        if (sizes[i].w * sizes[i].h > LARGE_IMAGE_PX) large.push(f);
    });
    if (!large.length) return true;
    const choice = await _askReduce(large.map(f => _importPlan.get(f)));
    if (choice === null) return false;
    _lastReduceChoice = choice;
    if (choice !== 'keep') for (const f of large) _importPlan.get(f).maxPixels = Number(choice) * MP;
    return true;
}

async function _reduceImage(sourcePath, maxPixels) {
    const res = await fetch('/image-import/reduce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourcePath, maxPixels }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'reduce failed');
    return data;
}

/**
 * @param {File} file
 * @param {'image'|'video'|'audio'} mediaType — audio has no dimensions and no thumb;
 *        the server probes its duration instead (MPI-573).
 * @param {string} projectFolderPath
 * @param {string} projectId
 * @param {Object} [opts]
 * @param {string} [opts.filenamePrefix='imported'] - Filename prefix (e.g. 'snapshot') before _NNN.<ext>
 * @param {string} [opts.operation='imported'] - Sidecar operation field (e.g. 'snapshot')
 * @returns {Promise<{filePath: string, filename: string, itemId: string, thumbPath: string|null, thumbPathLg: string|null, proxyPath: string|null, wavePath: string|null, pixelDimensions: {w: number, h: number}, fps: number|null, duration: number|null, frameCount: number|null, hasAudio: boolean|null, gif: object|null}|null>}
 */
export async function uploadMediaFile(file, mediaType, projectFolderPath, projectId, opts = {}) {
    if (!projectFolderPath || !projectId) {
        clientLogger.warn('mediaUploadService', 'Missing project context — cannot save media');
        return null;
    }
    // Before the spinner card: a cancelled dialog must not flash one (MPI-943).
    if (mediaType === 'image' && !(await prepareImageImport([file]))) return null;
    // Announced here rather than from a drop handler because this function IS the
    // ingest path — gallery drop, PromptBox drop, snapshot and recorder all land
    // here, so one pair of events gives every surface its spinner card (MPI-671).
    // ponytail: fires for a 2 MB snapshot too, which flashes a card for an instant.
    // Gate on file.size if that flicker turns out to annoy.
    const tempId = crypto.randomUUID();
    Events.emit('media:import-started', { tempId, filename: file?.name || '', mediaType });
    try {
        // The file is already on disk — hand the server its path and let it copy.
        // Base64 caps import at ~75mb (the bodyParser limit) and past ~384MB
        // FileReader cannot even build the string (V8 max string length), which is
        // how a 474 MiB clip imported as nothing at all. MPI-670.
        let sourcePath = _sourcePathFor(file);
        let ext = file.name.split('.').pop() || (mediaType === 'image' ? 'png' : 'mp4');
        // A probed image already has its size from the header: measuring it here would
        // decode the whole file in the renderer, ~1 GB for a 16K photo (MPI-943).
        const plan = _importPlan.get(file);
        let dims = plan ? { w: plan.w, h: plan.h } : null;
        if (plan?.maxPixels) {
            const reduced = await _reduceImage(sourcePath, plan.maxPixels);
            sourcePath = reduced.path;
            dims = { w: reduced.w, h: reduced.h };
            ext = reduced.path.split('.').pop(); // a TIFF lands as PNG
        }
        const prefix = opts.filenamePrefix || 'imported';
        const filename = `${prefix}_001.${ext}`; // backend overrides sequence via autoSequence
        const itemId = crypto.randomUUID();
        const base64 = sourcePath ? null : await _fileToBase64(file);
        const { w: width, h: height } = dims || await measureMediaDimensions(file, mediaType);

        const res = await fetch(
            `/project-media/${projectId}/upload?folderPath=${encodeURIComponent(projectFolderPath)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename,
                    ...(sourcePath ? { sourcePath } : { base64Data: base64 }),
                    autoSequence: true,
                    itemId,
                    mediaType,
                    width,
                    height,
                    operation: opts.operation || undefined,
                }),
            }
        );
        if (!res.ok) throw new Error(`upload failed: ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'upload failed');
        const filePath = `/project-file?path=${encodeURIComponent(data.filePath)}`;
        return {
            filePath,
            filename: data.filename,
            itemId,
            thumbPath: data.thumbPath || null,
            thumbPathLg: data.thumbPathLg || null,
            proxyPath: data.proxyPath || null,
            // A video's trim-bar waveform (MPI-829); null for an image, and for a
            // silent clip, which is never owed one.
            wavePath: data.wavePath || null,
            // The server's size: an SVG lands as a PNG at a size of its choosing (MPI-933).
            pixelDimensions: data.pixelDimensions || { w: width, h: height },
            // Server-side video probe (null for images) — MPI-83 Bug 2.
            fps:        data.fps        ?? null,
            duration:   data.duration   ?? null,
            frameCount: data.frameCount ?? null,
            hasAudio:   data.hasAudio   ?? null,
            // A `.gif` import's frames store entry (MPI-768), so the live item
            // matches its sidecar before any reload (MPI-759).
            gif:        data.gif        ?? null,
        };
    } catch (e) {
        clientLogger.warn('mediaUploadService', 'Media save failed:', e);
        // Every caller treats a null return as "skip this file" and says nothing, so
        // without this the user sees an import silently do nothing at all (MPI-670).
        // `ui:danger` (toast), not `ui:error` (blocking dialog) — a batch drop of ten
        // files must not open ten modals.
        Events.emit('ui:danger', { message: `Could not import ${file?.name || 'media'}: ${e.message || e}` });
        return null;
    } finally {
        // In a `finally` so a failure clears the spinner card too — a card left
        // running beside the toast above would read as an import still in flight.
        Events.emit('media:import-settled', { tempId });
    }
}

function _fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(/** @type {string} */ (reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
