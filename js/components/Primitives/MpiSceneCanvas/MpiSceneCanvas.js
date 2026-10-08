/**
 * MpiSceneCanvas — the 3D scene viewport (Primitive, MPI-623).
 *
 * Owns ONE WebGL2 context through a three.js `WebGLRenderer` (MIT, `RENDERER_OPTIONS`:
 * reverse depth) and the `PerspectiveCamera` it draws from. WHAT it draws is the owner's
 * `setDraw(fn)` (the Scene Block hands it `createSceneView().draw`: two passes and a
 * composite, so a single three `Scene` cannot hold it); this component owns the context's
 * life, which is why its teardown is the point of it.
 *
 * Draws ON DEMAND, never in a free-running loop: `requestRender()` schedules one frame. An
 * idle viewer holds no GPU time, and Take picture needs Klein's VRAM headroom (plan 0a).
 *
 * The canvas is transparent: the surface colour comes from the stylesheet's token, so the
 * GL clear never needs a colour parsed out of CSS.
 *
 * No WebGL2 (blocklisted driver, a GPU-less E2E run) → the `--unsupported` modifier shows
 * a note instead, and every instance method is a no-op.
 *
 * Emits:
 *   'resize' { width, height } — after the camera took the new aspect (a lens set in mm
 *                                 must be re-applied: it depends on the aspect)
 *
 * Instance API (on el):
 *   getRenderer() / getCamera() — null when unsupported or destroyed
 *   setDraw(fn)      — `fn(renderer, camera)` draws a frame; null draws nothing
 *   requestRender()  — draw one frame on the next animation frame
 *   renderNow()      — draw one frame now (a readback in the same task needs it)
 *   isSupported()    — false when no WebGL2 context could be made
 *   destroy()        — cancel the frame, disconnect the observer, dispose the renderer,
 *                      LOSE the context, zero the canvas, drop every reference
 */

import { ComponentFactory } from '../../factory.js';
import { qs } from '../../../utils/dom.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { WebGLRenderer, PerspectiveCamera } from '../../../../node_modules/three/build/three.module.js';
import { RENDERER_OPTIONS, NEAR } from '../../../services/scene/sceneViewer.js';

export const MpiSceneCanvas = ComponentFactory.create({
    name: 'MpiSceneCanvas',
    css: ['js/components/Primitives/MpiSceneCanvas/MpiSceneCanvas.css'],

    template: () => `
        <div class="mpi-scene-canvas">
            <canvas class="mpi-scene-canvas__surface" id="surface"></canvas>
            <div class="mpi-scene-canvas__note">This computer's graphics cannot draw a 3D scene (no WebGL2).</div>
        </div>
    `,

    setup: (el, props, emit) => {
        let canvas = qs('#surface', el);
        let renderer = null;
        let camera = null;
        let draw = null;
        let observer = null;
        let raf = 0;

        try {
            renderer = new WebGLRenderer({ canvas, ...RENDERER_OPTIONS });
            renderer.setClearColor(0x000000, 0);
            renderer.setPixelRatio(window.devicePixelRatio || 1);
            camera = new PerspectiveCamera(60, 1, NEAR, 1000);
            // three falls back to plain depth without EXT_clip_control; at a 1e-4 near plane
            // that is too coarse for rule C's z-test, so say so where a bug report will show it.
            if (!renderer.capabilities.reversedDepthBuffer) clientLogger.warn('scene', 'no EXT_clip_control: reverse depth is off, near depth will be coarse');
        } catch (err) {
            // three throws when getContext('webgl2') returns null.
            clientLogger.warn('scene', `no WebGL2 context: ${err?.message || err}`);
            renderer = null;
            el.classList.add('mpi-scene-canvas--unsupported');
        }

        const _draw = () => {
            raf = 0;
            if (renderer && draw) draw(renderer, camera);
        };

        el.setDraw = (fn) => {
            draw = fn;
            el.requestRender();
        };
        el.requestRender = () => {
            if (renderer && !raf) raf = requestAnimationFrame(_draw);
        };
        el.renderNow = () => {
            if (raf) cancelAnimationFrame(raf);
            _draw();
        };

        if (renderer) {
            // ponytail: devicePixelRatio is read once; a window dragged to a monitor with a
            // different scale keeps the old ratio until the workspace remounts.
            observer = new ResizeObserver(([entry]) => {
                const { width, height } = entry.contentRect;
                // Hidden is not resized (MPI-597): an overlay's stash reports 0x0.
                if (!width || !height) return;
                renderer.setSize(width, height, false);
                camera.aspect = width / height;
                camera.updateProjectionMatrix();
                emit('resize', { width, height });
                el.requestRender();
            });
            observer.observe(el);
        }

        el.getRenderer = () => renderer;
        el.getCamera = () => camera;
        el.isSupported = () => !!renderer;

        el.destroy = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
            observer?.disconnect();
            if (renderer) {
                renderer.dispose();
                // dispose() frees three's caches but leaves the context alive until GC,
                // and Chromium caps live contexts (~16): ten Scene visits would start
                // killing the oldest. Losing it explicitly releases the GPU memory now.
                renderer.forceContextLoss();
            }
            if (canvas) { canvas.width = 0; canvas.height = 0; }
            renderer = camera = draw = observer = canvas = null;
        };
    },
});
