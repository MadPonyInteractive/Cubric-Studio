/**
 * MpiGifControlBar — GIF transport bar, sibling to MpiVideoControlBar (MPI-769,
 * plan E6).
 *
 * MpiVideoControlBar is seconds-over-fps against a `<video>` element and takes
 * no per-frame delays — a GIF's delays are per-frame, not constant, so this is
 * a SIBLING component rather than a video-bar prop, reusing the same visual
 * language (play / step / frame counter / embedded MpiTrimBar) but driving a
 * MpiGifViewer INSTANCE directly instead of an `<video>` surface.
 *
 * The Block wires it the same way it wires the video bar to a surface —
 * `gifControlBar.el.attachViewer(viewerInstance)`, where `viewerInstance` is
 * the object `MpiGifViewer.mount()` returned (has `.on()`), not `.el`.
 *
 * The trim bar's domain is FRAME INDEX, not seconds: `fps: 1`,
 * `duration: frameCount - 1`, so `MpiTrimBar`'s own frame-indexed `_pctOf`
 * mapping (`docs/video-player.md` § the frame-index coordinate law) lines up
 * a scrub position with a frame 1:1 regardless of that frame's real-world
 * delay. The Trim tool (MPI-772) reads the range through getRange().
 *
 * Hotkeys reuse the EXISTING `video.playPause` / `video.frame.back` /
 * `video.frame.forward` ids (space / ← / →) rather than new `gif.*` ones — a
 * Group History card mounts EITHER this bar or MpiVideoControlBar, never
 * both, so the two never compete for the same keypress; each gates on its
 * own `_canDrive()`, exactly like two live MpiVideoControlBars already do
 * (`docs/video-player.md` § "A bar you cannot see must not answer the
 * keyboard").
 *
 * Instance API (on el):
 *   attachViewer(viewerInstance) — wire to a MpiGifViewer instance
 *   detachViewer()               — drop viewer listeners + hotkeys
 *   setFrameCount(n)             — refresh the trim bar / counter bounds; a new
 *                                  count resets the range to every frame
 *   getRange()                   — { in, out } trim handles (frame indices)
 *   destroy()
 *
 * Emits:
 *   'range-change' { in, out } — trim handles moved, or a new frame count reset
 *                                them (frame indices)
 */

import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiTrimBar } from '../../Compounds/MpiTrimBar/MpiTrimBar.js';
import { qs } from '../../../utils/dom.js';
import { Hotkeys } from '../../../managers/hotkeyManager.js';

export const MpiGifControlBar = ComponentFactory.create({
    name: 'MpiGifControlBar',
    css: ['js/components/Organisms/MpiGifControlBar/MpiGifControlBar.css'],

    template: () => `
        <div class="mpi-gif-control-bar" data-no-toggle>
            <div class="mpi-gif-control-bar__left">
                <div data-mount="play"></div>
                <div data-mount="frame-back"></div>
                <div data-mount="frame-forward"></div>
                <div class="mpi-gif-control-bar__count">
                    <span class="mpi-gif-control-bar__current">0000</span>
                    <span class="mpi-gif-control-bar__separator">/</span>
                    <span class="mpi-gif-control-bar__total">0000</span>
                </div>
            </div>

            <div class="mpi-gif-control-bar__trim" data-mount="trim"></div>

            <div class="mpi-gif-control-bar__right">
                <div data-mount="preview-toggle"></div>
            </div>
        </div>
    `,

    setup: (el, props, emit) => {
        let _viewer = null; // instance returned by MpiGifViewer.mount() (has .el + .on)
        let _viewerUnsubs = [];
        const _hotkeyUnsubs = [];
        let _frameCount = 0;

        const playBtn      = MpiButton.mount(qs('[data-mount="play"]', el),          { icon: 'play', iconActive: 'pause', size: 'sm', info: 'Play/Pause (SPACE)' });
        const frameBackBtn = MpiButton.mount(qs('[data-mount="frame-back"]', el),    { icon: 'frameBack', size: 'sm', info: 'Previous Frame (←)' });
        const frameFwdBtn  = MpiButton.mount(qs('[data-mount="frame-forward"]', el), { icon: 'frameForward', size: 'sm', info: 'Next Frame (→)' });
        const previewBtn   = MpiButton.mount(qs('[data-mount="preview-toggle"]', el), { icon: 'gif', size: 'sm', info: 'GIF preview (built file)' });

        const trim = MpiTrimBar.mount(qs('[data-mount="trim"]', el), {
            duration: 0, fps: 1, value: 0, inPoint: 0, outPoint: 0,
        });

        const curEl = qs('.mpi-gif-control-bar__current', el);
        const totEl = qs('.mpi-gif-control-bar__total', el);

        const _fmt = (n) => String(Math.max(0, Math.round(n) || 0)).padStart(4, '0');
        const _renderCount = () => {
            curEl.textContent = _fmt(_viewer?.el.getFrameIndex() ?? 0);
            totEl.textContent = _fmt(Math.max(0, _frameCount - 1));
        };

        /** Same guard as MpiVideoControlBar._canDrive() — a stashed/hidden bar
         *  (MpiOverlay's Stash Pattern) must not answer the keyboard. */
        const _canDrive = () => !!_viewer && el.isConnected && el.getClientRects().length > 0;

        const _togglePlay = () => {
            if (!_viewer) return;
            if (_viewer.el.isPlaying()) _viewer.el.pause();
            else _viewer.el.play();
        };

        playBtn.on('click', _togglePlay);
        frameBackBtn.on('click', () => _viewer?.el.stepFrame(-1));
        frameFwdBtn.on('click',  () => _viewer?.el.stepFrame(+1));
        previewBtn.on('click', () => {
            if (!_viewer) return;
            _viewer.el.togglePreview();
        });

        trim.on('seek',         ({ time }) => _viewer?.el.setFrameIndex(time));
        trim.on('seek-preview', ({ time }) => _viewer?.el.setFrameIndex(time));
        trim.on('range-change', ({ in: i, out: o }) => emit('range-change', { in: i, out: o }));

        el.attachViewer = (viewerInstance) => {
            if (!viewerInstance?.el || _viewer === viewerInstance) return;
            el.detachViewer();
            _viewer = viewerInstance;

            _frameCount = _viewer.el.getFrameCount();
            trim.el.setFps(1);
            trim.el.setDuration(Math.max(0, _frameCount - 1));
            trim.el.setFrameCount(_frameCount);
            trim.el.setRangeQuiet(0, Math.max(0, _frameCount - 1));
            trim.el.setValueQuiet(_viewer.el.getFrameIndex());
            _renderCount();
            playBtn.el.classList.toggle('is-active', _viewer.el.isPlaying());
            previewBtn.el.classList.toggle('is-active', _viewer.el.isPreview());
            // The Mask Brush paints frames; the viewer refuses preview there.
            previewBtn.el.setDisabled(_viewer.el.isMaskEditing());

            const _addCb = (event, cb) => {
                let active = true;
                _viewer.on(event, (payload) => { if (active) cb(payload); });
                return () => { active = false; };
            };
            _viewerUnsubs.push(
                _addCb('frame-change', ({ idx }) => {
                    trim.el.setValueQuiet(idx);
                    _renderCount();
                }),
                _addCb('play',  () => playBtn.el.classList.add('is-active')),
                _addCb('pause', () => playBtn.el.classList.remove('is-active')),
                _addCb('preview-change', ({ preview }) => previewBtn.el.classList.toggle('is-active', preview)),
                _addCb('edit-change', ({ editing }) => previewBtn.el.setDisabled(editing)),
            );

            const hk = (id, fn) => _hotkeyUnsubs.push(
                Hotkeys.bind(id, () => { if (_canDrive()) fn(); }),
            );
            hk('video.playPause',     () => _togglePlay());
            hk('video.frame.back',    () => _viewer.el.stepFrame(-1));
            hk('video.frame.forward', () => _viewer.el.stepFrame(+1));
        };

        el.detachViewer = () => {
            while (_viewerUnsubs.length) {
                const fn = _viewerUnsubs.pop();
                try { fn(); } catch (_) { /* noop */ }
            }
            while (_hotkeyUnsubs.length) {
                const fn = _hotkeyUnsubs.pop();
                try { fn(); } catch (_) { /* noop */ }
            }
            _viewer = null;
        };

        el.setFrameCount = (n) => {
            const next = Number.isFinite(+n) && +n > 0 ? +n : 0;
            const changed = next !== _frameCount;
            _frameCount = next;
            trim.el.setFrameCount(_frameCount);
            trim.el.setDuration(Math.max(0, _frameCount - 1));
            // attachViewer() runs before any frame loads, so the range it set
            // is the one-frame minimum; setDuration() only clamps it. A new
            // count gets the full range.
            // The range itself is never persisted: the Trim tool (MPI-772) keeps it
            // by saving the trimmed frames as a new entry. A reset still announces
            // itself so the Trim panel's frame note stays true.
            if (changed) {
                trim.el.setRangeQuiet(0, Math.max(0, _frameCount - 1));
                emit('range-change', el.getRange());
            }
            _renderCount();
        };

        /** The trim handles, in frame indices. */
        el.getRange = () => trim.el.getRange();

        el.destroy = () => {
            el.detachViewer();
            try { trim.destroy(); } catch (_) { /* noop */ }
            try { playBtn.destroy(); } catch (_) { /* noop */ }
            try { frameBackBtn.destroy(); } catch (_) { /* noop */ }
            try { frameFwdBtn.destroy(); } catch (_) { /* noop */ }
            try { previewBtn.destroy(); } catch (_) { /* noop */ }
        };
    },
});
