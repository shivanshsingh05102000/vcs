const { readObject } = require('./objects');
const { readRef } = require('./refs');
const { diffLines } = require('./diff');

function findLCA(hashA, hashB) {
    const visited = new Set();
    let hash = hashA;
    while (hash) {
        visited.add(hash);
        const commit = readObject(hash);
        const parentLine = commit.content.split('\n').find(l => l.startsWith('parent'));
        hash = parentLine ? parentLine.split(' ')[1] : null;
    }

    hash = hashB;
    while (hash) {
        if (visited.has(hash)) return hash;
        const commit = readObject(hash);
        const parentLine = commit.content.split('\n').find(l => l.startsWith('parent'));
        hash = parentLine ? parentLine.split(' ')[1] : null;
    }

    return null;
}



function mergeFiles(base, ours, theirs) {
    const oursChanges = diffLines(base, ours);
    const theirsChanges = diffLines(base, theirs);

    const baseLines = base.split('\n');
    const result = [...baseLines];

    // index changes by line number
    const oursMap = {};
    const theirsMap = {};
    oursChanges.forEach(c => oursMap[c.line] = c);
    theirsChanges.forEach(c => theirsMap[c.line] = c);

    const conflicts = [];
    const allLines = new Set([
        ...Object.keys(oursMap),
        ...Object.keys(theirsMap)
    ].map(Number));

    for (const line of allLines) {
        const ours = oursMap[line];
        const theirs = theirsMap[line];

        if (ours && theirs) {
            // both changed same line = conflict
            if (ours.content !== theirs.content) {
                conflicts.push(line);
                result[line] = [
                    '<<<<<<< HEAD',
                    ours.content,
                    '=======',
                    theirs.content,
                    '>>>>>>> incoming'
                ].join('\n');
            }
            // both made same change = no conflict, keep it
        } else if (ours) {
            result[line] = ours.content;
        } else if (theirs) {
            result[line] = theirs.content;
        }
    }

    return {
        content: result.join('\n'),
        hasConflicts: conflicts.length > 0
    };
}

module.exports = { findLCA , mergeFiles};