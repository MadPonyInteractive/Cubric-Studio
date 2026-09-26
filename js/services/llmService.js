// js/services/llmService.js

/**
 * llmService — Vision's own prompt enhancement and image description (MPI-677, MPI-737).
 *
 * THIS IS WHAT RETIRES CUBRIC PROMPT. The Enhance button used to call out over
 * the broker to a sibling app; the recipe layer landed here in MPI-35, so the
 * whole round trip collapses into: resolve the recipe → fill a system prompt →
 * run an LLM → hand back the text. `js/shell/connectorOps.js` was the thing this
 * replaced; step 1b repointed the button and step 2 DELETED it, along with the
 * broker boot, the connector responder and the `@cubric/connector` dependency.
 *
 * THREE BACKENDS, AND THE CHOICE IS THE USER'S (MPI-728/MPI-737). Fabio, 2026-09-12:
 * the dropdown is about WHERE THE WORK RUNS, not which model is smartest — a
 * user generating on a RunPod pod enhances locally because the card is idle, and
 * a user generating locally pushes enhancement to the cloud to keep VRAM free.
 * `chooseBackend` honours that pick, and with no pick the answer is `comfy`.
 *
 *   - `endpoint` (MPI-737; previously `deepinfra` — stored values migrate on read)
 *     — any OpenAI-compatible endpoint via the shared Remote connection. Off-GPU,
 *     no queue wait, no VRAM at all. Image descriptions also use this path
 *     (`describeImage`), skipping the ComfyUI queue entirely.
 *   - `comfy` — THE DEFAULT. Local, through the engine that is already running. It runs the
 *     shipped `qwen3vl_4b_prompt_enhancer.json` through the existing
 *     `promptEnhance` operation. OFFERED ON EVERY MODEL: the graph carries its
 *     own `CLIPLoader` (node 9, `qwen3vl_4b_abliterated_fp8_scaled`), proven
 *     2026-09-12 to run on an idle bench with no generation model loaded at all.
 *     That loader is a DEFAULT, not a fixture: where the generation model's own
 *     encoder can run `TextGenerate`, the enhance borrows it instead (Fabio,
 *     2026-09-13 — Klein's `qwen_3_8b_int8_convrot`), so the weight the
 *     generation is about to load is the one that writes the prompt
 *     (`enhancerClipParams`). With nothing to borrow it needs the
 *     `qwen3vl-abliterated-clip` dep installed.
 *   - `ollama` — local, in a second runtime with its own VRAM. The only backend
 *     that carries an abliterated build.
 *
 * The endpoint key lives in the main process and is resolved by `routes/llm.js`.
 * Nothing here ever sees it.
 */

import { resolveRecipe, FALLBACK_RECIPE_ID, getRecipe } from '../data/recipes/registry.js';
import { composeSystemPrompt } from '../data/recipes/styles.js';
import { clientLogger } from './clientLogger.js';
import { Storage } from '../core/storage.js';

/** The mode every image recipe declares, and the base mode of the video ones. */
const DEFAULT_MODE = 't2v';

/** The registered ComfyUI operation that runs `qwen3vl_4b_prompt_enhancer.json`. */
export const COMFY_ENHANCE_OP = 'promptEnhance';

/** Per-viewer backend override for enhancement, when the user has pinned one. */
const BACKEND_PREF_KEY = 'cubric.llm.backend';

/** Per-viewer enhancer-model choice for Ollama: a MODEL_REGISTRY id. Before MPI-737
 *  it also held the DeepInfra pick, which is why `_endpointEnhanceModel` still reads it. */
const ENHANCER_MODEL_PREF_KEY = 'cubric.llm.enhancerModel';
/** Per-viewer enhancer model on Remote: a raw endpoint id (MPI-737). Its own key,
 *  or a Remote pick would reach Ollama as an id Ollama has never heard of. */
const ENDPOINT_MODEL_PREF_KEY = 'cubric.llm.endpointModel';

/** Per-viewer describe-backend choice (MPI-737). Default: 'comfy'. */
const DESCRIBE_BACKEND_PREF_KEY = 'cubric.llm.describeBackend';
/** Per-viewer describe model, under whichever backend is running descriptions. */
const DESCRIBE_MODEL_PREF_KEY = 'cubric.llm.describeModel';

/**
 * MPI-35 phase 2's overrides on the shipped enhancer graph.
 *
 * The graph was authored for Character Sheet, and three of its baked values are
 * wrong for a general recipe. NONE OF THE THREE WORST DEFECTS ACTUALLY REACHES
 * THE FOUR ELIGIBLE MODELS TODAY — the newline strip welds a negative block into
 * the positive one but `krea-2` and `flux-2` are not `separate-field` recipes;
 * the `no ...` clause scrub deletes `minimax-h3`'s `overall_soundscape` and the
 * 512-token cap truncates only `minimax-h3`, and that model has no in-graph
 * encoder at all. They are set anyway so the backend does not become wrong the
 * moment a fifth model qualifies.
 *
 *   `Replace Text.replace`             '' -> '\n' makes node 1 an identity pass.
 *                                      Its baked find/replace strips EVERY
 *                                      newline from the model's output.
 *   `Input_Scrub_Negation.regex_pattern` `(?!)` can never match — a no-op, which
 *                                      is safer than deleting a node Character
 *                                      Sheet still needs.
 *   `Input_Tidy.regex_pattern`         narrowed to trailing whitespace; the
 *                                      baked `[\s,.]+$` also eats a closing full
 *                                      stop, right for a spliced phrase and
 *                                      wrong for prose.
 *   `Input_Text_Gen.max_length`        512 tokens (~345 words) truncates a
 *                                      long-budget recipe.
 */
export const COMFY_ENHANCE_OVERRIDES = Object.freeze({
    'Replace Text.replace': '\n',
    'Input_Scrub_Negation.regex_pattern': '(?!)',
    'Input_Tidy.regex_pattern': '\\s+$',
    'Input_Text_Gen.max_length': 2048,
});

/**
 * Build the `injectionParams` for one ComfyUI enhance.
 *
 * `Input_System_Prompt` is ChatML-wrapped because the graph concatenates it with
 * the user text and a trailing `<|im_end|>\n<|im_start|>assistant` — the baked
 * value ends on `<|im_start|>user` for exactly that reason, so a bare system
 * prompt would arrive with no role markers at all.
 *
 * KNOWN DIVERGENCE, recorded rather than silently "fixed": the shipped graph
 * leaves `use_default_template: True` on `TextGenerate` and hand-rolls its ChatML
 * anyway, so the recipe lands inside the default template's user turn. The Stage
 * 1 harness measures the opposite (template off, ChatML hand-rolled — see
 * `services/llmEngines.mjs`). Both are proven, on different instruments: the
 * graph's shape returned a correct French translation from an injected recipe on
 * 2026-08-19, and the harness's shape produced every recorded green. So a
 * `comfy`-backend enhance is NOT the configuration a recipe went green on, and
 * step 1d's measurement is where that gets settled — do not flip the widget on a
 * hunch.
 */
export function buildComfyInjectionParams(systemPrompt) {
    return {
        Input_System_Prompt: `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user`,
        ...COMFY_ENHANCE_OVERRIDES,
    };
}

/** With no pick, the engine the app already runs (Fabio, 2026-09-12). */
const DEFAULT_BACKEND = 'comfy';

/** With no describe-backend pick, use the engine already running. */
const DEFAULT_DESCRIBE_BACKEND = 'comfy';

/**
 * Which backend runs this enhance — the user's pick, or `comfy`.
 *
 * IT NO LONGER READS THE MODEL CARD AT ALL (MPI-728). Three rules that did have
 * gone, deliberately:
 *
 * 1. **The `-nsfw` route.** It derived "uncensored" from an id suffix, and Fabio
 *    listed what is actually uncensored in Vision — every SDXL model, both
 *    Chroma models, Wan 2.2, and anything at all with a downloaded LoRA. Only
 *    two carry the suffix, so the rule fired on the wrong models and quietly
 *    sent the rest to a hosted provider. A LoRA makes any model uncensored, so
 *    the property was never a fact about the card; the disposition belongs to
 *    the person, and the picker is where they state it.
 * 2. **The silent `comfy -> ollama` downgrade.** It existed because `comfy` used
 *    to mean the generation model's own encoder. The standalone graph loads its
 *    own CLIP and runs anywhere (proven 2026-09-12), so an explicit pick is now
 *    honoured — and Ollama may not even be installed to downgrade to.
 * 3. **Automatic.** With no pick it chose the cloud when a key was stored and
 *    Ollama otherwise. Fabio removed that entry (2026-09-12) to match the RunPod
 *    section, which has none, and made ComfyUI the default — so neither a stored
 *    key nor a running Ollama moves the answer any more.
 *
 * @param {object}  a
 * @param {string} [a.override]  the user's choice ('endpoint'|'ollama'|'comfy'); anything else is no choice.
 *                               'deepinfra' is also accepted for backward compatibility (migrated to 'endpoint').
 */
export function chooseBackend({ override } = {}) {
    // D2 (MPI-737): 'deepinfra' stored values map to 'endpoint' in code.
    const resolved = override === 'deepinfra' ? 'endpoint' : override;
    return resolved === 'comfy' || resolved === 'endpoint' || resolved === 'ollama' ? resolved : DEFAULT_BACKEND;
}

/** The user's enhancement backend: ComfyUI until they pick another.
 *  MPI-737: a stored 'deepinfra' value is migrated to 'endpoint' and persisted. */
export function backendPreference() {
    try {
        const stored = localStorage.getItem(BACKEND_PREF_KEY);
        // D2 migration: 'deepinfra' is now 'endpoint'; persist so Phase 3 settings see the right value.
        if (stored === 'deepinfra') {
            setBackendPreference('endpoint');
            return 'endpoint';
        }
        return chooseBackend({ override: stored });
    } catch {
        return DEFAULT_BACKEND;   // private window / storage disabled
    }
}

/** Which describe backend is valid (comfy | endpoint). */
function chooseDescribeBackend({ override } = {}) {
    return override === 'comfy' || override === 'endpoint' ? override : DEFAULT_DESCRIBE_BACKEND;
}

/** The user's describe backend: ComfyUI until they pick another. */
export function describeBackendPreference() {
    try {
        return chooseDescribeBackend({ override: localStorage.getItem(DESCRIBE_BACKEND_PREF_KEY) });
    } catch {
        return DEFAULT_DESCRIBE_BACKEND;
    }
}

/** Pin a describe backend, or pass falsy to go back to the default. */
export function setDescribeBackendPreference(backend) {
    try {
        if (backend) localStorage.setItem(DESCRIBE_BACKEND_PREF_KEY, backend);
        else localStorage.removeItem(DESCRIBE_BACKEND_PREF_KEY);
    } catch { /* storage disabled */ }
}

/** The user's describe model, or undefined for the endpoint default. */
export function describeModelPreference() {
    try {
        return localStorage.getItem(DESCRIBE_MODEL_PREF_KEY) || undefined;
    } catch {
        return undefined;
    }
}

/** Pin a describe model id, or pass falsy to use the endpoint default. */
export function setDescribeModelPreference(id) {
    try {
        if (id) localStorage.setItem(DESCRIBE_MODEL_PREF_KEY, id);
        else localStorage.removeItem(DESCRIBE_MODEL_PREF_KEY);
    } catch { /* storage disabled */ }
}

/** Pin a backend, or pass a falsy value to go back to the default. */
export function setBackendPreference(backend) {
    try {
        if (backend) localStorage.setItem(BACKEND_PREF_KEY, backend);
        else localStorage.removeItem(BACKEND_PREF_KEY);
    } catch { /* storage disabled — the choice just does not persist */ }
}

/**
 * The user's enhancer LLM, or undefined for the registry default.
 *
 * THIS IS WHAT REPLACED `chooseEngineModelId()` — an inference became a
 * preference. It is NOT validated against the chosen backend here: coverage is
 * asymmetric on purpose (abliterated builds are local-only), and `routes/llm.js`
 * already answers a mismatch by NAME
 * (`"<model>" has no <backend> variant.`). Swallowing it here would turn the
 * user's explicit pick into a silent fall-back to something else — the exact
 * defect this card deleted.
 *
 * MPI-737: Remote has its own pref (`endpointModelPreference`). This one is read
 * on the endpoint branch only as a pre-MPI-737 DeepInfra pick, mapped to its
 * `deepInfraId` by `_resolveEndpointModelId`, and only on the DeepInfra connection.
 */
export function enhancerModelPreference() {
    try {
        return localStorage.getItem(ENHANCER_MODEL_PREF_KEY) || undefined;
    } catch {
        return undefined;   // private window / storage disabled
    }
}

/**
 * Resolve a stored MODEL_REGISTRY id to the raw endpoint model id needed by the
 * endpoint branch of `/llm/enhance`.
 *
 * The mapping comes from GET /llm/models `deepInfraId`; a registry entry with no
 * DeepInfra variant is returned unchanged, and the endpoint names the bad id.
 * A value that is already a raw endpoint id (contains '/' or ':') is passed as-is.
 *
 * @param {string|undefined} modelId  the stored pref value
 * @returns {Promise<string|undefined>}
 */
async function _resolveEndpointModelId(modelId) {
    if (!modelId) return undefined;
    // Already a raw endpoint id (e.g. 'google/gemma-4-26B-A4B-it').
    if (modelId.includes('/') || modelId.includes(':')) return modelId;
    try {
        const models = await enhancerModels();
        const entry = models.find((m) => m.id === modelId);
        return entry?.deepInfraId || modelId;
    } catch {
        return modelId;
    }
}

/** Pin an enhancer model by registry id, or pass a falsy value for the default. */
export function setEnhancerModelPreference(id) {
    try {
        if (id) localStorage.setItem(ENHANCER_MODEL_PREF_KEY, id);
        else localStorage.removeItem(ENHANCER_MODEL_PREF_KEY);
    } catch { /* storage disabled — the choice just does not persist */ }
}

/** The user's Remote enhancer model (a raw endpoint id), or undefined. */
export function endpointModelPreference() {
    try {
        return localStorage.getItem(ENDPOINT_MODEL_PREF_KEY) || undefined;
    } catch {
        return undefined;
    }
}

/** Pin a Remote enhancer model, or pass falsy for the connection's recommended one. */
export function setEndpointModelPreference(id) {
    try {
        if (id) localStorage.setItem(ENDPOINT_MODEL_PREF_KEY, id);
        else localStorage.removeItem(ENDPOINT_MODEL_PREF_KEY);
    } catch { /* storage disabled */ }
}

/**
 * The model a Remote enhance sends, for BOTH `enhance()` and `enhanceFlow()`. The Remote
 * pick first; else a pre-MPI-737 DeepInfra pick (a registry id) mapped to its
 * `deepInfraId`, which means something only on the DeepInfra connection. Anywhere else,
 * undefined -> the server's recommended model for the connection.
 */
async function _endpointEnhanceModel(profileId) {
    return endpointModelPreference()
        ?? (profileId === 'deepinfra' ? await _resolveEndpointModelId(enhancerModelPreference()) : undefined);
}

/**
 * Resolve a caller's recipe key exactly as the broker responder used to: exact
 * id, then family alias, then the pinned fallback.
 *
 * The fallback is DESIGNED TO ANSWER, which is why it hides a miss so well — two
 * MiniMax-H3 VIDEO cards were enhanced by the `chroma` IMAGE recipe for a week
 * and nothing failed loudly. `fellBack` is the honest signal; surface it.
 */
export function resolveRecipeId(key) {
    const matched = key ? resolveRecipe(key) : undefined;
    return matched
        ? { recipeId: matched.modelId, fellBack: false }
        : { recipeId: FALLBACK_RECIPE_ID, fellBack: true };
}

/**
 * The mode to run. `t2v` unless the caller names one the recipe declares; a
 * recipe that has no `t2v` (none today, but the union is open) falls to its
 * first declared mode rather than failing with no system prompt.
 */
export function resolveMode(recipeId, asked) {
    const modes = getRecipe(recipeId)?.modes || {};
    if (asked && modes[asked]) return asked;
    if (modes[DEFAULT_MODE]) return DEFAULT_MODE;
    return Object.keys(modes)[0];
}

/**
 * Split a `separate-field` recipe's labelled reply into its two channels.
 *
 * THE FOUR `separate-field` RECIPES DO NOT AGREE ON A FORMAT, which is why this
 * anchors on the NEGATIVE label alone and treats everything before it as the
 * positive half. Measured across the registry rather than assumed from `sdxl`:
 *
 *   `sdxl`      `POSITIVE PROMPT: …\nNEGATIVE PROMPT: …` — both labelled, and its
 *               system prompt states the contract literally ("your reply starts
 *               with POSITIVE PROMPT: and ends at the end of the NEGATIVE PROMPT
 *               line").
 *   `kling-3.0` unlabelled prose, then a trailing `Negative Prompt:` block — a
 *               DIFFERENT label in a DIFFERENT case, and no positive label at
 *               all. A splitter written to `sdxl`'s shape reads this as prose and
 *               welds the negative into the positive, silently.
 *   `pony`,     declare the field and deliberately emit NO negative block: the
 *   `illustrious` author's baseline is a constant ladder, and a constant needs no
 *               LLM to write it. They parse to `null` here and keep their raw
 *               text, which is correct, not a miss.
 *
 * NOTHING ANYWHERE SPLIT IT UNTIL NOW and the whole blob landed in the positive
 * field. That was not a Vision bug: Cubric-Prompt's broker responder had no
 * splitter either (grepped across `src/main/`), so it returned the labelled text
 * as `prompt` and left `negativePrompt` undefined — identical behaviour on both
 * sides of the retirement, which is why step 1b recorded it as PARITY, not a
 * regression, and left the fix here where the user can SEE which channel each
 * half lands in before approving it. `pony.recipe.js:216-227` reached the same
 * conclusion from the recipe side while deciding to emit no negative block at all.
 *
 * Returns `null` when the reply carries no usable positive half — a recipe that
 * ignored its own format, or a truncated answer. The caller then keeps the raw
 * text, so a parse miss degrades to exactly what shipped rather than to an empty
 * box.
 *
 * @param {string} text
 * @returns {{positive: string, negative: string}|null}
 */
export function splitLabelledPrompt(text) {
    // The NEGATIVE label is the only thing all the emitting recipes share, so it is
    // the anchor; the positive label is stripped if it happens to be there. Lazy
    // match, so a recipe that names the block twice cuts at the FIRST one.
    const m = /^([\s\S]*?)[\r\n]*[ \t]*NEGATIVE[ \t]+PROMPT[ \t]*:[ \t]*([\s\S]*)$/i
        .exec(String(text || ''));
    if (!m) return null;
    const positive = m[1].replace(/^[\s]*POSITIVE[ \t]+PROMPT[ \t]*:[ \t]*/i, '').trim();
    return positive ? { positive, negative: m[2].trim() } : null;
}

/**
 * The enhancer LLM catalogue, for the settings picker (MPI-728).
 *
 * `MODEL_REGISTRY` lives in `services/llmEngines.mjs` — server-side ESM the
 * renderer cannot import — so it arrives over `/llm/models`. Each entry reports
 * per-backend coverage (`ollama` / `deepinfra`) rather than a single "available",
 * because coverage is asymmetric on purpose and the picker filters by the backend
 * the user chose. An unreachable server answers `[]`, which the picker renders as
 * "the default" rather than as an error — nothing is broken, there is simply
 * nothing to choose between yet. `isDefault` marks the model the app runs when
 * the user has picked none; `deepInfraId` maps a pre-MPI-737 pick for Remote.
 */
export async function enhancerModels() {
    try {
        const res = await fetch('/llm/models');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.json();
        return Array.isArray(body?.models) ? body.models : [];
    } catch {
        return [];
    }
}

/**
 * Ollama's state for the Language Models row (MPI-728 phase 3): whether it is up,
 * which registry models are on disk, and any install or download in flight. `null`
 * when the app server itself did not answer.
 */
export async function ollamaState() {
    try {
        const res = await fetch('/llm/ollama');
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}

/** POST to an Ollama route; an unreachable server resolves `{ ok: false, error }`, never rejects. */
async function postOllama(url, body = {}) {
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return await res.json();
    } catch (err) {
        return { ok: false, error: (err && err.message) || 'The app server did not answer.' };
    }
}

/** Start Ollama when it is installed and stopped. Never installs anything. */
export function startOllama() {
    return postOllama('/llm/ollama/start');
}

/** Install Ollama silently (Windows, winget). `ok: false` means open the download page instead. */
export function installOllama() {
    return postOllama('/llm/ollama/install');
}

/** Download one registry model into the user's own Ollama. Progress arrives on `ollamaState()`. */
export function pullOllamaModel(modelId) {
    return postOllama('/llm/ollama/pull', { modelId });
}

/**
 * The enhancer graph's own text pipeline, read off the graph (MPI-677, 2026-09-13).
 *
 * A server backend is only an LLM call; the ComfyUI graph is a PIPELINE. After
 * `TextGenerate` it runs `Replace Text` (newlines out), `Input_Scrub_Negation` ("no ..."
 * clauses out) and `Input_Tidy` (a trailing comma or full stop out), and Character
 * Sheet's recipe lives in the graph's `Input_System_Prompt` node, not in its
 * declaration. A flow that follows the user's pick to Remote or Ollama has to carry
 * all of that with it, or it silently changes the instrument it was tuned on.
 *
 * READ FROM THE GRAPH, NOT COPIED: the baked values are the defaults, and a caller's
 * `injectionParams` override them under the same `Title.widget` keys it already sends
 * to ComfyUI. One source, so tuning the graph on the bench moves both backends.
 *
 * @param {object} graph  the API-format enhancer workflow
 * @returns {object} `Title.widget`-keyed defaults
 */
export function enhancerGraphDefaults(graph) {
    const inputs = (title) => Object.values(graph || {})
        .find((n) => (n?._meta?.title || '').toLowerCase() === title.toLowerCase())?.inputs || {};
    return {
        Input_System_Prompt: inputs('Input_System_Prompt').value,
        'Replace Text.find': inputs('Replace Text').find,
        'Replace Text.replace': inputs('Replace Text').replace,
        'Input_Scrub_Negation.regex_pattern': inputs('Input_Scrub_Negation').regex_pattern,
        'Input_Tidy.regex_pattern': inputs('Input_Tidy').regex_pattern,
        'Input_Text_Gen.max_length': inputs('Input_Text_Gen').max_length,
    };
}

/**
 * The graph's three text nodes, in graph order, on text a server backend returned.
 *
 * `StringReplace` is Python's `str.replace` (every occurrence). `RegexReplace` defaults
 * `case_insensitive=True` and `count=0`, hence `gi` — without the `i`, "No scars"
 * survives a scrub the graph performs. The patterns carry no backreferences, so Python
 * and JS agree on every construct they use.
 *
 * @param {string} text
 * @param {object} params  `enhancerGraphDefaults` with the caller's overrides spread over it
 */
export function postProcessLikeGraph(text, params) {
    let out = String(text || '');
    const find = params['Replace Text.find'];
    if (find) out = out.split(find).join(params['Replace Text.replace'] ?? '');
    for (const key of ['Input_Scrub_Negation.regex_pattern', 'Input_Tidy.regex_pattern']) {
        if (params[key]) out = out.replace(new RegExp(params[key], 'gi'), '');
    }
    return out.trim();
}

/** A graph-shaped system prompt (`<|im_start|>system … <|im_start|>user`) as the bare text a chat API takes. */
export function unwrapChatMl(system) {
    return String(system || '')
        .replace(/^\s*<\|im_start\|>system\s*/, '')
        .replace(/\s*<\|im_end\|>\s*<\|im_start\|>user\s*$/, '')
        .trim();
}

/**
 * CLIP types whose encoder the enhancer graph BORROWS from the generation model (Fabio,
 * 2026-09-13). Both are Qwen3 LMs carrying `BaseGenerate` in ComfyUI
 * (`comfy/text_encoders/llama.py`), so `TextGenerate` runs on them, and a generation on
 * that model loads the same weight anyway — same file AND same type is the cache key
 * `models.js` measured. `krea2` is the graph's own encoder already; `flux2` is Klein.
 *
 * ponytail: an allowlist, not a probe. Boogu (Qwen3-VL 8B) and H3 (Qwen3-VL 32B) would
 * generate too — Boogu is edit-only and edits never enhance, and a 32B rewrite wants a
 * speed check first. T5/umT5 must never join: `TextGenerate` raises on them. LTX's
 * Gemma sits behind a `DualCLIPLoader`, which the single-loader graph cannot take.
 */
const BORROWABLE_CLIP_TYPES = new Set(['krea2', 'flux2']);

/**
 * The enhancer `Load CLIP` params that borrow a generation workflow's encoder, or `{}`
 * to keep the graph's own.
 *
 * @param {object} workflow  the generation model's API-format workflow
 */
export function enhancerClipParams(workflow) {
    const loader = Object.values(workflow || {}).find((n) => n?.class_type === 'CLIPLoader');
    const { clip_name: clipName, type } = loader?.inputs || {};
    return typeof clipName === 'string' && BORROWABLE_CLIP_TYPES.has(type)
        ? { 'Load CLIP.clip_name': clipName, 'Load CLIP.type': type }
        : {};
}

/** The generation model's encoder as enhancer params. `{}` on anything unreadable keeps the graph's own 4B. */
async function borrowedClipParams(model) {
    // ponytail: the card's first workflow. Every borrowable model runs all its ops from
    // ONE file; a model whose variants swapped encoders would need the resolved file.
    const file = Object.values(model?.workflows || {}).find((f) => typeof f === 'string');
    if (!file) return {};
    try {
        const res = await fetch(`/comfy_workflows/${file}`);
        return res.ok ? enhancerClipParams(await res.json()) : {};
    } catch (err) {
        clientLogger.warn('prompt', `[llmService] could not read ${file}, enhancing on the graph's own CLIP: ${err.message}`);
        return {};
    }
}

/** The shipped enhancer graph, fetched once. A failed fetch is not cached. */
let _enhancerGraph;
function enhancerGraph() {
    _enhancerGraph ??= (async () => {
        const { getUniversalWorkflow } = await import('../data/modelRegistry.js');
        const file = getUniversalWorkflow(COMFY_ENHANCE_OP);
        const res = await fetch(`/comfy_workflows/${file}`);
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${file}`);
        return res.json();
    })().catch((err) => {
        _enhancerGraph = undefined;
        throw err;
    });
    return _enhancerGraph;
}

/**
 * D1 (MPI-737): a Remote failure the user fixes in settings (no key, no connection, a model
 * that rejects images, the endpoint erroring) says where. BAD_REQUEST / BAD_IMAGE are not
 * settings problems; the route's own BAD_REQUEST copy already names the setting when one applies.
 * @param {string|undefined} code  the connection routes' error code
 * @param {string} message
 * @returns {string}
 */
export function withRemoteSettingsHint(code, message) {
    if (!code || code === 'BAD_REQUEST' || code === 'BAD_IMAGE') return message;
    return `${message} Check Settings > Remote > Language Models.`;
}

/**
 * One completion through the server (endpoint or Ollama). Never rejects: an unreachable server resolves `{ ok: false }`.
 *
 * MPI-737: on the endpoint branch, `profileId` (from `Storage.getLlmConnection()`)
 * is sent so the route can resolve the connection without the renderer touching the key.
 */
async function runServerBackend({ prompt, system, backend, modelId, maxTokens, profileId }) {
    try {
        const res = await fetch('/llm/enhance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt, system, backend, modelId, maxTokens,
                ...(backend === 'endpoint' && profileId ? { profileId } : {}),
            }),
        });
        const body = await res.json();
        // The endpoint branch answers with the connection routes' `{ code, message }`
        // envelope; every enhance caller shows `error` as text.
        return body.ok || typeof body.error !== 'object' || !body.error
            ? body
            : { ...body, error: withRemoteSettingsHint(body.error.code, body.error.message), errorCode: body.error.code };
    } catch (err) {
        return { ok: false, error: (err && err.message) || 'The app server did not answer.' };
    }
}

/**
 * ONE COMPLETION THROUGH COMFYUI — and the ONLY dispatch to that graph in the app.
 *
 * Every ComfyUI enhance goes through here: the prompt box's control, Character Sheet's
 * Enhance button and Music Maker's automatic pre-Generate rewrite. Before MPI-677 step
 * 1b the flows had their own copy of this call in `MpiBaseFlow._runEnhance`, which is
 * how the seed rule and the `onText`-not-`onComplete` rule came to be written twice.
 * `commandRegistry`'s own comment has called the `promptEnhance` op reusable since
 * MPI-504; this is the single route that makes it so.
 *
 * `system` is OPTIONAL, and its absence is meaningful rather than a mistake: Character
 * Sheet's recipe is baked into the graph's `Input_System_Prompt` node, so a caller with
 * nothing to say leaves the baked value standing.
 *
 * FLOWS REACH THIS THROUGH `enhanceFlow`, which honours the user's Language Models pick
 * and lands here only when that pick is ComfyUI (Fabio, 2026-09-13). They used to call
 * it directly and stay on ComfyUI whatever was picked, because the graph is a PIPELINE —
 * `Replace Text` strips newlines, `Input_Scrub_Negation` deletes "no ..." clauses,
 * `Input_Tidy` eats the trailing full stop — and both flows were tuned against it.
 * `enhanceFlow` carries that pipeline to the server backends instead of dropping it.
 *
 * @param {object}  a
 * @param {string}  a.prompt              the text to rewrite
 * @param {string} [a.system]             a system prompt to inject; omit to keep the graph's
 * @param {object} [a.injectionParams]    extra params by node title (the caller's recipe knobs)
 * @param {string} [a.modelId]            a model to pin the job to; null lets the queue pick
 * @returns {Promise<{ok:boolean, text?:string, backend?:string, model?:string, error?:string}>}
 *          Never rejects — an error and a cancel both resolve `{ ok: false }`.
 */
export async function runComfyEnhance({ prompt, system, injectionParams, modelId = null } = {}) {
    const { getCommand } = await import('../data/commandRegistry.js');
    // The op is a separate registration from any flow's own; a build shipped without it
    // would otherwise fail deep inside the queue.
    if (!getCommand(COMFY_ENHANCE_OP)) {
        return { ok: false, error: 'The prompt enhancer is not available in this build.' };
    }
    const { enqueueGeneration } = await import('./generationService.js');
    return new Promise((resolve) => {
        enqueueGeneration(
            {
                operation: COMFY_ENHANCE_OP,
                model: { id: modelId, mediaType: 'image' },
                positive: prompt,
                negative: '',
                injectionParams: {
                    ...(system ? { Input_System_Prompt: system } : {}),
                    ...(injectionParams || {}),
                    // Driven, never a user field, and never stored: a fixed seed returns
                    // the same phrase on every press and the loop is Enhance -> edit ->
                    // Enhance. Spread LAST so no caller can reach it.
                    Input_Seed: Math.floor(Math.random() * 2 ** 31),
                },
            },
            {
                // A text op never fires onComplete — GenerationCallbacks.onText.
                onText: (text) => resolve({
                    ok: true,
                    text: String(text || '').trim(),
                    backend: 'comfy',
                    // The borrowed encoder when there is one, so the provenance line
                    // names the weight that actually wrote the prompt.
                    model: String(injectionParams?.['Load CLIP.clip_name'] || 'qwen3vl_4b_abliterated')
                        .replace(/\.safetensors$/, ''),
                }),
                onError: (err) => resolve({ ok: false, error: (err && err.message) || 'Enhance failed.' }),
                // `cancelled` so a caller can tell a user's own Stop from a failure and
                // stay quiet about it. The flows were silent on cancel before this call
                // was shared, and a toast for something you just pressed Stop on is noise.
                onCancel: () => resolve({ ok: false, cancelled: true, error: 'Enhance cancelled.' }),
            },
            { scope: 'gallery' },
        );
    });
}

/**
 * A FLOW's enhance, on the backend the user picked in Language Models (MPI-677, 2026-09-13).
 *
 * Until this, every flow Enhance ran the ComfyUI graph whatever the user chose, because the
 * graph is a pipeline and the flows were tuned on it. Fabio: flows follow the pick. So the
 * pick is honoured and the pipeline travels with it:
 *
 *   - `comfy` — unchanged, byte for byte: `runComfyEnhance` with the declaration's params.
 *   - `endpoint` / `ollama` — the graph's baked values with the declaration's params over
 *     them: the system prompt unwrapped from ChatML, `Input_Text_Gen.max_length` as the
 *     token cap (Music Maker's guard against a measured 1400-token repetition loop), and
 *     the graph's three text nodes run on the reply by `postProcessLikeGraph`.
 *
 * NOT carried, deliberately: the graph's sampler (temperature 0.5, repetition 1.15,
 * presence 0.6). It was tuned against a 4B; the server models are larger and keep their
 * provider's defaults. If Music Maker loops on one, carry the penalties then.
 *
 * Same arguments and result shape as `runComfyEnhance`, and it never rejects.
 *
 * @param {object}  a
 * @param {string}  a.prompt
 * @param {object} [a.injectionParams]  the declaration's own params, by node title
 * @param {string} [a.modelId]          ComfyUI queue pin; the server backends ignore it
 * @returns {Promise<{ok:boolean, text?:string, backend?:string, model?:string, error?:string, cancelled?:boolean}>}
 */
export async function enhanceFlow({ prompt, injectionParams, modelId = null } = {}) {
    const backend = backendPreference();
    if (backend === 'comfy') return runComfyEnhance({ prompt, injectionParams, modelId });

    let params;
    try {
        params = { ...enhancerGraphDefaults(await enhancerGraph()), ...(injectionParams || {}) };
    } catch (err) {
        return { ok: false, error: `The prompt enhancer could not load its recipe: ${err.message}` };
    }
    const { profileId } = Storage.getLlmConnection();
    const result = await runServerBackend({
        prompt,
        system: unwrapChatMl(params.Input_System_Prompt),
        backend,
        modelId: backend === 'endpoint' ? await _endpointEnhanceModel(profileId) : enhancerModelPreference(),
        maxTokens: params['Input_Text_Gen.max_length'],
        ...(backend === 'endpoint' ? { profileId } : {}),
    });
    return result.ok ? { ...result, text: postProcessLikeGraph(result.text, params) } : result;
}

/**
 * Enhance one prompt.
 *
 * @param {object}  a
 * @param {string}  a.prompt        the user's short prompt
 * @param {object}  a.model         the model card being generated with
 * @param {string} [a.recipeKey]    defaults to `model.enhanceRecipe ?? model.type`
 * @param {string} [a.mode]         recipe mode; defaults to `t2v`
 * @param {string} [a.backend]      explicit override; defaults to the preference, then ComfyUI
 * @returns {Promise<{ok:boolean, text?:string, negativeText?:string, backend?:string,
 *                    model?:string, recipeId?:string, fellBack?:boolean, note?:string,
 *                    error?:string}>}
 *          `negativeText` is present ONLY for a `separate-field` recipe whose reply
 *          parsed. `text` is then the positive half alone — the caller must not
 *          re-split it.
 */
export async function enhance({ prompt, model, recipeKey, mode, backend } = {}) {
    const idea = String(prompt || '').trim();
    if (!idea) return { ok: false, error: 'Write a prompt first, then Enhance.' };

    const { recipeId, fellBack } = resolveRecipeId(recipeKey ?? model?.enhanceRecipe ?? model?.type);
    const recipe = getRecipe(recipeId);
    const resolvedMode = resolveMode(recipeId, mode);
    const modeRecipe = recipe?.modes?.[resolvedMode];
    if (!modeRecipe) {
        return { ok: false, error: `No enhancer recipe for "${recipeId}" (mode "${resolvedMode}").` };
    }
    // `selectSystemPrompt` would re-look-up the same recipe; compose from the
    // mode we already resolved so an i2v/r2v caller cannot silently get t2v.
    // Style defaults to `general` — v1.0 ships one general recipe per model and
    // the register axis is v1.1 (MPI-19/MPI-24); a recipe without
    // `styleVocabulary` is byte-identical whatever style is asked for.
    const system = composeSystemPrompt(modeRecipe);

    const chosen = chooseBackend({ override: backend ?? backendPreference() });

    const { profileId } = Storage.getLlmConnection();
    const resolvedModelId = chosen === 'endpoint' ? await _endpointEnhanceModel(profileId) : enhancerModelPreference();

    const result = chosen === 'comfy'
        ? await runComfyEnhance({
            prompt: idea,
            injectionParams: { ...buildComfyInjectionParams(system), ...(await borrowedClipParams(model)) },
        })
        : await runServerBackend({
            prompt: idea,
            system,
            backend: chosen,
            modelId: resolvedModelId,
            ...(chosen === 'endpoint' ? { profileId } : {}),
        });

    if (!result.ok) {
        clientLogger.warn('prompt', `[llmService] enhance failed on ${chosen}: ${result.error}`);
        return result;
    }
    // Only a recipe that DECLARES two channels gets its reply split. A prose recipe
    // that happens to write the words "negative prompt" is not offering a second
    // field, and cutting its text there would silently delete half the prompt.
    const split = modeRecipe.negativeHandling === 'separate-field'
        ? splitLabelledPrompt(result.text)
        : null;

    return {
        ...result,
        ...(split ? { text: split.positive, negativeText: split.negative } : {}),
        recipeId,
        fellBack,
        // Honest signal, surfaced verbatim: the requested target had no recipe
        // and a default ran. Not an error — the user pressed a button that exists.
        note: fellBack
            ? `No enhancer recipe for "${recipeKey ?? model?.enhanceRecipe ?? model?.type ?? '(none)'}" — used "${recipeId}".`
            : undefined,
    };
}

/**
 * Build the `injectionParams` for a ComfyUI image description with an optional question.
 *
 * `Input_Describe_Prompt` (node 38) feeds `TextGenerate` DIRECTLY — nothing is
 * concatenated after it, unlike the enhancer's `Input_System_Prompt` — and a
 * prompt starting with `<|im_start|>` skips the tokenizer's template, so the
 * image reaches the model ONLY where the string carries `<|image_pad|>`. The
 * value is therefore the WHOLE turn, the shape of the baked default: the image,
 * the question as the user text (as `POST /llm/describe` sends it), and the
 * assistant header. The old `system … <|im_start|>user` stub carried no image
 * and no turn to answer, and Qwen3-VL answered with nothing (MPI-774 Phase 4).
 * No question → empty params, and the graph uses its own baked caption instruction.
 *
 * @param {string|undefined} question
 * @returns {object}  injectionParams suitable for `enqueueGeneration`
 */
export function buildDescribeInjectionParams(question) {
    if (!question) return {};
    return {
        Input_Describe_Prompt: `<|im_start|>user\n<|vision_start|><|image_pad|><|vision_end|>${question}<|im_end|>\n<|im_start|>assistant\n`,
    };
}

/**
 * THE ONE DESCRIBE SWITCH POINT (MPI-737).
 *
 * Describes an image through either the ComfyUI queue or the endpoint, depending
 * on the user's `cubric.llm.describeBackend` preference. The caller never
 * enqueues directly; it calls this and handles the result.
 *
 * DECISION D1 (Fabio, 2026-09-16): on failure, say so plainly — NEVER fall back
 * silently to ComfyUI or any other backend. Each caller surfaces the error:
 * the right-click path shows a toast; the agent path returns the error text so
 * the agent can suggest switching.
 *
 *   - comfy: plugin check → `enqueueGeneration('imageDescribe')` with the
 *     ChatML-wrapped question in `Input_Describe_Prompt` (node 38). Text lands
 *     in the prompt box via `workspace:inject-prompts` (the caller emits this on
 *     ok). Waits in the queue behind any running generation.
 *   - endpoint: `POST /llm/describe` with `profileId` from
 *     `Storage.getLlmConnection()` and the describe model pref. NOT queued —
 *     never waits behind a generation.
 *
 * @param {object}  a
 * @param {string}  a.imagePath   URL or absolute filesystem path of the image.
 *                                ComfyUI takes URLs; the server route takes paths
 *                                (it can also decode a /project-file?path= URL).
 * @param {string} [a.question]   optional question/instruction to replace the default caption prompt
 * @param {object} [a.crop]       `{x,y,width,height}` crop hint for the endpoint route
 * @param {string} [a.scope]      generation scope ('gallery' | 'groupHistory')
 * @param {object} [a.group]      owning group, for the ComfyUI queue context
 * @returns {Promise<{ok:boolean, via:'comfy'|'endpoint', text?:string, model?:string, errorCode?:string, error?:string, cancelled?:boolean}>}
 *          Never rejects. On failure: `error` is a human-readable message. `via` names the
 *          backend that ran, so a caller can point at the right place to fix it.
 */
export async function describeImage({ imagePath, question, crop, scope, group } = {}) {
    const backend = describeBackendPreference();

    if (backend === 'endpoint') {
        const { profileId } = Storage.getLlmConnection();
        const modelId = describeModelPreference();
        try {
            const res = await fetch('/llm/describe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profileId,
                    ...(modelId ? { modelId } : {}),
                    imagePath,
                    ...(question ? { question } : {}),
                    ...(crop ? { crop } : {}),
                }),
            });
            const body = await res.json();
            if (!body.ok) {
                const msg = (typeof body.error === 'object' ? body.error?.message : body.error)
                    || 'The description failed.';
                const code = (typeof body.error === 'object' ? body.error?.code : undefined);
                return { ok: false, via: 'endpoint', ...(code ? { errorCode: code } : {}), error: msg };
            }
            return { ...body, via: 'endpoint' };
        } catch (err) {
            return { ok: false, via: 'endpoint', error: (err && err.message) || 'The app server did not answer.' };
        }
    }

    // comfy branch
    const { pluginAvailability, getPlugin } = await import('../data/pluginsRegistry.js');
    const PLUGIN_ID = 'image-describer';
    if (!pluginAvailability(PLUGIN_ID).installed) {
        const title = getPlugin(PLUGIN_ID)?.title || 'Image Describer';
        return {
            ok: false,
            via: 'comfy',
            errorCode: 'DESCRIBER_MISSING',
            error: `${title} is not installed — add it from the Model Library (Plugins).`,
        };
    }

    const { enqueueGeneration } = await import('./generationService.js');
    const injectionParams = buildDescribeInjectionParams(question);
    const queueOpts = group
        ? { existingGroup: group, scope: scope || 'groupHistory', groupId: group.id }
        : { scope: scope || 'gallery' };

    return new Promise((resolve) => {
        const queued = enqueueGeneration(
            {
                operation: 'imageDescribe',
                model: { id: null, mediaType: 'image' },
                positive: '',
                negative: '',
                mediaItems: [{ url: imagePath, mediaType: 'image', source: scope || 'gallery' }],
                injectionParams,
            },
            {
                // `model` names the local describer the way the endpoint route names its own.
                onText: (text) => resolve({ ok: true, via: 'comfy', text: String(text || '').trim(),
                    model: `ComfyUI ${getPlugin(PLUGIN_ID)?.requiredDeps?.[0] || PLUGIN_ID}` }),
                onError: (err) => resolve({ ok: false, via: 'comfy', error: (err && err.message) || 'The description failed.' }),
                onCancel: () => resolve({ ok: false, via: 'comfy', cancelled: true, error: 'The description was cancelled.' }),
            },
            queueOpts,
        );
        if (!queued) {
            resolve({ ok: false, via: 'comfy', errorCode: 'REJECTED', error: 'Vision rejected the describe job before it entered the queue.' });
        }
    });
}
