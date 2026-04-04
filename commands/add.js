const fs = require('fs');
const path = require('path');
const { writeObject } = require('../lib/objects');
const { readIndex, writeIndex } = require('../lib/index');

const IGNORE = [
    '.vcs', '.git', 'node_modules', 'package-lock.json'
];

function getAllFiles(dir = '.') {
    const results = [];
    for (const entry of fs.readdirSync(dir)) {
        if (IGNORE.includes(entry)) continue;
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) {
            results.push(...getAllFiles(full));
        } else {
            results.push(full.replace(/\\/g, '/'));
        }
    }
    return results;
}

function add(args) {
    if (!args || args.length === 0) {
        console.error('Usage: vcs add <file|.>');
        return;
    }

    const index = readIndex();
    const filesToAdd = [];

    for (const arg of args) {
        if (arg === '.') {
            filesToAdd.push(...getAllFiles('.'));
        } else {
            if (!fs.existsSync(arg)) {
                console.error(`File not found: ${arg}`);
                continue;
            }
            filesToAdd.push(arg.replace(/\\/g, '/'));
        }
    }

    if (filesToAdd.length === 0) {
        console.log('Nothing to add.');
        return;
    }

    for (const file of filesToAdd) {
        const content = fs.readFileSync(file);
        const hash = writeObject('blob', content);
        index[file] = hash;
        console.log(`Added ${file} → ${hash.slice(0, 7)}`);
    }

    writeIndex(index);
}

module.exports = add;