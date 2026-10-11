/**
 * MpiToolOptionsVideoMask — Organism: the video workspace's Text mask tool (MPI-1073).
 *
 * The image Text tool's shape (MpiToolOptionsMaskText), on a clip: name the object,
 * Detect, and SAM3's VIDEO tracker follows it through every frame of the trim range.
 * The run is `runGifCutoutTrack` unchanged (the GIF cut-out's By name), fed a
 * downscaled copy of the range from `POST /video-extract/source`. Its masks land on the
 * viewer, which tints each frame as the clip plays, and the shared MpiMaskStrip
 * (brush: false) ends in Extract — `routes/videoExtract.js` cuts the full-res clip.
 *
 * One difference from the image tool, agreed with Fabio (2026-10-11): a track WRITES
 * the mask, there is no Add / Subtract. A re-run replaces it. The count tops out at 4,
 * the graph's fixed `max_objects`.
 *
 * Props:
 * @param {object} viewer      - MpiVideoViewer instance
 * @param {object} currentItem - the video history entry on screen
 *
 * Requires on viewer.el:
 *   enterMaskMode(), exitMaskMode(), setVideoMasks(), getRange(), setGenerating(),
 *   plus the MpiMaskStrip mask surface.
 */

import { ComponentFactory }  from '../../factory.js';
import { MpiInput }          from '../../Primitives/MpiInput/MpiInput.js';
import { MpiButton }         from '../../Primitives/MpiButton/MpiButton.js';
import { MpiMaskStrip }      from '../../Compounds/MpiMaskStrip/MpiMaskStrip.js';
import { qs }                from '../../../utils/dom.js';
import { Events }            from '../../../events.js';
import { state }             from '../../../state.js';
import { getToolSettings }   from '../../../data/projectModel.js';
import { stampDetectionCount } from '../../../utils/maskTextPrompt.js';
import { runGifCutoutTrack } from '../../../services/commandExecutor.js';
import { StatusBar }         from '../../../shell/statusBar.js';
import { clientLogger }      from '../../../services/clientLogger.js';

const DEFAULTS = { textPrompt: '', textCount: 1 };
const MAX_OBJECTS = 4;
const QUEUE_DISABLED_REASON = 'Detection is unavailable while Cue has running or queued jobs';

export const MpiToolOptionsVideoMask = ComponentFactory.create({
    name: 'MpiToolOptionsVideoMask',
    css: ['js/components/Organisms/MpiToolOptionsVideoMask/MpiToolOptionsVideoMask.css'],

    template: () => `
        <div class="mpi-tool-options-video-mask">
            <p class="mpi-tool-options-video-mask__info">
                Name what to mask — <b>person</b>, <b>dog</b>, <b>car</b>. Detect follows it
                through the whole range, then Extract keeps only what is masked.
            </p>
            <div class="mpi-tool-options-video-mask__row">
                <div class="mpi-tool-options-video-mask__prompt" id="prompt-slot"></div>
                <div class="mpi-tool-options-video-mask__count"  id="count-slot"></div>
            </div>
            <div class="mpi-tool-options-video-mask__detect" id="detect-slot"></div>
            <div id="strip-slot"></div>
        </div>
    `,

    setup: (el, props) => {
        const { viewer } = props;
        let currentItem = props.currentItem ?? null;
        const _children = [];
        let _exec = null;
        let _busy = false;
        let _stopped = false;
        let _destroyed = false;

        viewer.el.enterMaskMode?.();

        const settings = { ...DEFAULTS, ...getToolSettings(state.currentProject || {}, 'videoMask', DEFAULTS) };
        let _raw   = typeof settings.textPrompt === 'string' ? settings.textPrompt : '';
        let _count = Math.min(MAX_OBJECTS, Math.max(1, Math.round(Number(settings.textCount) || 1)));

        const promptInput = MpiInput.mount(qs('#prompt-slot', el), {
            type: 'text', value: _raw, placeholder: 'person, dog',
            info: 'What to mask. Separate several with commas.',
        });
        promptInput.on('input', ({ value }) => {
            _raw = value;
            Events.emit('settings:tool:update', { toolKey: 'videoMask', key: 'textPrompt', value });
        });
        _children.push(promptInput);

        const countInput = MpiInput.mount(qs('#count-slot', el), {
            type: 'number', value: _count, min: 1, max: MAX_OBJECTS, step: 1, size: 'sm',
            info: 'How many of them to follow (up to 4)',
        });
        countInput.on('change', ({ value }) => {
            _count = value;
            Events.emit('settings:tool:update', { toolKey: 'videoMask', key: 'textCount', value });
        });
        _children.push(countInput);

        // ONE button re-mounted between Detect and Stop — MpiMaskDetectRow's idiom and
        // its reason: mount() replaces the slot, and `.mpi-btn` outranks `[hidden]`.
        const detectSlot = qs('#detect-slot', el);
        let detectBtn = null;
        const _blocked = () => (state.generationQueueCount || 0) > 0;
        function _mountDetectBtn() {
            detectBtn?.destroy?.();
            detectBtn = MpiButton.mount(detectSlot, _busy
                ? { icon: 'stop',   label: 'Stop',   size: 'sm', variant: 'primary', info: 'Stop the detection' }
                : { icon: 'search', label: 'Detect', size: 'sm', variant: 'primary',
                    info: _blocked() ? QUEUE_DISABLED_REASON : 'Find it in every frame of the range' });
            detectBtn.el.setDisabled?.(!_busy && _blocked());
            detectBtn.on('click', () => {
                if (_busy) { _stopped = true; _exec?.cancel?.(); return; }
                if (!_blocked()) _run();
            });
        }
        _mountDetectBtn();
        const _offQueue = Events.onState('generationQueueCount', () => { if (!_busy) _mountDetectBtn(); });

        function _setBusy(on, outcome = 'cancel') {
            if (on === _busy) return;
            _busy = on;
            if (on) {
                StatusBar.progress.prepare('Tracking');
                StatusBar.progress.setIndeterminate(true);
                StatusBar.progress.startClock();
            } else if (outcome === 'done') {
                StatusBar.progress.complete();
            } else {
                StatusBar.progress.cancel();
            }
            viewer.el.setGenerating?.(on);
            _mountDetectBtn();
        }

        async function _run() {
            const raw = _raw.trim();
            if (!raw) { StatusBar.notify('Name what to mask first', 'warning'); return; }
            const folderPath = state.currentProject?.folderPath;
            const item = currentItem;
            if (!folderPath || !item?.filePath) return;
            const range = viewer.el.getRange?.();
            const trimIn  = Number.isFinite(+range?.in)  ? +range.in  : 0;
            const trimOut = Number.isFinite(+range?.out) && +range.out > trimIn ? +range.out : Number(item.duration) || 0;

            _setBusy(true);
            _stopped = false;
            let landed = false;
            try {
                const res = await fetch('/video-extract/source', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ folderPath, sourcePath: item.filePath, trimIn, trimOut }),
                });
                const src = await res.json().catch(() => null);
                if (!res.ok || !src?.success) throw new Error(src?.error || `video-extract/source ${res.status}`);
                if (_destroyed) return;
                if (_stopped) { _setBusy(false); return; }

                const exec = runGifCutoutTrack({
                    op: 'gifCutoutSam3',
                    videoPath: src.videoPath,
                    textPrompt: stampDetectionCount(raw, _count),
                    objectIndices: '',
                });
                _exec = exec;
                exec.onMasks = (urls) => {
                    // A track belongs to the clip it ran on; the user may have moved on.
                    if (_destroyed || _exec !== exec || !urls?.length || currentItem !== item) return;
                    if (src.frameCount && urls.length !== src.frameCount) {
                        clientLogger.warn('MpiToolOptionsVideoMask', `${urls.length} masks for ${src.frameCount} frames`);
                    }
                    viewer.el.setVideoMasks?.({ urls, trimIn, trimOut, fps: src.fps });
                    landed = true;
                };
                exec.onError = (err) => clientLogger.warn('MpiToolOptionsVideoMask', 'track failed', err);
                exec.onDone = () => {
                    if (_exec === exec) _exec = null;
                    if (_destroyed) return;
                    if (!landed && !_stopped) StatusBar.notify(`Nothing found for "${raw}"`, 'warning');
                    _setBusy(false, landed ? 'done' : 'cancel');
                };
            } catch (err) {
                clientLogger.warn('MpiToolOptionsVideoMask', 'source encode failed', err);
                StatusBar.notify('Could not prepare the clip: ' + err.message, 'error');
                if (!_destroyed) _setBusy(false);
            }
        }

        // No brush pair: painting a clip frame by frame is a separate tool.
        _children.push(MpiMaskStrip.mount(qs('#strip-slot', el), { viewer, brush: false }));

        el.setCurrentItem = (next) => { currentItem = next ?? null; };

        el.destroy = () => {
            _destroyed = true;
            _offQueue();
            _exec?.cancel?.();
            if (_busy) { StatusBar.progress.cancel(); viewer.el.setGenerating?.(false); }
            viewer.el.exitMaskMode?.();
            detectBtn?.destroy?.();
            _children.forEach(c => c.destroy?.());
        };
    },
});
