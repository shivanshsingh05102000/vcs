'use strict';
 
const { readObject } = require('./objects');
 
/**
 * Walk all commits reachable from `startHash` and collect every
 * object hash (commits + their trees + all blobs in those trees).
 *
 * Returns a Set<string> of hashes.
 * Stops at any commit whose hash is in `stopSet` (already on remote).
 */
function collectReachable(startHash, stopSet) {
    stopSet = stopSet || new Set();
    const visited = new Set();
    const queue   = [startHash];
 
    while (queue.length) {
        const hash = queue.shift();
        if (!hash || visited.has(hash) || stopSet.has(hash)) continue;
        visited.add(hash);
 
        let obj;
        try { obj = readObject(hash); }
        catch { continue; } // object missing locally — skip
 
        if (obj.type === 'commit') {
            // Add the tree
            const treeMatch = obj.content.match(/^tree ([a-f0-9]+)/m);
            if (treeMatch) queue.push(treeMatch[1]);
 
            // Follow parent chain
            const parentMatch = obj.content.match(/^parent ([a-f0-9]+)/m);
            if (parentMatch) queue.push(parentMatch[1]);
        }
 
        if (obj.type === 'tree') {
            // Each line: "100644 filename\0blobHash"
            for (const line of obj.content.split('\n')) {
                const nullIdx = line.indexOf('\0');
                if (nullIdx === -1) continue;
                queue.push(line.slice(nullIdx + 1).trim());
            }
        }
        // blobs have no children
    }
 
    return visited;
}
 
function commitChain(startHash, stopSet) {
    stopSet = stopSet || new Set();
    const chain = [];
    let   cur   = startHash;
 
    while (cur && !stopSet.has(cur)) {
        let obj;
        try { obj = readObject(cur); } catch { break; }
        if (obj.type !== 'commit') break;
        chain.push(cur);
        const m = obj.content.match(/^parent ([a-f0-9]+)/m);
        cur = m ? m[1] : null;
    }
 
    return chain.reverse(); 
}
 
module.exports = { collectReachable, commitChain };