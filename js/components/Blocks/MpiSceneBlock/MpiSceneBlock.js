/**
 * MpiSceneBlock — the Scene workspace (Block, MPI-623).
 *
 * Opened by a left-click on a card that HAS a scene (`getSceneItem`, plan A9), behind
 * `APP_CONFIG.dev_mode` until the feature ships (A8). Routed as `PAGE_SCENE` with
 * `{ groupId }`, exactly like Group History.
 *
 * Loads the card's scene (`js/services/scene/sceneViewer.js`) into the viewport and flies a
 * camera through it: hold W/A/S/D to move, Q/E down/up (`scene.fly.*` hotkeys), drag to
 * look. Draws on demand: a frame per move, a loop only while a fly key is held. Rule C,
 * the picture panel and Take picture land on top of this (plan Phase 3).
 *
 * Instance API (on el):
 *   getPose()      — the camera pose `{ pos, yaw, pitch, mm }` (spot coords, sceneViewer.js)
 *   setPose(pose)  — move the camera there (a picture entry's pose, a test's fixed view)
 */

import { ComponentFactory } from '../../factory.js';
import { MpiSceneCanvas } from '../../Primitives/MpiSceneCanvas/MpiSceneCanvas.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { qs, on } from '../../../utils/dom.js';
import { state } from '../../../state.js';
import { getSceneItem } from '../../../utils/assetKinds.js';
import { Hotkeys } from '../../../managers/hotkeyManager.js';
import { clientLogger } from '../../../services/clientLogger.js';
import {
    START_POSE, loadScene, createPanoMesh, applyPose, flyStep, flyLook,
} from '../../../services/scene/sceneViewer.js';

const FLY_DIRS = ['forward', 'back', 'left', 'right', 'up', 'down'];

export const MpiSceneBlock = ComponentFactory.create({
    name: 'MpiSceneBlock',
    css: ['js/components/Blocks/MpiSceneBlock/MpiSceneBlock.css'],

    template: () => `
        <div class="mpi-scene-block">
            <div class="mpi-scene-block__viewport" id="viewport"></div>
            <div class="mpi-scene-block__tools" id="tools"></div>
        </div>
    `,

    setup: (el, props) => {
        const viewport = MpiSceneCanvas.mount(qs('#viewport', el), {});
        const canvasEl = viewport.el;
        // ponytail: inert on purpose - the Wan bake (a full 3D scene from a video orbit) is a
        // later card (plan Design 7); this only says it is coming.
        const bake = MpiButton.mount(qs('#tools', el), {
            icon: 'cube', label: 'Bake 3D', variant: 'ghost', size: 'sm', disabled: true,
            info: 'Coming soon: bake the whole scene into full 3D',
        });

        let pose = { ...START_POSE };
        let pano = null;
        let raf = 0;
        let last = 0;
        let drag = null;
        let destroyed = false;
        const held = new Set();
        const loading = new AbortController();

        const show = () => {
            const camera = canvasEl.getCamera();
            if (!camera) return;
            applyPose(camera, pose);
            canvasEl.requestRender();
        };

        const tick = (now) => {
            raf = 0;
            pose = flyStep(pose, held, Math.min(0.1, (now - last) / 1000));
            last = now;
            show();
            if (held.size) raf = requestAnimationFrame(tick);
        };
        const press = (dir) => {
            held.add(dir);
            if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
        };

        // ponytail: a fly key released with Shift/Ctrl down arrives as `shift+w` and is not
        // seen; the key stays held until the window loses focus. Add modifier releases if it bites.
        const unbinds = FLY_DIRS.flatMap(dir => [
            Hotkeys.bind(`scene.fly.${dir}`, () => press(dir)),
            Hotkeys.bind(`scene.fly.${dir}.release`, () => held.delete(dir)),
        ]);
        const offs = [
            on(canvasEl, 'pointerdown', (e) => { drag = [e.clientX, e.clientY]; canvasEl.setPointerCapture(e.pointerId); }),
            on(canvasEl, 'pointerup', () => { drag = null; }),
            on(canvasEl, 'pointermove', (e) => {
                if (!drag) return;
                pose = flyLook(pose, e.clientX - drag[0], e.clientY - drag[1]);
                drag = [e.clientX, e.clientY];
                show();
            }),
            on(window, 'blur', () => held.clear()),
        ];
        viewport.on('resize', show);

        const group = state.currentProject?.itemGroups?.find(g => g.id === props.groupId);
        const scenePath = group ? getSceneItem(group)?.scenePath : null;
        if (scenePath && canvasEl.isSupported()) {
            loadScene(scenePath, { signal: loading.signal })
                .then((data) => {
                    if (destroyed) { data.image.close?.(); return; }
                    pano = createPanoMesh(data);
                    canvasEl.getScene().add(pano.mesh);
                    show();
                })
                .catch((err) => {
                    if (!destroyed) clientLogger.warn('scene', `scene load failed: ${err?.message || err}`);
                });
        }

        el.getPose = () => ({ ...pose, pos: [...pose.pos] });
        el.setPose = (next) => {
            pose = { ...START_POSE, ...next, pos: [...(next?.pos || START_POSE.pos)] };
            show();
        };

        el.destroy = () => {
            destroyed = true;
            loading.abort();
            if (raf) cancelAnimationFrame(raf);
            unbinds.forEach(off => off());
            offs.forEach(off => off());
            if (pano) {
                canvasEl.getScene()?.remove(pano.mesh);
                pano.dispose();
                pano = null;
            }
            bake.destroy();
            viewport.destroy();
        };
    },
});
