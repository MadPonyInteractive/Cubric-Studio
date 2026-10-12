/**
 * MpiPanoVideoBlock — the 360 player for a scene's path video (Block, MPI-623 P3).
 *
 * Opened like the Scene workspace (`PAGE_SCENE`, `{ groupId }`)
 * when the card is a path video or a video marked by Convert to 360 video (`getPathVideoItem`):
 * navigation picks this Block by card.
 * Plays the video wrapped round the camera (`panoVideo.js`): drag to look while it plays,
 * stop on a frame with the scrubber, frame a shot with the aspect and lens as the Scene
 * panel does, Take picture: that exact view, cleaned up by Klein, lands as a new image card.
 * The look is relative to the path's heading, so the view rides along with the path's turns.
 *
 * Instance API (on el):
 *   getPose()      — the view `{ pos, yaw, pitch, roll, mm }` (pos always the sphere's centre)
 *   setPose(pose)  — turn the view there (a test's fixed view)
 *   getFrame()     — the frame on screen, 0-based
 *   seekFrame(k)   — pause on frame `k`; resolves once it is on screen
 *   isLoaded()     — true once the first frame is drawn
 */

import { ComponentFactory } from '../../factory.js';
import { MpiSceneCanvas } from '../../Primitives/MpiSceneCanvas/MpiSceneCanvas.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiRadioGroup } from '../../Primitives/MpiRadioGroup/MpiRadioGroup.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { qs, on } from '../../../utils/dom.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';
import { getPathVideoItem } from '../../../utils/assetKinds.js';
import { resolveMediaUrl } from '../../../utils/mediaActions.js';
import { Hotkeys } from '../../../managers/hotkeyManager.js';
import { bindQueueSlideOver } from '../../../shell/queueSlideOver.js';
import { Storage } from '../../../core/storage.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { START_POSE, applyPose, flyLook } from '../../../services/scene/sceneViewer.js';
import { appIo } from '../../../services/scene/scenePicture.js';
import { createPanoView, takeVideoPicture } from '../../../services/scene/panoVideo.js';

const ASPECTS = ['16:9', '9:16', '1:1', '2.39:1'];
/** The Scene panel's lens stops, full-frame mm. */
const LENSES = [12, 14, 16, 20, 24, 28, 35, 50, 85];
const lensStop = (mm) => LENSES.reduce((best, v, i) => (Math.abs(v - mm) < Math.abs(LENSES[best] - mm) ? i : best), 0);
const STEPS = { render: 'Rendering the frame...', clean: 'Cleaning up the picture...', save: 'Saving the picture...' };
const ratioOf = (aspect) => { const [a, b] = aspect.split(':').map(Number); return a / b; };

export const MpiPanoVideoBlock = ComponentFactory.create({
    name: 'MpiPanoVideoBlock',
    css: ['js/components/Blocks/MpiPanoVideoBlock/MpiPanoVideoBlock.css'],

    template: () => `
        <div class="mpi-pano-video-block">
            <div class="mpi-pano-video-block__stage">
                <div class="mpi-pano-video-block__frame" id="frame"><div class="mpi-pano-video-block__viewport" id="viewport"></div></div>
            </div>
            <div class="mpi-pano-video-block__panel">
                <div class="mpi-pano-video-block__label">Video</div>
                <div class="mpi-pano-video-block__transport">
                    <div id="play"></div>
                    <div class="mpi-pano-video-block__scrub" id="scrub"></div>
                </div>
                <div class="mpi-pano-video-block__readout" id="readout"></div>
                <div class="mpi-pano-video-block__label">Frame</div>
                <div id="aspect"></div>
                <div class="mpi-pano-video-block__label">Lens</div>
                <div class="mpi-pano-video-block__lens">
                    <div class="mpi-pano-video-block__lens-slider" id="lens"></div>
                    <span class="mpi-pano-video-block__lens-value" id="lens-value"></span>
                </div>
                <div id="take"></div>
                <div class="mpi-pano-video-block__status" id="status"></div>
            </div>
        </div>
    `,

    setup: (el, props) => {
        const frameEl = qs('#frame', el);
        const readout = qs('#readout', el);
        const status = qs('#status', el);
        const lensValue = qs('#lens-value', el);
        const viewport = MpiSceneCanvas.mount(qs('#viewport', el), {});
        const canvasEl = viewport.el;
        const group = state.currentProject?.itemGroups?.find(g => g.id === props.groupId) || null;
        const videoItem = getPathVideoItem(group);
        const fps = Number(videoItem?.fps) || 16;
        const frames = Number(videoItem?.frameCount) || 81;

        // The last Frame aspect + Lens stick, shared with the Scene panel.
        const shot = Storage.getSceneShot();
        let pose = { ...START_POSE, mm: LENSES.includes(shot.mm) ? shot.mm : START_POSE.mm };
        let aspect = ASPECTS.includes(shot.aspect) ? shot.aspect : ASPECTS[0];
        let view = null;
        let busy = false;
        let drag = null;
        let destroyed = false;
        let frame = 0;
        let frameCb = 0;

        const playBtn = MpiButton.mount(qs('#play', el), { icon: 'play', variant: 'ghost', size: 'sm', disabled: true, info: 'Play or pause' });
        const scrub = MpiProgressBar.mount(qs('#scrub', el), {
            interactive: true, handle: true, min: 0, max: frames - 1, step: 1, value: 0, info: 'Pick the frame to take a picture of',
        });
        const aspectPick = MpiRadioGroup.mount(qs('#aspect', el), {
            options: ASPECTS, value: aspect, name: 'pano-video-aspect', size: 'sm', columns: 4,
            info: 'The picture\'s shape: the frame shows exactly what it will hold',
        });
        const lensPick = MpiProgressBar.mount(qs('#lens', el), {
            interactive: true, handle: true, wheel: true, min: 0, max: LENSES.length - 1, step: 1, value: lensStop(pose.mm),
            info: 'Lens, full-frame millimetres: lower sees wider',
        });
        const takeBtn = MpiButton.mount(qs('#take', el), {
            icon: 'camera', label: 'Take picture', size: 'md', disabled: true,
            info: 'Clean up this view of the frame and save it as a new card',
        });

        // The video is a texture source, never shown: not a UI element.
        const video = document.createElement('video');
        Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'auto' });

        const showReadout = () => {
            readout.textContent = `Frame ${frame + 1} of ${frames} · ${pose.mm} mm`;
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

        // One draw per decoded frame while it plays; none while paused.
        const onFrame = (_now, meta) => {
            frameCb = 0;
            if (destroyed) return;
            frame = Math.min(frames - 1, Math.round(meta.mediaTime * fps));
            scrub.el.setValueQuiet(frame);
            show();
            if (!video.paused) frameCb = video.requestVideoFrameCallback(onFrame);
        };
        const setPlaying = (playing) => {
            playBtn.el.setIcon(playing ? 'pause' : 'play');
            if (playing && !frameCb) frameCb = video.requestVideoFrameCallback(onFrame);
        };
        const seekFrame = (k) => new Promise((resolve) => {
            video.pause();
            frame = Math.max(0, Math.min(frames - 1, Math.round(k)));
            scrub.el.setValueQuiet(frame);
            const off = on(video, 'seeked', () => {
                off();
                if (!destroyed) { view?.refresh(); show(); }
                resolve();
            });
            video.currentTime = (frame + 0.5) / fps; // the middle of the frame: lands on it, not the one before
        });

        const take = async () => {
            const project = state.currentProject;
            if (busy || !view || !project) return;
            busy = true;
            takeBtn.el.setDisabled(true);
            if (!video.paused) await seekFrame(frame); // the picture is of a still frame
            try {
                await takeVideoPicture({
                    project, view, renderer: canvasEl.getRenderer(), pose, aspect, frame, videoItem,
                    onStep: (step) => { if (!destroyed) status.textContent = STEPS[step] || ''; },
                }, await appIo());
                if (!destroyed) status.textContent = 'Saved as a new card in the gallery.';
            } catch (err) {
                if (destroyed) return;
                clientLogger.warn('scene', `pano video picture failed: ${err?.message || err}`);
                status.textContent = '';
                if (err?.message !== 'cancelled') Events.emit('ui:warning', { message: `Take picture failed: ${err?.message || err}` });
            } finally {
                busy = false;
                if (!destroyed) takeBtn.el.setDisabled(!view);
            }
        };

        const offs = [
            on(canvasEl, 'pointerdown', (e) => { drag = [e.clientX, e.clientY]; canvasEl.setPointerCapture(e.pointerId); }),
            on(canvasEl, 'pointerup', () => { drag = null; }),
            on(canvasEl, 'pointermove', (e) => {
                if (!drag) return;
                pose = flyLook(pose, e.clientX - drag[0], e.clientY - drag[1]);
                drag = [e.clientX, e.clientY];
                show();
            }),
            on(video, 'play', () => setPlaying(true)),
            on(video, 'pause', () => setPlaying(false)),
            on(video, 'error', () => { if (!destroyed) clientLogger.warn('scene', `path video failed to load: ${video.error?.message || video.error?.code}`); }),
        ];
        const togglePlay = () => {
            if (!view) return;
            if (video.paused) video.play().catch(() => {});
            else video.pause();
        };
        // The Video Player's keys: Space plays, Left / Right step a frame (pausing, like the scrubber).
        const unbinds = [
            Hotkeys.bind('video.playPause', togglePlay),
            Hotkeys.bind('video.frame.back', () => { if (view) seekFrame(frame - 1); }),
            Hotkeys.bind('video.frame.forward', () => { if (view) seekFrame(frame + 1); }),
            Hotkeys.bind('scene.lens.up', () => stepLens(1)),
            Hotkeys.bind('scene.lens.down', () => stepLens(-1)),
            ...bindQueueSlideOver(), // Q: nothing flies here
        ];
        const keepShot = () => Storage.setSceneShot({ aspect, mm: pose.mm });
        // Up / Down: one lens stop longer / wider, like the slider.
        const stepLens = (d) => {
            const i = Math.max(0, Math.min(LENSES.length - 1, lensStop(pose.mm) + d));
            if (LENSES[i] === pose.mm) return;
            pose = { ...pose, mm: LENSES[i] };
            lensPick.el.setValueQuiet(i);
            show();
            keepShot();
        };
        viewport.on('resize', show);
        playBtn.on('click', togglePlay);
        scrub.on('input', ({ value }) => { seekFrame(value); });
        aspectPick.on('select', ({ value }) => { setAspect(value); keepShot(); });
        lensPick.on('input', ({ value }) => { pose = { ...pose, mm: LENSES[value] }; show(); keepShot(); });
        takeBtn.on('click', take);

        if (videoItem?.filePath && canvasEl.isSupported()) {
            const off = on(video, 'loadeddata', () => {
                off();
                if (destroyed) return;
                view = createPanoView(video);
                canvasEl.setDraw((renderer, camera) => view.draw(renderer, camera));
                [playBtn, takeBtn].forEach(b => b.el.setDisabled(false));
                seekFrame(0);
            });
            video.src = resolveMediaUrl(videoItem.filePath);
        }
        showReadout();

        el.getPose = () => ({ ...pose, pos: [...pose.pos] });
        el.setPose = (next) => { pose = { ...START_POSE, ...next, pos: [0, 0, 0] }; lensPick.el.setValueQuiet(lensStop(pose.mm)); show(); };
        el.getFrame = () => frame;
        el.seekFrame = seekFrame;
        el.isLoaded = () => !!view;

        el.destroy = () => {
            destroyed = true;
            if (frameCb) video.cancelVideoFrameCallback(frameCb);
            offs.forEach(off => off());
            unbinds.forEach(off => off());
            video.pause();
            if (view) {
                canvasEl.setDraw(null);
                view.dispose();
                view = null;
            }
            video.removeAttribute('src');
            video.load(); // drops the decoder
            [playBtn, scrub, aspectPick, lensPick, takeBtn].forEach(c => c.destroy());
            viewport.destroy();
        };
    },
});
