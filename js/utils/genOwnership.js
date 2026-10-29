// @ts-check
/**
 * Which generations a workspace Block owns (AUDIT D9: the Gallery and History Blocks carried
 * this state machine by copy). The generation registry is app-wide, so a Block draws only the
 * ids it started or rehydrated.
 *
 * The Stop bridge (MPI-195): ComfyUI /interrupt is advisory (an LTX inter-stage Stop runs to
 * completion), so a Stopped generation can still finish with real output. Stop drops the id
 * from the owned set at once, so the late `generation:complete` would fail the ownership check
 * and the finished card never paint. A Stopped id is kept aside until it settles; only OUR
 * stopped ids, so a concurrent local/remote lane (MPI-74 P6) is never affected.
 */
export function createGenOwnership() {
    const mine = new Set();
    const stopped = new Set();
    return {
        /** @param {string} id */
        add: (id) => { mine.add(id); },
        /** @param {string} id */
        has: (id) => mine.has(id),
        /** Forget every id, bridged ones too (the Block stops drawing them). */
        clear: () => { mine.clear(); stopped.clear(); },
        /**
         * `generation:complete`: true when it is ours, or one we Stopped that finished anyway.
         * @param {string} id
         */
        complete(id) {
            const owned = mine.delete(id);
            const bridged = stopped.delete(id);
            return owned || bridged;
        },
        /**
         * `generation:error`. `bridged` = a Stopped one that failed instead of finishing.
         * @param {string} id
         */
        error(id) {
            const bridged = stopped.delete(id);
            const owned = mine.delete(id);
            return { owned, bridged };
        },
        /**
         * `generation:cancelled`: true when it was ours (now bridged for a late complete).
         * A second cancelled for a forgotten id = the interrupted gen returned EMPTY: no late
         * complete is coming, so the bridge entry is dropped and it cannot leak.
         * @param {string} id
         */
        cancelled(id) {
            if (mine.delete(id)) {
                stopped.add(id);
                return true;
            }
            stopped.delete(id);
            return false;
        },
    };
}
