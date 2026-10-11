import { ComponentFactory } from '../../factory.js';
import { Events } from '../../../events.js';
import { ce, on, qs } from '../../../utils/dom.js';
import { renderIcon } from '../../../utils/icons.js';
import { mountButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { state } from '../../../state.js';
import { downloadService } from '../../../services/downloadService.js';
import { jobDisplayName } from '../../../shell/notificationService.js';
import {
    cancelBatch,
    cancelPendingCueJob,
    cancelRunningCueJob,
    clearPendingQueue,
    getGenerationQueueSnapshot,
} from '../../../services/generationService.js';

/**
 * MpiQueuePanel - Cue queue slide-over content.
 */
export const MpiQueuePanel = ComponentFactory.create({
    name: 'MpiQueuePanel',
    css: ['js/components/Compounds/MpiQueuePanel/MpiQueuePanel.css'],

    template: () => `
        <div class="mpi-queue-panel">
            <div class="mpi-queue-panel__head">
                <div class="mpi-queue-panel__brand">
                    <span class="mpi-queue-panel__brand-rule"></span>
                    <span class="mpi-queue-panel__title">Cue</span>
                </div>
                <div class="mpi-queue-panel__head-actions">
                    <span class="mpi-queue-panel__count"><b data-role="job-count">0</b> jobs</span>
                </div>
            </div>
            <div class="mpi-queue-panel__list"></div>
            <div class="mpi-queue-panel__transfers" hidden>
                <span class="mpi-queue-panel__transfers-title">Transfers</span>
                <div class="mpi-queue-panel__transfers-list"></div>
            </div>
            <div class="mpi-queue-panel__foot">
                <span class="mpi-queue-panel__foot-label" data-role="queue-depth">Idle</span>
                <span class="mpi-queue-panel__foot-next" data-role="next-up"></span>
            </div>
        </div>`,

    setup: (el, props, emit) => {
        const countEl = qs('[data-role="job-count"]', el);
        const listEl = qs('.mpi-queue-panel__list', el);
        const depthEl = qs('[data-role="queue-depth"]', el);
        const nextEl = qs('[data-role="next-up"]', el);
        const _unsubs = [];
        let _destroyed = false;

        // Appended, not mounted in place: the head already holds the count span,
        // and mount() replaces its container's contents (MPI-588).
        const _headBtn = (icon, action, label) => {
            const btn = mountButton({
                icon,
                size: 'sm',
                variant: 'ghost',
                extraClasses: 'mpi-queue-panel__icon-btn',
            });
            btn.dataset.action = action;
            btn.setAttribute('aria-label', label);
            qs('.mpi-queue-panel__head-actions', el).appendChild(btn);
            return btn;
        };
        const clearBtn = _headBtn('trash', 'clear', 'Clear pending queue');
        const closeBtn = _headBtn('close', 'close', 'Close queue');

        const _mediaUrl = (item) => item?.thumbPath || item?.url || item?.filePath || '';

        const _gcd = (a, b) => {
            let x = Math.abs(a);
            let y = Math.abs(b);
            while (y) [x, y] = [y, x % y];
            return x || 1;
        };

        const _ratioLabel = (job) => {
            if (job.ratio) return job.ratio;
            const width = Number(job.width) || 0;
            const height = Number(job.height) || 0;
            if (width > 0 && height > 0) {
                const factor = _gcd(width, height);
                return `${Math.round(width / factor)}:${Math.round(height / factor)}`;
            }
            return job.ratio || '';
        };

        const _dimensionsLabel = (job) => {
            const width = Number(job.width) || 0;
            const height = Number(job.height) || 0;
            return width > 0 && height > 0 ? `${width}x${height}` : '';
        };

        const _setRatio = (node, job) => {
            const width = Number(job.width) || 0;
            const height = Number(job.height) || 0;
            if (width > 0 && height > 0) node.style.aspectRatio = `${width} / ${height}`;
        };

        const _fitThumbFrame = (node, job) => {
            const width = Number(job.width) || 0;
            const height = Number(job.height) || 0;
            if (width <= 0 || height <= 0) return;

            if (width >= height) {
                node.style.setProperty('--thumb-frame-w', '100%');
                node.style.setProperty('--thumb-frame-h', `${Math.max(1, Math.min(100, (height / width) * 100))}%`);
            } else {
                node.style.setProperty('--thumb-frame-w', `${Math.max(1, Math.min(100, (width / height) * 100))}%`);
                node.style.setProperty('--thumb-frame-h', '100%');
            }
        };

        const _batchCount = (job) => Math.max(1, Number(job.batchCount) || 1);

        const _renderCountBadge = (job, fallbackCount = 0) => {
            const batchCount = _batchCount(job);
            const count = batchCount > 1 ? batchCount : fallbackCount;
            if (count <= 1) return null;
            return ce('span', {
                className: [
                    'mpi-queue-panel__thumb-count',
                    batchCount > 1 ? 'mpi-queue-panel__thumb-count--batch' : '',
                ].filter(Boolean).join(' '),
                textContent: `x${count}`,
            });
        };

        const _wireImageState = (wrap, img) => {
            wrap.classList.add('mpi-queue-panel__thumb--loading');

            const markLoaded = () => {
                wrap.classList.remove('mpi-queue-panel__thumb--loading');
                img.classList.add('mpi-queue-panel__thumb-img--loaded');
            };
            const markFailed = () => {
                wrap.classList.add('mpi-queue-panel__thumb--failed');
                img.removeAttribute('src');
            };

            img.onload = markLoaded;
            img.onerror = markFailed;
            if (img.complete && img.naturalWidth > 0) markLoaded();
        };

        const _renderMediaFrame = (job, src, className = '') => {
            const frame = ce('span', {
                className: ['mpi-queue-panel__thumb-frame', 'mpi-queue-panel__thumb-frame--media', className]
                    .filter(Boolean)
                    .join(' '),
            });
            _setRatio(frame, job);
            _fitThumbFrame(frame, job);

            const img = ce('img', {
                className: 'mpi-queue-panel__thumb-img',
                src,
                alt: '',
            });
            frame.appendChild(img);
            return { frame, img };
        };

        const _formatOperation = (value = '') => {
            const label = String(value || '').trim();
            return label ? label.replace(/[_-]+/g, ' ').toUpperCase() : 'GENERATE';
        };

        const _phaseLabel = (job) => {
            if (job.previewKind === 'preview') return 'Preview';
            if (job.previewKind === 'final') return 'Stage two';
            return '';
        };

        const _statusLabel = (job) => {
            if (job.status === 'running') {
                return ['Running', job.isLoop ? 'Loop' : '', _phaseLabel(job)]
                    .filter(Boolean)
                    .join(' · ');
            }
            return [job.isLoop ? 'Loop' : 'Pending', _phaseLabel(job)]
                .filter(Boolean)
                .join(' \u00b7 ');
        };

        const _statusTone = (job) => {
            if (job.status === 'running') return 'running';
            if (job.isLoop) return 'loop';
            return 'pending';
        };

        const _renderThumb = (job) => {
            const wrap = ce('div', { className: 'mpi-queue-panel__thumb' });
            const imageItems = (job.mediaItems || []).filter(item => item.mediaType === 'image' && _mediaUrl(item));
            const videoItem = (job.mediaItems || []).find(item => item.mediaType === 'video');
            const ratio = _ratioLabel(job);

            if (job.previewUrl) {
                wrap.classList.add('mpi-queue-panel__thumb--preview');
                const { frame, img } = _renderMediaFrame(job, job.previewUrl);
                wrap.appendChild(frame);
                const countBadge = _renderCountBadge(job);
                if (countBadge) wrap.appendChild(countBadge);
                _wireImageState(wrap, img);
                return wrap;
            }

            if (job.status === 'running') {
                wrap.classList.add('mpi-queue-panel__thumb--preview', 'mpi-queue-panel__thumb--loading');
                const frame = ce('span', {
                    className: 'mpi-queue-panel__thumb-frame mpi-queue-panel__thumb-frame--media',
                });
                _setRatio(frame, job);
                _fitThumbFrame(frame, job);
                wrap.appendChild(frame);
                const countBadge = _renderCountBadge(job);
                if (countBadge) wrap.appendChild(countBadge);
                return wrap;
            }

            if (imageItems.length) {
                wrap.classList.toggle('mpi-queue-panel__thumb--stack', imageItems.length > 1);
                imageItems.slice(0, 3).forEach((item, index) => {
                    wrap.appendChild(ce('img', {
                        className: `mpi-queue-panel__thumb-img mpi-queue-panel__thumb-img--${index + 1}`,
                        src: _mediaUrl(item),
                        alt: '',
                    }));
                });
                const countBadge = _renderCountBadge(job, imageItems.length);
                if (countBadge) wrap.appendChild(countBadge);
                return wrap;
            }

            if (videoItem?.thumbPath) {
                wrap.classList.add('mpi-queue-panel__thumb--video');
                const { frame, img } = _renderMediaFrame(job, videoItem.thumbPath);
                wrap.appendChild(frame);
                wrap.appendChild(ce('span', { className: 'mpi-queue-panel__thumb-badge', textContent: 'VIDEO' }));
                const countBadge = _renderCountBadge(job);
                if (countBadge) wrap.appendChild(countBadge);
                _wireImageState(wrap, img);
                return wrap;
            }

            wrap.classList.add(videoItem ? 'mpi-queue-panel__thumb--video' : 'mpi-queue-panel__thumb--empty');
            const frame = ce('span', { className: 'mpi-queue-panel__thumb-frame' });
            _setRatio(frame, job);
            _fitThumbFrame(frame, job);
            frame.appendChild(ce('span', { className: 'mpi-queue-panel__thumb-label', textContent: ratio || (videoItem ? 'VIDEO' : 'TEXT') }));
            wrap.appendChild(frame);
            const countBadge = _renderCountBadge(job);
            if (countBadge) wrap.appendChild(countBadge);
            return wrap;
        };

        const _renderAction = (job) => {
            // Text mode with the icon as children, not icon mode: icon mode derives
            // `data-info` from the label, and this button never had an Info Bar hint.
            const button = mountButton({
                size: 'sm',
                variant: 'ghost',
                extraClasses: `mpi-queue-panel__action mpi-queue-panel__action--${job.canStop ? 'stop' : 'cancel'}`,
            }, `${renderIcon(job.canStop ? 'stop' : 'close', 'xs')}<span>${job.canStop ? 'Stop' : 'Cancel'}</span>`);
            button.dataset.queueJobId = job.queueJobId || '';
            button.dataset.queueAction = job.canStop ? 'stop' : 'cancel';
            button.setAttribute('aria-label', job.canStop ? 'Stop current job' : 'Cancel queued job');
            return button;
        };

        // MPI-949 — a batch row collapses N jobs sharing a batchId into one line.
        // It shows "label · done / total" and a single Cancel all button that calls
        // cancelBatch (removes pending + stops running). The button stores the batchId
        // in data-batch-id so the click handler can route it without touching any
        // peer component's internals.
        const _renderBatchRow = (job, index) => {
            const card = ce('article', {
                className: [
                    'mpi-queue-panel__item',
                    `mpi-queue-panel__item--${job.status}`,
                    'mpi-queue-panel__item--batch',
                ].filter(Boolean).join(' '),
            });
            card.appendChild(ce('span', {
                className: 'mpi-queue-panel__index',
                textContent: String(index + 1).padStart(2, '0'),
            }));

            const thumb = ce('div', { className: 'mpi-queue-panel__thumb mpi-queue-panel__thumb--batch' });
            const frame = ce('span', { className: 'mpi-queue-panel__thumb-frame' });
            frame.appendChild(ce('span', {
                className: 'mpi-queue-panel__thumb-label',
                textContent: `${job.batchDone}/${job.batchTotal}`,
            }));
            thumb.appendChild(frame);
            card.appendChild(thumb);

            const body = ce('div', { className: 'mpi-queue-panel__body' });
            const status = ce('div', {
                className: `mpi-queue-panel__status mpi-queue-panel__status--${_statusTone(job)}`,
            });
            status.appendChild(ce('span', { className: 'mpi-queue-panel__dot' }));
            status.appendChild(ce('span', { textContent: _statusLabel(job) }));
            body.appendChild(status);
            body.appendChild(ce('div', {
                className: 'mpi-queue-panel__prompt',
                textContent: `${job.batchLabel || job.modelName || 'Batch'} · ${job.batchDone} / ${job.batchTotal}`,
            }));

            const cancelBtn = mountButton({
                size: 'sm',
                variant: 'ghost',
                extraClasses: 'mpi-queue-panel__action mpi-queue-panel__action--cancel',
            }, `${renderIcon('close', 'xs')}<span>Cancel all</span>`);
            cancelBtn.dataset.batchId = job.batchId;
            cancelBtn.dataset.queueAction = 'cancel-batch';
            cancelBtn.setAttribute('aria-label', 'Cancel all jobs in batch');
            body.appendChild(cancelBtn);

            card.appendChild(body);
            return card;
        };

        const _renderJob = (job, index) => {
            if (job.isBatch) return _renderBatchRow(job, index);
            const card = ce('article', {
                className: [
                    'mpi-queue-panel__item',
                    `mpi-queue-panel__item--${job.status}`,
                    job.isLoop ? 'mpi-queue-panel__item--loop' : '',
                ].filter(Boolean).join(' '),
            });

            card.appendChild(ce('span', {
                className: 'mpi-queue-panel__index',
                textContent: String(index + 1).padStart(2, '0'),
            }));
            card.appendChild(_renderThumb(job));

            const body = ce('div', { className: 'mpi-queue-panel__body' });
            const status = ce('div', { className: `mpi-queue-panel__status mpi-queue-panel__status--${_statusTone(job)}` });
            status.appendChild(ce('span', { className: 'mpi-queue-panel__dot' }));
            status.appendChild(ce('span', { textContent: _statusLabel(job) }));
            body.appendChild(status);
            body.appendChild(ce('div', {
                className: 'mpi-queue-panel__prompt',
                textContent: job.promptExcerpt || 'No prompt text',
            }));
            const ratio = _ratioLabel(job);
            const dimensions = _dimensionsLabel(job);
            const meta = ce('div', { className: 'mpi-queue-panel__meta' });
            // App gens (job.appTitle) show just the App name — the underlying
            // universal op ("APPIMAGEREGEN") is an implementation detail, not a model.
            meta.appendChild(ce('span', {
                className: 'mpi-queue-panel__meta-line mpi-queue-panel__meta-line--primary',
                textContent: job.appTitle
                    ? job.appTitle
                    : [job.modelName, _formatOperation(job.operation)].filter(Boolean).join(' / '),
            }));
            const sizeLabel = ratio && dimensions ? `${ratio} \u00b7 ${dimensions}` : ratio || dimensions;
            if (sizeLabel) {
                meta.appendChild(ce('span', {
                    className: 'mpi-queue-panel__meta-line mpi-queue-panel__meta-line--size',
                    textContent: sizeLabel,
                }));
            }
            // MPI-74: flag a force-local job. Only the 'local' exception is shown \u2014
            // default remote/local jobs carry no chip (absence = default engine).
            if (job.engine === 'local') {
                meta.appendChild(ce('span', {
                    className: 'mpi-queue-panel__meta-line mpi-queue-panel__meta-line--engine',
                    textContent: 'Local',
                }));
            }
            body.appendChild(meta);
            body.appendChild(_renderAction(job));
            card.appendChild(body);

            return card;
        };

        let _lastSig = '';
        const _cardByJobId = new Map();

        // MPI-949: batch rows use batchId+done/total instead of queueJobId so the
        // signature changes when progress advances (batchDone increments).
        const _signature = (items) => items
            .map(j => j.isBatch
                ? `batch:${j.batchId}|${j.status}|${j.batchDone}/${j.batchTotal}|${j.previewUrl ? 1 : 0}`
                : `${j.queueJobId || ''}|${j.status}|${j.isLoop ? 1 : 0}|${j.previewKind || ''}|${j.previewUrl ? 1 : 0}|${j.promptExcerpt || ''}|${j.width}x${j.height}|${j.modelName || ''}|${j.operation || ''}|${j.engine || ''}`)
            .join('\n');

        // MPI-949: batch rows are keyed by 'batch:<batchId>'; unbatched by queueJobId.
        const _cardKey = (job) => job.isBatch ? `batch:${job.batchId}` : job.queueJobId;

        const _patchPreview = (items) => {
            items.forEach((job) => {
                if (!job.previewUrl) return;
                const card = _cardByJobId.get(_cardKey(job));
                if (!card) return;
                const img = qs('.mpi-queue-panel__thumb-img', card);
                if (img && img.getAttribute('src') !== job.previewUrl) {
                    img.setAttribute('src', job.previewUrl);
                }
            });
        };

        const _render = (snapshot = getGenerationQueueSnapshot()) => {
            const items = snapshot.items || [];
            const pendingCount = snapshot.pendingCount || 0;
            countEl.textContent = String(items.length);
            clearBtn.setDisabled(pendingCount === 0);
            depthEl.textContent = items.length
                ? `${snapshot.runningCount || 0} running / ${pendingCount} queued`
                : 'Idle';
            nextEl.textContent = pendingCount ? `Next up · ${String((snapshot.runningCount || 0) + 1).padStart(2, '0')}` : '';

            const sig = _signature(items);
            if (sig === _lastSig && _cardByJobId.size === items.length) {
                _patchPreview(items);
                return;
            }
            _lastSig = sig;

            listEl.replaceChildren();
            _cardByJobId.clear();

            if (!items.length) {
                listEl.appendChild(ce('div', {
                    className: 'mpi-queue-panel__empty',
                    textContent: 'No queued generations.',
                }));
                return;
            }

            items.forEach((job, index) => {
                const card = _renderJob(job, index);
                const key = _cardKey(job);
                if (key) _cardByJobId.set(key, card);
                listEl.appendChild(card);
            });
        };

        // MPI-1057 — Transfers: model downloads and Upload models jobs, one bar each,
        // hidden while nothing moves. Rows rebuild when the set or a status changes;
        // byte ticks patch the bar and the meta line in place.
        const transfersEl = qs('.mpi-queue-panel__transfers', el);
        const transfersList = qs('.mpi-queue-panel__transfers-list', el);
        const _rowByKey = new Map();
        let _transferSig = '';
        const LIVE_DOWNLOAD = new Set(['pending', 'queued', 'downloading', 'installing', 'paused']);
        const _size = (b) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.round((b || 0) / 1e6)} MB`);

        const _transfers = () => [
            ...state.downloadJobs
                // Internal heals (engine:assets, engine:node-drift) are silent by design (MPI-576).
                .filter(j => LIVE_DOWNLOAD.has(j.status) && j.modelId !== '__universal_workflow__' && !downloadService.isSilentJob(j.modelId))
                .map(j => ({ kind: 'download', id: j.modelId, status: j.status, label: jobDisplayName(j.modelId), job: j })),
            ...state.uploadJobs
                .filter(j => j.status === 'queued' || j.status === 'uploading')
                .map(j => ({ kind: 'upload', id: j.id, status: j.status, label: j.filename, job: j })),
        ];

        const _transferPct = (t) => (t.kind === 'upload'
            ? (t.job.totalBytes ? (t.job.sentBytes / t.job.totalBytes) * 100 : 0)
            : (Number(t.job.progress) || 0) * 100);

        const _transferMeta = (t) => {
            const j = t.job;
            if (t.kind === 'upload') {
                return t.status === 'queued' ? 'Upload · waiting' : `Upload · ${_size(j.sentBytes)} / ${_size(j.totalBytes)}`;
            }
            if (t.status === 'queued' || t.status === 'pending') return 'Download · waiting';
            if (t.status === 'installing') return 'Download · installing';
            if (t.status === 'paused') return 'Download · paused';
            return ['Download', `${Math.round(_transferPct(t))}%`, j.speed].filter(Boolean).join(' · ');
        };

        const _renderTransfers = () => {
            const items = _transfers();
            const sig = items.map(t => `${t.kind}:${t.id}:${t.status}`).join('|');
            if (sig === _transferSig) {
                // Same rows, but a snapshot may have replaced the job objects: re-point and repaint.
                for (const t of items) {
                    const row = _rowByKey.get(`${t.kind}:${t.id}`);
                    if (row) { row.t = t; _patchTransfer(`${t.kind}:${t.id}`); }
                }
                return;
            }
            _transferSig = sig;
            transfersEl.hidden = items.length === 0;
            transfersList.replaceChildren();
            _rowByKey.clear();
            for (const t of items) {
                const row = ce('div', { className: `mpi-queue-panel__transfer mpi-queue-panel__transfer--${t.kind}` });
                const top = ce('div', { className: 'mpi-queue-panel__transfer-top' });
                top.appendChild(ce('span', { className: 'mpi-queue-panel__transfer-name', textContent: t.label, title: t.label }));
                const meta = ce('span', { className: 'mpi-queue-panel__transfer-meta', textContent: _transferMeta(t) });
                top.appendChild(meta);
                row.appendChild(top);
                const barHost = ce('div', { className: 'mpi-queue-panel__transfer-bar' });
                row.appendChild(barHost);
                const bar = MpiProgressBar.mount(barHost, { value: _transferPct(t), info: '' }).el;
                const cancel = mountButton({
                    size: 'sm',
                    variant: 'ghost',
                    extraClasses: 'mpi-queue-panel__transfer-cancel',
                }, `${renderIcon('close', 'xs')}<span>Cancel</span>`);
                cancel.dataset.transferKind = t.kind;
                cancel.dataset.transferId = t.id;
                cancel.setAttribute('aria-label', `Cancel ${t.kind} of ${t.label}`);
                row.appendChild(cancel);
                transfersList.appendChild(row);
                _rowByKey.set(`${t.kind}:${t.id}`, { t, bar, meta });
            }
        };

        const _patchTransfer = (key) => {
            const row = _rowByKey.get(key);
            if (!row) return;
            row.bar.setValueQuiet(_transferPct(row.t));
            row.meta.textContent = _transferMeta(row.t);
        };

        _unsubs.push(on(transfersList, 'click', (event) => {
            const button = event.target.closest?.('.mpi-queue-panel__transfer-cancel');
            if (!button) return;
            if (button.dataset.transferKind === 'upload') downloadService.cancelUpload(button.dataset.transferId);
            else downloadService.cancel(button.dataset.transferId);
        }));
        _unsubs.push(Events.onState('uploadJobs', _renderTransfers));
        _unsubs.push(Events.onState('downloadJobs', _renderTransfers));
        _unsubs.push(Events.on('download:snapshot', _renderTransfers));
        _unsubs.push(Events.on('upload:progress', (d) => _patchTransfer(`upload:${d.id}`)));
        _unsubs.push(Events.on('download:progress', (d) => _patchTransfer(`download:${d.modelId}`)));
        downloadService._ensureSSE();  // a reload mid-upload: the connect snapshot restores the rows
        _renderTransfers();

        _unsubs.push(on(clearBtn, 'click', () => clearPendingQueue()));
        _unsubs.push(on(closeBtn, 'click', () => emit('close-request', {})));
        _unsubs.push(on(listEl, 'click', (event) => {
            const button = event.target.closest?.('.mpi-queue-panel__action');
            if (!button || !listEl.contains(button)) return;
            const queueJobId = button.dataset.queueJobId;
            // MPI-949: batch rows use cancel-batch; individual rows use stop/cancel.
            if (button.dataset.queueAction === 'cancel-batch') cancelBatch(button.dataset.batchId);
            else if (button.dataset.queueAction === 'stop') cancelRunningCueJob(queueJobId);
            else cancelPendingCueJob(queueJobId);
        }));
        _unsubs.push(Events.on('generation-queue:changed', _render));
        _unsubs.push(Events.onState('loopArmed', () => _render()));

        const observer = new MutationObserver(() => {
            if (!document.contains(el)) {
                el.destroy?.();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        el.onOpen = () => _render();
        el.destroy = () => {
            if (_destroyed) return;
            _destroyed = true;
            _unsubs.forEach(fn => fn?.());
            observer.disconnect();
        };

        _render();
    },
});
