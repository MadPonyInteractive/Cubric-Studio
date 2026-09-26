import { ComponentFactory } from '../../factory.js';
import { ce, on } from '../../../utils/dom.js';
import { renderIcon } from '../../../utils/icons.js';
import { mascotLoop } from '../../../utils/mascotLoop.js';

/**
 * Thumb flags (MPI-514). Editorial per-item markers, rendered into ONE stacking
 * column so a tile carrying both never overlaps them. `info` + `badge` ride on
 * the element as data attributes rather than a native `title`: the Electron
 * tooltip is banned, and the consumer mounts an MpiPopup explainer off these
 * (MpiModelManager). This is a Primitive, so it may not import the popup itself.
 */
const TILE_FLAGS = [
    { key: 'featured',   icon: 'sparkle', info: 'Featured',                badge: 'warning' },
    { key: 'deprecated', icon: 'warning', info: 'Marked for deprecation',  badge: 'danger'  },
    // Cloud flag (MPI-865) — a model with a `provider`: no weights, no engine, billed to
    // the user by the provider per run. One key, not a cloudImage/cloudVideo pair: the
    // tile root already carries `mpi-tile--video`/`--image`, so the family colour is a
    // CSS descendant rule rather than a second table row saying the same thing twice.
    { key: 'cloud',      icon: 'cloud',   info: 'Runs on your own API key', badge: 'secondary' },
    // Media flags (MPI-831) — what the tile PRODUCES. Every other grid is split by
    // media, so its header answers this and no tile needs to; the Flow Library's
    // Third-party section holds all three media types at once, which leaves the tile
    // as the only place the answer can go. Consumers opt in per tile: a grid that is
    // already split by media must NOT set these, or every tile repeats its header.
    { key: 'mediaImage', icon: 'image', info: 'Makes an image', badge: 'secondary' },
    { key: 'mediaVideo', icon: 'video', info: 'Makes a video',  badge: 'secondary' },
    { key: 'mediaAudio', icon: 'audio', info: 'Makes audio',    badge: 'secondary' },
];

/**
 * MpiTileSheet — shared contact-sheet tile grid (Primitive, MPI-356).
 *
 * One sheet renders one grid of tiles. Three surfaces use it: the Model Library,
 * the App Library, and the model picker. Before this component the tile markup
 * was written twice (MpiModelManager._buildTile and MpiFlowLibrary._buildTile)
 * against ONE copy of the CSS that only the Model Library owned — the App
 * Library borrowed the selectors across a component boundary and lost
 * `--lib-card` in the process.
 *
 * A Primitive, not a Compound, because both libraries are Compounds and the
 * hierarchy forbids Compounds importing Compounds.
 *
 * Deliberately state-DUMB: consumers own their own status logic and hand the
 * bottom row over as an HTML string (`item.state`). That keeps install
 * progress, availability chips, and the picker's LoRA button out of here.
 *
 * Usage:
 *   const sheet = MpiTileSheet.mount(document.createElement('div'), { items });
 *   host.appendChild(sheet.el);
 *   sheet.on('select', ({ id, item }) => openDetail(item.source));
 *   sheet.el.patchState(id, '<span class="mpi-tile__chip">…</span>');
 *
 * Item shape:
 * @typedef {Object} TileItem
 * @property {string}  id               - Unique; the key for patchState/setWaiting/setSelected
 * @property {string}  name             - Primary label
 * @property {'image'|'video'} [media='image'] - Drives 4:5 vs 16:9 thumb aspect
 * @property {string}  [preview]        - Filename under comfy_workflows/display/
 * @property {string}  [meta]           - Second label line (e.g. "VIDEO · High")
 * @property {boolean} [showMediaBadge] - Render the Image/Video pill
 * @property {boolean} [featured]       - Gold sparkle flag on the thumb
 * @property {boolean} [deprecated]     - Warning flag on the thumb (model is on its way out)
 * @property {boolean} [cloud]          - Cloud flag on the thumb (runs on the user's own API key)
 * @property {boolean} [dot]            - Recently-installed heat dot
 * @property {boolean} [dimmed]         - Desaturates the thumb (not installed yet)
 * @property {string|boolean} [waiting] - Queued-install waiting mascot: its key (vision | video | audio | studio; true = studio)
 * @property {string}  [state]          - HTML for the fixed-height bottom row
 * @property {boolean} [selected]       - Renders the tile as the current choice
 * @property {*}       [source]         - Consumer payload, echoed back on select
 *
 * Props:
 * @param {TileItem[]} [items=[]]
 * @param {Map<string,HTMLElement>} [previewCache] - Consumer-owned; keeps thumb
 *        media alive across sheet rebuilds (MPI-394)
 *
 * Instance methods (on instance.el):
 *   setItems(items)         — full rebuild
 *   patchState(id, html)    — swap one tile's bottom row in place; no-op if absent
 *   setDimmed(id, bool)     — toggle the uninstalled desaturation
 *   setWaiting(id, key|false) — show (that mascot) or drop the waiting mascot
 *   setSelected(id|null)    — move the selected modifier
 *   getTile(id)             — the tile element, or null
 *
 * Emits:
 *   'select' { id, item }
 */
export const MpiTileSheet = ComponentFactory.create({
    name: 'MpiTileSheet',
    css: ['js/components/Primitives/MpiTileSheet/MpiTileSheet.css'],

    template: () => `<div class="mpi-tile-sheet"></div>`,

    setup: (el, props, emit) => {
        // Per-render listener cleanups. setItems() rebuilds the DOM, so every
        // hover/error handler attached to the old tiles must go with them —
        // otherwise a library that re-renders on every download tick leaks a
        // listener per tile per tick.
        let _tileUnsubs = [];
        const _tiles = new Map();   // id -> { tile, thumb, stateEl, mascot }
        // Consumer-owned preview cache (MPI-394). Absent = build fresh every time.
        const _previewCache = props.previewCache instanceof Map ? props.previewCache : null;

        function _mediaBadge(media) {
            return media === 'video'
                ? `<span class="mpi-tile__badge mpi-tile__badge--video">${renderIcon('video', 'sm')}Video</span>`
                : `<span class="mpi-tile__badge">${renderIcon('image', 'sm')}Image</span>`;
        }

        // The tile's thumb media, reused across rebuilds when the consumer passed a
        // previewCache. A rebuild that RE-CREATES the <img>/<video> hands back an
        // element with no pixels, and `loading="lazy"` then defers its load until
        // after the next layout — so a grid that rebuilds while the main thread is
        // busy sits fully blank for as long as that takes (MPI-394: ~20s across the
        // Model Library when an install or uninstall completed). Re-parenting an
        // already-decoded element paints in the same frame instead.
        function _previewMedia(item) {
            const cached = _previewCache?.get(item.id);
            if (cached) return cached;
            let media;
            if (item.media === 'video') {
                media = ce('video', {
                    src: `comfy_workflows/display/${item.preview}`,
                    className: 'mpi-tile__thumb-media',
                });
                media.muted = true; media.loop = true; media.playsInline = true; media.preload = 'metadata';
                // Poster by filename convention (foo.mp4 → foo.webp). A multi-MB
                // preview must fetch its moov atom before it can show ANY frame —
                // ltx23_high_preview.mp4 is 40MB, which is why that tile was always
                // the last to paint. A missing poster file is a silent no-op.
                media.poster = `comfy_workflows/display/${item.preview.replace(/\.[^.]+$/, '.webp')}`;
            } else {
                media = ce('img', {
                    src: `comfy_workflows/display/${item.preview}`,
                    className: 'mpi-tile__thumb-media',
                    loading: 'lazy',
                    alt: '',
                });
            }
            _previewCache?.set(item.id, media);
            return media;
        }

        function _buildTile(item) {
            const isVideo = item.media === 'video';
            const tile = ce('button', {
                className: `mpi-tile mpi-tile--${isVideo ? 'video' : 'image'}${item.selected ? ' mpi-tile--selected' : ''}${item.dimmed ? ' mpi-tile--dimmed' : ''}`,
                type: 'button',
            });

            // Thumb — image still or hover-play muted video; placeholder gradient
            // when no preview asset is declared or the asset fails to load.
            const thumb = ce('div', { className: 'mpi-tile__thumb' });
            if (item.preview) {
                const media = _previewMedia(item);
                _tileUnsubs.push(on(media, 'error', () => {
                    thumb.classList.add('mpi-tile__thumb--placeholder');
                    media.remove();
                    // Never hand a broken element back on the next rebuild — evicting
                    // it lets the fresh one fail again and re-raise the placeholder.
                    _previewCache?.delete(item.id);
                }));
                if (isVideo) {
                    _tileUnsubs.push(on(tile, 'mouseenter', () => { media.play().catch(() => {}); }));
                    _tileUnsubs.push(on(tile, 'mouseleave', () => { media.pause(); try { media.currentTime = 0; } catch (_) { /* noop */ } }));
                }
                thumb.appendChild(media);
            } else {
                thumb.classList.add('mpi-tile__thumb--placeholder');
            }

            // Heat dot + featured star ride absolute on the thumb so neither
            // shifts the tile when it appears.
            if (item.dot) thumb.appendChild(ce('div', { className: 'mpi-tile__new' }));
            const flags = TILE_FLAGS.filter(f => item[f.key]);
            if (flags.length) {
                const col = ce('div', { className: 'mpi-tile__flags' });
                flags.forEach(f => {
                    const flag = ce('div', { className: `mpi-tile__flag mpi-tile__flag--${f.key}` });
                    flag.dataset.info = f.info;
                    flag.dataset.badge = f.badge;
                    flag.innerHTML = renderIcon(f.icon, 'sm');
                    col.appendChild(flag);
                });
                thumb.appendChild(col);
            }
            tile.appendChild(thumb);

            const body = ce('div', { className: 'mpi-tile__body' });
            const top = ce('div', { className: 'mpi-tile__top' });
            const nameCol = ce('div');
            nameCol.appendChild(ce('div', { className: 'mpi-tile__name', textContent: item.name || '' }));
            if (item.meta) nameCol.appendChild(ce('div', { className: 'mpi-tile__meta', textContent: item.meta }));
            top.appendChild(nameCol);
            if (item.showMediaBadge) {
                const badge = ce('div');
                badge.innerHTML = _mediaBadge(item.media);
                if (badge.firstElementChild) top.appendChild(badge.firstElementChild);
            }
            body.appendChild(top);

            const stateEl = ce('div', { className: 'mpi-tile__state' });
            stateEl.innerHTML = item.state || '';
            body.appendChild(stateEl);
            tile.appendChild(body);

            _tileUnsubs.push(on(tile, 'click', () => emit('select', { id: item.id, item })));
            const ref = { tile, thumb, stateEl, mascot: null };
            _tiles.set(item.id, ref);
            _setWaiting(ref, item.waiting);
            return tile;
        }

        // Queued-install waiting mascot (MPI-284, animated MPI-906): the `working` loop,
        // built only while waiting — a video per tile would hold a decoder per tile.
        // Hiding a video keeps its decoder; only dropping the src frees it.
        function _setWaiting(ref, waiting) {
            if (waiting && !ref.mascot) {
                const key = waiting === true ? 'studio' : waiting;
                ref.thumb.insertAdjacentHTML('beforeend', mascotLoop(key, 'working', 'mpi-tile__mascot'));
                ref.mascot = ref.thumb.lastElementChild;
            } else if (!waiting && ref.mascot) {
                ref.mascot.pause();
                ref.mascot.removeAttribute('src');
                ref.mascot.load();
                ref.mascot.remove();
                ref.mascot = null;
            }
        }

        function _clearTiles() {
            _tileUnsubs.forEach(fn => fn?.());
            _tileUnsubs = [];
            _tiles.forEach(ref => _setWaiting(ref, false));
            _tiles.clear();
        }

        function setItems(items) {
            _clearTiles();
            el.innerHTML = '';
            (items || []).forEach(item => el.appendChild(_buildTile(item)));
        }

        el.setItems = setItems;

        el.patchState = (id, html) => {
            const ref = _tiles.get(id);
            if (ref) ref.stateEl.innerHTML = html ?? '';
        };

        // Uninstalled desaturation (MPI-831). A sibling of setWaiting rather than a
        // third argument on patchState: the two travel together for the Flow Library
        // but nothing else sets `dimmed`, and widening the shared signature would
        // hand three surfaces a parameter none of them mean.
        el.setDimmed = (id, isDimmed) => {
            const ref = _tiles.get(id);
            if (ref) ref.tile.classList.toggle('mpi-tile--dimmed', !!isDimmed);
        };

        el.setWaiting = (id, waiting) => {
            const ref = _tiles.get(id);
            if (ref) _setWaiting(ref, waiting);
        };

        el.setSelected = (id) => {
            _tiles.forEach((ref, key) => ref.tile.classList.toggle('mpi-tile--selected', key === id));
        };

        el.getTile = (id) => _tiles.get(id)?.tile || null;

        el.destroy = _clearTiles;

        setItems(props.items);
    },
});
