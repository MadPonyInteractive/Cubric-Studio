/**
 * stackJobs.js — a stack's batch Apply in the History workspace, the pure half (MPI-949
 * Phase 4).
 *
 * A History rail tool on a single card is `enqueueGeneration` over the card's CURRENT
 * version with `existingGroup` set, so the result lands as that card's next version
 * (`MpiGroupHistoryBlock` `_runImageTool` / `_runVideoTool` / `_handleResizeApply`). On a
 * stack the same job runs once per target member, each with the MEMBER as `existingGroup`.
 * The rail's panel still builds the params; this only fans them out. The Block adds the
 * shared `batchId` (one queue row, Cancel all) and dispatches.
 *
 * Pure: no DOM, no state. The Block passes `resolveUrl` (`resolveMediaUrl`).
 */

import { deriveResizeDims } from '../utils/ratios.js';
import { largestCentredRect } from '../utils/cropSnap.js';
import { roundDownToDivisible } from '../utils/cropRounding.js';

const _current = (m) => m?.history?.[m.selectedIndex ?? 0] || null;

/**
 * The members an Apply runs on: the strip's picks, or every member when none are picked.
 * A member with no file on its current version is left out.
 * @param {Array<Object>} members - live member groups, strip order
 * @param {number[]} [picked] - strip indices
 * @returns {Array<Object>}
 */
export function stackTargets(members = [], picked = []) {
    const chosen = picked?.length ? picked.map(i => members[i]).filter(Boolean) : members;
    return chosen.filter(m => _current(m)?.filePath);
}

/**
 * A video entry's saved trim, or null when there is none or it covers the whole clip.
 * The single-card rail reads the viewer's live range; a member that is not on screen has
 * only the range it saved (`item.trim`), so that is the one a stack job honours.
 */
export function savedTrim(item) {
    const a = Number(item?.trim?.in);
    const b = Number(item?.trim?.out);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
    const duration = Number(item?.duration) || 0;
    if (duration > 0 && a <= 1e-3 && Math.abs(b - duration) <= 1e-3) return null;
    return { in: a, out: b };
}

/**
 * One job per member for a History rail tool: the member's current version in, the result
 * as its next version.
 *
 * A Resize in a stack sends a RULE (long edge or %, `MpiToolOptionsResize` stackMode), not a
 * size: each member's size comes from that rule over its own pixels, so mixed ratios never
 * squash. `dims` holds those pixels by member id; a member with none is skipped.
 *
 * @param {Array<Object>} members - target member groups (`stackTargets`)
 * @param {Object} spec
 * @param {string} spec.operation - the universal op
 * @param {'image'|'video'} spec.mediaType
 * @param {Object} [spec.injectionParams] - the rail's params; a Resize's carries `rule`
 * @param {Object} [spec.inputs] - declared run inputs (a plugin's prompt)
 * @param {Object<string,{w:number,h:number}>} [spec.dims] - member pixels, Resize only
 * @param {(p:string)=>string} [spec.resolveUrl]
 * @returns {{jobs: Array<{config:Object, opts:Object}>, skipped: number}}
 */
export function stackToolJobs(members = [], { operation, mediaType, injectionParams = {}, inputs = {}, dims = {}, resolveUrl = (p) => p } = {}) {
    const { rule, ...params } = injectionParams;
    const jobs = [];
    let skipped = 0;
    for (const m of members) {
        const item = _current(m);
        if (!item?.filePath) { skipped++; continue; }
        let injection = params;
        if (rule) {
            const d = dims[m.id];
            const size = d && deriveResizeDims(rule.kind, d.w, d.h, { [rule.kind]: rule.value });
            if (!size) { skipped++; continue; }
            injection = { ...params, ...size };
        }
        const trim = mediaType === 'video' ? savedTrim(item) : null;
        jobs.push({
            config: {
                operation,
                model: { id: null, mediaType },
                positive: '',
                negative: '',
                ...inputs,
                mediaItems: [{ id: item.id, url: resolveUrl(item.filePath), mediaType, source: 'history', ...(trim ? { trim } : {}) }],
                injectionParams: injection,
            },
            opts: { existingGroup: m, scope: 'groupHistory', groupId: m.id },
        });
    }
    return { jobs, skipped };
}

/**
 * Stack crop (Phase 5): the box each target member is cut with. A member keeps the box
 * the user dragged on it (`saved`, keyed by its CURRENT item id), else it gets the largest
 * centred box at `ratio` on its upright size (`dims`, from `/image-import/probe`). Width
 * and height round DOWN to `divisibleBy` (D2) and the box shrinks about its centre, so a
 * box inside the picture stays inside it: no Fill strip, and N members keep one ratio.
 * @param {Array<Object>} members - the targets (`stackTargets`)
 * @param {{ ratio: number|null, divisibleBy?: number, saved?: Map<string, {x,y,w,h}>, dims?: Object<string, {w,h}> }} opts
 * @returns {{ crops: Array<{ member: Object, item: Object, rect: {x,y,w,h} }>, skipped: number }}
 */
export function stackCropRects(members = [], { ratio = null, divisibleBy = 1, saved = new Map(), dims = {} } = {}) {
    const crops = [];
    let skipped = 0;
    for (const m of members) {
        const item = _current(m);
        const d = dims[m.id];
        const box = saved.get(item?.id) || (d && largestCentredRect(d.w, d.h, ratio));
        if (!item?.filePath || !box) { skipped++; continue; }
        const w = roundDownToDivisible(box.w, divisibleBy);
        const h = roundDownToDivisible(box.h, divisibleBy);
        crops.push({
            member: m,
            item,
            rect: { x: Math.floor(box.x + (box.w - w) / 2), y: Math.floor(box.y + (box.h - h) / 2), w, h },
        });
    }
    return { crops, skipped };
}
