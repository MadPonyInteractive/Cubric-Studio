/**
 * devUpdatesService.js — the landing bell's dev updates (MPI-1115).
 *
 * Fabio posts in the Discord #dev-updates channel; the cubric-updates Worker
 * (C:/AI/Mpi/mpi-ci/cubric-updates) serves the latest posts as JSON, and this
 * service turns them into `state.devUpdates`: the posts this user has not
 * acknowledged yet, newest first. The bell badge is its length.
 *
 * Acknowledged ids live in Storage, on this machine only. A fresh install has
 * none, so its first successful fetch acknowledges everything but the newest
 * FIRST_RUN_UNREAD — a new user meets a 3 on the bell, never a 20.
 *
 * A failed fetch is quiet: the bell keeps what it had. The landing page is no
 * place for an error about a news feed.
 */

import { state } from '../state.js';
import { Storage } from '../core/storage.js';
import { clientLogger } from './clientLogger.js';

export const DEV_UPDATES_URL = 'https://updates.cubric.studio/v1/posts';
export const DISCORD_INVITE_URL = 'https://discord.gg/WX7tDFSVmY';

const FIRST_RUN_UNREAD = 3;
const POLL_MS = 30 * 60 * 1000; // the Worker caches 10 minutes, so this is the real delay

let _posts = [];
let _timer = null;

/**
 * The acknowledged ids, reconciled against the feed. `null` (never fetched) seeds
 * every post but the newest few; an id that left the feed is dropped, so the
 * list never outgrows the feed.
 * @param {{id: string}[]} posts - newest first
 * @param {string[]|null} acked
 * @returns {string[]}
 */
export function reconcileAcked(posts, acked) {
    if (!Array.isArray(acked)) return posts.slice(FIRST_RUN_UNREAD).map((p) => p.id);
    const live = new Set(posts.map((p) => p.id));
    return acked.filter((id) => live.has(id));
}

function _publish(acked) {
    Storage.setDevUpdatesAcked(acked);
    const seen = new Set(acked);
    state.devUpdates = _posts.filter((p) => !seen.has(p.id));
}

export async function refreshDevUpdates() {
    try {
        const res = await fetch(DEV_UPDATES_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { posts } = await res.json();
        _posts = Array.isArray(posts) ? posts : [];
    } catch (err) {
        clientLogger.warn('devUpdates', 'feed fetch failed', err);
        return;
    }
    _publish(reconcileAcked(_posts, Storage.getDevUpdatesAcked()));
}

export function acknowledgeDevUpdate(id) {
    _publish([...(Storage.getDevUpdatesAcked() || []), id]);
}

export function acknowledgeAllDevUpdates() {
    _publish(_posts.map((p) => p.id));
}

/** Fetch now, then every POLL_MS for the app's lifetime. Idempotent. */
export function startDevUpdates() {
    if (_timer) return;
    refreshDevUpdates();
    _timer = setInterval(refreshDevUpdates, POLL_MS);
}
