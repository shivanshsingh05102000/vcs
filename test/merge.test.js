const { findLCA, mergeFiles } = require('../lib/merge');
const { readRef } = require('../lib/refs');

// LCA test
const mainHash = readRef('main');
const featureHash = readRef('feature');
console.log('main:   ', mainHash.slice(0,7));
console.log('feature:', featureHash.slice(0,7));
console.log('LCA:    ', findLCA(mainHash, featureHash)?.slice(0,7));

// clean merge test
const base = `hello\nworld\nfoo`;
const ours = `hello\nearth\nfoo`;
const theirs = `hello\nworld\nfoobar`;
const result = mergeFiles(base, ours, theirs);
console.log('\nhasConflicts:', result.hasConflicts);
console.log('merged content:');
console.log(result.content);

// conflict test
const base2 = `hello\nworld\nfoo`;
const ours2 = `hello\nearth\nfoo`;
const theirs2 = `hello\nmars\nfoo`;
const result2 = mergeFiles(base2, ours2, theirs2);
console.log('\nhasConflicts:', result2.hasConflicts);
console.log('merged content:');
console.log(result2.content);