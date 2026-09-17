/**
 * Engine jobs in flight (MPI-792): a first install, an upgrade, a dependency repair, and
 * the curated pip pass at an engine start. Closing the app during any of them is what
 * leaves a half-installed engine, so the quit guard in main.js asks for this through
 * GET /comfy/downloads/active. It used to see only the engine ARCHIVE download, which is
 * the first minute or two of a first install and none of the rest.
 */

let running = 0;

/**
 * @returns {() => void} call when the job ends, however it ends; extra calls are ignored
 */
function beginEngineJob() {
    running += 1;
    let ended = false;
    return () => {
        if (ended) return;
        ended = true;
        running -= 1;
    };
}

/** @returns {boolean} */
function engineJobRunning() {
    return running > 0;
}

module.exports = { beginEngineJob, engineJobRunning };
