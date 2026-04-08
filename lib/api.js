'use strict';
 
const https = require('https');
const http  = require('http');
const { readConfig } = require('../commands/remote');
 
// ── low-level request ─────────────────────────────────────────────────────────
 
/**
 * Make an HTTP/HTTPS request.
 * Returns a Promise<{ status, body }> where body is already JSON-parsed.
 */
function request(method, url, body, token) {
    return new Promise((resolve, reject) => {
        const parsed   = new URL(url);
        const isHttps  = parsed.protocol === 'https:';
        const lib      = isHttps ? https : http;
        const payload  = body ? JSON.stringify(body) : null;
 
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
 
        const opts = {
            hostname : parsed.hostname,
            port     : parsed.port || (isHttps ? 443 : 80),
            path     : parsed.pathname + parsed.search,
            method,
            headers,
        };
 
        const req = lib.request(opts, res => {
            let raw = '';
            res.on('data', chunk => { raw += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: JSON.parse(raw) });
                } catch {
                    resolve({ status: res.statusCode, body: raw });
                }
            });
        });
 
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}
 
// ── helpers that read config automatically ────────────────────────────────────
 
function getToken() {
    const cfg = readConfig();
    return (cfg.user && cfg.user.token) || null;
}
 
function getRemoteUrl(remoteName) {
    const cfg = readConfig();
    return cfg.remotes && cfg.remotes[remoteName || 'origin'];
}
 
async function get(url)               { return request('GET',  url, null,  getToken()); }
async function post(url, body)        { return request('POST', url, body,  getToken()); }
async function postAnon(url, body)    { return request('POST', url, body,  null); }
 
module.exports = { request, get, post, postAnon, getToken, getRemoteUrl };