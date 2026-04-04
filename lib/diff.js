/**
 * Myers Diff Algorithm
 */

function myersDiff(a, b) {
    const n = a.length;
    const m = b.length;

    if (n === 0 && m === 0) return [];
    if (n === 0) return b.map(content => ({ type: 'add', content }));
    if (m === 0) return a.map(content => ({ type: 'remove', content }));

    const max = n + m;
    const offset = m; // diagonal offset: k + offset = index into v
    const v = new Array(n + m + 2).fill(0);
    const trace = [];

    for (let d = 0; d <= max; d++) {
        trace.push([...v]);
        for (let k = -d; k <= d; k += 2) {
            const i = k + offset;
            let x;
            if (k === -d || (k !== d && v[i - 1] < v[i + 1])) {
                x = v[i + 1]; // insert
            } else {
                x = v[i - 1] + 1; // delete
            }
            let y = x - k;
            while (x < n && y < m && a[x] === b[y]) { x++; y++; }
            v[i] = x;
            if (x >= n && y >= m) {
                return buildEdits(trace, a, b, d, offset);
            }
        }
    }

    return buildEdits(trace, a, b, max, offset);
}

function buildEdits(trace, a, b, finalD, offset) {
    const edits = [];
    let x = a.length;
    let y = b.length;

    for (let d = finalD; d > 0; d--) {
        const v = trace[d - 1];
        const k = x - y;
        const i = k + offset;

        let prevK;
        if (k === -d || (k !== d && (v[i - 1] || 0) < (v[i + 1] || 0))) {
            prevK = k + 1; // came from insert (above)
        } else {
            prevK = k - 1; // came from delete (left)
        }

        const prevX = v[prevK + offset] || 0;
        const prevY = prevX - prevK;

        // walk back diagonals (equal lines)
        while (x > prevX + (prevK === k - 1 ? 1 : 0) && y > prevY + (prevK === k + 1 ? 1 : 0)) {
            if (x <= 0 || y <= 0) break;
            if (a[x - 1] !== b[y - 1]) break;
            edits.unshift({ type: 'equal', content: a[x - 1] });
            x--; y--;
        }

        if (prevK === k - 1) {
            // delete from a
            if (x > 0) {
                edits.unshift({ type: 'remove', content: a[x - 1] });
                x--;
            }
        } else {
            // insert from b
            if (y > 0) {
                edits.unshift({ type: 'add', content: b[y - 1] });
                y--;
            }
        }
    }

    // remaining equal lines at start
    while (x > 0 && y > 0) {
        edits.unshift({ type: 'equal', content: a[x - 1] });
        x--; y--;
    }

    return edits;
}

/**
 * Public API
 * Returns: { type: 'add'|'remove'|'modify', line, content, base? }
 */

function diffLines(base, updated) {
    const a = base === '' ? [] : base.split('\n');
    const b = updated === '' ? [] : updated.split('\n');

    const raw = myersDiff(a, b);
    const changes = [];
    let ai = 0, bi = 0, i = 0;

    while (i < raw.length) {
        const cur = raw[i];
        if (cur.type === 'equal') {
            ai++; bi++; i++;
        } else if (cur.type === 'remove' && raw[i + 1] && raw[i + 1].type === 'add') {
            // remove then add = modify
            changes.push({ type: 'modify', line: ai, base: cur.content, content: raw[i + 1].content });
            ai++; bi++; i += 2;
        } else if (cur.type === 'add' && raw[i + 1] && raw[i + 1].type === 'remove') {
            // add then remove = modify (Myers sometimes outputs in this order)
            changes.push({ type: 'modify', line: ai, base: raw[i + 1].content, content: cur.content });
            ai++; bi++; i += 2;
        } else if (cur.type === 'remove') {
            changes.push({ type: 'remove', line: ai, content: cur.content });
            ai++; i++;
        } else {
            changes.push({ type: 'add', line: bi, content: cur.content });
            bi++; i++;
        }
    }

    return changes;
}

module.exports = { diffLines, myersDiff };