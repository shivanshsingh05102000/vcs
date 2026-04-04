const fs = require('fs');
const path = require('path');

const VCS_DIR = '.vcs';

function writeRef(name, hash) {
    const refPath = path.join(VCS_DIR, 'refs', 'heads', name);
    fs.mkdirSync(path.dirname(refPath), { recursive: true });
    fs.writeFileSync(refPath, hash);
}

function readRef(name) {
    const refPath = path.join(VCS_DIR, 'refs', 'heads', name);
    if (!fs.existsSync(refPath)) return null;
    return fs.readFileSync(refPath, 'utf-8').trim();
}

function writeHEAD(value) {
    // value = "ref: refs/heads/main"  OR  a commit hash (detached)
    fs.writeFileSync(path.join(VCS_DIR, 'HEAD'), value);
}

function readHEAD() {
    return fs.readFileSync(path.join(VCS_DIR, 'HEAD'), 'utf-8').trim();
}

module.exports = { writeRef, readRef, writeHEAD, readHEAD };