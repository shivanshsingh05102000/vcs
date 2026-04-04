const { buildTree, buildCommit } = require('../lib/objects');
const { readIndex } = require('../lib/index');
const { readRef, writeRef, readHEAD } = require('../lib/refs');

function commit(args) {
    const messageIndex = args.indexOf('-m');
    const message = args[messageIndex + 1];

    if (!message) {
        console.error('Usage: vcs commit -m "message"');
        return;
    }

    const index = readIndex();
    if (Object.keys(index).length === 0) {
        console.error('Nothing to commit');
        return;
    }

    const treeHash = buildTree(index);

    const head = readHEAD();
    const branch = head.replace('ref: refs/heads/', '');
    const parentHash = readRef(branch); // null on first commit

    const commitHash = buildCommit({ treeHash, parentHash, message, author: 'You' });

    writeRef(branch, commitHash);
    console.log(`Committed: ${commitHash.slice(0, 7)} - ${message}`);

}

module.exports = commit;


