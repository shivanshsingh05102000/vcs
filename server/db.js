'use strict';

const fs      = require('fs');
const path    = require('path');
const Database = require('better-sqlite3');

const DATABASE_PATH = process.env.DATABASE_PATH
    || path.join(__dirname, '..', 'data', 'vcs.db');

let _db = null;

// ── init ──────────────────────────────────────────────────────────────────────

function initDb() {
    if (_db) return _db;

    // For file-based DB, make sure the directory exists
    if (DATABASE_PATH !== ':memory:') {
        fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
    }

    _db = new Database(DATABASE_PATH);
    _db.pragma('journal_mode = WAL');   // safe concurrent reads
    _db.pragma('foreign_keys = ON');

    _db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            username   TEXT    NOT NULL UNIQUE,
            token      TEXT    NOT NULL UNIQUE,
            created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS repos (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL UNIQUE,
            owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS objects (
            hash       TEXT    PRIMARY KEY,
            type       TEXT    NOT NULL CHECK (type IN ('blob','tree','commit')),
            content    BLOB    NOT NULL,
            repo_id    INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
            created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_objects_repo ON objects(repo_id);

        CREATE TABLE IF NOT EXISTS refs (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            repo_id    INTEGER NOT NULL REFERENCES repos(id) ON DELETE CASCADE,
            name       TEXT    NOT NULL,
            hash       TEXT    NOT NULL,
            updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
            UNIQUE (repo_id, name)
        );

        CREATE INDEX IF NOT EXISTS idx_refs_repo ON refs(repo_id);
    `);

    return _db;
}

function db() {
    if (!_db) throw new Error('DB not initialised — call initDb() first');
    return _db;
}

// ── low-level helpers ─────────────────────────────────────────────────────────

function query(sql, params) {
    return db().prepare(sql).all(params || []);
}

function queryOne(sql, params) {
    return db().prepare(sql).get(params || []);
}

function run(sql, params) {
    const info = db().prepare(sql).run(params || []);
    return { changes: info.changes };
}

// ── domain helpers ────────────────────────────────────────────────────────────

function getRepo(name) {
    return queryOne('SELECT * FROM repos WHERE name = ?', [name]);
}

function getUserByToken(token) {
    return queryOne('SELECT * FROM users WHERE token = ?', [token]);
}

/**
 * Atomic compare-and-swap ref update.
 * expectedHash = null  → create new ref (first push)
 * expectedHash = <sha> → update only if current value matches
 * Returns true on success, false on conflict.
 */
function casRef(repoId, refName, expectedHash, newHash) {
    if (expectedHash === null) {
        try {
            run('INSERT INTO refs (repo_id, name, hash) VALUES (?, ?, ?)',
                [repoId, refName, newHash]);
            return true;
        } catch {
            return false;
        }
    }
    const result = run(
        `UPDATE refs SET hash = ?, updated_at = datetime('now')
         WHERE repo_id = ? AND name = ? AND hash = ?`,
        [newHash, repoId, refName, expectedHash]
    );
    return result.changes === 1;
}

module.exports = { initDb, db, query, queryOne, run, getRepo, getUserByToken, casRef };