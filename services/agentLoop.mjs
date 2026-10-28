/**
 * services/agentLoop.mjs — the in-app agent loop (MPI-774 slice A).
 *
 * One loop is one conversation, in server memory (brief item 14); `agentSessions.mjs`
 * keeps one per project and one for the landing page. The renderer re-renders from
 * GET /agent/history, so Landing → Gallery → History keeps the conversation. Nothing
 * is written to disk except the project notes (`agentMemory.mjs`).
 *
 * Design decisions (all Fabio-accepted, 2026-09-15):
 * - D2: install gate is structural (Yes / No card); the loop never calls install
 *   without a confirm.
 * - D3: replies arrive whole per model turn; token streaming is not in slice A.
 * - Non-blocking generate: the loop fires generate and gets back a "started"
 *   tool result; when the HTTP call settles, agent:result is emitted.
 * - Compaction at 50% (or 20% for windows ≥ 1M) of prompt_tokens / contextWindow,
 *   from the provider's own usage. No tokenizer.
 * - The connection (profile + key) is the SHARED one every LLM job uses
 *   (`resolveConnection`, llmEngines.mjs). The model is the agent's own pick,
 *   sent with each message; '' means the connection's recommended agent model.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
    chatEngineFor,
    OLLAMA_AGENT_CONTEXT,
    resolveConnection,
    recommendedModel,
    agentFallbackModel,
    listRemoteModels,
    RECOMMENDED_REMOTE_MODELS,
    FALLBACK_CONTEXT_WINDOW,
} from './llmEngines.mjs';
import * as realTools from './agentTools.mjs';
import { MAX_NOTES } from './agentMemory.mjs';
import { agentToolOp } from '../js/shell/agentToolOps.js';
import { viewFile as _viewClipFile } from './cardView.js';
import { GIF_ACTIONS } from './agentGifTools.mjs';
import { madeWith } from './agentCards.mjs';
import { MODELS } from '../js/data/modelConstants/models.js';
import { modelShowsStyleRack } from '../js/data/commandRegistry.js';

// A video or GIF ref (MPI-941 Phase 4): `look` samples it into ONE contact sheet instead of
// sending it to the describer whole. Mirrors cardView.js's own MOVING set (not exported).
const CLIP_EXT = /\.(mp4|webm|mov|mkv|m4v|gif)$/i;

// ---------------------------------------------------------------------------
// Tool definitions — OpenAI tools format
// ---------------------------------------------------------------------------

export const TOOL_DEFS = [
    {
        type: 'function',
        function: {
            name: 'list_models',
            description: 'The short catalogue: every model and Flow, one compact entry each — id, name, type, installed state, and its operations with the rank for that task (1 = the best we have; best: true = the top one installed here) and a note on what it is good at. It carries no settings: describe_model gives one entry\'s params, media roles, Flow fields and guide ids.',
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'describe_model',
            description: 'Everything list_models left out, for ONE model or Flow: each op\'s params (the only ratio, qualityTier, turbo and style values it accepts), the media it takes, a Flow\'s fields and boxes, its prompting guide ids and its hardware fit. Read it for the thing you picked, before you set anything on it.',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'A model id or a Flow id, exactly as list_models gives it.' },
                },
                required: ['id'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'read_knowledge',
            description: 'Read a knowledge entry by id (returns title + full text), or list all entries by omitting id (returns the index).',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Entry id. Omit to list all entries.' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'install_model',
            description: 'Show the user a Yes / No card to install a model or Flow. Installation only runs after Yes is clicked. The card IS the question: call it, never ask in words first, and never install without it, in any mode.',
            parameters: {
                type: 'object',
                properties: {
                    modelId: { type: 'string', description: 'A model or Flow id.' },
                },
                required: ['modelId'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'generate',
            description: 'Start a generation (model op or Flow). Fires without blocking — the result appears in the chat when ready. With no project open this returns NO_PROJECT: call create_project, then send the same generate again. To run the SAME op over several existing cards ("upscale all of these"), pass them all in `cards` on ONE call rather than calling this tool once per card. To make several of the SAME request ("a batch of two", "give me four"), send `count` on ONE call rather than calling this tool again.',
            parameters: {
                type: 'object',
                properties: {
                    modelId: { type: 'string' },
                    operation: { type: 'string' },
                    flowId: { type: 'string' },
                    prompt: { type: 'string' },
                    negative: { type: 'string' },
                    ratio: { type: 'string' },
                    // No enum: tiers differ per model (FLUX.3, Krea 2 and LTX use 1k/2k/4k); resolveNamedParams checks them.
                    qualityTier: { type: 'string', description: 'One of the op\'s params.qualityTiers.' },
                    turbo: { type: 'boolean' },
                    duration: { type: 'number', description: 'Seconds, in the op\'s params.duration range. A clip: see the Duration rule.' },
                    category: { type: 'string', description: 'One of the op\'s params.categories.' },
                    language: { type: 'string', description: 'The line\'s language, one of the op\'s params.languages.' },
                    denoise: { type: 'number', description: 'Only on an op whose params list it (i2i, upscale, detail): 0 to 1. The higher it is, the more the image changes: low keeps the picture and its pose, high repaints it. Unset = params.denoise.default.' },
                    tiles: { type: 'boolean', description: 'Upscale, where params.tiles: app-named tiles, people and faces unnamed. Each gets the WHOLE prompt: look or none, never the scene.' },
                    tileSize: { type: 'number', description: 'With tiles: one of params.tileSizes; smaller = more detail.' },
                    upscaleFactor: { type: 'number', description: 'One of params.upscaleFactors; 1 keeps the size and needs tiles.' },
                    transparent: { type: 'boolean', description: 'Where params.transparent: no background. Describe the subject alone.' },
                    fastMotion: { type: 'boolean', description: 'Where params.fastMotion; the model guide says when.' },
                    boxes: { type: 'array', items: { type: 'object' }, description: 'Where params.boxes: [{ name, x, y, w, h, desc }], x, y the top-left, all 0-1 of the picture; cite a box as <name>.' },
                    styleSelect: { type: 'string' },
                    stylization: { type: 'number' },
                    seed: { type: 'integer' },
                    cardName: { type: 'string', description: 'Optional short name for the card this generation creates.' },
                    redo: { type: 'boolean', description: 'True when this retries a generation that failed or came out wrong.' },
                    wait: { type: 'boolean', description: 'Wait for this generation to finish and return its result, instead of starting it and moving on. Use it when a LATER step in the same request needs this output — the result carries the filePath you then pass as media. Leave it off for the last step, so the chat stays free while it runs.' },
                    fields: { type: 'object', description: 'Flow field values.' },
                    params: { type: 'object', description: 'Flow step params: a measured box, e.g. { box1: { x, y, width, height } }, or the frame an outpaint grows to, e.g. { frame: { ratio: "4:5", grow: "up" } }. app:flows says how to pick both.' },
                    open: { type: 'boolean', description: 'A Flow only: open it on the user\'s screen, filled, for them to finish and run, instead of running it: when they ask, or it needs what only they have.' },
                    media: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                role: { type: 'string' },
                                image: { type: 'string', description: 'One of the refs the App state line lists as images you can look at.' },
                                voice: { type: 'string', description: 'In place of image: a library voice id describe_model lists.' },
                                frame: { type: 'string', enum: ['last'], description: 'A clip as a picture is its first frame; last sends its last frame.' },
                            },
                            required: ['role'],
                        },
                    },
                    cards: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Run this same op once per card, in ONE call: the refs go into the op\'s required image slot and everything else (model, operation, prompt, settings) is shared. Use it whenever the user asks for the same thing over several pictures — one call instead of one per card, and the user is asked to confirm above five. Model ops only, never a Flow, and it replaces `media`: do not send both. The cards are not described afterwards; look at one yourself if you need to.',
                    },
                    count: {
                        type: 'integer',
                        minimum: 1,
                        description: 'How many of this exact generation to make, each its own card ("a batch of two" is 2). The app runs them as one batch where the model can, and queues them one after another where it cannot; the user is asked once for all of them. Model ops only, never a Flow, and never with `cards`. The results are not described afterwards; look at one yourself if you need to.',
                    },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'cancel_generation',
            description: 'Stop a generation you started that has not finished, whether it is rendering or still waiting in the queue. Call it when the user takes a request back ("scratch that", "cancel it", "never mind", "stop"). With no toolCallId it stops the latest one you started; pass the toolCallId that generate returned to stop an earlier one. It cannot stop a generation the user started themselves.',
            parameters: {
                type: 'object',
                properties: {
                    toolCallId: { type: 'string', description: 'The toolCallId generate returned. Omit it for the latest one.' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'look',
            description: 'Describe an image, video or GIF the App state line lists (a clip as sampled frames). A crop or box is stills-only. It cannot open a folder or any other path.',
            parameters: {
                type: 'object',
                properties: {
                    image: { type: 'string', description: 'One of the refs the App state line lists as images you can look at. Nothing else resolves.' },
                    // MPI-817: live 2026-09-21, "Tell me what you see" arrived here as a question, so a
                    // card described 6 minutes earlier was described again from scratch. The plain
                    // description is the one that gets kept; a question never is.
                    question: { type: 'string', description: 'Only for something the plain description would not answer ("what colour is her jacket?", "how many people?"). OMIT it to describe the picture: that answer is kept on the card, so asking again is free and instant, while a question always spends a fresh vision call.' },
                    crop: {
                        type: 'object',
                        properties: { x: { type: 'integer' }, y: { type: 'integer' }, width: { type: 'integer' }, height: { type: 'integer' } },
                        required: ['x', 'y', 'width', 'height'],
                    },
                    box: { type: 'boolean', description: 'Return output.box {x, y, width, height}, in the image\'s own pixels, around what the question names (e.g. question "the woman\'s head"), and output.square, the same box made square. Also output.imageSize and output.boxShare / output.squareShare, each {w, h}: what that box takes of the image, so you can tell a head from a whole person before you use it. Needs a question.' },
                },
                required: ['image'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_projects',
            description: "List the user's projects, most recently used first, each with the folderPath open_project takes.",
            parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
    },
    {
        type: 'function',
        function: {
            name: 'create_project',
            description: 'Create an empty project, open it, and return its folderPath. A project of that name already exists (case ignored) → that one is opened and returned with existing: true, never a second copy of it.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'The project name, e.g. "New Project", or a short title for the user\'s goal.' },
                },
                required: ['name'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'open_project',
            description: 'Open a project so the next generate lands there. folderPath must come from list_projects, from create_project, or from the user.',
            parameters: {
                type: 'object',
                properties: {
                    folderPath: { type: 'string', description: 'The project folder.' },
                },
                required: ['folderPath'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'rename_card',
            description: 'Give a gallery card a short name, so you and the user can refer to it: a card you generated, or one list_cards or visible_cards returned. A card that already has a name keeps it unless the user asks for a new one.',
            parameters: {
                type: 'object',
                properties: {
                    groupId: { type: 'string', description: 'The card id a finished generation reported, or a groupId from list_cards or visible_cards.' },
                    name: { type: 'string', description: 'A short human name, e.g. "Mira at the harbour".' },
                },
                required: ['groupId', 'name'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_cards',
            description: 'What the open project ALREADY holds: everything made before this conversation, by anyone. No groupId: the newest cards, one short row each (name, ref, kind, the model or flow and operation that made it, size, a clip\'s real length, the start of its prompt). A row with stack: N is a stack of N cards: pass its ref as cards; its groupId lists them. A groupId: that one card in full, with the whole prompt, the settings that ran, and madeFrom, the refs it was made from. Every ref it returns can be passed to look, and to generate as media, a video included (as a picture, its first frame; any other frame is the user\'s right-click Create snapshot).',
            parameters: {
                type: 'object',
                properties: {
                    groupId: { type: 'string', description: 'A groupId from the list, to read that one card in full.' },
                    limit: { type: 'integer', description: 'How many cards to list, newest first. Default 12, at most 30.' },
                    mark: { type: 'string', enum: ['dot', 'square', 'triangle'], description: 'Only the cards the user marked with this shape. "dot" is the one that draws as a circle. A row carries its mark when it has one.' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'send_cards',
            description: 'Copy cards from the open project to another one, as Add to project does; each keeps its prompt and name. Pick them by cards, or by kind, mark and newest ("the last two", "all the videos"). folderPath: the user stays here. newProject: it is created, then opened.',
            parameters: {
                type: 'object',
                properties: {
                    cards: { type: 'array', items: { type: 'string' }, description: 'Card refs; a set ref sends all its cards.' },
                    kind: { type: 'string', enum: ['image', 'video', 'audio'] },
                    mark: { type: 'string', enum: ['dot', 'square', 'triangle'] },
                    newest: { type: 'integer', description: 'Only the newest N.' },
                    folderPath: { type: 'string', description: 'From list_projects.' },
                    newProject: { type: 'string' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'visible_cards',
            description: 'The cards the user is LOOKING AT: what the gallery shows right now under their filter, in the order it shows them ("the cards I can see", "these", "the first three"). Rows are list_cards rows and every ref works the same way; each row\'s `kind` says image or video, so counting or telling them apart needs no look. `filter` is the filter in the app\'s own words, empty when nothing is hidden: say what you are about to act on before you act on many cards. GALLERY_NOT_OPEN means the gallery is not on screen: say so, never fall back to the whole project.',
            parameters: {
                type: 'object',
                properties: {
                    limit: { type: 'integer', description: 'How many rows to return, from the top of the gallery. Default and most: 30. `total` is how many are showing.' },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'mark_card',
            description: 'Set or clear the shape mark on a gallery card in the open project: the mark the user filters the gallery by. Only when the user asks for it.',
            parameters: {
                type: 'object',
                properties: {
                    groupId: { type: 'string', description: 'A groupId from list_cards or visible_cards, or one a finished generation reported.' },
                    mark: { type: 'string', enum: ['dot', 'square', 'triangle', 'none'], description: '"dot" draws as a circle. "none" clears the mark.' },
                },
                required: ['groupId', 'mark'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'gif',
            // MPI-1125: four GIF tools and make_sheet in one; each action's settings are app:gifs.
            description: 'GIFs and picture sheets from gallery cards: make a GIF from stills or a clip, edit one (speed, trim, loop, colours, size, crop), cut its subject out onto transparency, turn one into a video, or pack stills into one sheet (character sheet, mood board). Read app:gifs first.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: Object.keys(GIF_ACTIONS) },
                    images: { type: 'array', items: { type: 'string' }, description: 'make, sheet: card refs, in order.' },
                    video: { type: 'string', description: 'make: one video card ref.' },
                    gif: { type: 'string', description: 'edit, cutout, to_video: a GIF card ref.' },
                    settings: { type: 'object', description: 'Everything else, as app:gifs names it.' },
                },
                required: ['action'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'read_memory',
            description: 'Read your notes. No file: the list. A file: that note in full.',
            parameters: {
                type: 'object',
                properties: {
                    file: { type: 'string', description: 'A note file from the list.' },
                    scope: { type: 'string', enum: ['project', 'global'] },
                },
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'write_memory',
            description: 'Save one note; kept after a restart, and the same file replaces it.',
            parameters: {
                type: 'object',
                properties: {
                    file: { type: 'string', description: 'A lowercase slug ending in .md.' },
                    title: { type: 'string', description: 'A short title.' },
                    hook: { type: 'string', description: 'One line on when the note matters.' },
                    text: { type: 'string', description: 'The note in Markdown, at most about 600 words.' },
                    scope: { type: 'string', enum: ['project', 'global'], description: 'Default project. global only when the user asks to keep it for every project.' },
                    delete: { type: 'boolean', description: 'Forget this note.' },
                },
                required: ['file'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'routine',
            description: 'Chains of steps saved once; you run one on any cards in one call. Offer to save one when the user repeats steps.',
            parameters: {
                type: 'object',
                properties: {
                    action: { type: 'string', enum: ['list', 'save', 'run', 'rename', 'delete'] },
                    name: { type: 'string', description: 'A lowercase slug.' },
                    newName: { type: 'string', description: 'rename: the new slug.' },
                    summary: { type: 'string', description: 'save: one plain line.' },
                    steps: { type: 'array', items: { type: 'object' }, description: 'save: generate args in order; see app:routines.' },
                    inputs: { type: 'array', items: { type: 'object' }, description: 'save: what a run takes besides the cards.' },
                    cards: { type: 'array', items: { type: 'string' }, description: 'run: groupIds or a set ref.' },
                    values: { type: 'object', description: 'run: { input id: value }' },
                },
                required: ['action'],
                additionalProperties: false,
            },
        },
    },
];

// MPI-1208 — the long side of a picture `look` shows a vision model: ~500 tokens a request
// where 1 MP is ~1,300, and still enough to tell one face from another.
// ponytail: one size for stills and clip sheets; a sheet's frames are small at 768.
const SEE_LONG_SIDE = 768;
// What a description cannot carry, on a plain look's result for a model that can see.
// MPI-1208: a closing "see: true shows you the picture" read as an invitation; MiMo-V2.6-Flash saw on every plain look (0/3).
const SEE_LIMITS = "These are the describer's words, enough to say what the picture shows. They name hair, clothes, pose and setting alike for two different faces, and they flatten grain and colour: only for those is see: true worth its cost.";

// MPI-1208 — a vision model's list: TOOL_DEFS with `see` on look. Picked per model, so the
// list stays the same for the whole chat and the prompt cache holds (see WAKE_TOOLS below).
const VISION_TOOL_DEFS = TOOL_DEFS.map((t) => (t.function.name !== 'look' ? t : {
    ...t,
    function: {
        ...t.function,
        parameters: {
            ...t.function.parameters,
            properties: {
                ...t.function.parameters.properties,
                see: { type: 'boolean', description: 'Show you the picture itself instead of its description (a clip as its frame sheet). It costs about 500 tokens on every request until the turn ends, and the next turn no longer has it. The description is enough for most jobs; see when words cannot settle it: whether two pictures show the same person or face, why a result missed the ask, a fine quality of the look (grain, a colour cast), or a description that already proved wrong. With see, ask yourself the question; a box still needs the describer.' },
            },
        },
    },
}));

// MPI-870 — what a WAKE turn may call. A wake was not asked for: the user did not type,
// and they may be mid-edit in a workspace, so the two tools that move them off what they
// are looking at are off the table (rule 4 of Fabio's seven). MPI-1125: refused when called,
// not left out of the list: a different tool list misses the provider's prompt cache, and a
// wake paid the whole floor uncached (measured 0 of 8,117 tokens cached).
const WAKE_REFUSED = new Set(['open_project', 'create_project']);

// MPI-870 — above how many cards a fan-out asks the user first. Fabio, 2026-09-21: five.
// Below it the batch IS what they asked for, and a yes/no card is in the way.
const BATCH_CONFIRM_ABOVE = 5;

// MPI-870 — the runaway bound (rule 5). A wake turn can itself dispatch a generation, whose
// drain would wake again; this caps the chain when the user has said nothing in between.
// The knob, not a law of nature: raise it if three ever proves too few.
const MAX_WAKES_IN_A_ROW = 3;

// MPI-1286 — how many times one model op may fail on the engine before a further try waits on
// the user. Live 2026-10-28 an H3 error 1450 woke the agent three times and it resent the same
// job each time (the wake bound above was the only stop): one retry, then it is the user's call.
const MAX_ENGINE_FAILS = 2;
// A job that ran and failed (agentDispatch `onError` / an empty run); every other code is a refusal before it ran.
const ENGINE_FAIL_CODES = new Set(['RUNTIME_ERROR', 'NO_OUTPUT']);
const _failKey = (args) => `${args.flowId || args.modelId || ''}\n${args.operation || ''}`;
/** What a failed run adds to its note about sending it again: once, then stop. */
const _retryNote = (fails) => (fails >= MAX_ENGINE_FAILS
    ? ' It has now failed twice: do not send it again. Tell the user in one line what failed, quoting the error, and ask what to do, ending on [options: Try again | Something else].'
    : ' You may send it once more; if that fails too, stop and tell the user.');

// Max tool ROUNDS in one user turn (a round is one model reply, however many calls it
// carries). 8 was exactly one still -> look -> animate chain with no round left to say so
// (Fabio, 2026-09-20): every generate costs about four — settings, guide, generate, look.
// 16 -> 20 (MPI-1286): a pre-scene join was two generates (an invented start picture, then
// the clip) plus reading the clip, the cards and app:joining-clips, and ran out of rounds.
// Now it is the clip alone; 20 stays as headroom.
export const MAX_STEPS = 20;

// Sent with the one call made after the last round, and never kept in the conversation.
const MEMORY_NUDGE = 'Nothing is noted this turn. If the user stated a goal, a character, a look or a decision, save it with write_memory now; nothing to keep, ignore this.';
// MPI-1280: the same ask when the turn ended on its start line, read at the next turn's opening.
const MEMORY_LATER = '[Your last turn noted nothing. If the user stated a goal, a character, a look or a decision there, save it with write_memory; nothing to keep, ignore this.]';
const EDIT_OPS = new Set(['edit', 'kleinEdit', 'krea2Edit', 'qwenEdit']);
// MPI-1125 — rules only one kind of op needs. They were system-prompt rules paid on every
// request; now they ride on the describe_model (or list_cards) result that precedes the call
// they govern, once per context. `when` reads one op of the entry describe_model returns.
export const OP_RULES = [
    { id: 'tier', when: (o) => Object.keys(o.params?.tierSizes || {}).length > 0,
        text: 'A tier\'s name is not its size: match a named resolution on params.tierSizes (1K = 1080p = full HD = 1920 on the long side) and say the pixels. qualityTiers run smallest to largest: the last is this model\'s max, the one for "max", "highest" or "full resolution". A picture nobody asked a size for leaves qualityTier out: the smallest is used.' },
    { id: 'clip', when: (o) => !!o.params?.duration && !o.params?.categories,
        text: 'Duration: a clip defaults to 2 to 3 seconds: ONE continuous action fits. Only a SEQUENCE of beats, or a spoken line too long for 3 seconds, earns more, and budget less than your first instinct. The user naming a length always wins. Say the durationSeconds the result reports; until then say "I asked for N seconds". When it finishes the app wakes you, and you report it then. Every new clip starts at the defaults, quality at the lowest tier, and a setting rises only when the user\'s words for THAT clip ask for it; only a redo keeps its card\'s settings.' },
    // MPI-1208: "a generation from a picture crops it to the ratio" read as "this op changes the
    // shape", and a pose change went to i2i for its ratio. Edits are out: one listing ratios
    // re-composes a new frame (FLUX.3 Klein), it does not crop.
    { id: 'shape', when: (o) => o.params?.ratios?.length > 0 && (o.media || []).some((m) => m.type === 'image') && !EDIT_OPS.has(o.op),
        text: 'Shape: a ratio here only crops the picture before the run (never letterboxes): it cuts part of the frame away and changes nothing else. Leave ratio out and the picture\'s own shape is used; only when the user asks for a ratio, say in one line before you generate that part of the picture will be cropped.' },
    { id: 'text', when: (o) => o.params?.ratios?.length > 0 && !o.params?.duration,
        text: 'Words in a picture: quote them exactly, in double quotes, and say where they go. Never refuse, never send the user to another app, never warn in advance that they may be misspelled. Never judge the words from your own look at the result (it misreads small, angled or wrapped lettering): never say they are wrong and never re-run for them on your own. Ask the user to check the lettering, and re-run only when they say it is wrong.' },
];
/** A generation the user Stopped (CANCELLED, not asked for by the agent): what the model is told (MPI-1165). */
const STOPPED = { code: 'CANCELLED', message: 'The user pressed Stop: they were not happy with it. Not a failure. Start nothing: say in one short line that it is stopped, ask what to change, and wait for their message.' };
export const REPEAT_RULE ='To repeat this card: made from text, the same op with its prompt rewritten by the new model\'s guide; made from a picture, that picture (a clip in a picture slot sends its start picture or first frame). Never a finished result as its own reference.';

// MPI-1233 — the share of the window a conversation fills before it compacts. Fabio, 2026-10-21:
// MPI-1125's fixed 128k cap was costed on DeepSeek's cached rate; MiMo's is ~5x cheaper.
const BIG_WINDOW = 1_000_000;
const COMPACT_SHARE_BIG = 0.20;
const COMPACT_SHARE = 0.50;

const OUT_OF_ROUNDS = 'You are out of tool calls for this turn. In plain words, tell the user what you did, what is still running, and what is left to do. They can reply to continue.';

// How long a `generate` waits to see whether its dispatch is REFUSED before reporting
// it started. A refusal is validation — the route answers over loopback in milliseconds,
// and the renderer's own refusals are one SSE round trip — while a generation that is
// actually running resolves only when it FINISHES, seconds to minutes later. So this
// window catches every refusal and no success (MPI-774 Phase 7).
//
// It is paid in full on every generation that DOES start: one second before the model can
// write its closing sentence. That is the price of never narrating a success that did not
// happen, and this constant is the knob if the trade ever reads wrong.
const EARLY_REFUSAL_MS = 1000;

// MPI-1127 (Fabio, 2026-10-13): Cosmo never installs the engine. The shared NO_ENGINE text
// names install_engine, an outside agent's tool, so Cosmo's copy says what the user does.
const cosmoNoEngine = (r) => (r?.error?.code === 'NO_ENGINE'
    ? { ok: false, error: { code: 'NO_ENGINE', message: 'Nothing was installed: there is no ComfyUI engine on this computer. You cannot install it. Tell the user: in Settings > Remote, turn off "Skip the local engine install" to install it, or connect a RunPod Pod there. Then ask again.' } }
    : r);

// What a fan-out's result says about its cards once they are queued (MPI-941).
const BATCH_STARTED = 'The chat shows one progress line, and one note comes when the last has finished. Do not look at them: the user judges them in the gallery.';

// Ops that run on a painted mask; with one painted, generate wants app:masking read first.
// The plain tool and every model's upscale op: app:upscaling picks between them (MPI-1053).
const UPSCALE_OPS = new Set(['upscale', 'imageUpscale']);
const MASKED_OPS = new Set(['edit', 'kleinEdit', 'krea2Edit', 'qwenEdit', 'inpaint', 'detail', 'i2i']);

// The project note that holds what was asked for and never landed (`_trackUnfinished`).
const UNFINISHED_FILE = 'unfinished-generations.md';
const _isUnfinishedFile = (file) => String(file || '').trim().toLowerCase() === UNFINISHED_FILE;

/**
 * What the model sees of a `list_models` answer (MPI-774 Phase 7).
 *
 * The whole answer is ~9.5k tokens and the weight is `params`, repeated PER OP:
 * `krea2-nsfw` alone costs 512 tokens, 420 of it the same 9 ratios, 2 tiers and 14
 * style names on each of its 7 ops, and the next model repeats most of that list
 * again. On the 32k window Ollama serves that is a third of the context spent before
 * the user's first word, and it compacted every turn.
 *
 * So the list is a POINTER list, exactly as the guides already are (`list_models`
 * named the guide ids, `read_knowledge` fetched one): enough to CHOOSE — id, name,
 * type, what is installed, the op ranks and notes — and `describe_model` hands back
 * the settings for the ONE thing the agent picked.
 *
 * `guides` and `boxParams` are not dropped, they move: the loop reads them off the
 * full answer itself (`_rememberGuides`), so the guide gate and the box gate still
 * bite without the model carrying the ids.
 */
/**
 * MPI-1286 (Fabio, 2026-10-28) — what each video op DOES, said where the model chooses. Op codes
 * alone never said that `i2v_ms` lands on an exact end frame and `ref2v_ms` does not, and slots
 * were learned only from describe_model on the model ALREADY picked: Singularity H3 has no end
 * frame, so a pre-scene never met its clip. Taught once here, not as a rule per wording.
 */
export const VIDEO_OPS = 'Image to video (i2v): start frame alone, the clip opens on exactly that picture, keeping who and what is in it. Start + end frame: it opens on one and lands exactly on the other; the only way to meet another clip cleanly at a cut, so a clip before, after or between the user\'s clips takes them (app:joining-clips). End frame alone (no start frame): the clip builds up to exactly that picture, e.g. people walking into the shot, or a scene leading into the user\'s clip; never make a start picture for it. Reference to video (ref2v): pictures, clips and sound for who and what is in it and how they move or sound; a picture cited as the first frame often opens it, not always, and only when the prompt does not describe it. Text to video (t2v): words only. A clip as a picture is its first frame, frame "last" its last; any other frame is the user\'s Create snapshot.';

/** A video op's media slots in a word each: the frames by name, the rest by kind. */
const _takes = (media) => [...new Set((media || []).map((r) => (
    r.role === 'startFrame' || r.role === 'inputStartFrame' ? 'start frame'
        : r.role === 'endFrame' ? 'end frame'
            : { image: 'pictures', video: 'clips', audio: 'sound' }[r.type])).filter(Boolean))];

export function compactCatalogue(list) {
    if (!list?.ok) return list;
    const hasVideo = (list.models || []).some((m) => m.type === 'video');
    // MPI-916: `best: true` on the lowest-ranked op per task that is installed, runs on this
    // machine and is free. With ranks 1-2 not installed, cheaper models took rank 5 over
    // rank 3; reading one flag is not arithmetic they can get wrong.
    const best = new Map(); // task -> { rank, key }
    // The tools compete too, as the ops of a model with no id (MPI-904): the plain upscale
    // ranks first for `upscale`, and a flag the loop never computed for it could not say so.
    for (const m of [...(list.models || []), { id: '', ops: list.tools || [] }]) {
        if (m.fit?.runs === false) continue;
        for (const o of m.ops || []) {
            if (!o.task || !o.rank || o.paid || (o.installed ?? m.installed) === false) continue;
            if (!best.has(o.task) || o.rank < best.get(o.task).rank) best.set(o.task, { rank: o.rank, key: `${m.id}:${o.op}` });
        }
    }
    const isBest = (m, o) => best.get(o.task)?.key === `${m.id}:${o.op}`;
    return {
        ok: true,
        engine: list.engine,
        hardware: list.hardware,
        detail: `describe_model with an id for its params, media, fields and guides.${list.tools?.length ? ' tools run with no modelId: generate with operation and fields, never a prompt; cards runs one over many.' : ''} A miss moves to the next rank for the task, never the same op again.`,
        ...(hasVideo ? { videoOps: VIDEO_OPS } : {}),
        models: (list.models || []).map((m) => {
            // Most models write ONE note and hang it on every op ("anime and stylised art,
            // not photography", six times). Said once about the model, it reads the same and
            // costs a sixth; a model whose ops disagree keeps them per op.
            const notes = new Set((m.ops || []).map((o) => o.note).filter(Boolean));
            const shared = notes.size === 1 && (m.ops || []).every((o) => o.note) ? [...notes][0] : null;
            return {
                id: m.id,
                name: m.name,
                type: m.type,
                installed: m.installed,
                // Only when it is news: everything installed runs, and a size matters
                // only for something that would have to be downloaded first.
                ...(m.installed ? {} : { downloadGb: m.missingDownloadGb }),
                ...(m.fit && m.fit.runs === false ? { runsHere: false } : {}),
                ...(shared ? { note: shared } : {}),
                ops: (m.ops || []).map((o) => ({
                    op: o.op,
                    ...(o.installed === false ? { installed: false } : {}),
                    // Only where the op id hides it (kleinEdit and krea2Edit are both `edit`):
                    // "that edit again with Krea 2" went to krea2 i2i, its best-ranked op (MPI-916).
                    ...(o.task && o.task !== o.op ? { task: o.task } : {}),
                    ...(o.rank ? { rank: o.rank } : {}),
                    ...(isBest(m, o) ? { best: true } : {}),
                    ...(o.note && !shared ? { note: o.note } : {}),
                    ...(m.type === 'video' && _takes(o.media).length ? { takes: _takes(o.media) } : {}),
                })),
            };
        }),
        flows: (list.flows || []).map((f) => ({
            id: f.id,
            title: f.title,
            ...(f.does ? { does: f.does } : {}),
            installed: f.installed,
            // MPI-892: said up front, so the agent offers to open it rather than saying it cannot draw.
            ...(f.opens ? { opensForUser: true } : {}),
            // MPI-918: a cloud model in its edit slot; the spend card asks before each run.
            ...(f.cloud ? { cloud: f.cloud } : {}),
        })),
        // MPI-904: the image tools with no model (upscale, background removal, crop).
        tools: (list.tools || []).map((t) => ({
            op: t.op,
            ...(t.task ? { task: t.task } : {}),
            ...(t.rank ? { rank: t.rank } : {}),
            ...(isBest({ id: '' }, t) ? { best: true } : {}),
            note: t.note,
        })),
    };
}

/** A `generate` with no model and no Flow runs a tool (MPI-904, `js/shell/agentToolOps.js`). */
const _isTool = (args) => !args.modelId && !args.flowId;

/** "upscale with krea2", or just "imageUpscale" for a tool, which has no model (MPI-904). */
const _opLabel = (args) => (args.modelId ? `${args.operation} with ${args.modelId}` : String(args.operation));

/**
 * Where a tool's result lands, said in its result: on a card it is that card's next version.
 * Told only "they are in the gallery", the agent announced six upscales as "new cards" (Fabio
 * live, 2026-09-27). An attachment has no card, so its result is a new one and says nothing.
 */
const LANDS_ON_CARD = 'next version of the card it came from, never a new card';
const LANDS_ON_CARDS = 'next version of its own card, never a new card';

/** One model, Flow or tool out of a `list_models` answer, whole. `null` when the id is none. */
export function catalogueEntry(list, id) {
    const wanted = String(id ?? '');
    const model = (list?.models || []).find((m) => m.id === wanted);
    if (model) return { model };
    const flow = (list?.flows || []).find((f) => f.id === wanted);
    if (flow) return { flow };
    const tool = (list?.tools || []).find((t) => t.op === wanted);
    return tool ? { tool } : null;
}

/**
 * The confirm cards that answer with a CHOICE, never a boolean (MPI-870: a string handed to a
 * yes/no card reads as yes): kind -> its choices. Each also takes 'replied', a message typed
 * instead or a reset, which runs nothing. Review: Song's lyrics (MPI-1005). Voice: a library
 * voice Cosmo picked for a line with no sample (MPI-1004). Tiles: the tile size of a Use Tiles
 * run, each with its tile count (MPI-1260); the choices mirror `TILE_SIZES`
 * (js/data/generationControls.js). Model: which model redraws a picture another one made, m0 its
 * maker (MPI-1262).
 */
export const CHOICE_CARDS = Object.freeze({ review: ['review', 'run'], voice: ['library', 'use'], tiles: ['256', '512', '768', '1024', '1536'], model: ['m0', 'm1', 'm2', 'm3'] });

/** The ops that redraw a picture at its own look, so the model that made it matters (MPI-1262). */
const REDRAW_OPS = new Set(['upscale', 'detail']);

// ---------------------------------------------------------------------------
// AgentLoop class — injectable for tests
// ---------------------------------------------------------------------------

export class AgentLoop {
    /**
     * @param {object} [opts]
     * @param {object} [opts.tools]         Connector tool implementation (defaults to agentTools.mjs).
     * @param {function} [opts.resolveEndpoint] (profileId) => { profile, key } overrides fork bridge.
     * @param {function} [opts.lookupContextWindow] (profileId, model, profile, key) => number|null,
     *        overrides the table + endpoint lookup.
     * @param {string} [opts.sessionKey]  Which conversation this is ('' = the landing page); every
     *        event carries it. `agentSessions.mjs` changes it when the conversation moves (D5).
     * @param {function} [opts.broadcast] (event, data) => void, the shared SSE stream.
     * @param {function} [opts.onProjectOpened] (loop, project, turn) => 'moved'|'carry'|null (D5).
     * @param {function} [opts.viewFile] (absPath, {frames}) => {kind, data, ...} overrides cardView.viewFile
     *        (MPI-941 Phase 4's clip sampling for `look`).
     */
    constructor({ tools, resolveEndpoint, lookupContextWindow, lookupVision, sessionKey = '', broadcast, onProjectOpened, viewFile } = {}) {
        this._tools = tools || realTools;
        this._viewFile = viewFile || _viewClipFile;
        this._resolveEndpointOverride = resolveEndpoint || null;
        this._lookupContextWindowOverride = lookupContextWindow || null;
        this._lookupVisionOverride = lookupVision || null;
        this._contextWindows = new Map(); // `${profileId}\n${model}` -> number
        this._visions = new Map();        // `${profileId}\n${model}` -> boolean (MPI-1208)
        this._vision = false;             // the model this turn runs on takes pictures
        this._sight = [];                 // pictures `look` with see: true showed this round, sent after its tool results
        this._seen = [];                  // the messages that carried them: emptied when the next turn starts
        this.sessionKey = sessionKey;
        this._broadcast = broadcast || null;
        this._onProjectOpened = onProjectOpened || null;

        // Session state
        this._messages = [];       // LLM context (system + turns)
        this._history = [];        // UI-facing entries
        this._working = false;
        this._pendingConfirm = null; // { confirmId, resolve }
        this._lastUsage = null;    // provider usage from last response
        // MPI-855: what this conversation spent on the user's key, kept APART because one
        // question is about half a cent and one 1080p clip $1.90. See _addSpend.
        this._spend = { chatUsd: 0, genUsd: 0 };
        this._contextWindow = 0;   // of the model the last turn ran on

        // Every image this session is allowed to reach: attachment ids the user
        // sent, and the outputs its own generations produced. See _resolveImage.
        this._images = new Map();  // ref -> { path, kind: 'attachment' | 'result' }
        this._groups = new Set();  // card ids rename_card may name: this session's own, and any the app listed (`_seeCards`)
        this._sets = new Map();    // set id -> its card refs in click order: a dropped selection (MPI-948), expanded by `_fanOut`
        this._projects = new Set(); // project keys list_projects / create_project gave (open_project)
        // Generations this conversation started that have not settled, oldest first:
        // toolCallId -> a short label. What `cancel_generation` can reach — and NOT reset with
        // the conversation: a clip still rendering after a clear is still this session's.
        this._inflight = new Map();
        this._routineRuns = new Set(); // routine runs not yet finished (MPI-970): the drain waits on them too
        this._askedCancel = new Set(); // toolCallIds the USER took back, so settling is not a failure
        // MPI-913: the in-flight jobs on THIS PC's GPU, and what waits for them to drain.
        this._gpuJobs = new Set();
        this._gpuLines = [];       // waiting lines drawn, turned done on the drain
        this._gpuFree = null;      // resolves a turn waiting on the drain: true, or false on a reset
        this._llm = null;          // this turn's engine when it is a local Ollama model, else null
        this._llmReleased = false; // freed since the model last answered

        // What the model hears at the start of its next turn (finished generations). A
        // message pushed the moment a generation settles could land between a tool call and
        // its result, which a provider rejects.
        this._notes = [];
        // MPI-1226: jobs the user typed a message while they ran, so they are watching the
        // gallery. Their notes wait for the user's next message and never wake the chat:
        // live, "I like this" typed over the latents got an answer, then a wake said it again.
        this._watched = new Set();
        this._seenNotes = [];
        this._notesProject = null; // folderPath whose project notes this context already lists
        this._globalListed = false; // the global notes are listed once per context (MPI-774 Phase 6)
        this._readIds = new Set(); // knowledge ids read in this context (the guide gate)
        this._rulesSent = new Set(); // describe_model / list_cards rules already handed over in this context (MPI-1125)
        this._guides = new Map();  // modelId -> guide ids, from list_models
        this._boxSteps = new Map(); // flowId -> its box steps [{param, role}], from list_models
        this._opens = new Map();    // flowId -> the step it opens at instead of running (MPI-892), or null
        this._reviews = new Map();  // flowId -> { field, title } the app asks about first (MPI-1005), or null
        this._flowTitles = new Map(); // flowId -> its title, for a card that names it (MPI-1004)
        this._modelNames = new Map(); // modelId -> its name, the same for a model op's voice card (MPI-1012)
        this._flowMissing = new Set(); // flowIds not installed: no card asks about a run that cannot happen
        this._voiceNames = new Map(); // library voice id -> its performer's name, "Elderly Male" (MPI-1004)
        this._reviewEnd = null;     // a review card answered this round: the turn's last context line
        this._ops = new Map();    // "modelId\nop" -> that op's entry (media slots, params), from list_models
        this._runs = new Set();   // "modelId\nop" installed, free and runnable here (the model card, MPI-1262)
        this._madeWith = madeWith; // what made a project file, off its sidecar (tests replace it)
        this._boxed = new Set();   // image paths a `look` with box: true measured (the box gate)
        this._overBoxed = new Map(); // image path -> measures whose square was too big for a head
        this._gateWaiting = null;  // knowledge id a refused generate waits on this turn (MPI-916)
        this._masked = false;      // this turn's open card has a painted mask (the masking gate)
        this._lookWasCached = false; // did the look just served read the card's kept text? (MPI-870)
        this._wakeStreak = 0;      // consecutive wake turns with nothing typed in between (MPI-870)
        this._engineFails = new Map(); // model\nop -> engine failures since the user last typed (MPI-1286)

        // SSE subscribers
        this._subscribers = new Set();
    }

    // -------------------------------------------------------------------------
    // SSE
    // -------------------------------------------------------------------------

    addSubscriber(res) { this._subscribers.add(res); }
    removeSubscriber(res) { this._subscribers.delete(res); }

    /**
     * MPI-855 — add to the session's spend and tell the chat. Chat is the provider's own
     * `usage.estimated_cost` (DeepInfra sends it on every reply; a provider that does not adds
     * nothing); a generation is its card's `cost.usd`, already its batch share. A `look`'s
     * describer joins the chat bucket (`_look`), which the chat labels "Agent" (MPI-941 Phase 8).
     */
    _addSpend(kind, usd) {
        const v = Number(usd);
        if (!(v > 0)) return;
        this._spend = { ...this._spend, [kind]: this._spend[kind] + v };
        this._emit('agent:spend', this._spend);
    }

    /** Every describer call goes through here, so its cost joins the Agent figure (MPI-941 Phase 8). */
    async _look(args) {
        const r = await this._tools.look(args);
        if (r?.ok) this._addSpend('chatUsd', r.output?.costUsd);
        return r;
    }

    _emit(event, data) {
        const body = { ...data, session: this.sessionKey };
        if (this._broadcast) this._broadcast(event, body);
        const payload = `event: ${event}\ndata: ${JSON.stringify(body)}\n\n`;
        for (const sub of this._subscribers) {
            try { sub.write(payload); } catch { /* stale connection */ }
        }
    }

    /**
     * MPI-870 — the generations this conversation started have all landed.
     *
     * A finished generation is otherwise SILENT: `settle` pushes its note into `_notes`,
     * which is read at the START of the next turn, so nothing reaches the user until they
     * type. Fabio hit it twice on the morning of 2026-09-21 — once sitting for thirty
     * minutes with the answer one inch away from the chat.
     *
     * This only ANNOUNCES the drain. The wake itself is posted by the RENDERER, because the
     * connector's generate route has no project targeting — a dispatch lands in whatever
     * project is OPEN — so waking project A's conversation while B is open would render A's
     * work into B. The server does not track the open project; the renderer is the side
     * that does. It comes back through `AgentSessions.wake()`.
     *
     * Additions join `_inflight` before the earlier ones settle, so the drain is the true
     * end of a batch and this fires once. `_inflight` is memory only: a restart mid-batch
     * loses the wake, and `unfinished-generations.md` already covers what was asked for.
     */
    _maybeDrained() {
        if (!this._gpuJobs.size) this._gpuDrained(true);
        if (this._inflight.size || this._routineRuns.size) return;
        this._emit('agent:drained', {});
    }

    /**
     * MPI-913 — a local Ollama agent and its own render share one card, so the model is freed
     * when the render is queued, and nothing loads it again until the render lands: the turn
     * that queued it ends under a waiting line, and a message typed meanwhile waits here.
     * Called at the END of a settle (via `_maybeDrained`), so a waiting turn opens on the note.
     * `keep` puts the line in history: a turn-start line is drawn live only, because the user's
     * own history entry is written after it and a redraw would put the line above their message.
     */
    _gpuWaitLine(turnId, keep) {
        const id = crypto.randomUUID();
        const entry = keep ? this._historyEntry('tool', { id, tool: 'gpu_wait', args: {}, status: 'started', label: GPU_WAIT_LABEL }) : null;
        this._gpuLines.push({ turnId, id, entry });
        this._emit('agent:tool', { turnId, id, tool: 'gpu_wait', status: 'started', label: GPU_WAIT_LABEL });
    }

    /**
     * MPI-1280 — the words that rode with this round's calls, shown the moment one of them is
     * past its refusal race: the user hears what is running while it runs, not one or two model
     * rounds later (~35 s each on a long chat, longer than a Turbo render). Once per round.
     */
    _sayStarted() {
        const line = this._startLine;
        if (!line || line.shown) return;
        line.shown = true;
        const entry = this._historyEntry('agent', { text: line.text });
        this._emit('agent:message', { turnId: line.turnId, id: entry.id, text: line.text });
    }

    _waitForGpu(turnId) {
        // One line says it: a line still open (the turn that queued the render drew it) covers
        // this message too. A second copy under it read as a stutter (Fabio, live 2026-09-28).
        if (!this._gpuLines.length) this._gpuWaitLine(turnId, false);
        return new Promise((resolve) => { this._gpuFree = resolve; });
    }

    _gpuDrained(free) {
        for (const l of this._gpuLines.splice(0)) {
            if (l.entry) l.entry.status = 'done';
            this._emit('agent:tool', { turnId: l.turnId, id: l.id, tool: 'gpu_wait', status: 'done', label: GPU_WAIT_LABEL });
        }
        this._gpuFree?.(free);
        this._gpuFree = null;
    }

    /** Free the local agent model's VRAM, once per answer it gave. Never an error path. */
    _releaseLlm() {
        if (!this._llm || this._llmReleased) return;
        this._llmReleased = true;
        this._llm.releaseOwnModels().catch(() => { /* server gone or already empty: nothing held */ });
    }

    /**
     * MPI-941 Phase 9 (Fabio, live 2026-09-27): a WAKE turn re-sent `krea2Edit` on its own,
     * and "try Klein 9B" then landed as `kleinEdit` and queued BEHIND it — nothing told the
     * model a job of its own was still running when that message arrived, and
     * `cancel_generation`'s own description covers only "take it back". Read into the opening
     * of a real turn only (never a wake, which starts with `_inflight` empty by construction:
     * `_maybeDrained` fires the wake only once it drains), so a quiet turn costs zero bytes.
     */
    _inflightLine() {
        const items = [...this._inflight];
        if (!items.length) return '';
        if (items.length === 1) {
            const [id, label] = items[0];
            return `[Running now: ${label} (toolCallId ${id}). If the user's new ask replaces it, cancel it first.]`;
        }
        // A batch can hold hundreds sharing one op (MPI-941 Phase 1): never list them, just the count.
        const labels = new Set(items.map(([, label]) => label));
        const what = labels.size === 1 ? `${[...labels][0]} x${items.length}` : `${items.length} different jobs`;
        return `[Running now: ${what}. If the user's new ask replaces them, cancel_generation (no id cancels the latest).]`;
    }

    /**
     * MPI-870 — may a wake turn run in this conversation right now? Rules 1 and 5:
     *
     * - Nothing pending, no wake. This is also what makes the renderer's SECOND post — the
     *   one on project open, the "while you were away" report — safe to send unconditionally.
     * - A turn already running reads the notes anyway, so waking would say it twice.
     * - The streak caps a wake chain the user never joined.
     */
    canWake() {
        return !this._working && this._notes.length > 0 && (this._wakeStreak || 0) < MAX_WAKES_IN_A_ROW;
    }

    // -------------------------------------------------------------------------
    // History
    // -------------------------------------------------------------------------

    getHistory() {
        const usage = this._lastUsage
            ? { promptTokens: this._lastUsage.prompt_tokens || 0, contextWindow: this._contextWindow }
            : { promptTokens: 0, contextWindow: this._contextWindow };
        return {
            ok: true,
            working: this._working,
            // Every field the card paints from, or a reload repaints the wrong card. A
            // `spend` card missing its price would come back as a bare yes/no over an
            // unnamed amount of the user's money, and Yes would still spend it (MPI-876).
            pendingConfirm: this._pendingConfirm
                ? {
                    confirmId: this._pendingConfirm.confirmId,
                    kind: this._pendingConfirm.kind,
                    modelId: this._pendingConfirm.modelId,
                    modelName: this._pendingConfirm.modelName,
                    downloadGb: this._pendingConfirm.downloadGb,
                    licence: this._pendingConfirm.licence,
                    count: this._pendingConfirm.count,
                    what: this._pendingConfirm.what,
                    price: this._pendingConfirm.price,
                    flow: this._pendingConfirm.flow,
                    text: this._pendingConfirm.text,
                    voice: this._pendingConfirm.voice,
                }
                : null,
            usage,
            spend: this._spend,
            entries: this._history,
        };
    }

    // -------------------------------------------------------------------------
    // Reset
    // -------------------------------------------------------------------------

    async reset() {
        // Each kind of card resolves in its OWN vocabulary: a batch waits on a boolean, and
        // handing it the install path's 'declined' string would read as YES (MPI-870). The
        // spend card waits on a boolean too, so it is named here alongside it — though on
        // that path this is the SECOND defence and not the one that bites: `_askSpend`
        // answers `yes === true`, so no string of any kind can read as a yes. Kept because
        // it is the money path, and because the next kind added here may not be so strict.
        // A choice card (`CHOICE_CARDS`) waits on a choice, and 'replied' is the one that runs nothing.
        const pc = this._pendingConfirm;
        if (pc) {
            const boolean = pc.kind === 'batch' || pc.kind === 'spend';
            pc.resolve(boolean ? false : CHOICE_CARDS[pc.kind] ? 'replied' : 'declined');
        }
        // MPI-913: a message waiting on the GPU belonged to the old conversation. Its lines go
        // without a `done` frame, which would draw them into the cleared chat.
        this._gpuLines = [];
        this._gpuFree?.(false);
        this._gpuFree = null;
        // Only this conversation's staged files: another project's chat still shows its own.
        const staged = [...this._images.values()].filter((i) => i.kind === 'attachment').map((i) => i.path);
        this._pendingConfirm = null;
        this._working = false;
        this._messages = [];
        this._history = [];
        this._lastUsage = null;
        this._longOffered = false;
        this._spend = { chatUsd: 0, genUsd: 0 };
        this._emit('agent:spend', this._spend);
        this._images.clear();
        this._groups.clear();
        this._sets.clear();
        this._projects.clear();
        this._notes = [];
        this._seenNotes = [];
        this._notesProject = null;
        this._globalListed = false;
        this._readIds.clear();
        this._rulesSent.clear();
        this._guides.clear();
        this._boxSteps.clear();
        this._boxed.clear();
        this._overBoxed.clear();
        this._wakeStreak = 0;
        this._engineFails.clear();
        try { await this._tools.discardAttachments(staged); } catch { /* non-fatal */ }
    }

    /** Nothing said yet: a landing conversation may move in (D5). */
    isEmpty() {
        return !this._working && this._history.length === 0;
    }

    // -------------------------------------------------------------------------
    // Image references
    // -------------------------------------------------------------------------

    /**
     * Resolve an image reference the MODEL emitted to a file this session may read.
     *
     * Only two things are reachable: an attachment the user sent in this session,
     * and an output one of this session's own generations produced. A model is free
     * to emit any string, and `look`/`generate` ship what it names to the engine —
     * which may be a remote Pod — so anything not registered here is refused rather
     * than read off the user's disk.
     *
     * @returns {{path: string, kind: string} | null}
     */
    _resolveImage(ref) {
        if (!ref || typeof ref !== 'string') return null;
        return this._images.get(ref) || null;
    }

    /**
     * MPI-941 Phase 4 — a video or GIF ref sampled into ONE contact sheet (cardView.viewFile),
     * written to `cropDir()`, and THAT file goes to `_tools.look`: one vision call per clip,
     * the same cost as a still. The sheet's own facts (frame count, duration, columns, times)
     * open the question, so the describer reads a grid of frames rather than one photo.
     */
    async _describeClip(ref, question) {
        let sheet;
        try {
            sheet = await this._viewFile(ref.path, { frames: 6 });
        } catch (err) {
            return { ok: false, error: { code: 'RUNTIME_ERROR', message: `Could not read "${path.basename(ref.path)}" as a clip: ${err.message}` } };
        }
        const cDir = this._tools.cropDir();
        await fs.promises.mkdir(cDir, { recursive: true });
        const sheetPath = path.join(cDir, `${crypto.randomUUID()}.webp`);
        await fs.promises.writeFile(sheetPath, sheet.data);
        const prefix = `This is a contact sheet of ${sheet.times.length} frames from a ${sheet.duration}s clip, `
            + `${sheet.columns} per row, left to right then top to bottom, at ${sheet.times.join('s, ')}s.`;
        const r = await this._look({ imagePath: sheetPath, question: question ? `${prefix} ${question}` : prefix });
        const heard = r?.ok ? await this._hearClip(ref, sheet.hasAudio) : '';
        // `seen` is the describer's own text: the one `_lookOnce` keeps as the card's look.
        return heard ? { ...r, output: { ...r.output, seen: r.output.text, text: `${r.output.text || ''}${heard}` } } : r;
    }

    /**
     * MPI-1169 — the words spoken in a clip, as a line to add to its look ('' when it has no
     * sound). Heard through the transcriber the user picked for dictation, ONCE per card (kept in
     * the sidecar's `heard`, like `look`); an attachment is heard live each time. A transcriber
     * that is not set up says so in the line and is not kept, so it is tried again once it is.
     * `hasAudio` undefined (a kept look, no sheet in hand): the route answers NO_AUDIO itself.
     */
    async _hearClip(ref, hasAudio) {
        if (hasAudio === false || !this._tools.transcribe) return '';
        let heard = ref.itemId ? await this._tools.storedHeard(ref.path, ref.itemId).catch(() => null) : null;
        if (!heard) {
            const r = await this._tools.transcribe({ path: ref.path });
            if (r?.ok) heard = { text: String(r.output?.text || '').trim(), audio: true };
            else if (r?.error?.code === 'NO_AUDIO') heard = { text: '', audio: false };
            else return `\nIt has sound I could not hear: ${r?.error?.message || 'the transcription failed.'}`;
            if (ref.itemId) await this._tools.storeHeard(ref.path, ref.itemId, heard).catch(() => {});
        }
        return heard.audio ? `\nHeard:${heard.text ? `\n${heard.text}` : ' no words, only sound.'}` : '';
    }

    /**
     * The plain description of a picture, made ONCE per card and kept in the card's sidecar
     * (Fabio, 2026-09-20: "if an image is described, it's described forever"). It dies with
     * the card, and it is the only record of what the describer said: live, a wrong pose in a
     * prompt could not be traced to the vision model or to the chat model's paraphrase.
     *
     * Only the UNPROMPTED description is kept. A question, a crop or a box is a different
     * answer and goes to `_tools.look` directly. An attachment has no `itemId`, so no sidecar:
     * it is described live every time.
     */
    async _lookOnce(ref) {
        const kept = ref.itemId ? await this._tools.storedLook(ref.path, ref.itemId).catch(() => null) : null;
        // Read by the tool-done frame, so the chat line can say a cache read out loud (MPI-870).
        this._lookWasCached = !!kept;
        if (kept) {
            _logLook(ref, kept, true);
            return { ok: true, output: { text: CLIP_EXT.test(ref.path) ? `${kept}${await this._hearClip(ref)}` : kept } };
        }
        const r = CLIP_EXT.test(ref.path) ? await this._describeClip(ref) : await this._look({ imagePath: ref.path });
        // Awaited: the model's own look at a waited still arrives within the same turn.
        if (r?.ok && r.output?.text && ref.itemId) await this._tools.storeLook(ref.path, ref.itemId, r.output.seen ?? r.output.text, r.output.describer).catch(() => {});
        _logLook(ref, r?.ok ? r.output?.text : `FAILED: ${r?.error?.message || 'no reason given'}`, false);
        return r;
    }

    /** The staged file behind one of this session's attachment ids, or null. */
    attachmentPath(id) {
        const img = this._resolveImage(id);
        return img && img.kind === 'attachment' ? img.path : null;
    }

    /**
     * The line that opens every user turn: where a generation lands, and the only image
     * refs `look`/`generate` resolve (the `_images` allowlist, so the two cannot differ).
     * ponytail: the latest 8 refs; a longer session lists what it most likely means.
     * `size`: the open entry's `WxH` (MPI-1053: "add detail" routes by the picture's size,
     * and "this image" had none, unlike an attachment or a list_cards row).
     */
    _appStateLine(project, workspace = null, size = '') {
        const where = project
            ? `project "${project.name}" is open. Generations land there.`
            : 'no project is open. A generation needs one: ask the user to open or create a project.';
        // MPI-817: a result carries WHICH MODEL made it. `look` reads pixels, so without it
        // the agent cannot tell one card's origin from another's, and nothing tells it that:
        // live on 2026-09-19 it read an `ill-anime` image as "the Krea 2 result" purely
        // because Krea 2 was the model pinned that turn, and then generated nothing because
        // it believed the request was already met. Never let it infer provenance from the
        // settings panel.
        const refs = [...this._images.entries()].slice(-8)
            .map(([ref, img]) => (img.kind === 'attachment'
                ? `${ref} (${img.name || 'attachment'})`
                : `${ref}${img.modelId ? ` (made by ${img.modelId})` : ''}`));
        // "none" here once read as "the project is empty": live, 2026-09-19, the agent told
        // Fabio it could not see the duck picture in a project holding eighteen cards.
        const more = project ? ' That is only what THIS conversation has touched; the project holds more, and list_cards reaches it.' : '';
        // MPI-890: where the user is STANDING. With a card open they are looking at one
        // entry and there is no drag surface in that view, so "this image" means that entry
        // and nothing else — it is registered above, so the ref named here resolves.
        const stack = workspace?.card?.stack;
        const entry = `${workspace?.activeEntry?.filePath}${size ? `, ${size}` : ''}`;
        const standing = workspace?.activeEntry?.filePath
            // MPI-1119: the Scene page is no picture view: no Mask tool, and "what is this?" is
            // the question. A pano scene opens the 3D Scene workspace, a 360 video the player.
            ? (workspace.page === 'scene'
                ? ` The user is in the ${workspace.card?.type === 'video' ? '360 player, on the video' : '3D Scene workspace, inside the scene'} "${workspace.card?.name || 'untitled'}"; its entry is ${entry}. Before you explain anything about where they are or how it works, read app:360-and-3d-scenes.`
            // MPI-950: an open stack shows one member at a time, and has no Mask tool.
            : stack
                ? ` The user has the stack "${stack.name}" (${stack.count} cards) open, and "all of them" means its cards: list_cards with groupId ${stack.groupId} gives the ref to pass as cards. The card on screen is "${workspace.card.name || 'untitled'}", and the entry open in front of them is ${entry}. "This image", "it" and "this one" mean that entry.`
            // MPI-991: the Masking rule's "skip the first half" lost live ("click the card in the
            // gallery to open it (you're already looking at it)"), so the line carries the words.
                : ` The user is looking at the card "${workspace.card?.name || 'untitled'}", and the entry open in front of them is ${entry}. "This image", "it" and "this one" mean that entry. To paint a mask they only pick the Mask tool from the toolbar down the left: they are on the card, so never send them to the gallery.`)
                // MPI-891 live read 2: the mask reached the dispatch, never the prompt writer.
                // MPI-987: dictation wrote "mask" as "mosque"; the agent read a building to add
                // and sent the user to repaint on another card instead of running on the mask.
                + (workspace.masked ? ' They have a MASK painted on it: a masked op on that entry changes only the masked area, so pick the op by the job and write the prompt for the masked area (Masking rule), and tell them you are using their mask. Painting it chose this entry: run on it, never ask them to paint again on another picture. Whatever they say they painted is this mask; they may be dictating, so a word that sounds like "mask" (mosque, mass) means the mask. A change to the whole picture needs them to clear the mask first.' : '')
                // MPI-984: a video's playhead. Sent as a picture, a clip is its FIRST frame
                // (MPI-980), so "this frame" anywhere else is the user's Create snapshot.
                + (workspace.frame ? _frameOnScreen(workspace.frame) : '')
            : '';
        return `[App state: ${where}${standing}${_boxesDrawn(workspace?.boxes, this._pinned)} Images you can look at: ${refs.length ? refs.join(', ') : 'none'}.${more} A ref with no "made by" was not made here, so you do not know what made it — say so rather than guessing, and never assume it came from the model selected now.]`;
    }

    /**
     * MPI-1262 — the open card's entries, read off disk (`list_cards <groupId>`), and registered
     * so each ref works in `look` and `generate`. Only the entry on screen ever reached the agent,
     * so after a detail pass it could not say what made the original (live, Fabio 2026-10-23),
     * and "do it again" after a masked edit ran on the RESULT, which holds no mask, and asked him
     * to paint the mask again. `lastMask` is the renderer's word for where that mask still is.
     * Empty off a card, on a one-entry card, and when the read fails: the turn never waits on it.
     */
    async _entriesLine(project, workspace) {
        const groupId = workspace?.groupId;
        const onScreen = workspace?.activeEntry?.filePath;
        if (!project?.folderPath || !groupId || !onScreen || workspace.page === 'scene') return '';
        let r;
        try { r = await this._tools.listCards(project.folderPath, groupId); } catch { return ''; }
        const entries = r?.ok ? r.card?.entries : null;
        if (!Array.isArray(entries) || entries.length < 2) return '';
        this._seeCards(r);
        const shown = path.basename(onScreen);
        const list = entries.map((e) => {
            const made = [e.modelId || e.flowId, e.operation].filter(Boolean).join(' ');
            const bits = [made, e.style && `style ${e.style} (styleSelect ${e.styleSelect})`, e.from && `made from ${e.from}`].filter(Boolean).join(', ');
            return `${e.n} ${e.ref}${bits ? ` (${bits})` : ''}${e.ref === shown ? ', ON SCREEN' : ''}`;
        }).join('; ');
        const masked = workspace.lastMask?.filePath ? path.basename(workspace.lastMask.filePath) : null;
        const maskLine = masked && masked !== shown
            ? ` Their last masked edit on this card ran on ${masked}, and its mask is still painted THERE: to redo or adjust that edit, run the masked op on ${masked}, not the entry on screen, and the app applies that same mask. Never ask them to paint it again.`
            : '';
        return `[This card's entries, oldest first: ${list}. Each ref works in look and generate; read what made one with list_cards and its groupId. "Again", "redo it" or "try that again" repeat the LAST change: run it again on the entry it was made FROM, never on its result.${maskLine}]`;
    }

    /**
     * The pinned settings panel, MPI-774 Phase 7 — present only when the user has it OPEN.
     *
     * Told, not asked: the app has already dropped whatever model and settings this turn's
     * generate names (`js/shell/agentDispatch.js`, resolveSettingsOwner), so this line
     * changes nothing about what runs. It exists because the model still WRITES the prompt,
     * and the Guide rule makes it read that model's guide and adapt to its structure and
     * vocabulary — a pinned Klein with a Krea2-shaped prompt is a worse image than either
     * party intended. The ops are here so it can refuse in WORDS when the pinned model
     * cannot do what was asked, instead of discovering it through an OP_UNAVAILABLE.
     * Costs nothing on a turn with the panel shut: the line is absent.
     *
     * MPI-1017: the operation and the batch are the panel's too (a different op is refused,
     * OP_PINNED; a `count` is refused in `generate`), so the line names both values. The
     * duration and ratio too: shots are timed inside the panel's clip, not a guessed one.
     */
    _pinnedSettingsLine(pinned) {
        if (!pinned?.modelId) return '';
        const ops = Array.isArray(pinned.ops) && pinned.ops.length ? pinned.ops.join(', ') : 'none installed';
        const op = pinned.operation ? ` and the operation is "${pinned.operation}"` : '';
        const use = pinned.operation ? `modelId "${pinned.modelId}" and operation "${pinned.operation}"` : `modelId "${pinned.modelId}"`;
        const batch = Number(pinned.batch) > 1 ? ` Each generate makes ${pinned.batch}, the panel's batch.` : '';
        const clip = pinned.duration ? ` The clip is ${pinned.duration} s long: time any shots inside it.` : '';
        const ratio = pinned.ratio ? ` The ratio is ${pinned.ratio}.` : '';
        return `[Settings panel: the user has it OPEN, so the model, the operation and every setting (duration, quality, ratio, batch, turbo, style, tiles, tile size, upscale factor, no background, fast motion) are THEIRS for this turn. You supply only the prompt and the media (reference images, videos, audio), and name the card. The model is "${pinned.modelId}" (${pinned.name}, ${pinned.mediaType})${op}; the operations it can run are: ${ops}. Use ${use} on every generate and send no duration, quality, ratio, batch, count, turbo, style, tiles, tileSize, upscaleFactor or fastMotion — yours are ignored.${batch}${clip}${ratio} Write the prompt for THIS model and operation. If they cannot do what the user asked, say so plainly, say what they do instead, and ask them to change the model or operation, or close the settings panel so you pick — never switch it yourself, and never pretend a different one ran.]`;
    }

    /**
     * open_project takes a folder the app gave this conversation (list_projects, create_project),
     * the open project, or one the user typed; never a path the model made up.
     */
    _mayOpen(folderPath, currentProject) {
        const key = projectKey(folderPath);
        if (!key) return false;
        if (this._projects.has(key) || key === projectKey(currentProject?.folderPath)) return true;
        return this._history.some((e) => e.kind === 'user' && projectKey(e.text).includes(key));
    }

    /**
     * MPI-890 — register the entry the user is looking at, so "this image" resolves.
     *
     * The path arrived already checked against the open project's Media/ by
     * `_sanitiseWorkspace` in `routes/agent.js`; registering it here is what makes the
     * App state line and the `_images` allowlist agree, which is the one invariant that
     * line documents about itself. Nothing is registered when the user is not standing in
     * a card, and re-registering the same entry on a later turn is a no-op by key.
     */
    _registerWorkspaceEntry(workspace) {
        // MPI-1181: the picture the edit boxes are drawn on, checked like the entry.
        if (workspace?.boxes?.picture) this._registerResult(workspace.boxes.picture);
        const entry = workspace?.activeEntry;
        if (!entry?.filePath) return;
        this._registerResult(entry.filePath, entry.modelId, entry.itemId);
    }

    /** Register a generation's output so a later `look` or reference can name it. */
    _registerResult(filePath, modelId = null, itemId = null, groupId = null) {
        if (!filePath || typeof filePath !== 'string') return;
        this._images.set(filePath, { path: _decodeProjectFileUrl(filePath), kind: 'result', modelId, itemId, groupId });
    }

    /**
     * MPI-1136: cards OUT of the open project, the gallery's Add to project done by the agent
     * ("send these to project X", "the last two to a new project", "all the videos"). One
     * `/connector/send-cards` call, the same one MCP makes: by ref, or by kind / mark / newest,
     * which the route resolves off disk. A plain send leaves the view where it is; a newProject
     * is opened once the cards are in ("let's continue from there"). A ref with no card behind
     * it is refused by name.
     */
    async _sendCards(args, currentProject) {
        const fail = (code, message) => ({ ok: false, error: { code, message } });
        if (!currentProject?.folderPath) return fail('NO_PROJECT', 'No project is open, so there are no cards to send.');
        const refs = [].concat(args.cards || []).flatMap((c) => (String(c).startsWith('set:') && this._sets.get(String(c).slice(4))) || [String(c)]);
        const missing = refs.filter((r) => !this._resolveImage(r)?.groupId);
        if (missing.length) return fail('NOT_A_CARD', `Not a gallery card: ${missing.join(', ')}. Use refs from list_cards or visible_cards, a dragged card, or a finished generation.`);
        if (!refs.length && !args.kind && !args.mark && !args.newest) return fail('BAD_REQUEST', 'Name the cards, or pick them with kind, mark or newest.');
        if (!args.newProject && !this._mayOpen(args.folderPath, currentProject)) {
            return fail('UNKNOWN_PROJECT', 'Name a folderPath from list_projects or one the user typed, or pass newProject.');
        }
        const r = await this._tools.sendCards({
            sourceFolderPath: currentProject.folderPath,
            ...(refs.length ? { groupIds: [...new Set(refs.map((ref) => this._resolveImage(ref).groupId))] } : { kind: args.kind, mark: args.mark, newest: args.newest }),
            ...(args.newProject ? { newProject: args.newProject } : { folderPath: args.folderPath }),
        });
        if (!r?.ok) return r;
        if (r.output?.folderPath) this._projects.add(projectKey(r.output.folderPath));
        const { copied, folderPath, opened, cards = [] } = r.output || {};
        return { ok: true, copied, folderPath, ...(opened !== undefined ? { opened } : {}), names: cards.map((c) => c.cardName).filter(Boolean) };
    }

    /**
     * What the model reads of a card listing (`list_cards`, `visible_cards`). `files` is the
     * allowlist's half, not the model's: every ref it lists is a file inside the project's own
     * Media/ (the service checks), and from here on `look`, `generate` and the GIF tools
     * resolve it like one of this session's own results.
     */
    _seeCards(r) {
        if (!r?.ok) return JSON.stringify(r);
        const { files = {}, sets = {}, ...seen } = r;
        // A card the app LISTED is one `rename_card` may name. The gate used to be "only what
        // this conversation generated", from before the agent could see the project at all;
        // live, 2026-09-20, Fabio asked it to name his unnamed square and triangle cards and
        // it refused all four and told him to do it by hand. A made-up id still reaches nothing.
        for (const c of [...(seen.cards || (seen.card ? [seen.card] : [])), ...(seen.card?.members || [])]) {
            if (c?.groupId) this._groups.add(c.groupId);
        }
        for (const [ref, f] of Object.entries(files)) {
            this._images.set(ref, { path: f.path, kind: 'result', modelId: f.modelId || null, itemId: f.itemId || null, groupId: f.groupId || null });
        }
        // MPI-950: a stack's row ref is `set:<stackId>`, run over like a dropped selection.
        for (const [ref, refs] of Object.entries(sets)) this._sets.set(ref.slice(4), refs);
        return JSON.stringify(seen);
    }

    /**
     * One GIF verb, awaited (MPI-817 Phase E). The routes name a card by ITEM id and the model
     * only ever says `ref`, so `refs` maps each body key to the ref(s) behind it and the item
     * id comes off the same `_images` entry `look` and `generate` resolve: no second id for
     * the model to carry, and nothing reachable that the allowlist does not already hold.
     * The reply's own ref is registered the same way, so a chain of steps feeds itself.
     */
    async _gif(run, refs, body, newCard) {
        const toolCallId = crypto.randomUUID();   // keys the chat's result card, as generate's does
        for (const [key, ref] of Object.entries(refs)) {
            const list = [].concat(ref);
            const ids = list.map((one) => this._resolveImage(one)?.itemId);
            const missing = list.filter((_, i) => !ids[i]);
            if (missing.length) {
                return JSON.stringify({ ok: false, error: { code: 'NOT_A_CARD', message: `Not a gallery card you can reach: ${missing.join(', ')}. Use a ref list_cards returned, or one a finished generation or GIF step reported. An attachment is not a card.` } });
            }
            body[key] = Array.isArray(ref) ? ids : ids[0];
        }
        // Awaited in the turn, but the start line (MPI-1280) shows once the route has not refused it.
        const pending = run(body);
        const early = await Promise.race([pending.catch(() => ({ ok: false })), new Promise((resolve) => { setTimeout(() => resolve(null), EARLY_REFUSAL_MS); })]);
        if (!early || early.ok) this._sayStarted();
        const r = await pending;
        if (!r?.ok || !r.output) return JSON.stringify(r);
        const { itemId, ...output } = r.output;
        this._registerResult(output.filePath, null, itemId, output.groupId);
        // rename_card reaches only cards this conversation MADE. edit and cutout land on a
        // card that was already there, which may be the user's own.
        if (newCard && output.groupId) this._groups.add(output.groupId);
        this._emit('agent:result', { toolCallId, ok: true, output: r.output });
        this._historyEntry('result', { toolCallId, ok: true, output: r.output });
        return JSON.stringify({ ok: true, output, message: `Done. Its ref is "${output.filePath}".` });
    }

    /**
     * The one thing a project cannot tell a restarted agent: a generation that was asked for
     * and never landed. A landed one is a card with a sidecar; a cancelled one, or one the app
     * closed on, left nothing (Fabio, 2026-09-20: "requeue those two" after a close, and the
     * agent had no trace of either). Written at submit, removed on landing. It is an ordinary
     * project note, so the first message already lists it and read_memory already reads it:
     * no tool, no route, no prompt text, and none of the conversation around it.
     * Keyed on the prompt, so a requeue replaces its own entry instead of adding one.
     * ponytail: oldest entries drop to fit one note (MAX_NOTE_BYTES); one nobody requeues
     * lingers until pushed out. An expiry, if that ever reads as clutter.
     * @param {?{folderPath: string}} project
     * @param {object} args   the agent's own `generate` arguments, what it would send again
     * @param {?string} status  'running', or why it stopped; null = it landed
     */
    _trackUnfinished(project, args, status) {
        // One at a time: a landing and a submit a second apart would each rewrite the whole
        // note from their own copy, and the slower write would undo the other.
        this._unfinishedQueue = (this._unfinishedQueue || Promise.resolve())
            .then(() => this._writeUnfinished(project, args, status));
        return this._unfinishedQueue;
    }

    async _writeUnfinished(project, args, status) {
        if (!project?.folderPath) return;
        const keyOf = (call) => `${call.flowId || call.modelId || call.operation}\n${call.prompt || JSON.stringify(call.fields || {})}`;
        try {
            if (this._unfinishedFor !== project.folderPath) {
                const r = await this._tools.readMemory(project.folderPath, UNFINISHED_FILE).catch(() => null);
                const block = /```json\n([\s\S]*?)\n```/.exec(r?.text || '');
                this._unfinished = new Map((block ? JSON.parse(block[1]) : []).map((e) => [keyOf(e.generate), e]));
                this._unfinishedFor = project.folderPath;
            }
            const { wait: _wait, ...call } = args;
            this._unfinished.delete(keyOf(call));
            if (status) this._unfinished.set(keyOf(call), { status, at: new Date().toISOString(), generate: call });

            const entries = [...this._unfinished.values()];
            const render = () => (entries.length
                ? `Asked for and never landed. \`generate\` is the exact call: send it again to requeue.\n\n\`\`\`json\n[\n${entries.map((e) => JSON.stringify(e)).join(',\n')}\n]\n\`\`\`\n`
                : 'Nothing unfinished.\n');
            while (entries.length > 1 && Buffer.byteLength(render(), 'utf8') > 4000) entries.shift();
            const names = entries.map((e) => e.generate.cardName || String(e.generate.prompt || e.generate.flowId || e.generate.operation || '').slice(0, 30));
            await this._tools.writeMemory(project.folderPath, {
                file: UNFINISHED_FILE,
                title: 'Generations that never finished',
                hook: entries.length ? `${entries.length}: ${names.join(', ')}`.slice(0, 160) : 'none',
                text: render(),
            });
        } catch { /* a lost ledger line must never fail a generation */ }
    }

    /**
     * The open project's notes, listed once per project: on the first turn with it open, and
     * again after a switch or a compaction. '' when there is nothing to add (or no route).
     */
    async _projectNotesLine(project) {
        if (!project?.folderPath || project.folderPath === this._notesProject) return '';
        let r;
        try { r = await this._tools.readMemory(project.folderPath); } catch { return ''; }
        if (!r?.ok) return '';
        this._notesProject = project.folderPath;
        // The unfinished-generations note with nothing in it is not worth a line of context.
        const notes = (r.notes || []).filter((n) => !(n.file === UNFINISHED_FILE && n.hook === 'none'));
        if (!notes.length) return '[Project notes: none yet.]';
        return `[Project notes you kept earlier, ${r.notes.length} of ${MAX_NOTES} (read_memory with a file for the whole note):\n${notes
            .map((n) => `- ${n.file}: ${n.title}${n.hook ? ` (${n.hook})` : ''}`).join('\n')}]`;
    }

    /**
     * MPI-774 Phase 6 — the GLOBAL notes, listed once per context: the README of pointer
     * lines, never the notes themselves (read_memory opens one). Nothing at all when there
     * are none: most users never save one, and an empty line on every conversation is noise.
     */
    async _globalNotesLine() {
        if (this._globalListed) return '';
        let r;
        try { r = await this._tools.readGlobalMemory(); } catch { return ''; }
        if (!r?.ok) return '';
        this._globalListed = true;
        if (!r.notes?.length) return '';
        return `[Global notes, ${r.notes.length} of ${MAX_NOTES}, kept for every project (read_memory with scope global and a file for the whole note):\n${r.notes
            .map((n) => `- ${n.file}: ${n.title}${n.hook ? ` (${n.hook})` : ''}`).join('\n')}]`;
    }

    /**
     * What the loop keeps off a FULL list_models answer: the guide ids, the Flow box steps and
     * each op's media slots. None of it goes to the model any more (`compactCatalogue`), and all
     * three gates read it from here.
     */
    _rememberGuides(list) {
        for (const m of list?.models || []) {
            this._guides.set(m.id, Array.isArray(m.guides) ? m.guides : []);
            this._modelNames.set(m.id, m.name || m.id);
            for (const o of m.ops || []) {
                this._ops.set(`${m.id}\n${o.op}`, o);
                const runs = (o.installed ?? m.installed) !== false && m.fit?.runs !== false && !o.paid;
                this._runs[runs ? 'add' : 'delete'](`${m.id}\n${o.op}`);
                // MPI-1012: a model op's voice slot lists its voices the way a Flow's does.
                for (const slot of o.media || []) {
                    for (const v of slot.voices || []) for (const id of v.ids || []) this._voiceNames.set(id, v.name);
                }
            }
        }
        for (const f of list?.flows || []) {
            this._boxSteps.set(f.id, Array.isArray(f.boxParams) ? f.boxParams : []);
            this._opens.set(f.id, f.opens || null);
            this._reviews.set(f.id, f.review ? { field: f.review, title: f.title || f.id } : null);
            this._flowTitles.set(f.id, f.title || f.id);
            if (f.installed === false) this._flowMissing.add(f.id); else this._flowMissing.delete(f.id);
            for (const slot of f.media || []) {
                for (const v of slot.voices || []) for (const id of v.ids || []) this._voiceNames.set(id, v.name);
            }
        }
        // A tool has no model: its op is keyed with an empty model id.
        for (const t of list?.tools || []) this._ops.set(`\n${t.op}`, t);
    }

    /**
     * A required media slot the call does not fill, or null. Structural, like the guide gate:
     * live (Fabio, 2026-09-19) the model called i2v_ms with no media at all, told the user it
     * had started the video from their picture, and the refusal — `"i2v_ms" needs image in its
     * "startFrame" slot` — came back from the renderer long after `generate` had answered
     * `started: true`, which is the one thing the model tells the user about.
     */
    async _missingMedia(args) {
        if (!args.modelId || !args.operation) return null;
        const key = `${args.modelId}\n${args.operation}`;
        if (!this._ops.has(key)) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { return null; /* the app still validates the call */ }
        }
        const slots = this._ops.get(key)?.media || [];
        const given = new Set((Array.isArray(args.media) ? args.media : []).map((m) => m?.role));
        const missing = slots.find((s) => s.required && !given.has(s.role));
        return missing ? { missing, slots } : null;
    }

    /**
     * MPI-870 — run one op over many cards from ONE tool call.
     *
     * `generate` takes a single card, so "upscale all 50 of these" was 50 tool calls, 50 chat
     * lines, 50 auto-look vision calls and ~100 notes waiting for the next turn. This is the
     * same single-dispatch path, called in a loop: nothing about how a generation runs changes,
     * which is the point — a second dispatch path would drift from the first.
     *
     * Above five cards the user is asked first (Fabio, 2026-09-21). Below it, fanning out is
     * what they asked for and a card in the way is noise.
     */
    async _fanOut(args, turnId, currentProject) {
        // MPI-876 — or N of one request (`count`). Fabio, live 2026-09-22: "a batch of two"
        // on t2i raised TWO spend cards, because `cards` needs an image slot and the connector
        // refuses `batch`, so the model called generate twice. `count` is N queued submits,
        // which is what the 2026-09-15 "agents never batch" rule asks for (N latents in VRAM
        // at once is what it forbids), and it asks through the same one card as `cards`.
        // MPI-948: a dropped set is one ref for all its cards. Expanded first, so the confirm, the
        // ledger and every refusal see the cards themselves, in the order the user clicked them.
        if (Array.isArray(args.cards)) {
            args = { ...args, cards: args.cards.flatMap((c) => (String(c).startsWith('set:') && this._sets.get(String(c).slice(4))) || [c]) };
        }
        const cards =Array.isArray(args.cards) && args.cards.length ? args.cards.map(String) : null;
        if (cards && args.count !== undefined) {
            return JSON.stringify({ ok: false, error: { code: 'BAD_REQUEST', message: 'Send cards or count, not both: cards already makes one per card.' } });
        }
        if (args.flowId) {
            return JSON.stringify({ ok: false, error: { code: 'BATCH_UNSUPPORTED', message: cards
                ? 'A Flow cannot be run over a list of cards: its fields and boxes belong to ONE picture. Call generate once per card, or use a model op.'
                : 'count is for model ops. A Flow runs once per call: call generate once per run.' } });
        }
        let role = null;
        if (cards) {
            role = await this._batchImageRole(args);
            if (!role) {
                return JSON.stringify({ ok: false, error: { code: 'BATCH_UNSUPPORTED', message: `"${args.operation}" does not start from a picture, so there is nothing for a list of cards to fill. Drop cards and send it once — with count if they want several.` } });
            }
        }
        const n = cards ? cards.length : Math.floor(Number(args.count));
        const what = cards ? `running "${args.operation}" over ${n} cards` : `${n} runs of "${args.operation}"`;
        // Each run's own fields. A given seed steps per run, or `count` would make N copies of
        // one picture; with none, the connector rolls a fresh one per submit.
        const runs = cards
            ? cards.map((image) => ({ media: [{ role, image }] }))
            : Array.from({ length: n }, (_, i) => (args.seed !== undefined ? { seed: Number(args.seed) + i } : {}));
        // MPI-876 — money first, and ONE card for the whole batch. A cloud fan-out is N
        // calls and N bills, so the figure quoted is N times the unit price; it is asked
        // here rather than per card so six billed cards raise one question, not six. It
        // also REPLACES the batch card rather than stacking on it: the batch card is about
        // fan-out noise and this one is about money, and a user answering twice for one
        // action learns to stop reading. And a cloud batch BELOW the threshold still asks,
        // for the same reason — the threshold has nothing to do with spending.
        const spend = await this._askSpend(turnId, this._batchQuoteBody(args, runs[0].media || args.media), n);
        if (spend?.declined) {
            return JSON.stringify({ ok: false, declined: true, code: 'SPEND_DECLINED', message: `The user said no to spending on ${what}.${_declinedPriceNote(spend.price)} Ask what they would like instead, ending on [options: A | B]; do not send it again unless they say so.` });
        }
        if (spend === null && n > BATCH_CONFIRM_ABOVE && !await this._askBatch(turnId, n, args)) {
            return JSON.stringify({ ok: false, declined: true, message: `The user said no to ${what}. Ask what they would like instead, ending on [options: A | B]; do not send it again unless they say so.` });
        }

        // Phase 2 — `count` as a REAL batch where the model batches cleanly: one job per
        // AGENT_BATCH_MAX, so the gallery draws every card up front instead of one card and
        // N-1 invisible queued jobs. The connector refuses BATCH_UNSUPPORTED on a model whose
        // images 2+ artefact, before anything is queued, and then it is the fan-out below.
        if (!cards) {
            const batched = await this._runBatched(args, n, turnId, currentProject, spend);
            if (batched) return batched;
        }

        const started = [];
        const refused = [];
        const batch = this._newBatch(turnId, args, currentProject, cards ? 'card' : 'run', spend !== null);
        // MPI-950: N cards in, one new stack out, where the results are NEW cards (the app
        // decides: an edit is its card's next version). A tool always lands as a version.
        const resultStack = cards && n > 1 && !_isTool(args) ? { id: crypto.randomUUID(), total: n } : null;
        for (const [i, run] of runs.entries()) {
            // `wait` is dropped: awaiting each one would run fifty renders end to end inside a
            // single turn, and the fan-out exists precisely so the chat stays free meanwhile.
            const one = { ...args, cards: undefined, count: undefined, wait: undefined, ...run };
            const label = cards ? cards[i] : i + 1;
            let res;
            try {
                res = JSON.parse(await this._executeTool('generate', one, turnId, currentProject, { batch, label, resultStack }));
            } catch (err) {
                res = { ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } };
            }
            // The guide belongs to the MODEL, not the card, so it cannot come out differently
            // further down the list: fifty copies of one message is not a report. Stop on it.
            if (res?.error?.code === 'GUIDE_NOT_READ' || res?.error?.code === 'KNOWLEDGE_NOT_READ') return JSON.stringify(res);
            if (res?.ok) started.push(label);
            else refused.push({ [cards ? 'card' : 'run']: label, code: res?.error?.code || 'ERROR', message: res?.error?.message || 'no reason given' });
        }
        batch.close();

        // One result, whatever the count. A refusal is reported per card because they differ —
        // one missing ref among fifty must not read as "the batch failed".
        const lands = cards && _isTool(args) ? ` Each lands as the ${LANDS_ON_CARDS}.` : '';
        return JSON.stringify({
            ok: started.length > 0,
            started: started.length,
            refused,
            message: refused.length
                ? `Started ${started.length} of ${n}. ${refused.length} were refused — tell the user which, and why.${lands}`
                : `Started all ${started.length}. ${BATCH_STARTED}${lands}${_priceNote(spend)}`,
        });
    }

    /**
     * MPI-941 — a batch is ONE job to the agent (Fabio, 2026-09-26: 350 photos, Cue all).
     *
     * Its items settle into this, not into the chat and the notes: one progress line, replaced
     * in place by id the way a step label is corrected, and ONE note when the last item has
     * settled. No result card per item, no note per item, no look. `validated` is how the
     * batch validates once: see the refusal race in `generate`.
     *
     * It also holds the batch's single line in the unfinished ledger, which is keyed on the
     * prompt, so fifty items sharing one prompt were fifty writes to ONE entry, and the first
     * to land erased it while forty-nine still ran. At the end the entry keeps only what failed.
     * ponytail: an app close mid-batch leaves the whole list in the ledger, landed cards too;
     * split it per card if a requeue ever re-runs too much.
     */
    _newBatch(turnId, args, project, unit, billed = false) {
        const id = crypto.randomUUID();
        const what = _opLabel(args);
        const failed = [];
        const samples = [];
        let started = 0;
        let landed = 0;
        let cancelled = 0;
        let open = true;
        let entry = null;
        let stackId = null;  // MPI-950: the new stack its cards landed in, when they did
        const line = (status) => {
            const label = `${what}: ${landed + failed.length + cancelled} of ${started} done${failed.length ? `, ${failed.length} failed` : ''}`;
            entry ||= this._historyEntry('tool', { id, tool: 'batch', args: {}, status, label });
            Object.assign(entry, { status, label });
            this._emit('agent:tool', { turnId, id, tool: 'batch', status, label });
        };
        const finish = () => {
            if (open || !started || landed + failed.length + cancelled < started) return;
            line(landed ? 'done' : 'failed');
            const groups = new Map();
            for (const f of failed) {
                const k = `${f.code}: ${f.message}`;
                groups.set(k, [...(groups.get(k) || []), f.label]);
            }
            const why = [...groups].map(([k, labels]) => `${k} (${labels.slice(0, 5).join(', ')}${labels.length > 5 ? `, ${labels.length - 5} more` : ''})`).join('; ');
            this._notes.push(`[Batch finished: ${what}, ${started} ${unit}s: ${landed} landed${stackId ? ` in the new stack ${stackId}` : ''}${failed.length ? `, ${failed.length} failed: ${why}` : ''}${cancelled ? `, ${cancelled} cancelled` : ''}.${unit === 'card' && _isTool(args) ? ` Each landed as the ${LANDS_ON_CARDS}.` : ''} They are in the gallery for the user to judge: report it in one sentence and look at none of them.${samples.length ? ` Asked how they came out, look at 3 at most, e.g. ${samples.join(', ')}.` : ''}]`);
            const fails = failed.map((f) => f.label);
            this._trackUnfinished(project, unit === 'card' ? { ...args, cards: fails } : { ...args, count: fails.length },
                failed.length ? [...new Set(failed.map((f) => f.code))].join(', ') : null);
            this._maybeDrained();
        };
        return {
            validated: false,
            billed, // MPI-913: asked once for the batch, so each item knows where it runs
            start: (size = 1) => {
                if (!started) this._trackUnfinished(project, args, 'running');
                started += size;
                line('started');
            },
            settle: (label, r, wasCancelled, size = 1) => {
                if (r?.ok) {
                    landed += size;
                    if (r.output?.stackId && !stackId) {
                        stackId = r.output.stackId;
                        this._groups.add(stackId);
                    }
                    if (samples.length < 3 && r.output?.filePath) samples.push(r.output.filePath);
                } else if (wasCancelled) cancelled += size;
                else for (let i = 0; i < size; i++) failed.push({ label, code: r?.error?.code || 'ERROR', message: r?.error?.message || 'no reason given' });
                line('started');
                finish();
            },
            close: () => { open = false; finish(); },
        };
    }

    /**
     * `count` as batched jobs (MPI-876 phase 2): ceil(n / 4) submits carrying `batch`. Null
     * when the FIRST is refused BATCH_UNSUPPORTED — the model cannot batch cleanly, nothing
     * was queued, and the caller fans out instead. Any other refusal is the answer.
     */
    async _runBatched(args, n, turnId, currentProject, spend) {
        // ponytail: mirrors AGENT_BATCH_MAX in js/data/generationControls.js, which the
        // connector enforces; this loop imports nothing from js/data.
        const MAX = 4;
        let made = 0;
        const batch = this._newBatch(turnId, args, currentProject, 'run', spend !== null);
        for (let i = 0; made < n; i++) {
            const size = Math.min(MAX, n - made);
            // A batch shares one seed; each further job steps it so they do not repeat.
            const one = { ...args, count: undefined, wait: undefined, ...(args.seed !== undefined ? { seed: Number(args.seed) + i } : {}) };
            let res;
            try {
                res = JSON.parse(await this._executeTool('generate', one, turnId, currentProject, { batch, batchSize: size, label: i + 1 }));
            } catch (err) {
                res = { ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } };
            }
            if (!res?.ok) {
                batch.close();
                if (made === 0 && res?.error?.code === 'BATCH_UNSUPPORTED') return null;
                return JSON.stringify(made === 0 ? res : {
                    ok: true, started: made, refused: [{ run: made + 1, code: res?.error?.code || 'ERROR', message: res?.error?.message || 'no reason given' }],
                    message: `Started ${made} of ${n}. The rest were refused — tell the user why.`,
                });
            }
            made += size;
        }
        batch.close();
        return JSON.stringify({ ok: true, started: n, refused: [], message: `Started all ${n} as a batch; every card is already in the gallery. ${BATCH_STARTED}${_priceNote(spend)}` });
    }

    /**
     * The body that prices a fan-out (MPI-876): the outer call, carrying the FIRST run's
     * media — a `cards` batch's first card, or a `count` batch's shared media.
     *
     * The picture is there because two of the shipped cloud models bill for the reference
     * image as well as the output, and a batch always fills exactly one image slot — so
     * quoting the outer args bare would quote a run that does not exist. Every card in a
     * batch costs the same: the ratios this app offers are all a nominal 1 MP, and a
     * reference bills a flat token count whatever its size.
     */
    _batchQuoteBody(args, media = []) {
        // An attachment is only copied into the project when a generation uses it, which
        // has not happened yet. Quoting without it loses the reference's share of the
        // price, never the card itself.
        media = media.flatMap((m) => {
            const ref = this._resolveImage(m.image);
            return ref && ref.kind !== 'attachment' ? [{ role: m.role, url: _projectFileUrl(ref.path) }] : [];
        });
        const body = { modelId: String(args.modelId), operation: String(args.operation), media };
        for (const k of ['ratio', 'qualityTier', 'turbo', 'duration', 'denoise', 'stylization']) {
            if (args[k] !== undefined) body[k] = args[k];
        }
        return body;
    }

    /** Counts one engine failure of this model op since the user last typed, and returns the count (MPI-1286). */
    _engineFail(args) {
        const n = (this._engineFails.get(_failKey(args)) || 0) + 1;
        this._engineFails.set(_failKey(args), n);
        return n;
    }

    /**
     * The role a batch's cards fill: the op's first REQUIRED image slot, or null when it has
     * none. Read off the same op entry `_missingMedia` uses, so a batch and a single call can
     * never disagree about what an op takes.
     */
    async _batchImageRole(args) {
        if (!args.operation) return null;
        const key = `${args.modelId || ''}\n${args.operation}`;
        if (!this._ops.has(key)) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { return null; }
        }
        const slots = this._ops.get(key)?.media || [];
        return slots.find((s) => s.required && s.type === 'image')?.role || null;
    }

    /**
     * MPI-876 — the spend card. The agent never runs a BILLED model without a Yes, and the
     * card says roughly what it will cost.
     *
     * Fabio, 2026-09-21, after watching the in-app agent run a paid cloud model unprompted:
     * "The agent should never do a cloud generation without the user clicking a yes button
     * or an OK button." ASK EVERY TIME — no suppression path, no per-model exemption, no
     * per-conversation memory. That is deliberate for v1 and is not to be designed around
     * without complaints to point at.
     *
     * The price is not computed here. `POST /connector/quote` resolves the run in the
     * renderer and prices what it would actually SEND, through the same `estimateRunCost`
     * the prompt box's live tag uses (MPI-852) — one number, one formula, two surfaces.
     *
     * @param {object} body  the connector body about to be sent, priced as it stands.
     * @param {number} count how many generations this one card is about to agree to.
     * @returns {Promise<{price: string|null, declined?: true}|null>} the card's price, for
     *   `_priceNote` on a Yes and `_declinedPriceNote` on a No (`declined: true`). null when
     *   nothing about this run can be billed, which is every local
     *   model and every Flow that runs locally — those raise no card at all. A Flow whose
     *   edit slot runs on a cloud model bills (MPI-918) and does.
     */
    async _askSpend(turnId, body, count, quoted) {
        const out = quoted !== undefined ? quoted : await this._quote(count > 1 ? { ...body, count } : body);
        const quote = out?.billed ? out : null;
        if (!quote) return null;
        const price = quote.display || null;
        // A No carries the figure too (MPI-1017): told nothing, the agent priced the run it
        // had just been refused off the model's blurb, $0.50 under a card that said $1.90.
        return await this._confirmSpend(turnId, { modelName: quote.modelName, count: quote.count || count, price }, 'generate', body)
            ? { price } : { declined: true, price };
    }

    /**
     * MPI-1260 — every tile size with the tile count the app quotes for it, or null when the app
     * counts none (no card then: a size with no count is no help to choose by).
     */
    async _tileSizes(body) {
        const quotes = await Promise.all(CHOICE_CARDS.tiles.map((s) => this._quote({ ...body, tileSize: Number(s) })));
        const sizes = quotes.map((q, i) => ({ size: Number(CHOICE_CARDS.tiles[i]), tiles: q?.tiles }))
            .filter((s) => Number.isFinite(s.tiles) && s.tiles > 0)
            // A tile bigger than the picture is the picture: on a 1K square 1024 and 1536 are both
            // ONE tile, the same run twice. The smaller size stands for them.
            .filter((s, i, all) => i === 0 || s.tiles !== all[i - 1].tiles);
        return sizes.length ? sizes : null;
    }

    /**
     * MPI-1262 (Fabio, 2026-10-23) — the model card's choices for an upscale or detail of a
     * picture ANOTHER model made: m0 its maker with its style, m1 the agent's pick, then up to two
     * more models of the pick's category that run the op here, best rank first. Null when no
     * card: same model, no maker on record, or the maker cannot run the op on this machine.
     */
    async _modelChoices(args, maker) {
        if (!maker || maker.modelId === args.modelId) return null;
        const op = String(args.operation);
        const key = (id) => `${id}\n${op}`;
        if (!this._ops.has(key(maker.modelId))) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { return null; }
        }
        if (!this._runs.has(key(maker.modelId))) return null;
        const category = (id) => MODELS.find((m) => m.id === id)?.dropdownMeta;
        const rank = (id) => this._ops.get(key(id))?.rank ?? Infinity;
        const others = [...this._runs].map((k) => k.split('\n'))
            .filter(([id, o]) => o === op && id && ![maker.modelId, args.modelId].includes(id) && category(id) && category(id) === category(args.modelId))
            .map(([id]) => id).sort((a, b) => rank(a) - rank(b)).slice(0, 2);
        return [maker.modelId, args.modelId, ...others].map((id, i) => ({
            choice: `m${i}`, modelId: id, name: this._modelNames.get(id) || id,
            ...(i === 0 && maker.style ? { style: maker.style.name } : {}),
        }));
    }

    /** The app's quote of a run (price, and a Use Tiles run's tile count), or null. */
    async _quote(body) {
        try {
            const r = await this._tools.quoteGeneration(body);
            return r?.ok ? r.output : null;
        } catch {
            // An app that cannot answer a quote cannot answer a generate either: the call
            // below fails the same way and spends nothing. Never a reason to raise a card.
            return null;
        }
    }

    /**
     * The spend card itself, for any quote: `_askSpend`'s, or a routine's (MPI-970), which
     * prices every billed step of every card in one figure. Resolves `yes === true` only.
     */
    async _confirmSpend(turnId, { modelName, count, price }, tool, args) {
        const confirmId = crypto.randomUUID();
        // `price` is `estimateCost().display` verbatim — it carries its own "about", never
        // renders "$0.00", and drops to one significant figure below a cent on purpose.
        // Null when the model bills but its price is not knowable before the run: the card
        // still asks, and says so. A price tag may stay silent; a spend gate may not.
        const card = { kind: 'spend', modelName, count, price };
        this._emit('agent:confirm', { turnId, confirmId, ...card });
        this._historyEntry('confirm', { tool, args, confirmId, ...card });
        const yes = await new Promise((resolve) => {
            this._pendingConfirm = { confirmId, ...card, resolve, turnId };
        });
        this._pendingConfirm = null;
        return yes === true;
    }

    /**
     * MPI-970 — the saved routines: a chain of steps saved once, run by the APP on any cards in
     * one call (`js/services/routineRunner.js`: step 1 a new card, later steps its History
     * versions, N cards one new stack). This is only the gates around it: a save waits on
     * app:routines; a run is quoted first (a missing input or model refuses before anyone is
     * asked to pay), asks the price ONCE for every billed step of every card, then is held like
     * a slow generate and reports in ONE `[Routine finished]` note.
     */
    async _routine(args, turnId, currentProject) {
        const folderPath = currentProject?.folderPath || null;
        if (args.action === 'list') return JSON.stringify(await this._tools.listRoutines());
        if (!args.name) {
            return JSON.stringify({ ok: false, error: { code: 'BAD_REQUEST', message: `${args.action || 'This'} needs the routine's name: call routine with action "list" for the names.` } });
        }
        if (args.action === 'save') {
            if (!this._readIds.has('app:routines')) {
                this._gateWaiting = 'app:routines';
                return JSON.stringify({ ok: false, error: { code: 'KNOWLEDGE_NOT_READ', message: 'Nothing was saved: read read_knowledge "app:routines" first, then send this save again written the way it says.' } });
            }
            // A step is a generate call's args, kept in the connector's words, so its prompt is
            // not dropped as an unknown key; a step copied off `list` (already `positive`) too.
            const steps = Array.isArray(args.steps)
                ? args.steps.map((s) => (s && typeof s === 'object'
                    ? { ..._generateFields({ ...s, prompt: s.prompt ?? s.positive }), ...(s.media !== undefined ? { media: s.media } : {}) }
                    : s))
                : args.steps;
            return JSON.stringify(await this._tools.saveRoutine({ name: args.name, summary: args.summary, steps, inputs: args.inputs }));
        }
        if (args.action === 'delete') return JSON.stringify(await this._tools.deleteRoutine(args.name));
        if (args.action === 'rename') return JSON.stringify(await this._tools.renameRoutine(args.name, args.newName));
        if (args.action !== 'run') {
            return JSON.stringify({ ok: false, error: { code: 'BAD_REQUEST', message: 'action is list, save, run, rename or delete.' } });
        }
        // Routines are kept for every project (Fabio, 2026-09-30); a run lands in the open one.
        if (!folderPath) {
            return JSON.stringify({ ok: false, error: { code: 'NO_PROJECT', message: 'No project is open. Call create_project (it opens what it makes) and then call this again.' } });
        }

        // A card the user dragged in, or a dropped set, is named by its ref: run takes groupIds.
        const cards = (Array.isArray(args.cards) ? args.cards : []).flatMap((c) => {
            const set = String(c).startsWith('set:') && this._sets.get(String(c).slice(4));
            return (set || [String(c)]).map((ref) => this._images.get(ref)?.groupId || ref);
        });
        // A picture value is placed the way generate places one; a card id or words pass as given.
        const values = {};
        for (const [id, v] of Object.entries(args.values && typeof args.values === 'object' ? args.values : {})) {
            const ref = typeof v === 'string' ? this._resolveImage(v) : null;
            if (ref?.kind === 'attachment') {
                const placed = await this._tools.placeAsset(folderPath, ref.path);
                if (!placed?.success || !placed.filePath) {
                    return JSON.stringify({ ok: false, error: { code: 'RUNTIME_ERROR', message: `Could not place the attachment in the project: ${placed?.error || 'unknown error'}` } });
                }
                values[id] = placed.filePath;
            } else values[id] = ref ? (ref.groupId || _projectFileUrl(ref.path)) : v;
        }

        const body = { folderPath, cards, inputs: values };
        const quote = await this._tools.quoteRoutine(args.name, body);
        if (!quote?.ok) return JSON.stringify(quote);
        const { missing = [], billed, count, display } = quote.output || {};
        if (missing.length) {
            return JSON.stringify({ ok: false, error: { code: 'NOT_INSTALLED', missing, message: `Nothing was run: this routine needs ${missing.join(', ')}, not installed. Tell the user, and offer install_model for a local model or a Flow.` } });
        }
        if (billed && !await this._confirmSpend(turnId, { modelName: `the routine "${args.name}"`, count, price: display || null }, 'routine', args)) {
            return JSON.stringify({ ok: false, declined: true, code: 'SPEND_DECLINED', message: `The user said no to spending on the routine "${args.name}". Nothing was run.${_declinedPriceNote(display)} Ask what they would like instead, ending on [options: A | B]; do not run it again unless they say so.` });
        }

        const pending = this._tools.runRoutine(args.name, body)
            .catch((err) => ({ ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } }));
        // A refusal (a card of the wrong kind, a step the app turned down) answers at once.
        const early = await Promise.race([pending, new Promise((resolve) => { setTimeout(() => resolve(null), EARLY_REFUSAL_MS); })]);
        if (early && !early.ok) return JSON.stringify(early);
        this._sayStarted();

        const id = crypto.randomUUID();
        this._routineRuns.add(id);
        // MPI-913: its steps run on this PC's ComfyUI. ponytail: an all-cloud routine waits a local
        // agent too; tell them apart when the quote says which steps run where.
        if (this._tools.engineIsLocal?.() === true) {
            this._gpuJobs.add(id);
            this._releaseLlm();
        }
        pending.then((r) => {
            this._routineRuns.delete(id);
            this._gpuJobs.delete(id);
            for (const c of r?.output?.cards || []) if (c.groupId) this._groups.add(c.groupId);
            if (r?.output?.stackId) this._groups.add(r.output.stackId);
            this._notes.push(_routineNote(args.name, r));
            this._maybeDrained();
        });
        return JSON.stringify({ ok: true, started: true, message: `Routine "${args.name}" started on ${count} card${count === 1 ? '' : 's'}. One note comes when every card has finished; the user judges the results in the gallery.` });
    }

    /** The yes/no card above the batch threshold. Resolves false if the conversation is reset. */
    async _askBatch(turnId, count, args) {
        const confirmId = crypto.randomUUID();
        const what = _opLabel(args);
        this._emit('agent:confirm', { turnId, confirmId, kind: 'batch', count, what });
        this._historyEntry('confirm', { tool: 'generate', args, confirmId, kind: 'batch', count, what });
        const yes = await new Promise((resolve) => {
            this._pendingConfirm = { confirmId, kind: 'batch', count, what, resolve, turnId };
        });
        this._pendingConfirm = null;
        return yes === true;
    }

    /** MPI-892 — the step a Flow opens at instead of running (its `agentOpens`), or null to run it. */
    async _flowOpens(flowId) {
        if (!this._opens.has(flowId)) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { /* the app still validates the call */ }
        }
        return this._opens.get(flowId) || null;
    }

    /** MPI-1005 — the `{ field, title }` a Flow's run asks about first (its `agentReview`), or null. */
    async _flowReview(flowId) {
        if (!this._reviews.has(flowId)) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { /* runs unasked, as before */ }
        }
        const review = this._reviews.get(flowId) || null;
        return review && await this._flowRunnable(flowId) ? review : null;
    }

    /**
     * MPI-1004 — false when the Flow is not installed, so no card asks about a run the app will
     * only refuse (the user clicked Use, then read "not installed"). The refusal names it
     * instead. "Missing" is read again before it is trusted: a stale one would skip the ask
     * for a Flow the user has since added, and run it unasked.
     */
    async _flowRunnable(flowId) {
        if (this._flowMissing.has(flowId)) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { /* the app still refuses it */ }
        }
        return !this._flowMissing.has(flowId);
    }

    /**
     * MPI-1005 — the review card (Fabio, 2026-10-01: "Buttons like this should just be commands
     * that run as soon as we click them"). Song's Review lyrics / Just do it were text chips: a
     * click was a user message and a whole agent turn, and the ask happened only if the model
     * obeyed its guide. The app asks now, showing the field's text (what will be sung). Resolves
     * 'review' | 'run' | 'replied' — its own vocabulary, never a boolean (MPI-870); 'replied' (a
     * message typed instead, or a reset) runs nothing.
     */
    async _askReview(turnId, { field, title }, args) {
        return this._askChoice(turnId, { kind: 'review', flow: title, text: String(args.fields?.[field] ?? '') }, args);
    }

    /**
     * MPI-1004 — the library voice this run carries, named for its card, or null. Cosmo picks
     * one only for a line with no sample (app:flows § Spoken lines), so the user sees the pick
     * before the GPU spends. An id the catalogue does not know raises no card: the app refuses
     * it by name, and the model fixes the call. A Flow (Voice Changer) or, since MPI-1012, a
     * model op (Chatterbox's `tts`).
     */
    async _pickedVoice(args) {
        const id = (Array.isArray(args.media) ? args.media : []).find((m) => m?.voice)?.voice;
        if (!id) return null;
        if (!this._voiceNames.has(String(id))) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { return null; }
        }
        const name = this._voiceNames.get(String(id));
        if (!name) return null;
        if (!args.flowId) return { name, title: this._modelNames.get(args.modelId) || args.modelId };
        return await this._flowRunnable(args.flowId) ? { name, title: this._flowTitles.get(args.flowId) || args.flowId } : null;
    }

    /**
     * A card that answers with a CHOICE (`CHOICE_CARDS`): Song's review (MPI-1005), a picked
     * library voice (MPI-1004). Resolves one of the card's choices, or 'replied' (a message
     * typed instead, or a reset), which runs nothing.
     */
    async _askChoice(turnId, card, args) {
        const confirmId = crypto.randomUUID();
        this._emit('agent:confirm', { turnId, confirmId, ...card });
        // `card.kind` names the entry ('review', 'voice'); the chat redraws it answered.
        const entry = this._historyEntry('confirm', { tool: 'generate', args, confirmId, ...card });
        const choice = await new Promise((resolve) => {
            this._pendingConfirm = { confirmId, ...card, resolve, turnId };
        });
        this._pendingConfirm = null;
        entry.choice = choice;
        return choice;
    }

    /**
     * MPI-892 — hand a Flow over instead of running it (Fabio, 2026-09-30): it opens on the user's
     * screen with what this call filled, and nothing runs until they press Generate. A Flow that
     * declares `agentOpens` always comes here (the user draws, places or reads first); any other
     * when the model sends `open: true`. No box gate, no spend card, nothing in flight: nothing is
     * queued. Only in reply to the user (`_follow`), never a wake or a carry: it takes their screen.
     * A click on a review card is the user replying, whatever turn raised it (MPI-1005).
     */
    async _openFlow(args, currentProject, clicked = false, pickVoice = null) {
        if (!this._follow && !clicked) {
            return JSON.stringify({ ok: false, error: { code: 'NOT_NOW', message: `Nothing was opened: a Flow opens on the user's screen only in reply to them. Tell them ${args.flowId} is ready to open and ask.` } });
        }
        // ponytail: the same ref resolution as generate's media loop, minus what only a run reads.
        const media = [];
        for (const m of Array.isArray(args.media) ? args.media : []) {
            if (m?.voice) { media.push({ role: m.role, voice: String(m.voice) }); continue; } // MPI-1004
            const ref = this._resolveImage(m.image);
            if (!ref) {
                return JSON.stringify({ ok: false, error: { code: 'IMAGE_NOT_FOUND', message: `Image reference not found: ${m.image}. Use an attachment id from this conversation, or the filePath of something you generated.` } });
            }
            if (ref.kind !== 'attachment') { media.push({ role: m.role, url: _projectFileUrl(ref.path) }); continue; }
            const placed = await this._tools.placeAsset(currentProject.folderPath, ref.path);
            if (!placed?.success || !placed.filePath) {
                return JSON.stringify({ ok: false, error: { code: 'RUNTIME_ERROR', message: `Could not place the attachment in the project: ${placed?.error || 'unknown error'}` } });
            }
            media.push({ role: m.role, url: placed.filePath });
        }
        const r = await this._tools.openFlow({ flowId: String(args.flowId), fields: args.fields || {}, media, follow: true, ...(pickVoice ? { pickVoice } : {}) });
        if (!r?.ok) {
            return JSON.stringify({ ok: false, error: { ...r?.error, message: `Nothing was opened: ${r?.error?.message || 'the app refused it.'}` } });
        }
        const o = r.output || {};
        return JSON.stringify({
            ok: true, opened: o.opened, at: o.at, ...(o.empty ? { empty: o.empty } : {}), ...(o.hint ? { hint: o.hint } : {}),
            message: `Nothing ran. ${o.opened} is open on the user's screen at "${o.at}", filled with what you sent${o.empty ? `; it still needs ${o.empty}` : ''}. They finish it there and press Cue, and the result lands in the gallery. Tell them so in one line. Say how to do that step (the hint) only if they ask.`,
        });
    }

    /**
     * MPI-1012 — the model twin of `_openFlow`, for its one case: the user chose to pick a model
     * op's voice themselves (Chatterbox's `tts`). The gallery's prompt box opens on the model and
     * op with the line in it and the voice library showing; nothing runs until they press Cue.
     * Only from the card's click, so always the user replying.
     */
    async _openPrompt(args, pickVoice) {
        const r = await this._tools.openPrompt({
            modelId: String(args.modelId), operation: String(args.operation), prompt: String(args.prompt || ''),
            ...(args.language !== undefined ? { language: String(args.language) } : {}),
            ...(pickVoice ? { pickVoice } : {}),
            follow: true,
        });
        if (!r?.ok) {
            return JSON.stringify({ ok: false, error: { ...r?.error, message: `Nothing was opened: ${r?.error?.message || 'the app refused it.'}` } });
        }
        return JSON.stringify({
            ok: true, opened: r.output?.opened,
            message: `Nothing ran. The prompt box is on ${r.output?.opened} with the line in it and the voice library open. The user picks a voice there and presses Cue, and the result lands in the gallery. Tell them so in one line.`,
        });
    }

    /**
     * The first Flow box param whose image no `look` with `box: true` measured, or null. Structural,
     * like the guide gate: live (Phase 4) the model guessed Head Swap boxes at {0,0,512,512} with the
     * box tool right there, and the swap came out half done.
     */
    async _unmeasuredBox(args) {
        if (!this._boxSteps.has(args.flowId)) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { /* the app still validates the call */ }
        }
        const steps = this._boxSteps.get(args.flowId) || [];
        const sent = args.params && typeof args.params === 'object' ? args.params : {};
        // MPI-916: a box Flow sent with NO box ran on the graph's baked default boxes, a guess on
        // every image (gpt-oss-120b, Head Swap). One box may still be left out: the injector keeps
        // each optional, for a donor already cropped to the head. An unknown param is the app's
        // UNKNOWN_PARAM to report.
        const given = steps.filter((s) => s.param in sent);
        for (const step of given.length ? given : steps.slice(0, 1)) {
            const media = Array.isArray(args.media) ? args.media.find((m) => m.role === step.role) : null;
            const ref = media ? this._resolveImage(media.image) : null;
            if (!(step.param in sent) || !ref || !this._boxed.has(ref.path)) return { param: step.param, role: step.role, image: media?.image || null, over: !!ref && this._overBoxed.has(ref.path) };
        }
        return null;
    }

    /**
     * The ratio an op should run at when the user named none and the generation starts from a
     * picture: the op's offered ratio closest to that picture's own shape, same orientation.
     * `null` when there is nothing to choose between, or the picture cannot be read.
     *
     * In CODE and not in the system prompt (Fabio, 2026-09-19). The prompt used to teach the
     * arithmetic — read imageSize, divide, compare, match the orientation — and live the model
     * simply never called `look`, so it had no size to divide and put a LANDSCAPE still on 9:16.
     * Prompt words for this cost tokens on every turn and were still a guess; this is exact and
     * costs the user nothing.
     */
    async _ratioForSource(key, sourcePath) {
        const labels = this._ops.get(key)?.params?.ratios || [];
        if (labels.length < 2 || !sourcePath) return null;
        const size = await _imageSize(sourcePath);
        const [w, h] = size.split('x').map(Number);
        if (!w || !h) return null;

        const shape = w / h;
        const parsed = labels
            .map((label) => {
                const [rw, rh] = String(label).split(':').map(Number);
                return rw && rh ? { label, value: rw / rh } : null;
            })
            .filter(Boolean);
        // A wide picture never takes a tall ratio: the closest ratio by number alone is
        // sometimes the one that crops the head off (a 4:5 is nearest 1:1, which cuts the top,
        // while 9:16 takes the sides and keeps the whole height).
        const orientation = (v) => Math.sign(v - 1);
        const sameWay = parsed.filter((r) => orientation(r.value) === orientation(shape));
        const pool = sameWay.length ? sameWay : parsed;
        const best = pool.reduce((a, b) => (Math.abs(b.value - shape) < Math.abs(a.value - shape) ? b : a));
        return best.label;
    }

    /**
     * The guide a model op needs read before its first prompt, or null. Structural, like the
     * install gate: the H3 samples showed a rule alone did not make the model read one.
     */
    async _unreadGuide(modelId) {
        if (!this._guides.has(modelId)) {
            try { this._rememberGuides(await this._tools.listModels()); } catch { /* the app still validates the call */ }
        }
        const guides = this._guides.get(modelId) || [];
        // The first id is the model's router guide; sub-skills after it are read on need.
        return guides.length && !this._readIds.has(guides[0]) ? guides[0] : null;
    }

    // -------------------------------------------------------------------------
    // Endpoint resolution
    // -------------------------------------------------------------------------

    async _resolveEndpoint(profileId) {
        // Injected override (tests or probe)
        if (this._resolveEndpointOverride) return this._resolveEndpointOverride(profileId);
        return resolveConnection(profileId, this._forkAsk || null);
    }

    /** The agent's pick, or the connection's recommended agent model, or ''. */
    _resolveModel(profileId, model) {
        return (typeof model === 'string' && model.trim()) || recommendedModel(profileId, 'agent');
    }

    /**
     * The model's context window, which sets the compaction threshold: our table,
     * then the endpoint's own `/models` entry (cached for the session), then
     * FALLBACK_CONTEXT_WINDOW. A failed lookup is not cached, so the next turn asks again.
     */
    async _contextWindowFor(profileId, model, profile, key) {
        if (this._lookupContextWindowOverride) {
            return (await this._lookupContextWindowOverride(profileId, model, profile, key)) || FALLBACK_CONTEXT_WINDOW;
        }
        // On Ollama the window is not the endpoint's to report — it is what we ask for
        // per request (`OLLAMA_AGENT_CONTEXT`). Asking `/v1/models` would answer null and
        // land on the 32k fallback, which is right only by accident and wrong the moment
        // that constant changes. Compaction has to follow what we actually set.
        if (profileId === 'ollama') return OLLAMA_AGENT_CONTEXT;
        const known = (RECOMMENDED_REMOTE_MODELS[profileId] || []).find((r) => r.id === model)?.contextWindow;
        if (known) return known;
        const cacheKey = `${profileId}\n${model}`;
        if (this._contextWindows.has(cacheKey)) return this._contextWindows.get(cacheKey);
        try {
            const models = await listRemoteModels({ presetId: profileId, baseURL: profile.baseURL, key });
            const found = models.find((m) => m.id === model)?.contextWindow;
            if (found) {
                this._contextWindows.set(cacheKey, found);
                return found;
            }
        } catch { /* fall through to the conservative default */ }
        return FALLBACK_CONTEXT_WINDOW;
    }

    /**
     * MPI-1208 — does this model take pictures? The endpoint's own catalogue says (DeepInfra
     * tags `vision`, Ollama lists the capability); unknown or unreachable reads as no, so the
     * model gets the describer's words exactly as before.
     */
    async _visionFor(profileId, model, profile, key) {
        if (this._lookupVisionOverride) return !!(await this._lookupVisionOverride(profileId, model, profile, key));
        const cacheKey = `${profileId}\n${model}`;
        if (this._visions.has(cacheKey)) return this._visions.get(cacheKey);
        try {
            const models = await listRemoteModels({ presetId: profileId, baseURL: profile.baseURL, key });
            const vision = models.find((m) => m.id === model)?.vision === true;
            this._visions.set(cacheKey, vision);
            return vision;
        } catch { return false; }
    }

    /**
     * MPI-1208 — `look` with see: true on a vision model: the picture itself, at most
     * SEE_LONG_SIDE px, queued for the round's sight message. A clip is its contact sheet.
     */
    async _seePicture(ref, label, crop) {
        try {
            const { default: sharp } = await import('sharp');
            let facts = '';
            let src = ref.path;
            if (CLIP_EXT.test(ref.path)) {
                const sheet = await this._viewFile(ref.path, { frames: 6 });
                src = sheet.data;
                facts = ` It is a contact sheet of ${sheet.times.length} frames from a ${sheet.duration}s clip, ${sheet.columns} per row, left to right then top to bottom, at ${sheet.times.join('s, ')}s.`;
            }
            let img = sharp(src, { limitInputPixels: false, autoOrient: true });
            if (crop && !facts) img = img.extract({ left: Math.round(crop.x), top: Math.round(crop.y), width: Math.round(crop.width), height: Math.round(crop.height) });
            const { data, info } = await img
                .resize(SEE_LONG_SIDE, SEE_LONG_SIDE, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
            this._sight.push({ label, url: `data:image/jpeg;base64,${data.toString('base64')}` });
            return { ok: true, output: { text: `The picture follows these tool results, at ${info.width}x${info.height}.${facts} Only this turn can see it.` } };
        } catch (err) {
            // Not readable as a picture here: the description is still an answer, as for a text-only model.
            const r = await this._lookOnce(ref);
            return r?.ok ? { ...r, note: `The picture could not be shown (${err.message}); this is its description.` } : r;
        }
    }

    /** Set the fork bridge ask function (called by routes/agent.js after import). */
    setForkBridge(ask) { this._forkAsk = ask; }

    // -------------------------------------------------------------------------
    // System prompt
    // -------------------------------------------------------------------------

    async _buildSystemPrompt(mode) {
        let knowledgeIndex = '';
        try {
            const kr = await this._tools.readKnowledge();
            if (kr?.ok && Array.isArray(kr.entries)) {
                knowledgeIndex =
                    '\nApp knowledge (read_knowledge with an id; describe_model gives a model its guide ids):\n' +
                    kr.entries.filter((e) => e.id.startsWith('app:')).map((e) => `- ${e.id}: ${e.covers || e.title}`).join('\n');
            }
        } catch { /* corpus not reachable — omit */ }

        const modeRules =
            mode === 'auto'
                ? `Mode: Auto. Proceed when the goal is clear without asking about settings. For images: use turbo: true where the op offers it. For video: use qualityTier 'medium' and turbo: true where the op offers them.`
                : `Mode: Ask first. Before any generate, ask the user which settings they want (quality, turbo, ratio, style, where the op offers them) and end your reply there; generate only after they answer. A setting a guide recommends is a suggestion to offer, not permission to skip the question.`;

        return `You are Cosmo, a helpful assistant built into Cubric Studio, a desktop AI image, video and sound tool.

${modeRules}

Voice rule: write the reply, never the thinking behind it; the app already shows the user every step you take. Do not name a rule, a note, an op's description or a knowledge entry, do not justify a choice they have not questioned, and do not write your plan and then carry it out in the same message, with one exception: the message that calls generate, gif or run_routine also carries your reply, one or two short lines saying what is starting (which picture, which model, what changes). The app shows it the moment the job starts, and it is your whole reply: never repeat it after the result. Address them as "you", never as "the user". A why is one short line, not a paragraph.

Content rule: the user is an adult on their own machine. Nudity and adult themes are allowed: write them as asked, never soften them. Never a real, named person. Someone under 18 is never nude, in underwear, sexual or suggestive, and under 16 wears no swimwear. Write generation prompts in English. A CHILD_SAFETY refusal is final: say why in one line.

Declining rule: when you cannot or will not do what was asked, start that reply with [declined]. The app hides it.

Options rule: a reply that offers choices (models, ideas, routes, yes or no) ends with [options: A | B], at most three, recommended first; the app shows buttons.

Check-in rule: when the user asks whether you understood, whether it makes sense or you are on the same page, or says to hold ("don't start yet", "wait", "just tell me"), make nothing that turn: say back in a few short lines what you understood (what happens, the model, each reference's job) and end on [options: Proceed | Not the same page].

Model rule: first the TASK, then the model. Making something with, using or on a name ("using moss image", "use Krea to create it") names a model or Flow, never a picture to look for: a name you do not know, check list_models.A change to what is IN an existing picture, local or across the frame (remove, add or replace a thing, the background, light, time of day: "make it night"), is the edit task (kleinEdit, krea2Edit, qwenEdit, edit), not i2i, even when the named model's i2i ranks first; a restyle the user asks for ("make this anime") is i2i; a miss goes to the edit task, not another denoise. Detail or size is never an edit: app:upscaling. A head from one picture onto another is the Head Swap Flow, never a mask. The same picture on ANOTHER model ("this image but with <model>") is a RE-RUN: that model's text-to-image op with NO media, from the source's prompt (list_cards for a card; otherwise look at the picture, write it from what is there and say so in one line) rewritten to that model's guide. A model's name is never a style instruction; only an ask to change how THIS picture looks sends the picture. A picture or clip shown for how to SHOOT a new clip (an angle, a framing, a camera move, how someone moves) is a reference op's media with that one job, never the thing to edit; unsure which: ask, [options: Use it as a reference | Edit this picture]. A reference picture of several people or things the words do not choose between goes in whole, each named in the prompt; ask which only when the words mean ONE and the picture cannot tell. One shown for its LOOK on any image or video job (grain or noise, the light, a colour cast or grade) travels as words: look at it and write only what they want taken from it into the prompt ("heavy film grain", "everything washed in green"). Ranks compare ops only within one task, and best: true marks the op to take: the lowest rank you can run here. No rank means unranked, not bad. Take another only when the user names a model or the op's note matches the ask, and then say which model and why in one line. Nothing installed fits: say so and offer install_model.

Joining rule: a model named for one clip does not carry to the next. A clip to join to others (before, after, between): read app:joining-clips first.

Route rule: words to put on a picture are an ordinary edit: run it, no mask question. Before any other edit of an existing picture, answer this yourself: does the change stay inside ONE area? A character sheet (front, back and close-up of one character) is never that question: any change to it is Character Sheet Editor (app:flows), but one area of its result that came back soft or smudged is offered a mask (app:flows). Light, sky, time of day, weather, season and style fall on the whole frame, and several asks in one message are ONE edit, never split. Not one area: run ONE whole-picture edit, ask nothing. One area with words that protect the rest ("only this", "without changing anything else"): ask for the mask, offer nothing else. One area with no such words: in ONE line give both routes (a mask is tighter; a whole-picture edit needs no painting and often lands), recommend one, end on [options: Mask | Whole-picture edit] and wait; how to paint comes only after they pick Mask. A mask also keeps the source's size and every pixel outside it, so offer one for a big photo or when an edit lost quality. When a result comes back wrong, change the op, the mask or the prompt, never add adjectives; details in app:masking.

Masking rule: the user paints a mask, never you, and you never pick the area. Tell them: click the card in the gallery to open it, then pick the Mask tool from the toolbar down the left; on the card, the App state line gives the words instead. Never say "History". What they paint reaches your generation on its own, on the picture it was painted over. generate refuses a masked op until you have read app:masking, which says how to write the prompt for each op.

Settings rule: list_models carries no settings. Once you have picked a model or Flow, describe_model gives each op's params (the only values it accepts), its media roles, a Flow's fields and boxes, its guide ids, and any rules: follow them. Never send a value its params do not list. Infer ratio from words that imply a shape. Platform shapes and when a style is worth it: app:formats.

Guide rule: adapt what the user asked for to the model's guide (its structure, length and vocabulary) and keep their intent. Never send a guide's example as the prompt.

Numbering rule: "picture 2", "image 2" or "2" in a message means that message's attached image 2, never an image from an earlier turn. Pass that attachment's id.

Looking rule: before you comment on, judge or describe any image, call look on it. look takes only a ref the App state line lists; it cannot open a folder or a path. If the describer refuses, say so and suggest the local ComfyUI describer (Remote > Language Models).

Flow rule: before your first Flow run or answer about one, read app:flows.

Plan rule: before the first run of an ask that changes several things (shape, content, pose, who is in it, style), work out what must change and give each to a tool whose note says it changes that, in an order where no step undoes an earlier one.

Chaining rule: when the second half of a request needs the first ("make it 9:16, then animate it"), generate the first with wait: true; its result carries the filePath the next step takes. Do both halves. When the first step's output is something they will judge (a new shape, style or face), look at it and redo it if it came back wrong. Never end a turn with half done without saying which half is missing and why.

Project rule: a generation lands in the open project. open_project takes only a folderPath from list_projects or create_project, or one the user typed; find a project by name with list_projects. With no project open and anything to be MADE, create a project named after it (create_project opens it) and make it in the same turn; never ask them to open or create one. Asked to start a new project, create it, named after its goal; that alone asks for nothing to be made. Background they give is material: note what matters with write_memory, then still make everything asked. Only when they describe a project and ask for NOTHING to be made, end by asking what they want first.

Cards rule: the App state line lists only what this conversation touched; list_cards reads the whole open project. When the App state line says the user is looking at a card, "this image", "it" and "this one" mean that entry: work on it, do not call list_cards to find it, never ask them to attach it. When they point at something with no ref listed ("the duck video", "the last one", a card's name), call list_cards before saying you cannot see it. Read a card in full when its prompt or settings matter. What a card says it ran is the truth about that file. "The last", "the latest" and "the one before" follow the list's order, newest first, over everything in the project; a project note never answers it. If a generation of yours reported a failure, check list_cards before redoing it: the file may have landed.

Repeat rule: to repeat a card, read it in full first (list_cards with its groupId) and follow what it says.

Memory rule: your notes survive a restart, per project and global (all projects, only when asked); the first message lists them, and read_memory reads one before you rely on it. The moment the user states a goal, names or describes a character, settles a look, decides something, or a model or setting works or fails, call write_memory that turn, without asking, in the same message as any job you start: a turn ending without the note loses it. Say in one line what you noted. One note per thing: update it, never add a second. Never save keys, passwords or personal data.

Naming rule: a finished generation reports its card id. When a result is worth referring to later, name its card with rename_card, or pass cardName with generate.

Routines rule: asked what you can do, name routines: steps saved once, run on any cards by you or from Routines on the gallery selection bar, which only runs them.

Docs rule: for a question about the app or something it does, first read the App knowledge entry that covers it; if none does, say so and link [the documentation](https://docs.cubric.studio). Never guess how the app works. Other image, video and audio advice is yours to give.

Honest limits (I'm still a baby — this is my first version):
- I never delete cards, media, notes or projects, and never look for a way. My own routines are the exception: I rename and delete those. You can: a card from the gallery (right-click it, Delete, which removes its whole history), a project from the projects list on the landing page (right-click it, Delete project).
- I see a clip as 6 frames to stay cheap, and hear its speech. MCP view_card shows more.
- I cannot paint masks, or use the mask, paint, composite and transform tools myself. I can USE a mask you have painted: ask me for a change to one area and I will tell you what to paint.
- I cannot move your view myself. The app opens where a result renders, unless you are mid-edit with a canvas tool or have a window open; then the result card in this chat takes you there.
- I cannot control RunPod.
- I cannot search or browse the internet, and I never make up a link.
- I see only what the look tool reported. I never claim to have seen something I did not look at.
- I cannot access generation history.
${knowledgeIndex}`.trim();
    }

    // -------------------------------------------------------------------------
    // Execute a single tool call
    // -------------------------------------------------------------------------

    /**
     * @param {object} [opts]
     * @param {object} [opts.batch]  this call is one item of a fan-out (`_newBatch`), not a
     *   call the model made. Only `generate` reads it: no spend card (asked once for the
     *   batch), no refusal race once one item passed it, and the item settles into the batch
     *   instead of the chat, the notes and an auto-look (MPI-870, MPI-941).
     * @param {string|number} [opts.label]  the item's card ref or run number, for the batch note
     */
    async _executeTool(toolName, args, turnId, currentProject, opts = {}) {
        switch (toolName) {
            case 'list_models': {
                const r = await this._tools.listModels();
                this._rememberGuides(r);
                return JSON.stringify(compactCatalogue(r));
            }
            case 'describe_model': {
                const r = await this._tools.listModels();
                if (!r?.ok) return JSON.stringify(r);
                this._rememberGuides(r);
                const entry = catalogueEntry(r, args?.id);
                if (!entry) {
                    return JSON.stringify({ ok: false, error: { code: 'UNKNOWN_MODEL', message: `No model or Flow "${args?.id}". Use an id exactly as list_models gives it.` } });
                }
                const ops = entry.model?.ops || [];
                const rules = OP_RULES.filter((r) => !this._rulesSent.has(r.id) && ops.some(r.when));
                rules.forEach((r) => this._rulesSent.add(r.id));
                return JSON.stringify({ ok: true, ...entry, ...(rules.length && { rules: rules.map((r) => r.text) }) });
            }
            case 'read_knowledge': {
                const r = await this._tools.readKnowledge(args?.id);
                if (r?.ok && args?.id) this._readIds.add(String(args.id));
                // MPI-916: gpt-oss-120b read the guide a generate was refused for, told the user
                // it was generating, and ended the turn with nothing sent.
                if (r?.ok && args?.id && String(args.id) === this._gateWaiting) {
                    this._gateWaiting = null;
                    return JSON.stringify({ ...r, next: 'The call that waited on this has NOT run. Send it again now, written the way this says.' });
                }
                return JSON.stringify(r);
            }
            case 'install_model': {
                // Step 1: the model must be one list_models knows; the card shows its name and size.
                // A guessed id ("ltx-2.3" for ltx-23-balanced, agent-test 2026-09-17) got a card too.
                let m;
                let list;
                try {
                    list = await this._tools.listModels();
                    m = list?.models?.find((x) => x.id === args.modelId);
                } catch (err) {
                    return JSON.stringify({ ok: false, error: { code: 'RUNTIME_ERROR', message: `Could not read the model list: ${err.message}` } });
                }
                // MPI-1127 (Fabio, 2026-10-13): a Flow installs here too, behind the same card —
                // the Flow Library's own Install (MPI-1126). Asked without `start`, it answers the
                // size and refuses what cannot go (installed, no engine) before any card shows.
                const flow = !m && list?.flows?.find((f) => f.id === args.modelId);
                let card;
                if (flow) {
                    let q;
                    try {
                        q = await this._tools.installFlow(flow.id, false);
                    } catch (err) {
                        return JSON.stringify({ ok: false, error: { code: 'RUNTIME_ERROR', message: `Could not read what ${flow.title} needs: ${err.message}` } });
                    }
                    if (!q?.ok) return JSON.stringify(cosmoNoEngine(q));
                    card = { flowId: flow.id, modelName: q.title || flow.title, downloadGb: q.downloadGb ?? null, licence: !!q.licence };
                } else if (!m) {
                    return JSON.stringify({ ok: false, error: { code: 'UNKNOWN_MODEL', message: `No model or Flow "${args.modelId}". Use an id exactly as list_models gives it.` } });
                } else if (m.installed === true) {
                    // MPI-1228: the model's list_models answer is from earlier in the chat; the user
                    // can install from the Models panel since. This re-read is the truth, as the
                    // Flow branch's installFlow(…, false) and the MCP twin already treat it.
                    return JSON.stringify({ ok: false, error: { code: 'ALREADY_INSTALLED', message: `Nothing to install: ${m.name || args.modelId} is installed (since your last list_models). Go on with what the user asked.` } });
                } else if (m.provider) {
                    // MPI-1229: a cloud model has no weights; not installed means no API key (as the MCP twin says).
                    return JSON.stringify({ ok: false, error: { code: 'NOTHING_TO_DOWNLOAD', message: `Nothing to install: ${m.name || args.modelId} runs in the cloud, so nothing downloads. It runs once the user adds their API key in Settings: tell them so.` } });
                } else {
                    card = { modelName: m.name || args.modelId, downloadGb: m.missingDownloadGb ?? null };
                }

                const confirmId = crypto.randomUUID();
                this._emit('agent:confirm', { turnId, confirmId, kind: 'install', modelId: args.modelId, ...card });
                this._historyEntry('confirm', { tool: 'install_model', args, confirmId, modelId: args.modelId, ...card });

                // Suspend the turn until POST /agent/confirm arrives
                const answer = await new Promise((resolve) => {
                    this._pendingConfirm = { confirmId, modelId: args.modelId, ...card, resolve, turnId };
                });
                this._pendingConfirm = null;
                return answer; // 'installed: ...' or 'User declined the installation. ...'
            }
            case 'generate': {
                if (!currentProject) {
                    // The message is the instruction, not the prompt (Fabio, 2026-09-19). This used
                    // to read "Please open or create a project first" and the model relayed it to
                    // him almost verbatim — the exact opposite of the Project rule above, which
                    // says creating one is the agent's job. A concrete tool result beats a prompt
                    // rule every time, so the result now names the call that fixes it.
                    return JSON.stringify({ ok: false, error: { code: 'NO_PROJECT', message: 'Nothing was generated: no project is open. Call create_project now, named after what you are making — it opens what it makes — then send this same generate again. Do not ask the user to open or create one; that is your job.' } });
                }
                // MPI-1286: a bare ref (`media: "ref2v_001.mp4"`) was read as no media at all, and
                // the slot refusal told the model "your call passed none", so it sent the same
                // string again. Every media reader below takes a list; say so with its own value.
                if (args.media !== undefined && !Array.isArray(args.media)) {
                    return JSON.stringify({ ok: false, error: { code: 'BAD_REQUEST', message: `Nothing was generated: media is a list of { role, image }, and your call sent ${JSON.stringify(args.media)}. Send it again as media: [{ role: "<the slot>", image: "<the ref>" }]; describe_model lists the roles each op takes.` } });
                }
                // MPI-1286: `flowId: "minimax-h3"` with an operation, live on the bench. The app
                // answers "No Flow" and points at install_model, which the model cannot act on.
                if (args.flowId && !args.modelId) {
                    const id = String(args.flowId);
                    if (!this._flowTitles.has(id) && !this._modelNames.has(id)) {
                        try { this._rememberGuides(await this._tools.listModels()); } catch { /* the app still refuses it */ }
                    }
                    if (!this._flowTitles.has(id) && this._modelNames.has(id)) {
                        return JSON.stringify({ ok: false, error: { code: 'BAD_REQUEST', message: `Nothing was generated: "${id}" is a model, not a Flow. Send it again with modelId: "${id}" and its operation, and no flowId.` } });
                    }
                }
                if ((this._engineFails.get(_failKey(args)) || 0) >= MAX_ENGINE_FAILS) {
                    return JSON.stringify({ ok: false, error: { code: 'REPEATED_FAILURE', message: `Nothing was generated: ${args.flowId || `${args.modelId || ''} ${args.operation || ''}`.trim()} has failed twice since the user last wrote, so another try is theirs to ask for. Tell the user in one line what failed, quoting the error, and ask what to do, ending on [options: Try again | Something else].` } });
                }
                // MPI-1053: the plain imageUpscale is best: true for the upscale task, and live it
                // ran for "bigger AND more detail" with every route written in its own note. The
                // read beats the flag: once per conversation, before a batch is offered.
                if (!args.flowId && UPSCALE_OPS.has(args.operation) && !this._readIds.has('app:upscaling')) {
                    this._gateWaiting = 'app:upscaling';
                    return JSON.stringify({ ok: false, error: { code: 'KNOWLEDGE_NOT_READ', message: 'Nothing was generated: read read_knowledge "app:upscaling" first, then send the route it gives for what the user asked.' } });
                }
                const fanned = Array.isArray(args.cards) && args.cards.length;
                if (!args.flowId && args.modelId) {
                    const unread = await this._unreadGuide(String(args.modelId));
                    if (unread) {
                        // MPI-916: says the retry out loud, as the masking refusal below does. Told
                        // only "then write the prompt", gpt-oss-120b read the guide and stopped.
                        this._gateWaiting = unread;
                        return JSON.stringify({ ok: false, error: { code: 'GUIDE_NOT_READ', message: `Nothing was generated: read this model's prompting guide first (read_knowledge with id "${unread}"), then send this generate again with the prompt written the way it says.` } });
                    }
                    if (this._masked && MASKED_OPS.has(args.operation) && !this._readIds.has('app:masking')) {
                        this._gateWaiting = 'app:masking';
                        return JSON.stringify({ ok: false, error: { code: 'KNOWLEDGE_NOT_READ', message: 'Nothing was generated: the user has a mask painted and this op runs on it. Read read_knowledge "app:masking" first, then write the prompt for the masked area only and send this again.' } });
                    }
                    // MPI-870 — the fan-out goes between the gates, on purpose. The guide and the
                    // masking read above belong to the MODEL, so they refuse the batch before the
                    // user is asked: after the ask, a Yes was spent on a batch that then refused
                    // every card, and the retry asked again (Fabio live, 2026-09-27, MPI-941). The
                    // media gate below is per picture, and `cards` is exactly what fills that slot:
                    // asked of the OUTER call it refuses every batch. Each fanned-out call re-enters
                    // this case carrying its own media and meets every gate.
                    if (fanned) return this._fanOut(args, turnId, currentProject);
                    const gap = await this._missingMedia(args);
                    if (gap) {
                        const roles = gap.slots.map((s) => `"${s.role}" (${s.type}${s.required ? ', required' : ''})`).join(', ');
                        return JSON.stringify({ ok: false, error: { code: 'MEDIA_REQUIRED', message: `Nothing was generated: "${args.operation}" needs ${gap.missing.type} in its "${gap.missing.role}" slot and your call passed none. Send it again with media: [{ role: "${gap.missing.role}", image: "<a ref the App state line lists>" }]. The slots this op takes: ${roles}.` } });
                    }
                }
                // A Flow, or no model named: `_fanOut` refuses what it cannot fan out, by name.
                if (fanned) return this._fanOut(args, turnId, currentProject);
                // MPI-876 — `count`, AFTER the guide and media gates, unlike `cards`: every run
                // shares this call's media, so the outer call's answer is every run's answer, and
                // a refusal here costs no spend card the user already said Yes to.
                if (Number(args.count) > 1) {
                    // MPI-1017: how many is the panel's batch while it is open, never a fan-out.
                    if (this._pinned && args.modelId && !args.flowId) {
                        return JSON.stringify({ ok: false, error: { code: 'SETTINGS_PINNED', message: `Nothing was generated: the user has the settings panel open, so how many is theirs — each generate makes ${this._pinned.batch || 1}, the panel's batch. Send it once with no count, or ask them to change the batch or close the settings panel, and you will pick.` } });
                    }
                    return this._fanOut(args, turnId, currentProject);
                }
                // MPI-892 — handed over, never run: before the box gate, because a box on a Flow
                // the user finishes is theirs to draw.
                if (args.flowId && (args.open === true || await this._flowOpens(args.flowId))) {
                    return this._openFlow(args, currentProject);
                }
                // MPI-1005 — the app asks, and the click does the job: the turn ends after this
                // round (`_reviewEnd`), with no model call to narrate what the user just did.
                const review = args.flowId && !opts.batch ? await this._flowReview(args.flowId) : null;
                if (review) {
                    const choice = await this._askReview(turnId, review, args);
                    if (choice === 'review') {
                        this._reviewEnd = `Opened ${review.title} for the user to review, as they chose. Nothing ran.`;
                        return this._openFlow(args, currentProject, true);
                    }
                    if (choice !== 'run') {
                        this._reviewEnd = 'The user wrote back instead of choosing. Nothing ran.';
                        return JSON.stringify({ ok: true, replied: true, message: `Nothing ran: the user answered the ${review.title} card in words instead. Their message comes next.` });
                    }
                    this._reviewEnd = `Started ${review.title}, as the user chose.`;
                }
                // MPI-1004 — the same shape for a library voice Cosmo picked (Fabio, 2026-10-01):
                // "Pick from the voice library" opens the Flow (or, MPI-1012, the prompt box on the
                // model) with that slot empty for the user's own pick; "Use <voice>" runs it as sent.
                const picked = (args.flowId || args.modelId) && !opts.batch ? await this._pickedVoice(args) : null;
                if (picked) {
                    const choice = await this._askChoice(turnId, { kind: 'voice', flow: picked.title, voice: picked.name }, args);
                    if (choice === 'library') {
                        this._reviewEnd = `Opened ${picked.title} for the user to pick a voice from the library, as they chose. Nothing ran.`;
                        // Opened on the voice slot's picker, already in the library (Fabio, 2026-10-01).
                        const pickVoice = args.media.find((m) => m?.voice)?.role;
                        const rest = { ...args, media: args.media.filter((m) => !m?.voice) };
                        return args.flowId ? this._openFlow(rest, currentProject, true, pickVoice) : this._openPrompt(rest, pickVoice);
                    }
                    if (choice !== 'use') {
                        this._reviewEnd = 'The user wrote back instead of choosing. Nothing ran.';
                        return JSON.stringify({ ok: true, replied: true, message: 'Nothing ran: the user answered the voice card in words instead. Their message comes next.' });
                    }
                    this._reviewEnd = `Started ${picked.title} with the ${picked.name} voice, as the user chose.`;
                }
                if (args.flowId) {
                    const miss = await this._unmeasuredBox(args);
                    if (miss) {
                        const where = miss.image ? `"${miss.image}"` : `the image you pass as media role "${miss.role}"`;
                        if (miss.over) {
                            return JSON.stringify({ ok: false, error: { code: 'BOX_TOO_BIG', message: `Nothing was generated: the box measured for ${miss.param} on ${where} covers the whole person, not the head. Measure it again with a question that says head only, at most once more; if that is still too big, ask the user to crop the photo to the head.` } });
                        }
                        return JSON.stringify({ ok: false, error: { code: 'BOX_NOT_MEASURED', message: `Never guess a box. Measure ${miss.param} first: call look on ${where} with box: true and a question naming what to box, then pass the box it returns (its square when the step has ratio 1).` } });
                    }
                }
                // Build connector body
                const body = {};
                // Not a batch item: fifty cards following the work are fifty navigations while
                // the user watches, and the batch's one progress line is in the chat anyway.
                if (this._follow && !opts.batch) body.follow = true;
                if (args.cardName) body.cardName = String(args.cardName);
                Object.assign(body, _generateFields(args));
                // Set only by `_fanOut`, never by the model: the tool has no `batch` field.
                if (!args.flowId && opts.batchSize > 1) body.batch = opts.batchSize;
                if (opts.resultStack) body.resultStack = opts.resultStack;
                // Resolve media references. An attachment is copied into the project
                // here — only now that a generation uses it — and a result is passed
                // back by its project-file url (contract § Tools).
                let sourcePath = null;
                let sourceIsCard = false;
                if (Array.isArray(args.media) && args.media.length) {
                    const resolved = [];
                    for (const m of args.media) {
                        // MPI-1004: a library voice is an id, not a file; the app turns it into one.
                        if (m?.voice) { resolved.push({ role: m.role, voice: String(m.voice) }); continue; }
                        const ref = this._resolveImage(m.image);
                        if (!sourcePath && ref) { sourcePath = ref.path; sourceIsCard = !!ref.itemId; }
                        if (!ref) {
                            return JSON.stringify({ ok: false, error: { code: 'IMAGE_NOT_FOUND', message: `Image reference not found: ${m.image}. Use an attachment id from this conversation, or the filePath of something you generated.` } });
                        }
                        if (ref.kind === 'attachment') {
                            const placed = await this._tools.placeAsset(currentProject.folderPath, ref.path);
                            if (!placed?.success || !placed.filePath) {
                                return JSON.stringify({ ok: false, error: { code: 'RUNTIME_ERROR', message: `Could not place the attachment in the project: ${placed?.error || 'unknown error'}` } });
                            }
                            resolved.push({ role: m.role, url: placed.filePath, ...(m.frame === 'last' ? { frame: 'last' } : {}) });
                        } else {
                            resolved.push({ role: m.role, url: _projectFileUrl(ref.path), ...(m.frame === 'last' ? { frame: 'last' } : {}) });
                        }
                    }
                    body.media = resolved;
                }

                // MPI-1262 (Fabio, 2026-10-23) — an upscale or detail redraws a picture at its own
                // look, so what made it matters: a Moss Anime picture's detail pass went to ILL
                // Anime and the look changed. Made by another model that runs the op here: the app
                // asks which model redraws it, its maker with its style first, and the click runs
                // it. The same model with no style named keeps the source's style, never style 0
                // (upscale_005 and detail_011 lost "Anime"). The settings panel's style is theirs.
                if (!args.flowId && args.modelId && sourceIsCard && REDRAW_OPS.has(args.operation) && !this._pinned) {
                    const maker = await this._madeWith(sourcePath).catch(() => null);
                    const choices = !opts.batch && this._follow ? await this._modelChoices(args, maker) : null;
                    if (choices) {
                        const choice = await this._askChoice(turnId, { kind: 'model', models: choices, pick: 'm0' }, args);
                        const picked = choices.find((c) => c.choice === choice);
                        if (!picked) {
                            this._reviewEnd = 'The user wrote back instead of choosing a model. Nothing ran.';
                            return JSON.stringify({ ok: true, replied: true, message: 'Nothing ran: the user answered the model card in words instead. Their message comes next.' });
                        }
                        if (picked.modelId !== args.modelId) {
                            // A style number is its own model's list: never carried to another model.
                            delete body.styleSelect;
                            delete body.stylization;
                            args.modelId = body.modelId = picked.modelId;
                        }
                        this._reviewEnd = `Started the ${args.operation} with ${picked.name}${picked.style ? ` in its ${picked.style} style` : ''}, as the user chose.`;
                    }
                    const model = MODELS.find((m) => m.id === args.modelId);
                    if (maker?.style && maker.modelId === args.modelId && body.styleSelect === undefined && modelShowsStyleRack(model, args.operation)) {
                        body.styleSelect = maker.style.styleSelect;
                        if (maker.style.stylization !== undefined) body.stylization = maker.style.stylization;
                    }
                }

                // No ratio asked for, and it starts from a picture: give it the picture's own
                // shape rather than the project's last saved ratio, which has nothing to do with
                // the picture. Said out loud in the result, or the model narrates a ratio it
                // picked in its head (live: "the video will have a 9:16 aspect ratio").
                //
                // And it names the WHOLE list. Live (Fabio, 2026-09-19): a 768x1024 picture went to
                // H3 on 9:16 and the agent wrote "if you'd rather keep the full 768x1024 framing I
                // can adjust". H3 has no 3:4. "Taken from the picture's own shape" read as a
                // choice among any shape, when it was the nearest of a closed set.
                // Not on a Custom size edit (params.customSize): there a ratio turns custom size ON, and
                // unasked it keeps reference 1's own frame (MPI-1208, from Flux.3 integration 11).
                let snapNote = '';
                const opKey = `${args.modelId}\n${args.operation}`;
                if (!args.flowId && args.ratio === undefined && sourcePath && args.modelId && args.operation
                    && !this._ops.get(opKey)?.params?.customSize) {
                    const snapped = await this._ratioForSource(opKey, sourcePath);
                    if (snapped) {
                        body.ratio = snapped;
                        const all = (this._ops.get(opKey)?.params?.ratios || []).join(', ');
                        snapNote = ` Ratio ${snapped}: the nearest to the picture's shape of the only ratios this model makes (${all}). It cannot make the picture's own size or any ratio outside that list, so never offer one.`;
                    }
                }

                // Fire, and wait only long enough to learn it was REFUSED.
                //
                // Live (Fabio, 2026-09-19): the model sent a Krea2 style by its label, the route
                // refused it with INVALID_STYLE_SELECT before anything reached the queue — the log
                // has no `generation.submit` at all — and the chat still said "Your image of a
                // cowgirl riding a big bull is on its way." Fire-and-forget answered `started: true`
                // in the same tick, so the model narrated a success that never existed and could
                // not correct itself, because the refusal only arrived at the START of the next
                // turn. This is the same failure the media gate closed for one case: a refusal
                // landing after `{ started: true }`. Here it is closed for all of them.
                // MPI-876 — the spend gate, and the LAST thing before the fire on purpose.
                // It prices `body` as it now stands, after the ratio snap and after media
                // resolution, so the figure quoted is the price of the run that is about to
                // happen rather than of the call the model wrote. Nothing below it can be
                // un-spent: `generate` is fire-and-almost-forget and the race that follows
                // only learns whether it was REFUSED, so a gate after it has already cost
                // the user money. A fan-out asked once for the whole batch in `_fanOut`; a
                // local model is quoted `billed: false` and is never asked about at all.
                // MPI-1260 (Fabio, 2026-10-23) — a Use Tiles run with no tile size named asks
                // first: the app quotes every size and the user clicks one, seeing what each costs
                // in tiles (a 1K square at 1024 is ONE tile; a 16K result at 256 is ~4,000). The
                // click runs it and the turn ends there, like a review. With the settings panel
                // open the panel's Tile size is theirs already, so no card.
                if (!opts.batch && body.tiles === true && body.tileSize === undefined && !this._pinned) {
                    const sizes = await this._tileSizes(body);
                    if (sizes) {
                        const pick = sizes.reduce((a, b) => (Math.abs(b.tiles - 20) < Math.abs(a.tiles - 20) ? b : a)).size;
                        const choice = await this._askChoice(turnId, { kind: 'tiles', sizes, pick }, args);
                        if (!CHOICE_CARDS.tiles.includes(choice)) {
                            this._reviewEnd = 'The user wrote back instead of choosing a tile size. Nothing ran.';
                            return JSON.stringify({ ok: true, replied: true, message: 'Nothing ran: the user answered the tile size card in words instead. Their message comes next.' });
                        }
                        body.tileSize = Number(choice);
                        const n = sizes.find((s) => s.size === body.tileSize)?.tiles;
                        this._reviewEnd = `Started the tiled run at ${choice} px tiles${n ? ` (up to ${n} tiles)` : ''}, as the user chose.`;
                    }
                }
                let spend = null;
                let quoted = null;
                if (!opts.batch) {
                    quoted = await this._quote(body);
                    spend = await this._askSpend(turnId, body, 1, quoted);
                    if (spend?.declined) {
                        return JSON.stringify({ ok: false, declined: true, code: 'SPEND_DECLINED', message: `The user said no to spending on this generation. Nothing was generated and nothing was billed.${_declinedPriceNote(spend.price)} Ask what they would like instead, ending on [options: A | B]; do not send it again unless they say so.` });
                    }
                }

                const toolCallId = crypto.randomUUID();
                // The route holds its response for the whole render, so this id is the only
                // handle on the job until it is over — `cancel_generation` sends it back.
                body.requestId = toolCallId;
                const pending = this._tools.generate(body);
                // MPI-941 — a batch validates ONCE. Its items share the model, op, params and
                // guide, so once one is past this window the rest can only fail on their own
                // picture, and that settles as the item's failure. Paid per card, 350 photos took
                // six minutes to queue with the chat blocked.
                const early = opts.batch?.validated ? null : await Promise.race([
                    pending.then((r) => r, (err) => ({ ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } })),
                    new Promise((resolve) => { setTimeout(() => resolve(null), EARLY_REFUSAL_MS); }),
                ]);
                if (early && !early.ok) {
                    // Stopped in its first second: the user's Stop, not a call to fix and resend.
                    if (early.error?.code === 'CANCELLED') return JSON.stringify({ ok: false, error: STOPPED });
                    // Nothing was queued, so there is no result to report and nothing to note:
                    // the model has this in-turn and can fix the call and send it again.
                    const miss = /^(INVALID_|UNKNOWN_PARAM|MEDIA_REQUIRED)/.test(early.error?.code || '');
                    const where = args.flowId || args.modelId;
                    // MPI-892 (Fabio): "You didn't provide the voice sample. I can open the flow for you."
                    // MPI-1004: a voice slot takes a library voice, and the app shows the pick first.
                    const offer = args.flowId && early.error?.code === 'MEDIA_REQUIRED'
                        ? ' A voice slot takes a library voice instead: pick the one describe_model lists for that role that fits the speaker and send this again with media: [{ role, voice: "<id>" }]; the app shows the user your pick before anything runs. Anything else only the user has (their own photo): offer to open the Flow for them to add it, this same call with open: true.' : '';
                    return JSON.stringify({ ok: false, error: {
                        ...early.error,
                        message: `Nothing was generated: ${early.error?.message || 'the generation was refused.'}${miss && where ? ` Call describe_model with "${where}" for the values it accepts, then send it again.` : ''}${offer}`,
                    } });
                }
                this._sayStarted();
                // It is queued. Until it lands, this is the only trace of what was asked for.
                // A batch keeps ONE ledger entry for all its items (`_newBatch`).
                const askedIn = currentProject;
                if (opts.batch) {
                    opts.batch.validated = true;
                    opts.batch.start(opts.batchSize || 1);
                } else {
                    await this._trackUnfinished(askedIn, args, 'running');
                }
                this._inflight.set(toolCallId, (args.cardName || String(args.prompt || args.flowId || '').slice(0, 60) || _opLabel(args))
                    + (quoted?.tiles ? `, up to ${quoted.tiles} tiles` : quoted?.tiles === null ? ', in tiles the status bar counts' : ''));
                // MPI-1300: the job's one handle, sent the moment it exists. The phone's live card
                // stops it with `/connector/cancel { requestId: toolCallId }`; `agent:result` ends it.
                if (!opts.batch) this._emit('agent:job', { turnId, toolCallId, label: this._inflight.get(toolCallId) });
                // MPI-913: a billed model runs in the cloud and a Pod on RunPod; anything else is
                // a ComfyUI job on this PC's card, which a local agent model must not sit on.
                if (!(opts.batch ? opts.batch.billed : spend !== null) && this._tools.engineIsLocal?.() === true) {
                    this._gpuJobs.add(toolCallId);
                    this._releaseLlm();
                }

                // One settle path, attached two ways. `wait` awaits it so the result is in
                // hand before the tool returns; the default attaches it and returns
                // `started: true`. Never both — a double report would emit `agent:result`
                // twice and push the note twice.
                const settle = async (r) => {
                    const ok = r && r.ok;
                    this._inflight.delete(toolCallId);
                    this._gpuJobs.delete(toolCallId);
                    // A failure still wakes: the user cannot judge a picture that never came.
                    const watched = this._watched.delete(toolCallId);
                    const notes = watched && ok ? this._seenNotes : this._notes;
                    const cancelled = this._askedCancel.delete(toolCallId) && !ok;
                    // CANCELLED you did not ask for: the user pressed Stop (an empty run is NO_OUTPUT).
                    // Reported as a failure, the agent queued it again (MPI-1165).
                    const stopped = !ok && !cancelled && r?.error?.code === 'CANCELLED';
                    if (ok && r.output?.filePath) this._registerResult(r.output.filePath, r.output.modelId, r.output.itemId, r.output.groupId);
                    if (ok && r.output?.groupId) this._groups.add(r.output.groupId);
                    if (ok) this._addSpend('genUsd', r.output?.costUsd);
                    // MPI-941 — a batch item reports to its batch, never to the chat or the notes.
                    if (opts.batch) {
                        opts.batch.settle(opts.label, r, cancelled || stopped, opts.batchSize || 1);
                        return;
                    }
                    if (stopped) {
                        this._trackUnfinished(askedIn, args, null);
                        this._emit('agent:result', { toolCallId, ok: false, error: { code: 'CANCELLED', message: 'Stopped.' } });
                        this._historyEntry('result', { toolCallId, ok: false, error: { code: 'CANCELLED', message: 'Stopped.' } });
                        this._notes.push(`[${STOPPED.message}]`);
                        this._maybeDrained();
                        return;
                    }
                    // Taken back by the user: not a failure, and not something to requeue — so
                    // it leaves the unfinished ledger, and the model is not told it "failed".
                    if (cancelled) {
                        this._trackUnfinished(askedIn, args, null);
                        this._emit('agent:result', { toolCallId, ok: false, error: { code: 'CANCELLED', message: 'Cancelled, as you asked.' } });
                        this._historyEntry('result', { toolCallId, ok: false, error: { code: 'CANCELLED', message: 'Cancelled, as you asked.' } });
                        this._maybeDrained();
                        return;
                    }
                    this._trackUnfinished(askedIn, args, ok ? null : (r?.error?.code || 'FAILED'));
                    this._emit('agent:result', {
                        toolCallId,
                        ok,
                        ...(ok ? { output: r.output } : { error: r.error }),
                    });
                    this._historyEntry('result', { toolCallId, ok, ...(ok ? { output: r.output } : { error: r.error }) });
                    // A refused setting is the one failure the short catalogue can cause, so the
                    // note says where the accepted values are rather than leaving a second guess.
                    const paramMiss = /^(INVALID_|UNKNOWN_PARAM|MEDIA_REQUIRED)/.test(r?.error?.code || '');
                    const fails = !ok && ENGINE_FAIL_CODES.has(r?.error?.code) ? this._engineFail(args) : 0;
                    // A TEXT result (the Transcribe Flow, MPI-1071) makes no card: the note carries
                    // the words themselves, and the subtitles file when there is one.
                    const textOnly = ok && typeof r.output?.text === 'string' && !r.output?.filePath;
                    notes.push(textOnly
                        ? `[Finished, no card. The text: ${r.output.text}${r.output.srtPath ? ` Subtitles file: ${r.output.srtPath}` : ''}]`
                        : ok
                        ? `[Generation finished: card ${r.output?.groupId}, ${r.output?.type} ${r.output?.filePath}${r.output?.pixelDimensions ? `, ${r.output.pixelDimensions.w}x${r.output.pixelDimensions.h}` : ''}]`
                        : `[Generation failed: ${r?.error?.code || 'ERROR'}: ${r?.error?.message || 'no reason given'}${paramMiss ? ` Call describe_model with "${args.flowId || args.modelId}" for the values it accepts.` : fails ? _retryNote(fails) : ''}]`);

                    // Auto-look at image results (brief item 10). A batch item never gets here:
                    // one call over fifty cards must not cost fifty vision calls (MPI-870). Nor
                    // does a tool (no model and no Flow, MPI-904): it changes the size, the frame
                    // or the background, and the user judges that in the gallery (Fabio: no looks).
                    // Nor a job the user typed over (MPI-1226): he already judged it, and on a local
                    // agent the reply waited ~12 s on that look (live 2026-10-21).
                    if (ok && !watched && (args.modelId || args.flowId) && r.output?.type === 'image' && r.output?.filePath) {
                        try {
                            const lr = await this._lookOnce(this._resolveImage(r.output.filePath));
                            if (lr?.ok) {
                                this._historyEntry('tool', {
                                    tool: 'look', args: { image: r.output.filePath }, status: 'done', label: 'Looked at result',
                                    output: lr.output,
                                });
                                // The caption is general, and a redo trusted it: live 2026-09-30 it read a
                                // lizard rising behind a warship's bow as "sits on the bow", and the agent
                                // redid the edit twice; Fabio liked the first best. A question about the
                                // one doubted point is a fresh, focused read (it skips the saved caption).
                                notes.push(`[You looked at it: ${lr.output?.text || ''} This is a general description and can misplace things: if it seems to miss the ask, check that point with look and a question before any redo.]`);
                            }
                        } catch { /* look failure is non-fatal */ }
                    }
                    // LAST, deliberately: the auto-look note above is part of what the wake
                    // turn reports, and a wake that ran before it would speak without it.
                    this._maybeDrained();
                };
                const settleThrow = (err) => {
                    this._inflight.delete(toolCallId);
                    this._gpuJobs.delete(toolCallId);
                    this._askedCancel.delete(toolCallId);
                    this._watched.delete(toolCallId);
                    if (opts.batch) {
                        opts.batch.settle(opts.label, { ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } }, false, opts.batchSize || 1);
                        return;
                    }
                    this._trackUnfinished(askedIn, args, 'RUNTIME_ERROR');
                    this._emit('agent:result', { toolCallId, ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } });
                    this._historyEntry('result', { toolCallId, ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } });
                    this._notes.push(`[Generation failed: RUNTIME_ERROR: ${err.message}${_retryNote(this._engineFail(args))}]`);
                    this._maybeDrained();
                };

                // MPI-817 — WAITING IS THE ONLY WAY TO CHAIN. Fire-and-forget puts the
                // result in `this._notes`, which is read at the START of the next turn, so
                // a request whose second half needs the first half's output ("grow it to
                // 9:16, then animate it") cannot be finished at all: the model has nowhere
                // to wait and ends the turn with the animation undone. Measured live
                // (Fabio, 2026-09-19) — the outpaint landed and the video was never asked
                // for. The await ends with the job: its result, a cancel, or the route's
                // WINDOW_CLOSED when the window that took it goes away. There is no clock.
                //
                // Not the default: an unwaited generate keeps the chat answering while a
                // five-minute video runs, and that is the right shape for the last step of
                // a request. `wait` is for the steps something else depends on.
                if (args.wait) {
                    let r;
                    try {
                        r = await pending;
                    } catch (err) {
                        settleThrow(err);
                        return JSON.stringify({ ok: false, error: { code: 'RUNTIME_ERROR', message: err.message } });
                    }
                    await settle(r);
                    if (!r?.ok) {
                        return JSON.stringify({ ok: false, error: r?.error?.code === 'CANCELLED' ? STOPPED : r?.error || { code: 'RUNTIME_ERROR', message: 'The generation produced no output.' } });
                    }
                    // The filePath is the ref the next call passes as `media[].image` — it
                    // is already registered by `settle`, so the chain needs nothing else.
                    return JSON.stringify({ ok: true, output: r.output,
                        message: `Finished. Use "${r.output?.filePath}" as the image for the next step.${snapNote}${_sentNote(body, this._pinned)}${_priceNote(spend)}` });
                }

                pending.then(settle).catch(settleThrow);

                const lands = _isTool(args) && sourceIsCard ? ` It lands as the ${LANDS_ON_CARD}.` : '';
                return JSON.stringify({ ok: true, started: true, toolCallId, message: `Generation started. The result will appear in the chat when ready.${lands}${snapNote}${_sentNote(body, this._pinned)}${_tilesNote(quoted)}${_priceNote(spend)}` });
            }
            case 'look': {
                const ref = this._resolveImage(args.image);
                if (!ref) {
                    return JSON.stringify({ ok: false, error: { code: 'IMAGE_NOT_FOUND', message: `Image reference not found: ${args.image}. Use an attachment id from this conversation, or the filePath of something you generated.` } });
                }
                // A box is a measurement only the describer returns; see on a text-only model is a plain look.
                if (args.see && this._vision && !args.box) return JSON.stringify(await this._seePicture(ref, args.image, args.crop));
                if (!args.question && !args.crop && !args.box) {
                    const r = await this._lookOnce(ref);
                    // Live on Ling (2026-10-19) the words for two different faces read alike, and it
                    // answered "same woman" without seeing. The fact goes where it is read.
                    return JSON.stringify(this._vision && r?.ok ? { ...r, limits: SEE_LIMITS } : r);
                }
                // A clip's own question ("what happens?") is asked on its contact sheet, not the
                // file itself; crop and box stay stills-only (a sheet's pixels are not the clip's).
                if (args.question && !args.crop && !args.box && CLIP_EXT.test(ref.path)) {
                    return JSON.stringify(await this._describeClip(ref, args.question));
                }
                const lookArgs = { imagePath: ref.path };
                if (args.question) lookArgs.question = args.question;
                if (args.crop) lookArgs.crop = args.crop;
                if (args.box) lookArgs.box = args.box;
                const r = await this._look(lookArgs);
                if (args.box && r?.ok && r.output?.box) {
                    // ponytail: every box param today is a head (Head Swap), so 0.6 of either
                    // side is "the whole person"; a Flow boxing something bigger needs its own bound.
                    const sq = r.output.squareShare;
                    if (sq && Math.max(sq.w, sq.h) > 0.6) {
                        const tries = (this._overBoxed.get(ref.path) || 0) + 1;
                        this._overBoxed.set(ref.path, tries);
                        this._boxed.delete(ref.path);
                        r.hint = tries === 1
                            ? 'This square takes over 0.6 of the image: the describer boxed the whole person, not the head. Do not pass it. Measure once more with a question that says head only, or on a crop around that person.'
                            : 'Still too big. Stop measuring: tell the user this photo could not be measured, say what came back, and ask them to crop it to the head.';
                    } else {
                        this._boxed.add(ref.path);
                    }
                }
                return JSON.stringify(r);
            }
            case 'list_projects': {
                const r = await this._tools.listProjects();
                for (const p of r?.projects || []) this._projects.add(projectKey(p.folderPath));
                return JSON.stringify(r);
            }
            case 'create_project': {
                const r = await this._tools.createProject(args.name);
                if (!r?.ok || !r.project?.folderPath) return JSON.stringify(r);
                this._projects.add(projectKey(r.project.folderPath));

                // Opening it is not the model's to remember. Live (Fabio, 2026-09-19) it created
                // "Cowgirls", never opened it, and the project brief it wrote next went into a
                // DIFFERENT project of the same name from an earlier session — the one the app
                // still had open. A note in the wrong project is invisible and unfindable, and
                // there is no such thing as creating a project you did not want opened.
                const opened = await this._tools.openProject(r.project.folderPath);
                if (!opened?.ok) {
                    return JSON.stringify({ ...r, opened: false, warning: 'The project was created but could not be opened, so nothing can be made in it yet. Call open_project with the folderPath above before generating.' });
                }
                return JSON.stringify({ ...r, opened: true, output: opened.output || { folderPath: r.project.folderPath, name: r.project.name }, note: 'The project has no notes yet: save the goal or background they gave with write_memory now, before you reply.' });
            }
            case 'open_project': {
                if (!this._mayOpen(args.folderPath, currentProject)) {
                    return JSON.stringify({ ok: false, error: { code: 'UNKNOWN_PROJECT', message: 'Open only a folderPath from list_projects or create_project, or one the user typed. Find a project by name with list_projects.' } });
                }
                const r = await this._tools.openProject(args.folderPath);
                return JSON.stringify(r);
            }
            case 'rename_card': {
                if (!this._groups.has(args.groupId)) {
                    return JSON.stringify({ ok: false, error: { code: 'UNKNOWN_CARD', message: 'No such card that you have seen: use a groupId from list_cards or visible_cards, or the card id a finished generation reported.' } });
                }
                return JSON.stringify(await this._tools.renameCard(args.groupId, args.name));
            }
            case 'list_cards': {
                // The project is the one the app has open, never a path the model names.
                if (!currentProject?.folderPath) {
                    return JSON.stringify({ ok: false, error: { code: 'NO_PROJECT', message: 'No project is open, so there are no cards to list.' } });
                }
                const seen = this._seeCards(await this._tools.listCards(currentProject.folderPath, args.groupId, args.limit, args.mark));
                // MPI-1125: the Repeat rule rides on the first card read in full, not on every request.
                if (!args.groupId || this._rulesSent.has('repeat')) return seen;
                const card = JSON.parse(seen);
                if (!card.ok) return seen;
                this._rulesSent.add('repeat');
                return JSON.stringify({ ...card, repeat: REPEAT_RULE });
            }
            case 'send_cards':
                return JSON.stringify(await this._sendCards(args, currentProject));
            case 'visible_cards':
                return this._seeCards(await this._tools.visibleCards(args.limit));
            case 'mark_card':
                return JSON.stringify(await this._tools.markCard(args.groupId, args.mark === 'none' ? false : args.mark));
            case 'gif': {
                // MPI-1125: one tool, five actions. What each takes is app:gifs, read once.
                const spec = GIF_ACTIONS[args.action];
                if (!spec) {
                    return JSON.stringify({ ok: false, error: { code: 'BAD_REQUEST', message: `action is one of: ${Object.keys(GIF_ACTIONS).join(', ')}.` } });
                }
                if (!this._readIds.has('app:gifs')) {
                    this._gateWaiting = 'app:gifs';
                    return JSON.stringify({ ok: false, error: { code: 'KNOWLEDGE_NOT_READ', message: 'Nothing was made: read read_knowledge "app:gifs" first, then send this again with the settings it gives.' } });
                }
                const settings = args.settings && typeof args.settings === 'object' ? args.settings : {};
                const stray = Object.keys(settings).filter((k) => !(k in spec.settings));
                if (stray.length) {
                    return JSON.stringify({ ok: false, error: { code: 'BAD_REQUEST', message: `Nothing was made: ${args.action} takes no ${stray.join(', ')}. Its settings: ${Object.keys(spec.settings).join(', ')}.` } });
                }
                const refs = Object.fromEntries(Object.keys(spec.refs).filter((k) => args[k] !== undefined).map((k) => [k, args[k]]));
                return this._executeTool(`gif:${args.action}`, { ...refs, ...settings }, turnId, currentProject, opts);
            }
            case 'gif:make': {
                const { images, video, ...rest } = args;
                if ((images === undefined) === (video === undefined)) {
                    return JSON.stringify({ ok: false, error: { code: 'BAD_REQUEST', message: 'Send either images (two or more still cards) or video (one video card), not both and not neither.' } });
                }
                return this._gif(this._tools.makeGif, images !== undefined ? { itemIds: images } : { videoItemId: video }, rest, true);
            }
            case 'gif:edit': {
                const { gif, ...rest } = args;
                // The route's "opaque" is a null edgeColour, which a tool schema cannot say.
                if (rest.output?.edgeColour === 'opaque') rest.output = { ...rest.output, edgeColour: null };
                return this._gif(this._tools.editGif, { itemId: gif }, rest, false);
            }
            case 'gif:cutout': {
                const { gif, ...rest } = args;
                return this._gif(this._tools.cutoutGif, { itemId: gif }, rest, false);
            }
            case 'gif:to_video': {
                const { gif, ...rest } = args;
                return this._gif(this._tools.gifToVideo, { itemId: gif }, rest, true);
            }
            case 'gif:sheet': {
                const { images, ...rest } = args;
                if (!Array.isArray(images) || images.length < 2) {
                    return JSON.stringify({ ok: false, error: { code: 'BAD_REQUEST', message: 'images needs two or more still image cards.' } });
                }
                return this._gif(this._tools.makeSheet, { itemIds: images }, rest, true);
            }
            case 'cancel_generation': {
                // Only what THIS conversation started and has not settled. The id is never
                // trusted further than that map: a made-up one reaches nothing.
                const id = args.toolCallId ? String(args.toolCallId) : [...this._inflight.keys()].pop();
                if (!id || !this._inflight.has(id)) {
                    const others = [...this._inflight].map(([k, label]) => `${k} (${label})`).join('; ');
                    return JSON.stringify({ ok: false, error: { code: 'NOT_IN_FLIGHT', message: args.toolCallId
                        ? `Nothing you started is in flight under that toolCallId: it already finished or was already cancelled.${others ? ` Still in flight: ${others}.` : ''}`
                        : 'Nothing you started is still running or queued, so there is nothing to cancel. A generation the user started is theirs to stop, with Stop in the app.' } });
                }
                const label = this._inflight.get(id);
                this._askedCancel.add(id);
                const r = await this._tools.cancelGeneration(id);
                if (!r?.ok) {
                    this._askedCancel.delete(id);
                    return JSON.stringify(r);
                }
                const left = [...this._inflight].filter(([k]) => k !== id).map(([k, l]) => `${k} (${l})`).join('; ');
                return JSON.stringify({ ok: true, cancelled: label, was: r.output?.was,
                    message: `Cancelled: ${label}.${left ? ` Still in flight: ${left}.` : ' Nothing else of yours is in flight.'}` });
            }
            case 'read_memory':
            case 'write_memory': {
                // Global notes need no project: the landing page can save one (MPI-774 Phase 6).
                // `delete` goes on only when asked: a note write keeps its exact old shape.
                const forget = args.delete === true ? { delete: true } : {};
                if (args.scope === 'global') {
                    const r = toolName === 'read_memory'
                        ? await this._tools.readGlobalMemory(args.file)
                        : await this._tools.writeGlobalMemory({ file: args.file, title: args.title, hook: args.hook, text: args.text, ...forget });
                    return JSON.stringify(r);
                }
                // The project is the one the app has open, never a path the model names.
                if (!currentProject?.folderPath) {
                    return JSON.stringify({ ok: false, error: { code: 'NO_PROJECT', message: 'No project is open, so there are no project notes. Call create_project (it opens what it makes) and then call this again. Do not ask the user to open or create one.' } });
                }
                // The unfinished ledger is the CODE's (`_writeUnfinished`): a line goes in
                // when a generation is asked for and comes out when it lands. The model
                // cleared it live while a requeue was still rendering — an app close in
                // that window loses the one clip the note exists to recover. Read-only here.
                if (toolName === 'write_memory' && _isUnfinishedFile(args.file)) {
                    return JSON.stringify({ ok: false, error: { code: 'APP_OWNED_NOTE', message: 'The app keeps this note itself: a generation is listed when it is asked for and removed when it lands. Nothing to write. You can read it.' } });
                }
                const r = toolName === 'read_memory'
                    ? await this._tools.readMemory(currentProject.folderPath, args.file)
                    : await this._tools.writeMemory(currentProject.folderPath, { file: args.file, title: args.title, hook: args.hook, text: args.text, ...forget });
                return JSON.stringify(r);
            }
            case 'routine':
                return this._routine(args, turnId, currentProject);
            default:
                return JSON.stringify({ ok: false, error: { code: 'UNKNOWN_TOOL', message: `Unknown tool: ${toolName}` } });
        }
    }

    // -------------------------------------------------------------------------
    // History helpers
    // -------------------------------------------------------------------------

    _historyEntry(kind, fields) {
        const entry = { id: crypto.randomUUID(), at: new Date().toISOString(), kind, ...fields };
        this._history.push(entry);
        return entry;
    }

    // -------------------------------------------------------------------------
    // Compaction
    // -------------------------------------------------------------------------

    /**
     * The prompt_tokens that trigger a compaction: 20% of a window of 1M or more, half of a
     * smaller one. Every request re-sends the whole history, so the big-window share stays
     * low (MPI-1233; MPI-1125 had a fixed 128k cap).
     */
    _compactAt() {
        return this._contextWindow * (this._contextWindow >= BIG_WINDOW ? COMPACT_SHARE_BIG : COMPACT_SHARE);
    }

    /**
     * The prompt_tokens that offer the long-chat card: half the compaction point on a 1M+
     * window, 75% of it below. MPI-1235: on Ollama's 64k, half was 16k, which the ~8k
     * always-sent floor plus one catalogue read already passes on the first turn.
     */
    _longAt() {
        return this._compactAt() * (this._contextWindow >= BIG_WINDOW ? 0.50 : 0.75);
    }

    _shouldCompact() {
        if (!this._lastUsage || !this._contextWindow) return false;
        return (this._lastUsage.prompt_tokens || 0) >= this._compactAt();
    }

    /** The model's handoff of this conversation: what a compaction or a fresh start keeps. */
    async _handoff(endpoint) {
        const { engine, contextWindow: askFor } = chatEngineFor(endpoint.profileId, endpoint.key, endpoint.baseURL);
        const handoffRes = await engine.chat({
            model: endpoint.model,
            messages: [
                ...this._messages,
                {
                    role: 'user',
                    content: 'Write a compact handoff covering: goal, decisions made, outputs generated (model, settings, results), current model and settings, and any open question. This will restart the session context.',
                },
            ],
            ...(askFor ? { options: { contextWindow: askFor } } : {}),
        });
        this._addSpend('chatUsd', handoffRes.usage?.estimated_cost);
        return handoffRes.text || '';
    }

    /** @param {{model: string, baseURL: string, key: string, profileId: string}} endpoint */
    async _compact(turnId, endpoint) {
        this._emit('agent:compacting', { turnId, on: true });
        try {
            const handoffText = await this._handoff(endpoint);

            // Rebuild messages: system + handoff + the last (up to 4) user turns that fit in half
            // the trigger. Four whole turns could sit above the trigger on their own (live, a
            // list_models answer was ~9.5k tokens against a 32k window's 16.4k before the
            // catalogue went on its diet), so every later turn compacted again.
            // ponytail: no tokenizer; tokens per char come from the last call's usage over
            // these messages' chars (tool schemas add tokens without chars, so it over-counts).
            const chars = this._messages.reduce((s, m) => s + messageChars(m), 0);
            const tokensPerChar = (this._lastUsage?.prompt_tokens || 0) / Math.max(chars, 1);
            const maxChars = tokensPerChar > 0 ? (this._compactAt() / 2) / tokensPerChar : Infinity;
            const newSystem = await this._buildSystemPrompt(this._lastMode || 'auto');
            const recent = this._getLastNUserTurns(this._messages, 4, maxChars);
            this._messages = [
                { role: 'system', content: newSystem },
                { role: 'assistant', content: `[Session compacted — handoff]\n${handoffText}` },
                ...recent,
            ];
            // What the dropped turns carried may be gone: list the notes again, re-read guides.
            this._notesProject = null;
            this._globalListed = false;
            this._readIds.clear();
            this._rulesSent.clear();
            this._boxed.clear();
            this._overBoxed.clear();
            this._historyEntry('handoff', { text: handoffText });
        } catch (err) {
            // Compaction failure is non-fatal — log and continue
        }
        this._emit('agent:compacting', { turnId, on: false });
    }

    _getLastNUserTurns(messages, n, maxChars = Infinity) {
        // Collect message groups. Each group starts at a 'user' message.
        // Scan backwards, collecting up to n user-leading groups, newest first, and stop at
        // the first one that would take the total past maxChars.
        const groups = [];
        let kept = 0;
        let i = messages.length - 1;
        while (i >= 1 && groups.length < n) {
            if (messages[i].role === 'user') {
                // Walk forward from this user msg to find the end of the exchange
                let j = i + 1;
                while (j < messages.length && messages[j].role !== 'user') j++;
                const group = messages.slice(i, j);
                const size = group.reduce((s, m) => s + messageChars(m), 0);
                if (kept + size > maxChars) break;
                kept += size;
                groups.unshift(group);
                i--;
                while (i >= 1 && messages[i].role !== 'user') i--;
            } else {
                i--;
            }
        }
        return groups.flat();
    }

    // -------------------------------------------------------------------------
    // Run a turn (called by POST /agent/message)
    // -------------------------------------------------------------------------

    async runTurn(text, attachments, project, mode, profileId, turnId, { model: pickedModel, carried = false, pinned = null, workspace = null, wake = false, held = false } = {}) {
        // MPI-870: the streak is what the runaway bound counts, and anything the user
        // actually typed clears it. Reset BEFORE the turn runs — a wake that dispatches a
        // generation must see its own predecessor's count, not a cleared one.
        if (wake) this._wakeStreak = (this._wakeStreak || 0) + 1;
        else { this._wakeStreak = 0; this._engineFails.clear(); }
        // MPI-1226: a message typed now means the user is watching whatever is still running.
        // Marked before any wait for the GPU, or a job landing during it would be looked at.
        if (!wake) for (const id of this._inflight.keys()) this._watched.add(id);
        this._working = true;
        this._lastMode = mode;
        this._gateWaiting = null;
        // MPI-1017: `generate` refuses a `count` while the panel is open (its batch is theirs).
        this._pinned = pinned?.modelId ? pinned : null;
        // MPI-891 — only a turn the user TYPED here may take them to where its work renders.
        // A wake was not asked for, and a carry was asked in a view they have since left.
        this._follow = !wake && !carried;
        this._emit('agent:working', { turnId, working: true });
        const turnProject = project;
        const staged = (Array.isArray(attachments) ? attachments : []).filter((a) => a.id && a.filePath);

        try {
            // Resolve the shared connection, then the agent's model on it
            const { profile, key } = await this._resolveEndpoint(profileId);
            if (!profile) {
                this._emit('agent:error', { turnId, code: 'NO_PROFILE', message: 'Connection not found. Pick one in Remote → Language Models.' });
                return;
            }
            // Ollama /v1 is keyless: the same exemption `routes/llm.js` makes.
            if (!key && profileId !== 'ollama') {
                this._emit('agent:error', { turnId, code: 'NO_KEY', message: 'No API key for this connection. Add one in Remote → Language Models.' });
                return;
            }
            const model = this._resolveModel(profileId, pickedModel);
            if (!model) {
                this._emit('agent:error', { turnId, code: 'NO_MODEL', message: 'No agent model picked for this connection. Pick one in Remote → Language Models.' });
                return;
            }
            this._contextWindow = await this._contextWindowFor(profileId, model, profile, key);
            this._vision = await this._visionFor(profileId, model, profile, key);

            // Init session on first turn
            if (this._messages.length === 0) {
                const systemText = await this._buildSystemPrompt(mode);
                this._messages = [{ role: 'system', content: systemText }];
            } else if (this._messages[0]?.role === 'system') {
                // Update mode rules if mode changed
                this._messages[0].content = await this._buildSystemPrompt(mode);
            }

            // Attachments arrive ALREADY staged from POST /agent/message, which needs
            // their ids for its own reply. Staging them twice would give the chat and
            // the model different ids for the same picture.
            const stagedAttachments = [];
            const contentParts = [];
            if (text) contentParts.push({ type: 'text', text });

            // Numbered as the box numbers its chips, so "picture 2" names ONE image: unnumbered, the
            // model took an earlier turn's picture 1 for this message's (MPI-774 Phase 4).
            // The size is what an image-to-video ratio has to match: without it the model framed a
            // portrait start frame at 16:9 and the crop cut the head at the eyes (Phase 4).
            const list = Array.isArray(attachments) ? attachments : [];
            for (const [i, att] of list.entries()) {
                // MPI-948: a dragged SELECTION, one set. Each card registers the way one dragged
                // card does (below), and the model gets ONE line and ONE ref: fifty cards listed
                // one by one cost ~60 tokens each and came back as fifty refs in `cards`. The
                // instruction rides in this line because the tool-schema budget is full.
                if (Array.isArray(att.set)) {
                    for (const c of att.set) {
                        this._images.set(c.id, { path: c.filePath, kind: 'result', modelId: null, itemId: c.itemId || null, groupId: c.groupId || null, reference: true });
                        if (c.groupId) this._groups.add(c.groupId);
                    }
                    this._sets.set(att.id, att.set.map((c) => c.id));
                    stagedAttachments.push({ id: att.id, name: att.name, count: att.set.length });
                    contentParts.push({ type: 'text', text: `[Attached set ${i + 1}: ${att.set.length} gallery cards (ref: set:${att.id}). Pass ["set:${att.id}"] as cards to run one op over all of them. An edit of each lands as that card's next version, never a new card.]` });
                    continue;
                }
                // A video was handed over BY REFERENCE (`routes/agent.js`): a file the open
                // project holds, so it registers like a card `list_cards` returned, under the
                // same ref, and NOT as an attachment — `generate` places an attachment as a
                // picture, and a reset deletes one. No thumb in the chat: nothing was staged.
                if (att.reference && att.filePath) {
                    this._images.set(att.id, { path: att.filePath, kind: 'result', modelId: null, itemId: att.itemId || null, groupId: att.groupId || null, reference: true });
                    // MPI-886: a dragged gallery CARD. Registered as the card's own file, so a
                    // `look` reads its sidecar, `generate` sends it by path and the edit lands as
                    // that card's next version (agentDispatch.workspaceGenerationOpts), and the
                    // card joins what rename_card / mark_card may name.
                    if (att.mediaType === 'image') {
                        if (att.groupId) this._groups.add(att.groupId);
                        // `url`: the chat redraws the bubble from the card's own file, because the
                        // attachment route serves staged copies only, never a project file.
                        stagedAttachments.push({ id: att.id, name: att.name, url: _projectFileUrl(att.filePath) });
                        const size = await _imageSize(att.filePath);
                        contentParts.push({ type: 'text', text: `[Attached image ${i + 1}: ${att.name} (ref: ${att.id}${size ? `, ${size}` : ''}). A gallery card of this project${att.groupId ? ` (groupId ${att.groupId})` : ''}, the version it shows: list_cards with that groupId reads the prompt that made it, and an edit of it lands as that card's next version.]` });
                        continue;
                    }
                    // MPI-867: a dragged video CARD, same as the image card above: the card joins
                    // what rename_card / mark_card may name, and the bubble shows its poster.
                    if (att.groupId) this._groups.add(att.groupId);
                    const poster = _posterUrl(att.filePath, att.itemId);
                    if (poster) stagedAttachments.push({ id: att.id, name: att.name, url: poster });
                    const card = att.groupId ? `A gallery card of this project (groupId ${att.groupId}): list_cards with that groupId reads the prompt that made it.` : 'A clip in this project.';
                    contentParts.push({ type: 'text', text: `[Attached video ${i + 1}: ${att.name} (ref: ${att.id}). ${card} look reads it as sampled frames; pass the ref to generate as media, or to gif.${att.itemId ? '' : ' It is not a gallery card yet, so gif cannot take it until list_cards returns it.'}]` });
                    continue;
                }
                if (att.id && att.filePath) {
                    this._images.set(att.id, { path: att.filePath, kind: 'attachment', name: att.name });
                    stagedAttachments.push({ id: att.id, name: att.name });
                    const size = await _imageSize(att.filePath);
                    contentParts.push({ type: 'text', text: `[Attached image ${i + 1}: ${att.name} (id: ${att.id}${size ? `, ${size}` : ''})]` });
                } else {
                    contentParts.push({ type: 'text', text: `[Attached image ${i + 1}, ${att.name}, could not be staged: ${att.error || 'unknown error'}]` });
                }
            }

            // The model cannot see the app, so every turn opens with what it can reach.
            // Without it the model guessed folder paths, claimed no project was open while
            // one was, and passed look the literal "result filePath" (agent-test, 2026-09-16).
            // Then the project's notes (once per project) and what finished since last turn.
            // A carried request (D5) was asked in another conversation, which already opened this
            // project for it: unsaid, "open X" ran twice and the reply quoted the "From" prefix back.
            // MPI-913: a local Ollama model would load beside a render of this conversation's
            // own still on the card. Wait for it here, before the opening reads the notes, so
            // this turn opens on what landed. A reset ends the wait and the message with it.
            const onGpu = onLocalGpu(profileId, model);
            if (onGpu && this._gpuJobs.size && !(await this._waitForGpu(turnId))) return;

            const handover = carried
                ? '[Handed over: the user asked this in another conversation, which already opened this project for it. Do only what is left of the request; if opening this project was all of it, say it is open and ask what to make.]'
                : '';
            // MPI-870. A wake turn has no user message at all — only the notes below it — so
            // without this line the model reads an empty turn and answers as if interrupted.
            // It is not a limit (those live in tool descriptions and tool results): it is the
            // only thing that says what KIND of turn this is.
            const woke = wake
                ? '[Nothing was typed: your generations have finished and this turn exists to report them. Say what landed, briefly, the way you would to someone who walked back to the screen. Do not start new work unless they already asked for it.]'
                : '';
            // MPI-1032: a message queued behind this conversation's own turn arrives AFTER that
            // turn's reply, and unsaid, the model reads it as a reaction to the reply.
            const heldLine = held
                ? '[Typed while you were still working on the previous turn: it was written before your last reply and is not a reaction to it. If what you already started covers it, let that run and say so; stop or redo work only for what it actually changes.]'
                : '';
            // MPI-941 Phase 9: a real turn only — a wake starts with `_inflight` empty by
            // construction, so this is zero bytes there and on every quiet turn.
            const running = wake ? '' : this._inflightLine();
            // MPI-890: register the open card's active entry BEFORE the App state line is
            // built, so the line lists it among the refs it is the allowlist for.
            this._registerWorkspaceEntry(workspace);
            this._masked = !!(workspace?.activeEntry?.filePath && (workspace.masked || workspace.lastMask));
            const entrySize = workspace?.activeEntry?.filePath ? await _imageSize(workspace.activeEntry.filePath) : '';
            const entriesLine = await this._entriesLine(project, workspace);
            // MPI-1226 (Fabio, live 2026-10-21): the result was on his screen before he typed
            // "Nice one, now add a dog", and the turn still spent three looks and a paragraph
            // confirming it landed. Typed after it landed, the message is his verdict. After the
            // notes, so it is read after the auto-look's "check that point" advice it overrides.
            const notes = wake ? this._notes.splice(0) : [...this._seenNotes.splice(0), ...this._notes.splice(0)];
            const seenLine = !wake && !held && notes.some((n) => /^\[(Generation|Batch|Routine) finished/.test(n))
                ? '[The user saw these results in the gallery before typing this message: their message is their verdict on them. Do not look at a result or report on it unless they ask about it; go straight to what they asked.]'
                : '';
            const opening = [this._appStateLine(project, workspace, entrySize), entriesLine, this._pinnedSettingsLine(pinned), handover, woke, heldLine, running, await this._globalNotesLine(), await this._projectNotesLine(project), ...notes, seenLine];
            contentParts.unshift(...opening.filter(Boolean).map((t) => ({ type: 'text', text: t })));

            // Add user message to LLM context (plain text for OpenAI compat)
            const userContent = contentParts.map((p) => p.text).join('\n');
            // MPI-1208: a picture lives one turn. Carried on, every later request would re-send it.
            this._sight.length = 0; // a round that threw never sent its pictures
            for (const { msg, labels } of this._seen.splice(0)) msg.content = `[The picture of ${labels} was shown here in an earlier turn. To see it again, call look with see: true.]`;
            this._messages.push({ role: 'user', content: userContent });

            // Add to UI history. The sender's chat drew its own bubble; a carried request has no
            // sender in this conversation, so it is announced. A WAKE has no sender at all, so it
            // gets no bubble — an empty user entry would draw a blank message the user never sent
            // (MPI-870).
            const userEntry = wake ? null : this._historyEntry('user', { text, attachments: stagedAttachments });
            if (carried) this._emit('agent:user', { turnId, id: userEntry.id, text, attachments: stagedAttachments });

            // Build engine. Ollama is not an OpenAI-compatible host for this job — see
            // chatEngineFor. `contextWindow` is null on every other preset, so the option
            // is absent there and nothing changes.
            const { engine, contextWindow: askFor } = chatEngineFor(profileId, key, profile.baseURL);
            this._llm = onGpu ? engine : null;
            // MPI-891: the recommended entry's reasoning effort, so the model thinks in the
            // channel we never show instead of in its reply. Absent for every other model.
            const reasoningEffort = (RECOMMENDED_REMOTE_MODELS[profileId] || []).find((r) => r.id === model)?.reasoningEffort;
            const chatOptions = (askFor || reasoningEffort)
                ? { ...(askFor && { contextWindow: askFor }), ...(reasoningEffort && { reasoningEffort }) }
                : undefined;

            // Agentic loop
            let steps = 0;
            let carriedTo = null; // the project this request was handed to (D5)
            let noted = false;    // a write_memory ran this turn
            let nudged = false;   // the memory reminder already rode on a generate result
            let yielded = false;  // ended early for a render on this card (MPI-913)
            let lastRefused = null; // { key, result } of the call just refused (MPI-941 Phase 13)
            let spokeThisTurn = false; // a start line reached the chat (MPI-1280)
            this._reviewEnd = null; // a GPU yield may have ended the last turn before it was read
            for (;;) {
                // Out of rounds: this call carries NO tools, so the model can only answer in
                // words. Refusing the round instead ended the turn on a bare error one second
                // after a generate was dispatched, which read as "nothing happened".
                const outOfRounds = steps >= MAX_STEPS;
                const llmRes = await engine.chat(outOfRounds
                    ? { model, messages: [...this._messages, { role: 'system', content: OUT_OF_ROUNDS }], options: chatOptions }
                    : { model, messages: this._messages, tools: this._vision ? VISION_TOOL_DEFS : TOOL_DEFS, options: chatOptions });
                this._lastUsage = llmRes.usage;
                this._llmReleased = false; // answering loaded it again
                this._addSpend('chatUsd', llmRes.usage?.estimated_cost);

                const toolCalls = outOfRounds ? null : llmRes.toolCalls;

                if (outOfRounds && !llmRes.text) {
                    this._emit('agent:error', { turnId, code: 'STEP_LIMIT', message: 'I ran out of steps for this turn. Anything I started is still running. Reply to carry on.' });
                    break;
                }

                if (!toolCalls || toolCalls.length === 0) {
                    // Final text response. A no in words, with no tool failing, carries the
                    // Declining rule's marker: hidden from the user, flagged for the panel's
                    // Cosmo (MPI-908). The model keeps its own marker in context.
                    const raw = llmRes.text || '';
                    const stripped = raw.replace(/\[declined\]\s*/gi, '');
                    const declined = stripped !== raw;
                    // The Options rule's marker goes the same way, and comes back as buttons (MPI-941 Phase 7).
                    const { text: msgText, options } = _takeOptions(declined ? stripped.trim() : raw);
                    this._messages.push({ role: 'assistant', content: raw });
                    // Nothing more to say after a start line already shown (MPI-1280): no empty bubble.
                    if (msgText || options || !spokeThisTurn) {
                        const entry = this._historyEntry('agent', { text: msgText, ...(options && { options }) });
                        this._emit('agent:message', { turnId, id: entry.id, text: msgText, ...(options && { options }), ...(declined && { declined: true }) });
                    }
                    break;
                }

                // Add assistant message (with tool_calls) to context
                this._messages.push({ role: 'assistant', content: llmRes.text || '', tool_calls: toolCalls });
                // MPI-1280: words riding with the calls are the line saying what starts. They wait
                // for a call to get past its refusal race (`_sayStarted`), and a round whose calls
                // were all refused never shows them: the next round says what went wrong.
                this._startLine = llmRes.text?.trim() ? { turnId, text: llmRes.text.trim() } : null;
                let started = true; // every call of this round started a job (or noted one)

                // Execute each tool call. Once the request is handed to another project's
                // conversation (D5) the rest of the batch does not run, but a provider still
                // wants a result for every call.
                for (const tc of toolCalls) {
                    if (carriedTo) {
                        this._messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ ok: false, error: { code: 'HANDED_OVER', message: "Not run: this request continues in the project's own conversation." } }) });
                        continue;
                    }
                    const toolName = tc.function?.name || '';
                    let args = {};
                    try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* use {} */ }

                    const toolEntryId = crypto.randomUUID();
                    const label = toolName === 'look' && args.see && this._vision && !args.box ? LOOK_SEE_LABEL : _toolLabel(toolName, args);
                    // `redo` is the agent saying it is retrying: the panel's Cosmo reacts (MPI-908).
                    // Never forwarded to the app - `generate` builds its request field by field.
                    // `noPrompt`: a tool (MPI-904) writes no prompt, so the panel sends no prompt writer.
                    this._emit('agent:tool', { turnId, id: toolEntryId, tool: toolName, status: 'started', label,
                        ...(args.redo === true && { redo: true }),
                        ...(toolName === 'generate' && _isTool(args) && { noPrompt: true }) });
                    this._historyEntry('tool', { id: toolEntryId, tool: toolName, args, status: 'started', label });

                    let resultText;
                    let toolStatus = 'done';
                    this._lookWasCached = false;
                    // MPI-941 Phase 13: gemma4:12b resent one refused write_memory 15 times in a turn.
                    // A refused call sent again unchanged, with nothing run in between, cannot answer
                    // differently, so it gets the earlier answer back. A call in between may have
                    // changed it (NO_PROJECT -> create_project -> the same generate), so that reruns.
                    // ponytail: args compared as sent (key order counts); a reordered resend still runs once more.
                    const callKey = `${toolName}:${JSON.stringify(args)}`;
                    try {
                        resultText = callKey === lastRefused?.key
                            ? JSON.stringify({ ok: false, error: { code: 'REPEATED_CALL', message: 'Not run: this exact call was just refused. Change the arguments, or stop and tell the user.' }, earlier: lastRefused.result })
                            : wake && WAKE_REFUSED.has(toolName)
                                ? JSON.stringify({ ok: false, error: { code: 'WAKE_NO_MOVE', message: 'Not run: nothing was typed, so you never move the user to another project. Report what landed; offer it if it matters.' } })
                                : await this._executeTool(toolName, args, turnId, project);
                        // The app now has this project open, so a generate later in the same
                        // turn lands there instead of answering NO_PROJECT. `create_project`
                        // opens what it made, so it arrives here too — including the handover
                        // to that project's own conversation.
                        if (toolName === 'open_project' || toolName === 'create_project') {
                            const opened = JSON.parse(resultText);
                            if (opened?.ok && opened.output?.folderPath) {
                                project = { folderPath: opened.output.folderPath, name: opened.output.name };
                                const handover = this._onProjectOpened
                                    ? await this._onProjectOpened(this, project, { text, attachments: staged, mode, profileId, model: pickedModel, fromName: turnProject?.name })
                                    : null;
                                if (handover === 'carry') {
                                    carriedTo = project;
                                    // The files go with the request: a reset here must not delete them.
                                    for (const a of staged) this._images.delete(a.id);
                                    resultText = JSON.stringify({ ...opened, note: 'This project has its own conversation, and the request continues there.' });
                                } else {
                                    const notes = await this._projectNotesLine(project);
                                    if (notes) resultText = JSON.stringify({ ...opened, notes });
                                }
                            }
                        }
                    } catch (err) {
                        resultText = JSON.stringify({ ok: false, error: { code: 'TOOL_ERROR', message: err.message } });
                        toolStatus = 'failed';
                    }

                    // The Memory rule alone lost the note in 3 of 8 runs: the model makes the
                    // picture and promises to "keep track" later. Once per turn, the first
                    // generate that lands asks, where the model reads it before replying.
                    if (toolName === 'write_memory') noted ||= JSON.parse(resultText)?.ok === true;
                    else if (toolName === 'generate' && !noted && !nudged && toolStatus === 'done') {
                        const r = JSON.parse(resultText);
                        if (r?.ok) {
                            nudged = true;
                            resultText = JSON.stringify({ ...r, remember: MEMORY_NUDGE });
                        }
                    }

                    // Whether a look cost a vision call is only known once it has run, and the
                    // started frame has already said "Looking at image". The chat reuses the
                    // line by id and replaces its text, so correcting it here is the whole fix
                    // (MPI-870) — history carries the corrected label too, or a remount would
                    // redraw the claim the run disproved.
                    // A tool that ran but said no (NO_PROJECT, a refused param) is still `done`; the
                    // panel's Cosmo flags it (MPI-908), so it is told apart here.
                    let refused = false;
                    let opened = null;
                    let replied = false; // a review card answered in words: nothing started (MPI-1005)
                    let ranOn = false;   // a job started and still running, or a note written (MPI-1280)
                    try {
                        const parsed = JSON.parse(resultText);
                        refused = toolStatus === 'done' && parsed?.ok === false;
                        opened = toolName === 'generate' && parsed?.ok && typeof parsed.opened === 'string' ? parsed.opened : null;
                        replied = toolName === 'generate' && parsed?.replied === true;
                        ranOn = toolStatus === 'done' && parsed?.ok === true && (!!parsed.started || toolName === 'write_memory');
                    } catch { /* not JSON */ }
                    started &&= ranOn;
                    if (refused) _logRefused(toolName, args, resultText);
                    if (!refused) lastRefused = null;
                    else if (callKey !== lastRefused?.key) lastRefused = { key: callKey, result: JSON.parse(resultText) };
                    // A click the app then refused (a field missing) is the model's to fix (MPI-1005).
                    if (refused || toolStatus !== 'done') this._reviewEnd = null;
                    // Same correction for a refused generate: "Starting generation" over a refusal
                    // made a refused round and its retry read as two runs (MPI-817). An OPENED Flow
                    // ran nothing, so it says so: Fabio read "Starting generation" over a Song's
                    // Review lyrics and asked whether it had run (MPI-1002).
                    const doneLabel = toolName === 'look' && this._lookWasCached ? LOOK_CACHED_LABEL
                        : toolName === 'generate' && (refused || replied) ? GENERATE_REFUSED_LABEL
                        : opened ? `Opened ${opened}`
                        : label;

                    // Update history entry status
                    const histEntry = this._history.find((e) => e.id === toolEntryId);
                    if (histEntry) { histEntry.status = toolStatus; histEntry.output = resultText; histEntry.label = doneLabel; }
                    this._emit('agent:tool', { turnId, id: toolEntryId, tool: toolName, status: toolStatus, label: doneLabel, ...(refused && { refused: true }) });

                    // Append tool result to LLM context
                    this._messages.push({ role: 'tool', tool_call_id: tc.id, content: resultText });
                }
                const spoke = !!this._startLine?.shown;
                spokeThisTurn ||= spoke;
                this._startLine = null;

                // MPI-1208: the pictures `see` showed, once every tool result is in (nothing may
                // sit between a tool call and its results). A user message, the one place every
                // OpenAI-compatible host and Ollama's native shape take an image.
                if (this._sight.length) {
                    const shown = this._sight.splice(0);
                    const msg = { role: 'user', content: shown.flatMap((s) => [{ type: 'text', text: `[The picture you asked to see: ${s.label}]` }, { type: 'image_url', image_url: { url: s.url } }]) };
                    this._messages.push(msg);
                    this._seen.push({ msg, labels: shown.map((s) => s.label).join(', ') });
                }

                if (carriedTo) {
                    const msg = `Opened ${carriedTo.name || 'the project'}. I'll carry on in its own chat.`;
                    this._messages.push({ role: 'assistant', content: msg });
                    const entry = this._historyEntry('agent', { text: msg });
                    this._emit('agent:message', { turnId, id: entry.id, text: msg });
                    break;
                }

                // MPI-913: a render of this turn's is on the card the model runs on. Another
                // round would load the model beside it, so the turn ends under the waiting line
                // and the wake reports what landed. A waited step has settled by now.
                if (this._llm && this._gpuJobs.size) {
                    this._messages.push({ role: 'assistant', content: GPU_YIELD });
                    this._gpuWaitLine(turnId, true);
                    yielded = true;
                    break;
                }

                // MPI-1280: the user has heard what started and every call of the round is running.
                // Another round would only narrate it again, ~35 s later on a long chat. The memory
                // reminder the generate carried is read next turn (a wake, or the user's message).
                if (spoke && started) {
                    if (nudged && !noted) this._notes.push(MEMORY_LATER);
                    break;
                }

                // MPI-1005: a review card answered. The click did the job, and a typed reply is
                // the next turn; another round would only narrate it. The card shows the choice.
                if (this._reviewEnd) {
                    this._messages.push({ role: 'assistant', content: this._reviewEnd });
                    break;
                }

                steps++;
            }

            // Compaction check. Not after a yield: compacting is a chat call too.
            this._lastChat = { profileId, model };
            if (!yielded && this._shouldCompact()) {
                await this._compact(turnId, { model, baseURL: profile.baseURL, key, profileId });
            } else if (!this._longOffered && (this._lastUsage?.prompt_tokens || 0) >= this._longAt()) {
                // MPI-1125 (Fabio): past the long-chat point the user picks, once per chat:
                // start fresh, compact now, or keep going. The app's card, never a model turn.
                // `local`: a local model costs nothing, so the card does not say it does (MPI-1235).
                this._longOffered = true;
                this._emit('agent:long', { turnId, local: profileId === 'ollama' });
            }
        } catch (err) {
            // MPI-1277: a host too slow or too busy to answer (a timeout, 429, 5xx) is the
            // model's host, not the user's setup: name a tested model to switch to. Never for
            // a key, a balance or a bad request, which another model would hit the same way.
            const stalled = err.code === 'TIMEOUT' || err.status === 429 || err.status >= 500;
            const fallback = stalled ? agentFallbackModel(profileId, this._resolveModel(profileId, pickedModel)) : '';
            this._emit('agent:error', { turnId, code: 'ENDPOINT_ERROR', message: err.message, ...(fallback && { fallback }) });
        } finally {
            this._working = false;
            this._emit('agent:working', { turnId, working: false });
        }
    }

    /**
     * MPI-1125 — the long-chat card's two actions (POST /agent/shorten). `compact` is the
     * automatic compaction, now. `fresh` keeps the handoff as a note (the project's, or a
     * global one on the landing chat) and clears the conversation, so nothing important is lost.
     */
    async shorten(choice, folderPath) {
        if (this._working) return { ok: false, error: { code: 'BUSY', message: 'Still working on a turn.' } };
        if (!this._lastChat || !this._messages.length) return { ok: false, error: { code: 'NO_CHAT', message: 'Nothing to shorten yet.' } };
        const { profileId, model } = this._lastChat;
        const { profile, key } = await this._resolveEndpoint(profileId);
        if (!profile) return { ok: false, error: { code: 'NO_PROFILE', message: 'Connection not found. Pick one in Remote → Language Models.' } };
        const endpoint = { model, baseURL: profile.baseURL, key, profileId };
        const turnId = crypto.randomUUID();
        this._working = true;
        this._emit('agent:working', { turnId, working: true });
        try {
            if (choice === 'compact') {
                await this._compact(turnId, endpoint);
                return { ok: true };
            }
            this._emit('agent:compacting', { turnId, on: true });
            const text = await this._handoff(endpoint);
            const note = { file: 'last-chat.md', title: 'Where the last chat left off', hook: 'Read when the user picks up earlier work.', text };
            const saved = folderPath ? await this._tools.writeMemory(folderPath, note) : await this._tools.writeGlobalMemory(note);
            this._emit('agent:compacting', { turnId, on: false });
            if (!saved?.ok) return { ok: false, error: { code: 'NOT_SAVED', message: 'The notes could not be saved, so the chat was kept.' } };
            await this.reset();
            return { ok: true };
        } catch (err) {
            return { ok: false, error: { code: 'ENDPOINT_ERROR', message: err.message } };
        } finally {
            this._working = false;
            this._emit('agent:working', { turnId, working: false });
        }
    }

    // -------------------------------------------------------------------------
    // Confirm (POST /agent/confirm)
    // -------------------------------------------------------------------------

    async confirm(confirmId, yes) {
        const pc = this._pendingConfirm;
        if (!pc || pc.confirmId !== confirmId) return { ok: false, error: { code: 'UNKNOWN_CONFIRM', message: 'Unknown or already-answered confirmId.' } };

        // A batch card answers a boolean and nothing runs here: `_fanOut` is still inside the
        // turn, holding this promise, and it dispatches (MPI-870). A spend card is the same
        // shape — the generate is suspended mid-call, waiting on this (MPI-876). Anything
        // else is an install, including a card left pending across an upgrade, which is
        // what the missing `kind` on an older one means.
        // A choice card (`CHOICE_CARDS`) takes a CHOICE in `yes`, and a boolean is never one; every
        // other card a boolean, and a choice is never one: 'run' is truthy, so it would install.
        const choices = CHOICE_CARDS[pc.kind];
        if (choices) {
            if (![...choices, 'replied'].includes(yes)) {
                return { ok: false, error: { code: 'BAD_CHOICE', message: `A ${pc.kind} card answers ${choices.join(', ')} or replied.` } };
            }
            pc.resolve(yes);
            return { ok: true };
        }
        if (typeof yes !== 'boolean') {
            return { ok: false, error: { code: 'BAD_CHOICE', message: 'This card answers yes or no.' } };
        }
        if (pc.kind === 'batch' || pc.kind === 'spend') {
            pc.resolve(yes === true);
            return { ok: true };
        }

        if (!yes) {
            // MPI-916: says what follows, as SPEND_DECLINED does. Told only "declined",
            // gpt-oss-120b went on to generate with the model it had just been refused.
            pc.resolve(JSON.stringify({ declined: true, message: 'User declined the installation. The model is NOT installed, so nothing that needs it can run: say so and ask what they would like instead, ending on [options: A | B].' }));
            return { ok: true };
        }

        // Run the install
        try {
            const r = pc.flowId ? await this._tools.installFlow(pc.flowId, true) : await this._tools.installModel(pc.modelId);
            if (!r?.ok) {
                pc.resolve(JSON.stringify(cosmoNoEngine(r || { ok: false, error: { code: 'INSTALL_FAILED', message: 'Installation failed.' } })));
                return { ok: true };
            }
            // A Flow's download runs in the app's downloads, behind any licence screen it raises
            // (MPI-1127); there is nothing to re-read yet.
            if (pc.flowId) {
                pc.resolve(JSON.stringify({
                    ok: true,
                    installed: false,
                    message: `The user pressed Yes. ${pc.modelName} is downloading now (it shows in the app's downloads) and is not installed until that finishes.`
                        + (pc.licence ? ' A licence screen opens in the app first: the download starts only once they accept it there.' : '')
                        + ' Tell them so.',
                }));
                return { ok: true };
            }
            // Verify with a real re-read. The model is ALWAYS in the list: what counts is its
            // `installed` flag (reading the entry alone told the model "installed successfully"
            // 30 s into a 6 GB download, MPI-774 Phase 4).
            const models = await this._tools.listModels();
            const installed = models?.models?.find((m) => m.id === pc.modelId)?.installed === true;
            // Said as a fact about the card: told only "Download started", the model answered as
            // if the card were still waiting ("it will begin once you click Yes").
            pc.resolve(JSON.stringify({
                ok: true,
                installed,
                message: installed
                    ? `The user pressed Yes and ${pc.modelName} is now installed.`
                    : `The user pressed Yes. ${pc.modelName} is downloading now (it shows in the app's downloads) and is not installed until that finishes. Tell them it is downloading.`,
            }));
        } catch (err) {
            pc.resolve(JSON.stringify({ ok: false, error: { code: 'INSTALL_ERROR', message: err.message } }));
        }
        return { ok: true };
    }

    // -------------------------------------------------------------------------
    // Probe (POST /agent/probe)
    // -------------------------------------------------------------------------

    /** Can the agent's model call a tool on this connection? (`POST /llm/connection/probe`
     *  is the job-agnostic reachability check; this one is the agent's own.) */
    async probe(profileId, pickedModel) {
        const { profile, key } = await this._resolveEndpoint(profileId);
        if (!profile) return { ok: false, error: { code: 'NO_PROFILE', message: 'Connection not found.' } };
        if (!key && profileId !== 'ollama') return { ok: false, error: { code: 'NO_KEY', message: 'No API key for this connection.' } };
        const model = this._resolveModel(profileId, pickedModel);
        if (!model) return { ok: false, error: { code: 'NO_MODEL', message: 'No agent model picked for this connection.' } };

        const start = Date.now();
        try {
            const { engine } = chatEngineFor(profileId, key, profile.baseURL);
            const probeTools = [{
                type: 'function',
                function: {
                    name: 'list_models',
                    description: 'List models.',
                    parameters: { type: 'object', properties: {} },
                },
            }];
            const res = await engine.chat({
                model,
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: 'List models.' },
                ],
                tools: probeTools,
            });
            const latencyMs = Date.now() - start;
            const hasToolCall = Array.isArray(res.toolCalls) && res.toolCalls.length > 0;
            return {
                ok: true,
                tools: hasToolCall,
                model,
                latencyMs,
                // MPI-905: the window the agent compacts against; Settings warns under 64K.
                contextWindow: await this._contextWindowFor(profileId, model, profile, key),
                message: hasToolCall
                    ? `Connected. Model called a tool in ${latencyMs} ms.`
                    : `Connected, but this model did not call a tool. Tool use may not be supported.`,
            };
        } catch (err) {
            const status = err.message?.match(/(\d{3})/)?.[1] ? parseInt(err.message.match(/(\d{3})/)[1]) : undefined;
            return { ok: false, error: { code: 'ENDPOINT_ERROR', message: err.message, ...(status && { status }) } };
        }
    }
}

// ---------------------------------------------------------------------------
// Tool label helper — plain copy shown in the UI, never the prompt
// ---------------------------------------------------------------------------

/** A chat message's size in chars: its content plus any tool calls it carries. */
function messageChars(m) {
    // A picture counts ~2,000 chars (~500 tokens), never its base64 length (MPI-1208).
    const content = typeof m.content === 'string' ? m.content.length
        : Array.isArray(m.content) ? m.content.reduce((s, p) => s + (p.type === 'image_url' ? 2000 : (p.text || '').length), 0)
        : JSON.stringify(m.content ?? '').length;
    return content + (m.tool_calls ? JSON.stringify(m.tool_calls).length : 0);
}

/** `/project-file?path=<abs>` for a path the engine (or a Pod) reads by reference. */
function _projectFileUrl(absPath) {
    return `/project-file?path=${encodeURIComponent(absPath)}`;
}

/**
 * What a model-op generate actually SENT, for the tool result (MPI-867). Live 2026-09-26: the
 * agent told Fabio it raised denoise to 0.65, then 0.85, and the log says `denoise=0.3
 * (defaulted)` for all five runs: the number was in its reply and never in the call. The result
 * only said "started", so nothing it read could contradict the claim.
 */
const _SENT_KEYS = ['ratio', 'qualityTier', 'turbo', 'duration', 'denoise', 'styleSelect', 'stylization', 'seed', 'category', 'language', 'tiles', 'tileSize', 'upscaleFactor', 'transparent', 'fastMotion', 'boxes'];

/**
 * A generate call's own fields in the connector's words: `prompt` goes as `positive`, and a
 * tool's settings go in `fields`. Shared by `generate` and a routine's saved steps (MPI-970),
 * which are generate args the app runs later, so a step cannot mean something a generate
 * does not. No media, no card name: each caller adds its own.
 */
function _generateFields(args) {
    const body = {};
    if (args.flowId) {
        body.flowId = String(args.flowId);
        if (args.fields) body.fields = args.fields;
        if (args.params) body.params = args.params;
        return body;
    }
    if (args.modelId) body.modelId = String(args.modelId);
    if (args.operation) body.operation = String(args.operation);
    const named = { ...args };
    // MPI-904: a tool (no model) takes its settings in `fields`, as a Flow does.
    // MPI-941 Phase 9: crop's own `ratio` shares its name with a model's `ratio`, and the
    // model reached for the name it already knew — "Generation not started" twice before it
    // read crop's own fields. A top-level name that is one of THIS tool's own fields is moved
    // into `fields` and cleared HERE, so the named-param line below never sees it: the route
    // refuses a named param on a tool outright, never drops one.
    const toolFields = _isTool(args) ? agentToolOp(String(args.operation || ''))?.fields : null;
    if (toolFields) {
        const fields = { ...(args.fields || {}) };
        for (const key of Object.keys(toolFields)) {
            if (named[key] === undefined) continue;
            fields[key] = named[key];
            delete named[key];
        }
        if (Object.keys(fields).length) body.fields = fields;
    } else if (!args.modelId && args.fields) {
        body.fields = args.fields;
    }
    if (named.prompt) body.positive = String(named.prompt);
    if (named.negative) body.negative = String(named.negative);
    for (const k of _SENT_KEYS) if (named[k] !== undefined) body[k] = named[k];
    return body;
}

function _sentNote(body, pinned = null) {
    // A tool names the value of EVERY setting it runs with, defaults included: told nothing,
    // the agent called a default x2 upscale the x1.5 the user asked for (Fabio, MPI-970).
    const tool = body.modelId || body.flowId ? null : agentToolOp(String(body.operation || ''));
    if (tool) {
        const sent = body.fields || {};
        const run = Object.entries(tool.fields).map(([k, f]) => (sent[k] !== undefined ? `${k} ${sent[k]}` : `${k} ${f.default} (default)`));
        return ` It runs with: ${run.join(', ')}. Tell the user only these; to change one, send it in fields.`;
    }
    if (!body.modelId) return '';
    // MPI-1017: the open panel drops what the agent sent (`resolveSettingsOwner`), so echoing
    // it here told Cosmo to announce a 4:3 the panel ran at 1:1 (Fabio, 2026-10-04).
    if (pinned) {
        const at = [pinned.duration && `${pinned.duration} s`, pinned.ratio].filter(Boolean).join(', ');
        return ` The settings panel is open, so it runs at the panel's settings${at ? ` (${at})` : ''} and any you sent were dropped. Name no other duration, quality or ratio to the user.`;
    }
    const sent = _SENT_KEYS.filter((k) => body[k] !== undefined).map((k) => `${k} ${typeof body[k] === 'object' ? JSON.stringify(body[k]) : body[k]}`);
    return ` Settings you sent: ${sent.length ? sent.join(', ') : 'none'}. Every other setting runs at its default. Tell the user only settings listed here; to change one, send it.`;
}

/**
 * A Use Tiles run's tile count, from the quote: the status bar's own number (MPI-1237).
 * Told nothing, Cosmo guessed ~25 while the bar counted 40 (Fabio, 2026-10-21). Told the count
 * only for "asked how many", it said "many tiles" and sent him to the chat's 0-of-1 line
 * (Fabio, 2026-10-22, MPI-1232): the start message itself must name the count and the bar.
 */
function _tilesNote(quoted) {
    if (quoted?.tiles === undefined) return '';
    const where = ' The chat\'s line counts the whole run as one job, never the tiles: never point the user there for tile progress.';
    return quoted.tiles
        ? ` It runs as up to ${quoted.tiles} tiles, one after another (tiles a person fills are left to the people pass, so fewer may run); the status bar counts them. Asked how many tiles, say up to ${quoted.tiles}. Telling the user it started, say up to ${quoted.tiles} tiles and that the status bar at the bottom counts them.${where}`
        : ` It runs in tiles; the status bar counts them. Asked how many, point the user there: never guess a number. Telling the user it started, say the status bar at the bottom counts the tiles.${where}`;
}

/**
 * The figure on the spend card the user said yes to. Told nothing, the agent priced a 4 s
 * 480p Seedance 1.5 clip off the model's blurb ("$0.30 for five seconds at 1080p") and said
 * $0.13 under a card and a counter that both said $0.05 (Fabio's smoke, 2026-10-04).
 */
function _priceNote(spend) {
    return spend?.price ? ` The user said yes to ${spend.price} on the spend card: that is the price, so quote it and never a figure of your own.` : '';
}

/** The same figure on a No (MPI-1017): the declined Wan 3.0 run was re-priced off the blurb. */
function _declinedPriceNote(price) {
    return price ? ` The spend card quoted ${price}: if you mention the price, quote that and never a figure of your own.` : '';
}

/**
 * The one note a routine run leaves (MPI-970): how many new cards, where, and per step which
 * cards it skipped (nothing to do) or stopped on, grouped as a batch's failures are.
 */
function _routineNote(name, r) {
    if (!r?.ok) return `[Routine failed: "${name}": ${r?.error?.code || 'ERROR'}: ${r?.error?.message || 'no reason given'}]`;
    const { cards = [], stackId } = r.output || {};
    const made = cards.filter((c) => c.groupId);
    const groups = new Map();
    const add = (k, id) => groups.set(k, [...(groups.get(k) || []), id]);
    for (const c of cards) {
        for (const n of c.skipped || []) add(`step ${n} had nothing to do, skipped`, c.inputGroupId);
        if (c.failedAt) add(`step ${c.failedAt} failed, ${c.error?.code || 'ERROR'}: ${c.error?.message || 'no reason given'}`, c.inputGroupId);
    }
    const why = [...groups].map(([k, ids]) => ` ${k}, on card ${ids.slice(0, 5).join(', ')}${ids.length > 5 ? ` and ${ids.length - 5} more` : ''}.`).join('');
    const where = stackId ? ` in the new stack ${stackId}` : made.length === 1 ? `: card ${made[0].groupId}` : '';
    return `[Routine finished: "${name}" on ${cards.length} card${cards.length === 1 ? '' : 's'}, ${made.length} new card${made.length === 1 ? '' : 's'}${where}.${why} They are in the gallery for the user to judge: report it in one sentence and look at none of them.]`;
}

/**
 * The App state line's half-sentence for an open video's playhead (MPI-984). Frame numbers
 * are the viewer's own counter (from 0), so they match what the user reads off the screen.
 */
/**
 * MPI-1181: the boxes the user drew in the Boxes panel. Fabio, 2026-10-20: "I have already
 * drawn some boxes for where I want the UFO and the people" - Cosmo could not see them.
 * Unpinned they run only when sent; pinned the panel's own boxes run on their own.
 */
function _boxesDrawn(boxes, pinned) {
    if (!boxes?.ops) return '';
    const lists = Object.entries(boxes.ops).map(([op, list]) => `${op} ${JSON.stringify(list)}`).join('; ');
    // Fabio, 2026-10-20: boxes drawn at 8:5 sent at 16:9 stretched, and the people came out too big.
    const frame = (boxes.ratio && boxes.ops.t2i ? ` The t2i boxes are drawn on a ${boxes.ratio} frame: send ratio ${boxes.ratio} with them unless the user asks for another.` : '')
        // Fabio, 2026-10-20: Cosmo edited the newest card, and a tier resized the frame under the box.
        + (boxes.picture && boxes.ops.edit ? ` The edit boxes are drawn on ${boxes.picture} (the edit's picture 1): an edit with them runs on that picture as inputImage, whatever card is newest, and sends no ratio or qualityTier, so it keeps that picture's frame.` : '');
    // Fabio, 2026-10-23: "I want headline to have 'The Art of Misery'" - a change to one box rides the whole list.
    const change = ' To change what a box holds (its words or its look), send that op\'s WHOLE list as generate\'s boxes with only that desc changed: what you send replaces the panel\'s boxes for that run and leaves the panel as drawn. A lettering box\'s words are the quoted part at the head of its desc; write the new words in the prompt too, never the old.';
    return ` The user has drawn boxes for ${boxes.modelId} in the Boxes panel: ${lists}.${frame} A box's size is how big the thing is in the picture: write the prompt at that size, never closer.${change}${pinned
        ? ' With the settings panel open they run on their own; cite each as <name> in the prompt.'
        : ' They run only if you send them: when the user wants them used, pass that op\'s list as generate\'s boxes on that model and op, and cite each as <name> in the prompt.'}`;
}

function _frameOnScreen({ index, count, paused }) {
    const where = `${paused ? 'paused on' : 'playing, now at'} frame ${index} of ${count} (the first is frame 0)`;
    return index === 0
        ? ` It is a video, ${where}. "This frame" means that first frame: sending the video as a picture gives exactly it.`
        : ` It is a video, ${where}. "This frame" means frame ${index}, NOT the first: a video sent as a picture is its first frame, so do not send it. Ask the user to right-click that frame in the video and choose Create snapshot, then use the new picture card (newest in list_cards).`;
}

/** A clip card's 512 poster, for the chat bubble: an <img> cannot paint the mp4 (MPI-867). */
function _posterUrl(filePath, itemId) {
    if (!itemId) return '';
    const poster = path.join(path.dirname(filePath), '.meta', `${itemId}.thumb.webp`);
    return fs.existsSync(poster) ? _projectFileUrl(poster) : '';
}

/**
 * The absolute path behind a result reference. A generation reports its output as a
 * plain absolute path today, but the gallery also carries the `/project-file?path=`
 * form, and `POST /connector/describe` stats the path it is given.
 */
function _decodeProjectFileUrl(ref) {
    if (typeof ref !== 'string' || !ref.includes('/project-file?')) return ref;
    try {
        return new URL(ref, 'http://127.0.0.1').searchParams.get('path') || ref;
    } catch { return ref; }
}

/**
 * `WxH` of an image file, or '' when it cannot be read (the line then just omits it).
 * Upright (EXIF applied): the size the describe route reports and the canvas shows (MPI-959).
 */
async function _imageSize(filePath) {
    try {
        const { default: sharp } = await import('sharp');
        const { width, height } = (await sharp(filePath, { limitInputPixels: false }).metadata()).autoOrient;
        return width && height ? `${width}x${height}` : '';
    } catch { return ''; }
}

/**
 * MPI-870 — ONE truncated line per look, cached or fresh.
 *
 * The description of a picture the user ATTACHES is written nowhere: a staged attachment
 * registers with no `itemId` (a temp copy a reset deletes), so `_lookOnce` has no sidecar
 * to keep it in. Live on 2026-09-21 the tags said `upper body` for a full-body bent-forward
 * selfie and carried no pose tag at all, and "did the describer misread it, or did the tag
 * step drop the pose?" could not be answered by anything on disk. With this line it is a
 * grep. Never throws: a missing log line must not cost the look.
 */
const LOOK_LOG_CHARS = 240;
function _logLook(ref, text, cached) {
    import('../routes/logger.js').then(({ default: logger }) => {
        const one = String(text || '').replace(/\s+/g, ' ').trim();
        const name = String(ref?.path || '').split(/[\\/]/).pop();
        logger.info('agent', `look ${cached ? 'CACHED' : 'FRESH'} ${ref?.kind || 'image'} ${name}: `
            + `${one.slice(0, LOOK_LOG_CHARS)}${one.length > LOOK_LOG_CHARS ? '…' : ''}`);
    }).catch(() => { /* a log line never costs a look */ });
}

/**
 * MPI-1286 — ONE line per tool call the app refused (`ok:false`), with its code and reason.
 * Fabio's run on 2026-10-28 showed "Generation not started" and nothing on disk said why:
 * an agent-side refusal never reaches the connector, so only this line records it. The
 * args are the model's own call, cut short. Never throws: a log line must not cost a turn.
 */
const REFUSED_LOG_CHARS = 400;
function _logRefused(toolName, args, resultText) {
    import('../routes/logger.js').then(({ default: logger }) => {
        const err = JSON.parse(resultText)?.error || {};
        const call = JSON.stringify(args || {});
        logger.warn('agent', `refused ${toolName} ${err.code || '?'}: ${String(err.message || '').slice(0, REFUSED_LOG_CHARS)}`
            + ` | args ${call.slice(0, REFUSED_LOG_CHARS)}${call.length > REFUSED_LOG_CHARS ? '…' : ''}`);
    }).catch(() => { /* a log line never costs a turn */ });
}

/**
 * MPI-870 — what a `look` says when it read the card's kept description and made NO vision
 * call. Fabio's wording. His reason is a product goal, not cosmetics: users who work with
 * agents read the status line to tell whether their credits are being spent, and a saving
 * they cannot see does not count as one. Live at ~09:18Z on 2026-09-21 the chat printed
 * "Looking at image" over zero vision calls, and he did not believe the answer was real
 * until the log was read back to him.
 */
const LOOK_CACHED_LABEL = 'Fetching saved image description';
// MPI-1208, Fabio: a look of Cosmo's own is a small gag on Prism, the describer.
const LOOK_SEE_LABEL = "Prism's description is a bit fuzzy, so I'm taking a look myself";
const GENERATE_REFUSED_LABEL = 'Generation not started';

/**
 * MPI-913 — Fabio's copy (2026-09-27). A local Ollama agent and a render on the same card
 * cannot share it: an idle LLM took a sub-10 s render past 3 minutes on 16 GB (MPI-14).
 * GPU_YIELD is what the model's own context reads for the turn it ended early, kept apart
 * so it does not learn to speak about itself in the third person.
 */
const GPU_WAIT_LABEL = 'A generation is running on your graphics card. Cosmo runs on the same card, so Cosmo waits for it to finish. Press Stop on the generation to talk now.';
const GPU_YIELD = 'Started. I stay quiet while it renders, because I run on the same graphics card.';

/**
 * MPI-941 Phase 7 — the Options rule's `[options: A | B]`, cut out of the reply the user reads.
 * Two to four distinct choices come back as buttons; one is no fork, so it gets none. A reply
 * with no marker is returned untouched.
 */
function _takeOptions(text) {
    let options = null;
    const shown = text.replace(/\s*\[options:([^\]]*)\]/gi, (_, list) => {
        const o = [...new Set(list.split('|').map((s) => s.trim()).filter(Boolean))].slice(0, 4);
        if (o.length >= 2) options = o;
        return '';
    });
    return shown === text ? { text, options } : { text: shown.trim(), options };
}

function _toolLabel(toolName, args) {
    switch (toolName) {
        case 'list_models':    return 'Checking available models';
        case 'describe_model': return `Reading ${args.id || 'a model'}'s settings`;
        case 'read_knowledge': return args.id ? `Reading: ${args.id}` : 'Reading knowledge index';
        case 'install_model':  return `Preparing install: ${args.modelId || '?'}`;
        case 'generate':       return `Starting generation`;
        case 'cancel_generation': return 'Cancelling a generation';
        case 'look':           return 'Looking at image';
        case 'list_projects':  return 'Checking your projects';
        case 'create_project': return `Creating project: ${args.name || ''}`;
        case 'open_project':   return `Opening project`;
        case 'rename_card':    return `Naming a card: ${args.name || ''}`;
        case 'list_cards':     return args.groupId ? 'Reading a card' : 'Looking through the project';
        case 'send_cards':     return `Copying ${[].concat(args.cards || []).length === 1 ? 'a card' : 'cards'} to ${args.newProject ? `a new project: ${args.newProject}` : 'another project'}`;
        case 'visible_cards':  return 'Looking at what the gallery shows';
        case 'mark_card':      return args.mark === 'none' ? 'Clearing a card mark' : 'Marking a card';
        case 'gif':
            return { make: 'Making a GIF', edit: 'Editing a GIF', cutout: 'Cutting out the subject',
                to_video: 'Turning a GIF into a video', sheet: 'Making a sheet' }[args.action] || 'Working on a GIF';
        case 'read_memory': {
            const kind = args.scope === 'global' ? 'global' : 'project';
            return args.file ? `Reading a ${kind} note` : `Reading ${kind} notes`;
        }
        case 'write_memory':
            if (_isUnfinishedFile(args.file)) return 'Checking unfinished generations';
            if (args.delete === true) return `${args.scope === 'global' ? 'Forgot the global note' : 'Forgot'}: ${args.file || ''}`;
            return `${args.scope === 'global' ? 'Noted for every project' : 'Noted'}: ${args.title || args.file || ''}`;
        case 'routine':
            return { list: 'Checking your routines', save: `Saving routine: ${args.name || ''}`, run: `Running routine: ${args.name || ''}`, rename: `Renaming routine: ${args.name || ''}`, delete: `Deleting routine: ${args.name || ''}` }[args.action] || 'Routines';
        default:               return toolName;
    }
}

/**
 * A project folder as a comparable key: forward slashes, no trailing slash, and case-blind
 * where the file system is. '' for no folder (the landing page's conversation).
 */
export function projectKey(folderPath) {
    if (!folderPath) return '';
    const p = String(folderPath).replace(/\\/g, '/').replace(/\/+$/, '');
    return process.platform === 'win32' || process.platform === 'darwin' ? p.toLowerCase() : p;
}

/** Does this agent model run on THIS PC's card? Ollama, minus its cloud models (MPI-913). */
export function onLocalGpu(profileId, model) {
    return profileId === 'ollama' && !/[-:]cloud$/i.test(model || '');
}
