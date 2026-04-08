'use strict';
 
const { readObject }              = require('../lib/objects');
const { readRef, readHEAD }       = require('../lib/refs');
const { collectReachable }        = require('../lib/walk');
const { get, post, getRemoteUrl } = require('../lib/api');
 
async function push(args) {
    const remoteName = args[0] || 'origin';
    const branchArg  = args[1];
 
    // 1. Resolve branch + local commit
    const head = readHEAD();
    const currentBranch = head.startsWith('ref:')
        ? head.replace('ref: refs/heads/', '').trim()
        : null;
    const branch = branchArg || currentBranch;
 
    if (!branch) {
        console.error('push: detached HEAD — specify a branch explicitly');
        return;
    }
 
    const localHash = readRef(branch);
    if (!localHash) {
        console.error(`push: branch '${branch}' has no commits`);
        return;
    }
 
    // 2. Resolve remote URL
    const remoteUrl = getRemoteUrl(remoteName);
    if (!remoteUrl) {
        console.error(`push: no remote named '${remoteName}'. Run: vcs remote add ${remoteName} <url>`);
        return;
    }
 
    // 3. GET remote refs → find server's current hash for this branch
    const refsRes = await get(`${remoteUrl}/refs`);
    if (refsRes.status !== 200) {
        console.error(`push: failed to fetch remote refs (${refsRes.status})`);
        return;
    }
    const remoteRefs   = refsRes.body;                    // { branchName: hash }
    const remoteHash   = remoteRefs[branch] || null;      // null = brand-new branch
 
    if (remoteHash === localHash) {
        console.log('Everything up-to-date');
        return;
    }
 
    // P2-5: reject if remote has commits we don't know about
    // (fast-forward check: remoteHash must be an ancestor of localHash)
    if (remoteHash && !isAncestor(remoteHash, localHash)) {
        console.error('push rejected: remote has commits you don\'t have. Run: vcs pull');
        return;
    }
 
    // 4. Object negotiation — collect hashes the server already has
    const remoteKnown = new Set(Object.values(remoteRefs));
    const toSend      = collectReachable(localHash, remoteKnown);
 
    // 5. Push objects with progress
    const hashes  = [...toSend];
    const total   = hashes.length;
    let   sent    = 0;
 
    process.stdout.write(`Sending objects: 0/${total}\r`);
 
    for (const hash of hashes) {
        const obj = readObject(hash);
        const res = await post(`${remoteUrl}/objects`, {
            hash,
            type    : obj.type,
            content : obj.content,
        });
        if (res.status !== 200 && res.status !== 201) {
            console.error(`\npush: failed to send object ${hash.slice(0, 7)} (${res.status})`);
            return;
        }
        sent++;
        process.stdout.write(`Sending objects: ${sent}/${total}\r`);
    }
 
    console.log(`Sending objects: ${total}/${total} — done`);
 
    // 6. Update remote ref (CAS)
    const refRes = await post(`${remoteUrl}/refs`, {
        ref     : branch,
        oldHash : remoteHash,
        newHash : localHash,
    });
 
    if (refRes.status === 409) {
        console.error('push rejected: remote moved ahead while pushing. Run: vcs pull');
        return;
    }
    if (refRes.status !== 200) {
        console.error(`push: ref update failed (${refRes.status}): ${JSON.stringify(refRes.body)}`);
        return;
    }
 
    console.log(`${remoteName}/${branch} → ${localHash.slice(0, 7)}`);
}
 

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
 
module.exports = push;