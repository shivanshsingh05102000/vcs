const { buildTree, buildCommit, readObject } = require('../lib/objects');

// first make a tree
const treeHash = buildTree({ 'app.js': 'a3f2d1e9abc123' });

// first commit — no parent
const commitHash = buildCommit({
    treeHash,
    parentHash: null,
    message: 'initial commit',
    author: 'You'
});

const result = readObject(commitHash);
console.log(result.type);    // commit
console.log(result.content); // tree abc123... \n author You \n\n initial commit