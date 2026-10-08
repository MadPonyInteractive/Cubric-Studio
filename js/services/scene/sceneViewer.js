// ── Scene viewer (MPI-623, plan A1) ────────────────────────────────────────────
// Loads a scene manifest (`scenePath`) and meshes its pano record for MpiSceneCanvas, and
// owns the fly camera's maths. Ported from spike 0a (`D:\WORK\MPI-623-spike\single_shot\
// viewer\app.js`, parity PASS 2026-10-08, task research/spike-0a.md): same grid, same
// per-fragment equirect lookup, same camera, so the viewer and Take picture cannot drift.
//
// Coordinates, as in the spike: the WORLD is y-DOWN (SplatKit / OpenCV, which the fill
// layers' w2c use); a pose is in y-UP "spot" coords (+X right, +Y up, +Z forward, origin =
// the pano camera). Rule C (holes) and the fill layers land with Take picture.

import {
    BufferGeometry, BufferAttribute, Mesh, RawShaderMaterial, GLSL3, DoubleSide, Texture,
    RepeatWrapping, ClampToEdgeWrapping, LinearFilter, NoColorSpace, Vector3, MathUtils,
} from '../../../node_modules/three/build/three.module.js';

/** Fly speed in scene units a second, and drag-look radians a pixel (spike 0a). */
export const FLY_SPEED = 0.25;
export const LOOK_RATE = 0.003;
const PITCH_MAX = 1.55;

/** Facing the pano's centre column from its camera, a 24 mm lens. */
export const START_POSE = Object.freeze({ pos: [0, 0, 0], yaw: 0, pitch: 0, mm: 24 });

/**
 * A manifest's sibling file, named by suffix: `pano.png` beside `<id>.scene.json` is
 * `<id>.scene.pano.png` (docs/scenes.md § Companions).
 * @param {string} manifestUrl  a `/project-file?path=` URL ending `.scene.json`
 * @param {string} name        the manifest's file name, e.g. `pano.png`
 */
export function sceneFileUrl(manifestUrl, name) {
    const p = new URLSearchParams(String(manifestUrl).split('?')[1] || '').get('path') || '';
    if (!p.endsWith('.scene.json')) throw new Error(`not a scene manifest: ${manifestUrl}`);
    return `/project-file?path=${encodeURIComponent(p.slice(0, -'json'.length) + name)}`;
}

/**
 * The pano record as a grid: one vertex per depth cell at its depth along its direction,
 * plus column 0 again as column `w` so the seam faces get unwrapped coordinates.
 * @param {Float32Array} depth  `h` rows x `w` columns
 * @returns {{ position: Float32Array, dir: Float32Array, index: Uint32Array }}
 */
export function panoGrid(depth, w, h) {
    const VW = w + 1, NV = VW * h;
    const position = new Float32Array(NV * 3), dir = new Float32Array(NV * 3);
    for (let i = 0; i < h; i++) for (let jj = 0; jj < VW; jj++) {
        const j = jj % w, k = i * VW + jj, d = depth[i * w + j];
        const th = (1 - (j + 0.5) / w) * 2 * Math.PI, ph = (i + 0.5) / h * Math.PI;
        const sx = Math.sin(ph) * Math.cos(th), sy = Math.sin(ph) * Math.sin(th), sz = Math.cos(ph);
        position.set([d * sy, -d * sz, -d * sx], k * 3); // pano -> world
        dir.set([sx, sy, sz], k * 3);
    }
    const index = new Uint32Array((h - 1) * w * 6);
    for (let i = 0, a = 0; i < h - 1; i++) for (let j = 0; j < w; j++, a += 6) {
        const tl = i * VW + j, bl = (i + 1) * VW + j;
        index.set([tl, bl, tl + 1, tl + 1, bl, bl + 1], a);
    }
    return { position, dir, index };
}

/** Unit forward vector of a pose, spot coords. */
function forward({ yaw, pitch }) {
    return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
}

/**
 * The pose after `dt` seconds with `held` fly directions down (forward, back, left, right,
 * up, down). Moves level: forward follows the yaw, never the pitch.
 * @param {{pos: number[], yaw: number, pitch: number, mm: number}} pose
 * @param {Set<string>} held
 */
export function flyStep(pose, held, dt) {
    const s = FLY_SPEED * dt, c = Math.cos(pose.yaw), n = Math.sin(pose.yaw);
    const axes = { forward: [n, 0, c], back: [-n, 0, -c], right: [c, 0, -n], left: [-c, 0, n], up: [0, 1, 0], down: [0, -1, 0] };
    const pos = [...pose.pos];
    for (const d of held) (axes[d] || [0, 0, 0]).forEach((v, i) => { pos[i] += v * s; });
    return { ...pose, pos };
}

/** The pose after a drag of `dx`, `dy` pixels: right turns right, up looks up. */
export function flyLook(pose, dx, dy) {
    const pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pose.pitch - dy * LOOK_RATE));
    return { ...pose, yaw: pose.yaw + dx * LOOK_RATE, pitch };
}

/**
 * Put a three camera at a pose: the spike's `setCamera`, view matrix built by hand (OpenCV
 * w2c flipped to GL), so its matrices must not auto-update. The lens is a full-frame `mm`
 * across the frame WIDTH, so a wider frame sees wider, not shorter.
 */
export function applyPose(camera, pose) {
    const fw = forward(pose), t = pose.pos.map((v, i) => v + fw[i]);
    const P = new Vector3(pose.pos[0], -pose.pos[1], pose.pos[2]), T = new Vector3(t[0], -t[1], t[2]);
    const f = T.clone().sub(P).normalize();
    const r = new Vector3(0, 1, 0).cross(f).normalize();
    const u = f.clone().cross(r);
    camera.matrixAutoUpdate = false;
    camera.matrixWorldAutoUpdate = false;
    camera.matrixWorldInverse.set(r.x, r.y, r.z, -r.dot(P), -u.x, -u.y, -u.z, u.dot(P), -f.x, -f.y, -f.z, f.dot(P), 0, 0, 0, 1);
    camera.matrixWorld.copy(camera.matrixWorldInverse).invert();
    camera.fov = MathUtils.radToDeg(2 * Math.atan(18 / (pose.mm * camera.aspect)));
    camera.updateProjectionMatrix();
}

/**
 * Fetch a scene: the manifest, the pano depth and the pano texture, undecoded colour.
 * @returns {Promise<{ manifest: Object, depth: Float32Array, image: ImageBitmap }>}
 */
export async function loadScene(manifestUrl, { signal } = {}) {
    const get = async (url) => {
        const res = await fetch(url, { signal });
        if (!res.ok) throw new Error(`${res.status} on ${url}`);
        return res;
    };
    const manifest = await (await get(manifestUrl)).json();
    const { image, depth, w, h } = manifest.pano || {};
    const [buf, blob] = await Promise.all([
        get(sceneFileUrl(manifestUrl, depth)).then(r => r.arrayBuffer()),
        get(sceneFileUrl(manifestUrl, image)).then(r => r.blob()),
    ]);
    if (buf.byteLength !== w * h * 4) throw new Error(`pano depth is ${buf.byteLength} bytes, not ${w}x${h} float32`);
    const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none', imageOrientation: 'none' });
    return { manifest, depth: new Float32Array(buf), image: bitmap };
}

const PANO_VERT = /* glsl */`precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
in vec3 position; in vec3 dir;
out vec3 vDir;
void main() { vDir = dir; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

// Colour by DIRECTION per fragment (the spike's lookup), so the seam and the poles sample exactly.
const PANO_FRAG = /* glsl */`precision highp float;
uniform sampler2D uTex;
in vec3 vDir;
out vec4 oCol;
const float PI = 3.14159265358979;
void main() {
  vec3 d = normalize(vDir);
  vec2 uv = vec2(fract(1.0 - mod(atan(d.y, d.x), 2.0 * PI) / (2.0 * PI)), acos(clamp(d.z, -1.0, 1.0)) / PI);
  oCol = vec4(texture(uTex, uv).rgb, 1.0);
}`;

/**
 * The pano record as a three mesh. Its colour is passed through untouched (raw shader, no
 * colour space), as the picture it starts must be.
 * @returns {{ mesh: Mesh, dispose: () => void }}
 */
export function createPanoMesh({ manifest, depth, image }) {
    const { position, dir, index } = panoGrid(depth, manifest.pano.w, manifest.pano.h);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute('dir', new BufferAttribute(dir, 3));
    geometry.setIndex(new BufferAttribute(index, 1));
    const texture = new Texture(image);
    Object.assign(texture, {
        flipY: false, wrapS: RepeatWrapping, wrapT: ClampToEdgeWrapping, minFilter: LinearFilter,
        magFilter: LinearFilter, generateMipmaps: false, colorSpace: NoColorSpace, needsUpdate: true,
    });
    const material = new RawShaderMaterial({
        glslVersion: GLSL3, side: DoubleSide, uniforms: { uTex: { value: texture } },
        vertexShader: PANO_VERT, fragmentShader: PANO_FRAG,
    });
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    return {
        mesh,
        dispose: () => {
            geometry.dispose();
            material.dispose();
            texture.dispose();
            image.close?.();
        },
    };
}
