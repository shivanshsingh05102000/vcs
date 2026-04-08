const fs = require('fs');
const { readObject, writeObject, buildCommit } = require('../lib/objects');
const { writeIndex } = require('../lib/index');
const { readRef, readHEAD, writeRef } = require('../lib/refs');
const { findLCA, mergeFiles } = require('../lib/merge');

function merge(args) {
    const targetBranch = args[0];
    if (!targetBranch) {
        console.error('Usage: vcs merge <branch>');
        return;
    }

    const head = readHEAD();
    const currentBranch = head.replace('ref: refs/heads/', '');
    const currentHash = readRef(currentBranch);
    const targetHash = readRef(targetBranch);

    if (!targetHash) {
        console.error(`Branch '${targetBranch}' not found`);
        return;
    }

    if (currentHash === targetHash) {
        console.log('Already up to date');
        return;
    }

    // fast-forward check
    let hash = targetHash;
    while (hash) {
        if (hash === currentHash) {
            writeRef(currentBranch, targetHash);
            console.log(`Fast-forward: ${currentHash.slice(0, 7)} → ${targetHash.slice(0, 7)}`);
            return;
        }
        const commit = readObject(hash);
        const parentLine = commit.content.split('\n').find(l => l.startsWith('parent'));
        hash = parentLine ? parentLine.split(' ')[1] : null;
    }

    // 3-way merge
    const lcaHash = findLCA(currentHash, targetHash);
    if (!lcaHash) {
        console.error('No common ancestor found');
        return;
    }

    const getTree = (commitHash) => {
        const commit = readObject(commitHash);
        const treeLine = commit.content.split('\n').find(l => l.startsWith('tree'));
        const treeHash = treeLine.split(' ')[1];
        const tree = readObject(treeHash);
        const map = {};
        tree.content.split('\n').forEach(entry => {
            const [meta, blobHash] = entry.split('\0');
            const filename = meta.split(' ')[1];
            map[filename] = blobHash;
        });
        return map;
    };

    const getFileContent = (blobHash) => {
        if (!blobHash) return '';
        const blob = readObject(blobHash);
        // content is always a string now (fixed in objects.js)
        return String(blob.content);
    };

    const baseTree = getTree(lcaHash);
    const oursTree = getTree(currentHash);
    const theirsTree = getTree(targetHash);

    const allFiles = new Set([
        ...Object.keys(baseTree),
        ...Object.keys(oursTree),
        ...Object.keys(theirsTree)
    ]);

    let hasConflicts = false;
    const newIndex = {};

    for (const file of allFiles) {
        const baseContent = getFileContent(baseTree[file]);
        const oursContent = getFileContent(oursTree[file]);
        const theirsContent = getFileContent(theirsTree[file]);

        const result = mergeFiles(baseContent, oursContent, theirsContent);

        fs.writeFileSync(file, result.content, 'utf-8');

        if (result.hasConflicts) {
            hasConflicts = true;
            console.log(`CONFLICT: ${file}`);
            // don't stage the conflict-marker version — leave it unstaged
            // so the user resolves it then runs: vcs add <file> && vcs commit
            if (oursTree[file]) newIndex[file] = oursTree[file];
        } else {
            newIndex[file] = writeObject('blob', result.content);
        }
    }

    writeIndex(newIndex);

    if (hasConflicts) {
        console.log('\nFix conflicts then run: vcs commit -m "merge commit"');
    } else {
        console.log(`Merged '${targetBranch}' into '${currentBranch}'`);
    }
}

module.exports = merge;