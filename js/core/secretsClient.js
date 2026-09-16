// js/core/secretsClient.js

/**
 * secretsClient — the ONLY renderer-side interface to the secrets:* IPC
 * channels (main/secretsStore.js). The raw API key is write-only from the
 * renderer: it can be set, tested for presence, and cleared, but never read
 * back. There is deliberately no get-api-key channel for the renderer.
 *
 * In browser dev mode (no Electron IPC) every call resolves to a safe
 * negative — RunPod settings show as unavailable, nothing throws.
 */

import { clientLogger } from '../services/clientLogger.js';

function _ipc() {
    try {
        if (typeof window.require === 'function') {
            return window.require('electron')?.ipcRenderer || null;
        }
    } catch (_) { /* browser dev mode */ }
    return null;
}

export const secretsClient = {

    /** @returns {boolean} True when the Electron IPC bridge is available. */
    isAvailable() {
        return !!_ipc();
    },

    /**
     * Encrypts and stores the RunPod API key in the main process.
     * @param {string} key
     * @returns {Promise<{ok: boolean, weakEncryption?: boolean, error?: string}>}
     */
    async setApiKey(key) {
        const ipc = _ipc();
        if (!ipc) return { ok: false, error: 'ipc_unavailable' };
        try {
            return await ipc.invoke('secrets:set-api-key', { key });
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] set-api-key failed', err);
            return { ok: false, error: 'ipc_error' };
        }
    },

    /** @returns {Promise<boolean>} True when an API key is stored. */
    async hasApiKey() {
        const ipc = _ipc();
        if (!ipc) return false;
        try {
            const res = await ipc.invoke('secrets:has-api-key');
            return !!res?.has;
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] has-api-key failed', err);
            return false;
        }
    },

    /** @returns {Promise<{ok: boolean}>} */
    async clearApiKey() {
        const ipc = _ipc();
        if (!ipc) return { ok: false };
        try {
            return await ipc.invoke('secrets:clear-api-key');
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] clear-api-key failed', err);
            return { ok: false };
        }
    },

    /**
     * Encrypts and stores the DeepInfra API key — the cloud prompt enhancer
     * (MPI-677 step 1a). Same write-only contract as the RunPod key: set,
     * presence, clear, and no way to read it back. The forked server resolves it
     * over the fork bridge; `routes/llm.js` hands it straight to the engine and
     * nothing else ever holds it. Its own slot, never the RunPod one.
     * @param {string} key
     * @returns {Promise<{ok: boolean, weakEncryption?: boolean, error?: string}>}
     */
    async setDeepInfraKey(key) {
        const ipc = _ipc();
        if (!ipc) return { ok: false, error: 'ipc_unavailable' };
        try {
            return await ipc.invoke('secrets:set-deepinfra-key', { key });
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] set-deepinfra-key failed', err);
            return { ok: false, error: 'ipc_error' };
        }
    },

    /** @returns {Promise<boolean>} True when a DeepInfra key is stored. */
    async hasDeepInfraKey() {
        const ipc = _ipc();
        if (!ipc) return false;
        try {
            const res = await ipc.invoke('secrets:has-deepinfra-key');
            return !!res?.has;
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] has-deepinfra-key failed', err);
            return false;
        }
    },

    /** @returns {Promise<{ok: boolean}>} */
    async clearDeepInfraKey() {
        const ipc = _ipc();
        if (!ipc) return { ok: false };
        try {
            return await ipc.invoke('secrets:clear-deepinfra-key');
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] clear-deepinfra-key failed', err);
            return { ok: false };
        }
    },

    /**
     * Encrypts and stores the per-Pod Cubric wrapper token in the main process.
     * Write-only from the renderer (no get channel — the server resolves it via
     * the fork bridge, keyed by podId). Used by Phase 4 in-app Pod-create.
     * @param {string} token
     * @param {string} podId
     * @returns {Promise<{ok: boolean, reason?: string}>}
     */
    async setWrapperToken(token, podId) {
        const ipc = _ipc();
        if (!ipc) return { ok: false, reason: 'ipc_unavailable' };
        try {
            return await ipc.invoke('secrets:set-wrapper-token', { token, podId });
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] set-wrapper-token failed', err);
            return { ok: false, reason: 'ipc_error' };
        }
    },

    /** @returns {Promise<{ok: boolean}>} */
    async clearWrapperToken() {
        const ipc = _ipc();
        if (!ipc) return { ok: false };
        try {
            return await ipc.invoke('secrets:clear-wrapper-token');
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] clear-wrapper-token failed', err);
            return { ok: false };
        }
    },

    // ── Endpoint profiles: the shared LLM connection (MPI-774) ───────────────
    // Keys follow the same write-only contract: set / has / clear, no get.
    // The forked server reads the key over the fork bridge. The deepinfra preset
    // reuses the existing DeepInfra slot — a user never enters the same key twice.

    /**
     * Returns all profiles (presets + user-saved) without keys.
     * @returns {Promise<Array<{id,name,baseURL}>>}
     */
    async listEndpointProfiles() {
        const ipc = _ipc();
        if (!ipc) return [];
        try {
            const res = await ipc.invoke('secrets:list-endpoint-profiles');
            return res?.profiles || [];
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] list-endpoint-profiles failed', err);
            return [];
        }
    },

    /**
     * Saves (creates or overwrites) a profile.
     * @param {{id,name,baseURL}} profile
     * @returns {Promise<{ok:boolean,reason?:string}>}
     */
    async saveEndpointProfile(profile) {
        const ipc = _ipc();
        if (!ipc) return { ok: false, error: 'ipc_unavailable' };
        try {
            return await ipc.invoke('secrets:save-endpoint-profile', profile);
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] save-endpoint-profile failed', err);
            return { ok: false, error: 'ipc_error' };
        }
    },

    /**
     * Deletes a profile and its key.
     * @param {string} profileId
     * @returns {Promise<{ok:boolean}>}
     */
    async deleteEndpointProfile(profileId) {
        const ipc = _ipc();
        if (!ipc) return { ok: false };
        try {
            return await ipc.invoke('secrets:delete-endpoint-profile', { profileId });
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] delete-endpoint-profile failed', err);
            return { ok: false };
        }
    },

    /**
     * Encrypts and stores the key for a profile, bound to its current base URL.
     * @param {string} profileId
     * @param {string} key
     * @returns {Promise<{ok:boolean,weakEncryption?:boolean,error?:string}>}
     */
    async setEndpointKey(profileId, key) {
        const ipc = _ipc();
        if (!ipc) return { ok: false, error: 'ipc_unavailable' };
        try {
            return await ipc.invoke('secrets:set-endpoint-key', { profileId, key });
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] set-endpoint-key failed', err);
            return { ok: false, error: 'ipc_error' };
        }
    },

    /**
     * @param {string} profileId
     * @returns {Promise<boolean>} True when a key is stored for this profile.
     */
    async hasEndpointKey(profileId) {
        const ipc = _ipc();
        if (!ipc) return false;
        try {
            const res = await ipc.invoke('secrets:has-endpoint-key', { profileId });
            return !!res?.has;
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] has-endpoint-key failed', err);
            return false;
        }
    },

    /**
     * @param {string} profileId
     * @returns {Promise<{ok:boolean}>}
     */
    async clearEndpointKey(profileId) {
        const ipc = _ipc();
        if (!ipc) return { ok: false };
        try {
            return await ipc.invoke('secrets:clear-endpoint-key', { profileId });
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] clear-endpoint-key failed', err);
            return { ok: false };
        }
    },

    /** @returns {Promise<{available: boolean, platform: string}>} */
    async encryptionStatus() {
        const ipc = _ipc();
        if (!ipc) return { available: false, platform: 'browser' };
        try {
            return await ipc.invoke('secrets:encryption-status');
        } catch (err) {
            clientLogger.error('settings', '[secretsClient] encryption-status failed', err);
            return { available: false, platform: 'unknown' };
        }
    },
};
