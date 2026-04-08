'use strict';

const fs   = require('fs');
const path = require('path');

const init     = require('./init');
const fetch    = require('./fetch');
const checkout = require('./checkout');
const { readConfig, writeConfig } = require('./remote');

async function clone(args) {
    const [url, dir] = args || [];

    if (!url || !dir) {
        console.error('Usage: vcs clone <url> <dir>');
        return;
    }

    // url looks like: http://host/repos/myrepo
    // strip trailing slash
    const remoteUrl = url.replace(/\/$/, '');

    // 1. Create target directory
    if (fs.existsSync(dir)) {
        console.error(`clone: destination '${dir}' already exists`);
        return;
    }
    fs.mkdirSync(dir, { recursive: true });

    // 2. cd into it and init
    const originalCwd = process.cwd();
    process.chdir(dir);

    try {
        init();

        // 3. Save remote URL to config
        const cfg = readConfig();
        cfg.remotes = { origin: remoteUrl };
        writeConfig(cfg);

        // 4. Fetch all objects + remote-tracking refs
        await fetch(['origin']);

        // 5. Checkout main if it exists
        const refPath = path.join('.vcs', 'refs', 'remotes', 'origin', 'main');
        if (fs.existsSync(refPath)) {
            const hash = fs.readFileSync(refPath, 'utf-8').trim();
            // write local main ref
            fs.mkdirSync(path.join('.vcs', 'refs', 'heads'), { recursive: true });
            fs.writeFileSync(path.join('.vcs', 'refs', 'heads', 'main'), hash);
            // checkout working tree
            checkout(['main']);
        } else {
            console.log('clone: remote has no main branch — empty repo cloned');
        }

        console.log(`\nCloned into '${dir}'`);
    } catch (err) {
        process.chdir(originalCwd);
        // clean up on failure
        fs.rmSync(dir, { recursive: true, force: true });
        throw err;
    }

    process.chdir(originalCwd);
}

module.exports = clone;