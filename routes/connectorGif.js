'use strict';

/**
 * routes/connectorGif.js — MPI-830: the connector's GIF surface.
 *
 * The GIF workspace (MPI-757 and its siblings) shipped with no way in from
 * outside the UI. The raw `/gif/*` and `/gif-cutout/*` routes existed, but a
 * caller that POSTs them gets a `.gif` and a sidecar and NO GALLERY CARD:
 * those routes deliberately never touch `project.json` (`routes/gifMake.js`'s
 * header says so), because while a project is open the RENDERER owns
 * `itemGroups` and writes the whole array back on every save — the same rule
 * `routes/connector.js`'s header states for card renames. A server-side
 * `project.json` write is silently overwritten on the next save.
 *
 * So every verb here goes over the connector's existing renderer job channel,
 * exactly as `generation.submit`, `project.open` and `card.rename` do. The
 * cut-out has a second reason to: its masks come from `runGifCutoutTrack()`
 * (`js/services/commandExecutor.js`), which dispatches through `getEngine()`,
 * and a server-side mask producer would be a SECOND engine-dispatch path —
 * the thing `routes/connector.js`'s header forbids, and the local/remote twin
 * trap reopened.
 *
 * Own route file per the MPI-757 plan's E3, the same precedent `gifMake.js` /
 * `gifMaker.js` / `gifCutout.js` follow. It also keeps this card's diff out of
 * `routes/connector.js`, which the in-app agent cards are live ground for.
 *
 *   POST /connector/gif/make      -> a new GIF card, from still cards or a video
 *   POST /connector/gif/edit      -> a new entry on the same card: timing, output,
 *                                    resize, crop
 *   POST /connector/gif/cutout    -> a new transparent entry with the subject cut out
 *   POST /connector/gif/to-video  -> a new VIDEO card beside the GIF
 *
 * Envelope is the connector's, not the `/gif/*` routes': `{ ok: true, ... }` or
 * `{ ok: false, error: { code, message } }`. HTTP 400 for a malformed body, 200
 * for everything else.
 *
 * **Validation here is SHAPE ONLY** — required fields, types, and the one enum
 * this route owns (`method`). Bounds like fps 1-60 or the size presets belong to
 * `routes/gifMaker.js` and stay there; re-stating them would be two sources of
 * truth for one rule, and the renderer surfaces their 400 text as the error
 * message anyway.
 *
 * Not in v1 (Fabio, 2026-09-19): the By colour mask method (renderer canvas
 * code, and largely redundant with `background`), SAM3 object chips (an agent
 * cannot read the numbered preview video that says which index is which), the
 * Mask Brush, and per-frame / selected-frame scope.
 */

const express = require('express');
const router = express.Router();
const logger = require('./logger');
const { dispatchToRenderer } = require('./connector');

const MASK_METHODS = new Set(['background', 'name']);
/** Every `edit` knob. At least one must be present, or the call is a no-op. */
const EDIT_KEYS = ['fps', 'loop', 'trim', 'output', 'resize', 'crop'];

function _bad(res, message) {
  return res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message } });
}

const _isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const _isId = (v) => typeof v === 'string' && v.trim() !== '';

/** Dispatch and log a failure once, centrally — every verb ends the same way. */
async function _run(res, capability, input) {
  const result = await dispatchToRenderer(capability, input);
  if (!result.ok) {
    logger.warn('connector', `${capability} failed: ${result.error?.code} ${result.error?.message}`);
  }
  res.json(result);
}

/**
 * POST /connector/gif/make — a NEW GIF card.
 *
 * Two sources, exactly one per call:
 *   `{ itemIds: [>= 2] }`  — still image cards, in order (over `/gif/make`).
 *   `{ videoItemId, fps, sizePreset?, loop?, trimIn?, trimOut? }` — a clip of a
 *     video card (over `/gif/maker`). `trimIn`/`trimOut` are clip-seconds and
 *     come as a pair.
 */
router.post('/connector/gif/make', async (req, res) => {
  const { itemIds, videoItemId } = req.body || {};

  const fromStills = itemIds !== undefined;
  const fromVideo = videoItemId !== undefined;
  if (fromStills === fromVideo) {
    return _bad(res, 'Send either body.itemIds (two or more image cards) or body.videoItemId (one video card), not both and not neither.');
  }

  if (fromStills) {
    if (!Array.isArray(itemIds) || itemIds.length < 2 || !itemIds.every(_isId)) {
      return _bad(res, 'body.itemIds must be an array of two or more item ids.');
    }
    return _run(res, 'gif.make', { itemIds });
  }

  if (!_isId(videoItemId)) return _bad(res, 'body.videoItemId must be an item id.');
  const { fps, sizePreset, loop, trimIn, trimOut } = req.body;
  if (typeof fps !== 'number') return _bad(res, 'body.fps is required with videoItemId, and must be a number.');
  if ((trimIn === undefined) !== (trimOut === undefined)) {
    return _bad(res, 'body.trimIn and body.trimOut come as a pair, in clip-seconds.');
  }
  return _run(res, 'gif.make', { videoItemId, fps, sizePreset, loop, trimIn, trimOut });
});

/**
 * POST /connector/gif/edit — a new entry on the SAME card (history, not a new card).
 *
 * `{ itemId }` plus at least one of:
 *   `fps`    — retime every frame (`max(2, round(100 / fps))` hundredths, the
 *              workspace's own Speed math),
 *   `loop`   — TOTAL plays; 0 = forever,
 *   `trim`   — `{ in, out }`, frame indices, inclusive,
 *   `output` — `{ colours?, edgeColour?, maxEdge? }`; `edgeColour` is `"#rrggbb"`
 *              for a transparent build or `null` for an opaque one,
 *   `resize` — `{ width, height }`,
 *   `crop`   — `{ x, y, width, height, fill?, outWidth?, outHeight? }`.
 *
 * Resize and crop write new frame files; the rest only rewrite the frame list.
 * A call may carry several, and they are applied in the order above.
 */
router.post('/connector/gif/edit', async (req, res) => {
  const body = req.body || {};
  if (!_isId(body.itemId)) return _bad(res, 'body.itemId must be an item id.');

  const asked = EDIT_KEYS.filter((k) => body[k] !== undefined);
  if (!asked.length) {
    return _bad(res, `body must carry at least one edit: ${EDIT_KEYS.join(', ')}.`);
  }
  if (body.trim !== undefined && !_isObject(body.trim)) return _bad(res, 'body.trim must be { in, out }.');
  if (body.output !== undefined && !_isObject(body.output)) return _bad(res, 'body.output must be an object.');
  if (body.resize !== undefined && !_isObject(body.resize)) return _bad(res, 'body.resize must be { width, height }.');
  if (body.crop !== undefined && !_isObject(body.crop)) return _bad(res, 'body.crop must be { x, y, width, height }.');

  const input = { itemId: body.itemId };
  for (const k of asked) input[k] = body[k];
  return _run(res, 'gif.edit', input);
});

/**
 * POST /connector/gif/cutout — cut the subject out of every frame.
 *
 * `{ itemId, method: 'background' | 'name', prompt?, adjust?, invert? }`.
 * `background` is BiRefNet and takes no prompt; `name` is the SAM3 video
 * tracker and requires one ("robot", "the woman in red"). `adjust` is
 * `{ grow?, outward?, inward?, edge?, fillHoles? }`, `invert` swaps which side
 * survives. The result is ALWAYS a transparent entry.
 *
 * The masks stay white = KEEP end to end. Every flip in the workspace is
 * `MpiGifViewer`'s display override and never reaches a caller.
 */
router.post('/connector/gif/cutout', async (req, res) => {
  const { itemId, method, prompt, adjust, invert } = req.body || {};

  if (!_isId(itemId)) return _bad(res, 'body.itemId must be an item id.');
  if (!MASK_METHODS.has(method)) {
    return _bad(res, `body.method must be one of ${[...MASK_METHODS].join(', ')}.`);
  }
  if (method === 'name' && !_isId(prompt)) {
    return _bad(res, 'body.prompt is required for method "name" — what to track, e.g. "robot".');
  }
  if (adjust !== undefined && !_isObject(adjust)) return _bad(res, 'body.adjust must be an object.');
  if (invert !== undefined && typeof invert !== 'boolean') return _bad(res, 'body.invert must be a boolean.');

  return _run(res, 'gif.cutout', { itemId, method, prompt, adjust, invert });
});

/**
 * POST /connector/gif/to-video — a new VIDEO card beside the GIF.
 *
 * `{ itemId, background? }`. `background` is `"#rrggbb"` and fills what a
 * transparent GIF leaves clear, because h264 carries no alpha. The GIF card is
 * left alone.
 */
router.post('/connector/gif/to-video', async (req, res) => {
  const { itemId, background } = req.body || {};

  if (!_isId(itemId)) return _bad(res, 'body.itemId must be an item id.');
  if (background !== undefined && typeof background !== 'string') {
    return _bad(res, 'body.background must be a "#rrggbb" string.');
  }

  return _run(res, 'gif.to-video', { itemId, background });
});

module.exports = router;
