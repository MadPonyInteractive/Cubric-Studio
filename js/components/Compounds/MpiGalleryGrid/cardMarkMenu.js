/**
 * cardMarkMenu — the gallery card's mark button (MPI-785), a parts file of MpiGalleryGrid.
 *
 * A click toggles the default mark, a dot. Holding the button for MARK_HOLD_MS opens a
 * small menu of every CARD_MARKS shape under it; the user either releases over a shape
 * (press-drag-release) or lets go and clicks one. The release that ends a hold ON the
 * button is swallowed, or it would toggle the dot straight back off.
 *
 * One menu at a time app-wide: it is an MpiPopup created on open and removed on close,
 * closed by a pick, an outside pointerdown and `ui:close-all-popups` (Escape).
 */

import { MpiPopup } from '../../Primitives/MpiPopup/MpiPopup.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { ce, qs, on } from '/js/utils/dom.js';
import { CARD_MARKS } from '/js/utils/galleryFilter.js';

export const MARK_HOLD_MS = 400;

let _open = null;

export function closeCardMarkMenu() {
    if (!_open) return;
    const { popup, unsubs } = _open;
    _open = null;
    unsubs.forEach(fn => fn());
    popup.el.destroy();
    popup.el.remove();
}

function _openMenu(anchor, current, setMark) {
    closeCardMarkMenu();
    const popup = MpiPopup.mount(ce('div'), {
        // 'bottom': MpiPopup flips and clamps top/bottom to the viewport, never 'left'.
        active: true, position: 'bottom', variant: 'card-mark', triggerEl: anchor,
    }, '<div class="mpi-gallery-grid__mark-menu" role="menu"></div>');
    const menu = qs('.mpi-gallery-grid__mark-menu', popup.el);

    const pick = (id) => {
        if (_open?.popup !== popup) return;
        closeCardMarkMenu();
        setMark(id);
    };
    CARD_MARKS.forEach(m => {
        const btn = MpiButton.mount(ce('div'), {
            icon: m.icon, size: 'sm', variant: 'ghost', info: m.singular,
            active: m.id === current, extraClasses: 'mpi-gallery-grid__mark-option',
        });
        btn.el.setAttribute('role', 'menuitem');
        btn.el.setAttribute('aria-label', m.singular);
        // pointerup = released here after the hold; click = picked after letting go.
        on(btn.el, 'pointerup', () => pick(m.id));
        on(btn.el, 'click', () => pick(m.id));
        menu.append(btn.el);
    });

    popup.on('close', closeCardMarkMenu);
    _open = {
        popup,
        unsubs: [
            on(document, 'pointerdown', (e) => {
                if (!popup.el.contains(e.target)) closeCardMarkMenu();
            }, true),
        ],
    };
}

/**
 * Wire click and hold on a card's mark button.
 * @param {HTMLElement} btnEl
 * @param {{ getMark: () => string|null, setMark: (id: string|null) => void }} opts
 * @returns {() => void} teardown — the card's destroy() must call it, or a hold timer
 *   can open a menu on a card that is already gone.
 */
export function wireCardMark(btnEl, { getMark, setMark }) {
    let timer = 0;
    let held = false;
    const clear = () => { clearTimeout(timer); timer = 0; };
    const unsubs = [
        on(btnEl, 'pointerdown', (e) => {
            if (e.button !== 0) return;
            held = false;
            clear();
            timer = setTimeout(() => {
                timer = 0;
                held = true;
                _openMenu(btnEl, getMark(), setMark);
            }, MARK_HOLD_MS);
        }),
        on(btnEl, 'pointerup', clear),
        on(btnEl, 'pointerleave', clear),
        on(btnEl, 'pointercancel', clear),
        on(btnEl, 'click', () => {
            if (held) { held = false; return; }
            setMark(getMark() ? null : 'dot');
        }),
    ];
    return () => {
        clear();
        unsubs.forEach(fn => fn());
    };
}
