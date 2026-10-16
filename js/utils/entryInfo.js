/**
 * entryInfo — what the card-info flyout shows for one history entry (MPI-1162).
 *
 * Pure data: the History row hands an item in and mounts the result in `MpiEntryInfo`.
 * History only, by decision (Fabio, 2026-10-16) — the gallery gets no flyout. Every value is read off the in-memory HistoryItem, which is
 * already hydrated from its sidecar, so no fetch happens on hover.
 *
 * No seed, by decision: nothing in the app takes one back in, so it is noise here.
 * No resolution either (Fabio, 2026-10-16): the row/card under the pointer already shows it.
 */

import { getModelById, tierLetterFor } from '../data/modelRegistry.js';
import { getCommand } from '../data/commandRegistry.js';
import { flowModelChoices, getFlowById } from '../data/flowsRegistry.js';

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

function _dateLabel(iso) {
    const d = iso ? new Date(iso) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * @param {Object} item - a HistoryItem
 * @returns {{ rows: Array<{label: string, value: string}>, prompt: string,
 *            negativePrompt: string, notes: string } | null} null for no item
 */
export function entryInfo(item) {
    if (!item) return null;
    const rows = [
        { label: 'Model', value: _modelLabel(item) },
        { label: 'Operation', value: _operationLabel(item) },
        { label: 'Took', value: formatGenTime(item.generationMs) },
        // No size/length/fps: the History row under the pointer already prints them.
        { label: 'Created', value: _dateLabel(item.createdAt) },
    ].filter(r => r.value);
    return {
        rows,
        prompt: (item.prompt || '').trim(),
        negativePrompt: (item.negativePrompt || '').trim(),
        notes: (item.notes || '').trim(),
    };
}
