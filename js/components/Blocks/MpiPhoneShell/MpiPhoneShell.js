import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { ce, qs } from '../../../utils/dom.js';
import { clientLogger } from '../../../services/clientLogger.js';

/**
 * MpiPhoneShell — the phone companion's frame (MPI-1300, Phase 1).
 *
 * Top bar (logo, project name, pod pill, settings), one screen slot, and the
 * Cosmo / Gallery / Queue tab bar. Spec: tasks/MPI-1300/research/mockups/phone.html.
 * The screens are placeholders until Phase 2/3 mount the real ones into the slot;
 * the project-name, pod-pill and settings taps land in those phases too.
 */

const TABS = [
    { id: 'cosmo',   icon: 'chat',   label: 'Cosmo',   soon: 'Chat with Cosmo lands here next.' },
    { id: 'gallery', icon: 'grid',   label: 'Gallery', soon: 'The project gallery lands here next.' },
    { id: 'queue',   icon: 'layers', label: 'Queue',   soon: 'The queue lands here next.' },
];

async function _getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return res.json();
}

export const MpiPhoneShell = ComponentFactory.create({
    name: 'MpiPhoneShell',
    css: ['js/components/Blocks/MpiPhoneShell/MpiPhoneShell.css'],

    template: () => `
        <div class="mpi-phone-shell">
            <header class="mpi-phone-shell__top">
                <img class="mpi-phone-shell__logo" src="assets/mascot/studio/logo.webp" alt="">
                <div class="mpi-phone-shell__project"></div>
                <div class="mpi-phone-shell__pod"></div>
                <div class="mpi-phone-shell__settings"></div>
            </header>
            <main class="mpi-phone-shell__screen"></main>
            <nav class="mpi-phone-shell__tabs"></nav>
        </div>`,

    setup: (el) => {
        const children = [];
        const mountInto = (slot, Comp, props, html) => {
            const inst = Comp.mount(ce('div'), props, html);
            slot.appendChild(inst.el);
            children.push(inst);
            return inst;
        };

        const project = mountInto(qs('.mpi-phone-shell__project', el), MpiButton, {
            icon: 'chevronDown', label: '…', labelPosition: 'left', variant: 'ghost',
            info: 'The project open on your PC',
        });
        // REDESIGN-DEVIATION: the mockup's pill is transparent with a hairline; `secondary`
        // is the quietest bordered MpiButton, and a consumer may not redraw a button's chrome.
        const pod = mountInto(qs('.mpi-phone-shell__pod', el), MpiButton, {
            text: 'Local', variant: 'secondary', size: 'sm', shape: 'pill',
            info: 'Where generations run',
        }, '<span class="mpi-phone-shell__dot"></span>');
        mountInto(qs('.mpi-phone-shell__settings', el), MpiButton, {
            icon: 'settings', variant: 'ghost', info: 'Settings',
        });

        // ── Tabs ─────────────────────────────────────────────────────────────
        const screen = qs('.mpi-phone-shell__screen', el);
        const tabBar = qs('.mpi-phone-shell__tabs', el);
        const tabs = TABS.map((t) => {
            const host = ce('div', { className: 'mpi-phone-shell__tab' });
            tabBar.appendChild(host);
            const btn = mountInto(host, MpiButton, {
                icon: t.icon, label: t.label, labelPosition: 'bottom', variant: 'ghost', info: t.label,
            });
            btn.on('click', () => showTab(t.id));
            return { ...t, host, btn };
        });

        function showTab(id) {
            for (const t of tabs) {
                const on = t.id === id;
                t.host.classList.toggle('mpi-phone-shell__tab--active', on);
                t.btn.el.setActive(on);
                if (on) t.btn.el.setAttribute('aria-current', 'page');
                else t.btn.el.removeAttribute('aria-current');
            }
            const tab = tabs.find(t => t.id === id);
            screen.replaceChildren(ce('p', { className: 'mpi-phone-shell__soon', textContent: tab.soon }));
            el.dataset.tab = id;
        }
        showTab('cosmo');

        // ── Live data: read-only in Phase 1 ──────────────────────────────────
        _getJson('/connector/current-project')
            .then((r) => project.el.setLabel(r?.ok && r.output?.name ? r.output.name : 'No project open'))
            .catch((err) => {
                clientLogger.warn('phone', `current project unavailable: ${err.message}`);
                project.el.setLabel('No project open');
            });
        _getJson('/remote/mode')
            .then((m) => {
                const onPod = !!(m?.active && m.podId);
                pod.el.setLabel(onPod ? 'Pod' : 'Local');
                pod.el.classList.toggle('mpi-phone-shell__pod-btn--on', onPod);
            })
            .catch((err) => clientLogger.warn('phone', `remote mode unavailable: ${err.message}`));

        el.destroy = () => children.forEach(c => c.destroy?.());
    },
});
