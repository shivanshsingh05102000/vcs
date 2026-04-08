/**
 * test/server.test.js — P1 smoke tests (better-sqlite3 edition)
 */

'use strict';

process.env.DATABASE_PATH = ':memory:';

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
}
function assert(cond, msg)   { if (!cond)  throw new Error(msg || 'assertion failed'); }
function assertEqual(a, b)   { if (a !== b) throw new Error(`expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

async function main() {

    // ── DB schema ─────────────────────────────────────────────────────────────
    console.log('\n🗄️  db schema');

    const { initDb, db, query, queryOne, run, getRepo, getUserByToken, casRef } = require('../server/db');
    initDb();

    test('db initialises without error', () => {
        assert(db(), 'db() returned falsy');
    });

    test('users table exists', () => {
        const row = queryOne("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
        assert(row, 'users table missing');
    });

    test('repos table exists', () => {
        const row = queryOne("SELECT name FROM sqlite_master WHERE type='table' AND name='repos'");
        assert(row, 'repos table missing');
    });

    test('objects table exists', () => {
        const row = queryOne("SELECT name FROM sqlite_master WHERE type='table' AND name='objects'");
        assert(row, 'objects table missing');
    });

    test('refs table exists', () => {
        const row = queryOne("SELECT name FROM sqlite_master WHERE type='table' AND name='refs'");
        assert(row, 'refs table missing');
    });

    // ── CAS ───────────────────────────────────────────────────────────────────
    console.log('\n🔀 compare-and-swap ref');

    run('INSERT INTO users (username, token) VALUES (?, ?)', ['testuser', 'testtoken123']);
    const user = getUserByToken('testtoken123');
    run('INSERT INTO repos (name, owner_id) VALUES (?, ?)', ['testrepo', user.id]);
    const repo = getRepo('testrepo');

    test('casRef creates new ref when oldHash is null', () => {
        const ok = casRef(repo.id, 'main', null, 'abc123');
        assert(ok, 'casRef returned false');
        const row = queryOne('SELECT hash FROM refs WHERE repo_id=? AND name=?', [repo.id, 'main']);
        assertEqual(row.hash, 'abc123');
    });

    test('casRef updates ref when oldHash matches', () => {
        const ok = casRef(repo.id, 'main', 'abc123', 'def456');
        assert(ok, 'casRef returned false');
        const row = queryOne('SELECT hash FROM refs WHERE repo_id=? AND name=?', [repo.id, 'main']);
        assertEqual(row.hash, 'def456');
    });

    test('casRef rejects update when oldHash is stale', () => {
        const ok = casRef(repo.id, 'main', 'stale000', 'new999');
        assert(!ok, 'casRef should return false for stale oldHash');
        const row = queryOne('SELECT hash FROM refs WHERE repo_id=? AND name=?', [repo.id, 'main']);
        assertEqual(row.hash, 'def456'); // unchanged
    });

    test('casRef rejects duplicate new-ref creation', () => {
        const ok = casRef(repo.id, 'main', null, 'another');
        assert(!ok, 'casRef should reject inserting an already-existing ref');
    });

    // ── remote config ─────────────────────────────────────────────────────────
    console.log('\n🌐 remote config');

    const os   = require('os');
    const path = require('path');
    const fs   = require('fs');

    const orig   = process.cwd();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vcs-remote-'));
    process.chdir(tmpDir);
    fs.mkdirSync('.vcs');

    const { readConfig, writeConfig } = require('../commands/remote');

    test('readConfig returns {} when no config file', () => {
        assertEqual(JSON.stringify(readConfig()), '{}');
    });

    test('writeConfig + readConfig roundtrip', () => {
        writeConfig({ remotes: { origin: 'http://localhost:3000/repos/test' } });
        const cfg = readConfig();
        assertEqual(cfg.remotes.origin, 'http://localhost:3000/repos/test');
    });

    process.chdir(orig);
    fs.rmSync(tmpDir, { recursive: true });

    // ── summary ───────────────────────────────────────────────────────────────
    console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });