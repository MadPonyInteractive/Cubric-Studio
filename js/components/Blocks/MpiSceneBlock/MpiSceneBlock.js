/**
 * MpiSceneBlock — the Scene workspace (Block, MPI-623).
 *
 * Opened by a left-click on a card that HAS a scene (`getSceneItem`, plan A9), behind
 * `APP_CONFIG.dev_mode` until the feature ships (A8). Routed as `PAGE_SCENE` with
 * `{ groupId }`, exactly like Group History.
 *
 * Loads the card's scene (`js/services/scene/sceneViewer.js`) into the viewport and flies a
 * camera through it: hold W/A/S/D to move, Q/E down/up, Z/C to roll (`scene.fly.*`
 * hotkeys), drag to look. Draws on demand: a frame per move, a loop only while a key is
 * held. The frame is the scene with hole rule C (`createSceneView`), letterboxed to the
 * picture's aspect: what Take picture starts from (plan A1, "the viewer IS the shot").
 *
 * The picture panel (plan Design 4): frame aspect, lens, a height / lens / roll readout, the
 * fill line with presets, Take picture (`scenePicture.js`: inpaint -> lift -> layer ->
 * clean-up -> one history entry with its `scenePose`), and the card's pictures, where a
 * click flies the camera back to where one was taken. Depth of field waits on spike 0c.
 *
 * Instance API (on el):
 *   getPose()      — the camera pose `{ pos, yaw, pitch, roll, mm }` (spot coords)
 *   setPose(pose)  — move the camera there (a picture entry's pose, a test's fixed view)
 *   isLoaded()     — true once the scene is drawn
 */

import { ComponentFactory } from '../../factory.js';
import { MpiSceneCanvas } from '../../Primitives/MpiSceneCanvas/MpiSceneCanvas.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiRadioGroup } from '../../Primitives/MpiRadioGroup/MpiRadioGroup.js';
import { MpiDropdown } from '../../Primitives/MpiDropdown/MpiDropdown.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiHistoryList } from '../../Compounds/MpiHistoryList/MpiHistoryList.js';
import { qs, on } from '../../../utils/dom.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';
import { getSceneItem } from '../../../utils/assetKinds.js';
import { Hotkeys } from '../../../managers/hotkeyManager.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { updateGroup } from '../../../services/projectService.js';
import {
    START_POSE, NEAR, EYE_HEIGHT_M, loadScene, createSceneView, applyPose, flyStep, flyLook,
} from '../../../services/scene/sceneViewer.js';
import { takePicture, appIo } from '../../../services/scene/scenePicture.js';

const FLY_DIRS = ['forward', 'back', 'left', 'right', 'up', 'down', 'rollLeft', 'rollRight'];
const ASPECTS = ['16:9', '9:16', '1:1', '2.39:1'];
const LENSES = [12, 16, 24, 35, 50, 85];
// ponytail: the plan's three presets; the free line covers the rest (Klein plants the
// line's nouns, so presets name AREAS, never landmarks).
const PRESETS = ['Forest', 'More houses', 'Open fields'];
const STEPS = {
    render: 'Rendering the frame...', fill: 'Filling the empty areas...', lift: 'Placing the fill in the scene...',
    clean: 'Cleaning up the picture...', save: 'Saving the picture...',
};

const ratioOf = (aspect) => { const [a, b] = aspect.split(':').map(Number); return a / b; };

export const MpiSceneBlock = ComponentFactory.create({
    name: 'MpiSceneBlock',
    css: ['js/components/Blocks/MpiSceneBlock/MpiSceneBlock.css'],

    template: () => `
        <div class="mpi-scene-block">
            <div class="mpi-scene-block__stage">
                <div class="mpi-scene-block__frame" id="frame"><div class="mpi-scene-block__viewport" id="viewport"></div></div>
                <div class="mpi-scene-block__tools" id="tools"></div>
            </div>
            <div class="mpi-scene-block__panel">
                <div class="mpi-scene-block__label">Frame</div>
                <div id="aspect"></div>
                <div class="mpi-scene-block__label">Lens</div>
                <div id="lens"></div>
                <div class="mpi-scene-block__readout" id="readout"></div>
                <div class="mpi-scene-block__label">Fill the empty areas with</div>
                <div id="preset"></div>
                <div id="fill"></div>
                <div id="take"></div>
                <div class="mpi-scene-block__status" id="status"></div>
                <div class="mpi-scene-block__label">Pictures</div>
                <div class="mpi-scene-block__history" id="history"></div>
            </div>
        </div>
    `,

    setup: (el, props) => {
        const frameEl = qs('#frame', el);
        const readout = qs('#readout', el);
        const status = qs('#status', el);
        const viewport = MpiSceneCanvas.mount(qs('#viewport', el), {});
        const canvasEl = viewport.el;
        // ponytail: inert on purpose - the Wan bake (a full 3D scene from a video orbit) is a
        // later card (plan Design 7); this only says it is coming.
        const bake = MpiButton.mount(qs('#tools', el), {
            icon: 'cube', label: 'Bake 3D', variant: 'ghost', size: 'sm', disabled: true,
            info: 'Coming soon: bake the whole scene into full 3D',
        });

        let pose = { ...START_POSE };
        let aspect = ASPECTS[0];
        let fillLine = '';
        let view = null;
        let busy = false;
        let raf = 0;
        let last = 0;
        let drag = null;
        let destroyed = false;
        const held = new Set();
        const loading = new AbortController();
        const liveGroup = () => state.currentProject?.itemGroups?.find(g => g.id === props.groupId) || null;

        const aspectPick = MpiRadioGroup.mount(qs('#aspect', el), {
            options: ASPECTS, value: aspect, name: 'scene-aspect', size: 'sm', columns: 4,
            info: 'The picture\'s shape: the frame shows exactly what it will hold',
        });
        const lensOptions = LENSES.map(mm => ({ label: `${mm} mm`, value: String(mm) }));
        const lensPick = MpiDropdown.mount(qs('#lens', el), {
            options: lensOptions, value: String(pose.mm), info: 'Lens, full-frame millimetres: lower sees wider',
        });
        const presetPick = MpiDropdown.mount(qs('#preset', el), {
            options: PRESETS, value: '', placeholder: 'Presets', info: 'Pick a line to steer what fills the empty areas',
        });
        const fillInput = MpiInput.mount(qs('#fill', el), {
            placeholder: 'Leave empty to continue the scene', info: 'Steers what Take picture paints into the empty areas',
        });
        const takeBtn = MpiButton.mount(qs('#take', el), {
            icon: 'camera', label: 'Take picture', size: 'md', disabled: true,
            info: 'Fill the empty areas, place the fill in the scene and save the picture to this card',
        });
        const group = liveGroup();
        const sceneItem = group ? getSceneItem(group) : null;
        const historyList = MpiHistoryList.mount(qs('#history', el), {
            history: group?.history || [], selectedIndex: group?.selectedIndex ?? 0,
        });

        const showReadout = () => {
            const metres = view ? EYE_HEIGHT_M * (1 + pose.pos[1] / view.ground) : EYE_HEIGHT_M;
            const roll = Math.round((pose.roll || 0) * 180 / Math.PI);
            readout.textContent = `Height ${metres.toFixed(2)} m · ${pose.mm} mm · roll ${roll}°`;
        };
        const show = () => {
            showReadout();
            const camera = canvasEl.getCamera();
            if (!camera) return;
            applyPose(camera, pose);
            canvasEl.requestRender();
        };
        const setAspect = (next) => {
            aspect = next;
            frameEl.style.setProperty('--frame-ar', ratioOf(aspect)); // the canvas's resize re-applies the pose
            aspectPick.el.setValue(aspect);
        };
        setAspect(aspect);

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

        const take = async () => {
            const project = state.currentProject, live = liveGroup();
            if (busy || !view || !project || !live) return;
            busy = true;
            takeBtn.el.setDisabled(true);
            try {
                const { entry } = await takePicture({
                    project, group: live, sceneItem, view, renderer: canvasEl.getRenderer(), pose, aspect, fillLine,
                    onStep: (step) => {
                        status.textContent = STEPS[step] || '';
                        // Klein needs the VRAM the float targets hold (spike 0a); the next draw rebuilds them.
                        if (step !== 'render') view?.dropTargets();
                    },
                }, await appIo());
                if (destroyed) return;
                historyList.el.appendEntry(entry);
                historyList.el.setActiveIndex((liveGroup()?.history.length || 1) - 1);
                status.textContent = 'Saved to this card\'s pictures.';
                show();
            } catch (err) {
                if (destroyed) return;
                clientLogger.warn('scene', `take picture failed: ${err?.message || err}`);
                status.textContent = '';
                if (err?.message !== 'cancelled') Events.emit('ui:warning', { message: `Take picture failed: ${err?.message || err}` });
            } finally {
                busy = false;
                if (!destroyed) takeBtn.el.setDisabled(!view);
            }
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
        aspectPick.on('select', ({ value }) => setAspect(value));
        lensPick.on('change', ({ value }) => { pose = { ...pose, mm: Number(value) }; show(); });
        presetPick.on('change', ({ value }) => { fillLine = value; fillInput.el.setValue(value); });
        fillInput.on('input', ({ value }) => { fillLine = value; });
        takeBtn.on('click', take);
        historyList.on('entry-selected', ({ idx, item }) => {
            const live = liveGroup();
            if (live && live.selectedIndex !== idx) {
                updateGroup({ ...live, selectedIndex: idx })
                    .catch(err => clientLogger.warn('scene', `selecting a picture failed: ${err?.message || err}`));
            }
            if (!item?.scenePose) return; // the pano itself: no camera to fly to
            const { aspect: shotAspect, fillLine: _line, ...shotPose } = item.scenePose;
            if (ASPECTS.includes(shotAspect)) setAspect(shotAspect);
            el.setPose(shotPose);
            lensPick.el.setOptions(lensOptions, String(pose.mm));
        });

        if (sceneItem?.scenePath && canvasEl.isSupported()) {
            loadScene(sceneItem.scenePath, { signal: loading.signal })
                .then((data) => {
                    if (destroyed) { data.image.close?.(); return; }
                    view = createSceneView(data);
                    Object.assign(canvasEl.getCamera(), { near: NEAR, far: view.far });
                    canvasEl.setDraw((renderer, camera) => view.draw(renderer, camera));
                    takeBtn.el.setDisabled(false);
                    show();
                })
                .catch((err) => {
                    if (!destroyed) clientLogger.warn('scene', `scene load failed: ${err?.message || err}`);
                });
        }
        showReadout();

        el.getPose = () => ({ ...pose, pos: [...pose.pos] });
        el.isLoaded = () => !!view;
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
            if (view) {
                canvasEl.setDraw(null);
                view.dispose();
                view = null;
            }
            [bake, aspectPick, lensPick, presetPick, fillInput, takeBtn, historyList].forEach(c => c.destroy());
            viewport.destroy();
        };
    },
});
