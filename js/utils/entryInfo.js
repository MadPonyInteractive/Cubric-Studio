// @ts-check
/**
 * entryInfo — what the card-info flyout shows for one history entry (MPI-1162).
 *
 * Pure data: a History row or gallery card (MPI-1261) hands an item in and mounts the
 * result in `MpiEntryInfo`. Every value is read off the in-memory HistoryItem, which is
 * already hydrated from its sidecar, so no fetch happens on hover.
 *
 * No seed, by decision: nothing in the app takes one back in, so it is noise here.
 * No resolution either (Fabio, 2026-10-16): the row/card under the pointer already shows it.
 */

import { getModelById, tierLetterFor } from '../data/modelRegistry.js';
import { getCommand } from '../data/commandRegistry.js';
import { flowModelChoices, getFlowById } from '../data/flowsRegistry.js';
import { basename } from './file.js';

// Row 1 of a FLOW card's badge: the model that actually ran (MPI-620). A flow gen has
// `modelId: null` — it is an operation, not a model — so the tier lives in
// `generationSettings.flowModelIds`, one id per `requiredModels` slot in declaration order.
//
// Shown ONLY when the flow has exactly ONE choosable slot, which is the comparison case
// the badge exists for (Scribble on 9B vs 4B). A four-stage flow has four models and they
// do not fit a two-row corner label; a flow with no choosable slot always runs the same
// models, so naming one says nothing.
export function flowModelLabel(item) {
    if (!item?.flowId) return '';
    const ids = item.generationSettings?.flowModelIds;
    if (!Array.isArray(ids)) return ''; // pre-MPI-620 card — nothing recorded, so say nothing
    const choices = flowModelChoices(item.flowId);
    if (choices.length !== 1) return '';
    // `choices[0].index` is the slot's position in `requiredModels`, NOT its position among
    // the choosable ones — filtering loses that, and `flowModelIds` is indexed by the former.
    const model = getModelById(ids[choices[0].index]);
    if (!model) return '';
    const tier = tierLetterFor(model);
    return `${model.name}${tier ? ` ${tier}` : ''}`;
}

/** Generation time as the gallery card prints it: `42s`, `3m`, `3m 5s`. '' when unknown. */
export function formatGenTime(ms) {
    if (!(ms > 0)) return '';
    const totalSec = Math.max(1, Math.round(ms / 1000));
    if (totalSec < 60) return `${totalSec}s`;
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return s ? `${m}m ${s}s` : `${m}m`;
}

function _modelLabel(item) {
    if (item.uploaded) return item.operation === 'recorded' ? 'Recorded' : 'Imported';
    const model = getModelById(item.modelId || item.generationSettings?.modelId);
    if (model) {
        const tier = tierLetterFor(model);
        return `${model.name}${tier ? ` ${tier}` : ''}`;
    }
    return flowModelLabel(item);
}

function _operationLabel(item) {
    if (item.uploaded) return '';
    const flowId = item.flowId ?? item.appId; // appId = pre-rename key (MPI-256)
    if (flowId) return getFlowById(flowId)?.title || '';
    return getCommand(item.operation)?.label || item.operation || '';
}

// The flyout is a glance, not a reader (Fabio, 2026-10-23): long prompts are cut.
const PROMPT_MAX = 200;
const _clip = (s) => {
    const t = (s || '').trim();
    return t.length > PROMPT_MAX ? `${t.slice(0, PROMPT_MAX).trimEnd()}…` : t;
};

// 0.8 → "0.8", 1 → "1", 0.333 → "0.33".
const _num = (v) => String(Number(v.toFixed(2)));

// What the run injected wins over the control snapshot: an agent dispatch can differ from
// the project's controls, and the injection is what actually rendered (MPI-556).
function _settingRows(item) {
    const gs = item.generationSettings || {};
    const inj = gs.injectionParams || {};
    const rows = [];
    const ratio = inj.Ratio_Label ?? gs.controlState?.shared?.ratioSelector?.selectedRatio;
    if (ratio) rows.push({ label: 'Ratio', value: String(ratio) });
    if (typeof inj.Input_is_Turbo === 'boolean') rows.push({ label: 'Turbo', value: inj.Input_is_Turbo ? 'On' : 'Off' });
    if (typeof inj.Input_Fast_Motion === 'boolean') rows.push({ label: 'Fast Motion', value: inj.Input_Fast_Motion ? 'On' : 'Off' });
    const styleIdx = inj['Input_Style_Selector.selector'];
    const styleName = getModelById(item.modelId || gs.modelId)?.styleLoraLabels?.[styleIdx];
    if (styleName) {
        const strength = inj['Input_Style_Selector.strength_model'];
        rows.push({ label: 'Style', value: styleIdx > 0 && typeof strength === 'number' ? `${styleName} · ${_num(strength)}` : styleName });
    }
    const denoise = inj.Denoise ?? inj.Input_Denoise;
    if (typeof denoise === 'number') rows.push({ label: 'Denoise', value: _num(denoise) });
    return rows;
}

// Only the LoRAs that touched the run: a slot with a file, not bypassed, not at 0.
function _loraLines(item) {
    const loras = item.generationSettings?.controlState?.model?.loras;
    if (!Array.isArray(loras)) return '';
    return loras
        .filter(l => l?.name && !l.bypass && Number(l.strengthModel) !== 0)
        .map(l => `${basename(l.name).replace(/\.safetensors$/i, '')} · ${_num(Number(l.strengthModel ?? 1))}`)
        .join('\n');
}

// The machine it ran on (MPI-1261): cards made before it simply show no rows.
function _machineRows(item) {
    const gs = item.generationSettings || {};
    const gb = (bytes) => `${Math.round(bytes / 1024 ** 3)} GB`;
    const rows = [];
    if (gs.gpu) rows.push({ label: 'GPU', value: gs.engine === 'remote' ? `${gs.gpu} · RunPod` : gs.gpu });
    if (gs.vramTotal > 0) rows.push({ label: 'VRAM', value: gb(gs.vramTotal) });
    if (gs.ramTotal > 0) rows.push({ label: 'RAM', value: gb(gs.ramTotal) });
    return rows;
}

function _dateLabel(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * @param {Object} item - a HistoryItem
 * @returns {{ rows: Array<{label: string, value: string}>, loras: string, prompt: string,
 *            negativePrompt: string, notes: string } | null} null for no item; `loras` is
 *            one `name · strength` per line
 */
export function entryInfo(item) {
    if (!item) return null;
    const rows = [
        { label: 'Model', value: _modelLabel(item) },
        { label: 'Operation', value: _operationLabel(item) },
        ..._settingRows(item),
        { label: 'Took', value: formatGenTime(item.generationMs) },
        ..._machineRows(item),
        // No size/length/fps: the History row under the pointer already prints them.
        { label: 'Created', value: _dateLabel(item.createdAt) },
    ].filter(r => r.value);
    return {
        rows,
        loras: _loraLines(item),
        prompt: _clip(item.prompt),
        negativePrompt: _clip(item.negativePrompt),
        notes: (item.notes || '').trim(),
    };
}
