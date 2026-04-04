const fs = require('fs');
const { readObject } = require('../lib/objects');
const { writeIndex } = require('../lib/index');
const { writeHEAD, readRef } = require('../lib/refs');

function checkout(args) {
    const target = args[0];

    if (!target) {
        console.error('Usage: vcs checkout <branch|hash>');
        return;
    }

    // check if target is a branch name first
    const branchHash = readRef(target);
    const commitHash = branchHash || target;

    let commit;
    try {
        commit = readObject(commitHash);
    } catch (e) {
        console.error(`Not a valid branch or commit hash: ${target}`);
        return;
    }

    if (commit.type !== 'commit') {
        console.error('Not a valid commit');
        return;
    }

    const treeLine = commit.content.split('\n').find(l => l.startsWith('tree'));
    const treeHash = treeLine.split(' ')[1];
    const tree = readObject(treeHash);

    const newIndex = {};
    tree.content.split('\n').forEach(entry => {
        const [meta, blobHash] = entry.split('\0');
        const filename = meta.split(' ')[1];
        const blob = readObject(blobHash);
        // content is always a string now (fixed in objects.js)
        fs.writeFileSync(filename, blob.content, 'utf-8');
        newIndex[filename] = blobHash;
    });

    writeIndex(newIndex);

    if (branchHash) {
        writeHEAD(`ref: refs/heads/${target}`);
        console.log(`Switched to branch '${target}'`);
    } else {
        writeHEAD(commitHash);
        console.log(`Checked out ${commitHash.slice(0, 7)}`);
    }
}

module.exports = checkout;
