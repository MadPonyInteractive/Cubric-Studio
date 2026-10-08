// ── Take picture (MPI-623, plan Design 5 / A5) ─────────────────────────────────
// One press, three engine jobs: the viewer's frame with rule C holes -> Klein `inpaint` fills
// them -> `sceneLift` gives the fill a depth and it joins the scene as a layer -> Klein
// `kleinEdit` cleans the whole frame (clean-up B, always on) -> a Reinhard colour lock to
// the pre-clean frame -> one new history entry of the scene card carrying its `scenePose`.
// Every Klein job runs with `deferCommit` (no card of its own; Cutout's precedent), the lift
// through `runSceneOp` (a depth-only run is not a generation). Prompts are the spike's
// (`D:\WORK\MPI-623-spike\single_shot\chain.py`, `shots.py`). Depth of field waits on spike 0c.
// Build here runs the same fill over six views round the camera, layers only (plan 0b).

import { pictureSize, renderPicture, loadLayer, PITCH_MAX } from './sceneViewer.js';

/** The fill instruction: style-free, so it works on any pano (chain.py GENERIC). */
export const GENERIC = 'Fill the black empty areas so the picture is complete and no black remains. Continue the scene that '
    + 'surrounds each area: extend the walls, ground, sky, plants and objects that are already there, and '
    + 'repair any broken or smeared edges. Match the existing image exactly - the same style, rendering, '
    + 'materials, lighting, colours, perspective and level of detail - so the filled areas cannot be told apart.';
/** Most of the frame seen from behind = the camera stands inside something. GENERIC there painted
 *  the OUTSIDE into the room (shots.py); this is the spike's INTERIOR with its cottage nouns taken
 *  out, because Klein plants a prompt's nouns in every hole.
 *  ponytail: unproven on a real scene until Take picture's eye check. */
export const INTERIOR = 'This picture is taken from inside a room. The bright areas are what is outside the room, seen '
    + 'through its openings - keep them exactly as they are. Fill all the black areas with the inside of the room '
    + 'around the camera: the inner faces of its walls, the frames around the openings, the ceiling and the floor, '
    + 'in the soft shade of an indoor room. Match the existing image exactly - the same style, rendering, materials, '
    + 'colours and level of detail.';
/** Clean-up B's instruction (shots.py POLISH), on the whole filled frame. */
export const POLISH = 'Clean up this image: repair any smeared, stretched, blurry, torn or broken areas so every object is '
    + 'whole and sharp. Keep everything else exactly the same - the same composition, objects, style, '
    + 'colours and lighting.';

/** Most of the frame seen from behind: the camera stands inside something. */
const isInterior = (backFrac) => backFrac > 0.5;

/** The fill prompt: INTERIOR when most of the frame is seen from behind, plus the user's line. */
export function fillPrompt(backFrac, fillLine) {
    const line = String(fillLine || '').trim().replace(/[.\s]+$/, '');
    return (isInterior(backFrac) ? INTERIOR : GENERIC) + (line ? ` In the large empty areas: ${line}.` : '');
}

/** The lift's known depth. Inside, the walls seen from behind (negative z) are what the room is
 *  fitted to while the fill replaces them. Outside, a back face is an object's far side and the
 *  fill paints what lies beyond it, so it only counts as a hole (0). */
function knownDepth(z, backFrac) {
    return isInterior(backFrac) ? z : z.map(v => Math.max(v, 0));
}

// ── Reinhard colour lock in CIELAB (D65), the spike's color_lock.py "A" ──────────────────────
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gam = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const E = 216 / 24389, K = 24389 / 27, WHITE = [0.95047, 1, 1.08883];
const f = (t) => (t > E ? Math.cbrt(t) : (K * t + 16) / 116);
const fi = (t) => (t ** 3 > E ? t ** 3 : (116 * t - 16) / K);

function toLab(rgba) {
    const n = rgba.length / 4, lab = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const [r, g, b] = [0, 1, 2].map(c => lin(rgba[i * 4 + c] / 255));
        const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE[0]);
        const y = f(0.2126729 * r + 0.7151522 * g + 0.0721750 * b);
        const z = f((0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / WHITE[2]);
        lab.set([116 * y - 16, 500 * (x - y), 200 * (y - z)], i * 3);
    }
    return lab;
}

function fromLab(lab) {
    const n = lab.length / 3, rgba = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
        const fy = (lab[i * 3] + 16) / 116, fx = fy + lab[i * 3 + 1] / 500, fz = fy - lab[i * 3 + 2] / 200;
        const x = fi(fx) * WHITE[0], y = fi(fy), z = fi(fz) * WHITE[2];
        const rgb = [
            3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
            -0.9692660 * x + 1.8760108 * y + 0.0415560 * z,
            0.0556434 * x - 0.2040259 * y + 1.0572252 * z,
        ];
        rgb.forEach((v, c) => { rgba[i * 4 + c] = Math.round(gam(Math.min(Math.max(v, 0), 1)) * 255); });
        rgba[i * 4 + 3] = 255;
    }
    return rgba;
}

/**
 * Give `edit` the colour statistics of `src` (same size, RGBA): per LAB channel, edit's
 * values re-scaled to src's mean and standard deviation. Klein's clean-up drifts the
 * colours; this pins them to the frame the viewer showed.
 */
export function colorLock(edit, src) {
    const e = toLab(edit), s = toLab(src), n = e.length / 3;
    const stats = (lab, c) => {
        let m = 0, v = 0;
        for (let i = 0; i < n; i++) m += lab[i * 3 + c];
        m /= n;
        for (let i = 0; i < n; i++) v += (lab[i * 3 + c] - m) ** 2;
        return [m, Math.sqrt(v / n)];
    };
    for (let c = 0; c < 3; c++) {
        const [me, se] = stats(e, c), [ms, ss] = stats(s, c);
        for (let i = 0; i < n; i++) e[i * 3 + c] = (e[i * 3 + c] - me) / (se + 1e-6) * ss + ms;
    }
    return fromLab(e);
}

// ── The doors Take picture goes through (a test hands its own) ───────────────────────────

const pathOf = (projectFileUrl) => new URLSearchParams(String(projectFileUrl).split('?')[1] || '').get('path');

async function postJson(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) throw new Error(data.error || `${res.status} on ${url}`);
    return data;
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
});

/** The app's own doors, loaded on first use so this module imports in node for its test. */
export async function appIo() {
    const [{ enqueueGeneration }, { runSceneOp }, { uploadMediaFile }, { getModelById }, model, { updateGroup }, { state }, { resolveMediaUrl }] = await Promise.all([
        import('../generationService.js'), import('../commandExecutor.js'), import('../mediaUploadService.js'),
        import('../../data/modelRegistry.js'), import('../../data/projectModel.js'), import('../projectService.js'),
        import('../../state.js'), import('../../utils/mediaActions.js'),
    ]);
    const canvasOf = (w, h) => new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
    return {
        render: renderPicture,
        enqueue: enqueueGeneration,
        runSceneOp,
        resolveMediaUrl,
        post: postJson,
        loadLayer,
        klein: getModelById('klein-9b'),
        async encodePng(rgba, w, h) {
            const g = canvasOf(w, h);
            g.putImageData(new ImageData(rgba, w, h), 0, 0);
            return g.canvas.convertToBlob({ type: 'image/png' });
        },
        blobToDataUrl,
        /** A picture's pixels at exactly `w` x `h` (Klein's edit can come back another size). */
        async pixelsAt(url, w, h) {
            const bmp = await createImageBitmap(await (await fetch(resolveMediaUrl(url))).blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
            const g = canvasOf(w, h);
            g.imageSmoothingQuality = 'high';
            g.drawImage(bmp, 0, 0, w, h);
            bmp.close();
            return g.getImageData(0, 0, w, h).data;
        },
        /** The finished picture as a new history entry of the card, its pose on item + sidecar (A7). */
        async savePicture(project, group, blob, { w, h }, scenePose) {
            const file = new File([blob], 'scene_picture.png', { type: 'image/png' });
            const up = await uploadMediaFile(file, 'image', project.folderPath, project.id, { filenamePrefix: 'scene', operation: 'scenePicture' });
            if (!up) throw new Error('the picture could not be saved');
            const entry = model.createImageItem({
                id: up.itemId, filePath: up.filePath, operation: 'scenePicture',
                displayName: `Picture ${scenePose.mm} mm ${scenePose.aspect}`,
                pixelDimensions: up.pixelDimensions || { w, h }, scenePose,
                ...(up.thumbPath ? { thumbPath: up.thumbPath } : {}),
                ...(up.thumbPathLg ? { thumbPathLg: up.thumbPathLg } : {}),
            });
            const live = state.currentProject?.itemGroups?.find(g => g.id === group.id) || group;
            const next = model.appendToHistory(live, entry);
            await updateGroup(next);
            await postJson(`/project-media/${project.id}/update-meta?folderPath=${encodeURIComponent(project.folderPath)}`,
                { itemId: entry.id, updates: { scenePose, displayName: entry.displayName } }); // the upload named it scene_NNN
            return { group: next, entry };
        },
    };
}

/** One Klein job with no card of its own; resolves its result item. */
function kleinJob(io, operation, url, positive, maskDataUrl) {
    return new Promise((resolve, reject) => {
        const started = io.enqueue(
            {
                operation, model: io.klein, positive, negative: '',
                mediaItems: [{ url, mediaType: 'image', role: 'inputImage', source: 'history' }],
                ...(maskDataUrl ? { maskDataUrl } : {}),
            },
            {
                onComplete: ({ item } = {}) => (item?.filePath ? resolve(item) : reject(new Error(`${operation} returned no picture`))),
                onError: (err) => reject(err instanceof Error ? err : new Error(String(err?.message || err))),
                onCancel: () => reject(new Error('cancelled')),
            },
            // No `existingGroup`: the gallery branch is the only one `deferCommit` is honoured in.
            { deferCommit: true },
        );
        if (!started) reject(new Error(`${operation} did not start`));
    });
}

function liftJob(io, payload) {
    return new Promise((resolve, reject) => {
        const exec = io.runSceneOp({ op: 'sceneLift', ...payload });
        exec.onError = reject;
        exec.onResult = ({ depthUrl }) => (depthUrl ? resolve(depthUrl) : reject(new Error('sceneLift returned no depth')));
    });
}

/** A file in the project's preview assets (no card): a rendered frame or a known-depth `.f32`. */
const placeAsset = (io, project, dataUrl, ext) => io.post(
    `/project-media/${project.id}/place-preview-asset?folderPath=${encodeURIComponent(project.folderPath)}`, { dataUrl, ext });

/** A rendered shot's holes filled and placed in the scene: Klein inpaint -> sceneLift -> a layer
 *  in the manifest, meshed into the live view. `frame` = the shot's PNG as a preview asset. */
async function fillLayer({ project, sceneItem, view, pose, fillLine, onStep }, shot, frame, io) {
    onStep('fill');
    const mask = await io.blobToDataUrl(await io.encodePng(shot.mask, shot.w, shot.h));
    const fill = await kleinJob(io, 'inpaint', frame.filePath, fillPrompt(shot.backFrac, fillLine), mask);
    onStep('lift');
    const known = await placeAsset(io, project, await io.blobToDataUrl(new Blob([knownDepth(shot.z, shot.backFrac).buffer], { type: 'application/octet-stream' })), '.f32');
    const fovX = 2 * Math.atan(18 / pose.mm) * 180 / Math.PI;
    const depthUrl = await liftJob(io, { imagePath: io.resolveMediaUrl(fill.filePath), knownDepthPath: known.absPath, fovX });
    const saved = await io.post(`/project-media/${project.id}/scene-layer?folderPath=${encodeURIComponent(project.folderPath)}`,
        { itemId: sceneItem.id, imagePath: pathOf(fill.filePath), depthUrl, camera: shot.record });
    view.addLayer(await io.loadLayer(sceneItem.scenePath, saved.record));
    return { layer: saved.record, fillPath: fill.filePath };
}

/** Build here's lens: ~97 degrees across a square, so the six views overlap. */
export const BUILD_MM = 16;

/**
 * Build here's six views from `pose.pos`: the way the camera faces first, then right, behind,
 * left, up, down. Up and down stop at `PITCH_MAX` - `applyPose` has no right vector straight
 * up - and the lens's overlap covers the 1.2 degrees that leaves.
 */
export function buildPoses({ pos, yaw }) {
    const around = [0, 1, 2, 3].map(k => ({ yaw: yaw + k * Math.PI / 2, pitch: 0 }));
    return [...around, { yaw, pitch: PITCH_MAX }, { yaw, pitch: -PITCH_MAX }]
        .map(p => ({ pos: [...pos], roll: 0, mm: BUILD_MM, ...p }));
}

/**
 * Build here (plan 0b): fill the space round the camera into the scene before pictures are
 * taken in it. Each of `buildPoses` in turn, so each view starts from the ones before it:
 * render -> Klein inpaint -> lift -> a layer, as Take picture's fill. No clean-up and no
 * history entry: the layers are the result. A view with no holes is skipped; `signal` stops
 * the build before the next view (the running fill finishes).
 * @param {{ project: Object, sceneItem: Object, view: Object, renderer: Object, pose: Object,
 *   fillLine?: string, signal?: AbortSignal, onStep?: (step: string, at: { view: number, of: number }) => void }} ctx
 * @param {Object} io  `appIo()`, or a test's stand-ins
 * @returns {Promise<Object[]>} the layer records added, in order
 */
export async function buildHere({ project, sceneItem, view, renderer, pose, fillLine = '', signal, onStep = () => {} }, io) {
    const poses = buildPoses(pose), size = pictureSize('1:1'), layers = [];
    for (const [i, p] of poses.entries()) {
        if (signal?.aborted) throw new Error('cancelled');
        const at = { view: i + 1, of: poses.length }, step = (s) => onStep(s, at);
        step('render');
        const shot = io.render(view, renderer, p, size);
        if (shot.holeFrac === 0) continue;
        const frame = await placeAsset(io, project, await io.blobToDataUrl(await io.encodePng(shot.rgba, shot.w, shot.h)), '.png');
        layers.push((await fillLayer({ project, sceneItem, view, pose: p, fillLine, onStep: step }, shot, frame, io)).layer);
    }
    return layers;
}

/**
 * Take the picture `pose` frames at `aspect`.
 * @param {{ project: Object, group: Object, sceneItem: Object, view: Object, renderer: Object,
 *   pose: Object, aspect: string, fillLine?: string, onStep?: (step: string) => void }} ctx
 *   `view` = `createSceneView(...)`; `sceneItem` = the card's item carrying `scenePath`.
 * @param {Object} io  `appIo()`, or a test's stand-ins
 * @returns {Promise<{ group: Object, entry: Object, layer: Object|null }>}
 */
export async function takePicture({ project, group, sceneItem, view, renderer, pose, aspect, fillLine = '', onStep = () => {} }, io) {
    const size = pictureSize(aspect);
    onStep('render');
    const shot = io.render(view, renderer, pose, size);
    const frame = await placeAsset(io, project, await io.blobToDataUrl(await io.encodePng(shot.rgba, shot.w, shot.h)), '.png');
    let base = frame.filePath, layer = null;
    if (shot.holeFrac > 0) {
        ({ layer, fillPath: base } = await fillLayer({ project, sceneItem, view, pose, fillLine, onStep }, shot, frame, io));
    }
    onStep('clean');
    const cleaned = await kleinJob(io, 'kleinEdit', base, POLISH);
    const [editPx, basePx] = await Promise.all([io.pixelsAt(cleaned.filePath, shot.w, shot.h), io.pixelsAt(base, shot.w, shot.h)]);
    const picture = await io.encodePng(colorLock(editPx, basePx), shot.w, shot.h);
    onStep('save');
    const scenePose = { ...pose, pos: [...pose.pos], aspect, fillLine: String(fillLine || '').trim() };
    const saved = await io.savePicture(project, group, picture, size, scenePose);
    return { ...saved, layer };
}
