/**
 * gifJobs.js — MPI-830: the renderer half of the connector's GIF surface.
 *
 * `routes/connectorGif.js` is the contract; this is the disposable half, the
 * same split `agentDispatch.js` states for the generation relay. It lives in
 * its own module because that file's header says to keep the dispatcher dumb —
 * one job in, one result out — and because these four verbs need renderer-only
 * things a server route cannot reach:
 *
 * - **The gallery card.** The `/gif/*` routes write the `.gif` and its sidecar
 *   and stop. While a project is open this renderer owns `itemGroups` and
 *   `persistGroups` writes the whole array back on every save, so the group has
 *   to be created here (`addGroup` / `updateGroup`), exactly as the Gallery and
 *   History blocks do it.
 * - **The engine.** The cut-out's masks come from `runGifCutoutTrack()`, which
 *   dispatches through `getEngine()` — local or remote Pod, the renderer's
 *   choice.
 * - **`state.currentProject`.** Every verb runs in whatever project the app has
 *   open, like a submit does.
 *
 * Each handler takes the validated input and RETURNS a connector envelope;
 * `agentDispatch.js` reports it. That keeps this module free of job ids and
 * testable without the relay.
 *
 * The frame-list math is `gifTiming.js`'s `timingEdit`, the same pure functions
 * the Timing panel calls — not a second copy of "fps to delay".
 */

import { state } from '../state.js';
import { addGroup, updateGroup } from '../services/projectService.js';
import { createImageItem, createVideoItem, createItemGroup, appendToHistory } from '../data/projectModel.js';
import { timingEdit, toEntryOutput } from '../components/Organisms/MpiToolOptionsGifTiming/gifTiming.js';
import { stampDetectionCount } from '../utils/maskTextPrompt.js';
import { runGifCutoutTrack } from '../services/commandExecutor.js';
import { truncateCardName } from '../utils/displayHelpers.js';
import { clientLogger } from '../services/clientLogger.js';

/** `max_objects` in both cut-out graphs, and the count a bare name is stamped with. */
const OBJECT_SLOTS = 4;
/** `method` -> the universal op behind it. By colour is renderer canvas code, not an op. */
const CUTOUT_OPS = { background: 'gifCutoutBirefnet', name: 'gifCutoutSam3' };

/** A coded failure a handler can throw from anywhere in its chain. */
class JobError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

const _fail = (code, message) => ({ ok: false, error: { code, message } });

/** The open project, or a coded failure — every verb needs one. */
function _project() {
    const project = state.currentProject;
    if (!project?.folderPath) {
        throw new JobError('NO_PROJECT', 'No project is open in Vision. Open one first, then send this request again.');
    }
    return project;
}

/** Find a card's currently-shown item by ITEM id, anywhere in the open project. */
function _findItem(itemId) {
    for (const group of state.currentProject?.itemGroups || []) {
        const item = (group.history || []).find(h => h?.id === itemId);
        if (item) return { group, item };
    }
    throw new JobError('UNKNOWN_ITEM',
        `No item "${itemId}" in the open project "${state.currentProject?.name}". Open the project it belongs to first.`);
}

/**
 * The same, but it must be a GIF.
 *
 * It CANNOT be `gif.frames` that decides. A GIF imported before MPI-768 (or
 * before this app ever opened its workspace) has no frames store at all - that
 * is exactly what `/gif/ensure-frames` is for - so testing frames here would
 * refuse every legacy GIF as "not a GIF" and leave the extraction unreachable.
 * The file is the truth; the store is filled on demand below.
 */
function _findGif(itemId) {
    const found = _findItem(itemId);
    const isGif = found.item.gif?.frames?.length
        || /\.gif$/i.test(found.item.filePath || '');
    if (!isGif) {
        throw new JobError('NOT_A_GIF', `Item "${itemId}" is not a GIF.`);
    }
    return found;
}

/** POST one of the `/gif/*` routes. Their envelope is `{ success, error }`, not the connector's. */
async function _post(url, body) {
    let data;
    try {
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        data = await resp.json();
    } catch (err) {
        throw new JobError('RUNTIME_ERROR', `${url} did not answer: ${err?.message || err}`);
    }
    if (!data?.success) throw new JobError('RUNTIME_ERROR', `${url}: ${data?.error || 'failed'}`);
    return data;
}

/** A frame list the `/gif/*` routes accept — they take `{hash, delay}` and nothing else. */
const _frameRefs = (frames) => frames.map(f => ({ hash: f.hash, delay: f.delay }));

/**
 * Land a raw sidecar descriptor as a NEW card, the `MpiGalleryBlock` make-gif path.
 * `factory` differs only because GIF to Video lands a video.
 */
async function _landNewCard(raw, { factory = createImageItem, type = 'image' } = {}) {
    const item = factory({
        id: raw.id,
        filePath: raw.filePath,
        thumbPath: raw.thumbPath ?? null,
        operation: raw.operation || null,
        displayName: truncateCardName(raw.displayName || ''),
        pixelDimensions: raw.pixelDimensions || { w: 0, h: 0 },
        ...(type === 'image' ? { gif: raw.gif || null } : { duration: raw.duration || 0, fps: raw.fps || 0 }),
    });
    const group = appendToHistory(createItemGroup(type, { name: item.displayName }), item);
    await addGroup(group);
    return { item, group };
}

/**
 * Land a raw descriptor as a new HISTORY ENTRY on the card it came from — what
 * every workspace tool's Apply does, so a caller's edits stack on one card
 * instead of littering the gallery.
 */
async function _landEntry(sourceGroup, raw) {
    const item = createImageItem({
        id: raw.id,
        filePath: raw.filePath,
        thumbPath: raw.thumbPath ?? null,
        operation: raw.operation || null,
        displayName: truncateCardName(raw.displayName || ''),
        pixelDimensions: raw.pixelDimensions || { w: 0, h: 0 },
        gif: raw.gif || null,
    });
    const group = appendToHistory(sourceGroup, item);
    await updateGroup(group);
    return { item, group };
}

/** The connector's success shape. One place, so all four verbs answer alike. */
const _done = ({ item, group }) => ({
    ok: true,
    output: {
        itemId: item.id,
        groupId: group.id,
        type: item.type,
        filePath: item.filePath,
        pixelDimensions: item.pixelDimensions,
        ...(item.gif ? { frames: item.gif.frames?.length ?? 0, loop: item.gif.loop ?? 0 } : {}),
    },
});

/** Extract a legacy GIF's frames on first touch; a no-op once `gif.frames` exists. */
async function _ensureFrames(folderPath, itemId, item) {
    if (item.gif?.frames?.length) return item.gif;
    const data = await _post('/gif/ensure-frames', { folderPath, itemId });
    if (!data.gif?.frames?.length) {
        throw new JobError('NOT_A_GIF', `Item "${itemId}" has no frames, and none could be extracted from it.`);
    }
    return data.gif;
}

// ── The four verbs ────────────────────────────────────────────────────────────

/**
 * `gif.make` — a NEW GIF card, from two or more still cards (`/gif/make`) or
 * from a clip of one video card (`/gif/maker`).
 */
async function makeGif(input) {
    const project = _project();

    if (Array.isArray(input.itemIds)) {
        for (const id of input.itemIds) _findItem(id); // name the bad id, not "no eligible items"
        const data = await _post('/gif/make', { folderPath: project.folderPath, itemIds: input.itemIds });
        return _done(await _landNewCard(data.item));
    }

    const { item } = _findItem(input.videoItemId);
    if (item.type !== 'video') {
        throw new JobError('WRONG_TYPE', `Item "${input.videoItemId}" is a ${item.type}, not a video. GIF Maker takes a video card.`);
    }
    const data = await _post('/gif/maker', {
        folderPath: project.folderPath,
        sourcePath: item.filePath,
        fps: input.fps,
        ...(input.sizePreset !== undefined ? { sizePreset: input.sizePreset } : {}),
        ...(input.loop !== undefined ? { loop: input.loop } : {}),
        ...(input.trimIn !== undefined ? { trimIn: input.trimIn, trimOut: input.trimOut } : {}),
    });
    return _done(await _landNewCard(data.item));
}

/**
 * `gif.edit` — a new entry on the same card.
 *
 * The frame-list edits (trim, fps, loop, output) are applied here with
 * `timingEdit`, then ONE route lands them: `/gif/crop`, `/gif/resize`, or
 * `/gif/entry` when the call changes no pixels. Crop and resize each write a
 * whole new set of frame files, so a call may ask for only one of them —
 * chaining both would land an intermediate entry nothing references.
 */
async function editGif(input) {
    const project = _project();
    const { group, item } = _findGif(input.itemId);
    const gif = await _ensureFrames(project.folderPath, input.itemId, item);

    if (input.crop && input.resize) {
        throw new JobError('BAD_REQUEST', 'Send crop or resize, not both — each rewrites every frame, so one call can only do one. Send the second as its own call.');
    }

    let frames = gif.frames;
    let loop = gif.loop ?? 0;
    let output = gif.output ?? null;

    if (input.trim) frames = timingEdit('trim', frames, input.trim).frames;
    if (input.fps !== undefined) frames = timingEdit('speed', frames, { fps: input.fps }).frames;
    if (input.loop !== undefined) ({ loop } = timingEdit('loop', frames, { loop: input.loop }));
    if (input.output) {
        // `toEntryOutput` carries the transparency toggle in `edgeColour` itself
        // (docs/gif.md), so the caller's `null` is the opaque build.
        output = toEntryOutput({ ...output, ...input.output, transparent: input.output.edgeColour != null });
    }
    if (!frames.length) throw new JobError('BAD_REQUEST', 'That trim keeps no frames.');

    const common = {
        folderPath: project.folderPath,
        frames: _frameRefs(frames),
        loop,
        ...(output ? { output } : {}),
        sourceItemId: item.id,
        sourceGroupId: group.id,
    };

    let data;
    if (input.crop) {
        const { x, y, width, height, fill, outWidth, outHeight } = input.crop;
        data = await _post('/gif/crop', {
            ...common, x, y, w: width, h: height,
            ...(fill !== undefined ? { fill } : {}),
            ...(outWidth && outHeight ? { outW: outWidth, outH: outHeight } : {}),
        });
    } else if (input.resize) {
        data = await _post('/gif/resize', { ...common, width: input.resize.width, height: input.resize.height });
    } else {
        data = await _post('/gif/entry', { ...common, mode: 'new' });
    }
    return _done(await _landEntry(group, data.item));
}

/**
 * `gif.cutout` — mask every frame and cut the subject out into a new,
 * always-transparent entry.
 *
 * Three steps, the same three the Cut-out panel runs: encode the temp track
 * source (one video frame per GIF frame), run the graph through the engine, and
 * bake the masks into each frame's alpha. The masks are white = KEEP the whole
 * way; the workspace's tint flip is display only and never leaves the viewer.
 */
async function cutoutGif(input) {
    const project = _project();
    const { group, item } = _findGif(input.itemId);
    const gif = await _ensureFrames(project.folderPath, input.itemId, item);
    const frames = _frameRefs(gif.frames);

    const source = await _post('/gif-cutout/source', { folderPath: project.folderPath, frames });

    const op = CUTOUT_OPS[input.method];
    // A bare name finds ONE object (masking-sam3.md's `name:N` trap), and there is
    // no way for a caller to read the numbered preview and pick indices, so every
    // tracked object is kept.
    const textPrompt = op === 'gifCutoutSam3' ? stampDetectionCount(input.prompt, OBJECT_SLOTS) : undefined;

    const masks = await new Promise((resolve, reject) => {
        const exec = runGifCutoutTrack({ op, videoPath: source.videoPath, textPrompt, objectIndices: '' });
        let landed = null;
        exec.onMasks = (urls) => { landed = urls; };
        exec.onError = (err) => reject(new JobError('ENGINE_ERROR', err?.message || 'The cut-out graph failed.'));
        exec.onDone = () => {
            if (landed?.length) return resolve(landed);
            reject(new JobError('ENGINE_ERROR', 'The cut-out graph returned no masks.'));
        };
    });

    if (masks.length !== frames.length) {
        clientLogger.warn('connector', `gif.cutout: ${masks.length} masks for ${frames.length} frames`);
        throw new JobError('ENGINE_ERROR', `The engine returned ${masks.length} masks for ${frames.length} frames.`);
    }

    const data = await _post('/gif-cutout/apply', {
        folderPath: project.folderPath,
        frames,
        masks,
        loop: gif.loop ?? 0,
        ...(gif.output ? { output: gif.output } : {}),
        ...(input.adjust ? { adjust: input.adjust } : {}),
        ...(input.invert !== undefined ? { invert: input.invert } : {}),
        settings: { method: input.method, ...(input.prompt ? { prompt: input.prompt } : {}) },
        sourceItemId: item.id,
        sourceGroupId: group.id,
    });
    return _done(await _landEntry(group, data.item));
}

/**
 * `gif.to-video` — a new VIDEO card beside the GIF, which is left alone.
 * `background` fills what a transparent GIF leaves clear: h264 carries no alpha.
 */
async function gifToVideo(input) {
    const project = _project();
    const { group, item } = _findGif(input.itemId);
    const gif = await _ensureFrames(project.folderPath, input.itemId, item);

    const data = await _post('/gif/to-video', {
        folderPath: project.folderPath,
        frames: _frameRefs(gif.frames),
        ...(input.background !== undefined ? { background: input.background } : {}),
        itemId: item.id,
        groupId: group.id,
    });
    return _done(await _landNewCard(data.item, { factory: createVideoItem, type: 'video' }));
}

/** Capability -> handler. `agentDispatch.js` adapts these onto the job relay. */
export const GIF_HANDLERS = {
    'gif.make': makeGif,
    'gif.edit': editGif,
    'gif.cutout': cutoutGif,
    'gif.to-video': gifToVideo,
};

/**
 * Run one verb and answer in the connector's envelope. A `JobError` is the
 * expected failure and carries its own code; anything else is a real bug and
 * reaches the caller as `RUNTIME_ERROR` rather than as a hung job.
 */
export async function runGifJob(capability, input) {
    try {
        return await GIF_HANDLERS[capability](input || {});
    } catch (err) {
        if (err instanceof JobError) return _fail(err.code, err.message);
        clientLogger.error('connector', `${capability} threw`, err);
        return _fail('RUNTIME_ERROR', err?.message || 'The job threw.');
    }
}
