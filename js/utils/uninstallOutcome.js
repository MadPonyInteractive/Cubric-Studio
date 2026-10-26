/**
 * What a `download:uninstalled` report actually freed. The Model Library and the Flow
 * Library each toast the result of an uninstall; both read their numbers here, so a fix
 * to the counting reaches both (the Flow copy missed MPI-1076, AUDIT B4).
 *
 * @param {Object} report - the `download:uninstalled` payload
 * @param {Array} [report.removed]
 * @param {Array} [report.keptUniversal]   - engine-owned files (VAE, custom nodes), shared with no model
 * @param {Array} [report.keptShared]      - deps another model or flow still needs (`sharedWith`)
 * @param {Array<{reason?: string}>} [report.keptModelFiles]
 * @param {Array} [report.keptPipInstalls]
 * @returns {{ gone: number, keptFiles: number, keptTotal: number, keptForModel: number }}
 *   `gone` is what the click removed; `keptForModel` is what the "some shared files kept"
 *   wording may honestly refer to.
 */
export function uninstallOutcome({ removed = [], keptUniversal = [], keptShared = [], keptModelFiles = [], keptPipInstalls = [] } = {}) {
    // MPI-469 — a dep reported 'already-absent' was NOT kept: it was never on disk (local)
    // or on the volume (remote), so it is gone and counts toward a complete uninstall.
    const absent = keptModelFiles.filter(k => k.reason === 'already-absent').length;
    const keptFiles = keptModelFiles.length - absent;
    const keptTotal = keptUniversal.length + keptShared.length + keptFiles + keptPipInstalls.length;
    // MPI-1076 — but an absent file proves the uninstall complete only when nothing was
    // kept. Removed 0 with files kept means the click changed nothing on disk: Wan 2.2 on
    // a Pod volume said "uninstalled" on every click while the card kept showing its files.
    const gone = removed.length > 0 || keptTotal === 0 ? removed.length + absent : 0;
    // keptUniversal/keptPipInstalls belong to the engine, not to a sibling model, so they
    // never justify "shared files kept".
    const keptForModel = keptShared.length + keptFiles;
    return { gone, keptFiles, keptTotal, keptForModel };
}
