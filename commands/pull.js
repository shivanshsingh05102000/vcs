'use strict';
 
const fs   = require('fs');
const path = require('path');
 
const { readObject }        = require('../lib/objects');
const { readRef, writeRef, readHEAD } = require('../lib/refs');
const checkout              = require('./checkout');
const fetch                 = require('./fetch');
 
function isAncestor(ancestorHash, descendantHash) {
    let cur = descendantHash;
    const seen = new Set();
    while (cur && !seen.has(cur)) {
        if (cur === ancestorHash) return true;
        seen.add(cur);
        let obj;
        try { obj = readObject(cur); } catch { break; }
        const m = obj.content.match(/^parent ([a-f0-9]+)/m);
        cur = m ? m[1] : null;
    }
    return false;
}
 
async function pull(args) {
    const remoteName = (args && args[0]) || 'origin';
    const branchArg  = args && args[1];
 
    // Resolve current branch
    const head = readHEAD();
    const currentBranch = head.startsWith('ref:')
        ? head.replace('ref: refs/heads/', '').trim()
        : null;
    const branch = branchArg || currentBranch;
 
    if (!branch) {
        console.error('pull: detached HEAD — specify a branch explicitly');
        return;
    }
 
    // 1. Fetch
    await fetch([remoteName]);
 
    // 2. Read remote-tracking ref
    const remoteRefPath = path.join('.vcs', 'refs', 'remotes', remoteName, branch);
    if (!fs.existsSync(remoteRefPath)) {
        console.error(`pull: no remote-tracking ref for ${remoteName}/${branch}`);
        return;
    }
    const remoteHash = fs.readFileSync(remoteRefPath, 'utf-8').trim();
    const localHash  = readRef(branch);
 
    if (localHash === remoteHash) {
        console.log('Already up-to-date');
        return;
    }
 
    // 3. Fast-forward check
    if (localHash && !isAncestor(localHash, remoteHash)) {
        console.error(
            `pull: branches have diverged.\n` +
            `  local:  ${localHash.slice(0, 7)}\n` +
            `  remote: ${remoteHash.slice(0, 7)}\n` +
            `Merge manually: vcs merge ${remoteName}/${branch}`
        );
        return;
    }
 
    // 4. Fast-forward — update local ref + check out new tree
    writeRef(branch, remoteHash);
    checkout([branch]);
 
    const msg = localHash
        ? `Fast-forward ${localHash.slice(0, 7)}..${remoteHash.slice(0, 7)}`
        : `Branch '${branch}' set up to track ${remoteName}/${branch}`;
    console.log(msg);
}
 
module.exports = pull;