/**
 * MpiSceneBlock — the Scene workspace (Block, MPI-623).
 *
 * Opened by a left-click on a card that HAS a scene (`getSceneItem`, plan A9), behind
 * `APP_CONFIG.dev_mode` until the feature ships (A8). Routed as `PAGE_SCENE` with
 * `{ groupId }`, exactly like Group History.
 *
 * Loads the card's scene (`js/services/scene/sceneViewer.js`) into the viewport and flies a
 * camera through it: hold W/A/S/D to move, Q/E down/up, Z/C to roll, Shift to fly faster
 * (`scene.fly.*` hotkeys), drag to look. Draws on demand: a frame per move, a loop only while
 * a key is held. The frame is the scene with hole rule C (`createSceneView`), letterboxed to
 * the picture's aspect: what Take picture starts from (plan A1, "the viewer IS the shot").
 *
 * The picture panel (plan Design 4): frame aspect, a lens slider, a height / lens / roll
 * readout, the fill line, Take picture (`scenePicture.js`: inpaint -> lift -> layer ->
 * clean-up -> one history entry with its `scenePose`), and the card's pictures, where a
 * click flies the camera back to where one was taken. Depth of field waits on spike 0c.
 * The card stays on its pano (Fabio, 2026-10-08): the gallery always shows the pano, so
 * picking a picture here never moves the card's `selectedIndex`, and opening a card left on
 * a picture puts it back.
 * Build here (tools strip) fills the six views round the camera into the scene first, layers
 * only (`buildHere`); a second press stops it after the running view.
 * The camera path (plan P1, for Wan to render): P or Add point drops a ball where the camera is,
 * from the pano's centre on (`scenePath.js`); balls and line drawn over the frame
 * (`view.setPath`), saved on the pano item as `cameraPaths`. Render path (P2, `scenePathVideo.js`)
 * renders the path's guide here, then Wan turns it into a 360 video card (~30 min, the
 * generation queue); the panel is free again once the engine has the guide.
 *
 * Instance API (on el):
 *   getPose()      — the camera pose `{ pos, yaw, pitch, roll, mm }` (spot coords)
 *   getPath()      — the camera path's points, scene coords
 *   setPose(pose)  — move the camera there (a picture entry's pose, a test's fixed view)
 *   isLoaded()     — true once the scene is drawn
 */

import { ComponentFactory } from '../../factory.js';
import { MpiSceneCanvas } from '../../Primitives/MpiSceneCanvas/MpiSceneCanvas.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiRadioGroup } from '../../Primitives/MpiRadioGroup/MpiRadioGroup.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
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
    START_POSE, NEAR, EYE_HEIGHT_M, FLY_BOOST, loadScene, createSceneView, applyPose, flyStep, flyLook,
} from '../../../services/scene/sceneViewer.js';
import { takePicture, buildHere, appIo } from '../../../services/scene/scenePicture.js';
import { addPoint, removeLast } from '../../../services/scene/scenePath.js';
import { renderPath, pathEtaMin } from '../../../services/scene/scenePathVideo.js';
import { remoteEngineClient } from '../../../services/remoteEngineClient.js';
import { pluginAvailability, getPlugin } from '../../../data/pluginsRegistry.js';

const FLY_DIRS = ['forward', 'back', 'left', 'right', 'up', 'down', 'rollLeft', 'rollRight'];
const ASPECTS = ['16:9', '9:16', '1:1', '2.39:1'];
/** The lens slider's stops, full-frame mm: the usual prime lengths. */
const LENSES = [12, 14, 16, 20, 24, 28, 35, 50, 85];
/** The stop nearest `mm` (a pose saved off the stops still lands on one). */
const lensStop = (mm) => LENSES.reduce((best, v, i) => (Math.abs(v - mm) < Math.abs(LENSES[best] - mm) ? i : best), 0);
const STEPS = {
    render: 'Rendering the frame...', style: 'Reading the scene\'s style...', fill: 'Filling the empty areas...', lift: 'Placing the fill in the scene...',
    clean: 'Cleaning up the picture...', save: 'Saving the picture...',
};
const PATH_STEPS = {
    style: 'Reading the scene\'s style...', upload: 'Sending the guide to the engine...',
};
const wanStep = (min) => `Wan is rendering the path${min ? `: about ${min} minute${min === 1 ? '' : 's'} on this GPU` : ''}. It lands as a new card in the gallery.`;
/** The card the Wan run lands on: the Pod's, or this machine's by its nvidia-smi name. */
const wanGpu = async () => (remoteEngineClient.effectiveEngine() === 'remote'
    ? remoteEngineClient.podGpuType()
    : (await fetch('/system/gpu-info').then(r => r.json()).catch(() => null))?.gpu?.name);

const ratioOf = (aspect) => { const [a, b] = aspect.split(':').map(Number); return a / b; };
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
            <div class="mpi-scene-block__stage">
                <div class="mpi-scene-block__frame" id="frame"><div class="mpi-scene-block__viewport" id="viewport"></div></div>
                <div class="mpi-scene-block__tools"><div id="bake"></div><div id="build"></div></div>
            </div>
            <div class="mpi-scene-block__panel">
                <div class="mpi-scene-block__label">Frame</div>
                <div id="aspect"></div>
                <div class="mpi-scene-block__label">Lens</div>
                <div class="mpi-scene-block__lens">
                    <div class="mpi-scene-block__lens-slider" id="lens"></div>
                    <span class="mpi-scene-block__lens-value" id="lens-value"></span>
                </div>
                <div class="mpi-scene-block__readout" id="readout"></div>
                <div class="mpi-scene-block__label">Fill the empty areas with</div>
                <div id="fill"></div>
                <div id="take"></div>
                <div class="mpi-scene-block__status" id="status"></div>
                <div class="mpi-scene-block__label">Path</div>
                <div class="mpi-scene-block__path"><div id="path-add"></div><div id="path-undo"></div><div id="path-clear"></div></div>
                <div class="mpi-scene-block__readout" id="path-readout"></div>
                <div id="path-render"></div>
                <div class="mpi-scene-block__status" id="path-status"></div>
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
        const bake = MpiButton.mount(qs('#bake', el), {
            icon: 'cube', label: 'Bake 3D', variant: 'ghost', size: 'sm', disabled: true,
            info: 'Coming soon: bake the whole scene into full 3D',
        });
        const BUILD = { icon: 'layers', label: 'Build here' };
        const buildBtn = MpiButton.mount(qs('#build', el), {
            ...BUILD, variant: 'ghost', size: 'sm', disabled: true,
            info: 'Fill everything round the camera into the scene, so pictures taken from here have it all',
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
        let boost = 1; // FLY_BOOST while Shift is held
        const held = new Set();
        const loading = new AbortController();
        const liveGroup = () => state.currentProject?.itemGroups?.find(g => g.id === props.groupId) || null;

        const aspectPick = MpiRadioGroup.mount(qs('#aspect', el), {
            options: ASPECTS, value: aspect, name: 'scene-aspect', size: 'sm', columns: 4,
            info: 'The picture\'s shape: the frame shows exactly what it will hold',
        });
        const lensValue = qs('#lens-value', el);
        const lensPick = MpiProgressBar.mount(qs('#lens', el), {
            interactive: true, handle: true, wheel: true, min: 0, max: LENSES.length - 1, step: 1, value: lensStop(pose.mm),
            info: 'Lens, full-frame millimetres: lower sees wider',
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
        const panoIndex = group && sceneItem ? group.history.indexOf(sceneItem) : 0;
        if (group && sceneItem && group.selectedIndex !== panoIndex) {
            updateGroup({ ...group, selectedIndex: panoIndex }) // a card left on a picture shows its pano again
                .catch(err => clientLogger.warn('scene', `putting the card back on its pano failed: ${err?.message || err}`));
        }
        const historyList = MpiHistoryList.mount(qs('#history', el), {
            history: group?.history || [], selectedIndex: panoIndex,
        });
        const pathReadout = qs('#path-readout', el);
        const addBtn = MpiButton.mount(qs('#path-add', el), {
            icon: 'plus', label: 'Add point', size: 'sm', disabled: true, info: 'Add a path point where the camera is (P)',
        });
        const undoBtn = MpiButton.mount(qs('#path-undo', el), {
            icon: 'minus', label: 'Remove last', variant: 'ghost', size: 'sm', disabled: true, info: 'Take the last point off the path',
        });
        const clearBtn = MpiButton.mount(qs('#path-clear', el), {
            icon: 'trash', label: 'Clear', variant: 'ghost', size: 'sm', disabled: true, info: 'Remove the whole path',
        });
        const renderBtn = MpiButton.mount(qs('#path-render', el), {
            icon: 'video', label: 'Render path', size: 'md', disabled: true,
            info: 'Wan renders a 360 video along the path and invents what it walks into (about 30 min). The fill line above steers it',
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
            readout.textContent = `Height ${metres.toFixed(2)} m · ${pose.mm} mm · roll ${roll}°`;
            lensValue.textContent = `${pose.mm} mm`;
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
            pose = flyStep(pose, held, Math.min(0.1, (now - last) / 1000), boost);
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
            [takeBtn, buildBtn, renderBtn].forEach(b => b.el.setDisabled(true));
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
                if (!destroyed) { [takeBtn, buildBtn].forEach(b => b.el.setDisabled(!view)); showPath(); }
            }
        };

        let building = null; // the running build's AbortController; a second press stops it
        const build = async () => {
            if (building) {
                building.abort();
                buildBtn.el.setDisabled(true);
                status.textContent = 'Stopping after this view...';
                return;
            }
            const project = state.currentProject;
            if (busy || !view || !project) return;
            busy = true;
            building = new AbortController();
            const { signal } = building;
            [takeBtn, renderBtn].forEach(b => b.el.setDisabled(true));
            buildBtn.el.setLabel('Stop building');
            buildBtn.el.setIcon('stop');
            try {
                const layers = await buildHere({
                    project, sceneItem, view, renderer: canvasEl.getRenderer(), pose, fillLine, signal,
                    onStep: (step, at) => {
                        if (!signal.aborted) status.textContent = `View ${at.view} of ${at.of}: ${STEPS[step] || ''}`;
                        if (step !== 'render') view?.dropTargets(); // Klein's VRAM, as Take picture
                    },
                }, await appIo());
                if (destroyed) return;
                status.textContent = `Built here: ${layers.length} of 6 views filled.`;
            } catch (err) {
                if (destroyed) return;
                const stopped = err?.message === 'cancelled';
                status.textContent = stopped ? 'Build stopped. The views already filled stay in the scene.' : '';
                if (!stopped) {
                    clientLogger.warn('scene', `build here failed: ${err?.message || err}`);
                    Events.emit('ui:warning', { message: `Build here failed: ${err?.message || err}` });
                }
            } finally {
                busy = false;
                building = null;
                if (!destroyed) {
                    buildBtn.el.setLabel(BUILD.label);
                    buildBtn.el.setIcon(BUILD.icon);
                    [takeBtn, buildBtn].forEach(b => b.el.setDisabled(!view));
                    showPath();
                    show();
                }
            }
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
            [takeBtn, buildBtn, renderBtn].forEach(b => b.el.setDisabled(true));
            let freed = false;
            const free = () => {
                if (freed) return;
                freed = true;
                busy = false;
                if (!destroyed) { [takeBtn, buildBtn].forEach(b => b.el.setDisabled(!view)); showPath(); show(); }
            };
            try {
                const eta = pathEtaMin(await wanGpu());
                await renderPath({
                    project, sceneItem, view, renderer: canvasEl.getRenderer(), points: pathPoints, fillLine,
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
        aspectPick.on('select', ({ value }) => setAspect(value));
        lensPick.on('input', ({ value }) => { pose = { ...pose, mm: LENSES[value] }; show(); });
        fillInput.on('input', ({ value }) => { fillLine = value; });
        takeBtn.on('click', take);
        buildBtn.on('click', build);
        addBtn.on('click', addHere);
        undoBtn.on('click', () => savePath(removeLast(pathPoints)));
        clearBtn.on('click', () => savePath([]));
        renderBtn.on('click', renderVideo);
        // A picture flies the camera back to where it was taken; the card stays on its pano.
        historyList.on('entry-selected', ({ item }) => {
            if (!item?.scenePose) return; // the pano itself: no camera to fly to
            const { aspect: shotAspect, fillLine: _line, ...shotPose } = item.scenePose;
            if (ASPECTS.includes(shotAspect)) setAspect(shotAspect);
            el.setPose(shotPose);
            lensPick.el.setValueQuiet(lensStop(pose.mm));
        });

        if (sceneItem?.scenePath && canvasEl.isSupported()) {
            loadScene(sceneItem.scenePath, { signal: loading.signal })
                .then((data) => {
                    if (destroyed) { data.image.close?.(); return; }
                    view = createSceneView(data);
                    Object.assign(canvasEl.getCamera(), { near: NEAR, far: view.far });
                    canvasEl.setDraw((renderer, camera) => view.draw(renderer, camera));
                    [takeBtn, buildBtn, addBtn].forEach(b => b.el.setDisabled(false));
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
            show();
        };

        el.destroy = () => {
            destroyed = true;
            loading.abort();
            building?.abort();
            if (raf) cancelAnimationFrame(raf);
            unbinds.forEach(off => off());
            offs.forEach(off => off());
            if (view) {
                canvasEl.setDraw(null);
                view.dispose();
                view = null;
            }
            [bake, buildBtn, aspectPick, lensPick, fillInput, takeBtn, historyList, addBtn, undoBtn, clearBtn, renderBtn].forEach(c => c.destroy());
            viewport.destroy();
        };
    },
});
