const { diffLines } = require('../lib/diff');

const base = `hello\nworld\nfoo`;
const updated = `hello\nearth\nfoo\nbar`;

const changes = diffLines(base, updated);
console.log(changes);