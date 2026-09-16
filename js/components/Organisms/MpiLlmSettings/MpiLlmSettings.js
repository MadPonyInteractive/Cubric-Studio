import { ComponentFactory } from '../../factory.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { MpiDropdown } from '../../Primitives/MpiDropdown/MpiDropdown.js';
import { MpiOllamaSetup } from '../../Compounds/LandingPages/MpiOllamaSetup/MpiOllamaSetup.js';
import { secretsClient } from '../../../core/secretsClient.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { pluginAvailability } from '../../../data/pluginsRegistry.js';
import {
    backendPreference,
    setBackendPreference,
    enhancerModelPreference,
    setEnhancerModelPreference,
    enhancerModels,
    priceLabel,
} from '../../../services/llmService.js';
import { qs } from '../../../utils/dom.js';
import { Storage } from '../../../core/storage.js';

/**
 * MpiLlmSettings — the Language Models section of the Remote panel.
 *
 * THE SECTION IS ABOUT THE LANGUAGE MODEL, NOT ABOUT ONE BUTTON (Fabio,
 * 2026-09-12). An earlier draft was written entirely around prompt enhancement
 * and read as if that were the only job. It is not: an LLM already writes image
 * descriptions here too, and the agent is a third job arriving later. So the
 * section is per-JOB — one row each — and the copy talks about the models rather
 * than about Enhance.
 *
 * THE CHOICE IS WHERE THE WORK RUNS, NOT WHICH ANSWER IS BETTER. His two cases
 * are the spec: generating on a RunPod pod, enhance locally because the card is
 * idle; generating locally, push it to the cloud so it costs no VRAM. Every entry
 * is labelled with what it COSTS, and the model choice sits UNDER the backend.
 *
 * THE JOBS, and what each can honestly offer today:
 *   - **Enhancement** — all three backends. Live.
 *   - **Descriptions** — ComfyUI only, and that is a MEASURED limit rather than a
 *     missing feature: `MODEL_REGISTRY` (`services/llmEngines.mjs`) is four models
 *     and every one is TEXT-ONLY, so neither DeepInfra nor Ollama has anything
 *     that can look at an image. The row says so instead of offering a choice
 *     that would break "Describe image". **MPI-737 owns growing it**, by putting
 *     a vision-capable entry in the registry and routing `imageDescribe` through
 *     the chosen backend.
 *   - **Agent** — MPI-774. Remote only: the model is picked from the shared
 *     connection's list, recommended first.
 *
 * THE REMOTE CONNECTION IS SHARED (MPI-774, Fabio 2026-09-16): one provider + key
 * at the top, every job that runs on Remote uses it. MPI-737 relabels the other
 * two rows to "Remote" and drops the DeepInfra-only Account block below.
 *
 * WHAT IS DELIBERATELY NOT HERE: any notion of an "uncensored model" (MPI-728 —
 * a LoRA the user downloads makes any model uncensored, so it was never a fact
 * about the model card), and any implication that an abliterated build is the
 * stronger instrument (it is the enhancer OF RECORD and it dropped the user's own
 * subject 6 runs in 10 where both shipped models dropped none).
 */

/** The plugin whose deps ARE the local enhancer/describer weight. */
const ENHANCER_PLUGIN_ID = 'image-describer';

/**
 * `mpi-dropdown--stacked` puts each option's meta on its OWN line with no
 * ellipsis cap. Without it the cost labels — the entire reason these entries read
 * as a placement choice — truncate to "CLOUD W…" and "NO VRAM…" in the panel's
 * width, which is the MPI-620 defect MpiDropdown's own comment warns about.
 */
const STACKED = 'mpi-dropdown--stacked';

/**
 * THREE ENTRIES AND NO "AUTOMATIC" (Fabio, 2026-09-12): the RunPod section has no
 * automatic entry, so neither does this, and with nothing picked it is ComfyUI
 * (`backendPreference()`). An entry that cannot run yet stays LISTED but greyed
 * rather than vanishing — DeepInfra until a key is saved, ComfyUI until its plugin
 * is installed — because the list is also how a user learns what exists.
 */
const BACKENDS = [
    { value: 'deepinfra', label: 'DeepInfra (cloud)', meta: 'No VRAM, needs a key' },
    { value: 'ollama',    label: 'Ollama (local)',    meta: 'A second runtime, its own VRAM' },
    { value: 'comfy',     label: 'ComfyUI (local)',   meta: 'Reuses the engine already running' },
];

export const MpiLlmSettings = ComponentFactory.create({
    name: 'MpiLlmSettings',
    css: ['js/components/Organisms/MpiLlmSettings/MpiLlmSettings.css'],

    template: () => `
                <div class="mpi-settings__section">
                    <h3 class="mpi-settings__section-title">Language Models</h3>
                    <span class="mpi-settings__hint">Cubric uses a language model for the writing jobs around a generation — rewriting a short idea into a full prompt, and describing an image you hand it. Each job below chooses which machine runs it. You always see the result before it is used.</span>

                    <div class="mpi-settings__subgroup">
                        <span class="mpi-settings__subgroup-title">Remote connection</span>
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
                        <div class="mpi-settings__form-group">
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
                    </div>

                    <div class="mpi-settings__subgroup">
                        <span class="mpi-settings__subgroup-title">Account</span>
                        <span class="mpi-settings__hint">Only needed for the cloud backend. The key is stored by the desktop app and is never readable back — clear it and save a new one to change it.</span>
                        <div class="mpi-settings__signup">
                            <div class="mpi-settings__signup-copy">
                                <span class="mpi-settings__signup-kicker">New to DeepInfra?</span>
                                <span class="mpi-settings__signup-text">Create an account, then make an API key in your DeepInfra dashboard and paste it below. What you run is billed to your DeepInfra account.</span>
                            </div>
                            <a class="mpi-settings__signup-link" href="https://deepinfra.com/dash" target="_blank" rel="noopener noreferrer">Open DeepInfra dashboard</a>
                        </div>
                        <div class="mpi-settings__form-group">
                            <label class="mpi-settings__field-label">DeepInfra API key</label>
                            <div class="mpi-settings__folder-row">
                                <div id="mpiSettingsLlmKeySlot" class="mpi-settings__folder-input"></div>
                                <div id="mpiSettingsLlmKeySaveSlot"></div>
                                <div id="mpiSettingsLlmKeyClearSlot"></div>
                            </div>
                            <span class="mpi-settings__hint" id="mpiSettingsLlmKeyStatus"></span>
                        </div>
                    </div>

                    <div class="mpi-settings__subgroup">
                        <span class="mpi-settings__subgroup-title">Where each job runs</span>
                        <span class="mpi-settings__hint">This is about which machine does the work, not which answer is better. Generating on a RunPod pod? Run these locally — your own card is idle. Generating locally? Push them to the cloud and keep the VRAM for the picture.</span>

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
                        <div id="mpiSettingsLlmOllamaSlot"></div>

                        <div class="mpi-settings__form-group">
                            <label class="mpi-settings__field-label">Image descriptions</label>
                            <div id="mpiSettingsLlmDescribeBackendSlot"></div>
                            <span class="mpi-settings__hint" id="mpiSettingsLlmDescribeNote"></span>
                        </div>

                        <div class="mpi-settings__form-group">
                            <label class="mpi-settings__field-label">Agent</label>
                            <div id="mpiSettingsAgentBackendSlot"></div>
                        </div>
                        <div class="mpi-settings__form-group">
                            <label class="mpi-settings__field-label">Agent model</label>
                            <div id="mpiSettingsAgentModelSlot"></div>
                            <span class="mpi-settings__hint" id="mpiSettingsAgentModelNote"></span>
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
                    </div>

                    <div class="mpi-settings__subgroup">
                        <span class="mpi-settings__subgroup-title">Before you choose</span>
                        <span class="mpi-settings__hint">A hosted provider will refuse or quietly sanitise material that a local uncensored build will shape for you. If that matters for what you are making, run these locally — it is the only place an uncensored model exists.</span>
                        <span class="mpi-settings__hint">Uncensored does not mean better: in our tests, uncensored models missed parts of the prompt more often. Pick one only when you need what it will write.</span>
                    </div>
                </div>`,

    setup: (el) => {
        let _models = [];
        let _hasKey = false;
        const _insts = [];
        // Re-rendered on their own, so each is destroyed before it is replaced: a
        // control cleared with innerHTML alone keeps its listeners alive.
        let _backendInst = null;
        let _modelInst = null;
        let _ollamaInst = null;
        /** The last `/llm/ollama` reply, for each Ollama model's Downloaded meta. */
        let _ollama = null;
        // The shared connection: the provider pick, the controls that depend on it
        // (rebuilt on every pick), and the async agent model list.
        let _connProfileInst = null;
        const _connInsts = [];
        let _agentModelInst = null;
        let _detailsSeq = 0;
        let _agentModelSeq = 0;

        el.onOpen = () => { _init(el); };
        _init(el);

        /** Every control is re-read from scratch on each open — no cached view state. */
        async function _init(root) {
            _destroyControls();
            _renderKeyField(root);
            _renderDescribe(root);
            _models = await enhancerModels();
            // Key status FIRST: the backend dropdown greys DeepInfra on it.
            await _refreshKeyStatus(root);
            _renderBackend(root);
            await _initConnection(root);
        }

        function _destroyControls() {
            _insts.forEach(i => i?.el?.destroy?.());
            _insts.length = 0;
            _backendInst?.el?.destroy?.();
            _modelInst?.el?.destroy?.();
            _ollamaInst?.destroy();
            _connProfileInst?.destroy();
            _connInsts.forEach(i => i.destroy());
            _connInsts.length = 0;
            _agentModelInst?.destroy();
            _backendInst = null;
            _modelInst = null;
            _ollamaInst = null;
            _connProfileInst = null;
            _agentModelInst = null;
        }

        // ── The DeepInfra key (write-only; the field is cleared after save) ──
        // `MpiRunpodSettings`'s shape verbatim: disabled with a "Desktop app only"
        // placeholder in a browser, never read back, and no state.js key — the
        // renderer must not be able to hold the value even in memory.
        function _renderKeyField(root) {
            const keySlot = qs('#mpiSettingsLlmKeySlot', root);
            const saveSlot = qs('#mpiSettingsLlmKeySaveSlot', root);
            const clearSlot = qs('#mpiSettingsLlmKeyClearSlot', root);
            if (!keySlot || !saveSlot || !clearSlot) return;
            keySlot.innerHTML = '';
            saveSlot.innerHTML = '';
            clearSlot.innerHTML = '';

            const available = secretsClient.isAvailable();
            // A FORMAT HINT, not an instruction — the RunPod field's `rpa_...` is the
            // house shape, and it tells the user what they are looking for in their
            // account rather than restating the button beside it.
            const keyInst = MpiInput.mount(keySlot, {
                type: 'password',
                placeholder: available ? 'di_...' : 'Desktop app only',
                disabled: !available,
            });
            _insts.push(keyInst);

            const saveInst = MpiButton.mount(saveSlot, { text: 'Save', variant: 'secondary', size: 'sm' });
            saveInst.on('click', async () => {
                const field = qs('.mpi-input__field', keyInst.el);
                const key = (field?.value || '').trim();
                if (!key) return;
                const res = await secretsClient.setDeepInfraKey(key);
                if (field) field.value = '';
                if (!res?.ok) {
                    _setKeyStatus(root, 'Failed to save the DeepInfra key.');
                    return;
                }
                // Prices come back only once a key is saved, so the list is re-read.
                _models = await enhancerModels();
                await _refreshKeyStatus(root);
                _renderBackend(root);
            });
            _insts.push(saveInst);

            const clearInst = MpiButton.mount(clearSlot, { text: 'Clear', variant: 'secondary', size: 'sm' });
            clearInst.on('click', async () => {
                await secretsClient.clearDeepInfraKey();
                await _refreshKeyStatus(root);
                _renderBackend(root);
            });
            _insts.push(clearInst);
        }

        function _setKeyStatus(root, text) {
            const node = qs('#mpiSettingsLlmKeyStatus', root);
            if (node) node.textContent = text;
        }

        /** Paints the status line and records `_hasKey`, which gates the DeepInfra entry. */
        async function _refreshKeyStatus(root) {
            _hasKey = false;
            if (!secretsClient.isAvailable()) {
                _setKeyStatus(root, 'Saving a key requires the desktop app.');
                return;
            }
            try {
                _hasKey = !!(await secretsClient.hasDeepInfraKey());
                _setKeyStatus(root, _hasKey
                    ? 'API key is saved.'
                    : 'No API key saved — the cloud backend is unavailable until one is.');
            } catch (err) {
                clientLogger.warn('settings', '[MpiLlmSettings] key presence check failed', err);
                _setKeyStatus(root, 'Could not read the key status.');
            }
        }

        /**
         * The ONE gate on ComfyUI, and it is a download rather than a model: the
         * graphs load their own encoder, so what decides is whether that weight is
         * on disk. Same dep, same question, for both jobs.
         */
        function _comfyInstalled() {
            return pluginAvailability(ENHANCER_PLUGIN_ID).installed;
        }

        // ── Prompt enhancement ──────────────────────────────────────────────
        function _renderBackend(root) {
            const slot = qs('#mpiSettingsLlmEnhanceBackendSlot', root);
            if (!slot) return;
            _backendInst?.el?.destroy?.();
            slot.innerHTML = '';

            const options = BACKENDS.map((b) => {
                if (b.value === 'deepinfra' && !_hasKey) return { ...b, disabled: true, meta: 'Save an API key above first' };
                if (b.value === 'comfy' && !_comfyInstalled()) return { ...b, disabled: true, meta: 'Install the Image Describer plugin' };
                return b;
            });

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
            const node = qs('#mpiSettingsLlmEnhanceBackendNote', root);
            if (!node) return;
            const NOTES = {
                deepinfra: 'Runs off your machine entirely. Needs the key above, and your prompt leaves this computer.',
                ollama: 'Runs on your own card in a second runtime, so it holds VRAM alongside a local generation. Cubric starts Ollama when it is needed; installing it or downloading a model waits for your click below.',
                comfy: 'Runs in the ComfyUI engine this app already started, and loads one text encoder of its own. Offered on every model.',
            };
            // A backend picked while it could run and unavailable since (the key
            // cleared, the plugin removed) stays selected. Swapping it would turn the
            // user's pick into a quiet substitution, so the line says what is missing.
            const MISSING = {
                deepinfra: !_hasKey && 'Needs an API key, and none is saved. Save one above, or pick another backend.',
                comfy: !_comfyInstalled() && 'Needs the Image Describer plugin, which is not installed. Install it, or pick another backend.',
            };
            node.textContent = MISSING[backend] || NOTES[backend];
        }

        // ── The enhancement model, UNDER the chosen backend ──────────────────
        function _renderModel(root, backend) {
            const group = qs('#mpiSettingsLlmEnhanceModelGroup', root);
            const slot = qs('#mpiSettingsLlmEnhanceModelSlot', root);
            const note = qs('#mpiSettingsLlmEnhanceModelNote', root);
            if (!group || !slot) return;
            _modelInst?.el?.destroy?.();
            _modelInst = null;
            slot.innerHTML = '';

            // ComfyUI runs one graph with one baked weight, so there is nothing to
            // choose. The LABEL hides with the control: a field label with no field
            // under it is what the first draft shipped.
            const servable = _models.filter(m => (backend === 'deepinfra' ? m.deepinfra : m.ollama));
            const reason = backend === 'comfy'
                ? 'ComfyUI runs one enhancer — the weight its graph loads — so there is nothing to pick.'
                : !servable.length
                    ? 'The model list is unavailable — enhancement will use the default.'
                    : '';

            if (reason) {
                group.hidden = true;
                if (note) { note.textContent = reason; note.hidden = false; }
                return;
            }

            group.hidden = false;
            // The cloud bills per token, so its note says how many an enhance takes:
            // the recipe system prompts measure ~450 to ~3,400 tokens (MPI-728).
            const billed = backend === 'deepinfra';
            if (note) {
                note.textContent = billed ? 'Billed to your DeepInfra account. One enhance uses about 500 to 4,000 tokens.' : '';
                note.hidden = !billed;
            }
            // NO "Default" ENTRY (Fabio, 2026-09-13): a bare "Default" makes the user ask
            // what it is. The model the app runs with nothing picked is listed and
            // selected by NAME instead, and its registry name already says "(Default)".
            const options = servable.map(m => {
                // Known only once Ollama answers; no meta beats a guessed one.
                const downloaded = backend === 'ollama' ? _ollama?.models?.[m.id]?.downloaded : undefined;
                return {
                    value: m.id,
                    label: m.names?.[backend] || m.name,
                    info: m.description,
                    // No price when the fetch failed: none beats a stale one.
                    ...(billed && m.price && { meta: priceLabel(m.price) }),
                    ...(typeof downloaded === 'boolean' && { meta: downloaded ? 'Downloaded' : 'Not downloaded' }),
                };
            });
            // Nothing picked, or a model pinned under the OTHER backend (not servable
            // here): show the default model rather than a value this dropdown cannot
            // honour. The pin itself is left alone, so switching back restores it.
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

        // ── Remote connection (MPI-774) — ONE for every job that runs on Remote ──
        // The provider, its base URL (Custom only), its write-only key, and a test
        // that spends no tokens. The pick is `Storage.getLlmConnection()`; the key
        // lives in the main process. Job rows read the connection's models from
        // `GET /llm/connection/models`, recommended first — MPI-737 builds the
        // Enhancement and Image descriptions rows on the same list.

        const PROFILE_NOTES = {
            deepinfra:  'Recommended. Runs off your machine, so it costs no VRAM. Uses the same key as the DeepInfra account below.',
            openrouter: 'A gateway to many providers\' models. Needs an OpenRouter API key.',
            openai:     'OpenAI\'s own endpoint. Needs an OpenAI API key.',
            ollama:     'Your local Ollama runtime, through its /v1 endpoint. Untested with the agent, and it needs its own VRAM beside any running generation.',
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
            const profile = profiles.find(p => p.id === profileId) || null;
            _renderConnUrl(root, profiles, profile, profileId);
            await _renderConnKey(root, profileId);
            if (seq !== _detailsSeq) return;
            _renderConnProbe(root, profileId);
            _renderAgentBackend(root, profile);
            _renderAgentMode(root);
            _renderAgentProbe(root, profileId);
            await _renderAgentModel(root, profileId);
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

        function _renderConnUrl(root, profiles, profile, profileId) {
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
                if (res?.ok) await _renderAgentModel(root, profileId);
            });
            const clearInst = _conn(MpiButton.mount(clearSlot, { text: 'Clear', variant: 'secondary', size: 'sm' }));
            clearInst.on('click', async () => {
                await secretsClient.clearEndpointKey(profileId);
                _setText(root, '#mpiSettingsConnKeyStatus', 'No API key saved.');
                await _renderAgentModel(root, profileId);
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
                if (json?.ok) await _renderAgentModel(root, profileId);
            });
        }

        // ── Agent row — backend "Remote", the model on the connection, mode ──

        function _renderAgentBackend(root, profile) {
            const slot = qs('#mpiSettingsAgentBackendSlot', root);
            if (!slot) return;
            // One real option: the agent only runs on the remote connection.
            _conn(MpiDropdown.mount(slot, {
                options: [{ value: 'remote', label: 'Remote', meta: profile?.name || 'No connection' }],
                value: 'remote',
                extraClasses: STACKED,
            }));
        }

        async function _renderAgentModel(root, profileId) {
            const slot = qs('#mpiSettingsAgentModelSlot', root);
            if (!slot) return;
            const seq = ++_agentModelSeq;
            _agentModelInst?.destroy();
            _agentModelInst = null;
            _setText(root, '#mpiSettingsAgentModelNote', 'Loading the connection\'s models…');

            const json = await _getJson(`/llm/connection/models?profileId=${encodeURIComponent(profileId)}`);
            const models = json?.ok ? json.models : [];
            const recommended = models.filter(m => m.recommendedFor.includes('agent'));
            const saved = Storage.getAgentPrefs().model;
            // '' = the recommended model, resolved server-side too; shown as that model.
            const value = saved || recommended[0]?.id || '';
            const options = [
                ...recommended.map(m => ({ value: m.id, label: `(recommended) ${m.id}`, meta: _windowLabel(m) })),
                ...models.filter(m => !m.recommendedFor.includes('agent')).map(m => ({ value: m.id, label: m.id, meta: _windowLabel(m) })),
            ];
            // A pick the endpoint no longer lists stays visible rather than silently changing.
            if (value && !options.some(o => o.value === value)) options.unshift({ value, label: value, meta: 'Not listed' });

            // A newer render (a provider change, a saved key) started while this one waited.
            if (seq !== _agentModelSeq) return;
            _agentModelInst = MpiDropdown.mount(slot, {
                options,
                value,
                placeholder: json?.ok ? 'Select a model' : 'Connect first',
                disabled: !json?.ok,
                extraClasses: STACKED,
            });
            _agentModelInst.on('change', ({ value: model }) => {
                Storage.setAgentPrefs({ ...Storage.getAgentPrefs(), model });
            });
            _setText(root, '#mpiSettingsAgentModelNote', json?.ok
                ? (recommended.length ? 'The recommended model is the one we test the agent on.' : 'We have not tested the agent on this provider. Pick a model that can call tools, then use Test tool use.')
                : _errorText(json));
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
                _setText(root, '#mpiSettingsAgentProbeResult', json?.ok
                    ? [json.tools ? 'Tools: yes' : 'Tools: no', json.model, `${json.latencyMs} ms`, json.message].filter(Boolean).join(' · ')
                    : _errorText(json));
            });
        }

        /** "1M context" — the window the agent compacts against. */
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

        function _setText(root, selector, text) {
            const node = qs(selector, root);
            if (node) node.textContent = text;
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

        // ── Image descriptions (MPI-737 grows this) ─────────────────────────
        // ONE real option today, and the dropdown is shown rather than hidden so the
        // section reads as what it is: a list of jobs, each with a placement. The
        // limit is measured, not missing plumbing — every model in the registry is
        // text-only, so no hosted or Ollama backend can look at an image at all.
        function _renderDescribe(root) {
            const slot = qs('#mpiSettingsLlmDescribeBackendSlot', root);
            const note = qs('#mpiSettingsLlmDescribeNote', root);
            if (!slot) return;
            slot.innerHTML = '';

            const installed = _comfyInstalled();
            const inst = MpiDropdown.mount(slot, {
                options: [{
                    value: 'comfy',
                    label: 'ComfyUI (local)',
                    meta: installed ? 'Reuses the engine already running' : 'Install the Image Describer plugin',
                    disabled: !installed,
                }],
                value: 'comfy',
                placeholder: 'ComfyUI (local)',
                extraClasses: STACKED,
            });
            _insts.push(inst);

            if (note) {
                note.textContent = installed
                    ? 'Only ComfyUI can do this today — describing an image needs a model that can see one, and neither cloud nor Ollama carries one yet.'
                    : 'Needs the Image Describer plugin. Describing an image needs a model that can see one, and only the local ComfyUI graph carries it.';
            }
        }

        el.destroy = () => {
            _destroyControls();
            el.onOpen = null;
        };
    },
});
