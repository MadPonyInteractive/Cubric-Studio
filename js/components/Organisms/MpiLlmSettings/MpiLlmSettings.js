import { ComponentFactory } from '../../factory.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiCheckbox } from '../../Primitives/MpiCheckbox/MpiCheckbox.js';
import { MpiDropdown } from '../../Primitives/MpiDropdown/MpiDropdown.js';
import { MpiSpinner } from '../../Primitives/MpiSpinner/MpiSpinner.js';
import { MpiProgressBar } from '../../Primitives/MpiProgressBar/MpiProgressBar.js';
import { MpiOllamaSetup } from '../../Compounds/LandingPages/MpiOllamaSetup/MpiOllamaSetup.js';
import { secretsClient } from '../../../core/secretsClient.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { hasNoEngine } from '../../../services/engineGate.js';
import {
    backendPreference,
    setBackendPreference,
    enhancerModelPreference,
    setEnhancerModelPreference,
    endpointModelPreference,
    setEndpointModelPreference,
    describeBackendPreference,
    setDescribeBackendPreference,
    describeModelPreference,
    setDescribeModelPreference,
    enhancerModels,
} from '../../../services/llmService.js';
import { qs } from '../../../utils/dom.js';
import { openExternal } from '../../../utils/openExternal.js';
import { Storage } from '../../../core/storage.js';
import { Events } from '../../../events.js';

/**
 * MpiLlmSettings — the Language Models section of the Remote panel.
 *
 * THE SECTION IS ABOUT THE LANGUAGE MODEL, NOT ABOUT ONE BUTTON (Fabio,
 * 2026-09-12). An earlier draft was written entirely around prompt enhancement
 * and read as if that were the only job. It is not: an LLM writes image
 * descriptions here too, and drives the agent. So the section is per-JOB — one
 * row each — and the copy talks about the models rather than about Enhance.
 *
 * THE CHOICE IS WHERE THE WORK RUNS, NOT WHICH ANSWER IS BETTER. His two cases
 * are the spec: generating on a RunPod pod, enhance locally because the card is
 * idle; generating locally, push it to Remote so it costs no VRAM. Every entry
 * is labelled with what it COSTS, and the model choice sits UNDER the backend.
 *
 * ONE REMOTE CONNECTION FOR EVERY JOB (MPI-774 + MPI-737, Fabio 2026-09-16): the
 * provider + key at the top; "Remote" in any row means that connection, never a
 * vendor name. The connection's model list is fetched ONCE per render
 * (`_refreshModels`) and every row's model dropdown reads it, recommended first.
 *   - **Enhancement** — ComfyUI / Ollama / Remote.
 *   - **Image descriptions** — ComfyUI / Remote (a vision model on the endpoint).
 *   - **Agent** — Remote only.
 * The DeepInfra-only Account block is gone; the deepinfra preset reads the key
 * saved there, so nobody re-enters it. Its sign-up box stays, at the top of the
 * connection, because DeepInfra is the provider we recommend (Fabio 2026-09-16).
 *
 * WHAT IS DELIBERATELY NOT HERE: any notion of an "uncensored model" (MPI-728 —
 * a LoRA the user downloads makes any model uncensored, so it was never a fact
 * about the model card), and any implication that an abliterated build is the
 * stronger instrument (it is the enhancer OF RECORD and it dropped the user's own
 * subject 6 runs in 10 where both shipped models dropped none).
 */

/**
 * `mpi-dropdown--stacked` puts each option's meta on its OWN line with no
 * ellipsis cap. Without it the cost labels — the entire reason these entries read
 * as a placement choice — truncate in the panel's width, which is the MPI-620
 * defect MpiDropdown's own comment warns about.
 */
const STACKED = 'mpi-dropdown--stacked';

/**
 * THREE ENTRIES AND NO "AUTOMATIC" (Fabio, 2026-09-12): the RunPod section has no
 * automatic entry, so neither does this, and with nothing picked it is ComfyUI
 * (`backendPreference()`). An entry that cannot run yet stays LISTED but greyed
 * rather than vanishing — Remote until the connection has a key, ComfyUI while there is
 * no engine at all (no local install, no Pod: MPI-1046) — because the list is also how a
 * user learns what exists. ComfyUI has no install gate beyond the engine: its encoder
 * installs WITH it (MPI-1045).
 * `endpoint` is the code value for Remote: 'remote' already means the RunPod lane.
 */
const REMOTE    = { value: 'endpoint', label: 'Remote',          meta: 'No VRAM, runs on the connection above' };
const COMFY     = { value: 'comfy',    label: 'ComfyUI (local)', meta: 'Reuses the engine already running' };
const BACKENDS  = [
    REMOTE,
    { value: 'ollama', label: 'Ollama (local)', meta: 'A second runtime, its own VRAM' },
    COMFY,
];
const DESCRIBERS = [REMOTE, COMFY];

/** Where each Remote row's Download row mounts (MPI-993, `_renderInstall`). */
const INSTALL_SLOTS = {
    enhance: '#mpiSettingsLlmEnhanceInstallSlot',
    describe: '#mpiSettingsLlmDescribeInstallSlot',
    agent: '#mpiSettingsAgentInstallSlot',
};

/**
 * The agent's local floor (MPI-905). Mirrors `OLLAMA_AGENT_CONTEXT` in
 * services/llmEngines.mjs — not imported, because renderer code cannot import a
 * services/*.mjs Node module. A probed model under this window compacts (forgets
 * early turns) sooner than the agent's own local machine ever would.
 */
const AGENT_CONTEXT_FLOOR = 65_536;

export const MpiLlmSettings = ComponentFactory.create({
    name: 'MpiLlmSettings',
    css: ['js/components/Organisms/MpiLlmSettings/MpiLlmSettings.css'],

    template: () => `
                <div class="mpi-settings__section mpi-llm-settings">
                    <h3 class="mpi-settings__section-title">Language Models</h3>
                    <span class="mpi-settings__hint">Cubric uses a language model for the writing jobs around a generation — rewriting a short idea into a full prompt, describing an image you hand it, and the agent. Each job below chooses which machine runs it. You always see the result before it is used.</span>

                    <!-- MPI-774: every control below is mounted from an async read (the
                         profiles, the stored key, the connection's model list). Until that
                         lands the section is labels with nothing under them, which reads as
                         broken — so it shows this instead. -->
                    <div class="mpi-llm-settings__loading" id="mpiSettingsLlmLoading">
                        <div id="mpiSettingsLlmLoadingSpinner"></div>
                        <span class="mpi-settings__hint">Checking the connection…</span>
                    </div>

                    <div class="mpi-settings__subgroup">
                        <span class="mpi-settings__subgroup-title">Remote connection</span>
                        <div class="mpi-settings__signup">
                            <div class="mpi-settings__signup-copy">
                                <span class="mpi-settings__signup-kicker">New to DeepInfra?</span>
                                <span class="mpi-settings__signup-text">It is the provider we recommend and test on. Create an account, make an API key in your DeepInfra dashboard, then pick DeepInfra as the provider below and paste the key. What you run is billed to your DeepInfra account.</span>
                            </div>
                            <a class="mpi-settings__signup-link" href="https://deepinfra.com/dash" target="_blank" rel="noopener noreferrer">Open DeepInfra dashboard</a>
                        </div>
                        <span class="mpi-settings__hint">One connection for every job that runs on Remote. Pick the provider, add its API key, then test it. The key is stored by the desktop app and is never readable back.</span>
                        <div class="mpi-settings__form-group">
                            <label class="mpi-settings__field-label">Provider</label>
                            <div id="mpiSettingsConnProfileSlot"></div>
                            <span class="mpi-settings__hint" id="mpiSettingsConnProfileNote"></span>
                        </div>
                        <div class="mpi-settings__form-group" id="mpiSettingsConnUrlGroup">
                            <label class="mpi-settings__field-label">Base URL</label>
                            <div class="mpi-settings__folder-row">
                                <div id="mpiSettingsConnUrlSlot" class="mpi-settings__folder-input"></div>
                                <div id="mpiSettingsConnUrlSaveSlot"></div>
                            </div>
                        </div>
                        <div class="mpi-settings__form-group" id="mpiSettingsConnKeyGroup">
                            <label class="mpi-settings__field-label">API key</label>
                            <div class="mpi-settings__folder-row">
                                <div id="mpiSettingsConnKeySlot" class="mpi-settings__folder-input"></div>
                                <div id="mpiSettingsConnKeySaveSlot"></div>
                                <div id="mpiSettingsConnKeyClearSlot"></div>
                            </div>
                            <span class="mpi-settings__hint" id="mpiSettingsConnKeyStatus"></span>
                        </div>
                        <div class="mpi-settings__form-group">
                            <div id="mpiSettingsConnProbeSlot"></div>
                            <span class="mpi-settings__hint" id="mpiSettingsConnProbeResult"></span>
                        </div>
                        <div class="mpi-settings__form-group" id="mpiSettingsConnSpendGroup">
                            <label class="mpi-settings__field-label">Spend this month</label>
                            <div id="mpiSettingsConnSpendSlot"></div>
                            <span class="mpi-settings__hint" id="mpiSettingsConnSpendResult"></span>
                        </div>
                    </div>

                    <div class="mpi-settings__subgroup">
                        <span class="mpi-settings__subgroup-title">Where each job runs</span>
                        <span class="mpi-settings__hint">This is about which machine does the work, not which answer is better. Generating on a RunPod pod? Run these locally — your own card is idle. Generating locally? Run them on Remote and keep the VRAM for the picture.</span>

                        <div class="mpi-settings__form-group">
                            <label class="mpi-settings__field-label">Prompt enhancement</label>
                            <div id="mpiSettingsLlmEnhanceBackendSlot"></div>
                            <span class="mpi-settings__hint" id="mpiSettingsLlmEnhanceBackendNote"></span>
                        </div>

                        <div class="mpi-settings__form-group" id="mpiSettingsLlmEnhanceModelGroup">
                            <label class="mpi-settings__field-label">Enhancement model</label>
                            <div id="mpiSettingsLlmEnhanceModelSlot"></div>
                        </div>
                        <span class="mpi-settings__hint" id="mpiSettingsLlmEnhanceModelNote"></span>
                        <div id="mpiSettingsLlmEnhanceInstallSlot"></div>
                        <div id="mpiSettingsLlmOllamaSlot"></div>

                        <div class="mpi-settings__form-group">
                            <label class="mpi-settings__field-label">Image descriptions</label>
                            <div id="mpiSettingsLlmDescribeBackendSlot"></div>
                            <span class="mpi-settings__hint" id="mpiSettingsLlmDescribeNote"></span>
                        </div>

                        <div class="mpi-settings__form-group" id="mpiSettingsLlmDescribeModelGroup">
                            <label class="mpi-settings__field-label">Description model</label>
                            <div id="mpiSettingsLlmDescribeModelSlot"></div>
                        </div>
                        <span class="mpi-settings__hint" id="mpiSettingsLlmDescribeModelNote"></span>
                        <div id="mpiSettingsLlmDescribeInstallSlot"></div>

                        <div class="mpi-settings__form-group">
                            <label class="mpi-settings__field-label">Agent</label>
                            <div id="mpiSettingsAgentBackend" class="mpi-settings__fixed-value"></div>
                        </div>
                        <div class="mpi-settings__form-group">
                            <label class="mpi-settings__field-label">Agent model</label>
                            <div id="mpiSettingsAgentModelSlot"></div>
                            <span class="mpi-settings__hint" id="mpiSettingsAgentModelNote"></span>
                            <div id="mpiSettingsAgentInstallSlot"></div>
                        </div>
                        <div class="mpi-settings__form-group">
                            <label class="mpi-settings__field-label">Agent mode</label>
                            <div id="mpiSettingsAgentModeSlot"></div>
                            <span class="mpi-settings__hint">Auto: the agent picks settings for a generation without asking. Ask first: it asks about every setting before generating. Installs always ask in both modes.</span>
                        </div>
                        <div class="mpi-settings__form-group">
                            <div id="mpiSettingsAgentProbeSlot"></div>
                            <span class="mpi-settings__hint" id="mpiSettingsAgentProbeResult"></span>
                        </div>
                        <div class="mpi-settings__form-group">
                            <div class="mpi-llm-settings__bench">
                                <div id="mpiSettingsAgentBenchSlot"></div>
                                <div id="mpiSettingsAgentBenchSlot2"></div>
                            </div>
                            <div class="mpi-llm-settings__bench-bar" id="mpiSettingsAgentBenchBar"></div>
                            <span class="mpi-settings__hint" id="mpiSettingsAgentBenchLine"></span>
                            <div id="mpiSettingsAgentBenchShareSlot" hidden></div>
                            <span class="mpi-settings__hint" id="mpiSettingsAgentBenchShareHint" hidden>Sends the model, its scores, cost and your GPU. Never prompts or keys. Shown at bench.cubric.studio.</span>
                            <span class="mpi-settings__hint" id="mpiSettingsAgentBenchHint">Runs our agent tests on this model with pretend tools: nothing is generated or added to your projects.</span>
                            <div class="mpi-llm-settings__bench-link" id="mpiSettingsAgentBenchLinkSlot"></div>
                        </div>
                    </div>

                    <div class="mpi-settings__subgroup">
                        <span class="mpi-settings__subgroup-title">Before you choose</span>
                        <span class="mpi-settings__hint">A hosted provider will refuse or quietly sanitise material that a local uncensored build will shape for you. If that matters for what you are making, run these locally — it is the only place an uncensored model exists.</span>
                        <span class="mpi-settings__hint">Uncensored does not mean better: in our tests, uncensored models missed parts of the prompt more often. Pick one only when you need what it will write.</span>
                    </div>
                </div>`,

    setup: (el) => {
        /** MODEL_REGISTRY entries, for the Ollama model list. */
        let _models = [];
        // Re-rendered on their own, so each is destroyed before it is replaced: a
        // control cleared with innerHTML alone keeps its listeners alive.
        let _backendInst = null;
        let _modelInst = null;
        let _ollamaInst = null;
        let _describeInst = null;
        let _describeModelInst = null;
        /** The last `/llm/ollama` reply, for each Ollama model's Downloaded meta. */
        let _ollama = null;
        // The shared connection: the provider pick, the controls that depend on it
        // (rebuilt on every pick), and the async agent model list.
        let _connProfileInst = null;
        const _connInsts = [];
        let _agentModelInst = null;
        /** Each Remote row's Download row (`_renderInstall`), by job. */
        const _installInsts = {};
        /** The spinner shown while the section reads its state (MPI-774). */
        let _loadingSpinner = null;
        let _detailsSeq = 0;
        let _modelsSeq = 0;
        /** The picked connection profile `{ id, name, baseURL }`, or null. */
        let _profile = null;
        /**
         * The `/llm/connection/models` reply every Remote row reads:
         * undefined = still loading, null = the app server did not answer.
         */
        let _remote;
        /** No local engine and no Pod (engineGate, MPI-1046): a ComfyUI pick runs on Remote. */
        let _noEngine = false;
        /**
         * "Benchmark this model" (MPI-941 Phase 12): its step ('idle' | 'confirm' | 'running'), the
         * server's `GET /agent/benchmark` reply (cases, suite hash, estimate, a run in progress) and the
         * running totals, then `ran`, the ended run's totals its steps stay drawn from. The run lives in the
         * server and reports on the agent stream, so a panel opened mid-run picks it up from `info.running`
         * and the next `bench:case`.
         */
        let _bench = { step: 'idle', info: null, progress: null, stopping: false, ran: null };
        const _benchInsts = [];
        const _benchUnsubs = [
            Events.on('bench:case', (d) => { _bench = { ..._bench, step: 'running', progress: d }; _renderBench(el); }),
            Events.on('bench:done', (d) => {
                // `shareError` is set only when the user ticked Share (MPI-965): a run nobody asked to share says nothing of it.
                const shared = d.shared ? ' · shared' : d.shareError ? ` · not shared: ${d.shareError}` : '';
                // An errored run is not kept (agentService): the connection failed, so its fails were never the model's.
                if (d.errored) return _benchEnd(`The connection failed during the run · not kept${d.shareError ? ' · not shared' : ''}`, true);
                _benchEnd(d.stopped
                    ? `Stopped at ${d.done} of ${d.cases} · ${d.passed} passed · not kept${shared}`
                    : `${d.passed}/${d.cases} passed${d.costUsd ? ` · $${d.costUsd.toFixed(2)}` : ''} · now shown in the agent list${shared}`);
            }),
            Events.on('bench:error', (d) => _benchEnd(`The benchmark could not start: ${d.message}`, true)),
        ];

        // The ONE init: MpiSlideOver calls onOpen right after mount (via MpiRemote). Also
        // calling `_init` here ran two passes per open, and when their `/llm/models`
        // replies crossed, the late pass rebuilt every row under an open dropdown (MPI-789).
        el.onOpen = () => { _init(el); };

        /** Every control is re-read from scratch on each open — no cached view state. */
        async function _init(root) {
            _destroyControls();
            _remote = undefined;
            _setLoading(root, true);
            try {
                _noEngine = await hasNoEngine();
                _models = await enhancerModels();
                await _initConnection(root);
            } finally {
                _setLoading(root, false);
            }
        }

        /** The section shows a spinner instead of empty labels while it reads (MPI-774). */
        function _setLoading(root, on) {
            root.classList.toggle('mpi-llm-settings--loading', on);
            if (on && !_loadingSpinner) {
                const slot = qs('#mpiSettingsLlmLoadingSpinner', root);
                if (slot) _loadingSpinner = MpiSpinner.mount(slot, { size: 'sm' });
            } else if (!on) {
                _loadingSpinner?.destroy?.();
                _loadingSpinner = null;
            }
        }

        function _destroyControls() {
            [_backendInst, _modelInst, _ollamaInst, _describeInst, _describeModelInst,
                _connProfileInst, _agentModelInst, _loadingSpinner, ..._connInsts, ..._benchInsts,
                ...Object.values(_installInsts)].forEach(i => i?.destroy());
            _connInsts.length = 0;
            _benchInsts.length = 0;
            for (const job of Object.keys(_installInsts)) delete _installInsts[job];
            _backendInst = _modelInst = _ollamaInst = _describeInst = _describeModelInst = null;
            _connProfileInst = _agentModelInst = _loadingSpinner = null;
        }

        /**
         * Can a job run on Remote right now? Only a connection that is not set up
         * greys the entry; an endpoint that is merely unreachable stays pickable
         * and its model list says what went wrong.
         */
        function _remoteBlocked() {
            const code = _remote?.error?.code;
            if (code === 'NO_KEY') return 'Add an API key to the connection above';
            if (code === 'NO_PROFILE') return 'Finish the connection above';
            return '';
        }

        function _comfyOption() {
            return _noEngine ? { ...COMFY, disabled: true, meta: 'Needs the ComfyUI engine' } : COMFY;
        }

        /** Remote's dropdown entry, with what it runs on or why it cannot. */
        function _remoteOption() {
            const blocked = _remoteBlocked();
            if (blocked) return { ...REMOTE, disabled: true, meta: blocked };
            if (_remote === undefined) return { ...REMOTE, meta: 'Checking the connection…' };
            return { ...REMOTE, meta: `No VRAM, runs on ${_profile?.name || 'the connection above'}` };
        }

        // ── Prompt enhancement ──────────────────────────────────────────────
        function _renderBackend(root) {
            const slot = qs('#mpiSettingsLlmEnhanceBackendSlot', root);
            if (!slot) return;
            _backendInst?.destroy();

            const options = BACKENDS.map(b => (b === REMOTE ? _remoteOption() : b === COMFY ? _comfyOption() : b));

            const current = backendPreference();
            _backendInst = MpiDropdown.mount(slot, {
                options,
                value: current,
                extraClasses: STACKED,
            });
            _backendInst.on('change', ({ value }) => {
                setBackendPreference(value);
                _paintBackendNote(root, value);
                _renderModel(root, value);
                _renderOllama(root, value);
            });

            _paintBackendNote(root, current);
            _renderModel(root, current);
            _renderOllama(root, current);
        }

        function _paintBackendNote(root, backend) {
            const NOTES = {
                endpoint: 'Runs on the provider connected above, off your machine entirely, so it costs no VRAM. Your prompt leaves this computer.',
                ollama: 'Runs on your own card in a second runtime, so it holds VRAM alongside a local generation. Cubric starts Ollama when it is needed; installing it or downloading a model waits for your click below.',
                comfy: 'Runs in the ComfyUI engine this app already started, and loads one text encoder of its own. Offered on every model.',
            };
            _setText(root, '#mpiSettingsLlmEnhanceBackendNote', _missing(backend) || NOTES[backend]);
        }

        /**
         * A backend picked while it could run and unavailable since (the key
         * cleared, the engine gone or the Pod disconnected) stays selected. Swapping it
         * would turn the user's pick into a quiet substitution, so the note says what is missing.
         */
        function _missing(backend) {
            if (backend === 'endpoint' && _remoteBlocked()) return 'Remote is not set up: the connection above needs a provider and an API key. Finish it, or pick another backend.';
            // runnableBackend (llmService) already sends the job to Remote; say so rather than show ComfyUI.
            if (backend === 'comfy' && _noEngine) return 'There is no ComfyUI engine, so this runs on Remote. To use ComfyUI, connect a Pod in Settings → RunPod or install the engine.';
            return '';
        }

        // ── The enhancement model, UNDER the chosen backend ──────────────────
        function _renderModel(root, backend) {
            const group = qs('#mpiSettingsLlmEnhanceModelGroup', root);
            const slot = qs('#mpiSettingsLlmEnhanceModelSlot', root);
            const note = qs('#mpiSettingsLlmEnhanceModelNote', root);
            if (!group || !slot) return;
            _modelInst?.destroy();
            _modelInst = null;
            _renderInstall('enhance', null);

            if (backend === 'endpoint') {
                _modelInst = _renderRemoteModel({
                    group, slot, note, job: 'enhance',
                    value: endpointModelPreference(),
                    onPick: setEndpointModelPreference,
                    // The recipe system prompts measure ~450 to ~3,400 tokens (MPI-728).
                    notes: {
                        tested: 'The recommended models are the ones we test enhancement on. A hosted provider bills per token; one enhance uses about 500 to 4,000.',
                        untested: 'We have not tested enhancement on this provider. Pick any chat model. A hosted provider bills per token; one enhance uses about 500 to 4,000.',
                    },
                });
                return;
            }

            // ComfyUI runs one graph with one baked weight, so there is nothing to
            // choose. The LABEL hides with the control: a field label with no field
            // under it is what the first draft shipped.
            const servable = _models.filter(m => m.ollama);
            const reason = backend === 'comfy'
                ? 'ComfyUI runs one enhancer — the weight its graph loads — so there is nothing to pick.'
                : !servable.length
                    ? 'The model list is unavailable — enhancement will use the default.'
                    : '';
            group.hidden = !!reason;
            if (note) { note.textContent = reason; note.hidden = !reason; }
            if (reason) return;

            // NO "Default" ENTRY (Fabio, 2026-09-13): a bare "Default" makes the user ask
            // what it is. The model the app runs with nothing picked is listed and
            // selected by NAME instead, and its registry name already says "(Default)".
            const options = servable.map(m => {
                // Known only once Ollama answers; no meta beats a guessed one.
                const downloaded = _ollama?.models?.[m.id]?.downloaded;
                return {
                    value: m.id,
                    // Same "(recommended)" prefix the Remote rows use (`_remoteModelOptions`).
                    label: `${m.recommended ? '(recommended) ' : ''}${m.names?.ollama || m.name}`,
                    info: m.description,
                    ...(typeof downloaded === 'boolean' && { meta: downloaded ? 'Downloaded' : 'Not downloaded' }),
                };
            });
            // Nothing picked, or a pre-MPI-737 DeepInfra-only pick: show the default
            // model rather than a value this dropdown cannot honour.
            const pinned = enhancerModelPreference();
            const fallback = servable.find(m => m.isDefault) || servable[0];
            const value = servable.some(m => m.id === pinned) ? pinned : fallback.id;

            _modelInst = MpiDropdown.mount(slot, {
                options,
                value,
                extraClasses: STACKED,
            });
            _modelInst.on('change', ({ value: id }) => {
                setEnhancerModelPreference(id || null);
                _ollamaInst?.el?.setModel?.(id);
            });
        }

        // ── The Ollama row, only while Ollama is the backend (MPI-728 phase 3) ──
        // Starting Ollama, installing it and downloading the chosen model all live in
        // MpiOllamaSetup; this only mounts it and keeps the model list's Downloaded
        // metas in step with what it reports.
        function _renderOllama(root, backend) {
            const slot = qs('#mpiSettingsLlmOllamaSlot', root);
            if (!slot) return;
            if (backend !== 'ollama') {
                _ollamaInst?.destroy();
                _ollamaInst = null;
                _ollama = null;
                return;
            }
            if (_ollamaInst) return;

            const pinned = enhancerModelPreference();
            _ollamaInst = MpiOllamaSetup.mount(slot, {
                modelId: _models.some(m => m.ollama && m.id === pinned) ? pinned : '',
            });
            // The row reports once a second during a download. Rebuild the model list
            // only when a model's downloaded state CHANGES, or the dropdown would close
            // under the user's pointer every second.
            _ollamaInst.on('state', (state) => {
                const before = JSON.stringify(_presence(_ollama));
                _ollama = state;
                if (JSON.stringify(_presence(state)) !== before) _renderModel(root, 'ollama');
            });
        }

        function _presence(state) {
            return Object.entries(state?.models || {}).map(([id, m]) => [id, m.downloaded]);
        }

        // ── Image descriptions (MPI-737) ────────────────────────────────────
        // Two placements: ComfyUI rides the generation queue (locally or on the
        // Pod) and is uncensored; Remote costs no VRAM and never waits behind a
        // generation, but a hosted model may refuse an adult image.
        function _renderDescribe(root) {
            const slot = qs('#mpiSettingsLlmDescribeBackendSlot', root);
            if (!slot) return;
            _describeInst?.destroy();

            const current = describeBackendPreference();
            _describeInst = MpiDropdown.mount(slot, {
                options: DESCRIBERS.map(b => (b === REMOTE ? _remoteOption() : _comfyOption())),
                value: current,
                extraClasses: STACKED,
            });
            _describeInst.on('change', ({ value }) => {
                setDescribeBackendPreference(value);
                _paintDescribe(root, value);
            });
            _paintDescribe(root, current);
        }

        function _paintDescribe(root, backend) {
            const NOTES = {
                endpoint: 'Runs on the provider connected above: no local VRAM, and it never waits behind a generation. A hosted model may refuse to describe an adult image; ComfyUI is the uncensored describer.',
                comfy: 'Runs in ComfyUI, on this machine or on your RunPod pod, and waits its turn behind generations in the Cue. The model it runs is uncensored.',
            };
            _setText(root, '#mpiSettingsLlmDescribeNote', _missing(backend) || NOTES[backend]);

            const group = qs('#mpiSettingsLlmDescribeModelGroup', root);
            const slot = qs('#mpiSettingsLlmDescribeModelSlot', root);
            const note = qs('#mpiSettingsLlmDescribeModelNote', root);
            if (!group || !slot) return;
            _describeModelInst?.destroy();
            _describeModelInst = null;
            _renderInstall('describe', null);
            if (backend !== 'endpoint') {
                // The ComfyUI graph loads one baked describer: nothing to pick.
                group.hidden = true;
                if (note) note.hidden = true;
                return;
            }
            // Only models that can see: the endpoint's own `vision` flag where it
            // reports one; a catalogue that reports none is listed whole, with a note.
            const flagged = (_remote?.models || []).some(m => m.vision !== null);
            _describeModelInst = _renderRemoteModel({
                group, slot, note, job: 'describe',
                value: describeModelPreference(),
                onPick: setDescribeModelPreference,
                filter: flagged ? (m => m.vision || m.recommendedFor.includes('describe')) : null,
                notes: {
                    tested: 'The recommended model is the one we test descriptions on. Only models that can see an image are listed.',
                    untested: flagged
                        ? 'We have not tested descriptions on this provider. Only models that can see an image are listed.'
                        : 'This provider does not say which models can see an image. Pick one that can, or describing will fail with the provider\'s error.',
                },
            });
        }

        // ── One Remote model dropdown, for any job ───────────────────────────

        /**
         * Mounts `job`'s model dropdown on the shared connection list: recommended
         * first as "(recommended) <id>", the context window as meta. An empty pick
         * shows the recommended model, which is what the server runs for ''.
         * Returns the instance, or null when there is nothing to mount yet.
         */
        function _renderRemoteModel({ group, slot, note, job, value: saved, onPick, filter = null, notes }) {
            group.hidden = false;
            const say = (text) => { if (note) { note.textContent = text; note.hidden = !text; } };
            if (_remote === undefined) {
                say('Loading the connection\'s models…');
                _renderInstall(job, null);
                return null;
            }
            const { options, value, recommended } = _remoteModelOptions(job, saved, filter);
            const inst = MpiDropdown.mount(slot, {
                options,
                value,
                placeholder: _remote?.ok ? 'Select a model' : 'Connect first',
                disabled: !_remote?.ok,
                extraClasses: STACKED,
            });
            inst.on('change', ({ value: id }) => { onPick(id); _renderInstall(job, id); });
            say(_remote?.ok ? (recommended ? notes.tested : notes.untested) : _errorText(_remote));
            _renderInstall(job, value);
            return inst;
        }

        /**
         * MPI-993: the Download row under `job`'s dropdown while its pick is a model the Ollama
         * connection recommends but has not downloaded (`installed: false`); cleared for any
         * other pick. It is MpiOllamaSetup, the Ollama enhancer's own row, so starting Ollama,
         * the size, the progress and a failed download read the same in both places. The
         * connection's list is re-read once the download lands, which drops the row.
         */
        function _renderInstall(job, id) {
            _installInsts[job]?.destroy();
            _installInsts[job] = null;
            const slot = qs(INSTALL_SLOTS[job], el);
            const m = id && _remote?.ok ? _remote.models.find(x => x.id === id) : null;
            if (!slot || m?.installed !== false) return;
            const inst = MpiOllamaSetup.mount(slot, { modelId: id });
            // Only a download SEEN finishing refreshes: a list and an Ollama that disagree
            // about the same model would otherwise re-read the list forever.
            let missing = false;
            inst.on('state', (state) => {
                const downloaded = state.models?.[id]?.downloaded;
                if (downloaded === false) missing = true;
                else if (downloaded && missing) _refreshModels(el, Storage.getLlmConnection().profileId);
            });
            _installInsts[job] = inst;
        }

        /** `{ options, value, recommended }` for `job` from the connection list. */
        function _remoteModelOptions(job, saved, filter) {
            const models = (_remote?.ok ? _remote.models : []).filter(m => !filter || filter(m));
            const isRec = m => m.recommendedFor.includes(job);
            const rec = models.filter(isRec);
            const value = saved || rec[0]?.id || '';
            if (job === 'agent') {
                // MPI-912 (Fabio 2026-09-26): no "recommended" on the agent row. Every model
                // that ran the agent suite goes on top with its score and measured cost, best
                // score first, and the user chooses. The pick stays the default value.
                // MPI-941 Phase 12 (Fabio 2026-09-28): the user's own benchmark REPLACES our score, one number
                // per model; ours stays only while it is on the current tests and theirs is not.
                // MPI-965: a THIRD tier, the community's (>= 3 shared runs, the median, always on the current
                // tests): your run > ours (current tests) > community. Any score on older tests counts only when
                // no current one exists, yours before ours as before.
                const mine = Storage.getAgentBench(Storage.getLlmConnection().profileId);
                const scoreOf = m => {
                    if (_currentTests(mine[m.id])) return mine[m.id];
                    if (_currentTests(m.agentTest)) return m.agentTest;
                    return m.communityTest || mine[m.id] || m.agentTest;
                };
                // A model only the community has scored joins the scored group like any other.
                const tested = models.filter(scoreOf)
                    // Scores on the current tests first, then best score, then the most runs.
                    .sort((a, b) => {
                        const x = scoreOf(a), y = scoreOf(b);
                        return _currentTests(y) - _currentTests(x) || y.passed / y.cases - x.passed / x.cases || y.runs - x.runs;
                    });
                const options = [
                    // In the meta, under the name: the stacked list lifts its 11ch cap (MpiLlmSettings.css).
                    ...tested.map(m => ({ value: m.id, label: m.id, meta: _modelMeta(m, _agentTestLabel(scoreOf(m), scoreOf(m) === m.communityTest)) })),
                    ...models.filter(m => !scoreOf(m)).map(m => ({ value: m.id, label: m.id, meta: _modelMeta(m) })),
                ];
                if (value && _remote?.ok && !options.some(o => o.value === value)) options.unshift({ value, label: value, meta: 'Not listed' });
                return { options, value, recommended: tested.length > 0 };
            }
            const options = [
                // `recommendedNote` says why THIS one, when more than one is recommended
                // for the job — e.g. the model that did not refuse adult work in our tests
                // (`RECOMMENDED_REMOTE_MODELS`). Absent on every row that has nothing to add.
                ...rec.map(m => ({
                    value: m.id,
                    label: `(recommended${m.recommendedNote ? ` - ${m.recommendedNote}` : ''}) ${m.id}`,
                    meta: _modelMeta(m),
                })),
                ...models.filter(m => !isRec(m)).map(m => ({ value: m.id, label: m.id, meta: _modelMeta(m) })),
            ];
            // A pick the endpoint no longer lists stays visible rather than silently changing.
            if (value && _remote?.ok && !options.some(o => o.value === value)) options.unshift({ value, label: value, meta: 'Not listed' });
            return { options, value, recommended: rec.length > 0 };
        }

        // ── Remote connection (MPI-774) — ONE for every job that runs on Remote ──
        // The provider, its base URL (Custom only), its write-only key, and a test
        // that spends no tokens. The pick is `Storage.getLlmConnection()`; the key
        // lives in the main process. Every job row reads the connection's models
        // from `GET /llm/connection/models`, recommended first.

        const PROFILE_NOTES = {
            deepinfra:  'Recommended. Runs off your machine, so it costs no VRAM.',
            openrouter: 'A gateway to many providers\' models. Needs an OpenRouter API key.',
            openai:     'OpenAI\'s own endpoint. Needs an OpenAI API key.',
            ollama:     'Your local Ollama runtime, through its /v1 endpoint. Local agents score well below the hosted ones, and each needs its own VRAM beside any running generation.',
            custom:     'Any OpenAI-compatible endpoint. Enter its base URL below.',
        };

        const AGENT_MODE_OPTIONS = [
            { value: 'auto', label: 'Auto',       meta: 'Picks settings and generates without asking' },
            { value: 'ask',  label: 'Ask first',  meta: 'Asks about every setting before generating'  },
        ];

        /** Track a control that belongs to the current provider; see _renderConnDetails. */
        function _conn(inst) { _connInsts.push(inst); return inst; }

        async function _initConnection(root) {
            const profiles = await secretsClient.listEndpointProfiles();
            const { profileId } = Storage.getLlmConnection();
            _renderConnProfile(root, profiles, profileId);
            await _renderConnDetails(root, profiles, profileId);
        }

        /** Everything that depends on the provider pick, rebuilt when it changes. */
        async function _renderConnDetails(root, profiles, profileId) {
            // A later pick supersedes this render; its own pass mounts the controls.
            const seq = ++_detailsSeq;
            _connInsts.forEach(i => i.destroy());
            _connInsts.length = 0;
            _profile = profiles.find(p => p.id === profileId) || null;
            _renderConnUrl(root, _profile, profileId);
            await _renderConnKey(root, profileId);
            if (seq !== _detailsSeq) return;
            _renderConnProbe(root, profileId);
            _renderConnSpend(root, profileId);
            _renderAgentBackend(root);
            _renderAgentMode(root);
            _renderAgentProbe(root, profileId);
            await _refreshModels(root, profileId);
        }

        /**
         * Re-reads the connection's models once and repaints every row that shows
         * them — the Remote entries, their model dropdowns and the agent's. Rows
         * paint a loading state first, so a slow endpoint never leaves them blank.
         */
        async function _refreshModels(root, profileId) {
            const seq = ++_modelsSeq;
            _remote = undefined;
            _paintRows(root);
            const [json, bench] = await Promise.all([
                _getJson(`/llm/connection/models?profileId=${encodeURIComponent(profileId)}`),
                _getJson(`/agent/benchmark?profileId=${encodeURIComponent(profileId)}`),
            ]);
            // A newer render (a provider change, a saved key) started while this one waited.
            if (seq !== _modelsSeq) return;
            _remote = json;
            const running = bench?.running || null;
            _bench = { step: running ? 'running' : 'idle', info: bench?.ok ? bench : null, progress: running, stopping: false };
            _paintRows(root);
        }

        function _paintRows(root) {
            _renderBackend(root);
            _renderDescribe(root);
            _renderAgentModel(root);
            _renderBench(root);
        }

        function _renderConnProfile(root, profiles, profileId) {
            const slot = qs('#mpiSettingsConnProfileSlot', root);
            const note = qs('#mpiSettingsConnProfileNote', root);
            if (!slot) return;
            _connProfileInst?.destroy();
            _connProfileInst = MpiDropdown.mount(slot, {
                options: profiles.map(p => ({ value: p.id, label: p.name || p.id })),
                value: profileId,
                placeholder: secretsClient.isAvailable() ? 'Select…' : 'Desktop app only',
                disabled: !secretsClient.isAvailable(),
                extraClasses: STACKED,
            });
            _connProfileInst.on('change', async ({ value }) => {
                Storage.setLlmConnection({ profileId: value });
                if (note) note.textContent = PROFILE_NOTES[value] || '';
                await _renderConnDetails(root, await secretsClient.listEndpointProfiles(), value);
            });
            if (note) note.textContent = PROFILE_NOTES[profileId] || '';
        }

        function _renderConnUrl(root, profile, profileId) {
            const group = qs('#mpiSettingsConnUrlGroup', root);
            const slot = qs('#mpiSettingsConnUrlSlot', root);
            const saveSlot = qs('#mpiSettingsConnUrlSaveSlot', root);
            if (!group || !slot || !saveSlot) return;
            group.classList.toggle('hide', profileId !== 'custom');
            if (profileId !== 'custom') return;

            const urlInst = _conn(MpiInput.mount(slot, {
                type: 'text',
                placeholder: 'https://my-llm.example.com/v1',
                value: profile?.baseURL || '',
            }));
            const saveInst = _conn(MpiButton.mount(saveSlot, { text: 'Save', variant: 'secondary', size: 'sm' }));
            saveInst.on('click', async () => {
                const baseURL = (qs('.mpi-input__field', urlInst.el)?.value || '').trim();
                await secretsClient.saveEndpointProfile({ id: profileId, name: profile?.name || 'Custom', baseURL });
                // A key is bound to the URL it was saved with, so its status moves too.
                await _renderConnDetails(root, await secretsClient.listEndpointProfiles(), profileId);
            });
        }

        async function _renderConnKey(root, profileId) {
            const keySlot   = qs('#mpiSettingsConnKeySlot', root);
            const saveSlot  = qs('#mpiSettingsConnKeySaveSlot', root);
            const clearSlot = qs('#mpiSettingsConnKeyClearSlot', root);
            if (!keySlot || !saveSlot || !clearSlot) return;

            // Ollama's /v1 answers without a key (`routes/llm.js` exempts it): no field.
            const keyless = profileId === 'ollama';
            qs('#mpiSettingsConnKeyGroup', root)?.classList.toggle('hide', keyless);
            if (keyless) return;

            const available = secretsClient.isAvailable();
            const keyInst = _conn(MpiInput.mount(keySlot, {
                type: 'password',
                placeholder: available ? 'API key' : 'Desktop app only',
                disabled: !available,
            }));
            const saveInst = _conn(MpiButton.mount(saveSlot, { text: 'Save', variant: 'secondary', size: 'sm' }));
            saveInst.on('click', async () => {
                const field = qs('.mpi-input__field', keyInst.el);
                const key = (field?.value || '').trim();
                if (!key) return;
                const res = await secretsClient.setEndpointKey(profileId, key);
                if (field) field.value = '';
                _setText(root, '#mpiSettingsConnKeyStatus', res?.ok ? 'API key saved.' : 'Failed to save the key.');
                if (res?.ok) await _refreshModels(root, profileId);
            });
            const clearInst = _conn(MpiButton.mount(clearSlot, { text: 'Clear', variant: 'secondary', size: 'sm' }));
            clearInst.on('click', async () => {
                await secretsClient.clearEndpointKey(profileId);
                _setText(root, '#mpiSettingsConnKeyStatus', 'No API key saved.');
                await _refreshModels(root, profileId);
            });

            if (!available) {
                _setText(root, '#mpiSettingsConnKeyStatus', 'Saving a key requires the desktop app.');
                return;
            }
            try {
                const has = await secretsClient.hasEndpointKey(profileId);
                _setText(root, '#mpiSettingsConnKeyStatus', has ? 'API key is saved.' : 'No API key saved.');
            } catch (err) {
                clientLogger.warn('settings', '[MpiLlmSettings] connection key presence check failed', err);
                _setText(root, '#mpiSettingsConnKeyStatus', 'Could not read the key status.');
            }
        }

        function _renderConnProbe(root, profileId) {
            const slot = qs('#mpiSettingsConnProbeSlot', root);
            if (!slot) return;
            _setText(root, '#mpiSettingsConnProbeResult', '');
            const probeInst = _conn(MpiButton.mount(slot, { text: 'Test connection', variant: 'secondary', size: 'sm' }));
            probeInst.on('click', async () => {
                _setText(root, '#mpiSettingsConnProbeResult', 'Testing…');
                const json = await _postJson('/llm/connection/probe', { profileId });
                _setText(root, '#mpiSettingsConnProbeResult', json?.ok
                    ? `Connected · ${json.modelCount} models · ${json.latencyMs} ms`
                    : _errorText(json));
                if (json?.ok) await _refreshModels(root, profileId);
            });
        }

        /**
         * MPI-855 — this month's DeepInfra spend and what is left. On the user's click only:
         * it is a billing read on their key. The route answers four numbers and nothing else.
         */
        function _renderConnSpend(root, profileId) {
            const slot = qs('#mpiSettingsConnSpendSlot', root);
            if (!slot) return;
            const hidden = profileId !== 'deepinfra';
            qs('#mpiSettingsConnSpendGroup', root)?.classList.toggle('hide', hidden);
            _setText(root, '#mpiSettingsConnSpendResult', '');
            if (hidden) return;
            const usd = v => `$${Math.max(0, v).toFixed(2)}`;
            const inst = _conn(MpiButton.mount(slot, { text: 'Check spend', variant: 'secondary', size: 'sm' }));
            inst.on('click', async () => {
                _setText(root, '#mpiSettingsConnSpendResult', 'Reading your DeepInfra account…');
                const json = await _getJson('/deepinfra/account');
                _setText(root, '#mpiSettingsConnSpendResult', json?.ok
                    ? [
                        `Spent ${usd(json.spentUsd)} this month`,
                        json.balanceUsd !== null ? `${usd(json.balanceUsd)} of credit left` : null,
                        json.limitUsd !== null ? `${usd(json.limitRoomUsd)} of your ${usd(json.limitUsd)} monthly limit left` : null,
                    ].filter(Boolean).join(' · ')
                    : _errorText(json));
            });
        }

        // ── Agent row — backend "Remote", the model on the connection, mode ──

        function _renderAgentBackend(root) {
            // A fixed value, not a dropdown (Fabio 2026-09-16): the agent only runs on
            // the Remote connection, so there is nothing to pick.
            _setText(root, '#mpiSettingsAgentBackend', `Remote · ${_profile?.name || 'No connection'}`);
        }

        function _renderAgentModel(root) {
            const slot = qs('#mpiSettingsAgentModelSlot', root);
            if (!slot) return;
            _agentModelInst?.destroy();
            _agentModelInst = null;
            _renderInstall('agent', null);
            if (_remote === undefined) {
                _setText(root, '#mpiSettingsAgentModelNote', 'Loading the connection\'s models…');
                return;
            }
            // '' = the recommended model, resolved server-side too; shown as that model.
            // A model that says it cannot call tools cannot be the agent (Ollama's
            // `capabilities`, MPI-941 Phase 11). Unknown (null) stays listed.
            const { options, value, recommended } = _remoteModelOptions('agent', Storage.getAgentPrefs().model, m => m.tools !== false);
            _agentModelInst = MpiDropdown.mount(slot, {
                options,
                value,
                placeholder: _remote?.ok ? 'Select a model' : 'Connect first',
                disabled: !_remote?.ok,
                extraClasses: STACKED,
            });
            _renderInstall('agent', value);
            _agentModelInst.on('change', ({ value: model }) => {
                Storage.setAgentPrefs({ ...Storage.getAgentPrefs(), model });
                _renderInstall('agent', model);
                // An estimate on screen was for the model just replaced.
                if (_bench.step === 'confirm') _benchCancel(root);
            });
            _setText(root, '#mpiSettingsAgentModelNote', _remote?.ok
                ? (recommended ? 'The models on top ran the agent tests, ours or your own benchmark: each shows its score and cost.' :'We have not tested the agent on this provider. Pick a model that can call tools, then use Test tool use and Benchmark this model.')
                : _errorText(_remote));
        }

        function _renderAgentMode(root) {
            const slot = qs('#mpiSettingsAgentModeSlot', root);
            if (!slot) return;
            const inst = _conn(MpiDropdown.mount(slot, {
                options: AGENT_MODE_OPTIONS,
                value: Storage.getAgentPrefs().mode,
                extraClasses: STACKED,
            }));
            inst.on('change', ({ value: mode }) => {
                Storage.setAgentPrefs({ ...Storage.getAgentPrefs(), mode });
            });
        }

        function _renderAgentProbe(root, profileId) {
            const slot = qs('#mpiSettingsAgentProbeSlot', root);
            if (!slot) return;
            _setText(root, '#mpiSettingsAgentProbeResult', '');
            const probeInst = _conn(MpiButton.mount(slot, { text: 'Test tool use', variant: 'secondary', size: 'sm' }));
            probeInst.on('click', async () => {
                _setText(root, '#mpiSettingsAgentProbeResult', 'Testing… (one small request)');
                const json = await _postJson('/agent/probe', { profileId, model: Storage.getAgentPrefs().model });
                if (!json?.ok) {
                    _setText(root, '#mpiSettingsAgentProbeResult', _errorText(json));
                    return;
                }
                const underFloor = typeof json.contextWindow === 'number' && json.contextWindow < AGENT_CONTEXT_FLOOR;
                const line = [
                    json.tools ? 'Tools: yes' : 'Tools: no',
                    json.model,
                    `${json.latencyMs} ms`,
                    json.message,
                    _windowLabel({ contextWindow: json.contextWindow }),
                ].filter(Boolean).join(' · ');
                const text = underFloor
                    ? `${line} · Under 64K context: long chats will forget early turns sooner. Pick a model with 64K or more.`
                    : line;
                _setText(root, '#mpiSettingsAgentProbeResult', text, underFloor);
            });
        }

        // ── "Benchmark this model" (MPI-941 Phase 12, Fabio 2026-09-28: an inline confirm, no modal) ──

        /** The control for `_bench.step`: the button, Run / Cancel under the estimate, or the progress and Stop. */
        function _renderBench(root) {
            _benchInsts.forEach(i => i.destroy());
            _benchInsts.length = 0;
            const slot = qs('#mpiSettingsAgentBenchSlot', root);
            const slot2 = qs('#mpiSettingsAgentBenchSlot2', root);
            if (!slot || !slot2) return;
            const button = (target, props, onClick) => {
                const inst = MpiButton.mount(target, { variant: 'secondary', size: 'sm', ...props });
                inst.on('click', onClick);
                _benchInsts.push(inst);
            };
            if (_bench.info) _setText(root, '#mpiSettingsAgentBenchHint', `Runs our ${_bench.info.cases} agent tests on this model with pretend tools: nothing is generated or added to your projects.`);
            const { step, info, progress, stopping } = _bench;
            // MPI-965: the Share tickbox belongs to the confirm step, and only where the server says a run can
            // be shared (one of the four presets; never Custom). Unticked the first time, then remembered.
            const shareSlot = qs('#mpiSettingsAgentBenchShareSlot', root);
            const shareHint = qs('#mpiSettingsAgentBenchShareHint', root);
            const offerShare = step === 'confirm' && info?.canShare === true;
            if (shareSlot) shareSlot.hidden = !offerShare;
            if (shareHint) shareHint.hidden = !offerShare;
            if (shareSlot && offerShare) {
                const box = MpiCheckbox.mount(shareSlot, { checked: Storage.getAgentBenchShare(), label: 'Share the result anonymously', name: 'agent-bench-share' });
                box.on('change', ({ checked }) => Storage.setAgentBenchShare(checked));
                _benchInsts.push(box);
            }
            // The public page, whenever the server has one (it is null with sharing switched off).
            const linkSlot = qs('#mpiSettingsAgentBenchLinkSlot', root);
            if (linkSlot && info?.communityUrl) {
                const link = MpiButton.mount(linkSlot, { text: 'See everyone\'s results', variant: 'ghost', size: 'sm' });
                link.on('click', () => openExternal(info.communityUrl));
                _benchInsts.push(link);
            }
            // One step per test, green on a pass, red on a fail, track until it runs (Fabio 2026-09-29). The
            // steps of a run that ended stay under its line until the next Benchmark click.
            const bar = step === 'running' ? progress : step === 'idle' ? _bench.ran : null;
            if (bar) {
                const results = bar.results || [];
                const steps = Array.from({ length: bar.cases }, (_, i) => (i < results.length ? (results[i] ? 'success' : 'danger') : null));
                _benchInsts.push(MpiProgressBar.mount(qs('#mpiSettingsAgentBenchBar', root), { steps }));
            }
            if (step === 'confirm') {
                _setText(root, '#mpiSettingsAgentBenchLine', _benchEstimate(info));
                button(slot, { text: 'Run', variant: 'primary' }, () => _benchRun(root));
                button(slot2, { text: 'Cancel' }, () => _benchCancel(root));
            } else if (step === 'running') {
                _setText(root, '#mpiSettingsAgentBenchLine', `${progress.done} of ${progress.cases} · ${progress.passed} passed`);
                button(slot, { text: stopping ? 'Stopping after this test…' : 'Stop', disabled: stopping }, () => {
                    _bench = { ..._bench, stopping: true };
                    _postJson('/agent/benchmark/stop', {});
                    _renderBench(root);
                });
            } else {
                button(slot, { text: 'Benchmark this model', disabled: !_remote?.ok }, () => _benchAsk(root));
            }
        }

        /** The click: the estimate for the model picked NOW, asked in place. */
        async function _benchAsk(root) {
            const { profileId } = Storage.getLlmConnection();
            const model = Storage.getAgentPrefs().model || '';
            const info = await _getJson(`/agent/benchmark?profileId=${encodeURIComponent(profileId)}&model=${encodeURIComponent(model)}`);
            if (!info?.ok) {
                _bench = { ..._bench, ran: null };
                _renderBench(root);
                return _setText(root, '#mpiSettingsAgentBenchLine', _errorText(info), true);
            }
            _bench = { ..._bench, step: 'confirm', info, ran: null };
            _renderBench(root);
        }

        async function _benchRun(root) {
            const { profileId } = Storage.getLlmConnection();
            // `share` only where the tickbox was offered: a remembered tick never rides along to Custom.
            const share = _bench.info?.canShare === true && Storage.getAgentBenchShare();
            const json = await _postJson('/agent/benchmark', { profileId, model: Storage.getAgentPrefs().model || '', share });
            if (!json?.ok) {
                _benchCancel(root);
                return _setText(root, '#mpiSettingsAgentBenchLine', _errorText(json), true);
            }
            _bench = { ..._bench, step: 'running', stopping: false, progress: { done: 0, passed: 0, cases: json.cases } };
            _renderBench(root);
        }

        function _benchCancel(root) {
            _bench = { ..._bench, step: 'idle' };
            _setText(root, '#mpiSettingsAgentBenchLine', '');
            _renderBench(root);
        }

        /** The run ended: its line, and the agent row repainted with the score agentService kept. */
        function _benchEnd(text, isWarn = false) {
            const ran = _bench.progress?.results?.length ? _bench.progress : null;
            _bench = { ..._bench, step: 'idle', progress: null, stopping: false, ran };
            _renderBench(el);
            _setText(el, '#mpiSettingsAgentBenchLine', text, isWarn);
            _renderAgentModel(el);
        }

        /** "About $0.10 on DeepInfra, ~14 min" / "Uses your GPU for 10-30 min". */
        function _benchEstimate({ local, usd, cases }) {
            if (local) return `Uses your GPU for 10-30 min (${cases} tests).`;
            // ponytail: ~30 s a test on a hosted model (gpt-oss-120b: 28 tests in ~15 min, 2026-09-29); a slow provider runs longer.
            const minutes = `~${Math.ceil(cases * 30 / 60)} min`;
            const where = _profile?.name || 'your connection';
            return typeof usd === 'number' ? `About $${usd.toFixed(2)} on ${where}, ${minutes}.` : `${cases} chats on ${where}, ${minutes}.`;
        }

        /** Was this score taken on the tests the app ships now? Unknown (the server did not say) counts as yes. */
        function _currentTests(score) {
            return !!score && (!_bench.info || score.suiteHash === _bench.info.suiteHash);
        }

        /** "1M context" — the window the agent compacts against. */
        /**
         * "28/28 tests · $0.36/100 chats"; a local model (perChat 0) costs your GPU, not money; null = a
         * provider that reports no cost. "(older tests)" when the score predates the tests the app ships;
         * "(community, 9 runs)" when it is the median of everyone's shared runs (MPI-965).
         */
        function _agentTestLabel(score, community = false) {
            const { passed, cases, perChat, runs } = score;
            const cost = perChat ? `$${(perChat * 100).toFixed(2)}/100 chats` : perChat === 0 ? 'runs on your GPU' : '';
            const source = community ? ` (community, ${runs} runs)` : '';
            return [`${passed}/${cases} tests${source}${_currentTests(score) ? '' : ' (older tests)'}`, cost].filter(Boolean).join(' · ');
        }

        /** An option's meta line: `lead` first, then the context window, then "Not downloaded"
         *  for a recommended Ollama model the user's Ollama lacks (MPI-993). */
        function _modelMeta(m, ...lead) {
            return [...lead, _windowLabel(m), m.installed === false && 'Not downloaded'].filter(Boolean).join(' · ');
        }

        function _windowLabel(m) {
            if (!m.contextWindow) return '';
            return m.contextWindow >= 1_000_000
                ? `${Math.round(m.contextWindow / 1_048_576)}M context`
                : `${Math.round(m.contextWindow / 1024)}K context`;
        }

        function _errorText(json) {
            if (!json) return 'Could not reach the app server.';
            const code = json.error?.code;
            if (code === 'NO_KEY') return 'Add an API key for this provider first.';
            if (code === 'NO_PROFILE') return 'This provider has no base URL yet.';
            return `${code || 'Error'}: ${json.error?.message || 'the request failed.'}`;
        }

        function _setText(root, selector, text, isWarn = false) {
            const node = qs(selector, root);
            if (!node) return;
            node.textContent = text;
            node.classList.toggle('mpi-settings__hint--warn', !!isWarn);
        }

        async function _getJson(url) {
            try { return await (await fetch(url)).json(); } catch (err) {
                clientLogger.warn('settings', `[MpiLlmSettings] GET ${url} failed`, err);
                return null;
            }
        }

        async function _postJson(url, body) {
            try {
                const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                return await res.json();
            } catch (err) {
                clientLogger.warn('settings', `[MpiLlmSettings] POST ${url} failed`, err);
                return null;
            }
        }

        el.destroy = () => {
            _destroyControls();
            _benchUnsubs.forEach(u => u());
            el.onOpen = null;
        };
    },
});
