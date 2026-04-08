const fs = require('fs');
const path = require('path');
const { readRef, writeHEAD } = require('../lib/refs');
const { readObject } = require('../lib/objects');
const { writeIndex } = require('../lib/index');

const IGNORE = ['.vcs', '.git', 'node_modules', 'package-lock.json'];

/**
 * Parse a tree object's content into a { filename -> blobHash } map.
 * Tree entries are stored as "100644 <n>\0<hash>" lines.
 */
function parseTree(treeContent) {
    const map = {};
    for (const line of treeContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const nullIdx = trimmed.indexOf('\0');
        if (nullIdx === -1) continue;
        const namePart = trimmed.slice(trimmed.indexOf(' ') + 1, nullIdx);
        const hashPart = trimmed.slice(nullIdx + 1);
        map[namePart] = hashPart;
    }
    return map;
}

/**
 * Recursively collect all non-ignored files under a directory.
 */
function getWorkingFiles(dir) {
    dir = dir || '.';
    const results = [];
    for (const entry of fs.readdirSync(dir)) {
        if (IGNORE.includes(entry)) continue;
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) {
            results.push.apply(results, getWorkingFiles(full));
        } else {
            results.push(full.replace(/\\/g, '/'));
        }
    }
    return results;
}

function checkout(args) {
    const targetBranch = args[0];

    if (!targetBranch) {
        console.error('Usage: vcs checkout <branch>');
        return;
    }

    // 1. Resolve target commit hash from branch ref
    const targetCommitHash = readRef(targetBranch);
    if (!targetCommitHash) {
        console.error('Branch not found: ' + targetBranch);
        return;
    }

    // 2. Read target commit to get tree hash
    const commitObj = readObject(targetCommitHash);
    const treeHashMatch = commitObj.content.match(/^tree ([a-f0-9]+)/m);
    if (!treeHashMatch) {
        console.error('Corrupt commit: missing tree');
        return;
    }
    const treeHash = treeHashMatch[1];
    const treeObj = readObject(treeHash);
    const targetFiles = parseTree(treeObj.content);

    // 3. Remove working-tree files that are NOT in the target tree
    const currentFiles = getWorkingFiles('.');
    for (var i = 0; i < currentFiles.length; i++) {
        const f = currentFiles[i];
        const normalised = f.replace(/^\.\//, '');
        if (!(normalised in targetFiles) && !(f in targetFiles)) {
            fs.rmSync(f, { force: true });
        }
    }

    // 4. Write every file from the target tree to disk
    const entries = Object.entries(targetFiles);
    for (var j = 0; j < entries.length; j++) {
        const filePath = entries[j][0];
        const blobHash = entries[j][1];
        const blobObj = readObject(blobHash);
        const dir = path.dirname(filePath);
        if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, blobObj.content, 'utf-8');
    }

    // 5. Update the index to exactly match the target tree
    writeIndex(targetFiles);

    // 6. Point HEAD at the target branch
    writeHEAD('ref: refs/heads/' + targetBranch);

    console.log("Switched to branch '" + targetBranch + "'");
}

module.exports = checkout;