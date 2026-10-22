import { ComponentFactory } from '../../factory.js';
import { Events } from '../../../events.js';
import { state } from '../../../state.js';
import { ce, on, qs } from '../../../utils/dom.js';
import { renderMarkdownInto } from '../../../utils/markdown.js';
import { openExternal } from '../../../utils/openExternal.js';
import { mountButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiImageCarousel } from '../../Compounds/MpiImageCarousel/MpiImageCarousel.js';
import {
    DISCORD_INVITE_URL,
    acknowledgeAllDevUpdates,
    acknowledgeDevUpdate,
} from '../../../services/devUpdatesService.js';
import { getPendingUpdate, runUpdate } from '../../../services/updateChecker.js';

/**
 * MpiDevUpdates — the dev-updates list for the MpiSlideOver panel (MPI-1115).
 *
 * Renders `state.devUpdates` (the posts the user has not acknowledged, newest
 * first) as cards: date, text, an image carousel (click an image to see it big).
 * The card's X acknowledges it and it leaves the list; "Open in Discord" and links
 * inside the text open the browser. Empty = "All caught up". "Join the Discord" is always there: getting
 * people into the Discord is what the bell is for.
 *
 * MPI-1242: when the boot check found a newer version, an "Update to vX.Y.Z" button
 * sits at the top. Posts announce what is "Coming in 2.1.2", so the button naming
 * the same version is what joins the post to the install. Same runUpdate as Settings.
 *
 * Usage (via slide-over event, from the landing bell in js/shell/projectUI.js):
 *   Events.emit('slide-over:open', { title: 'Dev updates', component: MpiDevUpdates });
 */
export const MpiDevUpdates = ComponentFactory.create({
    name: 'MpiDevUpdates',
    css: ['js/components/Organisms/MpiDevUpdates/MpiDevUpdates.css'],

    template: () => `
        <div class="mpi-dev-updates">
            <div class="mpi-dev-updates__update" hidden></div>
            <div class="mpi-dev-updates__bar"></div>
            <div class="mpi-dev-updates__list"></div>
            <div class="mpi-dev-updates__empty">
                <p class="mpi-dev-updates__empty-title">All caught up</p>
                <p class="mpi-dev-updates__empty-text">New posts from the dev land here as they go up on Discord.</p>
            </div>
            <div class="mpi-dev-updates__foot"></div>
        </div>`,

    setup: (el) => {
        const listEl = qs('.mpi-dev-updates__list', el);
        const emptyEl = qs('.mpi-dev-updates__empty', el);
        const barEl = qs('.mpi-dev-updates__bar', el);

        const markAll = mountButton({ text: 'Mark all read', variant: 'ghost', size: 'sm' });
        barEl.appendChild(markAll);
        const join = mountButton({ text: 'Join the Discord', variant: 'primary', size: 'md' });
        qs('.mpi-dev-updates__foot', el).appendChild(join);

        const updateEl = qs('.mpi-dev-updates__update', el);
        getPendingUpdate().then((info) => {
            if (!info) return;
            const btn = mountButton({ text: `Update to v${info.latest}`, variant: 'primary', size: 'md' });
            _unsubs.push(on(btn, 'click', () => runUpdate(info.latest)));
            updateEl.appendChild(btn);
            updateEl.hidden = false;
        });

        const _date = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

        let _carousels = [];

        const _card = (post) => {
            const card = ce('article', { className: 'mpi-dev-updates__card' });
            card.dataset.id = post.id;
            const read = mountButton({ icon: 'close', size: 'sm', variant: 'ghost', info: 'Mark as read', extraClasses: 'mpi-dev-updates__read' });
            card.append(ce('span', { className: 'mpi-dev-updates__date' }, _date(post.at)), read);
            if (post.text) {
                const text = ce('div', { className: 'mpi-dev-updates__text' });
                renderMarkdownInto(text, post.text);
                card.append(text);
            }
            if (post.images?.length) {
                const host = card.appendChild(ce('div'));
                _carousels.push(MpiImageCarousel.mount(host, { images: post.images.map((i) => i.url), expandable: true }));
            }
            if (post.link) {
                const open = mountButton({ text: 'Open in Discord', variant: 'ghost', size: 'sm', extraClasses: 'mpi-dev-updates__open' });
                open.dataset.link = post.link;
                card.append(open);
            }
            return card;
        };

        const _render = (posts) => {
            _carousels.forEach((c) => c.destroy());
            _carousels = [];
            listEl.replaceChildren(...posts.map(_card));
            emptyEl.hidden = posts.length > 0;
            barEl.hidden = posts.length === 0;
        };

        const _unsubs = [
            Events.onState('devUpdates', _render),
            on(markAll, 'click', acknowledgeAllDevUpdates),
            on(join, 'click', () => openExternal(DISCORD_INVITE_URL)),
            on(listEl, 'click', (e) => {
                const open = e.target.closest('[data-link]');
                if (open) return openExternal(open.dataset.link);
                const link = e.target.closest('a[href]');
                if (link) {
                    e.preventDefault();
                    return openExternal(link.getAttribute('href'));
                }
                if (e.target.closest('.mpi-dev-updates__read')) {
                    acknowledgeDevUpdate(e.target.closest('.mpi-dev-updates__card').dataset.id);
                }
            }),
        ];

        _render(state.devUpdates);

        el.destroy = () => {
            _unsubs.forEach((fn) => fn());
            _carousels.forEach((c) => c.destroy());
        };
    },
});
