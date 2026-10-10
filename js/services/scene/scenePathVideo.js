/**
 * A camera path rendered as a 360 video (MPI-623 P2). The app renders the guide: each frame of
 * the path (`pathFrames`) as the 360 frame the scene shows there (`renderPano`), stacked over its
 * holes (white = Wan invents here). One guide video crosses to the engine (`frames-to-video`),
 * where Wan 2.1 I2V + the Matrix-3D 360 LoRA keep what is known and invent the rest
 * (`scenePathVideo`, scene_path_video.json). The result lands as a video card.
 * Measured on a 4060 Ti (validation.md § Paths P2): the guide ~35 s, Wan ~28 min.
 */

import { pathFrames } from './scenePath.js';
import { sceneStyle, placeAsset } from './scenePicture.js';
import { gpuGenSecs } from '../../data/runpodGpuSpecs.js';

// Render path's measured runs, in seconds: an RTX 5090 Pod 420 s from the guide reaching the engine to
// the card (validation.md § Render path on RunPod), an RTX 4060 Ti 1810 s click to card (§ Paths P2
// LIVE). Every path is 81 frames, so any other card scales the 5090 run by the GPU picker's measured
// seconds per image (GPU_GEN_SECS). That scale put the 4060 Ti (on the A4000's row) at 1735 s: 4% off.
const PATH_RUNS = new Map([['NVIDIA GeForce RTX 5090', 420], ['NVIDIA GeForce RTX 4060 Ti', 1810]]);
const PATH_ANCHOR = 'NVIDIA GeForce RTX 5090';

/** Minutes Render path takes on `gpu` (a RunPod GPU id or a local nvidia-smi name), or null when nobody measured that card. */
export function pathEtaMin(gpu) {
    const secs = PATH_RUNS.get(gpu) ?? (gpuGenSecs(gpu) && (PATH_RUNS.get(PATH_ANCHOR) * gpuGenSecs(gpu)) / gpuGenSecs(PATH_ANCHOR));
    return secs ? Math.max(1, Math.round(secs / 60)) : null;
}

/** Matrix-3D's own prompt opening; the scene's style and the user's line follow. */
export const PATH_LINE = 'A high quality panoramic video. The camera moves forward through the scene.';
export const pathPrompt = (style, line) => [PATH_LINE, style, line].filter(Boolean).join(' ');

/** A guide frame over its holes: one picture twice as tall, which the graph crops apart. */
export function stackFrame({ w, h, rgba, mask }) {
    const out = new Uint8ClampedArray(w * h * 8);
    out.set(rgba);
    out.set(mask, w * h * 4);
    return { w, h: 2 * h, rgba: out };
}

/**
 * Render `points` (a camera path, `scenePath.js`) as a 360 video card in `project`.
 * `onStep(step, at)`: 'style', 'guide' ({ frame, of }), 'upload', 'wan' (the engine has it).
 * @returns {Promise<Object>} the landed video item
 */
// The paths whose video is still on its way. The scene frees its button once Wan has the guide, so
// a different path can queue behind this one; the SAME path again is refused (code 'rendering').
const rendering = new Set();

export async function renderPath({ project, sceneItem, view, renderer, points, fillLine = '', signal, onStep = () => {} }, io) {
    const key = JSON.stringify([sceneItem?.scenePath, points, fillLine.trim()]);
    if (rendering.has(key)) throw Object.assign(new Error('this path is already rendering'), { code: 'rendering' });
    const frames = pathFrames(points);
    if (!frames.length) throw new Error('the path needs a second point');
    rendering.add(key);
    try {
        const style = await sceneStyle(io, sceneItem, onStep);
        const shas = [];
        for (let i = 0; i < frames.length; i++) {
            if (signal?.aborted) throw new Error('cancelled');
            onStep('guide', { frame: i + 1, of: frames.length });
            const f = stackFrame(io.renderPano(view, renderer, frames[i]));
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
