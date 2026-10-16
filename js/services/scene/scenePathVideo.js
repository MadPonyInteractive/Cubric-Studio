/**
 * A camera path rendered as a 360 video (MPI-623 P2). The app renders the guide: each frame of
 * the path (`pathFrames`) as the 360 frame the scene shows there (`renderPano`; frame 0 is the pano
 * itself, `turnPano`), stacked over its holes (white = Wan invents here). One guide video crosses to the engine (`frames-to-video`),
 * where Wan 2.1 I2V + the Matrix-3D 360 LoRA keep what is known and invent the rest
 * (`scenePathVideo`, scene_path_video.json). The result lands as a video card.
 * Measured on a 4060 Ti (validation.md § Paths P2): the guide ~35 s, Wan ~28 min.
 */

import { pathFrames, FRAMES } from './scenePath.js';
import { sceneStyle, placeAsset } from './scenePicture.js';
import { sceneFileUrl, PANO_FRAME } from './sceneViewer.js';
import { gpuGenSecs } from '../../data/runpodGpuSpecs.js';

// Render path's measured runs, in seconds: an RTX 5090 Pod 420 s from the guide reaching the engine to
// the card (validation.md § Render path on RunPod), an RTX 4060 Ti 1810 s click to card (§ Paths P2
// LIVE), both 81 frames. Any other card scales the 5090 run by the GPU picker's measured seconds per
// image (GPU_GEN_SECS); that scale put the 4060 Ti (on the A4000's row) at 1735 s: 4% off. A shorter
// clip (frameCount) scales by (frames / 81)^1.5: 49 frames took 805 s of Wan against ~1700 s for 81.
const PATH_RUNS = new Map([['NVIDIA GeForce RTX 5090', 420], ['NVIDIA GeForce RTX 4060 Ti', 1810]]);
const PATH_ANCHOR = 'NVIDIA GeForce RTX 5090';

/** Minutes Render path takes on `gpu` (a RunPod GPU id or a local nvidia-smi name) for a `frames`-frame clip,
 *  or null when nobody measured that card. */
export function pathEtaMin(gpu, frames = FRAMES) {
    const secs = PATH_RUNS.get(gpu) ?? (gpuGenSecs(gpu) && (PATH_RUNS.get(PATH_ANCHOR) * gpuGenSecs(gpu)) / gpuGenSecs(PATH_ANCHOR));
    return secs ? Math.max(1, Math.round((secs * (frames / FRAMES) ** 1.5) / 60)) : null;
}

/** Matrix-3D's own prompt opening; the scene's style and the user's line follow. */
export const PATH_LINE = 'A high quality panoramic video. The camera moves forward through the scene.';
export const pathPrompt = (style, line) => [PATH_LINE, style, line].filter(Boolean).join(' ');

/**
 * The pano turned to face `yaw` (`stitchPano`'s layout: column u looks along lon(u) + yaw), linear
 * between columns, wrapping at the seam. Frame 0 stands where the pano was shot, so the pano IS its
 * guide: the scene's render there has holes a few pixels wide along its depth cuts, and Wan's mask
 * (MpiWanMaskedVideo, area-pooled to 8 px cells, a cell under half hole counts as known) kept their
 * black as thin outlines on frame 0.
 */
export function turnPano(rgba, w, h, yaw) {
    const out = new Uint8ClampedArray(rgba.length), shift = (yaw / (2 * Math.PI)) * w;
    for (let u = 0; u < w; u++) {
        const x = u + shift, x0 = Math.floor(x), t = x - x0, a = (((x0 % w) + w) % w) * 4, b = (((x0 + 1) % w + w) % w) * 4;
        for (let v = 0, r = 0; v < h; v++, r += w * 4) {
            for (let c = 0; c < 4; c++) out[r + u * 4 + c] = Math.round(rgba[r + a + c] * (1 - t) + rgba[r + b + c] * t);
        }
    }
    return out;
}

/** Frame 0 of a path: the scene's pano turned to the path's heading, nothing to invent. */
async function panoFrame(io, sceneItem, { yaw }, { w, h } = PANO_FRAME) {
    const mask = new Uint8ClampedArray(w * h * 4);
    for (let q = 3; q < mask.length; q += 4) mask[q] = 255;
    return { w, h, rgba: turnPano(await io.pixelsAt(sceneFileUrl(sceneItem.scenePath, 'pano.png'), w, h), w, h, yaw), mask };
}

/** A guide frame over its holes: one picture twice as tall, which the graph crops apart. */
export function stackFrame({ w, h, rgba, mask }) {
    const out = new Uint8ClampedArray(w * h * 8);
    out.set(rgba);
    out.set(mask, w * h * 4);
    return { w, h: 2 * h, rgba: out };
}

/**
 * Render `points` (a camera path, `scenePath.js`) as a `frames`-frame 360 video card in `project`
 * (`frameCount`: a short path gets fewer).
 * `onStep(step, at)`: 'style', 'guide' ({ frame, of }), 'upload', 'wan' (the engine has it).
 * @returns {Promise<Object>} the landed video item
 */
// The paths whose video is still on its way. The scene frees its button once Wan has the guide, so
// a different path can queue behind this one; the SAME path again is refused (code 'rendering').
const rendering = new Set();

export async function renderPath({ project, sceneItem, view, renderer, points, frames: n = FRAMES, fillLine = '', signal, onStep = () => {} }, io) {
    const key = JSON.stringify([sceneItem?.scenePath, points, fillLine.trim()]);
    if (rendering.has(key)) throw Object.assign(new Error('this path is already rendering'), { code: 'rendering' });
    const frames = pathFrames(points, n);
    if (!frames.length) throw new Error('the path needs a second point');
    rendering.add(key);
    try {
        const style = await sceneStyle(io, sceneItem, onStep);
        const shas = [];
        for (let i = 0; i < frames.length; i++) {
            if (signal?.aborted) throw new Error('cancelled');
            onStep('guide', { frame: i + 1, of: frames.length });
            const f = stackFrame(i === 0 ? await panoFrame(io, sceneItem, frames[0]) : io.renderPano(view, renderer, frames[i]));
            const png = await io.encodePng(f.rgba, f.w, f.h);
            shas.push((await placeAsset(io, project, await io.blobToDataUrl(png), '.png')).sha256);
        }
        onStep('upload');
        const guide = await io.post(`/project-media/${project.id}/frames-to-video?folderPath=${encodeURIComponent(project.folderPath)}`,
            { frames: shas, fps: 16 });
        onStep('wan');
        return await new Promise((resolve, reject) => {
            const started = io.enqueue(
                {
                    operation: 'scenePathVideo', model: { id: null, mediaType: 'video' },
                    positive: pathPrompt(style, fillLine.trim()), negative: '',
                    // The child-safety gate reads only the line the user typed (MPI-1156).
                    userWords: [fillLine.trim()],
                    mediaItems: [{ url: guide.filePath, mediaType: 'video', role: 'video1' }],
                },
                {
                    onComplete: ({ item } = {}) => (item?.filePath ? resolve(item) : reject(new Error('the path video came back empty'))),
                    onError: (err) => reject(err instanceof Error ? err : new Error(String(err?.message || err))),
                    onCancel: () => reject(new Error('cancelled')),
                },
            );
            if (!started) reject(new Error('the path video did not start'));
        });
    } finally {
        rendering.delete(key);
    }
}
