import { ComponentFactory } from '../../factory.js';
import { MpiModal } from '../../Primitives/MpiModal/MpiModal.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiIcon } from '../../Primitives/MpiIcon/MpiIcon.js';
import { qs } from '../../../utils/dom.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { getStoreUrl } from '../../../services/updateChecker.js';

/**
 * MpiErrorDialog — Global Error Notification Dialog (Compound)
 *
 * A self-contained blocking modal that surfaces actionable error messages to
 * the user.
 *
 * MPI-1355: 2.1.4 is the last free release and gets no support, so the report and
 * log buttons are gone (GitHub Issues are closed). Under the error a line says this
 * version is no longer supported, and "Get the latest version" opens the paid
 * version's Gumroad page — the same page as the update prompt.
 *
 * Designed to be used as a singleton via `showError()` in shell.js.
 * Callers never mount this directly — they call:
 *   import { showError } from '../../shell.js';
 *   showError('Title', 'What went wrong');
 *
 * Props: none.
 *
 * Instance methods (on instance.el):
 *   show()  — portals backdrop + dialog to document.body
 *   hide()  — removes portal, releases OverlayManager
 *   setError(title, message) — update content before or after show()
 *
 * Emits:
 * 'dismiss'   {} — Dismiss button clicked
 * 'latest'    {} — Get the latest version button clicked
 */
export const MpiErrorDialog = ComponentFactory.create({
    name: 'MpiErrorDialog',
    css: ['js/components/Compounds/MpiErrorDialog/MpiErrorDialog.css'],

    template: () => `
        <div class="mpi-error-dialog" role="alertdialog" aria-modal="true">
            <div class="mpi-error-dialog__header">
                <div class="mpi-error-dialog__icon" id="icon-slot"></div>
                <div class="mpi-error-dialog__title" id="title-slot"></div>
            </div>
            <div class="mpi-error-dialog__message" id="message-slot"></div>
            <div class="mpi-error-dialog__notice">Sorry, this version is no longer supported. To get the latest version, visit Gumroad.</div>
            <div class="mpi-error-dialog__status" id="status-slot" hidden></div>
            <div class="mpi-error-dialog__actions" id="actions-slot"></div>
        </div>
    `,

    setup: (el, props, emit) => {
        // ── Modal primitive — owns backdrop, portal, Overlays, Events ────────
        const modal = MpiModal.mount(document.createElement('div'), {
            width: 'min(560px, 90vw)',
            backdropClose: false,
        });
        modal.el.appendChild(el);
        el.show = () => modal.el.show();
        el.hide = () => modal.el.hide();

        // ── Icon ─────────────────────────────────────────────────────────────
        const iconSlot = qs('#icon-slot', el);
        const icon = MpiIcon.mount(document.createElement('div'), {
            name: 'info',
            size: 'lg',
            color: 'danger',
        });
        iconSlot.appendChild(icon.el);

        // ── Title ────────────────────────────────────────────────────────────
        const titleSlot = qs('#title-slot', el);
        titleSlot.textContent = props.title || 'An error occurred';

        // ── Message ──────────────────────────────────────────────────────────
        const messageSlot = qs('#message-slot', el);
        messageSlot.textContent = props.message || '';

        // ── Status line ──────────────────────────────────────────────────────
        // A browser that will not open lands here, never only in the log.
        const statusSlot = qs('#status-slot', el);
        const setStatus = (text) => {
            statusSlot.textContent = text || '';
            statusSlot.hidden = !text;
        };

        /** Open a URL in the system browser. Returns false if nothing opened. */
        async function openExternal(url) {
            try {
                const { ipcRenderer } = require('electron');
                if (ipcRenderer) {
                    await ipcRenderer.invoke('open-external', url);
                    return true;
                }
            } catch (ipcErr) {
                clientLogger.warn('error-dialog', 'Electron IPC unavailable, falling back to window.open', ipcErr);
            }
            try {
                return Boolean(window.open(url, '_blank'));
            } catch (openErr) {
                clientLogger.error('error-dialog', 'window.open failed', openErr);
                return false;
            }
        }

        // ── Actions ──────────────────────────────────────────────────────────
        const actionsSlot = qs('#actions-slot', el);

        const latestBtn = MpiButton.mount(document.createElement('div'), {
            text: 'Get the latest version',
            variant: 'outline',
            size: 'md',
        });
        latestBtn.on('click', async () => {
            emit('latest', {});
            setStatus('');
            const url = getStoreUrl();
            if (!await openExternal(url)) {
                setStatus(`Could not open your browser. Copy this address into it:\n${url}`);
            }
        });
        actionsSlot.appendChild(latestBtn.el);

        const dismissBtn = MpiButton.mount(document.createElement('div'), {
            text: 'Dismiss',
            variant: 'primary',
            size: 'md',
        });
        dismissBtn.on('click', () => {
            emit('dismiss', {});
            el.hide();
        });
        actionsSlot.appendChild(dismissBtn.el);

        // ── setError — update content at any time ────────────────────────────
        el.setError = (title, message) => {
            titleSlot.textContent = title || 'An error occurred';
            messageSlot.textContent = message || '';
            setStatus('');
        };
    }
});
