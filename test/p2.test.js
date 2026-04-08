/**
 * test/p2.test.js — P2 integration tests (push, fetch, pull)
 *
 * Spins up the Express server in-process on a random port,
 * then exercises push/pull/fetch from a temp repo directory.
 *
 * Run: node test/p2.test.js
 */

'use strict';

process.env.DATABASE_PATH = ':memory:';

const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const http   = require('http');
const crypto = require('crypto');

// ── helpers ───────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`  ❌ ${name}`);
        console.log(`     ${e.message}`);
        failed++;
    }
}

function assert(cond, msg)  { if (!cond)  throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b)  { if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

// ── in-process server ─────────────────────────────────────────────────────────
let server, baseUrl, testToken;

async function startServer() {
    const { app, initDb } = require('../server/index');
    const { run } = require('../server/db');
    initDb();

    // Create a test user
    testToken = crypto.randomBytes(16).toString('hex');
    run('INSERT INTO users (username, token) VALUES (?, ?)', ['p2user', testToken]);

    await new Promise(resolve => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });
}

function stopServer() {
    return new Promise(resolve => server.close(resolve));
}

// ── repo fixture ──────────────────────────────────────────────────────────────
let repoDir;

function withRepo(repoName) {
    // Each call gets its own unique repo name so tests never share stale remote refs
    const name = repoName || ('repo-' + crypto.randomBytes(4).toString('hex'));
    const orig = process.cwd();
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vcs-p2-'));
    process.chdir(repoDir);

    // Re-require commands fresh in the new cwd
    // (objects.js + refs.js use relative '.vcs' paths)
    Object.keys(require.cache).forEach(k => {
        if (k.includes('commands') || k.includes('/lib/')) delete require.cache[k];
    });

    require('../commands/init')();

    // Write config with remote + token
    const cfg = {
        remotes: { origin: `${baseUrl}/repos/${name}` },
        user: { name: 'p2user', token: testToken }
    };
    fs.writeFileSync(path.join('.vcs', 'config'), JSON.stringify(cfg, null, 2));

    return { name, orig, cleanup: () => { process.chdir(orig); fs.rmSync(repoDir, { recursive: true, force: true }); } };
}

// simple HTTP POST helper (doesn't use vcs config)
async function apiPost(urlPath, body, token) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify(body);
        const opts = {
            hostname: '127.0.0.1',
            port: server.address().port,
            path: urlPath,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            }
        };
        const req = http.request(opts, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

async function apiGet(urlPath) {
    return new Promise((resolve, reject) => {
        http.get(`${baseUrl}${urlPath}`, res => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
        }).on('error', reject);
    });
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
    await startServer();

    // ── push ─────────────────────────────────────────────────────────────────
    console.log('\n📤 push');

    await test('push sends objects and updates remote ref', async () => {
        const { name, orig, cleanup } = withRepo();
        await apiPost('/repos', { name }, testToken);
        try {
            const add    = require('../commands/add');
            const commit = require('../commands/commit');
            const push   = require('../commands/push');

            fs.writeFileSync('hello.txt', 'hello world');
            add(['hello.txt']);
            commit(['-m', 'initial commit']);

            await push([]);

            // Verify remote ref was updated
            const refs = await apiGet(`/repos/${name}/refs`);
            assert(refs.body['main'], 'remote main ref should exist after push');
        } finally { cleanup(); }
    });

    await test('push is idempotent (nothing sent on second push)', async () => {
        const { name, orig, cleanup } = withRepo();
        await apiPost('/repos', { name }, testToken);
        try {
            const add    = require('../commands/add');
            const commit = require('../commands/commit');
            const push   = require('../commands/push');

            fs.writeFileSync('file.txt', 'content');
            add(['file.txt']);
            commit(['-m', 'commit']);
            await push([]);

            // second push — should print "Everything up-to-date"
            const lines = [];
            const origLog = console.log;
            console.log = (...a) => lines.push(a.join(' '));
            await push([]);
            console.log = origLog;
            assert(lines.some(l => l.includes('up-to-date')), 'expected up-to-date message');
        } finally { cleanup(); }
    });

    await test('push rejected when remote is ahead', async () => {
        const { name: rname, orig, cleanup } = withRepo();
        await apiPost('/repos', { name: rname }, testToken);
        try {
            const add    = require('../commands/add');
            const commit = require('../commands/commit');
            const push   = require('../commands/push');
            const { readRef, writeRef } = require('../lib/refs');

            fs.writeFileSync('file.txt', 'v1');
            add(['file.txt']);
            commit(['-m', 'v1']);
            await push([]);

            // Simulate remote moving ahead by pointing local branch to fake parent
            // (so local thinks remote hasn't moved, but push will find mismatch)
            // Instead: directly update the remote ref to a fake hash
            await apiPost(`/repos/${rname}/refs`,
                { ref: 'main', oldHash: readRef('main'), newHash: 'a'.repeat(64) },
                testToken
            );

            const errors = [];
            const origErr = console.error;
            console.error = (...a) => errors.push(a.join(' '));
            await push([]);
            console.error = origErr;

            assert(errors.some(l => l.includes('rejected') || l.includes('pull')),
                'expected push rejection message');
        } finally { cleanup(); }
    });

    // ── fetch ─────────────────────────────────────────────────────────────────
    console.log('\n📥 fetch');

    // Reset the remote repo for fetch tests — create fresh
    await apiPost('/repos', { name: 'fetchrepo' }, testToken);

    await test('fetch downloads objects and writes remote-tracking refs', async () => {
        // First: push something from repo A
        const { cleanup: cleanA } = withRepo();
        const add    = require('../commands/add');
        const commit = require('../commands/commit');
        const push   = require('../commands/push');

        // Point this repo at fetchrepo
        const cfg = JSON.parse(fs.readFileSync('.vcs/config'));
        cfg.remotes.origin = `${baseUrl}/repos/fetchrepo`;
        fs.writeFileSync('.vcs/config', JSON.stringify(cfg, null, 2));

        fs.writeFileSync('readme.txt', 'hello from A');
        add(['readme.txt']);
        commit(['-m', 'from A']);
        await push([]);
        const pushedHash = require('../lib/refs').readRef('main');
        cleanA();

        // Now fetch from a fresh repo B
        const { cleanup: cleanB } = withRepo();
        Object.keys(require.cache).forEach(k => {
            if (k.includes('commands') || k.includes('/lib/')) delete require.cache[k];
        });

        const cfgB = JSON.parse(fs.readFileSync('.vcs/config'));
        cfgB.remotes.origin = `${baseUrl}/repos/fetchrepo`;
        fs.writeFileSync('.vcs/config', JSON.stringify(cfgB, null, 2));

        const fetch = require('../commands/fetch');
        await fetch([]);

        // Remote-tracking ref should exist
        const trackingRef = path.join('.vcs', 'refs', 'remotes', 'origin', 'main');
        assert(fs.existsSync(trackingRef), 'remote-tracking ref not written');
        const fetchedHash = fs.readFileSync(trackingRef, 'utf-8').trim();
        assertEqual(fetchedHash, pushedHash);
        cleanB();
    });

    // ── pull ──────────────────────────────────────────────────────────────────
    console.log('\n⬇️  pull');

    await apiPost('/repos', { name: 'pullrepo' }, testToken);

    await test('pull fast-forwards local branch', async () => {
        // Push initial commit from repo A
        const { cleanup: cleanA } = withRepo();
        {
            Object.keys(require.cache).forEach(k => {
                if (k.includes('commands') || k.includes('/lib/')) delete require.cache[k];
            });
            const cfgA = JSON.parse(fs.readFileSync('.vcs/config'));
            cfgA.remotes.origin = `${baseUrl}/repos/pullrepo`;
            fs.writeFileSync('.vcs/config', JSON.stringify(cfgA, null, 2));

            const add = require('../commands/add');
            const commit = require('../commands/commit');
            const push = require('../commands/push');
            fs.writeFileSync('main.txt', 'base');
            add(['main.txt']);
            commit(['-m', 'base']);
            await push([]);
        }
        cleanA();

        // Pull into a fresh repo B
        const { cleanup: cleanB } = withRepo();
        {
            Object.keys(require.cache).forEach(k => {
                if (k.includes('commands') || k.includes('/lib/')) delete require.cache[k];
            });
            const cfgB = JSON.parse(fs.readFileSync('.vcs/config'));
            cfgB.remotes.origin = `${baseUrl}/repos/pullrepo`;
            fs.writeFileSync('.vcs/config', JSON.stringify(cfgB, null, 2));

            const pull = require('../commands/pull');
            await pull([]);

            // main.txt should now exist in working tree
            assert(fs.existsSync('main.txt'), 'main.txt should exist after pull');
            assertEqual(fs.readFileSync('main.txt', 'utf-8'), 'base');
        }
        cleanB();
    });

    await test('pull reports already up-to-date when nothing new', async () => {
        const { cleanup } = withRepo();
        try {
            Object.keys(require.cache).forEach(k => {
                if (k.includes('commands') || k.includes('/lib/')) delete require.cache[k];
            });
            const cfg = JSON.parse(fs.readFileSync('.vcs/config'));
            cfg.remotes.origin = `${baseUrl}/repos/pullrepo`;
            fs.writeFileSync('.vcs/config', JSON.stringify(cfg, null, 2));

            // pull once to sync up
            const pull = require('../commands/pull');
            await pull([]);

            // pull again — should be up to date
            const lines = [];
            const orig = console.log;
            console.log = (...a) => lines.push(a.join(' '));
            await pull([]);
            console.log = orig;

            assert(lines.some(l => l.includes('up-to-date') || l.includes('up to date')),
                'expected up-to-date message, got: ' + lines.join(' | '));
        } finally { cleanup(); }
    });

    // ── summary ───────────────────────────────────────────────────────────────
    console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
    await stopServer();
    if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });