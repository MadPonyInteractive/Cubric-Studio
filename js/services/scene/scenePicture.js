// ── The scene's picture doors (MPI-623) ──────────────────────────────────────────
// What the 360 player's Take picture (panoVideo.js) and Render path (scenePathVideo.js) share:
// the pano's style asked once a scene, Klein jobs that land no card, the Reinhard colour lock, and
// `appIo`, the app's doors (a test hands its own). The Scene panel's own Take picture / Build here
// (Klein fills lifted into the scene as layers) went with P3, 2026-10-10: the fills read as seams.

import { renderPano } from './sceneViewer.js';

/** What the describer is asked about the pano: its style for the path video's prompt.
 *  Content-free: a model plants a prompt's nouns. */
export const STYLE_ASK = 'Describe only the visual style of this image in one sentence: the medium and rendering '
    + 'technique, the shading, the colour palette and the level of detail. Do not name or describe any objects, '
    + 'places, buildings or people.';
/** The clean-up instruction (shots.py POLISH), on a 360 player picture. */
export const POLISH = 'Clean up this image: repair any smeared, stretched, blurry, torn or broken areas so every object is '
    + 'whole and sharp. Keep everything else exactly the same - the same composition, objects, style, '
    + 'colours and lighting.';

// ponytail: in memory, so each app start asks once per scene again; keep it in the manifest if that shows.
const styles = new Map(); // scenePath -> the describer's style phrase

/** The pano's style, asked once per scene of the describer picked in Remote > Language Models
 *  (`describeImage`). A failure stops the job: a video in the wrong style is what this prevents. */
export async function sceneStyle(io, sceneItem, onStep) {
    if (styles.has(sceneItem.scenePath)) return styles.get(sceneItem.scenePath);
    onStep('style');
    const r = await io.describe({ imagePath: sceneItem.filePath, question: STYLE_ASK });
    if (r?.cancelled) throw new Error('cancelled');
    const text = String(r?.text || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();
    if (!r?.ok || !text) {
        const why = String(r?.error || 'it gave no answer').trim().replace(/[.!?]$/, '');
        throw new Error(`the scene's style could not be read (${why}). Check Remote > Language Models`);
    }
    styles.set(sceneItem.scenePath, text);
    return text;
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

// ── The app's doors (a test hands its own) ──────────────────────────────────────────────

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
    const [{ enqueueGeneration }, { uploadMediaFile }, { getModelById }, model, { addGroup }, { resolveMediaUrl }, { describeImage }, { Events }] = await Promise.all([
        import('../generationService.js'), import('../mediaUploadService.js'),
        import('../../data/modelRegistry.js'), import('../../data/projectModel.js'), import('../projectService.js'),
        import('../../utils/mediaActions.js'), import('../llmService.js'), import('../../events.js'),
    ]);
    const canvasOf = (w, h) => new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true });
    return {
        renderPano, // a path video frame (scenePathVideo.js)
        enqueue: enqueueGeneration,
        describe: describeImage, // the describer picked in Remote > Language Models
        post: postJson,
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
        /** A 360 player's picture (panoVideo.js) as a NEW image card, its pose on item + sidecar. */
        async savePictureCard(project, blob, { w, h }, scenePose) {
            const file = new File([blob], 'scene_picture.png', { type: 'image/png' });
            const up = await uploadMediaFile(file, 'image', project.folderPath, project.id, { filenamePrefix: 'scene', operation: 'scenePicture' });
            if (!up) throw new Error('the picture could not be saved');
            const entry = model.createImageItem({
                id: up.itemId, filePath: up.filePath, operation: 'scenePicture',
                pixelDimensions: up.pixelDimensions || { w, h }, scenePose,
                ...(up.thumbPath ? { thumbPath: up.thumbPath } : {}),
                ...(up.thumbPathLg ? { thumbPathLg: up.thumbPathLg } : {}),
            });
            const group = model.appendToHistory(model.createItemGroup('image', { name: up.filename.replace(/\.[^.]+$/, '') }), entry);
            await addGroup(group); // persists it and repaints the gallery
            await postJson(`/project-media/${project.id}/update-meta?folderPath=${encodeURIComponent(project.folderPath)}`, { itemId: entry.id, updates: { scenePose } });
            Events.emit('project:stats-dirty');
            return { group, entry };
        },
    };
}

/** One Klein job with no card of its own; resolves its result item. */
export function kleinJob(io, operation, url, positive) {
    return new Promise((resolve, reject) => {
        const started = io.enqueue(
            {
                operation, model: io.klein, positive, negative: '',
                mediaItems: [{ url, mediaType: 'image', role: 'inputImage', source: 'history' }],
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

/** A file in the project's preview assets (no card): a rendered frame. */
export const placeAsset = (io, project, dataUrl, ext) => io.post(
    `/project-media/${project.id}/place-preview-asset?folderPath=${encodeURIComponent(project.folderPath)}`, { dataUrl, ext });
