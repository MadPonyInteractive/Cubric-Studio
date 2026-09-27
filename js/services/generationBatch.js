/**
 * generationBatch.js — Pure batch-collapse logic for the generation queue snapshot.
 * No DOM, no state, no events — importable in bare Node for unit tests.
 */

/**
 * Collapse snapshot items that share a batchId into single rows.
 * Unbatched items pass through unchanged. Preserves the order of
 * the first occurrence of each batch (or unbatched item).
 *
 * @param {Array} items   flat list of snapshot items (running + pending), each
 *                        having optional `batchId`, `batchLabel`, `batchTotal`.
 * @returns {Array}       items with each batch collapsed to one row.
 */
export function collapseQueueBatches(items) {
    /** @type {Map<string, Array>} batchId → group of snapshot items */
    const batchGroups = new Map();
    /** preserve insertion order: {type:'unbatched',item} | {type:'batch',batchId} */
    const order = [];

    for (const item of items) {
        const batchId = item.batchId || null;
        if (!batchId) {
            order.push({ type: 'unbatched', item });
        } else if (!batchGroups.has(batchId)) {
            batchGroups.set(batchId, [item]);
            order.push({ type: 'batch', batchId });
        } else {
            batchGroups.get(batchId).push(item);
        }
    }

    return order.map(entry => {
        if (entry.type === 'unbatched') return entry.item;
        return _buildBatchRow(batchGroups.get(entry.batchId));
    });
}

/**
 * @param {Array} group  all snapshot items for one batchId (non-empty)
 * @returns {Object}     BatchSnapshotRow
 */
function _buildBatchRow(group) {
    const first = group[0];
    const batchTotal = Number(first.batchTotal) || group.length;
    const runningItems = group.filter(i => i.status === 'running');
    const pendingItems = group.filter(i => i.status === 'pending');
    // Jobs absent from the snapshot have already finished (or been cancelled).
    const batchDone = Math.max(0, batchTotal - group.length);
    const hasRunning = runningItems.length > 0;
    const runningJob = runningItems[0] || null;
    const firstPending = pendingItems[0] || null;
    const representativeJob = runningJob || firstPending;

    return {
        isBatch:            true,
        batchId:            first.batchId,
        batchLabel:         first.batchLabel || first.modelName || '',
        batchTotal,
        batchDone,
        status:             hasRunning ? 'running' : 'pending',
        queueJobId:         representativeJob?.queueJobId || null,
        canStop:            hasRunning,
        canCancel:          pendingItems.length > 0,
        modelName:          first.modelName || '',
        operation:          first.operation || '',
        engine:             first.engine || '',
        source:             first.source || 'manual',
        isLoop:             false,
        scope:              first.scope || 'gallery',
        previewUrl:         runningJob?.previewUrl || null,
        activeGenerationId: runningJob?.activeGenerationId || null,
        previewKind:        first.previewKind || '',
        mediaItems:         representativeJob?.mediaItems || [],
        width:              (representativeJob || first).width || 0,
        height:             (representativeJob || first).height || 0,
    };
}
