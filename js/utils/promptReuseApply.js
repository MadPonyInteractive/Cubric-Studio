// The Reuse steps the Gallery and History Blocks share (AUDIT D9): the ask-or-apply entry and
// the prompt / media / settings apply onto a mounted PromptBox. Choosing the model and the
// operation stays in each Block: the Gallery and History establish them differently.
import { state } from '../state.js';
import { Events } from '../events.js';
import { MpiReusePromptDialog } from '../components/Compounds/MpiReusePromptDialog/MpiReusePromptDialog.js';
import { applyPromptReuseSettings } from '../services/projectService.js';
import {
    buildPromptReuseSettings, resolvePromptReuseMediaItems, payloadHasReusableImages,
    payloadHasReusableVideos, payloadHasReusableAudio, isFlowCardItem,
} from './promptReuse.js';

export function reuseIncludes(value = {}) {
    return {
        prompt: value.prompt === true,
        settings: value.settings === true,
        model: value.model === true,
        images: value.images === true,
        video: value.video === true,
        audio: value.audio === true,
    };
}

function _pickPayload(bundle, source) {
    if (source === 'current') return bundle.current || null;
    return bundle.original || bundle.current || null;
}

/**
 * Reuse a card's prompt: the Reuse dialog when the user asked for it, else straight through
 * `apply(payload, includes, dest)` with the stored options.
 * `bundle` = { original, current }. `showSource` false = one source (History): the dialog
 * has no Original/Current toggle and `bundle.original` is always the one applied.
 */
export function askPromptReuse(bundle, apply, { showSource = false } = {}) {
    const options = state.promptReuseOptions || {};
    const pick = (source) => (showSource ? _pickPayload(bundle, source) : bundle.original);
    if (options.ask === true) {
        const sources = showSource ? ['original', 'current'] : ['original'];
        const availability = (has) => Object.fromEntries(sources.map(s => [s, has(bundle[s])]));
        const dialog = MpiReusePromptDialog.mount(document.createElement('div'), {
            includes: options,
            ...(showSource ? { source: state.promptReuseSource } : {}),
            showSource,
            // Flow cards (MPI-263): a Flow card source splits Apply into "to Prompt Box" vs "to App".
            isFlowCard: sources.some(s => isFlowCardItem(bundle[s]?.item)),
            // Per-source media availability greys each "Use …" toggle for a source lacking
            // that input (MPI-212/227).
            imageAvailability: availability(payloadHasReusableImages),
            videoAvailability: availability(payloadHasReusableVideos),
            audioAvailability: availability(payloadHasReusableAudio),
        });
        dialog.on('apply', async ({ includes, source, dest }) => {
            const payload = pick(source);
            if (payload) await apply(payload, reuseIncludes(includes), dest);
            dialog.destroy?.();
        });
        dialog.on('cancel', () => dialog.destroy?.());
        dialog.el.show?.();
        return;
    }
    const payload = pick(state.promptReuseSource);
    // No-dialog fast path (ask=false): Flow cards reopen the Flow as before.
    if (payload) apply(payload, reuseIncludes(options), 'flow');
}

/**
 * Prompts, media and settings onto `pb` (the PromptBox el), once the Block has set its model
 * and operation. `use` = reuseIncludes(). `nameFor(item, url)` names an injected chip;
 * `afterMedia()` runs between the media and the settings.
 */
export async function applyReuseToPromptBox(pb, payload, use, { model, operation, nameFor, afterMedia } = {}) {
    if (use.prompt) {
        pb.injectPrompts?.({ positive: payload.positive || '', negative: payload.negative || '', negativeAudio: payload.negativeAudio || '', enhanced: payload.enhanced });
    }
    // Reuse the media the user opted into, gated per-type by what the SOURCE carries
    // (MPI-212 image -> MPI-227 video/audio). A source lacking a type injects nothing but a
    // warning + an empty required slot, so skip it: the dialog greys those toggles, this
    // mirrors the gate for the ask-disabled path. Resolve ONCE (all types), inject the subset.
    const wantImages = use.images && payloadHasReusableImages(payload);
    const wantVideo = use.video && payloadHasReusableVideos(payload);
    const wantAudio = use.audio && payloadHasReusableAudio(payload);
    if (wantImages || wantVideo || wantAudio) {
        pb.clearMedia?.();
        const resolved = await resolvePromptReuseMediaItems(payload);
        const wantType = (t) => (t === 'image' && wantImages) || (t === 'video' && wantVideo) || (t === 'audio' && wantAudio);
        const mediaItems = resolved.filter(m => wantType(m.mediaType || m.type));
        // resolvePromptReuseMediaItems drops files no longer on disk (Cleanup wiped them, or
        // the history media was deleted). A declared type that resolved to nothing is gone:
        // warn instead of injecting an empty chip that only fails at generate time.
        const has = (t) => mediaItems.some(m => (m.mediaType || m.type) === t);
        if ((wantImages && !has('image')) || (wantVideo && !has('video')) || (wantAudio && !has('audio'))) {
            Events.emit('ui:warning', { message: 'Some input media is missing and was not re-added.' });
        }
        for (const item of mediaItems) {
            const url = item.url || item.filePath;
            pb.injectMedia?.({ url, mediaType: item.mediaType || item.type, role: item.role, ...(nameFor ? { name: nameFor(item, url) } : {}) });
        }
    }
    afterMedia?.();

    if (use.settings) {
        const settings = buildPromptReuseSettings(payload, model);
        applyPromptReuseSettings({
            modelId: model.id,
            mediaType: model.mediaType,
            operation,
            ...settings,
        });
        // Settings were written AFTER the controls mounted (setModel/setOperation), so the
        // live controls still show the old values: re-mount them to re-read the recalled
        // ratio/quality/duration.
        pb.refreshControls?.();
    }
}
