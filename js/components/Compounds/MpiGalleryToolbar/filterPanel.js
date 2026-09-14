/**
 * filterPanel — the FILTER panel of MpiGalleryToolbar (MPI-749).
 *
 * A parts file after the js/components/loraSlotParts.js precedent: it keeps the rows
 * and the dismissal rules out of the toolbar's setup, and imports Primitives only, as its
 * host must.
 *
 * The panel is an MpiPopup CREATED on open and REMOVED on close, so the DOM holds at most
 * one — a toolbar remounted on every gallery visit can never pile up portals. It never
 * calls `Overlays`: an overlay would put the grid's media on its 'overlay' hold
 * (docs/gallery.md § Media suspension), and a filter panel is no reason to demote every
 * video on screen.
 *
 * Behaviour (brief § 5): FILTER toggles; row clicks keep it open; leaving the panel
 * closes it after LEAVE_CLOSE_MS and re-entering cancels; an outside pointerdown and
 * `ui:close-all-popups` close it. Esc needs no binding of its own: the app-lifetime
 * `overlay.close` hotkey (overlayManager.js) runs first on every Escape and, with no
 * overlay open, emits `ui:close-all-popups`.
 */

import { MpiPopup } from '../../Primitives/MpiPopup/MpiPopup.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiRadioGroup } from '../../Primitives/MpiRadioGroup/MpiRadioGroup.js';
import { ce, qs, on } from '../../../utils/dom.js';
import { renderIcon } from '../../../utils/icons.js';
import { listedKinds } from '../../../utils/galleryFilter.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';

const LEAVE_CLOSE_MS = 300;

/** The "only" flags, ANDed on top of the kinds. */
const FLAGS = [
    { key: 'favourites', label: 'Favourites', icon: 'heart' },
    { key: 'previews',   label: 'Previews',   icon: 'eye' },
];

const PANEL_HTML = `
    <div class="mpi-gallery-toolbar__panel">
        <div class="mpi-gallery-toolbar__panel-bar">
            <div class="mpi-gallery-toolbar__panel-bulk"></div>
            <div class="mpi-gallery-toolbar__panel-order"></div>
        </div>
        <div class="mpi-gallery-toolbar__panel-list"></div>
    </div>
`;

/**
 * The kind rows for the open project, in ASSET_KINDS order: kinds with a card in the
 * current scope, plus any kind currently hidden (`listedKinds`). A generating placeholder
 * has no item yet, so its group type stands in — the grid predicate's fallback.
 * @param {object} [sort=state.gallerySort]
 */
export function currentListedKinds(sort = state.gallerySort) {
    const entries = (state.currentProject?.itemGroups || []).map(group => ({
        group,
        item: group.history?.[group.selectedIndex] ?? { type: group.type },
    }));
    return listedKinds(entries, sort);
}

const _setSort = (patch) => { state.gallerySort = { ...state.gallerySort, ...patch }; };

/**
 * @param {HTMLElement} triggerEl - the FILTER button: the popup's anchor, and excluded
 *   from outside-click so its own click can toggle.
 * @param {{ onOpenChange?: (open: boolean) => void }} [opts]
 */
export function mountFilterPanel(triggerEl, { onOpenChange } = {}) {
    let _popup = null;
    let _orderGroup = null;
    let _openUnsubs = [];
    let _leaveTimer = null;
    let _kindsKey = null;
    /** @type {Map<string, { toggle: object, stateWord: HTMLElement }>} key = `kind:<id>` | `flag:<key>` */
    const _rows = new Map();

    const _clearLeaveTimer = () => {
        if (_leaveTimer) { clearTimeout(_leaveTimer); _leaveTimer = null; }
    };
    const _armLeaveTimer = () => {
        _clearLeaveTimer();
        _leaveTimer = setTimeout(() => close(), LEAVE_CLOSE_MS);
    };

    /** One Reuse-Prompt-style row: circle/check toggle + label, kind icon, ON/OFF word. */
    function _appendRow(list, { key, label, icon, onToggle }) {
        const row = ce('div', { className: 'mpi-gallery-toolbar__row' });
        const toggle = MpiButton.mount(ce('div'), {
            icon: 'circle', iconActive: 'check', label, labelPosition: 'right',
            size: 'sm', variant: 'secondary',
            extraClasses: 'mpi-gallery-toolbar__toggle',
        });
        toggle.on('toggle', ({ active }) => onToggle(active === true));
        const iconEl = ce('span', { className: 'mpi-gallery-toolbar__row-icon', innerHTML: renderIcon(icon, 'sm') });
        const stateWord = ce('span', { className: 'mpi-gallery-toolbar__row-state' });
        row.append(toggle.el, iconEl, stateWord);
        list.append(row);
        _rows.set(key, { toggle, stateWord });
    }

    /** Row states, ON/OFF words and the sort order, from state. */
    function _sync() {
        const sort = state.gallerySort;
        _rows.forEach(({ toggle, stateWord }, key) => {
            const [type, id] = key.split(':');
            const isOn = type === 'kind' ? !sort.hiddenKinds.includes(id) : sort[id] === true;
            toggle.el.setActive(isOn);
            stateWord.textContent = isOn ? 'On' : 'Off';
        });
        _orderGroup?.el.setValue(sort.order);
    }

    /** Rebuild the rows only when the listed kinds change, so a toggled row keeps focus. */
    function _build() {
        const kinds = currentListedKinds();
        const kindsKey = kinds.map(k => k.kind).join(',');
        if (kindsKey !== _kindsKey) {
            _kindsKey = kindsKey;
            const list = qs('.mpi-gallery-toolbar__panel-list', _popup.el);
            list.replaceChildren();
            _rows.clear();
            kinds.forEach(k => _appendRow(list, {
                key: `kind:${k.kind}`, label: k.label, icon: k.icon,
                onToggle: (isOn) => {
                    const rest = state.gallerySort.hiddenKinds.filter(h => h !== k.kind);
                    _setSort({ hiddenKinds: isOn ? rest : [...rest, k.kind] });
                },
            }));
            list.append(ce('div', { className: 'mpi-gallery-toolbar__panel-label', textContent: 'Only' }));
            FLAGS.forEach(f => _appendRow(list, {
                key: `flag:${f.key}`, label: f.label, icon: f.icon,
                onToggle: (isOn) => _setSort({ [f.key]: isOn }),
            }));
        }
        _sync();
    }

    function open({ focusFirst = false } = {}) {
        if (_popup) return;
        // `variant` names the modifier class, so the panel's CSS width is already in
        // force when the Primitive measures and clamps it on mount.
        _popup = MpiPopup.mount(ce('div'), {
            active: true, position: 'bottom', variant: 'gallery-filter', triggerEl,
        }, PANEL_HTML);

        const allBtn = MpiButton.mount(ce('div'), { text: 'All', variant: 'ghost', size: 'sm' });
        allBtn.on('click', () => _setSort({ hiddenKinds: [], favourites: false, previews: false }));
        // NONE hides the LISTED kinds only: hiding the whole table would list every
        // kind the project has no cards of, since a hidden kind is always listed.
        const noneBtn = MpiButton.mount(ce('div'), { text: 'None', variant: 'ghost', size: 'sm' });
        noneBtn.on('click', () => {
            const hidden = new Set([...state.gallerySort.hiddenKinds, ...currentListedKinds().map(k => k.kind)]);
            _setSort({ hiddenKinds: [...hidden] });
        });
        qs('.mpi-gallery-toolbar__panel-bulk', _popup.el).append(allBtn.el, noneBtn.el);

        _orderGroup = MpiRadioGroup.mount(qs('.mpi-gallery-toolbar__panel-order', _popup.el), {
            options: [{ label: 'Newest', value: 'newest' }, { label: 'Oldest', value: 'oldest' }],
            value: state.gallerySort.order, name: 'Sort order', size: 'sm',
        });
        _orderGroup.on('select', ({ value }) => {
            if (value !== state.gallerySort.order) _setSort({ order: value });
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
            Events.on('state:changed', ({ key }) => {
                if (key === 'gallerySort' || key === 'currentProject') _build();
            }),
        ];

        onOpenChange?.(true);
        if (focusFirst) qs('.mpi-gallery-toolbar__toggle', _popup.el)?.focus();
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
        onOpenChange?.(false);
    }

    return {
        open,
        close,
        isOpen: () => !!_popup,
        destroy: () => close(),
    };
}
