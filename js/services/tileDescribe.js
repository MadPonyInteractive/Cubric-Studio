/**
 * tileDescribe.js — Use Tiles' "Describe each tile" (MPI-1232 Phase 3).
 *
 * Before a tile upscale queues, the user's describer names what fills each tile in a few
 * words, from a copy of the WHOLE picture with that tile outlined in red (bench method 8:
 * the scene around the tile is the clue; a bare crop of grass reads as "ocean"). People are
 * never described: the question ignores them, a name with people words is dropped
 * (cleanTileName), and the graph's people + face passes redraw
 * them with no tile name at all.
 *
 * The names reach the graph keyed by LABEL, not by order: MakeTileSEGS cuts tiles row by
 * row, ImpactSEGSLabelAssign labels them t0..tN from `Input_Tile_Labels`, and the person
 * mask only then empties the tiles a person covers. An ordered `[ASC]` list would shift
 * every name after the first emptied tile (24 tiles cut, 12 sampled on the face photo).
 *
 * A tile the describer cannot name is redrawn with no name, as before this feature; the run
 * never fails for it.
 */

import { tileRects } from '../utils/tileCount.js';
import { imageSize } from '../utils/upscaleLimit.js';
import { extractAbsPath } from '../utils/mediaActions.js';
import { runCpuJob } from './cpuJobs.js';
import { clientLogger } from './clientLogger.js';

// Bench method 8 (tasks/MPI-1232/research/stage2.py SCENERY_Q), word for word.
export const SCENERY_Q = 'The red rectangle marks one part of this picture. Ignoring any people, name what fills that area in five '
    + 'words or fewer, like "a field with green grass" or "cloudy sky". Reply with the name only.';

const PEOPLE_WORDS = new RegExp('\\b(' + [
    'man', 'men', 'woman', 'women', 'person', 'persons', 'people', 'boy', 'girl', 'child', 'children', 'kids?', 'baby',
    'guy', 'lady', 'someone', 'he', 'she', 'his', 'her', 'him', 'portrait',
    // Live 2026-10-23 on an anime hero: "an anime character in flight", "a blue superhero costume".
    'characters?', 'figures?', '(super)?hero(es|ine)?', 'costumes?', 'outfits?', 'clothes', 'clothing', 'capes?',
    'faces?', 'heads?', 'hair', 'beard', 'mo?ustache', 'eyes?', 'eyebrows?', 'nose', 'mouth', 'lips?', 'teeth',
    'ears?', 'cheeks?', 'chin', 'forehead', 'neck', 'shoulders?', 'arms?', 'hands?', 'fingers?', 'legs?', 'knees?',
    'foot', 'feet', 'skin', 'torso', 'chest', 'shirt', 'jacket', 'dress', 'sleeves?', 'collar',
].join('|') + ')\\b', 'i');

/**
 * A describer's answer as a tile name: one line, no quotes, no trailing dot, and never a
 * `[` or `]` (Impact's [LAB] parser reads a bracket as the next label).
 * @param {string} text
 * @returns {string}
 */
export function cleanTileName(text) {
    const line = String(text ?? '').split('\n')[0];
    // The describer sometimes names the MARKER ("a red rectangle outline", live 2026-10-23 on an
    // edge tile): sent on, it would paint a red box into that tile. Such a tile goes unnamed.
    if (/\b(rectangle|outline)\b/i.test(line)) return '';
    // The question ignores people, yet on a tile a person only partly covers the describer still
    // names them ("curly gray hair and beard", "a man's shoulder and neck", live 2026-10-23).
    // The mask keeps the person out of that tile's redraw, but the words would reach its background.
    // ponytail: a word list; a false hit ("cliff face") only leaves that tile unnamed, as before naming.
    if (PEOPLE_WORDS.test(line)) return '';
    return line
        .replace(/[[\]]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^["'“”‘’\s]+|["'“”‘’.\s]+$/g, '');
}

/**
 * The two graph strings for a list of names, index i = the tile labelled t<i>.
 * An empty name = that tile gets no entry (prompt-less). No names at all = '' (today's graph).
 * `[CONCAT]` appends the name to the base positive instead of replacing it (keeps Flux
 * guidance / the model's own conditioning: brief.md finding 3).
 *
 * @param {string[]} names
 * @returns {{ Input_Tile_Prompts: string, Input_Tile_Labels: string }}
 */
export function tileWildcard(names) {
    const parts = names.map((n, i) => (n ? `[t${i}]${n}` : '')).join('');
    return {
        Input_Tile_Prompts: parts ? `[CONCAT][LAB]${parts}` : '',
        Input_Tile_Labels: names.map((_, i) => `t${i}`).join(','),
    };
}

/**
 * Does this queued run want its tiles named? A tile upscale with Describe each tile on.
 * @param {object} config  an enqueueGeneration config
 */
export function wantsTileNames(config) {
    const p = config?.injectionParams;
    return p?.Input_Tile_Upscale === true && p.Tile_Describe === true;
}

/**
 * Names every tile of a tile-upscale run. Never rejects.
 *
 * @param {object} config  the enqueueGeneration config (its Input_Image media + tile params)
 * @param {object} [io]    test seams: `describe` (llmService.describeImage), `outlines`, `size`, `job`
 * @returns {Promise<{ injectionParams?: object, named: number, total: number, failed: number,
 *   cancelled?: boolean, error?: string, costUsd?: number }>}  `injectionParams` = the two graph
 *   strings; `costUsd` = what a paid describer billed, summed
 */
export async function nameTiles(config, io = {}) {
    const p = config.injectionParams || {};
    const src = (config.mediaItems || []).find((m) => m?.mediaType === 'image' && m.url)?.url;
    const imagePath = extractAbsPath(src) ?? src;
    const size = imagePath ? await (io.size || imageSize)(imagePath) : null;
    if (!size) return { named: 0, total: 0, failed: 0, error: 'The picture could not be read.' };

    const rects = tileRects(size.width, size.height, Number(p.Input_Upscale_Factor) || 1, {
        bbox: Number(p.Input_Tile_Size) || 1024,
        overlap: p.Input_Tile_Overlap != null ? Number(p.Input_Tile_Overlap) : undefined,
    });
    const total = rects.length;
    if (!total) return { named: 0, total: 0, failed: 0 };
    // The last row/column touches the far edge, so these are the scaled picture's size.
    const iw = Math.max(...rects.map((r) => r.x2));
    const ih = Math.max(...rects.map((r) => r.y2));
    const fractions = rects.map((r) => ({ x1: r.x1 / iw, y1: r.y1 / ih, x2: r.x2 / iw, y2: r.y2 / ih }));

    const describe = io.describe || (async (a) => (await import('./llmService.js')).describeImage(a));
    const job = io.job || runCpuJob;

    return job(`Naming ${total} tiles`, async (setProgress) => {
        let images;
        try {
            images = await (io.outlines || _outlines)(imagePath, fractions);
        } catch (err) {
            clientLogger.warn('tileDescribe', `[tiles] outlines failed: ${err?.message || err}`);
            return { named: 0, total, failed: total, error: err?.message || 'The tile pictures could not be made.' };
        }
        const names = [];
        // A name cleanTileName drops (people words, the marker) is the guard working, not a failed
        // tile: only a describer that did not answer counts as failed (Fabio, 2026-10-23: a dropped
        // "her hand" toasted as "1 of 4 tiles could not be named").
        const dropped = [];
        let failed = 0;
        let error;
        // A paid endpoint bills per tile (150 on a 4000x6000 at 2x) with no price known up
        // front: the route's `costUsd` is summed and shown after naming (MPI-1257).
        let costUsd = 0;
        // ponytail: one tile at a time (a 150-tile run on an endpoint takes minutes);
        // a few in flight if endpoint users report it slow. ComfyUI runs them one by one anyway.
        for (const [i, imageUrl] of images.entries()) {
            const r = await describe({ imagePath: imageUrl, question: SCENERY_Q });
            costUsd += Number(r?.costUsd) || 0;
            if (r?.cancelled) return { named: 0, total, failed: 0, cancelled: true, ...(costUsd > 0 && { costUsd }) };
            const name = r?.ok ? cleanTileName(r.text) : '';
            if (!r?.ok) { failed += 1; error ??= r?.error; } else if (!name) dropped.push(String(r.text ?? '').split('\n')[0]);
            names.push(name);
            setProgress((i + 1) / total);
        }
        const named = names.filter(Boolean).length;
        clientLogger.info('tileDescribe', `[tiles] named ${named}/${total}${costUsd ? ` for $${costUsd.toFixed(4)}` : ''}: ${JSON.stringify(names).slice(0, 400)}`
            + (dropped.length ? ` | dropped: ${JSON.stringify(dropped).slice(0, 200)}` : ''));
        return { injectionParams: tileWildcard(names), named, total, failed,
            ...(error ? { error } : {}), ...(costUsd > 0 && { costUsd }) };
    }, { mediaType: 'image' });
}

async function _outlines(imagePath, rects) {
    const res = await fetch('/tiles/outlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagePath, rects }),
    });
    const body = await res.json();
    if (!body.ok) throw new Error(body.error?.message || 'The tile pictures could not be made.');
    return body.images;
}
