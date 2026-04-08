const assert = require('assert');
const { diffLines } = require('../lib/diff');
const { mergeFiles } = require('../lib/merge');
const { hashObject, writeObject, readObject, buildTree, buildCommit } = require('../lib/objects');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`  ❌ ${name}`);
        console.log(`     ${e.message}`);
        failed++;
    }
}

// ─── diff tests ───────────────────────────────────────────────────────────────
console.log('\n📄 diff');

test('no changes returns empty', () => {
    const result = diffLines('hello\nworld', 'hello\nworld');
    assert.strictEqual(result.length, 0);
});

test('detects added line', () => {
    const result = diffLines('hello', 'hello\nworld');
    assert.ok(result.some(c => c.type === 'add'));
});

test('detects removed line', () => {
    const result = diffLines('hello\nworld', 'hello');
    assert.ok(result.some(c => c.type === 'remove'));
});

test('detects modified line', () => {
    const result = diffLines('hello\nworld', 'hello\nearth');
    assert.ok(result.some(c => c.type === 'modify'));
});

// ─── merge tests ──────────────────────────────────────────────────────────────
console.log('\n🔀 merge');

test('clean merge — no conflicts', () => {
    const base  = 'hello\nworld\nfoo';
    const ours  = 'hello\nearth\nfoo';
    const theirs = 'hello\nworld\nfoobar';
    const result = mergeFiles(base, ours, theirs);
    assert.strictEqual(result.hasConflicts, false);
});

test('conflict detected when both sides change same line', () => {
    const base  = 'hello\nworld\nfoo';
    const ours  = 'hello\nearth\nfoo';
    const theirs = 'hello\nmars\nfoo';
    const result = mergeFiles(base, ours, theirs);
    assert.strictEqual(result.hasConflicts, true);
});

test('conflict output contains markers', () => {
    const base  = 'hello\nworld';
    const ours  = 'hello\nearth';
    const theirs = 'hello\nmars';
    const result = mergeFiles(base, ours, theirs);
    assert.ok(result.content.includes('<<<<<<<'));
    assert.ok(result.content.includes('>>>>>>>'));
});

test('identical change on both sides — no conflict', () => {
    const base  = 'hello\nworld';
    const ours  = 'hello\nearth';
    const theirs = 'hello\nearth';
    const result = mergeFiles(base, ours, theirs);
    assert.strictEqual(result.hasConflicts, false);
});

// ─── objects tests ────────────────────────────────────────────────────────────
console.log('\n📦 objects');

test('hashObject returns consistent hash', () => {
    const h1 = hashObject('hello world');
    const h2 = hashObject('hello world');
    assert.strictEqual(h1, h2);
});

test('hashObject returns different hash for different content', () => {
    const h1 = hashObject('hello');
    const h2 = hashObject('world');
    assert.notStrictEqual(h1, h2);
});

test('writeObject and readObject roundtrip', () => {
    const hash = writeObject('blob', 'test content');
    const obj = readObject(hash);
    assert.strictEqual(obj.type, 'blob');
    assert.strictEqual(obj.content, 'test content');
});

test('buildTree returns a hash', () => {
    const hash = buildTree({ 'file.js': 'abc123def456' });
    assert.ok(typeof hash === 'string' && hash.length === 64);
});

test('buildCommit creates readable commit', () => {
    const treeHash = buildTree({ 'app.js': 'abc123def456' });
    const commitHash = buildCommit({ treeHash, parentHash: null, message: 'init', author: 'Test' });
    const obj = readObject(commitHash);
    assert.strictEqual(obj.type, 'commit');
    assert.ok(obj.content.includes('init'));
    assert.ok(obj.content.includes('Test'));
});

// ─── summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
// ─── P0 regression tests ──────────────────────────────────────────────────────
const fs = require('fs');
const os = require('os');
const path = require('path');

// helper: run test inside a temp vcs repo
function withRepo(fn) {
    const orig = process.cwd();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vcs-test-'));
    process.chdir(tmp);
    require('../commands/init')();
    try { fn(tmp); } finally {
        process.chdir(orig);
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

console.log('\n🔧 P0 regressions');

test('P0-1: checkout removes files not in target branch', () => {
    withRepo(() => {
        const add      = require('../commands/add');
        const commit   = require('../commands/commit');
        const branch   = require('../commands/branch');
        const checkout = require('../commands/checkout');

        // commit alpha.txt on main
        fs.writeFileSync('alpha.txt', 'alpha');
        add(['alpha.txt']);
        commit(['-m', 'add alpha']);

        // create feature branch, add beta.txt
        branch(['feature']);
        checkout(['feature']);
        fs.writeFileSync('beta.txt', 'beta');
        add(['beta.txt']);
        commit(['-m', 'add beta']);

        // go back to main — beta.txt must be gone
        checkout(['main']);
        assert.ok(!fs.existsSync('beta.txt'), 'beta.txt should be deleted on checkout to main');
        assert.ok(fs.existsSync('alpha.txt'), 'alpha.txt should still exist');
    });
});

test('P0-2: merge conflict does not stage conflict-marker blob', () => {
    withRepo(() => {
        const add    = require('../commands/add');
        const commit = require('../commands/commit');
        const branch = require('../commands/branch');
        const checkout = require('../commands/checkout');
        const merge  = require('../commands/merge');
        const { readIndex } = require('../lib/index');
        const { readObject } = require('../lib/objects');

        // base commit
        fs.writeFileSync('file.txt', 'hello\nworld\n');
        add(['file.txt']);
        commit(['-m', 'base']);

        // feature branch changes same line
        branch(['feature']);
        checkout(['feature']);
        fs.writeFileSync('file.txt', 'hello\nmars\n');
        add(['file.txt']);
        commit(['-m', 'feature change']);

        // back to main, conflicting change
        checkout(['main']);
        fs.writeFileSync('file.txt', 'hello\nearth\n');
        add(['file.txt']);
        commit(['-m', 'main change']);

        merge(['feature']);

        // index must not contain conflict markers
        const idx = readIndex();
        const blob = readObject(idx['file.txt']);
        assert.ok(!blob.content.includes('<<<<<<<'), 'index must not contain conflict markers after merge');
    });
});

test('P0-3: status detects untracked files in subdirectories', () => {
    withRepo(() => {
        fs.mkdirSync('src', { recursive: true });
        fs.writeFileSync('src/app.js', 'console.log(1)');

        // capture console output
        const lines = [];
        const orig = console.log;
        console.log = (...a) => lines.push(a.join(' '));
        require('../commands/status')();
        console.log = orig;

        const output = lines.join('\n');
        assert.ok(output.includes('src/app.js'), 'status should show src/app.js as untracked');
    });
});