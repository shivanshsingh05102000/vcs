const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join('.vcs', 'index');

function readIndex() {
    if (!fs.existsSync(INDEX_PATH)) return {};
    return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8'));
}

function writeIndex(indexMap) {
    fs.writeFileSync(INDEX_PATH, JSON.stringify(indexMap, null, 2));
}

module.exports = { readIndex, writeIndex };