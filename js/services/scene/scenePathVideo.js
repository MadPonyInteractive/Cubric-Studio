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
export async function renderPath({ project, sceneItem, view, renderer, points, fillLine = '', signal, onStep = () => {} }, io) {
    const frames = pathFrames(points);
    if (!frames.length) throw new Error('the path needs a second point');
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
    return new Promise((resolve, reject) => {
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
}
