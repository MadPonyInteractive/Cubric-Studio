import { ComponentFactory } from '../../factory.js';
import { MpiModal } from '../../Primitives/MpiModal/MpiModal.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { MpiSpinner } from '../../Primitives/MpiSpinner/MpiSpinner.js';
import { MpiButton, mountButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { Storage } from '../../../core/storage.js';
import { state } from '../../../state.js';
import { qs, qsa, on } from '../../../utils/dom.js';
import { renderIcon } from '../../../utils/icons.js';
import { formatBytes } from '../../../utils/formatBytes.js';
import { startElapsedTicker } from '../../../utils/elapsedTicker.js';
import { Events } from '../../../events.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { downloadService } from '../../../services/downloadService.js';

/* The two Phase-0 cards' faces. They live outside the template because each card is
   a mounted MpiButton the setup places, not markup — see `_mountRef` (MPI-588). */
const CHOICE_LOCAL_FACE = `
    <span class="mpi-engine-install__choice-head">
        <span class="mpi-engine-install__choice-mark">${renderIcon('laptop', 'md')}</span>
        <span class="mpi-engine-install__choice-flag">Recommended</span>
    </span>
    <span class="mpi-engine-install__choice-title">Local + Remote</span>
    <span class="mpi-engine-install__choice-body">
        Install ComfyUI here and generate on your own GPU.
        A cloud GPU stays available for what it can't take.
    </span>
    <span class="mpi-engine-install__choice-facts">
        <span>Installs once, then free to run</span>
        <span>Works offline — models stay on your disk</span>
        <span>Needs a capable GPU</span>
    </span>
    <span class="mpi-engine-install__choice-go">
        Install ComfyUI ${renderIcon('chevronRight', 'sm')}
    </span>`;

const CHOICE_REMOTE_FACE = `
    <span class="mpi-engine-install__choice-head">
        <span class="mpi-engine-install__choice-mark">${renderIcon('cloud', 'md')}</span>
    </span>
    <span class="mpi-engine-install__choice-title">Remote only</span>
    <span class="mpi-engine-install__choice-body">
        Skip the local install and run everything on a RunPod cloud GPU.
        Nothing downloads to this machine now.
    </span>
    <span class="mpi-engine-install__choice-facts">
        <span>Nothing to install — straight into the app</span>
        <span>Runs on any machine, GPU or not</span>
        <span>Needs a RunPod account, billed while a Pod runs</span>
    </span>
    <span class="mpi-engine-install__choice-go">
        Set up RunPod ${renderIcon('chevronRight', 'sm')}
    </span>`;

// ── Progress phase copy (MPI-792) ────────────────────────────────────────────
const STEPS = ['download', 'install', 'finish'];
const UW_JOB = '__universal_workflow__';

/* Machine stage ids the server broadcasts as `status` → what the user reads. Anything
   not listed is already human copy (ensureGit, upgrade steps) and shows as-is. */
const STAGE_LABELS = {
    'extracting':        'Unpacking the engine',
    'uv-venv':           'Creating the Python environment',
    'install-comfy-cli': 'Installing the ComfyUI installer',
    'install-torch':     'Installing PyTorch',
    'comfy-install':     'Installing ComfyUI and its Python packages',
    'git fetch':         'Fetching ComfyUI updates',
    'git checkout':      'Switching the engine version',
    'patching':          'Finishing up',
};

/* Rotated under the clock once nothing has happened for a while. Some steps are
   silent for minutes by nature (a big unpack, a pip build), and silence is exactly
   what made users quit mid-install. */
const QUIET_HINTS = [
    'Still working. Some steps stay quiet for a few minutes.',
    'Large files take a while to download and unpack. Nothing is stuck.',
    'No need to click anything. This screen moves on by itself.',
];

const _eta = (sec) => {
    if (sec < 60) return 'under a minute left';
    if (sec < 3600) return `about ${Math.round(sec / 60)} min left`;
    return `about ${Math.floor(sec / 3600)} h ${Math.round((sec % 3600) / 60)} min left`;
};

/**
 * MpiEngineInstall — Engine provisioning modal for first install and upgrades (Compound)
 *
 * Uses MpiModal primitive for modal management and MpiButton, MpiInput, MpiProgressBar primitives.
 *
 * Three-phase UI for first install:
 *   Phase 0 (choose):    Local + Remote  vs  Remote Only  (MPI-519)
 *   Phase 1 (setup):     Models path picker + Browse button + Install button
 *   Phase 2 (progress):  Step tracker + what is happening now + bar or spinner + detail,
 *                        an elapsed clock and a keep-open notice (MPI-792)
 *
 * For upgrades / repairs:
 *   Skips phases 0 and 1, goes straight to Phase 2 with "models are safe" messaging
 *
 * API:
 *   inst.el.show(mode)      — 'installing' | 'upgrading' | 'repairing'
 *   inst.el.hide()          — closes modal
 *   inst.el.setError(msg)   — show error + retry button
 *
 * Emits (internal to component):
 *   'engine:ready' — when download/extract/patch complete (actually emitted to Events bus)
 *
 * Event subscription:
 *   Subscribes to engine:* events via downloadService bridge (no direct SSE connection)
 */
export const MpiEngineInstall = ComponentFactory.create({
    name: 'MpiEngineInstall',
    css: ['js/components/Compounds/MpiEngineInstall/MpiEngineInstall.css'],
    template: (props) => `
        <div class="mpi-engine-install">
            <!-- Phase 0: Choose where Cubric generates (MPI-519).
                 This replaces the old bottom-of-setup RunPod escape hatch (MPI-390):
                 the same decision, promoted from a footnote link to the first thing
                 asked, because "install a multi-GB CUDA engine you will never use" is
                 not a default — it is one of two equal answers. GPU detection stays
                 out of it: it misses too much to gate on (MPI-387 F2: Iris/UHD/HD
                 fall through BY DESIGN), so the user picks, not us. Neither card
                 opens Settings — that would race the first-launch 18+/changelog
                 overlay chain (MPI-333). -->
            <div class="mpi-engine-install__phase" data-phase="choose">
                <div class="mpi-engine-install__content">
                    <h2 class="mpi-engine-install__title">Where should Cubric generate?</h2>
                    <p class="mpi-engine-install__subtitle">Two ways to run ComfyUI. Change this later in Settings.</p>

                    <!-- The four controls in this template are mounted MpiButtons, not
                         markup: _mountRef swaps each placeholder for the real button in
                         setup, keeping the data-ref the wiring below already reads
                         (MPI-588). Their faces are the CHOICE_* consts above. -->
                    <div class="mpi-engine-install__choices">
                        <div data-mount="chooseLocal"></div>
                        <div data-mount="chooseRemote"></div>
                    </div>

                    <p class="mpi-engine-install__foot">
                        New to RunPod?
                        <a href="https://youtu.be/drpZOrMDEq8" data-ref="docsLink" target="_blank" rel="noopener noreferrer">Watch the 2-minute setup</a>
                    </p>
                </div>
            </div>

            <!-- Phase 1: Setup (path picker) -->
            <div class="mpi-engine-install__phase" data-phase="setup">
                <div class="mpi-engine-install__content">
                    <div data-mount="backToChoose"></div>

                    <h2 class="mpi-engine-install__title">Install ComfyUI</h2>
                    <p class="mpi-engine-install__subtitle">Pick where your models live. Expect this folder to grow — models are large, and they stay on your disk.</p>

                    <div class="mpi-engine-install__form">
                        <label class="mpi-engine-install__label">Models folder</label>
                        <div class="mpi-engine-install__folder-input-row">
                            <div data-ref="pathInputMount"></div>
                            <div data-ref="browseButtonMount"></div>
                        </div>
                        <p class="mpi-engine-install__hint">Changeable later in Settings. Leave it empty to use the default folder.</p>
                    </div>

                    <div class="mpi-engine-install__action" data-ref="installButtonMount"></div>
                </div>
            </div>

            <!-- Phase 2: Progress (MPI-792). A multi-minute step used to sit under one
                 thin sweep and a label that stopped changing, which users read as a
                 hang — they quit mid-install and came back to a broken engine. So
                 every row here moves: steps, what is happening now, a bar only while a
                 number is honest (a spinner otherwise), and a clock that always ticks. -->
            <div class="mpi-engine-install__phase" data-phase="progress">
                <div class="mpi-engine-install__content">
                    <h2 class="mpi-engine-install__title" data-ref="progressTitle">Installing ComfyUI Engine</h2>

                    <ol class="mpi-engine-install__steps">
                        <li class="mpi-engine-install__step" data-step="download">${renderIcon('check', 'sm')}Download</li>
                        <li class="mpi-engine-install__step" data-step="install">${renderIcon('check', 'sm')}Install</li>
                        <li class="mpi-engine-install__step" data-step="finish">${renderIcon('check', 'sm')}Finish</li>
                    </ol>

                    <div class="mpi-engine-install__progress-section mpi-engine-install__progress-section--busy" data-ref="meter">
                        <div class="mpi-engine-install__now">
                            <span class="mpi-engine-install__mark">
                                <span class="mpi-engine-install__mark-spin" data-ref="spinner"></span>
                                <span class="mpi-engine-install__mark-pct" data-ref="pct"></span>
                                <span class="mpi-engine-install__mark-done">${renderIcon('check', 'sm')}</span>
                            </span>
                            <p class="mpi-engine-install__now-label" data-ref="nowLabel">Preparing download...</p>
                        </div>
                        <div class="mpi-engine-install__bar" data-ref="progressBar"></div>
                        <p class="mpi-engine-install__progress-info" data-ref="progressInfo"></p>
                    </div>

                    <p class="mpi-engine-install__pulse">
                        <span class="mpi-engine-install__clock" data-ref="clock"></span>
                        <span class="mpi-engine-install__quiet" data-ref="quiet"></span>
                    </p>

                    <p class="mpi-engine-install__message" data-ref="upgradeMessage" style="display: none;">
                        Your models are safe — only the ComfyUI engine is being updated.
                    </p>

                    <p class="mpi-engine-install__keep-open">
                        Keep Cubric open until this finishes. Closing it interrupts the install.
                    </p>

                    <p class="mpi-engine-install__docs-link">
                        While you wait, learn more in the
                        <a href="https://docs.cubric.studio" data-ref="docsLink" target="_blank" rel="noopener noreferrer">documentation</a>.
                    </p>

                </div>
            </div>

            <!-- Error state -->
            <div class="mpi-engine-install__phase" data-phase="error">
                <div class="mpi-engine-install__content mpi-engine-install__content--error">
                    <h2 class="mpi-engine-install__title mpi-engine-install__title--error">Installation Failed</h2>
                    <p class="mpi-engine-install__error-message" data-ref="errorMessage">An error occurred during installation</p>
                    <div data-ref="retryButtonMount"></div>

                    <!-- Repair escape (MPI-427). Retry used to be the ONLY control here,
                         and the boot gate releases on engine:ready / engine:gate-release,
                         neither of which an error fires. On a FIRST install that is right
                         — there is no app to reach yet. On a REPAIR it is a locked door:
                         the engine is already installed, and a user whose network blocks
                         one of our two download hosts gets the identical failure on every
                         Retry, forever, with no way to reach even Settings. Shown in
                         repairing mode only; _setError does the reveal. -->
                    <div class="mpi-engine-install__hatch" data-ref="repairEscape" style="display: none;">
                        <div data-mount="continueAnyway"></div>
                        <p class="mpi-engine-install__hatch-hint">
                            Some features will be unavailable until these finish installing.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `,

    setup: (el, props, emit) => {
        let _modal = null;
        let _currentMode = null; // 'installing' or 'upgrading'
        let _currentPhase = null; // 'choose' | 'setup' | 'progress' | 'error' — drives the modal width
        let _pathInputInst = null;
        let _browseButtonInst = null;
        let _installButtonInst = null;
        let _retryButtonInst = null;
        const _unsubs = [];

        const progressInfo = qs('[data-ref="progressInfo"]', el);
        const progressTitle = qs('[data-ref="progressTitle"]', el);
        const nowLabel = qs('[data-ref="nowLabel"]', el);
        const meterEl = qs('[data-ref="meter"]', el);
        const pctEl = qs('[data-ref="pct"]', el);
        const clockEl = qs('[data-ref="clock"]', el);
        const quietEl = qs('[data-ref="quiet"]', el);
        const stepEls = qsa('[data-step]', el);
        const upgradeMessage = qs('[data-ref="upgradeMessage"]', el);
        const errorMessage = qs('[data-ref="errorMessage"]', el);
        const repairEscape = qs('[data-ref="repairEscape"]', el);

        /**
         * Swap a `[data-mount]` placeholder for a real mounted MpiButton, carrying the
         * data-ref the wiring further down reads. Replacing the node rather than
         * mounting into it keeps the button itself in the flex/grid flow its CSS
         * targets — a wrapper div would take the layout instead (MPI-588).
         */
        const _mountRef = (ref, btnProps, face = '') => {
            const host = qs(`[data-mount="${ref}"]`, el);
            if (!host) return null;
            const btn = mountButton(btnProps, face);
            btn.dataset.ref = ref;
            host.replaceWith(btn);
            return btn;
        };

        _mountRef('chooseLocal', {
            variant: 'ghost',
            size: 'sm',
            extraClasses: 'mpi-engine-install__choice mpi-engine-install__choice--recommended',
        }, CHOICE_LOCAL_FACE);
        _mountRef('chooseRemote', {
            variant: 'ghost',
            size: 'sm',
            extraClasses: 'mpi-engine-install__choice',
        }, CHOICE_REMOTE_FACE);
        _mountRef('backToChoose', {
            variant: 'ghost',
            size: 'sm',
            extraClasses: 'mpi-engine-install__back',
        }, `${renderIcon('back', 'sm')} Back`);
        _mountRef('continueAnyway', {
            text: 'Continue without them',
            variant: 'ghost',
            size: 'sm',
            extraClasses: 'mpi-engine-install__hatch-action',
        });

        // Mount primitives in Phase 1 (setup)
        const pathInputMount = qs('[data-ref="pathInputMount"]', el);
        const browseButtonMount = qs('[data-ref="browseButtonMount"]', el);
        const installButtonMount = qs('[data-ref="installButtonMount"]', el);
        const retryButtonMount = qs('[data-ref="retryButtonMount"]', el);

        // Progress-phase primitives are mounted once; the phase only toggles them.
        // info:'' opts out of the status-bar tooltip, which would read a stale value.
        const _progressBarInst = MpiProgressBar.mount(qs('[data-ref="progressBar"]', el), {
            min: 0, max: 100, value: 0, interactive: false, variant: 'primary', info: '',
        });
        const _spinnerInst = MpiSpinner.mount(qs('[data-ref="spinner"]', el), { size: 'sm', variant: 'primary' });

        // ── IPC access (Electron) ────────────────────────────────────────────────
        let ipcRenderer = null;
        try {
            if (typeof window.require === 'function') {
                const electron = window.require('electron');
                ipcRenderer = electron.ipcRenderer;
            }
        } catch (e) {
            // Silent fail — expected in Browser Mode
        }

        // ── Mount path input ──────────────────────────────────────────────────────
        // The default models root is server-owned and MUST be absolute (a relative
        // path resolves to different folders in Cubric vs ComfyUI). Mount with the
        // cached value first, then hydrate the authoritative absolute default from
        // GET /comfy/get-path. localStorage is a cache only — the YAML/server wins.
        const savedPath = Storage.getComfyRootPath() || '';

        _pathInputInst = MpiInput.mount(pathInputMount, {
            type: 'text',
            placeholder: 'Default models folder',
            value: savedPath,
            size: 'md'
        });

        // Get reference to the actual input field
        const pathInputField = qs('.mpi-input__field', _pathInputInst.el);

        // Hydrate the absolute default/custom root from the server.
        (async () => {
            try {
                const res = await fetch('/comfy/get-path');
                const data = await res.json();
                if (data?.success && data.path && !(pathInputField.value || '').trim()) {
                    pathInputField.value = data.path;
                }
            } catch (e) {
                clientLogger.error('MpiEngineInstall', 'get-path hydrate failed:', e);
            }
        })();

        // ── Mount browse button ───────────────────────────────────────────────────
        _browseButtonInst = MpiButton.mount(browseButtonMount, {
            // md, not lg — lg stands ~20px taller than the path input beside it and
            // the row stops reading as one control.
            text: 'Browse',
            size: 'md',
            variant: 'secondary'
        });

        _browseButtonInst.el.addEventListener('click', async () => {
            try {
                if (ipcRenderer) {
                    // Use Electron IPC to show cross-platform native folder picker
                    const data = await ipcRenderer.invoke('choose-folder');
                    if (!data.cancelled && data.path) {
                        pathInputField.value = data.path;
                        Storage.setComfyRootPath(data.path);
                    }
                } else {
                    // Fallback for non-Electron environments (development/web)
                    const result = await fetch('/choose-folder', { method: 'POST' });
                    const data = await result.json();
                    if (!data.cancelled && data.path) {
                        pathInputField.value = data.path;
                        Storage.setComfyRootPath(data.path);
                    }
                }
            } catch (err) {
                clientLogger.error('MpiEngineInstall', 'Browse folder failed:', err);
            }
        });

        // ── Mount install button ──────────────────────────────────────────────────
        _installButtonInst = MpiButton.mount(installButtonMount, {
            // Full width comes from __action; md keeps the height in step with the
            // path row above it, so the pink reads as the commit point and not a slab.
            text: 'Install',
            size: 'md',
            variant: 'primary'
        });

        _installButtonInst.el.addEventListener('click', async () => {
            // Empty → server resolves to the absolute default models root.
            const modelPath = (pathInputField.value || '').trim();

            // Save path to localStorage for next session
            Storage.setComfyRootPath(modelPath);

            try {
                // 1. Set models path
                await fetch('/comfy/set-path', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: modelPath })
                });

                // 2. Move to progress phase and start download
                _beginProgress('Preparing download...');
                // Send the chosen models root in the body too. The pre-download
                // set-path YAML is wiped by the fresh-install extract scrub, so the
                // post-extract step 6 reads this value to write the final YAML with
                // the user's choice (empty → server resolves to the default root).
                await fetch('/engine/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ modelsRoot: modelPath })
                });
            } catch (err) {
                _setError(`Failed to start installation: ${err.message}`);
            }
        });

        // ── Docs links (open in default browser via Electron shell) ───────────────
        // qsa, not qs: there are two now — the progress-phase documentation link and
        // the setup-phase RunPod video link (MPI-390). Same handler for both.
        qsa('[data-ref="docsLink"]', el).forEach((docsLink) => {
            docsLink.addEventListener('click', (evt) => {
                evt.preventDefault();
                const url = docsLink.href;
                if (ipcRenderer) {
                    ipcRenderer.invoke('open-external', url).catch(err => {
                        clientLogger.error('MpiEngineInstall', 'open-external failed, falling back to window.open:', err);
                        window.open(url, '_blank', 'noopener,noreferrer');
                    });
                } else {
                    window.open(url, '_blank', 'noopener,noreferrer');
                }
            });
        });

        // ── Choice phase (MPI-519) ────────────────────────────────────────────────
        // "Local + Remote" is only a reveal of the setup phase that already existed;
        // Back returns to the choice. Nothing is committed until Install is pressed,
        // so neither direction needs to undo anything.
        const chooseLocal = qs('[data-ref="chooseLocal"]', el);
        if (chooseLocal) on(chooseLocal, 'click', () => _showPhase('setup'));

        const backToChoose = qs('[data-ref="backToChoose"]', el);
        if (backToChoose) on(backToChoose, 'click', () => _showPhase('choose'));

        // ── "Remote only" (MPI-390's escape hatch, promoted to a card in MPI-519) ──
        // Sets skipLocalEngine, NOT autoConnectOnStart: that one spins a BILLED Pod
        // at every launch, and "don't make me install an engine I'll never use" must
        // not imply "bill me on every app open". `enabled` goes true as well so the
        // RunPod panel is actually visible once they reach Settings — without it the
        // card would just move the trap one layer down. The boot gate is released
        // via engine:install-skipped rather than engine:ready, because the engine is
        // NOT ready and engine:ready consumers must not be told otherwise.
        const skipToRunpod = qs('[data-ref="chooseRemote"]', el);
        if (skipToRunpod) {
            skipToRunpod.addEventListener('click', () => {
                // Through state, NOT Storage.setRunpodConfig: state.runpodConfig is
                // seeded once at module load (state.js:164) and write-throughs to
                // Storage (state.js:245). A raw Storage write would leave state stale,
                // so Settings would render this toggle OFF and the next state write
                // would clobber it. Top-level key replaced, never mutated in place.
                state.runpodConfig = { ...(state.runpodConfig || {}), enabled: true, skipLocalEngine: true };
                clientLogger.info('MpiEngineInstall', 'Local engine install skipped via the RunPod escape hatch (MPI-390)');
                Events.emit('engine:install-skipped');
            });
        }

        // ── Repair escape (MPI-427) ───────────────────────────────────────────────
        // Deliberately NOT engine:install-skipped: that event means "I will use RunPod
        // instead", and the RunPod settings switch follows it back ON. This one means
        // only "let me into the app" — the local engine stays exactly as configured.
        const continueAnyway = qs('[data-ref="continueAnyway"]', el);
        if (continueAnyway) {
            on(continueAnyway, 'click', () => {
                clientLogger.warn('MpiEngineInstall', 'Dependency repair failed — user continued into the app without the outstanding deps (MPI-427)');
                Events.emit('engine:gate-release');
            });
        }

        // ── Mount retry button ────────────────────────────────────────────────────
        _retryButtonInst = MpiButton.mount(retryButtonMount, {
            text: 'Retry',
            size: 'md',
            variant: 'primary'
        });

        _retryButtonInst.el.addEventListener('click', async () => {
            try {
                _beginProgress('Retrying installation...');
                // Route by failure phase: only a COMPLETE engine can be repaired
                // deps-only via /engine/repair-deps (pip); anything less needs the
                // full re-provision at /engine/download.
                //
                // The completeness test is the version stamp, NOT /engine/status.
                // /engine/status answers "does the venv python exist", and on the
                // uv path (Linux/macOS) that is true from step 1 — long before
                // ComfyUI is cloned or its own requirements are installed. So a
                // first install that died partway (multi-GB, users do quit and come
                // back) sent Retry to deps-only, which installed custom nodes,
                // reported SUCCESS, and left an engine that dies on
                // ModuleNotFoundError: sqlalchemy with no in-app escape. Windows
                // never showed it because its archive lands python and ComfyUI
                // together. The stamp is written only after a successful
                // `comfy install`, and version-check self-heals a stamp whose
                // python has gone, so `installed !== null` is the real question.
                // (MPI-414, measured on Linux 2026-07-31.)
                let engineInstalled = false;
                try {
                    const versionRes = await fetch('/engine/version-check');
                    const version = await versionRes.json();
                    engineInstalled = version && version.installed !== null;
                } catch {
                    engineInstalled = false;
                }
                const route = engineInstalled ? '/engine/repair-deps' : '/engine/download';
                await fetch(route, { method: 'POST' });
            } catch (err) {
                _showPhase('setup');
                _endProgress();
            }
        });

        // NOTE: The engine install intentionally has NO pause/resume UI. The engine
        // archive and the UW model deps download in parallel, and only the engine
        // archive was ever pausable — once it finished the control became a dead
        // button mid-download. Pause/resume lives with model downloads only (MPI-54).

        // ── Phase management ──────────────────────────────────────────────────────
        // The choice phase holds two side-by-side cards and needs a wider box than the
        // single-column phases. MpiModal reads props.width once, at portal time, so a
        // phase change mid-show cannot go through it — the cap is set on the modal
        // element instead (the wrapper stays at the widest value and is transparent,
        // so the narrow phases just centre inside it).
        const _PHASE_WIDTH = { choose: '760px' };
        const _DEFAULT_WIDTH = '520px';

        function _showPhase(phaseName) {
            _currentPhase = phaseName;
            qsa('[data-phase]', el).forEach(phase => {
                phase.style.display = phase.dataset.phase === phaseName ? 'block' : 'none';
            });
            if (_modal) _modal.el.style.maxWidth = _PHASE_WIDTH[phaseName] || _DEFAULT_WIDTH;
        }

        // ── Modal Management ──────────────────────────────────────────────────────
        el.show = (mode) => {
            _currentMode = mode;

            // Show appropriate phase based on mode
            if (mode === 'upgrading') {
                _showPhase('progress');
                progressTitle.textContent = 'Updating ComfyUI Engine';
                upgradeMessage.style.display = 'block';
            } else if (mode === 'repairing') {
                _showPhase('progress');
                progressTitle.textContent = 'Installing Dependencies';
                upgradeMessage.style.display = 'none';
            } else {
                // First install opens on the choice, not on the path picker (MPI-519).
                _showPhase('choose');
                progressTitle.textContent = 'Installing ComfyUI Engine';
                upgradeMessage.style.display = 'none';
            }

            if (!_modal) {
                _modal = MpiModal.mount(document.createElement('div'), {
                    // Widest phase wins here; _showPhase caps the rest. The wrapper
                    // paints nothing, so a narrower phase reads as a centred box.
                    width: 'min(760px, 94vw)',
                    backdropClose: false
                });
                _modal.el.style.margin = '0 auto';
                _modal.el.style.transition = 'max-width var(--t-base) var(--ease)';
                _modal.el.style.maxWidth = _PHASE_WIDTH[_currentPhase] || _DEFAULT_WIDTH;
                _modal.el.appendChild(el);
            }
            _modal.el.show();

            if (mode === 'upgrading') {
                _beginProgress('Installing new version...');
                fetch('/engine/upgrade', { method: 'POST' }).catch(err => {
                    _setError(`Upgrade failed: ${err.message}`);
                });
            } else if (mode === 'repairing') {
                _beginProgress('Setting up...');
                fetch('/engine/repair-deps', { method: 'POST' }).catch(err => {
                    _setError(`Repair failed: ${err.message}`);
                });
            }
        };

        el.hide = () => {
            _endProgress();
            if (_modal) {
                _modal.el.hide();
            }
        };

        // ── Progress state (MPI-792) ─────────────────────────────────────────────
        // Two streams feed this phase and on Windows they run in PARALLEL: the engine
        // phases (archive download → unpack → nodes → finish) and the UW dep bytes.
        // Both used to write the same label and bar directly, which is how MPI-410's
        // strobe happened. Now handlers only record facts on `_run`, and `_paint`
        // derives the whole screen from them — so no event can steal another's line.
        let _run = null;
        let _ticker = null;

        const _newRun = (label) => ({
            step: -1,                 // index into STEPS; only ever moves forward
            label,                    // what is happening now
            detail: '',               // file / output line, shown while there is no bar
            engineBytes: 0, engineTotal: 0, engineDone: false,
            uwBytes: 0, uwTotal: 0, uwLive: false,
            unpacking: false,         // the archive is extracting: it owns the screen
            unpack: null,             // its percent, once the server has sent one
            finished: false,
            samples: [],              // [ms, combined bytes] over the last 10s → speed + ETA
        });

        const _toStep = (name) => { _run.step = Math.max(_run.step, STEPS.indexOf(name)); };

        function _sampleBytes() {
            const now = Date.now();
            _run.samples.push([now, _run.engineBytes + _run.uwBytes]);
            while (_run.samples.length > 2 && now - _run.samples[0][0] > 10000) _run.samples.shift();
        }

        // Speed + ETA, or nothing when there is no honest rate: too few samples, or
        // no new bytes for 5s (a stalled download must not keep showing its last speed).
        function _rateParts(done, total) {
            const s = _run.samples;
            if (s.length < 2) return [];
            const [t0, b0] = s[0];
            const [t1, b1] = s[s.length - 1];
            if (t1 - t0 < 2000 || b1 <= b0 || Date.now() - t1 > 5000) return [];
            const perSec = (b1 - b0) / ((t1 - t0) / 1000);
            return [`${formatBytes(perSec)}/s`, _eta((total - done) / perSec)];
        }

        function _paint() {
            if (!_run) return;
            const r = _run;
            stepEls.forEach((li, i) => {
                li.classList.toggle('mpi-engine-install__step--done', r.finished || i < r.step);
                li.classList.toggle('mpi-engine-install__step--active', !r.finished && i === r.step);
            });

            // The bar shows only while a number is honest; a spinner otherwise. While
            // the archive unpacks, the parallel UW bytes stay off screen: a byte
            // percent next to "Unpacking the engine" would read as the unpack's.
            const bytesLive = (r.engineTotal > 0 && !r.engineDone) || r.uwLive;
            const meter = r.finished ? 'done'
                : r.unpacking ? (r.unpack !== null ? 'unpack' : 'busy')
                : bytesLive ? 'bytes'
                : 'busy';
            for (const m of ['busy', 'unpack', 'done']) {
                meterEl.classList.toggle(`mpi-engine-install__progress-section--${m}`, meter === m);
            }

            nowLabel.textContent = r.label;
            let pct = null;
            if (meter === 'bytes') {
                // Once the archive is in, count only what is still arriving: a 2 GB
                // engine in the ratio would pin "remaining components" near 99%.
                const engineShare = r.engineDone ? 0 : 1;
                const done = r.engineBytes * engineShare + r.uwBytes;
                const total = r.engineTotal * engineShare + r.uwTotal;
                pct = total > 0 ? Math.floor((done / total) * 100) : 0;
                progressInfo.textContent = [`${formatBytes(done)} / ${formatBytes(total)}`, ..._rateParts(done, total)].join(' · ');
            } else if (meter === 'unpack') {
                pct = r.unpack;
                progressInfo.textContent = r.detail;
            } else if (meter === 'done') {
                pct = 100;
                progressInfo.textContent = '';
            } else {
                progressInfo.textContent = r.detail;
            }
            if (pct !== null) _progressBarInst.el.setValueQuiet(pct);
            pctEl.textContent = pct === null ? '' : `${pct}%`;
        }

        const _changed = () => { _ticker?.touch(); _paint(); };

        function _beginProgress(label) {
            _showPhase('progress');
            _endProgress();
            _run = _newRun(label);
            _progressBarInst.el.setValueQuiet(0);
            _ticker = startElapsedTicker((elapsed, hint) => {
                clockEl.textContent = `${elapsed} elapsed`;
                quietEl.textContent = hint || '';
                _paint(); // once a second, so a stalled download drops its speed + ETA
            }, { hints: QUIET_HINTS });
            _subscribeEngineEvents();
            // Connect SSE BEFORE the caller's POST so no engine:* broadcast is missed.
            downloadService._ensureSSE();
        }

        function _endProgress() {
            _unsubscribeEngineEvents();
            _ticker?.stop();
            _ticker = null;
            quietEl.textContent = '';
        }

        function _setError(message) {
            _endProgress();
            _showPhase('error');
            errorMessage.textContent = message;
            // MPI-427: only a repair can be escaped — it implies an engine that is
            // already installed. A failed FIRST install has nothing to fall through to.
            // '' not 'block' — .mpi-engine-install__hatch is a flex column.
            repairEscape.style.display = _currentMode === 'repairing' ? '' : 'none';
        }

        el.setError = _setError;

        el.destroy = () => {
            _endProgress();
            _progressBarInst.destroy();
            _spinnerInst.destroy();
            if (_pathInputInst) _pathInputInst.destroy();
            if (_browseButtonInst) _browseButtonInst.destroy();
            if (_installButtonInst) _installButtonInst.destroy();
            if (_retryButtonInst) _retryButtonInst.destroy();
            if (_modal) _modal.el.hide();
            el.hide();
        };

        // ── Event Subscriptions ──────────────────────────────────────────────────
        // Handlers record facts on `_run` and call `_changed()`; `_paint` decides the
        // screen. See the Progress state note above.
        function _subscribeEngineEvents() {
            if (_unsubs.length) return;

            _unsubs.push(Events.on('engine:downloading', (data = {}) => {
                _toStep('download');
                if (data.totalBytes > 0) {
                    _run.engineBytes = data.downloadedBytes || 0;
                    _run.engineTotal = data.totalBytes;
                    _run.label = 'Downloading the ComfyUI engine';
                    _sampleBytes();
                } else if (data.status) {
                    _run.label = data.status; // uv bootstrap: no archive, only a label
                }
                _changed();
            }));

            // One event for three things: Windows archive unpack (status 'extracting'),
            // every uv/pip/git output line (status = stage id, file = the line), and
            // the human ensureGit steps (status = copy, no file).
            _unsubs.push(Events.on('engine:extracting', (data = {}) => {
                _toStep('install');
                _run.engineDone = true;
                _run.label = STAGE_LABELS[data.status] || data.status || _run.label;
                _run.unpacking = data.status === 'extracting';
                if (_run.unpacking) {
                    _run.detail = (data.file || '').split(/[\\/]/).pop();
                    if (Number.isFinite(data.percent)) _run.unpack = data.percent;
                } else {
                    _run.detail = data.file || '';
                }
                _changed();
            }));

            _unsubs.push(Events.on('engine:uw-installing', (data = {}) => {
                _run.unpacking = false;
                // The node step comes after every byte has landed.
                if (data.phase === 'nodes') {
                    _toStep('install');
                    _run.uwLive = false;
                }
                if (data.status) _run.label = data.status;
                _run.detail = '';
                _changed();
            }));

            _unsubs.push(Events.on('engine:upgrade-status', (data = {}) => {
                _toStep('install');
                if (data.status) _run.label = data.status;
                _run.detail = '';
                _changed();
            }));

            _unsubs.push(Events.on('download:progress', (data = {}) => {
                if (data.modelId !== UW_JOB) return;
                _toStep('download');
                // MPI-231: a node tick has no honest byte total — indeterminate, not 0/0.
                _run.uwLive = data.totalBytes > 0 && !data.indeterminate;
                if (_run.uwLive) {
                    _run.uwBytes = data.downloadedBytes || 0;
                    _run.uwTotal = data.totalBytes;
                    _sampleBytes();
                } else if (!_run.unpacking && !(_run.engineTotal > 0 && !_run.engineDone)) {
                    _run.detail = 'Preparing components...';
                }
                _changed();
            }));

            _unsubs.push(Events.on('download:complete', (data = {}) => {
                if (data.modelId !== UW_JOB) return;
                _run.uwLive = false;
                _changed();
            }));

            _unsubs.push(Events.on('engine:patching', (data = {}) => {
                _toStep('finish');
                Object.assign(_run, { engineDone: true, uwLive: false, unpacking: false, detail: '' });
                _run.label = STAGE_LABELS[data.status] || data.status || STAGE_LABELS.patching;
                _changed();
            }));

            _unsubs.push(Events.on('engine:complete', () => {
                _endProgress();
                _run.finished = true;
                _run.label = 'Complete!';
                _paint();
                setTimeout(() => {
                    Events.emit('engine:ready');
                }, 500);
            }));

            _unsubs.push(Events.on('engine:error', (data = {}) => {
                _setError(data.error);
            }));
        }

        function _unsubscribeEngineEvents() {
            _unsubs.forEach(fn => fn());
            _unsubs.length = 0;
        }
    }
});
