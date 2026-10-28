/**
 * agentGifTools.mjs — the in-app agent's `gif` tool: one schema in TOOL_DEFS, five actions here.
 *
 * MPI-1125. The four GIF tools and make_sheet were 4.9 KB of tool schema on EVERY request
 * (~1.2k tokens), for work most chats never do. They are one `gif` tool now, and what each
 * action takes is `app:gifs`, RENDERED from the settings below (docs/agent-corpus.md decision 1:
 * a fact in a data file is rendered, never restated), read once behind a gate.
 *
 * `images` / `video` / `gif` are the card refs and ride at the top of the call; everything
 * else goes in `settings`. The routes behind each action are unchanged (docs/agent-chat.md § Tools).
 */
import { SHEET_SHAPES, SHEET_SIZES } from '../js/utils/sheetLayout.js';

export const GIF_GUIDE_COVERS = 'GIFs (make, edit, cut out, to video) and picture sheets: every setting each action takes.';

export const GIF_ACTIONS = {
    make: {
        does: 'Make an animated GIF in the open project, as a NEW gallery card. Either `images` (two or more still cards, played in that order; the first one\'s size wins) or `video` (a clip of one video card, which needs fps). Every ref is a gallery card: one list_cards returned, or one a finished generation or GIF step reported.',
        refs: { images: 'Refs of two or more still image cards, in play order.', video: 'The ref of one video card.' },
        settings: {
            fps: 'number. Frames per second, 1-60. Required with video.',
            sizePreset: 'one of original, 480xauto, 320xauto, autox480, autox320. The number is the NAMED axis, not the longest edge. Default original.',
            loop: 'integer. TOTAL plays: 0 (default) = forever, 1 = once.',
            trimIn: 'number. Clip start in seconds. Only with video, and only together with trimOut.',
            trimOut: 'number. Clip end in seconds.',
        },
    },
    edit: {
        does: 'Retime, trim, loop, recolour, resize or crop a GIF card. Lands a new ENTRY on the same card; the entry you edited stays on it. Send at least one setting. crop and resize cannot share a call: send the second as its own call, on the ref the first returned.',
        refs: { gif: 'The ref of a GIF card.' },
        settings: {
            fps: 'number, 0.1-50. A GIF cannot play faster than 50.',
            loop: 'integer. TOTAL plays: 0 = forever.',
            trim: '{ in, out }: frame INDICES, inclusive, not seconds.',
            output: '{ colours, edgeColour, maxEdge }: colours 2-256. edgeColour "#rrggbb" builds a TRANSPARENT GIF with soft edges blended toward that colour; "opaque" builds an opaque one. maxEdge caps the longest edge.',
            resize: '{ width, height }.',
            crop: '{ x, y, width, height, fill, outWidth, outHeight }: a box in source pixels. fill "#rrggbb" covers any area the box takes from outside the frame; outWidth/outHeight set the output resolution.',
        },
    },
    cutout: {
        does: 'Cut the subject out of every frame of a GIF card, onto transparency ("remove the background", "make it a sticker"). Lands a new ENTRY on the same card; the source entry stays. A GPU run: about 16 s for 30 frames, longer by name. A cut-out can be clean on one frame and ragged in motion: never call one good, ask the user to watch it. Came back wrong: change prompt or adjust and run it again on the same ref.',
        refs: { gif: 'The ref of a GIF card.' },
        settings: {
            method: 'required: "background" keeps the whole subject and takes no prompt; "name" tracks what prompt names and keeps EVERY object it tracks.',
            prompt: 'string. What to track, e.g. "robot". Required for method "name".',
            adjust: '{ grow, outward, inward, edge, fillHoles }: mask adjust. grow is in output pixels.',
            invert: 'boolean. Swap which side survives.',
        },
    },
    to_video: {
        does: 'Turn a GIF card into a video, as a NEW card beside it; the GIF is left alone. Video carries no transparency, so a cut-out plays on black unless you pass background.',
        refs: { gif: 'The ref of a GIF card.' },
        settings: {
            background: '"#rrggbb" behind whatever a transparent GIF leaves clear.',
        },
    },
    sheet: {
        does: 'Pack 2+ still image cards, in order, into one new picture card (character sheet, mood board). For hand framing, send the user to the gallery\'s Combine.',
        refs: { images: 'Refs of two or more still image cards, in order.' },
        settings: {
            shape: `one of ${SHEET_SHAPES.map((s) => s.value).join(', ')}. "auto" crops nothing.`,
            longEdge: `one of ${SHEET_SIZES.join(', ')}. Default 2048.`,
        },
    },
    combine: {
        does: 'Join 2+ video cards end to end, in order, into ONE new video card. Every clip stays its own card, the join clip too, so the user can redo the join or combine again. A join clip goes between the two clips it joins: clip A, the join, clip B.',
        refs: { videos: 'Refs of two or more video cards, in play order.' },
        settings: {},
    },
};

/** `app:gifs`: what each action does and takes, from GIF_ACTIONS. */
export function renderGifGuide() {
    const out = [
        '# GIFs and sheets',
        `Covers: ${GIF_GUIDE_COVERS}`,
        '',
        'One tool, `gif`: `action`, the card refs at the top of the call, every other setting inside `settings`. A ref is a gallery card: one list_cards returned, or one a finished generation or GIF step reported.',
        '',
    ];
    for (const [action, a] of Object.entries(GIF_ACTIONS)) {
        out.push(`## ${action}`, '', a.does, '',
            ...Object.entries(a.refs).map(([k, v]) => `- \`${k}\` (top level): ${v}`),
            ...Object.entries(a.settings).map(([k, v]) => `- \`settings.${k}\`: ${v}`), '');
    }
    return out.join('\n');
}
