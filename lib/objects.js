const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OBJECTS_DIR = path.join('.vcs', 'objects');

// Always convert content to a UTF-8 string before storing
function normalizeContent(content) {
    if (Buffer.isBuffer(content)) return content.toString('utf-8');
    if (typeof content === 'object' && content !== null && content.data) {
        return Buffer.from(content.data).toString('utf-8');
    }
    return String(content);
}

function hashObject(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function writeObject(type, content) {
    const normalized = normalizeContent(content);
    const rawContent = JSON.stringify({ type, content: normalized });
    const hash = hashObject(rawContent);
    const folder = hash.slice(0, 2);
    const filename = hash.slice(2);
    const dirPath = path.join(OBJECTS_DIR, folder);
    const filePath = path.join(dirPath, filename);

    // dedup: check filePath not dirPath
    if (fs.existsSync(filePath)) return hash;

    const compressed = zlib.deflateSync(rawContent);
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(filePath, compressed);
    return hash;
}

function readObject(hash) {
    const folder = hash.slice(0, 2);
    const filename = hash.slice(2);
    const filePath = path.join(OBJECTS_DIR, folder, filename);

    if (!fs.existsSync(filePath)) {
        throw new Error(`Object not found: ${hash.slice(0, 7)}`);
    }

    const compressed = fs.readFileSync(filePath);
    const rawContent = zlib.inflateSync(compressed).toString('utf-8');
    const { type, content } = JSON.parse(rawContent);
    return { type, content };
}

function buildTree(indexMap) {
    const entries = Object.entries(indexMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, hash]) => `100644 ${name}\0${hash}`)
        .join('\n');
    return writeObject('tree', entries);
}

function buildCommit({ treeHash, parentHash, message, author }) {
    const content = [
        `tree ${treeHash}`,
        parentHash ? `parent ${parentHash}` : null,
        `author ${author}`,
        `timestamp ${new Date().toISOString()}`,
        ``,
        message
    ].filter(line => line !== null).join('\n');
    return writeObject('commit', content);
}

module.exports = { hashObject, writeObject, readObject, buildTree, buildCommit };
