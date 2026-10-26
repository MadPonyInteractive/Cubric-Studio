// @ts-check
/**
 * outputVersions.js — a run whose graph makes several pictures on the way to ONE result (MPI-1086,
 * Fabio 2026-10-14): every picture lands as a VERSION of the one card, in the graph's order, instead
 * of one card each. A run whose job is several files (Stems) keeps one card per output; an op opts in
 * with `outputVersions` on its command (commandRegistry), a map of capture title → the operation that
 * version is filed under (e.g. the in-graph head removal as `flowCharacterSheetHeadless`, so the
 * Headless front body toggle finds it as it finds the old chained leg's version).
 */

/** `Output_Image` → 1, `Output_Image_3` → 3: the capture's place in the graph's order. */
function _place(title) {
    const n = /_(\d+)$/.exec(title || '');
    return n ? Number(n[1]) : 1;
}

/**
 * The run's outputs in the graph's order, each with the operation its version is filed under.
 * @param {string[]} urls
 * @param {?string[]} titles - the capture each url came from (null when unknown: urls keep their order)
 * @param {Object<string,string>} opByTitle - the op's `outputVersions`
 * @param {string} operation - the run's op, for every capture the map does not name
 * @returns {{url: string, operation: string}[]}
 */
export function orderVersions(urls, titles, opByTitle, operation) {
    const rows = urls.map((url, i) => ({ url, title: titles?.[i] || '', i }));
    if (titles) rows.sort((a, b) => _place(a.title) - _place(b.title) || a.i - b.i);
    return rows.map(({ url, title }) => ({ url, operation: opByTitle?.[title] || operation }));
}

/**
 * The version the card shows: the last one, skipping any filed under an op the run asked to keep
 * out of sight (the head removal with Headless front body off). Falls back to the last one.
 * @param {{operation: string}[]} items
 * @param {string[]} [hideOps]
 * @returns {number}
 */
export function shownVersion(items, hideOps = []) {
    for (let i = items.length - 1; i >= 0; i--) if (!hideOps.includes(items[i].operation)) return i;
    return items.length - 1;
}
