/**
 * retiredFlows.js — Flows that became prompt-box MODELS (MPI-1012), and the one table
 * that keeps everything written against their old ids working.
 *
 * "Sound & Music" (Stable Audio 3) and "Text to Speech" (Chatterbox) took no picture and
 * had two controls and a prompt, so Fabio moved them into the prompt box (2026-10-02).
 * Their FlowDefs are gone, but the old ids live on in places the app does not own:
 * card sidecars (`flowId` + `flowInputs`, read by Reuse), saved routines (`{ flowId,
 * fields }` steps), the agent's notes and any outside agent's habits. Each of those
 * resolves through THIS table rather than failing `UNKNOWN_FLOW`:
 *   - Reuse on an old card opens the prompt box on the model and op, with its settings
 *     (promptReuse.js);
 *   - a routine step is validated and run as the model step it now is (routineModel.js);
 *   - `/connector/generate` and `/connector/quote` with the old flowId run the model
 *     (routes/connector.js), and an open-flow names the model it moved to.
 *
 * Pure (no imports): routineModel.js and routes/connector.js load it outside the renderer,
 * and flowsRegistry.js cannot be, it reads state.js.
 *
 * `fields` maps each old Flow field id to the model's named param (agent, routine,
 * connector) and its prompt-box control (Reuse). The values carry over unchanged: the
 * controls emit the very node titles the fields did.
 */

export const RETIRED_FLOWS = Object.freeze({
    'sound-and-music': Object.freeze({
        modelId: 'stable-audio-3',
        operation: 't2a',
        title: 'Sound & Music',
        modelName: 'Stable Audio 3',
        fields: Object.freeze({
            Input_Category: Object.freeze({ param: 'category', control: 'audioCategory' }),
            Input_Duration: Object.freeze({ param: 'duration', control: 'audioLength' }),
        }),
    }),
    'chatter-box': Object.freeze({
        modelId: 'chatterbox',
        operation: 'tts',
        title: 'Text to Speech',
        modelName: 'Chatterbox',
        fields: Object.freeze({
            'Input_Language.language': Object.freeze({ param: 'language', control: 'ttsLanguage' }),
        }),
    }),
});

/** @returns {object|null} the retired Flow's entry, or null for any live or unknown id */
export function retiredFlow(flowId) {
    return Object.hasOwn(RETIRED_FLOWS, String(flowId)) ? RETIRED_FLOWS[flowId] : null;
}

/**
 * A `{ flowId, fields, ... }` submit or routine step as the model submit it now is, or
 * null when `flowId` is not a retired Flow. The Flow's `positive` field becomes the
 * prompt; every other field becomes its named param. The rest of the body (media,
 * folderPath, cardName, ...) passes through, and the voice slot keeps its `audio1` role.
 */
export function retiredFlowAsModel(input) {
    const r = retiredFlow(input?.flowId);
    if (!r) return null;
    const { flowId: _old, fields = {}, ...rest } = input;
    const out = { ...rest, modelId: r.modelId, operation: r.operation };
    if (out.positive === undefined && typeof fields.positive === 'string') out.positive = fields.positive;
    for (const [id, f] of Object.entries(r.fields)) {
        if (fields[id] !== undefined && out[f.param] === undefined) out[f.param] = fields[id];
    }
    return out;
}

/**
 * An old card's saved field values as the model's prompt-box control values, for Reuse
 * (perModel controls, so they land in the model's own bucket). Reads `flowInputs` first
 * and the run's injectionParams second; a field the card never recorded is left out, so
 * Reuse keeps the current value rather than inventing one.
 */
export function retiredFlowControls(flowId, flowInputs = {}, injectionParams = {}) {
    const r = retiredFlow(flowId);
    if (!r) return {};
    const out = {};
    for (const [id, f] of Object.entries(r.fields)) {
        const v = flowInputs?.[id] ?? injectionParams?.[id];
        if (v !== undefined && v !== null && v !== '') out[f.control] = v;
    }
    return out;
}

/** The refusal an old id gets where it cannot be rerouted (opening a Flow). */
export function retiredFlowMessage(flowId) {
    const r = retiredFlow(flowId);
    return r
        ? `"${flowId}" is no longer a Flow: ${r.title} is the ${r.modelName} model in the prompt box now. Generate with modelId "${r.modelId}" and operation "${r.operation}".`
        : null;
}
