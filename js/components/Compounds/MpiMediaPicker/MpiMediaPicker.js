import { ComponentFactory } from '../../factory.js';
import { MpiModal } from '../../Primitives/MpiModal/MpiModal.js';
import { MpiButton, mountButton } from '../../Primitives/MpiButton/MpiButton.js';
import { state } from '../../../state.js';
import { Storage } from '../../../core/storage.js';
import { resolveMediaUrl } from '../../../utils/mediaActions.js';
import { qs, ce, on } from '../../../utils/dom.js';
import { mascotLoop } from '../../../utils/mascotLoop.js';
import { renderIcon } from '../../../utils/icons.js';
import { toWavFile } from '../../../utils/toWavFile.js';
import { clientLogger } from '../../../services/clientLogger.js';
import {
    DEFAULT_GALLERY_SORT, matchesGallerySort, listedKinds, isGalleryFiltered,
    byGalleryOrder, markOf, markIcon,
} from '../../../utils/galleryFilter.js';
import { mountGalleryFilter } from '../../galleryFilterPanel.js';

/**
 * MpiMediaPicker — pick media the project ALREADY holds, or bring one in (Compound)
 *
 * A Flow media slot could only ever be filled by importing a file from outside
 * the app, so a Flow could not use what the user had just generated. This is
 * that missing half: a blocking modal over `state.currentProject`'s own history,
 * returning the picked item's `filePath`.
 *
 * SCOPE: the CURRENT project only. Not a file manager — no cross-project
 * browsing. But it IS the single entry point for filling a slot: the upload card
 * is the first cell of the grid, so the user has ONE button to reach both their
 * own media and the filesystem (settled with the user 2026-08-16, replacing an
 * earlier two-button split).
 *
 * The picked media is already on disk and already recorded in the project, so
 * there is nothing to place or copy: the caller gets a path and uses it.
 *
 * IT LISTS CARDS, NOT FILES (MPI-693). One tile per gallery card — that card's
 * SELECTED entry, under the gallery's own label — never one tile per history
 * take. A card with 14 takes used to be 14 tiles captioned with raw filenames,
 * sitting beside a gallery that showed one card under the name the user gave it.
 * The cost is that a non-selected take is no longer reachable from here: select
 * it on the card in the gallery first, then open the slot.
 *
 * FILTERING is the gallery's own (MPI-785): the same FILTER button and panel
 * (js/components/galleryFilterPanel.js) and the same contract
 * (js/utils/galleryFilter.js) — kinds, card marks, previews, Newest/Oldest — run on a
 * LOCAL sort object, so narrowing a slot never refilters the gallery behind it. It
 * opens on the gallery's order, with every kind that cannot fill the slot hidden;
 * the user can switch them back on. Tiles show the card's mark, read-only.
 *
 * Usage:
 *   const picker = MpiMediaPicker.mount(document.createElement('div'), {
 *       mediaType: 'video',
 *       onPick: (item) => { … },     // { filePath, mediaType }
 *       onImport: (files) => { … },  // File[] from the upload card
 *   });
 *   picker.el.show();
 *
 * Props:
 * TWO DESTINATIONS, WHEN THE OPENER HAS TWO (MPI-887). `toHistoryLabel` puts a toggle
 * in the head and rides its state on both outcomes as `toHistory`. The picker still
 * only ever reports what was chosen — it is the opener that owns the second
 * destination, because only the opener knows what a "history entry" would attach to.
 * Omit the prop and no toggle renders at all: a Flow slot, Place and the gallery
 * toolbar have exactly one thing to do with a pick and are untouched.
 *
 * @param {'image'|'video'|'audio'} [mediaType='image'] - The slot's type. The filter
 *        opens with every other kind hidden; the user can still widen it.
 * @param {string} [toHistoryLabel] - Label for the destination toggle. Omit it and the
 *        toggle is not rendered and `toHistory` is always false.
 * @param {Function} [onPick] - (item:{filePath:string,mediaType:string,item:object,toHistory:boolean}) => void
 * @param {Function} [onImport] - (files:File[]) => void — from the upload card.
 *        Omit it and the upload card is not rendered.
 * @param {'narration'|'character'|null} [voiceRoute=null] - Opt in to the shipped voice
 *        library as a THIRD source, and say which route its play button previews. Omit
 *        it and no voice card is rendered. Per-SLOT, never per-flow: Voice Changer wants
 *        it on "Target voice" and emphatically not on "Your performance", where offering
 *        a stock voice as the thing you performed would invite converting one library
 *        voice into another. Requires `onImport` and `voicePicker` — see `_buildVoiceCard`.
 * @param {Function} [recordAudio] - () => Promise<{filePath:string}|null>, the mic card's
 *        recorder (`recordAudioIntoProject`). Omit it and no mic card is rendered.
 * @param {Object} [voicePicker] - the `MpiVoicePicker` component, mounted by the voice card.
 *        Both are PROPS, not imports: they are Compounds, and so is this picker, so the
 *        Organism that opens an audio slot hands them in.
 *
 * Emits:
 * 'pick'   { filePath, mediaType, item, toHistory } — a tile was chosen (modal closes).
 *                                    `item` is the source MediaItem, so an opener that
 *                                    has to COPY the media has its id and renditions.
 * 'import' { files, toHistory }    — files chosen from disk, or one voice decoded from
 *                                    the library (modal closes)
 * 'cancel' {}                      — Cancel pressed (NOT on Escape/backdrop)
 */

export const MpiMediaPicker = ComponentFactory.create({
    name: 'MpiMediaPicker',
    css: [
        'js/components/Compounds/MpiMediaPicker/MpiMediaPicker.css',
        'js/components/galleryFilterPanel.css',
    ],

    template: () => `
        <div class="mpi-media-picker" role="dialog" aria-modal="true" aria-label="Choose media">
            <div class="mpi-media-picker__head">
                <div class="mpi-media-picker__title">Choose media</div>
                <div class="mpi-media-picker__dest" id="dest-slot"></div>
                <div class="mpi-media-picker__filters" id="filters-slot"></div>
            </div>
            <div class="mpi-media-picker__grid" id="grid-slot"></div>
            <div class="mpi-media-picker__actions" id="actions-slot"></div>
        </div>`,

    setup: (el, props, emit) => {
        const _unsubs = [];
        const slotType = props.mediaType || 'image';
        // The picker is about the SLOT's type, not the workspace's: picking a reference
        // image for a video op is an image job. `image` maps to `vision` because the accent
        // is named for the mascot, not the media (styles/01_base.css).
        el.dataset.accent = slotType === 'image' ? 'vision' : slotType;
        let _preview = null;

        // ── The destination toggle (MPI-887) ─────────────────────────────────
        // The same shape as the FILTER button it sits beside — a toggleable ghost
        // icon button, not a form switch: the head is a row of picker controls, and a
        // switch read as a settings row dropped into it (Fabio, 2026-09-22).
        //
        // Deliberately NOT remembered between opens. A destination that silently stayed
        // on would put the next pick somewhere the user did not look at, and a history
        // entry is a file on disk, not a chip they can flick off.
        // ponytail: no persistence; add one only if he asks for it after living with it.
        let _destBtn = null;
        let _dest = false;
        if (props.toHistoryLabel) {
            _destBtn = MpiButton.mount(qs('#dest-slot', el), {
                icon: 'layers', label: props.toHistoryLabel, size: 'sm', variant: 'ghost',
                toggleable: true,
                extraClasses: 'mpi-media-picker__dest-btn',
                info: 'Add what you pick to this card’s history instead of staging it as a reference',
            });
            _destBtn.on('toggle', ({ active }) => { _dest = active; });
        }
        const _toHistory = () => _dest;

        /** Real basename out of a `/project-file?path=<urlencoded absolute path>` URL. */
        function _basename(filePath) {
            const raw = String(filePath || '');
            const q = raw.indexOf('path=');
            const p = q === -1 ? raw : decodeURIComponent(raw.slice(q + 5).split('&')[0]);
            return p.split(/[/\\]/).pop() || '';
        }

        /** Drop the extension — the user names takes, not files. */
        function _stripExt(name) {
            return String(name || '').replace(/\.[^.\s]+$/, '');
        }

        /**
         * The gallery's own label for a card, so a tile here reads exactly like the
         * card it stands for (`MpiGalleryGrid` `_renderCard`).
         *
         * That chain ALREADY means "the title the user typed, else the file name":
         * `group.name` is set at creation to the filename stem — `truncateCardName`
         * of `displayName` for a generation (`generationService.js`), the import's
         * own `displayName` otherwise — and `item.name` is null on everything the
         * app creates. So the two descriptions are one rule, and the caption comes
         * out byte-identical to the gallery's, truncation included.
         *
         * The basename tail is only for `createItemGroup`'s `'Untitled Group'`
         * default, which nothing in the app writes but a legacy or hand-edited
         * project.json can carry — a grid of tiles all reading "Untitled Group"
         * names nothing, and the file does.
         */
        function _cardLabel(group, item) {
            if (group.customName) return group.customName;
            const derived = item.name || group.name;
            return derived && derived !== 'Untitled Group'
                ? derived
                : _stripExt(_basename(item.filePath));
        }

        /**
         * Every gallery CARD the picker can offer, as `{ group, item }` — one entry
         * per ItemGroup, its SELECTED entry, not one per history entry (MPI-693); see
         * the component header for why.
         *
         * A card whose SELECTED entry has no `filePath` is skipped — a pending or
         * failed generation has a card but no file, and handing one to a Flow slot
         * would resolve to a broken URL. Archived cards stay out through the sort's
         * `scope`, which is always 'active' here (MPI-678).
         */
        function _entries() {
            return (state.currentProject?.itemGroups || [])
                .map(group => ({ group, item: group.history?.[group.selectedIndex] }))
                .filter(({ item }) => item?.filePath);
        }

        // The picker's own sort (MPI-785). Kind is read off the selected ITEM, the way
        // the gallery reads it, so a tile sits under the same filter row as its card.
        let _sort = {
            ...DEFAULT_GALLERY_SORT,
            order: state.gallerySort.order,
            hiddenKinds: listedKinds(_entries(), DEFAULT_GALLERY_SORT)
                .filter(k => k.type !== slotType).map(k => k.kind),
        };

        /** The entries the sort shows, in its order, ready to tile. */
        function _collect() {
            return _entries()
                .filter(({ group, item }) => matchesGallerySort(group, item, _sort))
                .sort((x, y) => byGalleryOrder(_sort.order)(x.group, y.group))
                .map(({ group, item }) => ({
                    item,
                    type: item.type || group.type || 'image',
                    label: _cardLabel(group, item),
                    mark: markOf(group),
                }));
        }

        // The MODAL wraps the content, not the other way round: MpiModal portals
        // its own element to document.body, so content nested inside `el` would
        // stay behind in the host and hide() would leave it on screen.
        const modal = MpiModal.mount(document.createElement('div'), {
            width: 'min(1040px, 94vw)',
        });
        modal.el.appendChild(el);

        const grid = qs('#grid-slot', el);

        // The one clip the picker is playing, if any. Tracked in a variable and NOT
        // found by a DOM query: `_stopOtherGalleryMedia` in MpiGalleryGrid selects
        // `audio[data-src]` across the whole DOCUMENT on every gallery scroll event,
        // and MpiModal portals this picker to document.body — so marking these
        // elements the way the gallery marks its own would hand the grid behind the
        // modal a remote control over the picker's playback.
        let _playingAudio = null;

        function _stopPickerAudio() {
            if (!_playingAudio) return;
            _playingAudio.pause();
            try { _playingAudio.currentTime = 0; } catch (_) {}
            _playingAudio = null;
        }

        // Every dismissal path — a pick, Cancel, Escape, the backdrop, a
        // `ui:close-all-popups` pulse — ends at the modal's own hide(), and the last
        // three never run picker code. Detaching a playing <audio> does not stop it,
        // so the stop is wrapped around hide() once instead of repeated at the call
        // sites this component owns and still missed by the ones it does not.
        const _modalHide = modal.el.hide;
        modal.el.hide = () => { _stopPickerAudio(); _modalHide(); };

        // ── the upload card's input: the picker's second source, same accept
        //    filter as the slot behind it so the two never disagree ──
        let importInput = null;
        if (props.onImport) {
            // The one control here with no component answer: it is never rendered
            // (hidden), never styled, and exists only so a click can open the OS file
            // dialog. MpiInput has no file type and a Primitive for an invisible
            // handle would be a component that draws nothing (MPI-582 / MPI-588).
            // eslint-disable-next-line mpi/no-bare-form-control -- hidden OS file-dialog handle, never rendered
            importInput = ce('input', {
                type: 'file',
                accept: slotType === 'image' ? 'image/*' : slotType === 'video' ? 'video/*' : 'audio/*',
                hidden: true,
                multiple: true,
            });
            el.appendChild(importInput);
            _unsubs.push(on(importInput, 'change', () => {
                const files = Array.from(importInput.files || []);
                importInput.value = '';
                if (!files.length) return;
                const toHistory = _toHistory();
                props.onImport(files, { toHistory });
                emit('import', { files, toHistory });
                modal.el.hide();
            }));
        }

        /** A large preview over the grid. Its own layer so the grid keeps its scroll. */
        function _openPreview(entry) {
            _closePreview();
            // The preview autoplays; a tile still playing under it would double up.
            _stopPickerAudio();
            const { item, type } = entry;
            const layer = ce('div', { className: 'mpi-media-picker__preview' });
            const inner = ce('div', { className: 'mpi-media-picker__preview-inner' });

            if (type === 'video') {
                inner.appendChild(ce('video', {
                    src: resolveMediaUrl(item.filePath),
                    controls: true, autoplay: true, loop: true,
                }));
            } else if (type === 'audio') {
                inner.appendChild(ce('audio', {
                    src: resolveMediaUrl(item.filePath), controls: true, autoplay: true,
                }));
            } else {
                inner.appendChild(ce('img', { src: resolveMediaUrl(item.filePath), alt: '' }));
            }

            const close = mountButton({
                icon: 'close',
                size: 'sm',
                variant: 'ghost',
                extraClasses: 'mpi-media-picker__preview-close',
            });
            close.title = 'Close preview';
            _unsubs.push(on(close, 'click', _closePreview));
            inner.appendChild(close);

            // Click the ground to dismiss, but not a click on the media itself.
            _unsubs.push(on(layer, 'click', (e) => { if (e.target === layer) _closePreview(); }));

            layer.appendChild(inner);
            el.appendChild(layer);
            _preview = layer;
        }

        function _closePreview() {
            _preview?.remove();
            _preview = null;
        }
        el.isPreviewOpen = () => !!_preview;
        el.closePreview = _closePreview;

        function _buildUploadCard() {
            const card = mountButton({
                variant: 'ghost',
                size: 'sm',
                extraClasses: 'mpi-media-picker__tile mpi-media-picker__tile--upload',
            });
            card.title = 'Upload a file';
            const icon = ce('span', { className: 'mpi-media-picker__upload-icon' });
            icon.innerHTML = renderIcon('upload', 'lg');
            const label = ce('span', { className: 'mpi-media-picker__upload-label' });
            label.textContent = 'Upload file';
            card.appendChild(icon);
            card.appendChild(label);
            _unsubs.push(on(card, 'click', () => importInput.click()));
            return card;
        }

        /**
         * The mic card — audio slots only (MPI-573).
         *
         * It does NOT go through `onImport`. A recording is not an imported file: the
         * user just made it, it exists nowhere else, and it has to survive as project
         * media so any later slot (or Flow) can reach it. The `recordAudio` prop
         * (`recordAudioIntoProject`) saves it exactly as a gallery drop would; only
         * then does it resolve as a normal PICK, which is what it has become.
         */
        function _buildMicCard() {
            const card = mountButton({
                variant: 'ghost',
                size: 'sm',
                extraClasses: 'mpi-media-picker__tile mpi-media-picker__tile--mic',
            });
            card.title = 'Record from your microphone';
            const icon = ce('span', { className: 'mpi-media-picker__upload-icon' });
            icon.innerHTML = renderIcon('mic', 'lg');
            const label = ce('span', { className: 'mpi-media-picker__upload-label' });
            label.textContent = 'Record';
            card.appendChild(icon);
            card.appendChild(label);
            _unsubs.push(on(card, 'click', async () => {
                const uploaded = await props.recordAudio();
                if (!uploaded) return;
                const picked = { filePath: uploaded.filePath, mediaType: 'audio' };
                props.onPick?.(picked);
                emit('pick', picked);
                modal.el.hide();
            }));
            return card;
        }

        /**
         * The voice-library card — audio slots that opted in via `voiceRoute` (MPI-622).
         *
         * A THIRD SOURCE INSIDE THIS PICKER, not a second button beside the slot. The slot
         * already has exactly one job (open this picker) and that was a deliberate repair;
         * bolting a rival button next to it would undo it. So the library sits where the
         * user's own media and the filesystem already are.
         *
         * It routes through `onImport`, which is the whole point: a library voice becomes an
         * ordinary content-addressed project asset by the SAME path an upload takes, so the
         * graph sees no difference and no new injection plumbing exists to go wrong.
         */
        function _buildVoiceCard() {
            const card = mountButton({
                variant: 'ghost',
                size: 'sm',
                extraClasses: 'mpi-media-picker__tile mpi-media-picker__tile--voice',
            });
            card.title = 'Choose from the voice library';
            const icon = ce('span', { className: 'mpi-media-picker__upload-icon' });
            // `audio`, not `mic` — the Record card next to it is the mic, and two cards
            // under one microphone would read as two ways to do the same thing.
            icon.innerHTML = renderIcon('audio', 'lg');
            const label = ce('span', { className: 'mpi-media-picker__upload-label' });
            label.textContent = 'Voice library';
            card.appendChild(icon);
            card.appendChild(label);
            _unsubs.push(on(card, 'click', _openVoiceLibrary));
            return card;
        }

        // The voice panel's two halves: the mounted component (may be absent if the manifest
        // failed to load) and the layer it sits in. Tracked separately because destroying the
        // component does not remove the layer, and the failure path has a layer and no
        // component — one variable for both would leak whichever half it did not name.
        let _voicePicker = null;
        let _voiceLayer = null;

        function _closeVoiceLibrary() {
            _voicePicker?.destroy?.();
            _voiceLayer?.remove();
            _voicePicker = null;
            _voiceLayer = null;
            // Give the grid and its filter tabs back.
            grid.hidden = false;
            qs('#filters-slot', el).hidden = false;
        }

        /**
         * Swap the grid for the voice picker, inside this same modal.
         *
         * IN FLOW, NOT AN OVERLAY. It started as `position: absolute; inset: 0` over the
         * grid, which meant it inherited the grid's height — and with an empty project that
         * is barely four rows tall, so the library opened into a letterbox (Fabio,
         * 2026-08-26: "the voice library is too small and can be a lot taller"). An absolute
         * layer cannot grow its parent, so the fix is to stop being one: hide the grid and
         * its filter tabs, and take their place as a normal flex child that can claim height.
         *
         * The manifest is fetched HERE and passed down as a prop: MpiVoicePicker never
         * fetches (so a test can drive it with a fixture), and fetching on open rather than
         * on mount keeps 56 voices out of every image slot's picker.
         */
        async function _openVoiceLibrary() {
            _closeVoiceLibrary();
            grid.hidden = true;
            // The tabs filter the GRID, which is no longer on screen.
            qs('#filters-slot', el).hidden = true;

            const layer = ce('div', { className: 'mpi-media-picker__voice' });
            const head = ce('div', { className: 'mpi-media-picker__voice-head' });
            const title = ce('span', { className: 'mpi-media-picker__voice-title' });
            title.textContent = 'Voice library';
            head.appendChild(title);

            const back = mountButton({
                text: 'Back', icon: 'back', size: 'sm', variant: 'ghost',
            });
            _unsubs.push(on(back, 'click', _closeVoiceLibrary));
            head.appendChild(back);
            layer.appendChild(head);

            const body = ce('div', { className: 'mpi-media-picker__voice-body' });
            body.textContent = 'Loading voices…';
            layer.appendChild(body);
            // Exactly where the grid was, so Cancel stays the last row rather than floating
            // above the library.
            el.insertBefore(layer, qs('#actions-slot', el));
            _voiceLayer = layer;

            let manifest;
            try {
                const res = await fetch('/voices/manifest.json');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                manifest = await res.json();
            } catch (err) {
                clientLogger.error('media-picker', `voice manifest load failed: ${err?.message || err}`);
                body.textContent = 'The voice library could not be loaded.';
                return;
            }
            // Back was pressed while the fetch was in flight — the layer is already gone, so
            // mounting into it would leak a component nothing can reach.
            if (_voiceLayer !== layer) return;

            body.textContent = '';
            const picker = props.voicePicker.mount(ce('div'), {
                manifest,
                route: props.voiceRoute,
                // No emotion control here. Voice Changer has no TTS stage, so the emotion set
                // has nothing to act on — the user's own recording carries the delivery, and
                // VC preserves it rather than adding one. Settled with Fabio 2026-08-26.
                emotions: false,
            });
            picker.on('select', ({ voice }) => { _pickVoice(voice); });
            body.appendChild(picker.el);
            _voicePicker = picker;
        }

        /**
         * Turn a chosen library voice into a File and hand it to `onImport`.
         *
         * DECODED TO WAV, not passed through as `.opus`. `opus` is missing from four of the
         * five extension lists that classify a file as audio (js/utils/file.js AUDIO_EXTS and
         * three lists in routes/projects.js), which is the same trap that made
         * MpiAudioRecorder re-mux its WebM. `toWavFile` is that recorder's own encoder, so a
         * library pick and a recording reach the graph as byte-identical kinds of file.
         */
        async function _pickVoice(voice) {
            try {
                const res = await fetch(`/voices/${voice.sample}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const file = await toWavFile(await res.blob(), `${voice.id}.wav`);
                if (!file) throw new Error('decode returned null');
                props.onImport([file]);
                emit('import', { files: [file] });
                el.hide();
            } catch (err) {
                clientLogger.error('media-picker', `voice "${voice?.id}" could not be loaded: ${err?.message || err}`);
            }
        }

        /**
         * Hovering an audio tile plays it, the way an audio card in the gallery does
         * (MPI-693).
         *
         * The <audio> is built on the FIRST hover, not with the tile: at
         * `preload='metadata'` one element per tile is a metadata fetch for every
         * clip in the project the moment the Audio tab opens, for tiles nobody will
         * ever hover. It is kept afterwards, so a second hover replays instantly.
         *
         * Volume is the gallery's own, and 0 IS the mute — a silent play would still
         * swap the glyph to Stop and lie about what is happening, so it is skipped
         * outright rather than played at zero.
         */
        function _wireAudioHover(media, icon, item) {
            let audio = null;
            const _setIcon = (name) => { icon.innerHTML = renderIcon(name, 'lg'); };

            _unsubs.push(on(media, 'mouseenter', () => {
                const volume = Storage.getGalleryVolume();
                if (volume === 0) return;
                if (!audio) {
                    audio = ce('audio', {
                        src: resolveMediaUrl(item.filePath),
                        preload: 'metadata',
                    });
                    _unsubs.push(on(audio, 'play',  () => _setIcon('stop')));
                    _unsubs.push(on(audio, 'pause', () => _setIcon('audio')));
                    // `pause` does NOT fire when a clip runs out — only `ended` does,
                    // so without this the glyph stays on Stop for a finished tile.
                    _unsubs.push(on(audio, 'ended', () => {
                        _setIcon('audio');
                        try { audio.currentTime = 0; } catch (_) {}
                    }));
                    media.appendChild(audio);
                }
                if (_playingAudio !== audio) _stopPickerAudio();
                audio.volume = volume;
                _playingAudio = audio;
                audio.play().catch(() => {});
            }));

            _unsubs.push(on(media, 'mouseleave', () => {
                if (audio && _playingAudio === audio) _stopPickerAudio();
            }));
        }

        function _buildTile(entry) {
            const { item, type, label: name, mark } = entry;

            const tile = ce('div', { className: 'mpi-media-picker__tile' });

            const media = mountButton({
                variant: 'ghost',
                size: 'sm',
                extraClasses: 'mpi-media-picker__tile-media',
            });
            media.title = name;

            // A project thumb wins for a still frame — cheaper than decoding the clip.
            // Video also gets a real <video>, hidden until hover, so hovering PLAYS it
            // (the user asked for this): the poster stays for the un-hovered state.
            if (type === 'video') {
                if (item.thumbPath) {
                    media.appendChild(ce('img', {
                        className: 'mpi-media-picker__poster',
                        src: resolveMediaUrl(item.thumbPath), alt: '', draggable: false,
                    }));
                }
                const vid = ce('video', {
                    className: 'mpi-media-picker__video',
                    src: resolveMediaUrl(item.filePath),
                    muted: true, loop: true, preload: 'metadata', playsInline: true,
                });
                media.appendChild(vid);
                // play/pause on hover, not autoplay-always: a grid of 90 clips all
                // decoding at once is what makes a picker like this crawl.
                _unsubs.push(on(media, 'mouseenter', () => { vid.play().catch(() => {}); }));
                _unsubs.push(on(media, 'mouseleave', () => { vid.pause(); vid.currentTime = 0; }));
            } else if (type === 'audio') {
                const icon = ce('span', { className: 'mpi-media-picker__tile-icon' });
                icon.innerHTML = renderIcon('audio', 'lg');
                media.appendChild(icon);
                _wireAudioHover(media, icon, item);
            } else {
                media.appendChild(ce('img', {
                    src: resolveMediaUrl(item.thumbPath || item.filePath),
                    alt: '', draggable: false,
                }));
            }

            _unsubs.push(on(media, 'click', () => {
                // `item` rides along whole: an opener that has to COPY this media needs
                // its id to find the sidecar and its renditions to copy them (MPI-887).
                const picked = { filePath: item.filePath, mediaType: type, item, toHistory: _toHistory() };
                props.onPick?.(picked);
                emit('pick', picked);
                modal.el.hide();
            }));
            tile.appendChild(media);

            // Expand: preview large WITHOUT choosing. Deliberately a sibling of the
            // pick button, not a child — a button inside a button is invalid and the
            // click would pick the item on its way out.
            const expand = mountButton({
                icon: 'fullscreen',
                size: 'sm',
                variant: 'ghost',
                extraClasses: 'mpi-media-picker__expand',
            });
            expand.title = 'Preview';
            expand.setAttribute('aria-label', `Preview ${name}`);
            _unsubs.push(on(expand, 'click', (e) => {
                e.stopPropagation();
                _openPreview(entry);
            }));
            tile.appendChild(expand);

            if (mark) {
                tile.appendChild(ce('span', {
                    className: 'mpi-media-picker__mark',
                    innerHTML: renderIcon(markIcon(mark), 'sm'),
                }));
            }

            const caption = ce('div', { className: 'mpi-media-picker__name' });
            caption.textContent = name;
            tile.appendChild(caption);

            return tile;
        }

        function _render() {
            grid.textContent = '';
            const entries = _collect();

            if (importInput) grid.appendChild(_buildUploadCard());
            // Gated on the SLOT's type, not the active filter: widening the filter to
            // "All media" is the user looking around, not a change of what the slot
            // takes, and a Record card under an image slot would be a dead end.
            if (slotType === 'audio' && props.recordAudio) grid.appendChild(_buildMicCard());
            // Same gating, plus the slot's own opt-in. `onImport` is required because that
            // is the route a picked voice takes — without it the card would open a library
            // whose selection had nowhere to go.
            if (slotType === 'audio' && props.voiceRoute && props.onImport && props.voicePicker) {
                grid.appendChild(_buildVoiceCard());
            }

            if (!entries.length) {
                const empty = ce('div', { className: 'mpi-media-picker__empty' });
                const filteredOut = isGalleryFiltered(_sort) && _entries().length;
                // MPI-908: Studio peeks into an empty project, and shrugs at a filter that hid everything.
                empty.innerHTML = `${filteredOut
                    ? mascotLoop('studio', 'no-results', 'mpi-media-picker__empty-mascot')
                    : mascotLoop('studio', 'peek', 'mpi-media-picker__empty-mascot mpi-media-picker__empty-mascot--peek')}<span>${filteredOut
                    ? 'No media matches this filter.'
                    : 'This project has no media yet.'}</span>`;
                grid.appendChild(empty);
                return;
            }
            entries.forEach(entry => grid.appendChild(_buildTile(entry)));
        }

        // ── FILTER — the gallery's own button and panel, on the local sort ──
        const filter = mountGalleryFilter(qs('#filters-slot', el), {
            getSort: () => _sort,
            setSort: (patch) => {
                _sort = { ..._sort, ...patch };
                _render();
            },
            getEntries: _entries,
        });

        _render();

        const cancel = MpiButton.mount(qs('#actions-slot', el), {
            text: 'Cancel', variant: 'ghost', size: 'sm',
        });
        cancel.on('click', () => { emit('cancel', {}); modal.el.hide(); });

        el.show = () => modal.el.show();
        el.hide = () => { _closePreview(); _closeVoiceLibrary(); modal.el.hide(); };

        el.destroy = () => {
            filter.destroy();
            _closePreview();
            _closeVoiceLibrary();
            _stopPickerAudio();
            _unsubs.forEach(fn => fn());
            _unsubs.length = 0;
            cancel?.el?.destroy?.();
            _destBtn?.el?.destroy?.();
            modal?.el?.destroy?.();
        };
    },
});
