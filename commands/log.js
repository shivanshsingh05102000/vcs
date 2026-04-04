const { readObject } = require('../lib/objects');
const { readRef, readHEAD } = require('../lib/refs');

function log() {
    const head = readHEAD();
    const branch = head.startsWith('ref:')
        ? head.replace('ref: refs/heads/', '')
        : null;
    let currentHash = branch ? readRef(branch) : head;

    if (!currentHash) {
        console.log('No commits yet');
        return;
    }

    while (currentHash) {
        const commit = readObject(currentHash);
        const lines = commit.content.split('\n');

        const author = lines.find(l => l.startsWith('author'));
        const timestamp = lines.find(l => l.startsWith('timestamp'));
        const message = lines[lines.length - 1];

        console.log(`\ncommit ${currentHash}`);
        console.log(author);
        console.log(timestamp);
        console.log(`\n    ${message}`);

        const parentLine = lines.find(l => l.startsWith('parent'));
        currentHash = parentLine ? parentLine.split(' ')[1] : null;
    }
}

module.exports = log;
