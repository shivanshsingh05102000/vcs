function diffLines(base, updated) {
    const baseLines = base.split('\n');
    const updatedLines = updated.split('\n');
    const changes = [];

    const maxLen = Math.max(baseLines.length, updatedLines.length);

    for (let i = 0; i < maxLen; i++) {
        const baseLine = baseLines[i];
        const updatedLine = updatedLines[i];

        if (baseLine === undefined) {
            changes.push({ type: 'add', line: i, content: updatedLine });
        } else if (updatedLine === undefined) {
            changes.push({ type: 'remove', line: i, content: baseLine });
        } else if (baseLine !== updatedLine) {
            changes.push({ type: 'modify', line: i, base: baseLine, content: updatedLine });
        }
    }

    return changes;
}

module.exports = { diffLines };