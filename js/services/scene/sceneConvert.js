// ── Convert to 360 pano (MPI-623, plan A9) ────────────────────────────────────
// Gives an image card its 3D scene IN PLACE: `sceneConvert` on the card's selected still
// (the 8K texture + MoGe equirect depth), then the server stores both as the item's
// `<id>.scene.*` companions and writes `scenePath` (`POST /project-media/:id/scene`).
// From then on a left-click opens the card in the Scene workspace (`getSceneItem`).

import { runSceneOp } from '../commandExecutor.js';
import { resolveMediaUrl } from '../../utils/mediaActions.js';
import { Events } from '../../events.js';

/**
 * @param {{ id: string, folderPath: string }} project
 * @param {Object} group  the card
 * @param {Object} item   its selected entry, a 2:1 still (`canConvertToPano`)
 * @returns {Promise<string>} the new `scenePath`
 */
export function convertToPano(project, group, item) {
    return new Promise((resolve, reject) => {
        const exec = runSceneOp({ op: 'sceneConvert', imagePath: resolveMediaUrl(item.filePath) });
        exec.onError = reject;
        exec.onResult = async ({ imageUrl, depthUrl }) => {
            try {
                const res = await fetch(
                    `/project-media/${project.id}/scene?folderPath=${encodeURIComponent(project.folderPath)}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ itemId: item.id, imageUrl, depthUrl }),
                    }
                );
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) throw new Error(data.error || 'scene save failed');
                // Mirror in memory (sidecar/in-memory parity), as card notes do.
                item.scenePath = data.scenePath;
                Events.emit('gallery:item-updated', { groupId: group.id, group });
                resolve(data.scenePath);
            } catch (err) {
                reject(err);
            }
        };
    });
}
