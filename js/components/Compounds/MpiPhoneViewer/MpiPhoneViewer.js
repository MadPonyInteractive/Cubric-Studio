import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { ce, qs, on } from '../../../utils/dom.js';
import { saveMedia, shareMedia, canShare } from '../../../phone/phoneMedia.js';
import { clientLogger } from '../../../services/clientLogger.js';

/**
 * MpiPhoneViewer — one card full screen on the phone (MPI-1300, Phase 2).
 *
 * Swipe sideways between the gallery's cards, tap a version under the picture. Nothing
 * here edits by hand: Save, Share, and To Cosmo, which hands the card to the chat.
 * Spec: tasks/MPI-1300/research/mockups/phone.html, screen 04.
 *
 * Props:
 * @param {Array}  cards  - `/phone/cards` rows, in the gallery's order
 * @param {number} index  - the card to open on
 * @param {number} [total] - the project's count under the gallery's filter (cards may be a first page)
 * Emits:
 *   'close'     {}
 *   'to-cosmo'  { name, url, mediaType, itemId, groupId } — the version on screen
 */

const SWIPE_PX = 50;
const PAGER_MAX = 10;   // more cards than this and the dots stop meaning anything; the title counts

export const MpiPhoneViewer = ComponentFactory.create({
    name: 'MpiPhoneViewer',
    css: ['js/components/Compounds/MpiPhoneViewer/MpiPhoneViewer.css'],

    template: () => `
        <div class="mpi-phone-viewer" role="dialog" aria-modal="true">
            <div class="mpi-phone-viewer__top">
                <div class="mpi-phone-viewer__back"></div>
                <div class="mpi-phone-viewer__title"><b></b><span></span></div>
                <div class="mpi-phone-viewer__details"></div>
            </div>
            <div class="mpi-phone-viewer__stage">
                <div class="mpi-phone-viewer__media"></div>
                <div class="mpi-phone-viewer__pager"></div>
            </div>
            <div class="mpi-phone-viewer__meta">
                <div class="mpi-phone-viewer__versions"></div>
                <div class="mpi-phone-viewer__prompt"></div>
            </div>
            <div class="mpi-phone-viewer__actions"></div>
        </div>`,

    setup: (el, props, emit) => {
        const cards = props.cards || [];
        let _i = Math.min(Math.max(props.index || 0, 0), cards.length - 1);
        let _v = cards[_i]?.selected || 0;
        const children = [];
        const unsubs = [];
        const mount = (slot, props_) => {
            const inst = MpiButton.mount(ce('div'), props_);
            slot.appendChild(inst.el);
            children.push(inst);
            return inst;
        };

        const stage = qs('.mpi-phone-viewer__stage', el);
        const mediaSlot = qs('.mpi-phone-viewer__media', el);
        const pager = qs('.mpi-phone-viewer__pager', el);
        const versions = qs('.mpi-phone-viewer__versions', el);
        const prompt = qs('.mpi-phone-viewer__prompt', el);
        const [titleName, titleSub] = qs('.mpi-phone-viewer__title', el).children;

        mount(qs('.mpi-phone-viewer__back', el), { icon: 'back', variant: 'ghost', info: 'Back to the gallery' })
            .on('click', () => emit('close', {}));
        mount(qs('.mpi-phone-viewer__details', el), { icon: 'info', variant: 'ghost', info: 'Show the whole prompt', toggleable: true })
            .on('click', () => el.classList.toggle('mpi-phone-viewer--details'));

        const version = () => cards[_i]?.versions[_v];
        const actions = qs('.mpi-phone-viewer__actions', el);
        const act = (icon, label, fn, variant = 'ghost') =>
            mount(actions, { icon, label, labelPosition: 'bottom', variant, info: label }).on('click', fn);
        act('download', 'Save', () => version() && saveMedia(version().url));
        if (canShare()) {
            act('upload', 'Share', () => version() && shareMedia(version().url)
                .catch((err) => { if (err?.name !== 'AbortError') clientLogger.warn('phone', `share failed: ${err.message}`); }));
        }
        act('chat', 'To Cosmo', () => {
            const v = version();
            if (!v) return;
            emit('to-cosmo', { name: cards[_i].name, url: v.url, mediaType: v.type, itemId: v.itemId, groupId: cards[_i].groupId });
        // REDESIGN-DEVIATION: the mockup tints only this label cream; a consumer may not
        // recolour a button, so the one that hands the card on is the filled primary.
        }, 'primary');

        function paint() {
            const card = cards[_i];
            const v = version();
            if (!card || !v) return;
            titleName.textContent = card.name || '';
            titleSub.textContent = `${_i + 1} of ${props.total || cards.length}`;

            const media = v.type === 'video'
                ? ce('video', { src: v.url, poster: v.thumbLg || v.thumb || '', controls: true, playsInline: true, loop: true })
                : v.type === 'audio'
                    ? ce('audio', { src: v.url, controls: true })
                    : ce('img', { src: v.url, alt: card.name || '' });
            mediaSlot.replaceChildren(media);

            pager.replaceChildren(...(cards.length > 1 && cards.length <= PAGER_MAX
                ? cards.map((_, n) => ce('i', { className: n === _i ? 'is-on' : '' })) : []));

            versions.replaceChildren(
                ...(card.versions.length > 1 ? card.versions.map((ver, n) => {
                    const thumb = ce('img', { src: ver.thumb || ver.url, alt: `Version ${n + 1}`, className: n === _v ? 'is-on' : '' });
                    thumb.dataset.v = String(n);
                    return thumb;
                }) : []),
                ce('span', { textContent: [`v${_v + 1} of ${card.versions.length}`, v.size ? `${v.size.w}×${v.size.h}` : ''].filter(Boolean).join(' · ') }),
            );
            prompt.textContent = v.prompt || '';
        }

        unsubs.push(on(versions, 'click', (e) => {
            const n = e.target.dataset?.v;
            if (n === undefined) return;
            _v = Number(n);
            paint();
        }));

        function go(step) {
            const next = _i + step;
            if (next < 0 || next >= cards.length) return;
            _i = next;
            _v = cards[_i].selected || 0;
            paint();
        }
        // Swipe: a mostly-sideways drag past SWIPE_PX moves one card.
        let _x0 = null;
        let _y0 = null;
        unsubs.push(on(stage, 'pointerdown', (e) => { _x0 = e.clientX; _y0 = e.clientY; }));
        unsubs.push(on(stage, 'pointerup', (e) => {
            if (_x0 === null) return;
            const dx = e.clientX - _x0;
            const dy = e.clientY - _y0;
            _x0 = null;
            if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        }));
        unsubs.push(on(stage, 'pointercancel', () => { _x0 = null; }));

        paint();

        el.destroy = () => {
            unsubs.forEach((u) => u());
            children.forEach((c) => c.destroy?.());
        };
    },
});
