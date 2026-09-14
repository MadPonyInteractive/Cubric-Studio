/**
 * MpiAudioPlayer — an audio transport over a baked waveform (Compound).
 *
 * `play │ waveform │ volume`, the time laid OVER the waveform. The two buttons are the
 * ends of the widget and the waveform is the bar that joins them (Fabio, 2026-09-13):
 * flush against both, as tall as they are, the bottom layer. The player has NO width of
 * its own: the consumer sets it (a Flow result pane, the result dock), so nothing here may
 * add a fixed or minimum width.
 *
 * A SIBLING of MpiVideoControlBar, not a mode of it (MPI-731): that bar speaks
 * MpiVideoSurface's private API and is mostly frame maths audio never needs. Its mute
 * and volume wiring is copied here on purpose, so the two transports behave alike.
 *
 * It owns ONE <audio>. `src` is set once and never re-pointed: a consumer that needs
 * the same sound somewhere else MOVES this instance, because a fresh element with the
 * same src restarts from zero (MPI-727). MpiWaveform and MpiVolumeControl own no media —
 * this component tells them the state and decides what their gestures mean.
 *
 * Props:
 *   src:      string  — audio URL
 *   mask:     string  — the item's baked waveform mask (`thumbPath`); optional, a
 *                       maskless player still scrubs
 *   duration: number  — clip length in seconds, painted before metadata arrives
 *   hotkeys:  boolean — answer SPACE / M / volume keys while on screen (default true).
 *                       Pass false for N players side by side, or SPACE plays N songs.
 *
 * Instance API (on el):
 *   getAudioElement()
 *   setMask(url)
 *   destroy()          — pauses, unbinds, destroys the sub-components
 */

import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiWaveform } from '../../Primitives/MpiWaveform/MpiWaveform.js';
import { MpiVolumeControl } from '../MpiVolumeControl/MpiVolumeControl.js';
import { formatTime } from '../../../utils/string.js';
import { qs, on } from '../../../utils/dom.js';
import { Hotkeys } from '../../../managers/hotkeyManager.js';

// The volume hotkeys' step, same as MpiVideoControlBar's.
const HOTKEY_VOLUME_STEP = 10;

export const MpiAudioPlayer = ComponentFactory.create({
    name: 'MpiAudioPlayer',
    css: ['js/components/Compounds/MpiAudioPlayer/MpiAudioPlayer.css'],

    template: () => `
        <div class="mpi-audio-player">
            <audio class="mpi-audio-player__audio" preload="metadata"></audio>
            <div data-mount="play"></div>
            <div class="mpi-audio-player__track">
                <div class="mpi-audio-player__wave" data-mount="waveform"></div>
                <span class="mpi-audio-player__time">00:00</span>
            </div>
            <div data-mount="volume"></div>
        </div>
    `,

    setup: (el, props) => {
        const audio = qs('.mpi-audio-player__audio', el);
        const timeEl = qs('.mpi-audio-player__time', el);
        const hotkeys = props.hotkeys !== false;
        const _unsubs = [];

        const playBtn = MpiButton.mount(qs('[data-mount="play"]', el), {
            icon: 'play', iconActive: 'pause', size: 'sm',
            info: hotkeys ? 'Play/Pause (SPACE)' : 'Play/Pause',
        });
        const wf = MpiWaveform.mount(qs('[data-mount="waveform"]', el), {
            mask: props.mask, duration: props.duration,
        });
        const volumeCtl = MpiVolumeControl.mount(qs('[data-mount="volume"]', el), {
            value: 100, step: 1, info: hotkeys ? 'Mute/Unmute (M)' : 'Mute/Unmute',
        });

        // The element's length once metadata lands, the prop's before.
        const _duration = () => (audio.duration > 0 && Number.isFinite(audio.duration)
            ? audio.duration
            : Math.max(0, Number(props.duration) || 0));

        // At the start the time shows the clip's LENGTH, and the elapsed time once it
        // moves: a voice-note player's convention, in one short mm:ss.
        const _paint = () => {
            const d = _duration();
            const t = audio.currentTime || 0;
            wf.el.setProgress(d > 0 ? t / d : 0);
            timeEl.textContent = formatTime(t > 0 ? t : d).slice(0, 5);
        };

        const _syncPlay = () => playBtn.el.setActive(!audio.paused);

        // MpiButton flips its own icon on click. A play() that is refused (a pause
        // landing first, an unplayable src) fires no `play` event to put it back.
        const _togglePlay = () => {
            if (audio.paused) audio.play().catch(_syncPlay);
            else audio.pause();
        };

        const _toggleMute = () => { audio.muted = !audio.muted; };

        const _doVolume = (value) => {
            audio.volume = value / 100;
            if (audio.muted && value > 0) audio.muted = false;
        };

        playBtn.on('click', _togglePlay);
        volumeCtl.on('mute-toggle', _toggleMute);
        volumeCtl.on('input',  ({ value }) => _doVolume(value));
        volumeCtl.on('change', ({ value }) => _doVolume(value));

        // A seek keeps playing. `modified` is ignored: a player has no selection mode.
        wf.on('seek', ({ fraction }) => {
            const d = _duration();
            if (d > 0) audio.currentTime = fraction * d;
        });

        _unsubs.push(
            on(audio, 'play', _syncPlay),
            on(audio, 'pause', _syncPlay),
            on(audio, 'timeupdate', _paint),
            on(audio, 'loadedmetadata', () => { wf.el.setDuration(_duration()); _paint(); }),
            on(audio, 'volumechange', () => {
                volumeCtl.el.setMuted(audio.muted);
                volumeCtl.el.setValue(Math.round(audio.volume * 100));
            }),
        );

        if (hotkeys) {
            // A player the user cannot see must not answer the keyboard. hotkeyManager
            // buckets handlers by KEY, so one stashed in a `display: none` overlay would
            // still take SPACE (MPI-585). Same gate as MpiVideoControlBar's `_canDrive`.
            const _canDrive = () => el.isConnected && el.getClientRects().length > 0;
            const hk = (id, fn) => _unsubs.push(Hotkeys.bind(id, () => { if (_canDrive()) fn(); }));
            hk('video.playPause', _togglePlay);
            hk('video.mute', _toggleMute);
            hk('video.volume.up', () => _doVolume(Math.min(100, Math.round(audio.volume * 100) + HOTKEY_VOLUME_STEP)));
            hk('video.volume.down', () => _doVolume(Math.max(0, Math.round(audio.volume * 100) - HOTKEY_VOLUME_STEP)));
        }

        if (props.src) audio.src = props.src;
        _paint();

        el.getAudioElement = () => audio;
        el.setMask = (url) => wf.el.setMask(url);

        el.destroy = () => {
            audio.pause();
            _unsubs.forEach(fn => fn());
            _unsubs.length = 0;
            playBtn.destroy();
            wf.destroy();
            volumeCtl.destroy();
        };
    },
});
