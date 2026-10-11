import { ComponentFactory } from '../../factory.js';
import { MpiOverlay } from '../../Primitives/MpiOverlay/MpiOverlay.js';
import { MpiRadioGroup } from '../../Primitives/MpiRadioGroup/MpiRadioGroup.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiFileTree } from '../../Primitives/MpiFileTree/MpiFileTree.js';
import { downloadService } from '../../../services/downloadService.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { state } from '../../../state.js';
import { Events } from '../../../events.js';
import { qs } from '../../../utils/dom.js';
import { formatBytes } from '../../../utils/formatBytes.js';

const TABS = [
    { value: 'loras', label: 'LoRAs' },
    { value: 'upscale_models', label: 'Upscale models' },
];
const LIVE = new Set(['queued', 'uploading']);
const baseName = (rel) => String(rel).split('/').pop();
const pct = (j) => (j.totalBytes ? `${Math.floor((j.sentBytes / j.totalBytes) * 100)}%` : '0%');

/** Plain words for the server's coded refusals (routes/remoteUploads.js). */
const REFUSALS = {
    remote_inactive: 'Connect a Pod first. Any Pod works; the No GPU one costs least while big files go up.',
    runtime_too_old: 'This Pod runs an older engine that cannot take uploads. Restart the Pod to update it.',
};
const listError = (code, message) => REFUSALS[code] || `The Pod did not answer (${message || code}).`;

/**
 * MpiModelUploader — the "Upload models" overlay (MPI-1057 U3).
 *
 * Your own LoRAs and upscalers, sent to the Pod's network volume once and kept there.
 * Left: the files in your local model folders. Right: what the Pod's volume holds, plus
 * every upload still queued or running (shown the moment it is queued). Upload sends the
 * left selection; Delete removes the right selection from the volume, or stops its upload
 * if it is still going. Weights the app installed itself show greyed out: they belong to
 * a model, and deleting one here would leave its install state lying.
 *
 * The bars live in the Cue panel's Transfers section; this overlay only shows a %.
 * Server side: routes/remoteUploads.js. One instance for the app: `openModelUploader()`.
 *
 * Usage:
 *   openModelUploader({ type: 'loras' });
 */
export const MpiModelUploader = ComponentFactory.create({
    name: 'MpiModelUploader',
    css: ['js/components/Compounds/MpiModelUploader/MpiModelUploader.css'],

    template: () => `
        <div class="mpi-model-uploader">
            <div class="mpi-model-uploader__head">
                <h1 class="mpi-model-uploader__title">Upload models</h1>
                <p class="mpi-model-uploader__sub">Your own LoRAs and upscalers go to the Pod's volume once and stay there for every Pod after. Big files take a while from home: connect the No GPU Pod for them, it bills far less while you wait. Progress shows in the Cue panel (Q).</p>
                <div class="mpi-model-uploader__tabs" id="upl-tabs"></div>
            </div>
            <div class="mpi-model-uploader__body">
                <div class="mpi-model-uploader__side">
                    <span class="mpi-model-uploader__side-title">On this computer</span>
                    <div class="mpi-model-uploader__tree" id="upl-local"></div>
                    <div class="mpi-model-uploader__actions" id="upl-upload"></div>
                </div>
                <div class="mpi-model-uploader__side">
                    <span class="mpi-model-uploader__side-title">On the Pod</span>
                    <div class="mpi-model-uploader__tree" id="upl-remote"></div>
                    <div class="mpi-model-uploader__actions" id="upl-delete"></div>
                </div>
            </div>
            <p class="mpi-model-uploader__status" id="upl-status"></p>
        </div>`,

    setup: (el) => {
        const statusEl = qs('#upl-status', el);
        const _unsubs = [];

        let _type = 'loras';
        let _list = null;          // { local, remote } from GET /remote/user-models, null until read
        let _fetchSeq = 0;
        let _seen = new Map();     // job id -> status, to spot a job finishing
        let _open = false;

        const overlay = MpiOverlay.mount(document.createElement('div'), { closable: true, mountTarget: 'body' });
        overlay.el.appendToContainer(el);
        overlay.on('close', () => { _open = false; });

        const tabs = MpiRadioGroup.mount(qs('#upl-tabs', el), { options: TABS, value: _type, name: 'upl-type', size: 'sm' });
        const localTree = MpiFileTree.mount(qs('#upl-local', el), { fileIcon: 'cube', emptyText: 'No files in your model folders.' });
        const remoteTree = MpiFileTree.mount(qs('#upl-remote', el), { fileIcon: 'cloud', emptyText: 'Nothing uploaded yet.' });
        const uploadBtn = MpiButton.mount(qs('#upl-upload', el), {
            icon: 'upload', label: 'Upload', variant: 'primary', size: 'sm', disabled: true,
            info: 'Send the selected files to the Pod volume',
        });
        const deleteBtn = MpiButton.mount(qs('#upl-delete', el), {
            icon: 'trash', label: 'Delete', variant: 'danger', size: 'sm', disabled: true,
            info: 'Delete the selected files from the Pod volume, or stop an upload still running',
        });

        const _setStatus = (text = '') => { statusEl.textContent = text; };
        const _liveJobs = () => state.uploadJobs.filter(j => j.type === _type && LIVE.has(j.status));

        function _render() {
            if (!_list) return;
            const live = _liveJobs();
            const liveByName = new Map(live.map(j => [j.filename, j]));
            const onPod = new Set(_list.remote.filter(f => !f.partial).map(f => baseName(f.rel)));

            localTree.el.setItems(_list.local.map((f) => {
                const name = baseName(f.rel);
                const there = onPod.has(name);
                const going = liveByName.has(name);
                return {
                    value: f.rel,
                    note: there ? 'on the Pod' : going ? 'uploading' : formatBytes(f.sizeBytes),
                    disabled: there || going,
                };
            }));

            const rows = new Map();
            for (const f of _list.remote) {
                rows.set(f.rel, f.managed
                    ? { value: f.rel, note: `app model · ${formatBytes(f.sizeBytes)}`, disabled: true,
                        title: 'The app installed this one with a model. Remove it from that model instead.' }
                    : { value: f.rel, note: f.partial ? 'unfinished' : formatBytes(f.sizeBytes), dim: f.partial });
            }
            for (const j of live) {
                rows.set(j.filename, { value: j.filename, note: j.status === 'queued' ? 'queued' : pct(j), dim: true });
            }
            remoteTree.el.setItems([...rows.values()]);
        }

        async function _refresh() {
            const seq = ++_fetchSeq;
            const type = _type;
            try {
                const res = await fetch(`/remote/user-models?type=${type}`);
                const data = await res.json().catch(() => ({}));
                if (seq !== _fetchSeq) return;
                if (!res.ok) {
                    _list = null;
                    localTree.el.setMessage(' ');
                    remoteTree.el.setMessage(listError(data.error, data.message));
                    return;
                }
                _list = { local: data.local || [], remote: data.remote || [] };
                _render();
            } catch (err) {
                if (seq !== _fetchSeq) return;
                clientLogger.warn('runpod', `Upload models list failed: ${err.message}`);
                remoteTree.el.setMessage(listError('', err.message));
            }
        }

        function _loading() {
            _list = null;
            localTree.el.clearSelection();
            remoteTree.el.clearSelection();
            localTree.el.setMessage('Reading…');
            remoteTree.el.setMessage('Asking the Pod…');
        }

        tabs.on('select', ({ value }) => {
            _type = value;
            _setStatus();
            _loading();
            _refresh();
        });

        localTree.on('select', ({ values }) => uploadBtn.el.setDisabled(!values.length));
        remoteTree.on('select', ({ values }) => deleteBtn.el.setDisabled(!values.length));

        uploadBtn.on('click', async () => {
            const files = localTree.el.getSelected();
            if (!files.length) return;
            uploadBtn.el.setDisabled(true);
            _setStatus();
            try {
                const { skipped = [] } = await downloadService.uploadModels(_type, files);
                localTree.el.clearSelection();
                if (skipped.length) {
                    _setStatus(`Skipped ${skipped.length}: ${skipped.map(s => `${baseName(s.rel)} (${s.reason.replace(/_/g, ' ')})`).join(', ')}.`);
                }
                _render();
            } catch (err) {
                _setStatus(REFUSALS[err.message] || err.message);
                uploadBtn.el.setDisabled(false);
            }
        });

        deleteBtn.on('click', async () => {
            const values = remoteTree.el.getSelected();
            if (!values.length) return;
            deleteBtn.el.setDisabled(true);
            _setStatus();
            const failed = [];
            let refusal = '';   // a coded refusal (no Pod, old runtime) holds for every file: say it once
            for (const rel of values) {
                const job = _liveJobs().find(j => j.filename === rel);
                try {
                    if (job) { await downloadService.cancelUpload(job.id); continue; }
                    const res = await fetch('/remote/user-models/delete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: _type, filename: rel }),
                    });
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        if (REFUSALS[data.error]) { refusal = REFUSALS[data.error]; break; }
                        failed.push(`${rel} (${data.message || data.error || `HTTP ${res.status}`})`);
                    }
                } catch (err) {
                    failed.push(`${rel} (${err.message})`);
                }
            }
            remoteTree.el.clearSelection();
            if (refusal) _setStatus(refusal);
            else if (failed.length) _setStatus(`Not deleted: ${failed.join(', ')}.`);
            await _refresh();
        });

        // A job finishing changes what the volume holds: read it again. Anything else
        // (queued, started) only moves rows between states, which _render covers.
        _unsubs.push(Events.onState('uploadJobs', () => {
            const jobs = state.uploadJobs;
            const finished = jobs.some(j => j.type === _type && !LIVE.has(j.status) && LIVE.has(_seen.get(j.id)));
            _seen = new Map(jobs.map(j => [j.id, j.status]));
            if (finished && _open) _refresh(); else _render();
        }));
        _unsubs.push(Events.on('upload:progress', ({ id }) => {
            const j = state.uploadJobs.find(x => x.id === id);
            if (j && j.type === _type) remoteTree.el.setNote(j.filename, pct(j));
        }));

        el.open = ({ type } = {}) => {
            if (type && TABS.some(t => t.value === type)) _type = type;
            tabs.el.setValue(_type);
            _seen = new Map(state.uploadJobs.map(j => [j.id, j.status]));
            _setStatus();
            _loading();
            _open = true;
            overlay.el.show();
            _refresh();
        };

        el.destroy = () => {
            _unsubs.forEach(fn => fn?.());
            tabs.el.destroy?.();
            localTree.el.destroy?.();
            remoteTree.el.destroy?.();
            uploadBtn.el.destroy?.();
            deleteBtn.el.destroy?.();
            overlay.el.destroy?.();
            el.remove();
        };
    },
});

let _instance = null;

/** Open the one Upload models overlay, mounting it on first use. */
export function openModelUploader({ type = 'loras' } = {}) {
    if (!_instance) _instance = MpiModelUploader.mount(document.createElement('div'));
    _instance.el.open({ type });
}
