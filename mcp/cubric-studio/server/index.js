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
 * ponytail: when the app is closed every request fails with an error that says so. A client
 * that started before the app has no tools until it reconnects; the plan's phase 2 decides
 * whether to answer initialize locally and send tools/list_changed.
 */

const http = require('node:http');
const readline = require('node:readline');

const PORT = Number(process.env.CUBRIC_PORT) || 3000;
const CLOSED = 'Cubric Studio is not running. Ask the user to open the Cubric Studio app, then try again.';

const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);

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
    let id;
    try { id = JSON.parse(line).id; } catch { return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
    try {
        const body = await post(line);
        if (body) process.stdout.write(`${body.trim()}\n`);
    } catch (err) {
        process.stderr.write(`cubric-studio bridge: ${err.message}\n`);
        if (id !== undefined) send({ jsonrpc: '2.0', id, error: { code: -32000, message: CLOSED } });
    }
});
