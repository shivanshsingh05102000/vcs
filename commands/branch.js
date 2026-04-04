const { readRef, readHEAD, writeRef } = require('../lib/refs');

function branch(args) {
    const name = args[0];

    if (!name) {
        console.error('Usage: vcs branch <name>');
        return;
    }

    // 1. get current commit hash
    const head = readHEAD();
    const currentBranch = head.replace('ref: refs/heads/', '');
    const commitHash = readRef(currentBranch);

    if (!commitHash) {
        console.error('No commits yet');
        return;
    }

    // 2. create new branch pointing to same commit
    writeRef(name, commitHash);
    console.log(`Created branch '${name}' at ${commitHash.slice(0, 7)}`);
}

module.exports = branch;