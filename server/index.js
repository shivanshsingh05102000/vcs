'use strict';
 
const express  = require('express');
const crypto   = require('crypto');
const { initDb, query, queryOne, run, getRepo, casRef } = require('./db');
const { requireAuth } = require('./auth');
 
const app = express();
app.use(express.json());
 
// ── health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ts: new Date().toISOString() });
});
 
// ── users ─────────────────────────────────────────────────────────────────────
app.post('/users', (req, res) => {
    const { username } = req.body || {};
    if (!username || typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({ error: 'username is required' });
    }
 
    const existing = queryOne('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existing) return res.status(409).json({ error: 'Username already taken' });
 
    const token = crypto.randomBytes(32).toString('hex');
    run('INSERT INTO users (username, token) VALUES (?, ?)', [username.trim(), token]);
    const user = queryOne('SELECT * FROM users WHERE token = ?', [token]);
    res.status(201).json({ id: user.id, username: user.username, token });
});
 
// ── repos ─────────────────────────────────────────────────────────────────────
app.post('/repos', requireAuth, (req, res) => {
    const { name } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name is required' });
    }
 
    const existing = getRepo(name.trim());
    if (existing) return res.status(409).json({ error: 'Repo already exists' });
 
    run('INSERT INTO repos (name, owner_id) VALUES (?, ?)', [name.trim(), req.user.id]);
    const repo = getRepo(name.trim());
    res.status(201).json({ id: repo.id, name: repo.name, created_at: repo.created_at });
});
 
// ── objects ───────────────────────────────────────────────────────────────────
app.post('/repos/:name/objects', requireAuth, (req, res) => {
    const repo = getRepo(req.params.name);
    if (!repo) return res.status(404).json({ error: 'Repo not found' });
 
    const { hash, type, content } = req.body || {};
    if (!hash || !type || content === undefined) {
        return res.status(400).json({ error: 'hash, type, and content are required' });
    }
    const VALID_TYPES = ['blob', 'tree', 'commit'];
    if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
 
    const existing = queryOne('SELECT hash FROM objects WHERE hash = ?', [hash]);
    if (existing) return res.json({ hash, stored: false });
 
    run('INSERT INTO objects (hash, type, content, repo_id) VALUES (?, ?, ?, ?)',
        [hash, type, content, repo.id]);
    res.status(201).json({ hash, stored: true });
});
 
app.get('/repos/:name/objects/:hash', (req, res) => {
    const repo = getRepo(req.params.name);
    if (!repo) return res.status(404).json({ error: 'Repo not found' });
 
    const obj = queryOne(
        'SELECT hash, type, content FROM objects WHERE hash = ?',
        [req.params.hash]
    );
    if (!obj) return res.status(404).json({ error: 'Object not found' });
    res.json(obj);
});
 
// ── refs ──────────────────────────────────────────────────────────────────────
app.get('/repos/:name/refs', (req, res) => {
    const repo = getRepo(req.params.name);
    if (!repo) return res.status(404).json({ error: 'Repo not found' });
 
    const rows = query('SELECT name, hash FROM refs WHERE repo_id = ?', [repo.id]);
    const refs = {};
    for (const row of rows) refs[row.name] = row.hash;
    res.json(refs);
});
 
app.post('/repos/:name/refs', requireAuth, (req, res) => {
    const repo = getRepo(req.params.name);
    if (!repo) return res.status(404).json({ error: 'Repo not found' });
 
    const { ref, oldHash, newHash } = req.body || {};
    if (!ref || !newHash) {
        return res.status(400).json({ error: 'ref and newHash are required' });
    }
 
    const ok = casRef(repo.id, ref, oldHash ?? null, newHash);
    if (!ok) {
        return res.status(409).json({
            error: 'Ref update rejected — remote has moved ahead. Pull first.'
        });
    }
    res.json({ ref, hash: newHash });
});
 
// ── error handler ─────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});
 
// ── start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
 
if (require.main === module) {
    initDb();
    app.listen(PORT, () => {
        console.log(`VCS server listening on http://localhost:${PORT}`);
    });
}
 
module.exports = { app, initDb };