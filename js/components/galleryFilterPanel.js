/**
 * galleryFilterPanel — the FILTER button and its panel, shared by the gallery toolbar
 * (MPI-749) and the media picker (MPI-785).
 *
 * A parts file after the js/components/loraSlotParts.js precedent: both hosts are Compounds,
 * which may not import each other (tier rule), so the one definition lives here and imports
 * Primitives only.
 *
 * The SORT is the host's: `getSort` / `setSort` default to `state.gallerySort`, and the media
 * picker passes its own local object so filtering a slot never refilters the gallery behind
 * it. The contract is js/utils/galleryFilter.js either way. The host calls `refresh()` when
 * the sort or its entries change from outside; a row click refreshes on its own.
 *
 * The panel is an MpiPopup CREATED on open and REMOVED on close, so the DOM holds at most
 * one — a toolbar remounted on every gallery visit can never pile up portals. It never
 * calls `Overlays`: an overlay would put the grid's media on its 'overlay' hold
 * (docs/gallery.md § Media suspension), and a filter panel is no reason to demote every
 * video on screen.
 *
 * Behaviour: FILTER toggles; row clicks keep it open; leaving the panel closes it after
 * LEAVE_CLOSE_MS and re-entering cancels; an outside pointerdown and `ui:close-all-popups`
 * close it. Esc needs no binding of its own: the app-lifetime `overlay.close` hotkey
 * (overlayManager.js) runs first on every Escape and, with no overlay open, emits
 * `ui:close-all-popups`.
 */

import { MpiPopup } from './Primitives/MpiPopup/MpiPopup.js';
import { MpiButton } from './Primitives/MpiButton/MpiButton.js';
import { MpiRadioGroup } from './Primitives/MpiRadioGroup/MpiRadioGroup.js';
import { ce, qs, on } from '../utils/dom.js';
import { renderIcon } from '../utils/icons.js';
import { listedKinds, isGalleryFiltered, describeGalleryFilter, CARD_MARKS } from '../utils/galleryFilter.js';
import { state } from '../state.js';

const LEAVE_CLOSE_MS = 300;
const POPUP_Z = 9999; // MpiPopup.css

const PANEL_HTML = `
    <div class="mpi-gallery-filter__panel">
        <div class="mpi-gallery-filter__panel-bar">
            <div class="mpi-gallery-filter__panel-bulk"></div>
            <div class="mpi-gallery-filter__panel-order"></div>
        </div>
        <div class="mpi-gallery-filter__panel-list"></div>
    </div>
`;

/**
 * The open project's cards as `{ group, item }`. A generating placeholder has no item yet,
 * so its group type stands in — the grid predicate's fallback.
 */
export function projectEntries() {
    return (state.currentProject?.itemGroups || []).map(group => ({
        group,
        item: group.history?.[group.selectedIndex] ?? { type: group.type },
    }));
}

/** Highest z-index on the node's ancestor chain — a modal host sits above MpiPopup's own. */
function _hostZ(node) {
    let z = 0;
    for (let n = node; n && n !== document.body; n = n.parentElement) {
        const v = parseInt(getComputedStyle(n).zIndex, 10);
        if (v > z) z = v;
    }
    return z;
}

/**
 * Mount the FILTER button into `slotEl` and wire its panel.
 * @param {HTMLElement} slotEl
 * @param {object} [opts]
 * @param {() => object} [opts.getSort]      the sort to read (default `state.gallerySort`)
 * @param {(patch: object) => void} [opts.setSort] merge a patch into it
 * @param {() => Array<{group, item}>} [opts.getEntries] the cards whose kinds the panel lists
 * @returns {{ refresh: () => void, destroy: () => void }}
 */
export function mountGalleryFilter(slotEl, {
    getSort = () => state.gallerySort,
    setSort = (patch) => { state.gallerySort = { ...state.gallerySort, ...patch }; },
    getEntries = projectEntries,
} = {}) {
    let _popup = null;
    let _orderGroup = null;
    let _openUnsubs = [];
    let _leaveTimer = null;
    let _kindsKey = null;
    /** @type {Map<string, { toggle: object, stateWord: HTMLElement }>} key = `kind:<id>` | `mark:<id>` | `flag:previews` */
    const _rows = new Map();

    const _listed = () => listedKinds(getEntries(), getSort());

    // ── FILTER button ───────────────────────────────────────────────────────
    // The heat dot is the header's own "active = heat dot" rule (DESIGN.md § Tags):
    // filters behind a button must never read as missing assets. Oldest hides
    // nothing, so it never lights it (isGalleryFiltered).
    const button = MpiButton.mount(slotEl, {
        icon: 'filter', label: 'Filter', size: 'sm', variant: 'ghost',
        extraClasses: 'mpi-gallery-filter__button',
    });
    const triggerEl = button.el;
    triggerEl.setAttribute('aria-haspopup', 'true');
    triggerEl.setAttribute('aria-expanded', 'false');

    button.on('click', ({ originalEvent }) => {
        if (_popup) { close(); return; }
        // Enter/Space fire a click with detail 0 — a keyboard open moves focus in.
        open({ focusFirst: originalEvent?.detail === 0 });
    });

    function _syncButton() {
        const sort = getSort();
        const filtered = isGalleryFiltered(sort);
        triggerEl.classList.toggle('mpi-gallery-filter__button--filtered', filtered);
        triggerEl.setAttribute('data-info', filtered
            ? `Filtered: ${describeGalleryFilter(sort, _listed())}`
            : 'Filter and sort');
    }

    const _set = (patch) => { setSort(patch); refresh(); };

    // ── Panel ───────────────────────────────────────────────────────────────
    const _clearLeaveTimer = () => {
        if (_leaveTimer) { clearTimeout(_leaveTimer); _leaveTimer = null; }
    };
    const _armLeaveTimer = () => {
        _clearLeaveTimer();
        _leaveTimer = setTimeout(() => close(), LEAVE_CLOSE_MS);
    };

    /**
     * One Reuse-Prompt-style row: circle/check toggle + label, row icon, ON/OFF word.
     *
     * `accent` is an ASSET_KINDS `[data-accent]` value, set on the ROW so `--accent-heat`
     * rebinds for it and the fill the CSS already paints on an active row becomes that
     * media type's family colour — the same statement the card's corner chip makes, so the
     * two cannot disagree. Only the kind rows pass one: a mark or the previews flag is not
     * a media type, so those keep the workspace accent.
     */
    function _appendRow(list, { key, label, icon, accent, onToggle }) {
        const row = ce('div', { className: 'mpi-gallery-filter__row' });
        if (accent) row.dataset.accent = accent;
        const toggle = MpiButton.mount(ce('div'), {
            icon: 'circle', iconActive: 'check', label, labelPosition: 'right',
            size: 'sm', variant: 'secondary',
            extraClasses: 'mpi-gallery-filter__toggle',
        });
        toggle.on('toggle', ({ active }) => onToggle(active === true));
        const iconEl = ce('span', { className: 'mpi-gallery-filter__row-icon', innerHTML: renderIcon(icon, 'sm') });
        const stateWord = ce('span', { className: 'mpi-gallery-filter__row-state' });
        row.append(toggle.el, iconEl, stateWord);
        list.append(row);
        _rows.set(key, { toggle, stateWord });
    }

    /** Row states, ON/OFF words and the sort order, from the sort. */
    function _syncRows() {
        const sort = getSort();
        _rows.forEach(({ toggle, stateWord }, key) => {
            const [type, id] = key.split(':');
            const isOn = type === 'kind' ? !sort.hiddenKinds.includes(id)
                : type === 'mark' ? sort.marks.includes(id)
                : sort[id] === true;
            toggle.el.setActive(isOn);
            stateWord.textContent = isOn ? 'On' : 'Off';
        });
        _orderGroup?.el.setValue(sort.order);
    }

    /** Rebuild the rows only when the listed kinds change, so a toggled row keeps focus. */
    function _build() {
        const kinds = _listed();
        const kindsKey = kinds.map(k => k.kind).join(',');
        if (kindsKey !== _kindsKey) {
            _kindsKey = kindsKey;
            const list = qs('.mpi-gallery-filter__panel-list', _popup.el);
            list.replaceChildren();
            _rows.clear();
            kinds.forEach(k => _appendRow(list, {
                key: `kind:${k.kind}`, label: k.label, icon: k.icon, accent: k.accent,
                onToggle: (isOn) => {
                    const rest = getSort().hiddenKinds.filter(h => h !== k.kind);
                    _set({ hiddenKinds: isOn ? rest : [...rest, k.kind] });
                },
            }));
            list.append(ce('div', { className: 'mpi-gallery-filter__panel-label', textContent: 'Only' }));
            CARD_MARKS.forEach(m => _appendRow(list, {
                key: `mark:${m.id}`, label: m.label, icon: m.icon,
                onToggle: (isOn) => {
                    const rest = getSort().marks.filter(id => id !== m.id);
                    _set({ marks: isOn ? [...rest, m.id] : rest });
                },
            }));
            _appendRow(list, {
                key: 'flag:previews', label: 'Previews', icon: 'eye',
                onToggle: (isOn) => _set({ previews: isOn }),
            });
        }
        _syncRows();
    }

    function open({ focusFirst = false } = {}) {
        if (_popup) return;
        // `variant` names the modifier class, so the panel's CSS width is already in
        // force when the Primitive measures and clamps it on mount.
        _popup = MpiPopup.mount(ce('div'), {
            active: true, position: 'bottom', variant: 'gallery-filter', triggerEl,
        }, PANEL_HTML);
        const hostZ = _hostZ(triggerEl);
        if (hostZ >= POPUP_Z) _popup.el.style.zIndex = String(hostZ + 1);

        const allBtn = MpiButton.mount(ce('div'), { text: 'All', variant: 'ghost', size: 'sm' });
        allBtn.on('click', () => _set({ hiddenKinds: [], marks: [], previews: false }));
        // NONE hides the LISTED kinds only: hiding the whole table would list every
        // kind the project has no cards of, since a hidden kind is always listed.
        const noneBtn = MpiButton.mount(ce('div'), { text: 'None', variant: 'ghost', size: 'sm' });
        noneBtn.on('click', () => {
            const hidden = new Set([...getSort().hiddenKinds, ..._listed().map(k => k.kind)]);
            _set({ hiddenKinds: [...hidden] });
        });
        qs('.mpi-gallery-filter__panel-bulk', _popup.el).append(allBtn.el, noneBtn.el);

        _orderGroup = MpiRadioGroup.mount(qs('.mpi-gallery-filter__panel-order', _popup.el), {
            options: [{ label: 'Newest', value: 'newest' }, { label: 'Oldest', value: 'oldest' }],
            value: getSort().order, name: 'Sort order', size: 'sm',
        });
        _orderGroup.on('select', ({ value }) => {
            if (value !== getSort().order) _set({ order: value });
        });

        _kindsKey = null;
        _build();

        _popup.on('mouseenter', _clearLeaveTimer);
        _popup.on('mouseleave', _armLeaveTimer);
        // `ui:close-all-popups` (Escape among others) hides the popup inside the
        // Primitive; follow it.
        _popup.on('close', () => close());
        _openUnsubs = [
            on(document, 'pointerdown', (e) => {
                if (_popup?.el.contains(e.target) || triggerEl.contains(e.target)) return;
                close();
            }, true),
        ];

        triggerEl.setAttribute('aria-expanded', 'true');
        triggerEl.classList.add('mpi-gallery-filter__button--open');
        if (focusFirst) qs('.mpi-gallery-filter__toggle', _popup.el)?.focus();
    }

    function close() {
        if (!_popup) return;
        _clearLeaveTimer();
        _openUnsubs.forEach(fn => fn());
        _openUnsubs = [];
        const popup = _popup;
        _popup = null;
        _orderGroup = null;
        _rows.clear();
        // Focus inside the panel goes back to FILTER BEFORE the panel leaves the DOM,
        // whichever path closed it — removing the focused row would drop focus to <body>.
        if (popup.el.contains(document.activeElement)) triggerEl.focus();
        popup.el.destroy();
        popup.el.remove();
        triggerEl.setAttribute('aria-expanded', 'false');
        triggerEl.classList.remove('mpi-gallery-filter__button--open');
    }

    /** Re-read the sort: the heat dot and tooltip, and the rows when open. */
    function refresh() {
        _syncButton();
        if (_popup) _build();
    }

    _syncButton();

    return { refresh, destroy: close };
}
