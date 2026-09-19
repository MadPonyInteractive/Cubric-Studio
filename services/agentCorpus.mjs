/**
 * agentCorpus.mjs — the retrieval path the in-app agent reads from.
 *
 * One function, one entry shape, every corpus (`docs/agent-corpus.md`, decision 4):
 *
 *   listCorpus() -> [{ id, kind: 'model' | 'guide' | 'skill' | 'app', title, tags: string[], text() }]
 *
 * - `kind: 'model'` entries are generated per recipe x mode; `text()` renders through
 *   `renderRecipeBrief()`, so a recipe and its brief can never drift.
 * - `kind: 'guide'` (MPI-774 Phase 3b) is our own prompting guide per recipe,
 *   `docs/agent/models/<recipeId>.md`, written from the vendor's pack, the recipe, the model
 *   docs and field evidence. `guideIdsByModel()` maps every Vision model to its guide through
 *   the recipe the enhancer already resolves; the loop will not send a model's first prompt
 *   until that guide was read.
 * - `kind: 'skill'` entries are the Cubric Vision skills (`.claude/skills/cubric-vision*`),
 *   with a preamble mapping their HTTP routes onto the in-app agent's tools.
 * - `kind: 'app'` entries are the markdown in `docs/agent/`; `text()` reads the file.
 *   One more, `app:operations`, is RENDERED from the op and model registries (decision 1).
 * - `text()` is LAZY on all of them. Listing the corpus is a `readdirSync` and some string
 *   building; the agent pays for content only on what it selects.
 *
 * SERVER-SIDE ON PURPOSE. `js/` is browser code with no `fs`, and the app half of the
 * corpus is files on disk. `js/data/recipes/*` is plain ESM with no I/O, so importing
 * it from here costs nothing and keeps the recipes a single source.
 *
 * `docs` is not in APP_COPY_EXCLUDES (`scripts/build-portable.mjs`), so `docs/agent/*.md`
 * ships in the portable build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPE_REGISTRY, resolveRecipe } from '../js/data/recipes/registry.js';
import { renderRecipeBrief } from '../js/data/recipes/brief.js';
import { COMMANDS } from '../js/data/commandRegistry.js';
import { MODELS } from '../js/data/modelConstants/models.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const AGENT_DOCS_DIR = path.join(ROOT, 'docs', 'agent');
export const GUIDES_DIR = path.join(AGENT_DOCS_DIR, 'models');
// `.claude/` is left out of the portable build, so the build stages a copy of these skills
// in `docs/agent/skills/` (`copyAgentSkills`, scripts/build-portable.mjs): a repo reads the
// source, an installed app reads the copy.
export const SKILL_DIRS = [path.join(ROOT, '.claude', 'skills'), path.join(AGENT_DOCS_DIR, 'skills')];
export const isVisionSkill = (name) => name === 'cubric-vision' || name.startsWith('cubric-vision-');

const SKILL_PREAMBLE = [
    '> You are the in-app agent. This skill was written for OUTSIDE agents that call the app\'s',
    '> HTTP routes. You never call a route: your tools do that work (list_models, describe_model,',
    '> read_knowledge, install_model, generate, look, open_project, rename_card, read_memory,',
    '> write_memory).',
    '> Skip the curl, port and shell steps. Routes that delete are for outside agents acting on',
    '> their user\'s word; you never delete.',
    '',
    '',
].join('\n');

// ponytail: a doc's title and tags come from its FILENAME, not from its content or a
// front-matter block. Reading every file to build a listing is the one thing this
// function is supposed to avoid, and a parser for metadata nothing writes yet is
// speculative. Name the file well; add front matter when a doc needs a title a
// filename cannot carry.
const titleFromFilename = (base) =>
    base.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());

function modelEntries() {
    return RECIPE_REGISTRY.flatMap((recipe) =>
        Object.keys(recipe.modes ?? {}).map((mode) => ({
            id: `${recipe.modelId}:${mode}`,
            kind: 'model',
            title: `${recipe.displayName} — ${mode}`,
            tags: [recipe.modelId, recipe.family, mode, recipe.modes[mode].outputFormat, recipe.status]
                .filter(Boolean),
            text: () => renderRecipeBrief(recipe, mode),
        })),
    );
}

/** Recipe ids that have a guide file. A readdir, never a read. */
function guideRecipeIds() {
    try {
        return fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
    } catch {
        return [];
    }
}

function guideEntries() {
    return guideRecipeIds().map((id) => {
        const recipe = RECIPE_REGISTRY.find((r) => r.modelId === id);
        const briefs = Object.keys(recipe?.modes ?? {}).map((mode) => `${id}:${mode}`);
        return {
            id: `guide:${id}`,
            kind: 'guide',
            title: `${recipe?.displayName ?? titleFromFilename(id)}: prompting guide`,
            tags: ['guide', id, recipe?.family].filter(Boolean),
            text: () => fs.readFileSync(path.join(GUIDES_DIR, `${id}.md`), 'utf8')
                + (briefs.length ? `\n\n---\n\nThe exact rules the Prompt Box enhancer applies to this model: ${briefs.join(', ')}.\n` : ''),
        };
    });
}

/**
 * `{ [modelId]: guideIds[] }` for every Vision model: the guide of the recipe the enhancer
 * resolves for it (`resolveRecipe`), when that guide exists. One readdir for the lot.
 */
export function guideIdsByModel() {
    const have = new Set(guideRecipeIds());
    return Object.fromEntries(MODELS.map((m) => {
        const recipe = resolveRecipe(m.enhanceRecipe ?? m.type);
        return [m.id, recipe && have.has(recipe.modelId) ? [`guide:${recipe.modelId}`] : []];
    }));
}

function skillEntries() {
    const root = SKILL_DIRS.find((dir) => {
        try { return fs.readdirSync(dir).some(isVisionSkill); } catch { return false; }
    });
    if (!root) return [];
    return fs.readdirSync(root).filter(isVisionSkill).sort().flatMap((dir) => {
        let files;
        try {
            files = fs.readdirSync(path.join(root, dir)).filter((f) => f.toLowerCase().endsWith('.md')).sort();
        } catch {
            return [];
        }
        return files.map((file) => {
            const base = file.replace(/\.md$/i, '');
            const main = base === 'SKILL';
            return {
                id: main ? `skill:${dir}` : `skill:${dir}/${base}`,
                kind: 'skill',
                title: `Skill: ${titleFromFilename(dir)}${main ? '' : ` (${base.replace(/[-_]+/g, ' ')})`}`,
                tags: ['skill', dir, ...(main ? [] : [base])],
                text: () => SKILL_PREAMBLE + fs.readFileSync(path.join(root, dir, file), 'utf8'),
            };
        });
    });
}

function appEntries() {
    let files;
    try {
        files = fs.readdirSync(AGENT_DOCS_DIR);
    } catch {
        return [];   // no docs/agent yet — the model half is still a corpus
    }
    return files
        .filter((f) => f.toLowerCase().endsWith('.md'))
        .sort()
        .map((file) => {
            const base = file.replace(/\.md$/i, '');
            return {
                id: `app:${base}`,
                kind: 'app',
                title: titleFromFilename(base),
                tags: ['app', ...base.split(/[-_]+/).filter(Boolean)],
                text: () => fs.readFileSync(path.join(AGENT_DOCS_DIR, file), 'utf8'),
            };
        });
}

// Decision 1: a fact already in a data file is rendered, never restated. What an op does
// lives in commandRegistry.js (label, info, help) and which models run it in models.js;
// a hand-written list would drift and nothing would fail. Flows are their own surface
// (flowsRegistry.js), and promptEnhance is covered by app:prompt-enhancement.
function renderOperations() {
    const ops = Object.entries(COMMANDS);
    const out = [
        '# Operations', '',
        'What each operation does and which models run it. The Prompt Box offers only the ops the selected model supports, and only once the media they need is staged.', '',
    ];
    for (const [key, cmd] of ops.filter(([, c]) => !c.stub && !c.universal)) {
        // Set: two MODELS entries can share one display name.
        const models = [...new Set(MODELS.filter((m) => m.supportedOps.includes(key)).map((m) => m.name))];
        if (!models.length) continue;   // no model runs it, so the Prompt Box never offers it
        out.push(`## ${cmd.label} (\`${key}\`)`, '', cmd.info, '',
            ...(cmd.help?.body ?? []).flatMap((p) => [p, '']),
            `Models: ${models.join(', ')}`, '');
    }
    const tools = ops.filter(([k, c]) => c.universal && !k.startsWith('flow') && k !== 'promptEnhance');
    out.push('## Tools', '', 'Model-free tools that run on an existing image or video:', '',
        ...tools.map(([k, c]) => `- ${c.label} (\`${k}\`, ${c.mediaType})`), '');
    return out.join('\n');
}

const OPERATIONS_ENTRY = {
    id: 'app:operations',
    kind: 'app',
    title: 'Operations',
    tags: ['app', 'operations'],
    text: renderOperations,
};

/** Every corpus entry, model briefs first. `text()` is unread until called. */
export function listCorpus() {
    return [...modelEntries(), ...guideEntries(), ...skillEntries(), ...appEntries(), OPERATIONS_ENTRY];
}
