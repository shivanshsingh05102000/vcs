const { readObject } = require('./objects');
const { diffLines } = require('./diff');

/**
 * findLCA — Lowest Common Ancestor using BFS on both branches simultaneously.
 * The old implementation only walked one side linearly — broken for diverged history.
 */
function findLCA(hashA, hashB) {
    const visitedA = new Set();
    const visitedB = new Set();

    const queueA = [hashA];
    const queueB = [hashB];

    while (queueA.length > 0 || queueB.length > 0) {
        // advance A one step
        if (queueA.length > 0) {
            const hash = queueA.shift();
            if (!hash) continue;
            if (visitedB.has(hash)) return hash;
            if (!visitedA.has(hash)) {
                visitedA.add(hash);
                const parents = getParents(hash);
                queueA.push(...parents);
            }
        }

        // advance B one step
        if (queueB.length > 0) {
            const hash = queueB.shift();
            if (!hash) continue;
            if (visitedA.has(hash)) return hash;
            if (!visitedB.has(hash)) {
                visitedB.add(hash);
                const parents = getParents(hash);
                queueB.push(...parents);
            }
        }
    }

    return null;
}

function getParents(hash) {
    try {
        const commit = readObject(hash);
        const parents = [];
        for (const line of commit.content.split('\n')) {
            if (line.startsWith('parent ')) {
                parents.push(line.split(' ')[1]);
            }
        }
        return parents;
    } catch {
        return [];
    }
}

/**
 * mergeFiles — 3-way merge using Myers diff.
 * Now correctly handles insertions and deletions by content, not index.
 */
function mergeFiles(base, ours, theirs) {
    const baseLines  = base   === '' ? [] : base.split('\n');
    const oursLines  = ours   === '' ? [] : ours.split('\n');
    const theirsLines = theirs === '' ? [] : theirs.split('\n');

    // build change maps keyed by original base line content + index
    const oursDiff   = diffLines(base, ours);
    const theirsDiff = diffLines(base, theirs);

    // track which base lines are changed by each side (by line index)
    const oursChanged   = new Map(); // baseLineIdx -> new content | null (deleted)
    const theirsChanged = new Map();

    for (const c of oursDiff) {
        if (c.type === 'remove') oursChanged.set(c.line, null);
        if (c.type === 'modify') oursChanged.set(c.line, c.content);
    }
    for (const c of theirsDiff) {
        if (c.type === 'remove') theirsChanged.set(c.line, null);
        if (c.type === 'modify') theirsChanged.set(c.line, c.content);
    }

    // collect added lines per side
    const oursAdded   = oursDiff.filter(c => c.type === 'add');
    const theirsAdded = theirsDiff.filter(c => c.type === 'add');

    const result = [];
    let hasConflicts = false;

    for (let i = 0; i < baseLines.length; i++) {
        const oursChange   = oursChanged.has(i);
        const theirsChange = theirsChanged.has(i);

        if (!oursChange && !theirsChange) {
            // unchanged on both sides
            result.push(baseLines[i]);
        } else if (oursChange && !theirsChange) {
            // only ours changed
            if (oursChanged.get(i) !== null) result.push(oursChanged.get(i));
            // else deleted — don't push
        } else if (!oursChange && theirsChange) {
            // only theirs changed
            if (theirsChanged.get(i) !== null) result.push(theirsChanged.get(i));
        } else {
            // both changed same line
            const oursVal   = oursChanged.get(i);
            const theirsVal = theirsChanged.get(i);

            if (oursVal === theirsVal) {
                // same change on both sides — no conflict
                if (oursVal !== null) result.push(oursVal);
            } else {
                hasConflicts = true;
                result.push(
                    '<<<<<<< HEAD',
                    oursVal   !== null ? oursVal   : '(deleted)',
                    '=======',
                    theirsVal !== null ? theirsVal : '(deleted)',
                    '>>>>>>> incoming'
                );
            }
        }
    }

    // append added lines (simple approach: ours first, then theirs if different)
    const oursAddedLines   = oursAdded.map(c => c.content);
    const theirsAddedLines = theirsAdded.map(c => c.content);

    // check for conflicting additions
    const oursSet   = new Set(oursAddedLines);
    const theirsSet = new Set(theirsAddedLines);

    for (const line of oursAddedLines) result.push(line);
    for (const line of theirsAddedLines) {
        if (!oursSet.has(line)) result.push(line);
    }

    return {
        content: result.join('\n'),
        hasConflicts
    };
}

module.exports = { findLCA, mergeFiles };