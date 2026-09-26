#!/usr/bin/env node
'use strict';

/**
 * Cubric Studio MCP bridge — stdio in, the app's own MCP endpoint out (MPI-593).
 *
 * Claude Desktop extensions speak stdio only, and the app serves MCP over HTTP at
 * http://127.0.0.1:<port>/mcp (routes/mcp.js). This file is the whole bridge: one JSON-RPC
 * message per line on stdin, POSTed as-is, the answer written back as one line. Every tool
 * lives in the app, so this never needs updating when the tools change.
 *
 * `node:http`, not fetch: fetch gives up after 300 s of waiting for headers, and a video
 * generation holds its answer for longer than that (services/agentTools.mjs `_post`).
 *
 * The app closed (MPI-593 phase 2, item 5): Claude Desktop starts this with the computer, often
 * before the app. So a closed app is answered HERE instead of failing the handshake: initialize
 * succeeds, tools/list offers `status` alone, and a call says to open the app. Once the app
 * answers, `notifications/tools/list_changed` makes the client fetch the real list, with no
 * reconnect. ponytail: the list is only re-announced for an app that came up AFTER a closed
 * answer; an app upgraded while the client ran keeps its old list until the client reconnects.
 */

const http = require('node:http');
const readline = require('node:readline');

const PORT = Number(process.env.CUBRIC_PORT) || 3000;
const POLL_MS = Number(process.env.CUBRIC_BRIDGE_POLL_MS) || 5_000;
const CLOSED = 'Cubric Studio is not running. Ask the user to open the Cubric Studio app, then try again.';
const STATUS = {
    name: 'status', title: 'App status',
    description: 'Is Cubric Studio open? It is not right now: ask the user to open it. Its tools appear once it is.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { title: 'App status', readOnlyHint: true, openWorldHint: false },
};

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);

/** What a closed app would have answered, or undefined for "no answer, report the error". */
function closedAnswer(msg) {
    switch (msg.method) {
        case 'initialize':
            return {
                protocolVersion: msg.params?.protocolVersion || '2025-06-18',
                capabilities: { tools: { listChanged: true } },
                serverInfo: { name: 'cubric-studio', title: 'Cubric Studio', version: '0.0.0' },
                instructions: CLOSED,
            };
        case 'ping': return {};
        case 'tools/list': return { tools: [STATUS] };
        case 'tools/call': return { isError: true, content: [{ type: 'text', text: CLOSED }] };
        default: return undefined;
    }
}

// Set when a closed answer went out; cleared, with list_changed sent, when the app answers.
let poll = null;
function watchForApp() {
    poll ??= setInterval(() => {
        post('{"jsonrpc":"2.0","id":"bridge-ping","method":"ping"}').then(() => {
            clearInterval(poll);
            poll = null;
            send({ jsonrpc: '2.0', method: 'notifications/tools/list_changed' });
        }, () => {});
    }, POLL_MS).unref(); // stdin keeps the bridge alive; the client closing it must still end it
}

function post(line) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            host: '127.0.0.1', port: PORT, path: '/mcp', method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { body += c; });
            res.on('end', () => resolve(body));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.end(line);
    });
}

readline.createInterface({ input: process.stdin }).on('line', async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
    try {
        const body = await post(line);
        if (body) process.stdout.write(`${body.trim()}\n`);
    } catch (err) {
        process.stderr.write(`cubric-studio bridge: ${err.message}\n`);
        if (msg.id === undefined) return;
        const result = closedAnswer(msg);
        watchForApp();
        send(result ? { jsonrpc: '2.0', id: msg.id, result } : { jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: CLOSED } });
    }
});
