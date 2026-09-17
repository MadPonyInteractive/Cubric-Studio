/**
 * describeAction.js — run the image captioner on one item and drop the result in
 * the prompt box (MPI-310, MPI-737).
 *
 * Lives here rather than in each block because the gallery grid and the history
 * list both need it and the logic is identical: validate the item, call the ONE
 * describe switch point (`llmService.describeImage`), write the caption into the
 * prompt box on success.
 *
 * The describe backend (ComfyUI or Remote) and the plugin/connection check are
 * handled inside `describeImage` — the caller's job is item validation only.
 * D1 (MPI-737): on failure a toast names the reason; nothing falls back silently.
 *
 * The caption lands in the prompt box (editable) rather than being stored on the
 * item, because the point is to give a human an accurate starting point to edit
 * toward a target — describe, adjust, generate.
 */

import { Events } from '../events.js';
import { resolveMediaUrl } from './mediaActions.js';
import { clientLogger } from '../services/clientLogger.js';
import { describeImage, withRemoteSettingsHint } from '../services/llmService.js';

/**
 * Queue or dispatch a caption run for one history item.
 *
 * @param {{filePath?: string, type?: string}} item  The item to describe.
 * @param {Object}  [opts]
 * @param {Object}  [opts.group]   Owning group, when called from a group context.
 * @param {string}  [opts.scope]   'gallery' | 'groupHistory'.
 * @returns {boolean} true when a job was submitted (may still fail asynchronously).
 */
export function describeItem(item, opts = {}) {
    if (!item?.filePath) {
        Events.emit('ui:warning', { message: 'No source image to describe.' });
        return false;
    }
    if (item.type === 'video') {
        // Video captioning needs a real frame written to disk first — the loader
        // node reads an OS path, not a blob. Out of scope for this card.
        Events.emit('ui:warning', { message: 'Describing video frames is not supported yet.' });
        return false;
    }

    describeImage({
        imagePath: resolveMediaUrl(item.filePath),
        scope: opts.scope || 'gallery',
        group: opts.group,
    }).then((result) => {
        if (result.ok) {
            Events.emit('workspace:inject-prompts', { positive: result.text });
            Events.emit('ui:success', { message: 'Description added to the prompt.' });
        } else if (!result.cancelled) {
            // D1: say so plainly, never fall back silently, and point at what fixes it.
            const msg = result.error || 'The description failed.';
            clientLogger.warn('describe', `[describeAction] ${result.via} ${result.errorCode || ''} ${msg}`);
            if (result.via === 'endpoint') {
                // A toast, not the error modal: a missing key is setup, not a bug to report.
                Events.emit('ui:warning', { message: withRemoteSettingsHint(result.errorCode, msg) });
            } else if (result.errorCode === 'DESCRIBER_MISSING') {
                // The encoder is a plugin weight the user installs deliberately.
                Events.emit('ui:warning', { message: msg });
            }
            // A ComfyUI run that fails is already reported by the generation pipeline.
        }
    }).catch((err) => {
        clientLogger.error('describe', 'describeImage threw unexpectedly', err);
    });

    return true;
}
