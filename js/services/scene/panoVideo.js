// ── A scene's path video as a 360 player (MPI-623 P3) ─────────────────────────────
// Render path's video (`scenePathVideo.js`) is a 360 frame per camera along the path, in
// `stitchPano`'s layout: the frame's centre is the way the path faces, its right the camera's
// right, level, the world y-down. The player looks out from the centre of a sphere the frame is
// wrapped round, so a pose's yaw and pitch turn the view RELATIVE to the path's heading: the
// view rides along with the path's turns. Take picture renders that same view (the viewer IS
// the shot), then Klein cleans it up as the scene's Take picture does, and it lands as a new
// image card.

import {
    Mesh, Scene, SphereGeometry, ShaderMaterial, BackSide, VideoTexture, RepeatWrapping,
    PerspectiveCamera, WebGLRenderTarget,
} from '../../../node_modules/three/build/three.module.js';
import { applyPose, pictureSize } from './sceneViewer.js';
import { POLISH, colorLock, placeAsset, kleinJob } from './scenePicture.js';

const VERT = `
varying vec3 vDir;
void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// stitchPano backwards: lon = atan(right, forward), lat = asin(up) with the world y-down; GL rows
// are bottom-up (the texture's flipY), so the frame's top row is v = 1.
const FRAG = `
uniform sampler2D map;
varying vec3 vDir;
const float PI = 3.141592653589793;
void main() {
    vec3 d = normalize(vDir);
    gl_FragColor = vec4(texture2D(map, vec2(atan(d.x, d.z) / (2.0 * PI) + 0.5, 0.5 + asin(clamp(-d.y, -1.0, 1.0)) / PI)).rgb, 1.0);
}`;

/**
 * The 360 view of `video` (a playing or paused `<video>` of a path video). Raw bytes in and out
 * (no colour conversion either way), so the picture holds the video's own colours.
 * @param {HTMLVideoElement} video
 */
export function createPanoView(video) {
    const map = new VideoTexture(video);
    map.wrapS = RepeatWrapping; // bilinear across the seam behind the camera
    const mesh = new Mesh(new SphereGeometry(1, 64, 32), new ShaderMaterial({
        uniforms: { map: { value: map } }, vertexShader: VERT, fragmentShader: FRAG,
        side: BackSide, depthTest: false, depthWrite: false,
    }));
    const scene = new Scene().add(mesh);
    return {
        draw: (renderer, camera) => renderer.render(scene, camera),
        /** A seeked, paused frame: three only uploads on a NEW frame callback, which a seek may not send. */
        refresh: () => { map.needsUpdate = true; },
        /** The view at `pose` as a `w` x `h` picture, rows top-down. */
        picture(renderer, pose, { w, h }) {
            const camera = new PerspectiveCamera(50, w / h, 0.01, 10);
            applyPose(camera, pose);
            const target = new WebGLRenderTarget(w, h), px = new Uint8Array(w * h * 4), prev = renderer.getRenderTarget();
            try {
                renderer.setRenderTarget(target);
                renderer.render(scene, camera);
                renderer.readRenderTargetPixels(target, 0, 0, w, h, px);
            } finally {
                renderer.setRenderTarget(prev);
                target.dispose();
            }
            const rgba = new Uint8ClampedArray(w * h * 4);
            for (let y = 0; y < h; y++) rgba.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); // GL rows are bottom-up
            return { w, h, rgba };
        },
        dispose() {
            mesh.geometry.dispose();
            mesh.material.dispose();
            map.dispose();
        },
    };
}

/**
 * Take the picture `pose` frames at `aspect` on the video's current frame: render -> Klein
 * clean-up (POLISH) -> colour lock -> a new image card.
 * @param {{ project: Object, view: Object, renderer: Object, pose: Object, aspect: string,
 *   frame: number, videoItem: Object, onStep?: (step: string) => void }} ctx  `view` = `createPanoView(...)`
 * @param {Object} io  `appIo()`, or a test's stand-ins
 * @returns {Promise<{ group: Object, entry: Object }>}
 */
export async function takeVideoPicture({ project, view, renderer, pose, aspect, frame, videoItem, onStep = () => {} }, io) {
    const size = pictureSize(aspect);
    onStep('render');
    const shot = view.picture(renderer, pose, size);
    const base = await placeAsset(io, project, await io.blobToDataUrl(await io.encodePng(shot.rgba, shot.w, shot.h)), '.png');
    onStep('clean');
    const cleaned = await kleinJob(io, 'kleinEdit', base.filePath, POLISH);
    const [editPx, basePx] = await Promise.all([io.pixelsAt(cleaned.filePath, shot.w, shot.h), io.pixelsAt(base.filePath, shot.w, shot.h)]);
    const picture = await io.encodePng(colorLock(editPx, basePx), shot.w, shot.h);
    onStep('save');
    return io.savePictureCard(project, picture, size, { ...pose, pos: [...pose.pos], aspect, frame, video: videoItem.id });
}
