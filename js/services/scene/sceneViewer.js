// ── Scene viewer (MPI-623, plan A1) ────────────────────────────────────────────
// Loads a scene manifest (`scenePath`), meshes its records (the pano and every fill layer)
// and draws them with hole rule C for MpiSceneCanvas, and owns the fly camera's maths.
// Ported from spike 0a (`D:\WORK\MPI-623-spike\single_shot\viewer\app.js`, parity PASS
// 2026-10-08, task research/spike-0a.md): same grids, same shaders, same camera, so the
// viewer and Take picture cannot drift.
//
// Coordinates, as in the spike: the WORLD is y-DOWN (SplatKit / OpenCV, which the fill
// layers' w2c use); a pose is in y-UP "spot" coords (+X right, +Y up, +Z forward, origin =
// the pano camera).

import {
    BufferGeometry, BufferAttribute, Mesh, RawShaderMaterial, GLSL3, DoubleSide, Texture, Scene,
    OrthographicCamera, PerspectiveCamera, WebGLRenderTarget, DepthTexture, FloatType, NearestFilter, RepeatWrapping,
    ClampToEdgeWrapping, LinearFilter, NoColorSpace, Vector2, Vector3, Matrix4, MathUtils,
} from '../../../node_modules/three/build/three.module.js';

/** Fly speed in scene units a second, and drag-look radians a pixel (spike 0a). */
export const FLY_SPEED = 0.25;
export const LOOK_RATE = 0.003;
/** Roll in radians a second while a roll key is held. */
export const ROLL_SPEED = 0.5;
const PITCH_MAX = 1.55;

/** Facing the pano's centre column from its camera, level, a 24 mm lens. */
export const START_POSE = Object.freeze({ pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, mm: 24 });

/**
 * Klein's picture size: ~1 MP (2^20 px) at the aspect, both sides a multiple of 16
 * (16:9 -> 1360x768, the size its edit returns; 1:1 -> 1024x1024).
 * @param {string} aspect  'w:h', e.g. '16:9' or '2.39:1'
 */
export function pictureSize(aspect) {
    const [a, b] = String(aspect).split(':').map(Number);
    const r = a / b, r16 = (v) => Math.max(16, Math.round(v / 16) * 16);
    const w = r16(Math.sqrt(2 ** 20 * r));
    return { w, h: r16(w / r) };
}

/**
 * The renderer every scene is drawn with. `reversedDepthBuffer` is three ^0.186's name:
 * 0.170's `reverseDepthBuffer` is ignored there without a word, and at the 1e-4 near plane
 * plain depth is too coarse. No antialias: the frame is a composite of float targets.
 */
export const RENDERER_OPTIONS = Object.freeze({
    alpha: true, antialias: false, reversedDepthBuffer: true, powerPreference: 'high-performance',
});

/** The spike's shim clips at clip-w 1e-4 (not shots.py's NEAR); reverse depth keeps it precise. */
export const NEAR = 1e-4;
/** Rule C, shots.py's numbers: a depth edge is a 3x3 spread over 5% of the depth; a stretch is
 *  one source texel drawn over more than 3 screen px. A manifest may carry its own. */
export const EDGE_RTOL = 0.05;
export const STRETCH_K = 3;
/** Sky cells this close to a silhouette count as a depth edge, which removes the hair-thin
 *  spikes of tree and roof texels on the far dome (spike-0a.md § Sky-silhouette spikes).
 *  ponytail: 3 is the plan's starting value; Take picture's filled floor still settles it. */
export const SKY_BAND = 3;

const BITMAP = { colorSpaceConversion: 'none', premultiplyAlpha: 'none', imageOrientation: 'none' };

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

/** shots.py `geom.depth_edges`: 1 where a cell's 3x3 depth spread over its own depth > `rtol` (no wrap). */
export function depthEdges(depth, w, h, rtol = EDGE_RTOL) {
    const out = new Uint8Array(w * h);
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
        let mx = -Infinity, mn = Infinity;
        for (let a = Math.max(0, i - 1); a <= Math.min(h - 1, i + 1); a++) {
            for (let b = Math.max(0, j - 1); b <= Math.min(w - 1, j + 1); b++) {
                const v = depth[a * w + b];
                if (v > mx) mx = v;
                if (v < mn) mn = v;
            }
        }
        out[i * w + j] = (mx - mn) / Math.max(depth[i * w + j], 1e-6) > rtol ? 1 : 0;
    }
    return out;
}

/** 1 for a sky cell (depth past 98% of the dome) within `band` cells of a non-sky one; the
 *  columns wrap at the seam, the rows do not. */
function skyNearSilhouette(depth, w, h, sky, band) {
    const solid = (k) => (depth[k] > 0.98 * sky ? 0 : 1);
    const rows = new Uint8Array(w * h), out = new Uint8Array(w * h);
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
        let hit = 0;
        for (let b = -band; b <= band && !hit; b++) hit = solid(i * w + (j + b + w) % w);
        rows[i * w + j] = hit;
    }
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
        let hit = 0;
        for (let a = Math.max(0, i - band); a <= Math.min(h - 1, i + band) && !hit; a++) hit = rows[a * w + j];
        out[i * w + j] = hit && !solid(i * w + j) ? 1 : 0;
    }
    return out;
}

/**
 * The pano record as a grid: one vertex per depth cell at its depth along its direction,
 * plus column 0 again as column `w` so the seam faces get unwrapped coordinates.
 * `src` is the vertex's texel in the `texW`-wide texture (rule C's stretch), `edge` is 0 on a
 * depth-edge tear (and, with `skyBand`, next to a silhouette in the sky). Faces inside a
 * `windows` rect ({ rows, cols } in cells, cols may wrap) come LAST, from `windowStart`, so
 * they draw with the window material, whose back faces open so a room sees out.
 * @param {Float32Array} depth  `h` rows x `w` columns
 */
export function panoGrid(depth, w, h, { texW = w, rtol = EDGE_RTOL, sky = Infinity, skyBand = 0, windows = [] } = {}) {
    const VW = w + 1, NV = VW * h, s = texW / w;
    const tear = depthEdges(depth, w, h, rtol);
    if (skyBand > 0) skyNearSilhouette(depth, w, h, sky, skyBand).forEach((v, k) => { tear[k] |= v; });
    const position = new Float32Array(NV * 3), dir = new Float32Array(NV * 3);
    const src = new Float32Array(NV * 2), edge = new Float32Array(NV);
    for (let i = 0; i < h; i++) for (let jj = 0; jj < VW; jj++) {
        const j = jj % w, k = i * VW + jj, d = depth[i * w + j];
        const th = (1 - (j + 0.5) / w) * 2 * Math.PI, ph = (i + 0.5) / h * Math.PI;
        const sx = Math.sin(ph) * Math.cos(th), sy = Math.sin(ph) * Math.sin(th), sz = Math.cos(ph);
        position.set([d * sy, -d * sz, -d * sx], k * 3); // pano -> world
        dir.set([sx, sy, sz], k * 3);
        src.set([(jj + 0.5) * s, (i + 0.5) * s], k * 2);
        edge[k] = 1 - tear[i * w + j];
    }
    const inWin = (i, j) => windows.some(({ rows, cols }) => i >= rows[0] && i < rows[1]
        && (cols[0] <= cols[1] ? j >= cols[0] && j < cols[1] : j >= cols[0] || j < cols[1]));
    const nF = (h - 1) * w * 2, win = new Uint8Array(nF);
    let nWin = 0;
    if (windows.length) {
        for (let i = 0, f = 0; i < h - 1; i++) for (let j = 0; j < w; j++, f += 2) {
            const jr = (j + 1) % w, c = [inWin(i, j), inWin(i + 1, j), inWin(i, jr), inWin(i + 1, jr)];
            if (c[0] && c[1] && c[2]) { win[f] = 1; nWin++; }
            if (c[2] && c[1] && c[3]) { win[f + 1] = 1; nWin++; }
        }
    }
    const index = new Uint32Array(nF * 3);
    for (let i = 0, f = 0, a = 0, b = (nF - nWin) * 3; i < h - 1; i++) for (let j = 0; j < w; j++, f += 2) {
        const tl = i * VW + j, bl = (i + 1) * VW + j, tr = tl + 1, br = bl + 1;
        if (win[f]) { index.set([tl, bl, tr], b); b += 3; } else { index.set([tl, bl, tr], a); a += 3; }
        if (win[f + 1]) { index.set([tr, bl, br], b); b += 3; } else { index.set([tr, bl, br], a); a += 3; }
    }
    return { position, dir, src, edge, index, windowStart: (nF - nWin) * 3 };
}

/**
 * A pinhole record (a fill layer) as a grid over its KEPT pixels (depth > 0), each pixel
 * centre back-projected through the record's OpenCV `w2c`, coloured from the fill. `src` is
 * the pixel itself (rule C's stretch); a face needs all three corners kept.
 * @param {{ w: number, h: number, w2c: number[], fx: number, fy?: number, cx: number, cy: number }} record
 * @param {Float32Array} z     camera z per pixel, 0 = not kept
 * @param {Uint8ClampedArray} rgba  the fill's pixels
 */
export function layerGrid({ w, h, w2c, fx, fy = fx, cx, cy }, z, rgba) {
    const e = new Matrix4().set(...w2c).invert().elements; // c2w, column-major
    const remap = new Int32Array(w * h).fill(-1);
    let n = 0;
    for (let k = 0; k < w * h; k++) if (z[k] > 0) remap[k] = n++;
    const position = new Float32Array(n * 3), color = new Uint8Array(n * 3), src = new Float32Array(n * 2);
    for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
        const k = v * w + u, r = remap[k];
        if (r < 0) continue;
        const zz = z[k], x = (u + 0.5 - cx) / fx * zz, y = (v + 0.5 - cy) / fy * zz;
        position.set([e[0] * x + e[4] * y + e[8] * zz + e[12], e[1] * x + e[5] * y + e[9] * zz + e[13], e[2] * x + e[6] * y + e[10] * zz + e[14]], r * 3);
        color.set([rgba[k * 4], rgba[k * 4 + 1], rgba[k * 4 + 2]], r * 3);
        src.set([u + 0.5, v + 0.5], r * 2);
    }
    const index = new Uint32Array(Math.max(0, (w - 1) * (h - 1) * 6));
    let a = 0;
    for (let v = 0; v < h - 1; v++) for (let u = 0; u < w - 1; u++) {
        const tl = remap[v * w + u], tr = remap[v * w + u + 1], bl = remap[(v + 1) * w + u], br = remap[(v + 1) * w + u + 1];
        if (tl >= 0 && bl >= 0 && tr >= 0) { index[a++] = tl; index[a++] = bl; index[a++] = tr; }
        if (tr >= 0 && bl >= 0 && br >= 0) { index[a++] = tr; index[a++] = bl; index[a++] = br; }
    }
    return { position, color, src, index: index.slice(0, a) };
}

/** The pano was shot from eye height: this sets the metre for the height readout. */
export const EYE_HEIGHT_M = 1.6;

/**
 * The pano camera's height above the ground in scene units: the median vertical drop over the
 * cells within 9 degrees of straight down (MoGe's depth has no metre of its own).
 */
export function groundBelow(depth, w, h) {
    const drops = [];
    for (let i = 0; i < h; i++) {
        const ph = (i + 0.5) / h * Math.PI;
        if (ph < 0.95 * Math.PI) continue;
        for (let j = 0; j < w; j++) drops.push(-depth[i * w + j] * Math.cos(ph));
    }
    drops.sort((a, b) => a - b);
    return drops[drops.length >> 1] || 1;
}

/** Unit forward vector of a pose, spot coords. */
function forward({ yaw, pitch }) {
    return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
}

/**
 * The pose after `dt` seconds with `held` fly directions down (forward, back, left, right,
 * up, down, rollLeft, rollRight). Moves level: forward follows the yaw, never the pitch.
 * @param {{pos: number[], yaw: number, pitch: number, roll?: number, mm: number}} pose
 * @param {Set<string>} held
 */
export function flyStep(pose, held, dt) {
    const s = FLY_SPEED * dt, c = Math.cos(pose.yaw), n = Math.sin(pose.yaw);
    const axes = { forward: [n, 0, c], back: [-n, 0, -c], right: [c, 0, -n], left: [-c, 0, n], up: [0, 1, 0], down: [0, -1, 0] };
    const pos = [...pose.pos];
    for (const d of held) (axes[d] || [0, 0, 0]).forEach((v, i) => { pos[i] += v * s; });
    const turn = (held.has('rollRight') ? 1 : 0) - (held.has('rollLeft') ? 1 : 0);
    return { ...pose, pos, roll: (pose.roll || 0) + turn * ROLL_SPEED * dt };
}

/** The pose after a drag of `dx`, `dy` pixels: right turns right, up looks up. */
export function flyLook(pose, dx, dy) {
    const pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pose.pitch - dy * LOOK_RATE));
    return { ...pose, yaw: pose.yaw + dx * LOOK_RATE, pitch };
}

/**
 * Put a three camera at a pose: the spike's `setCamera`, view matrix built by hand (OpenCV
 * w2c flipped to GL), so its matrices must not auto-update. The lens is a full-frame `mm`
 * across the frame WIDTH, so a wider frame sees wider, not shorter. `roll` > 0 tilts the
 * camera to the right (its right side dips).
 */
export function applyPose(camera, pose) {
    const fw = forward(pose), t = pose.pos.map((v, i) => v + fw[i]);
    const P = new Vector3(pose.pos[0], -pose.pos[1], pose.pos[2]), T = new Vector3(t[0], -t[1], t[2]);
    const f = T.clone().sub(P).normalize();
    const r0 = new Vector3(0, 1, 0).cross(f).normalize(); // right
    const u0 = f.clone().cross(r0);                        // down (the world is y-down)
    const c = Math.cos(pose.roll || 0), s = Math.sin(pose.roll || 0);
    const r = r0.clone().multiplyScalar(c).addScaledVector(u0, s);
    const u = u0.clone().multiplyScalar(c).addScaledVector(r0, -s);
    camera.matrixAutoUpdate = false;
    camera.matrixWorldAutoUpdate = false;
    camera.matrixWorldInverse.set(r.x, r.y, r.z, -r.dot(P), -u.x, -u.y, -u.z, u.dot(P), -f.x, -f.y, -f.z, f.dot(P), 0, 0, 0, 1);
    camera.matrixWorld.copy(camera.matrixWorldInverse).invert();
    camera.fov = MathUtils.radToDeg(2 * Math.atan(18 / (pose.mm * camera.aspect)));
    camera.updateProjectionMatrix();
}

/**
 * The pinhole record of a picture taken with `camera` (posed by `applyPose`) at `w` x `h`:
 * OpenCV w2c (row-major) = diag(1, -1, -1, 1) x the GL view, the lens across the width.
 */
export function layerCamera(camera, mm, w, h) {
    const e = camera.matrixWorldInverse.elements; // column-major
    const w2c = [];
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) w2c.push((row === 1 || row === 2 ? -1 : 1) * e[col * 4 + row] + 0);
    const fx = w * mm / 36;
    return { w, h, w2c, fx, fy: fx, cx: w / 2, cy: h / 2 };
}

/** A bitmap's pixels as decoded (the bitmap skipped colour conversion); closes the bitmap. */
function pixels(bitmap) {
    const { width, height } = bitmap;
    const g = new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true });
    g.drawImage(bitmap, 0, 0);
    bitmap.close();
    return g.getImageData(0, 0, width, height).data;
}

async function fetchOk(url, signal) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`${res.status} on ${url}`);
    return res;
}

/** A manifest sibling as float32, refused unless it holds exactly `w` x `h` values. */
async function f32At(manifestUrl, name, w, h, signal) {
    const buf = await (await fetchOk(sceneFileUrl(manifestUrl, name), signal)).arrayBuffer();
    if (buf.byteLength !== w * h * 4) throw new Error(`${name} is ${buf.byteLength} bytes, not ${w}x${h} float32`);
    return new Float32Array(buf);
}

const bitmapAt = async (manifestUrl, name, signal) =>
    createImageBitmap(await (await fetchOk(sceneFileUrl(manifestUrl, name), signal)).blob(), BITMAP);

/** One fill layer's depth and pixels, fetched beside its manifest (`createSceneView().addLayer` input). */
export async function loadLayer(manifestUrl, record, { signal } = {}) {
    const [z, b] = await Promise.all([f32At(manifestUrl, record.depth, record.w, record.h, signal), bitmapAt(manifestUrl, record.image, signal)]);
    return { record, depth: z, rgba: pixels(b) };
}

/**
 * Fetch a scene: the manifest, the pano depth and texture (colour undecoded), and every
 * fill layer's depth and pixels.
 * @returns {Promise<{ manifest: Object, depth: Float32Array, image: ImageBitmap,
 *   layers: { record: Object, depth: Float32Array, rgba: Uint8ClampedArray }[] }>}
 */
export async function loadScene(manifestUrl, { signal } = {}) {
    const manifest = await (await fetchOk(manifestUrl, signal)).json();
    const { image, depth, w, h } = manifest.pano || {};
    const [panoDepth, panoImage, layers] = await Promise.all([
        f32At(manifestUrl, depth, w, h, signal),
        bitmapAt(manifestUrl, image, signal),
        Promise.all((manifest.layers || []).map(record => loadLayer(manifestUrl, record, { signal }))),
    ]);
    return { manifest, depth: panoDepth, image: panoImage, layers };
}

// ── Shaders: rule C per fragment, two MRT passes, one composite ───────────────────────────
// Back face = !gl_FrontFacing (shots.py: det of the source->screen map < 0). Stretch = one
// source texel covers > K screen px, i.e. the smallest singular value of
// d(source texel)/d(screen px) < 1/K (shots.py: the largest of its inverse > K).
const RULE_GLSL = /* glsl */`
uniform float uK;
float badC(vec2 src) {
  vec2 dx = dFdx(src), dy = dFdy(src);
  float q = dot(dx, dx) + dot(dy, dy), det = dx.x * dy.y - dx.y * dy.x;
  float smin = sqrt(max(0.5 * (q - sqrt(max(q * q - 4.0 * det * det, 0.0))), 0.0));
  return !gl_FrontFacing ? 2.0 : (smin * uK < 1.0 ? 1.0 : 0.0); // 2 = seen from behind, 1 = stretch
}`;

// Aux target: x = camera z, y = a real surface (not a depth-edge tear), z = rule C bad, w = covered.
const PANO_VERT = /* glsl */`precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
in vec3 position; in vec3 dir; in vec2 src; in float edge;
out vec3 vDir; out vec2 vSrc; out float vEdge, vZ;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z;
  vDir = dir; vSrc = src; vEdge = edge; gl_Position = projectionMatrix * mv; }`;

// Colour by DIRECTION per fragment (the spike's lookup), so the seam and the poles sample exactly.
const PANO_FRAG = /* glsl */`precision highp float;
uniform sampler2D uTex; uniform float uWindow;
${RULE_GLSL}
in vec3 vDir; in vec2 vSrc; in float vEdge, vZ;
layout(location = 0) out vec4 oCol; layout(location = 1) out vec4 oAux;
const float PI = 3.14159265358979;
void main() {
  if (uWindow > 0.5 && !gl_FrontFacing) discard; // the opening: the room sees out
  float bad = badC(vSrc);
  vec3 d = normalize(vDir);
  vec2 uv = vec2(fract(1.0 - mod(atan(d.y, d.x), 2.0 * PI) / (2.0 * PI)), acos(clamp(d.z, -1.0, 1.0)) / PI);
  oCol = vec4(texture(uTex, uv).rgb, 1.0);
  oAux = vec4(vZ, vEdge > 0.999 ? 1.0 : 0.0, bad, 1.0);
}`;

const LAYER_VERT = /* glsl */`precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
in vec3 position; in vec3 color; in vec2 src;
out vec3 vCol; out vec2 vSrc; out float vZ;
void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vZ = -mv.z;
  vCol = color; vSrc = src; gl_Position = projectionMatrix * mv; }`;

// A fill fragment rule C rejects from here is not drawn at all, so it cannot hide a fill seen
// straight on: two pictures' fills of one ground disagree by a centimetre, which at a grazing
// angle is far more than any depth tolerance, and the stretched one used to win (MPI-623 live
// run: 35% of a picture's own fill hidden at its own camera). The pano keeps its bad faces.
const LAYER_FRAG = /* glsl */`precision highp float;
${RULE_GLSL}
in vec3 vCol; in vec2 vSrc; in float vZ;
layout(location = 0) out vec4 oCol; layout(location = 1) out vec4 oAux;
void main() {
  if (badC(vSrc) > 0.5) discard;
  oCol = vec4(vCol, 1.0); oAux = vec4(vZ, 1.0, 0.0, 1.0);
}`;

// shots.py render(): a fill wins where the pano has no real surface or is clearly behind it.
// Holes come out transparent black. uView 1 paints them magenta; 2 is the self-check readout;
// 3 is Take picture's: r = camera z where known (0 = hole), g = the pano seen from behind.
const COMP_VERT = /* glsl */`precision highp float; in vec3 position;
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMP_FRAG = /* glsl */`precision highp float;
uniform sampler2D c0, a0, c1, a1; uniform float uView;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 A0 = texelFetch(a0, p, 0), A1 = texelFetch(a1, p, 0);
  bool surf = A0.w > 0.5 && A0.y > 0.5, bad0 = A0.z > 0.5;
  if (uView > 1.5 && uView < 2.5) { o = vec4(surf && bad0 ? 1.0 : 0.0, surf ? 1.0 : 0.0, A0.w, 1.0); return; }
  bool take = A1.w > 0.5 && (!surf || A1.x < A0.x * 0.97); // a drawn fill fragment is never rule C bad
  bool known = take || (surf && !bad0);
  if (uView > 2.5) { o = vec4(known ? (take ? A1.x : A0.x) : 0.0, A0.w > 0.5 && A0.z > 1.5 ? 1.0 : 0.0, 0.0, 1.0); return; }
  vec3 rgb = take ? texelFetch(c1, p, 0).rgb : (known ? texelFetch(c0, p, 0).rgb : vec3(0.0));
  if (uView > 0.5 && !known) rgb = vec3(1.0, 0.0, 1.0);
  o = vec4(rgb, known ? 1.0 : 0.0);
}`;

const raw = (vertexShader, fragmentShader, uniforms, extra = {}) => new RawShaderMaterial({
    glslVersion: GLSL3, uniforms, vertexShader, fragmentShader, ...extra,
});

function geometryOf(attrs, index) {
    const g = new BufferGeometry();
    for (const [name, [array, size, normalized]] of Object.entries(attrs)) g.setAttribute(name, new BufferAttribute(array, size, normalized));
    g.setIndex(new BufferAttribute(index, 1));
    return g;
}

function meshOf(geometry, material) {
    const m = new Mesh(geometry, material);
    m.frustumCulled = false;
    return m;
}

/**
 * A loaded scene, ready to draw: the pano and every fill layer meshed, the rule C shaders,
 * the composite. Colour passes through untouched (raw shaders, no colour space), as the
 * picture it starts must.
 * @param {{ skyBand?: number }} [opts]  sky cells next to a silhouette that become holes
 * @returns {{ far: number, draw: Function, dropTargets: () => void, dispose: () => void }}
 */
export function createSceneView({ manifest, depth, image, layers }, { skyBand = SKY_BAND } = {}) {
    const P = manifest.pano, uK = { value: manifest.stretch_k ?? STRETCH_K };
    const grid = panoGrid(depth, P.w, P.h, {
        texW: image.width, rtol: P.edge_rtol ?? EDGE_RTOL, sky: P.sky, skyBand, windows: P.windows || [],
    });
    const panoGeo = geometryOf({ position: [grid.position, 3], dir: [grid.dir, 3], src: [grid.src, 2], edge: [grid.edge, 1] }, grid.index);
    panoGeo.addGroup(0, grid.windowStart, 0);
    panoGeo.addGroup(grid.windowStart, grid.index.length - grid.windowStart, 1);
    const texture = new Texture(image);
    Object.assign(texture, {
        flipY: false, wrapS: RepeatWrapping, wrapT: ClampToEdgeWrapping, minFilter: LinearFilter,
        magFilter: LinearFilter, generateMipmaps: false, colorSpace: NoColorSpace, needsUpdate: true,
    });
    const panoMats = [0, 1].map(isWindow => raw(PANO_VERT, PANO_FRAG, { uTex: { value: texture }, uK, uWindow: { value: isWindow } }, { side: DoubleSide }));
    const panoScene = new Scene().add(meshOf(panoGeo, panoMats));

    const layerMat = raw(LAYER_VERT, LAYER_FRAG, { uK }, { side: DoubleSide });
    const layerScene = new Scene();
    const layerGeos = [];
    const addLayer = ({ record, depth: z, rgba }) => {
        const g = layerGrid(record, z, rgba);
        const geo = geometryOf({ position: [g.position, 3], color: [g.color, 3, true], src: [g.src, 2] }, g.index);
        layerScene.add(meshOf(geo, layerMat));
        layerGeos.push(geo);
    };
    layers.forEach(addLayer);

    const tri = new BufferGeometry();
    tri.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const compMat = raw(COMP_VERT, COMP_FRAG, { c0: { value: null }, a0: { value: null }, c1: { value: null }, a1: { value: null }, uView: { value: 0 } },
        { depthTest: false, depthWrite: false });
    const compScene = new Scene().add(meshOf(tri, compMat));
    // Any camera: the composite's vertex shader ignores it. Not a bare Camera, which has no
    // updateProjectionMatrix() for three's reverse-depth switch to call.
    const flat = new OrthographicCamera();

    // Colour + aux for each pass, at the size last drawn. Float depth: reverse depth needs it.
    let T = null;
    const dropTargets = () => {
        if (T) { T.pano.dispose(); T.layers.dispose(); } // a target's dispose frees its depth texture
        T = null;
    };
    const targets = (w, h) => {
        if (T?.w === w && T?.h === h) return T;
        dropTargets();
        const mk = () => new WebGLRenderTarget(w, h, {
            count: 2, type: FloatType, minFilter: NearestFilter, magFilter: NearestFilter,
            depthTexture: new DepthTexture(w, h, FloatType),
        });
        return (T = { w, h, pano: mk(), layers: mk() });
    };
    const size = new Vector2();

    return {
        far: manifest.far ?? 4 * P.sky, // the spike's records: 4x the dome
        /** The pano camera's height above the ground, scene units (`groundBelow`). */
        ground: groundBelow(depth, P.w, P.h),
        /**
         * Draw the scene from `camera` into `out` (a render target the size of the picture)
         * or, without one, the canvas. The camera's aspect must be the target's.
         * @param {{ out?: WebGLRenderTarget|null, view?: number }} [o]  view 1 = holes magenta
         */
        draw(renderer, camera, { out = null, view = 0 } = {}) {
            const [w, h] = out ? [out.width, out.height] : renderer.getDrawingBufferSize(size).toArray();
            const t = targets(w, h);
            renderer.setRenderTarget(t.pano);
            renderer.render(panoScene, camera);
            renderer.setRenderTarget(t.layers);
            renderer.render(layerScene, camera);
            const U = compMat.uniforms;
            [U.c0.value, U.a0.value, U.c1.value, U.a1.value, U.uView.value] = [t.pano.textures[0], t.pano.textures[1], t.layers.textures[0], t.layers.textures[1], view];
            renderer.setRenderTarget(out);
            renderer.render(compScene, flat);
            renderer.setRenderTarget(null);
        },
        /** Mesh one more fill layer into the scene (Take picture's lifted fill). */
        addLayer,
        /** Free the float targets (Take picture needs Klein's VRAM); the next draw rebuilds them. */
        dropTargets,
        dispose() {
            dropTargets();
            [panoGeo, tri, ...layerGeos].forEach(g => g.dispose());
            [...panoMats, layerMat, compMat].forEach(m => m.dispose());
            texture.dispose();
            image.close?.();
        },
    };
}

/**
 * Render the picture a pose takes, at `size` (`pictureSize`): the frame with rule C holes,
 * read back top-down. `rgba` is the frame (holes black), `mask` is white where Klein must
 * fill, `z` the camera z of every known pixel (0 = hole: sceneLift's known depth),
 * `backFrac` the share of the frame where the pano is seen from behind (the INTERIOR switch),
 * `record` the camera as a layer's pinhole record.
 * @returns {{ w: number, h: number, rgba: Uint8ClampedArray, mask: Uint8ClampedArray,
 *   z: Float32Array, holeFrac: number, backFrac: number, record: Object }}
 */
export function renderPicture(view, renderer, pose, { w, h }) {
    const camera = new PerspectiveCamera(50, w / h, NEAR, view.far);
    applyPose(camera, pose);
    const out = new WebGLRenderTarget(w, h, { type: FloatType, depthBuffer: false, minFilter: NearestFilter, magFilter: NearestFilter });
    const col = new Float32Array(w * h * 4), aux = new Float32Array(w * h * 4);
    try {
        view.draw(renderer, camera, { out });
        renderer.readRenderTargetPixels(out, 0, 0, w, h, col);
        view.draw(renderer, camera, { out, view: 3 });
        renderer.readRenderTargetPixels(out, 0, 0, w, h, aux);
    } finally {
        out.dispose();
    }
    const rgba = new Uint8ClampedArray(w * h * 4), mask = new Uint8ClampedArray(w * h * 4), z = new Float32Array(w * h);
    let holes = 0, back = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const o = ((h - 1 - y) * w + x) * 4, k = y * w + x, q = k * 4; // GL rows are bottom-up
        const known = col[o + 3] > 0.5;
        for (let c = 0; c < 3; c++) rgba[q + c] = known ? Math.floor(Math.min(Math.max(col[o + c], 0), 1) * 255) : 0;
        rgba[q + 3] = 255;
        mask.fill(known ? 0 : 255, q, q + 3);
        mask[q + 3] = 255;
        z[k] = known ? aux[o] : 0;
        if (!known) holes++;
        if (aux[o + 1] > 0.5) back++;
    }
    return { w, h, rgba, mask, z, holeFrac: holes / (w * h), backFrac: back / (w * h), record: layerCamera(camera, pose.mm, w, h) };
}
