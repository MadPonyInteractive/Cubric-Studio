import { ComponentFactory } from '../../factory.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiPhoneChat } from '../../Compounds/MpiPhoneChat/MpiPhoneChat.js';
import { MpiPhoneGallery } from '../../Compounds/MpiPhoneGallery/MpiPhoneGallery.js';
import { MpiPhoneViewer } from '../../Compounds/MpiPhoneViewer/MpiPhoneViewer.js';
import { ce, qs } from '../../../utils/dom.js';
import { clientLogger } from '../../../services/clientLogger.js';

/**
 * MpiPhoneShell — the phone companion's frame (MPI-1300).
 *
 * Top bar (logo, project name, pod pill, settings), one screen slot, and the
 * Cosmo / Gallery / Queue tab bar. Spec: tasks/MPI-1300/research/mockups/phone.html.
 * Phase 2 mounts the chat and the gallery (+ its full-screen viewer) and makes the project
 * name a switcher. The phone keeps ITS OWN project: it starts on the one open on the PC
 * and never moves the PC's view (Fabio, 2026-10-26). Queue, pod pill and settings: Phase 3.
 */

const TABS = [
    { id: 'cosmo',   icon: 'chat',   label: 'Cosmo' },
    { id: 'gallery', icon: 'grid',   label: 'Gallery' },
    { id: 'queue',   icon: 'layers', label: 'Queue',   soon: 'The queue lands here next.' },
];

async function _postJson(url, body) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
}

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
            <div class="mpi-phone-shell__sheet" hidden>
                <div class="mpi-phone-shell__sheet-head">
                    <b>Projects</b>
                    <div class="mpi-phone-shell__sheet-close"></div>
                </div>
                <div class="mpi-phone-shell__sheet-list"></div>
                <div class="mpi-phone-shell__sheet-new">
                    <div class="mpi-phone-shell__sheet-name"></div>
                    <div class="mpi-phone-shell__sheet-create"></div>
                </div>
            </div>
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
            info: 'Switch or create a project',
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

        // ── Screens: mounted once, shown one at a time, so a chat keeps its scroll ──
        const screens = {
            cosmo: MpiPhoneChat.mount(ce('div'), {}),
            gallery: MpiPhoneGallery.mount(ce('div'), {}),
            queue: { el: ce('p', { className: 'mpi-phone-shell__soon', textContent: TABS[2].soon }) },
        };
        children.push(screens.cosmo, screens.gallery);
        for (const s of Object.values(screens)) {
            s.el.classList.add('mpi-phone-shell__pane');
            screen.appendChild(s.el);
        }

        function showTab(id) {
            for (const t of tabs) {
                const on = t.id === id;
                t.host.classList.toggle('mpi-phone-shell__tab--active', on);
                t.btn.el.setActive(on);
                if (on) t.btn.el.setAttribute('aria-current', 'page');
                else t.btn.el.removeAttribute('aria-current');
                screens[t.id].el.hidden = !on;
            }
            if (id === 'gallery' && el.dataset.tab && el.dataset.tab !== 'gallery') screens.gallery.el.refresh();
            el.dataset.tab = id;
        }
        showTab('cosmo');

        // ── The viewer: full screen over everything, one at a time ───────────
        let viewer = null;
        const closeViewer = () => {
            viewer?.destroy?.();
            viewer?.el.remove();
            viewer = null;
        };
        screens.gallery.on('open', ({ cards, index, total }) => {
            closeViewer();
            viewer = MpiPhoneViewer.mount(ce('div'), { cards, index, total });
            el.appendChild(viewer.el);
            viewer.on('close', closeViewer);
            viewer.on('to-cosmo', (card) => {
                closeViewer();
                showTab('cosmo');
                screens.cosmo.el.attachCard(card);
            });
        });

        // ── The phone's project ──────────────────────────────────────────────
        let _current = null;
        function setProject(p) {
            _current = p;
            project.el.setLabel(p?.name || 'No project open');
            screens.cosmo.el.setProject(p);
            screens.gallery.el.setProject(p);
        }

        const sheet = qs('.mpi-phone-shell__sheet', el);
        const sheetList = qs('.mpi-phone-shell__sheet-list', el);
        let sheetKids = [];
        const nameField = mountInto(qs('.mpi-phone-shell__sheet-name', el), MpiInput, { placeholder: 'New project name' });
        const createBtn = mountInto(qs('.mpi-phone-shell__sheet-create', el), MpiButton, { icon: 'plus', label: 'Create', variant: 'primary', info: 'Create a project on your PC' });
        mountInto(qs('.mpi-phone-shell__sheet-close', el), MpiButton, { icon: 'close', variant: 'ghost', info: 'Close' })
            .on('click', () => { sheet.hidden = true; });

        async function openSheet() {
            sheet.hidden = false;
            sheetKids.forEach((c) => c.destroy?.());
            sheetKids = [];
            sheetList.replaceChildren(ce('p', { className: 'mpi-phone-shell__soon', textContent: 'Loading projects…' }));
            const r = await _getJson('/connector/projects').catch((err) => ({ ok: false, error: { message: err.message } }));
            if (!r.ok) {
                sheetList.replaceChildren(ce('p', { className: 'mpi-phone-shell__soon', textContent: `Could not list projects: ${r.error?.message}` }));
                return;
            }
            sheetList.replaceChildren(...r.projects.map((p) => {
                const btn = MpiButton.mount(ce('div'), { text: p.name, variant: 'ghost', info: p.folderPath });
                sheetKids.push(btn);
                btn.el.setActive(p.folderPath === _current?.folderPath);
                btn.on('click', () => { sheet.hidden = true; setProject({ folderPath: p.folderPath, name: p.name }); });
                return btn.el;
            }));
        }
        project.on('click', openSheet);
        createBtn.on('click', async () => {
            const name = (qs('input', nameField.el)?.value || '').trim();
            if (!name) return;
            createBtn.el.setDisabled(true);
            const r = await _postJson('/connector/create-project', { name }).catch((err) => ({ ok: false, error: { message: err.message } }));
            createBtn.el.setDisabled(false);
            if (!r.ok) {
                sheetList.prepend(ce('p', { className: 'mpi-phone-shell__error', textContent: r.error?.message || 'Could not create it.' }));
                return;
            }
            nameField.el.setValue('');
            sheet.hidden = true;
            setProject(r.project);
        });

        _getJson('/connector/current-project')
            .then((r) => setProject(r?.ok && r.output?.folderPath ? r.output : null))
            .catch((err) => {
                clientLogger.warn('phone', `current project unavailable: ${err.message}`);
                setProject(null);
            });
        _getJson('/remote/mode')
            .then((m) => {
                const onPod = !!(m?.active && m.podId);
                pod.el.setLabel(onPod ? 'Pod' : 'Local');
                pod.el.classList.toggle('mpi-phone-shell__pod-btn--on', onPod);
            })
            .catch((err) => clientLogger.warn('phone', `remote mode unavailable: ${err.message}`));

        el.destroy = () => {
            closeViewer();
            [...children, ...sheetKids].forEach(c => c.destroy?.());
        };
    },
});
