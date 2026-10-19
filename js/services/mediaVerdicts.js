/**
 * mediaVerdicts.js — one YES/NO answer per picture or clip, asked ONCE and kept in its card's
 * sidecar (MPI-1156): the child-safety gate's "could this person be under 18?", "is this person
 * in swimwear, underwear or less?" and "is this clothing revealing?". Precedent:
 * `llmService.pictureCaptions`, which keeps a picture's description the same way.
 *
 * Kept as `meta[key] = { q, answer }`, `q` the question's hash: a reworded question asks again.
 * Every picture is judged as it looks now: an edit never takes its source's answer (Fabio
 * 2026-10-19, a young-looking character aged up is judged as the adult it now shows).
 * A picture with no card (an agent's file path, a staged engine path) is asked every time.
 *
 * No imports: the gate's tests run it in bare Node with a stub `http` and `ask`.
 */

/** FNV-1a, hex: enough to tell one fixed question from its next wording. */
export function questionHash(question) {
    let h = 0x811c9dc5;
    for (const ch of String(question)) {
        h ^= ch.codePointAt(0);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
}

/** A `/project-file?path=` url or a plain path, as one comparable string. */
function _samePath(p) {
    const m = String(p || '').match(/[?&]path=([^&]+)/);
    return (m ? decodeURIComponent(m[1]) : String(p || '')).replace(/\\/g, '/').toLowerCase();
}

/**
 * @param {string[]} urls  pictures or clips, as a config's `mediaItems` carry them
 * @param {object} o
 * @param {string} o.key        the sidecar field (`ageVerdict`, `exposedVerdict`, `clothesVerdict`)
 * @param {string} o.question   the fixed question; its hash keys the kept answer
 * @param {(url: string) => Promise<boolean|null>} o.ask  true = YES, false = NO, null = not answered
 * @param {{ id?: string, folderPath?: string, itemGroups?: Array }} [o.project]
 * @param {typeof fetch} [o.http]
 * @returns {Promise<Array<boolean|null>>}  one per url: null = could not be asked (refuse)
 */
export async function cachedVerdicts(urls, { key, question, ask, project = null, http = globalThis.fetch }) {
    const q = questionHash(question);
    const idByPath = new Map();
    for (const group of project?.itemGroups ?? []) {
        for (const item of group.history ?? []) {
            if (item?.filePath && item.id) idByPath.set(_samePath(item.filePath), item.id);
        }
    }
    const idOf = (url) => idByPath.get(_samePath(url)) ?? null;
    const load = async (ids) => {
        if (!ids.length || !project?.folderPath) return {};
        try {
            const res = await http('/load-meta-batch', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: project.folderPath, ids }),
            });
            return (await res.json()).items ?? {};
        } catch {
            return {};
        }
    };
    const kept = (meta) => (meta?.[key]?.q === q ? meta[key].answer === 'YES' : null);

    const ids = urls.map(idOf);
    const metas = await load(ids.filter(Boolean));
    return Promise.all(urls.map(async (url, i) => {
        const meta = ids[i] ? metas[ids[i]]?.meta : null;
        let answer = kept(meta);
        if (answer !== null) return answer;
        try { answer = url ? await ask(url) : null; } catch { answer = null; }
        if (typeof answer !== 'boolean') return null;
        // `meta` null = no sidecar, and update-meta would mint one holding only this.
        if (meta && project?.id) {
            await http(`/project-media/${project.id}/update-meta?folderPath=${encodeURIComponent(project.folderPath)}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: ids[i], updates: { [key]: { q, answer: answer ? 'YES' : 'NO' } } }),
            }).catch(() => {});
        }
        return answer;
    }));
}
