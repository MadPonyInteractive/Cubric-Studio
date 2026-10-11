/**
 * MpiSceneBlock — the Scene workspace (Block, MPI-623).
 *
 * Opened by a left-click on a card that HAS a scene (`getSceneItem`, plan A9), behind
 * `APP_CONFIG.dev_mode` until the feature ships (A8). Routed as `PAGE_SCENE` with
 * `{ groupId }`, exactly like Group History.
 *
 * Loads the card's scene (`js/services/scene/sceneViewer.js`) into the viewport and flies a
 * camera through it: hold W/A/S/D to move, Q/E down/up, Z/C to roll, Shift to fly faster
 * (`scene.fly.*` hotkeys), drag to look, Up / Down for the lens. Draws on demand: a frame per
 * move, a loop only while a key is held. The view fills the stage (`createSceneView`, hole rule C).
 *
 * A path tool (P3, Fabio 2026-10-10): pictures come from the path video's 360 player, so the
 * panel holds only the camera path and the view. The path (plan P1, for Wan to render): P or Add
 * point drops a ball where the camera is, from the pano's centre on (`scenePath.js`); balls and
 * line drawn over the view (`view.setPath`), saved on the pano item as `cameraPaths`. Render path
 * (P2, `scenePathVideo.js`) renders the path's guide here, steered by the optional line above it,
 * then Wan turns it into a 360 video card (the generation queue); the panel is free again once
 * the engine has the guide. The lens is shared with the player (`Storage.getSceneShot`).
 * The card stays on its pano (Fabio, 2026-10-08): opening a card left on an older picture entry
 * puts its `selectedIndex` back on the pano.
 *
 * Instance API (on el):
 *   getPose()      — the camera pose `{ pos, yaw, pitch, roll, mm }` (spot coords)
 *   getPath()      — the camera path's points, scene coords
 *   setPose(pose)  — move the camera there (a test's fixed view)
 *   isLoaded()     — true once the scene is drawn
 */

import { ComponentFactory } from '../../factory.js';
import { MpiSceneCanvas } from '../../Primitives/MpiSceneCanvas/MpiSceneCanvas.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { qs, on } from '../../../utils/dom.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';
import { getSceneItem } from '../../../utils/assetKinds.js';
import { Hotkeys } from '../../../managers/hotkeyManager.js';
import { Storage } from '../../../core/storage.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { updateGroup } from '../../../services/projectService.js';
import {
    START_POSE, NEAR, EYE_HEIGHT_M, FLY_BOOST, loadScene, createSceneView, applyPose, flyStep, flyLook,
} from '../../../services/scene/sceneViewer.js';
import { appIo } from '../../../services/scene/scenePicture.js';
import { addPoint, removeLast, frameCount } from '../../../services/scene/scenePath.js';
import { renderPath, pathEtaMin } from '../../../services/scene/scenePathVideo.js';
import { remoteEngineClient } from '../../../services/remoteEngineClient.js';
import { pluginAvailability, getPlugin } from '../../../data/pluginsRegistry.js';

const FLY_DIRS = ['forward', 'back', 'left', 'right', 'up', 'down', 'rollLeft', 'rollRight'];
/** The lens slider's stops, full-frame mm: the usual prime lengths. */
const LENSES = [12, 14, 16, 20, 24, 28, 35, 50, 85];
/** The stop nearest `mm` (a pose saved off the stops still lands on one). */
const lensStop = (mm) => LENSES.reduce((best, v, i) => (Math.abs(v - mm) < Math.abs(LENSES[best] - mm) ? i : best), 0);
const PATH_STEPS = {
    style: 'Reading the scene\'s style...', upload: 'Sending the guide to the engine...',
};
const wanStep = (min) => `Wan is rendering the path${min ? `: about ${min} minute${min === 1 ? '' : 's'} on this GPU` : ''}. It lands as a new card in the gallery.`;
/** The card the Wan run lands on: the Pod's, or this machine's by its nvidia-smi name. */
const wanGpu = async () => (remoteEngineClient.effectiveEngine() === 'remote'
    ? remoteEngineClient.podGpuType()
    : (await fetch('/system/gpu-info').then(r => r.json()).catch(() => null))?.gpu?.name);

/** A colour token as sRGB bytes: three cannot read oklch, a 2D canvas can. */
const tokenRgb = (node, name) => {
    const g = new OffscreenCanvas(1, 1).getContext('2d');
    g.fillStyle = getComputedStyle(node).getPropertyValue(name).trim();
    g.fillRect(0, 0, 1, 1);
    return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
};
const PATH_HINT = 'Fly to a spot and press P to add a point. A path starts where the pano was taken.';

export const MpiSceneBlock = ComponentFactory.create({
    name: 'MpiSceneBlock',
    css: ['js/components/Blocks/MpiSceneBlock/MpiSceneBlock.css'],

    template: () => `
        <div class="mpi-scene-block">
            <div class="mpi-scene-block__stage"><div class="mpi-scene-block__viewport" id="viewport"></div></div>
            <div class="mpi-scene-block__panel">
                <section class="mpi-scene-block__section">
                    <div class="mpi-scene-block__label">Path</div>
                    <div class="mpi-scene-block__readout" id="path-readout"></div>
                    <div class="mpi-scene-block__path">
                        <div class="mpi-scene-block__path-add" id="path-add"></div><div id="path-undo"></div><div id="path-clear"></div>
                    </div>
                    <div class="mpi-scene-block__label">Steer the video</div>
                    <div id="fill"></div>
                    <div class="mpi-scene-block__render" id="path-render"></div>
                    <div class="mpi-scene-block__status" id="path-status"></div>
                </section>
                <section class="mpi-scene-block__section">
                    <div class="mpi-scene-block__label">Lens</div>
                    <div class="mpi-scene-block__lens">
                        <div class="mpi-scene-block__lens-slider" id="lens"></div>
                        <span class="mpi-scene-block__lens-value" id="lens-value"></span>
                    </div>
                    <div class="mpi-scene-block__readout" id="readout"></div>
                    <div class="mpi-scene-block__reset" id="view-reset"></div>
                </section>
            </div>
        </div>
    `,

    setup: (el, props) => {
        const readout = qs('#readout', el);
        const viewport = MpiSceneCanvas.mount(qs('#viewport', el), {});
        const canvasEl = viewport.el;

        // The last lens sticks, shared with the 360 player (which also keeps the aspect there).
        const shotMm = Storage.getSceneShot().mm;
        let pose = { ...START_POSE, mm: LENSES.includes(shotMm) ? shotMm : START_POSE.mm };
        let fillLine = '';
        let view = null;
        let busy = false;
        let raf = 0;
        let last = 0;
        let drag = null;
        let destroyed = false;
        let boost = 1; // FLY_BOOST while Shift is held
        const held = new Set();
        const loading = new AbortController();
        const liveGroup = () => state.currentProject?.itemGroups?.find(g => g.id === props.groupId) || null;

        const lensValue = qs('#lens-value', el);
        const lensPick = MpiProgressBar.mount(qs('#lens', el), {
            interactive: true, handle: true, wheel: true, min: 0, max: LENSES.length - 1, step: 1, value: lensStop(pose.mm),
            info: 'Lens, full-frame millimetres: lower sees wider (Up / Down)',
        });
        const fillInput = MpiInput.mount(qs('#fill', el), {
            placeholder: 'Empty continues the scene', info: 'Tells Wan what the path walks into',
        });
        const group = liveGroup();
        const sceneItem = group ? getSceneItem(group) : null;
        const panoIndex = group && sceneItem ? group.history.indexOf(sceneItem) : 0;
        if (group && sceneItem && group.selectedIndex !== panoIndex) {
            updateGroup({ ...group, selectedIndex: panoIndex }) // a card left on a picture shows its pano again
                .catch(err => clientLogger.warn('scene', `putting the card back on its pano failed: ${err?.message || err}`));
        }
        const pathReadout = qs('#path-readout', el);
        const addBtn = MpiButton.mount(qs('#path-add', el), {
            icon: 'plus', label: 'Add point', size: 'sm', disabled: true, info: 'Add a path point where the camera is (P)',
        });
        const undoBtn = MpiButton.mount(qs('#path-undo', el), {
            icon: 'minus', size: 'sm', disabled: true, info: 'Remove the last point',
        });
        const clearBtn = MpiButton.mount(qs('#path-clear', el), {
            icon: 'trash', size: 'sm', disabled: true, info: 'Clear the whole path',
        });
        const renderBtn = MpiButton.mount(qs('#path-render', el), {
            text: 'Render path', variant: 'primary', size: 'md', disabled: true,
            info: 'Wan renders a 360 video along the path and invents what it walks into. It lands as a new card',
        });
        const resetBtn = MpiButton.mount(qs('#view-reset', el), {
            icon: 'refresh', label: 'Reset view', size: 'sm', info: 'Back to where the pano was taken, looking ahead',
        });
        const pathStatus = qs('#path-status', el);
        // The camera path (plan P1), on the pano item: one path for now, `cameraPaths` leaves room for more.
        let pathPoints = sceneItem?.cameraPaths?.[0]?.points || [];
        const showPath = () => {
            pathReadout.textContent = pathPoints.length ? `${pathPoints.length} points` : PATH_HINT;
            [undoBtn, clearBtn].forEach(b => b.el.setDisabled(!pathPoints.length));
            renderBtn.el.setDisabled(!view || busy || pathPoints.length < 2);
            if (!view) return;
            view.setPath(pathPoints, { start: tokenRgb(el, '--accent-frost'), point: tokenRgb(el, '--accent-heat') });
            canvasEl.requestRender();
        };
        const savePath = async (next) => {
            if (next === pathPoints) return;
            pathPoints = next;
            showPath();
            const project = state.currentProject, live = liveGroup();
            if (!project || !live || !sceneItem) return;
            const cameraPaths = next.length ? [{ points: next }] : [];
            try { // the sidecar holds item fields (project.json keeps ids); the live item mirrors it (plan A7)
                await (await appIo()).post(`/project-media/${project.id}/update-meta?folderPath=${encodeURIComponent(project.folderPath)}`,
                    { itemId: sceneItem.id, updates: { cameraPaths } });
                await updateGroup({ ...live, history: live.history.map(it => (it.id === sceneItem.id ? { ...it, cameraPaths } : it)) });
            } catch (err) {
                clientLogger.warn('scene', `saving the camera path failed: ${err?.message || err}`);
            }
        };
        const addHere = () => { if (view) savePath(addPoint(pathPoints, pose.pos, view.ground)); };

        const showReadout = () => {
            const metres = view ? EYE_HEIGHT_M * (1 + pose.pos[1] / view.ground) : EYE_HEIGHT_M;
            const roll = Math.round((pose.roll || 0) * 180 / Math.PI);
            readout.textContent = `Height ${metres.toFixed(2)} m · roll ${roll}°`;
            lensValue.textContent = `${pose.mm} mm`;
        };
        const show = () => {
            showReadout();
            const camera = canvasEl.getCamera();
            if (!camera) return;
            applyPose(camera, pose);
            canvasEl.requestRender();
        };

        const tick = (now) => {
            raf = 0;
            pose = flyStep(pose, held, Math.min(0.1, (now - last) / 1000), boost);
            last = now;
            show();
            if (held.size) raf = requestAnimationFrame(tick);
        };
        const press = (dir) => {
            held.add(dir);
            if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
        };

        // P2: the path as a 360 video. Busy only until the engine has the guide: the Wan run
        // (30 min on a 4060 Ti) goes through the generation queue and lands as a card by itself.
        const renderVideo = async () => {
            const project = state.currentProject;
            if (busy || !view || !project || pathPoints.length < 2) return;
            if (!pluginAvailability('scene-path').installed) {
                Events.emit('ui:warning', { title: 'Render path',
                    message: `${getPlugin('scene-path')?.title || '3D Scene path video'} is not installed. Add it from the Model Library (Plugins).` });
                return;
            }
            busy = true;
            renderBtn.el.setDisabled(true);
            let freed = false;
            const free = () => {
                if (freed) return;
                freed = true;
                busy = false;
                if (!destroyed) { showPath(); show(); }
            };
            try {
                const frames = frameCount(pathPoints, view.ground); // a short path renders fewer, sooner
                const eta = pathEtaMin(await wanGpu(), frames);
                await renderPath({
                    project, sceneItem, view, renderer: canvasEl.getRenderer(), points: pathPoints, frames, fillLine,
                    onStep: (step, at) => {
                        if (destroyed) return;
                        pathStatus.textContent = step === 'guide' ? `Rendering the guide: frame ${at.frame} of ${at.of}...`
                            : step === 'wan' ? wanStep(eta) : PATH_STEPS[step] || '';
                        if (step === 'wan') { view?.dropTargets(); free(); } // Wan needs the VRAM the float targets hold
                    },
                }, await appIo());
                if (!destroyed) pathStatus.textContent = 'The path video is in the gallery.';
                Events.emit('ui:success', { message: 'Path video ready: it is in the gallery.' });
            } catch (err) {
                // The same path pressed again while its video renders: the status line is still that run's.
                if (err?.code === 'rendering') {
                    Events.emit('ui:info', { message: 'This path is already rendering. It lands in the gallery when it is done.' });
                    return;
                }
                if (!destroyed) pathStatus.textContent = '';
                if (err?.message !== 'cancelled') {
                    clientLogger.warn('scene', `render path failed: ${err?.message || err}`);
                    Events.emit('ui:warning', { message: `Render path failed: ${err?.message || err}` });
                }
            } finally {
                free();
            }
        };

        // Each fly key and its `.shift` twin (pressed or released under Shift) move the same way.
        // ponytail: a fly key released with Ctrl down arrives as `control+w` and is not seen;
        // the key stays held until the window loses focus. Add Ctrl twins if it bites.
        const unbinds = [
            ...FLY_DIRS.flatMap(dir => ['', '.shift'].flatMap(mod => [
                Hotkeys.bind(`scene.fly.${dir}${mod}`, () => press(dir)),
                Hotkeys.bind(`scene.fly.${dir}${mod}.release`, () => held.delete(dir)),
            ])),
            Hotkeys.bind('scene.fly.boost', () => { boost = FLY_BOOST; }),
            Hotkeys.bind('scene.fly.boost.release', () => { boost = 1; }),
            Hotkeys.bind('scene.path.add', addHere),
            Hotkeys.bind('scene.lens.up', () => stepLens(1)),
            Hotkeys.bind('scene.lens.down', () => stepLens(-1)),
        ];
        const offs = [
            on(canvasEl, 'pointerdown', (e) => { drag = [e.clientX, e.clientY]; canvasEl.setPointerCapture(e.pointerId); }),
            on(canvasEl, 'pointerup', () => { drag = null; }),
            on(canvasEl, 'pointermove', (e) => {
                if (!drag) return;
                pose = flyLook(pose, e.clientX - drag[0], e.clientY - drag[1]);
                drag = [e.clientX, e.clientY];
                show();
            }),
            on(window, 'blur', () => { held.clear(); boost = 1; }),
        ];
        viewport.on('resize', show);
        const keepShot = () => Storage.setSceneShot({ ...Storage.getSceneShot(), mm: pose.mm });
        // Up / Down: one lens stop longer / wider, like the slider.
        const stepLens = (d) => {
            const i = Math.max(0, Math.min(LENSES.length - 1, lensStop(pose.mm) + d));
            if (LENSES[i] === pose.mm) return;
            pose = { ...pose, mm: LENSES[i] };
            lensPick.el.setValueQuiet(i);
            show();
            keepShot();
        };
        lensPick.on('input', ({ value }) => { pose = { ...pose, mm: LENSES[value] }; show(); keepShot(); });
        fillInput.on('input', ({ value }) => { fillLine = value; });
        addBtn.on('click', addHere);
        undoBtn.on('click', () => savePath(removeLast(pathPoints)));
        clearBtn.on('click', () => savePath([]));
        renderBtn.on('click', renderVideo);
        // The start pose again; the lens is a setting that sticks, so it stays.
        resetBtn.on('click', () => { pose = { ...START_POSE, pos: [...START_POSE.pos], mm: pose.mm }; show(); });

        if (sceneItem?.scenePath && canvasEl.isSupported()) {
            loadScene(sceneItem.scenePath, { signal: loading.signal })
                .then((data) => {
                    if (destroyed) { data.image.close?.(); return; }
                    view = createSceneView(data);
                    Object.assign(canvasEl.getCamera(), { near: NEAR, far: view.far });
                    canvasEl.setDraw((renderer, camera) => view.draw(renderer, camera));
                    addBtn.el.setDisabled(false);
                    showPath();
                    show();
                })
                .catch((err) => {
                    if (!destroyed) clientLogger.warn('scene', `scene load failed: ${err?.message || err}`);
                });
        }
        showReadout();
        showPath();

        el.getPose = () => ({ ...pose, pos: [...pose.pos] });
        el.getPath = () => pathPoints.map(p => [...p]);
        el.isLoaded = () => !!view;
        el.setPose = (next) => {
            pose = { ...START_POSE, ...next, pos: [...(next?.pos || START_POSE.pos)] };
            lensPick.el.setValueQuiet(lensStop(pose.mm));
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
            [lensPick, fillInput, addBtn, undoBtn, clearBtn, renderBtn, resetBtn].forEach(c => c.destroy());
            viewport.destroy();
        };
    },
});
