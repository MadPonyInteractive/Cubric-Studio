#!/usr/bin/env node
/**
 * stage-mascot-clips.mjs — MPI-777 Phase 1.
 *
 * Turns the 103 delivered mascot GIFs into the animated assets the app ships:
 * `assets/mascot/{key}/{state}.webm`, VP9 with alpha, beside the stills MPI-766 staged.
 * The stills stay: they are the reduced-motion and first-paint fallback.
 *
 * The join between a file on disk (`gif_<hash>.gif`) and what it is lives in
 * `docs/mascot-gif-manifest.md` — this reads that table rather than keeping a second copy.
 * The source GIFs are outside every repo (see SRC below), so this is a local one-off tool,
 * not part of a build.
 *
 * Two things here are load-bearing and were measured, not guessed (MPI-777 validation.md):
 *
 *  1. ALPHA MUST BE PREMULTIPLIED ACROSS THE RESIZE. Scaling straight alpha smears body
 *     colour into the transparent ring, and the encoder's alpha softness then shows it as a
 *     light rim around the character. premultiply -> scale -> unpremultiply removes it and
 *     the file gets smaller.
 *  2. WebM, not GIF. Chromium holds a decoded animated GIF as GPU textures — five mascots
 *     at the landing's size measured ~305 MiB of VRAM, against ~13 MiB for the same clips as
 *     alpha WebM, which is software-decoded and never touches the GPU decoder.
 *
 * Usage:  node scripts/stage-mascot-clips.mjs [--dry-run] [--only <slug>] [--src <dir>]
 *         node scripts/stage-mascot-clips.mjs --verify        (guards rule 1, see below)
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const run = promisify(execFile);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(REPO, 'docs', 'mascot-gif-manifest.md');
const OUT_ROOT = path.join(REPO, 'assets', 'mascot');
const SRC = 'C:/Users/Fabio/Documents/Cubric Vision/Projects/Cubric Studio GIFs/Media';

// One scale for every clip, whatever its shape. The clips all came off one character sheet,
// so a single factor keeps every size relationship the artwork already has — including the
// one against the stills, which are 620 tall. Cropping each clip to its subject would throw
// that away and leave Phase 3 guessing.
// ponytail: per-spot sizes only if the staged weight ever actually matters.
const STILL_H = 620;
const SOURCE_H = 768;

/** The state names the app will ask for. Keyed by the manifest's "What it is" column. */
const SLUGS = new Map(Object.entries({
    'Idle 1': 'idle-1', 'Idle 2': 'idle-2', 'Idle 3': 'idle-3',
    'Happy (hop)': 'happy-1', 'Happy (head pop)': 'happy-2',
    'Failed': 'failed', 'Job cancelled': 'cancelled', 'Heads up': 'heads-up',
    'Search no results': 'no-results', 'Gallery peek': 'peek',
    'Getting ready': 'getting-ready', 'Working': 'working',
    'Smoke puff': 'transition-smoke', 'Explosion': 'transition-explosion',
    'engine starting': 'engine-starting', 'update ready': 'update-ready',
    'agent thinking': 'agent-thinking', 'agent listening': 'agent-listening',
    'agent answer ready': 'agent-answer-ready',
    'connecting loop (sparks)': 'connecting-sparks',
    'connecting loop (spit out)': 'connecting-spit-out',
    'connecting loop (laptop)': 'connecting-laptop',
    'connecting loop (screwdriver)': 'connecting-screwdriver',
    'connected (plays once on connect success)': 'connected',
}));

/** `Greet (wave)` is every mascot's first greet; its second is the character-specific one. */
function slugFor(what) {
    if (SLUGS.has(what)) return SLUGS.get(what);
    if (what === 'Greet (wave)') return 'greet-1';
    if (what.startsWith('Greet (')) return 'greet-2';
    if (what.startsWith('Third (')) return 'transition-third';
    return null;
}

/** Rows of `| gif_NNN | file | source | what | WxH |` under each `### Mascot` heading. */
async function readManifest() {
    const text = await fs.readFile(MANIFEST, 'utf8');
    const rows = [];
    let mascot = null;
    for (const line of text.split(/\r?\n/)) {
        const head = /^###\s+(.+?)\s*$/.exec(line);
        if (head) { mascot = head[1]; continue; }
        const m = /^\|\s*`(gif_\d+)`\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*(\d+)x(\d+)\s*\|\s*$/.exec(line);
        if (!m || !mascot) continue;
        const [, card, file, source, what, w, h] = m;
        rows.push({ mascot, card, file, source, what, w: +w, h: +h });
    }
    return rows;
}

/** Cut-out clips arrive with an alpha plane; the transitions are rendered on black. */
async function hasAlpha(file) {
    // Page 0 only: a clip is cut out or it is not, the frames do not disagree.
    const { data, info } = await sharp(file).ensureAlpha().extractChannel(3)
        .raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < info.width * info.height; i++) if (data[i] !== 255) return true;
    return false;
}

const even = n => Math.trunc(n / 2) * 2;

/**
 * The transitions are rendered on black, and the landing used to drop that black with
 * `mix-blend-mode: screen`. CHROMIUM IGNORES THAT BLEND: it promotes a `<video>` to its
 * own composited layer and the overlay paints as a black square over the mascot
 * (measured 2026-09-22 — the computed value really is `screen`, and `isolation: isolate`
 * on the parent changes nothing). So the black comes off here instead, where it stays off.
 *
 * `a = max(r,g,b)` keys the effect out of its own background and leaves RGB alone, which
 * IS premultiplied data — hence no `premultiply` step, and the same `unpremultiply` after
 * the scale that every cut-out clip gets. Alpha VP9 composites correctly here (every
 * mascot clip is one), and the key keeps the soft smoke edges that were the whole reason
 * `screen` beat a cut-out mask.
 *
 * `max` rather than a luma weighting: a saturated flash must not read semi-transparent.
 * Measured against the blend it replaces — mean |screen − over| is 2.1/255 on the dark
 * stage, invisible; on a light background the puff occludes rather than washing out,
 * which is what a puff of smoke should do anyway.
 */
const LUMA_KEY = "geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='max(max(r(X,Y),g(X,Y)),b(X,Y))'";

async function encode(src, dst, { alpha, keyed, w, h }) {
    const tw = even(w * STILL_H / SOURCE_H), th = even(h * STILL_H / SOURCE_H);
    const scale = `scale=${tw}:${th}:flags=lanczos`;
    let vf = `format=rgba,${scale}`;
    if (alpha) vf = `format=rgba,premultiply=inplace=1,${scale},unpremultiply=inplace=1`;
    if (keyed) vf = `format=gbrap,${LUMA_KEY},${scale},unpremultiply=inplace=1`;
    await run('ffmpeg', [
        '-v', 'error', '-y', '-i', src,
        '-vf', vf,
        '-c:v', 'libvpx-vp9', '-pix_fmt', alpha || keyed ? 'yuva420p' : 'yuv420p',
        '-b:v', '0', '-crf', '32', '-row-mt', '1', '-an', dst,
    ]);
    return { tw, th };
}

/**
 * The guard for rule 1. An absolute "is there a rim" threshold cannot work: downscaling
 * legitimately makes antialiased edge pixels carrying the character's own colour, so a
 * light-edged mascot reads brighter than the page and a dark-edged one darker. What a rim
 * WOULD show as is the staged clip reading brighter than a correct downscale of the same
 * frame — sharp premultiplies across a resize, so it is that reference.
 *
 * Measured 2026-09-21: every staged clip lands 0.15-0.40 BELOW its reference. The encode
 * that shipped the rim read +6.9 by the same measure.
 */
const RING_TOLERANCE = 1.0;

function ringLuminance(data, W, H, bg = 30, R = 4) {
    const inside = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) inside[i] = data[i * 4 + 3] > 200 ? 1 : 0;
    const grown = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!inside[y * W + x]) continue;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < H && nx >= 0 && nx < W) grown[ny * W + nx] = 1;
        }
    }
    let n = 0, sum = 0;
    for (let i = 0; i < W * H; i++) {
        if (!grown[i] || inside[i]) continue;
        const o = i * 4, a = data[o + 3] / 255;
        sum += (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) * a + bg * (1 - a);
        n++;
    }
    return n ? sum / n : NaN;
}

/**
 * The guard for the keyed transitions. The rim check below cannot cover them — it
 * compares against a downscale of the SOURCE, and the source is the opaque render the
 * key exists to remove. What can go wrong here is simpler and total: the key silently
 * not applying, which is the black square all over again. A keyed clip must therefore
 * be neither fully opaque nor fully transparent.
 */
async function keyedAlpha(dst, frame, tmp) {
    const png = path.join(tmp, 'verify-key.png');
    await run('ffmpeg', ['-v', 'error', '-y', '-c:v', 'libvpx-vp9', '-i', dst,
        '-vf', `select=eq(n\\,${frame})`, '-vframes', '1', '-pix_fmt', 'rgba', png]);
    const { data, info } = await sharp(png).ensureAlpha().extractChannel(3)
        .raw().toBuffer({ resolveWithObject: true });
    let clear = 0, solid = 0;
    for (let i = 0; i < info.width * info.height; i++) {
        if (data[i] === 0) clear++;
        else if (data[i] === 255) solid++;
    }
    const n = info.width * info.height;
    return { clear: clear / n, partial: (n - clear - solid) / n };
}

async function verify(staged, tmp) {
    const FRAME = 10;
    const fails = [];
    let worst = { delta: -Infinity, name: '' };
    for (const s of staged) {
        const dst = path.join(OUT_ROOT, s.key, `${s.slug}.webm`);
        try { await fs.access(dst); } catch { fails.push(`${s.key}/${s.slug}: not staged`); continue; }
        if (!await hasAlpha(s.file)) {
            // A transition is ~9 frames, so FRAME would run off the end; 4 is mid-effect.
            if (!s.slug.startsWith('transition-')) continue;
            const { clear, partial } = await keyedAlpha(dst, 4, tmp);
            if (clear < 0.2 || partial < 0.02) {
                fails.push(`${s.key}/${s.slug}: key did not take — ${(clear * 100).toFixed(0)}% clear, `
                    + `${(partial * 100).toFixed(0)}% partial (an unkeyed clip reads 0% and 0%)`);
            }
            continue;
        }

        const meta = await sharp(s.file, { animated: true }).metadata();
        const { data } = await sharp(s.file, { animated: true }).ensureAlpha()
            .raw().toBuffer({ resolveWithObject: true });
        const ph = meta.pageHeight, W = meta.width;
        const frame = Math.min(FRAME, meta.pages - 1);
        const one = data.subarray(frame * ph * W * 4, (frame + 1) * ph * W * 4);
        const ref = await sharp(one, { raw: { width: W, height: ph, channels: 4 } })
            .resize({ width: even(W * STILL_H / SOURCE_H), height: even(ph * STILL_H / SOURCE_H), kernel: 'lanczos3' })
            .raw().toBuffer({ resolveWithObject: true });

        const png = path.join(tmp, 'verify-frame.png');
        await run('ffmpeg', ['-v', 'error', '-y', '-c:v', 'libvpx-vp9', '-i', dst,
            '-vf', `select=eq(n\\,${frame})`, '-vframes', '1', '-pix_fmt', 'rgba', png]);
        const got = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

        const delta = ringLuminance(got.data, got.info.width, got.info.height)
            - ringLuminance(ref.data, ref.info.width, ref.info.height);
        if (delta > worst.delta) worst = { delta, name: `${s.key}/${s.slug}` };
        if (delta > RING_TOLERANCE) fails.push(`${s.key}/${s.slug}: rim +${delta.toFixed(2)} over a correct downscale`);
    }
    console.log(`\nworst rim delta ${worst.delta >= 0 ? '+' : ''}${worst.delta.toFixed(2)} (${worst.name}), tolerance +${RING_TOLERANCE.toFixed(2)}`);
    console.log(fails.length ? `FAILED:\n  ${fails.join('\n  ')}` : 'rim check passed on every staged clip');
    return fails.length;
}

async function main() {
    const argv = process.argv.slice(2);
    const dryRun = argv.includes('--dry-run');
    const flag = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
    const only = flag('--only', null);
    const src = flag('--src', SRC);

    const rows = await readManifest();
    const skipped = [];
    let staged = [];

    for (const row of rows) {
        const slug = slugFor(row.what);
        if (!slug) { skipped.push({ ...row, why: 'unassigned spare' }); continue; }
        const file = path.join(src, row.file);
        try { await fs.access(file); } catch { skipped.push({ ...row, why: 'source missing' }); continue; }
        staged.push({ ...row, key: row.mascot.toLowerCase(), slug, file });
    }

    // Two mascots delivered their gallery peek twice: the first roll, then the one that
    // replaced it. The manifest lists them in roll order, so the LAST row keeps the name the
    // app asks for and the earlier ones are parked under `-superseded`.
    const byName = new Map();
    for (const s of staged) {
        const k = `${s.key}/${s.slug}`;
        byName.set(k, [...(byName.get(k) || []), s]);
    }
    for (const group of byName.values()) {
        group.slice(0, -1).forEach((s, i) => { s.slug += group.length > 2 ? `-superseded-${i + 1}` : '-superseded'; });
    }

    if (only) staged = staged.filter(s => s.slug === only);

    if (argv.includes('--verify')) {
        const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mascot-verify-'));
        try { process.exitCode = await verify(staged, tmp) ? 1 : 0; }
        finally { await fs.rm(tmp, { recursive: true, force: true }); }
        return;
    }

    let bytes = 0;
    for (const s of staged) {
        const dir = path.join(OUT_ROOT, s.key);
        const dst = path.join(dir, `${s.slug}.webm`);
        if (dryRun) { console.log(`would stage ${s.key}/${s.slug}.webm  <- ${s.file} (${s.w}x${s.h})`); continue; }
        s.alpha = await hasAlpha(s.file);
        // An opaque TRANSITION gets its alpha keyed out of its own black (see `encode`).
        // Any other opaque clip stays opaque: the key would eat a character's dark side.
        s.keyed = !s.alpha && s.slug.startsWith('transition-');
        await fs.mkdir(dir, { recursive: true });
        const { tw, th } = await encode(s.file, dst, s);
        const size = (await fs.stat(dst)).size;
        bytes += size;
        const how = s.alpha ? 'cut-out' : s.keyed ? 'keyed  ' : 'opaque ';
        console.log(`${s.key}/${s.slug}.webm  ${tw}x${th}  ${how}  ${(size / 1e6).toFixed(3)} MB`);
    }

    console.log(`\nstaged ${dryRun ? 0 : staged.length} of ${rows.length} manifest rows, ${(bytes / 1e6).toFixed(1)} MB total`);
    for (const s of skipped) console.log(`  skipped ${s.card} (${s.source}): ${s.why}`);
}

main().catch(e => { console.error(e); process.exit(1); });
