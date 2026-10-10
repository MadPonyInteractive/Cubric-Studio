/**
 * agentToolOps.js — the agent's image tools that need NO model (MPI-904, MPI-941 Phase 3).
 *
 * Live 2026-09-27: asked to "upscale every card marked with a dot", the agent could only
 * reach Krea 2's upscale, a diffusion model that repaints. Its guide wants a prompt per
 * picture, so the agent looked at all 8 cards, wrote 8 prompts and sent 8 generates, then
 * looked at all 8 results. A plain upscale needs no look and no prompt: it is the History
 * rail's own universal op, one choice of upscaler and one factor.
 *
 * These ride the agent's EXISTING `generate` tool: no `modelId`, the op in `operation` and
 * the settings in `fields`. Both agent budgets are full, so the tool schema does not grow;
 * the catalogue (`list_models`) and `describe_model` carry the instructions instead.
 *
 * Each tool runs one of the rail's universal ops, with the params the rail sends
 * (`MpiGroupHistoryBlock._handleApply`), so an agent run and a rail click are one graph.
 * `crop` is the `resize` op in its `crop` mode: the output is the largest rect of the ratio
 * inside the picture, at scale 1. ponytail: no box crop ("crop to her face") — it needs a
 * graph of its own; add it when a live run asks for one.
 * `downscale` is the same op at the rail's MP family size, and refuses to enlarge.
 *
 * Pure: no DOM, no state. `agentDispatch._submitTool` does the dispatch.
 */

import { DEPS } from '../data/modelConstants/dependencies.js';
import { CROP_RATIOS, deriveResizeDims } from '../utils/ratios.js';

const UPSCALERS = ['4x-NMKD-Siax', '4x-AnimeSharp'];
const FACTORS = [1.5, 2, 3, 4];
const POSITIONS = ['center', 'top', 'bottom', 'left', 'right'];
const RATIOS = new Map([...CROP_RATIOS.portrait, ...CROP_RATIOS.landscape].map(r => [r.label, r.ratio]));

/** The one picture every tool takes: the universal ops' own `inputImage` slot. */
const MEDIA = [{ role: 'inputImage', type: 'image', required: true }];

/**
 * What the agent sees. `note` goes into the short catalogue; the whole entry is what
 * `describe_model` returns for the op.
 */
export const AGENT_TOOL_OPS = [
    {
        op: 'imageUpscale',
        // MPI-1053: the routes live in app:upscaling, read behind a gate (agentLoop.mjs). Written
        // here they lost to this tool's best: true: "bigger and more detail" still ran it.
        note: 'Plain upscale x1.5 to x4 with an upscale model and no prompt: the same picture, bigger and sharper, nothing redrawn. It adds NO detail. fields: upscaler "4x-NMKD-Siax" (default) for photos and realistic renders, "4x-AnimeSharp" for anime, cartoons and flat art; factor 1.5, 2 (default), 3 or 4. Which upscale or detail route fits the ask: app:upscaling.',
        fields: {
            upscaler: { values: UPSCALERS, default: UPSCALERS[0] },
            factor: { values: FACTORS, default: 2 },
        },
        media: MEDIA,
    },
    {
        op: 'removeBackground',
        note: 'Cut the subject out onto transparency with no model and no prompt; fields.background "#rrggbb" puts a flat colour behind it instead. This is "remove the background"; putting a new scene behind the subject is an edit.',
        fields: {
            background: { values: ['transparent', '#rrggbb'], default: 'transparent' },
        },
        media: MEDIA,
    },
    {
        op: 'crop',
        note: `Crop to a ratio with no model and no prompt, keeping as much of the picture as fits; nothing is resized. fields: ratio (${[...RATIOS.keys()].join(', ')}); position center (default), top, bottom, left or right.`,
        fields: {
            ratio: { values: [...RATIOS.keys()], required: true },
            position: { values: POSITIONS, default: 'center' },
        },
        media: MEDIA,
    },
    {
        op: 'downscale',
        note: 'Shrink to a megapixel count, keeping the proportions, with no model and no prompt (1 MP = 1024x1024). fields: megapixels, 0.1 or more (default 1). It never enlarges: a picture already at or under it is refused; enlarging is imageUpscale.',
        fields: {
            megapixels: { min: 0.1, default: 1 },
        },
        media: MEDIA,
    },
];

/** The universal op each tool runs. */
const RUNS = { imageUpscale: 'imageUpscale', removeBackground: 'removeBackground', crop: 'resize', downscale: 'resize' };

/** Tools that need the source's pixel size (`agentDispatch._submitTool` decodes it). */
export const TOOLS_NEEDING_SIZE = new Set(['crop', 'downscale']);

const _even = (n) => Math.max(2, Math.floor(n / 2) * 2);
const _resizeParams = (width, height, position = 'center') => ({ width, height, keep_proportion: 'crop', crop_position: position, divisible_by: 2, upscale_method: 'lanczos' });

/** @returns {object|null} the tool entry for `op`, or null when it is not a tool. */
export function agentToolOp(op) {
    return AGENT_TOOL_OPS.find(t => t.op === op) || null;
}

/** The universal op a tool dispatches, for its media slots. */
export function toolOperation(op) {
    return RUNS[op] || null;
}

const _bad = (op, message) => ({ ok: false, code: 'INVALID_FIELD', message: `${message} Call describe_model with "${op}" for the values it accepts.` });

/**
 * A tool call's `fields` → the universal op and its injection params.
 *
 * @param {string} op - a tool op (`AGENT_TOOL_OPS`)
 * @param {object} [fields]
 * @param {{w:number, h:number}|null} [natural] - the source's pixel size; `crop` needs it
 * @returns {{ok:true, operation:string, injectionParams:object}|{ok:false, code:string, message:string}}
 */
export function toolRun(op, fields = {}, natural = null) {
    const f = fields && typeof fields === 'object' ? fields : {};
    if (op === 'imageUpscale') {
        const upscaler = f.upscaler ?? UPSCALERS[0];
        const factor = Number(f.factor ?? 2);
        if (!UPSCALERS.includes(upscaler)) return _bad(op, `upscaler must be one of ${UPSCALERS.join(', ')}.`);
        if (!FACTORS.includes(factor)) return _bad(op, `factor must be one of ${FACTORS.join(', ')}.`);
        // The file name, as the rail's model dropdown sends it (UpscaleModelLoader's list).
        const file = String(DEPS[upscaler].filename).split('/').pop();
        return { ok: true, operation: RUNS[op], injectionParams: { Upscale_Factor: factor, Upscale_Using_Model: true, Upscale_Model: file } };
    }
    if (op === 'removeBackground') {
        const bg = f.background ?? 'transparent';
        if (bg === 'transparent') return { ok: true, operation: RUNS[op], injectionParams: { Input_Bg_Use_Color: false } };
        if (!/^#[0-9a-f]{6}$/i.test(String(bg))) return _bad(op, 'background must be "transparent" or a colour "#rrggbb".');
        // EmptyImage.color is an int 0xRRGGBB, as the rail converts its picker.
        return { ok: true, operation: RUNS[op], injectionParams: { Input_Bg_Use_Color: true, Input_Bg_Color: parseInt(bg.slice(1), 16) } };
    }
    if (op === 'crop') {
        const ratio = RATIOS.get(String(f.ratio ?? ''));
        const position = f.position ?? 'center';
        if (!ratio) return _bad(op, `ratio must be one of ${[...RATIOS.keys()].join(', ')}.`);
        if (!POSITIONS.includes(position)) return _bad(op, `position must be one of ${POSITIONS.join(', ')}.`);
        if (!(natural?.w > 0 && natural?.h > 0)) return { ok: false, code: 'IMAGE_NOT_FOUND', message: 'The picture to crop could not be read.' };
        // The largest rect of the ratio inside the picture, even-sized for the graph.
        const wide = natural.w / natural.h > ratio;
        const width = _even(wide ? natural.h * ratio : natural.w);
        const height = _even(wide ? natural.h : natural.w / ratio);
        return { ok: true, operation: RUNS[op], injectionParams: _resizeParams(width, height, position) };
    }
    if (op === 'downscale') {
        const megapixels = Number(f.megapixels ?? 1);
        if (!(megapixels >= 0.1)) return _bad(op, 'megapixels must be a number of 0.1 or more, e.g. 0.5, 1 or 2.');
        if (!(natural?.w > 0 && natural?.h > 0)) return { ok: false, code: 'IMAGE_NOT_FOUND', message: 'The picture to downscale could not be read.' };
        // The History rail's MP family (MPI-796): 1 MP = 1024 x 1024, proportions kept.
        const dims = deriveResizeDims('megapixels', natural.w, natural.h, { megapixels });
        if (dims.width >= natural.w) {
            const mp = Math.round((natural.w * natural.h) / (1024 * 1024) * 100) / 100;
            return { ok: false, code: 'ALREADY_SMALLER', message: `The picture is ${natural.w}x${natural.h} (${mp} MP), already at or under ${megapixels} MP, so it was left as it is. Enlarging is imageUpscale.` };
        }
        return { ok: true, operation: RUNS[op], injectionParams: _resizeParams(_even(dims.width), _even(dims.height)) };
    }
    return { ok: false, code: 'UNKNOWN_OPERATION', message: `"${op}" is not a tool.` };
}
