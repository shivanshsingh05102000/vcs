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