// ── Convert to 360 pano (MPI-623, plan A9) ────────────────────────────────────
// Makes a NEW scene card from an image card's selected 2:1 still, so the source stays an
// ordinary picture the user can still edit (Fabio, 2026-10-12). `sceneConvert` runs as a
// normal queued generation (queue row, status-bar progress, Stop): its 8K texture lands as
// the new card, then the texture + MoGe equirect depth are stored as that card's
// `<id>.scene.*` companions and `scenePath` (`POST /project-media/:id/scene`). From then on
// a left-click opens the new card in the Scene workspace (`getSceneItem`).

import { Events } from '../../events.js';

/**
 * @param {{ id: string, folderPath: string }} project
 * @param {Object} item  the source card's selected entry, a 2:1 still (`canConvertToPano`)
 * @param {function} [enqueue] - injected by tests; `enqueueGeneration` otherwise
 * @returns {Promise<{ group: Object, item: Object, scenePath: string }>} the new scene card
 */
export async function convertToPano(project, item, enqueue) {
    enqueue ||= (await import('../generationService.js')).enqueueGeneration;
    const landed = await new Promise((resolve, reject) => {
        const started = enqueue(
            {
                operation: 'sceneConvert', model: { id: null, mediaType: 'image' }, positive: '', negative: '',
                mediaItems: [{ url: item.filePath, mediaType: 'image', role: 'inputImage', source: 'history' }],
            },
            {
                onComplete: (result = {}) => (result.item && result.depthUrl && result.outputUrls?.[0]
                    ? resolve(result)
                    : reject(new Error('the conversion finished without its picture or depth'))),
                onError: (err) => reject(err instanceof Error ? err : new Error(String(err?.message || err))),
                onCancel: () => reject(Object.assign(new Error('cancelled'), { cancelled: true })),
            },
        );
        if (!started) reject(new Error('the conversion did not start'));
    });
    const res = await fetch(
        `/project-media/${project.id}/scene?folderPath=${encodeURIComponent(project.folderPath)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: landed.item.id, imageUrl: landed.outputUrls[0], depthUrl: landed.depthUrl }),
        }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'scene save failed');
    // Mirror in memory (sidecar/in-memory parity), as card notes do.
    landed.item.scenePath = data.scenePath;
    Events.emit('gallery:item-updated', { groupId: landed.group.id, group: landed.group });
    return { group: landed.group, item: landed.item, scenePath: data.scenePath };
}
