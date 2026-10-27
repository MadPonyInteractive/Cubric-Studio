import { ComponentFactory } from '../../factory.js';
import { Events } from '../../../events.js';
import { ce, on, inheritAccent } from '../../../utils/dom.js';

/**
 * MpiEntryInfo — hover flyout that says how a card was made (MPI-1162).
 *
 * One instance per host, reused across every row/card it watches. Portals itself to
 * document.body (immune to the host's overflow and transforms, same as MpiPopup) and
 * sits to the LEFT of the hovered row, flipping right when there is no room.
 *
 * Hover-intent, so sweeping the mouse down a list never flashes it: it opens only after
 * the pointer RESTS on one row for OPEN_MS. It closes when the pointer leaves both the row
 * and the flyout, after CLOSE_MS of grace — just enough to cross the gap, so the pointer
 * can move into the flyout to select and copy the prompt. Any scroll, click, right-click
 * or drag closes it at once.
 *
 * A Primitive on purpose: its host (MpiHistoryList) is a Compound, and a Compound may
 * only import Primitives. The words come from `utils/entryInfo.js`.
 *
 * Props: none.
 *
 * Instance API (on el):
 *   el.watch(container, selector, getInfo, { openMs }) — wire hover on every `selector`
 *       inside `container`; `getInfo(rowEl)` returns an `entryInfo()` result or null (no
 *       flyout). `openMs` overrides the rest delay (the gallery opens at once, MPI-1308).
 *       `passThrough` makes it a pure read-out: the pointer goes through it and it closes
 *       the moment the row is left, so it never sits over the next card (gallery, MPI-1308).
 *       Returns the unwatch function.
 *   el.hide()
 */
const OPEN_MS = 400;
const CLOSE_MS = 150;
const GAP = 10;
const MARGIN = 8;

export const MpiEntryInfo = ComponentFactory.create({
    name: 'MpiEntryInfo',
    css: ['js/components/Primitives/MpiEntryInfo/MpiEntryInfo.css'],

    template: () => '<div class="mpi-entry-info" role="tooltip"></div>',

    setup: (el) => {
        document.body.appendChild(el);

        let _anchor = null;   // row the flyout is open on (or waiting to open on)
        let _openTimer = null;
        let _closeTimer = null;
        const _unsubs = [];

        const _clearTimers = () => {
            clearTimeout(_openTimer);
            clearTimeout(_closeTimer);
            _openTimer = _closeTimer = null;
        };

        el.hide = () => {
            _clearTimers();
            _anchor = null;
            el.classList.remove('is-active');
        };

        const _scheduleClose = () => {
            clearTimeout(_openTimer);
            _openTimer = null;
            clearTimeout(_closeTimer);
            _closeTimer = setTimeout(el.hide, CLOSE_MS);
        };

        const _render = (info) => {
            const section = (mod, label, text) => ce('div', { className: `mpi-entry-info__section mpi-entry-info__section--${mod}` }, [
                ce('div', { className: 'mpi-entry-info__label' }, label),
                ce('div', { className: 'mpi-entry-info__text' }, text),
            ]);
            const children = [
                ce('dl', { className: 'mpi-entry-info__rows' }, info.rows.flatMap(r => [
                    ce('dt', { className: 'mpi-entry-info__label' }, r.label),
                    ce('dd', { className: 'mpi-entry-info__value' }, r.value),
                ])),
            ];
            if (info.loras) children.push(section('loras', 'LoRAs', info.loras));
            if (info.prompt) children.push(section('prompt', 'Prompt', info.prompt));
            if (info.negativePrompt) children.push(section('negative', 'Negative', info.negativePrompt));
            if (info.notes) children.push(section('notes', 'Notes', info.notes));
            el.replaceChildren(...children);
        };

        const _place = () => {
            const rect = _anchor.getBoundingClientRect();
            const w = el.offsetWidth;
            const h = el.offsetHeight;
            const fitsLeft = rect.left - GAP - w >= MARGIN;
            el.classList.toggle('mpi-entry-info--right', !fitsLeft);
            el.style.left = `${fitsLeft ? rect.left - GAP - w : Math.min(rect.right + GAP, window.innerWidth - MARGIN - w)}px`;
            const top = rect.top + rect.height / 2 - h / 2;
            el.style.top = `${Math.max(MARGIN, Math.min(top, window.innerHeight - MARGIN - h))}px`;
        };

        const _open = (row, getInfo) => {
            _openTimer = null;
            if (!row.isConnected || !row.offsetParent) return;
            const info = getInfo(row);
            if (!info) return;
            _render(info);
            inheritAccent(el, row);
            _place();
            el.scrollTop = 0;
            el.classList.add('is-active');
        };

        el.watch = (container, selector, getInfo, { openMs = OPEN_MS, passThrough = false } = {}) => {
            el.classList.toggle('mpi-entry-info--pass-through', passThrough);
            const rowOf = (node) => {
                const row = node?.closest?.(selector);
                return row && container.contains(row) ? row : null;
            };
            const offs = [
                on(container, 'pointerover', (e) => {
                    const row = rowOf(e.target);
                    if (!row) return;
                    if (row === _anchor) { clearTimeout(_closeTimer); _closeTimer = null; return; }
                    el.hide();
                    _anchor = row;
                    _openTimer = setTimeout(() => _open(row, getInfo), openMs);
                }),
                on(container, 'pointerout', (e) => {
                    const row = rowOf(e.target);
                    if (!row || row !== _anchor) return;
                    if (row.contains(e.relatedTarget)) return;
                    if (passThrough) { el.hide(); return; }
                    if (el.contains(e.relatedTarget)) return;
                    _scheduleClose();
                }),
                on(container, 'pointerdown', el.hide),
                on(container, 'contextmenu', el.hide),
                on(container, 'dragstart', el.hide),
            ];
            return () => {
                offs.forEach(fn => fn());
                if (_anchor && container.contains(_anchor)) el.hide();
            };
        };

        _unsubs.push(
            on(el, 'pointerenter', () => { clearTimeout(_closeTimer); _closeTimer = null; }),
            on(el, 'pointerleave', (e) => {
                if (_anchor?.contains(e.relatedTarget)) return;
                _scheduleClose();
            }),
            // Scrolling anything but the flyout's own text moves the row out from under it.
            on(window, 'scroll', (e) => { if (!el.contains(e.target)) el.hide(); }, { capture: true, passive: true }),
            on(window, 'blur', el.hide),
            Events.on('ui:close-all-popups', el.hide),
        );

        el.destroy = () => {
            el.hide();
            _unsubs.forEach(fn => fn?.());
            el.remove();
        };
    },
});
