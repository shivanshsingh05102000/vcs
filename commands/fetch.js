'use strict';
 
const fs   = require('fs');
const path = require('path');
 
const { writeObject, readObject } = require('../lib/objects');
const { get, getRemoteUrl }       = require('../lib/api');
 
const VCS_DIR = '.vcs';
 
function hasObject(hash) {
    const folder   = hash.slice(0, 2);
    const filename = hash.slice(2);
    return fs.existsSync(path.join(VCS_DIR, 'objects', folder, filename));
}
 
/**
 * Recursively fetch all objects reachable from `hash` that we don't have.
 * Returns the total count fetched.
 */
async function fetchMissing(remoteUrl, hash, progress) {
    const queue   = [hash];
    const visited = new Set();
 
    while (queue.length) {
        const h = queue.shift();
        if (!h || visited.has(h)) continue;
        visited.add(h);
 
        if (hasObject(h)) continue; // already local
 
        // Download from server
        const res = await get(`${remoteUrl}/objects/${h}`);
        if (res.status === 404) continue; // server doesn't have it either
        if (res.status !== 200) {
            throw new Error(`fetch: server returned ${res.status} for object ${h.slice(0, 7)}`);
        }
 
        const { type, content } = res.body;
        writeObject(type, content);
        progress.received++;
        process.stdout.write(`Receiving objects: ${progress.received}/${progress.total}\r`);
 
        // Queue children
        if (type === 'commit') {
            const treeMatch = content.match(/^tree ([a-f0-9]+)/m);
            if (treeMatch) queue.push(treeMatch[1]);
            const parentMatch = content.match(/^parent ([a-f0-9]+)/m);
            if (parentMatch) queue.push(parentMatch[1]);
        }
        if (type === 'tree') {
            for (const line of content.split('\n')) {
                const nullIdx = line.indexOf('\0');
                if (nullIdx === -1) continue;
                queue.push(line.slice(nullIdx + 1).trim());
            }
        }
    }
}
 
async function fetch(args) {
    const remoteName = args && args[0] ? args[0] : 'origin';
 
    const remoteUrl = getRemoteUrl(remoteName);
    if (!remoteUrl) {
        console.error(`fetch: no remote named '${remoteName}'`);
        return;
    }
 
    // 1. GET remote refs
    const refsRes = await get(`${remoteUrl}/refs`);
    if (refsRes.status !== 200) {
        console.error(`fetch: could not reach remote (${refsRes.status})`);
        return;
    }
 
    const remoteRefs = refsRes.body; // { branch: hash }
    const entries    = Object.entries(remoteRefs);
    if (entries.length === 0) {
        console.log('fetch: remote has no branches');
        return;
    }
 
    // Rough total: we don't know exact counts until we walk, so show running tally
    const progress = { received: 0, total: '?' };
    console.log(`From ${remoteUrl}`);
 
    for (const [branch, hash] of entries) {
        process.stdout.write(`Receiving objects: 0/${progress.total}\r`);
        await fetchMissing(remoteUrl, hash, progress);
 
        // Write remote-tracking ref
        const refDir  = path.join(VCS_DIR, 'refs', 'remotes', remoteName);
        fs.mkdirSync(refDir, { recursive: true });
        fs.writeFileSync(path.join(refDir, branch), hash);
 
        console.log(`  ${remoteName}/${branch} → ${hash.slice(0, 7)}`);
    }
 
    if (progress.received === 0) {
        console.log('Already up-to-date');
    } else {
        console.log(`Receiving objects: ${progress.received}/${progress.received} — done`);
    }
}
 
module.exports = fetch;