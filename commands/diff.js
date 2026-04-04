const fs = require('fs');
const chalk = require('chalk');
const { diffLines } = require('../lib/diff');
const { readIndex } = require('../lib/index');
const { readObject } = require('../lib/objects');
const { readRef, readHEAD } = require('../lib/refs');

function diff(args) {
    const index = readIndex();

    const head = readHEAD();
    const branch = head.startsWith('ref:')
        ? head.replace('ref: refs/heads/', '')
        : null;
    const commitHash = branch ? readRef(branch) : head;

    let headTree = {};
    if (commitHash) {
        try {
            const commit = readObject(commitHash);
            const treeLine = commit.content.split('\n').find(l => l.startsWith('tree'));
            const treeHash = treeLine.split(' ')[1];
            const tree = readObject(treeHash);
            tree.content.split('\n').forEach(entry => {
                const [meta, hash] = entry.split('\0');
                const filename = meta.split(' ')[1];
                headTree[filename] = hash;
            });
        } catch (e) { /* no commits yet */ }
    }

    let anyDiff = false;

    for (const [file, stagedHash] of Object.entries(index)) {
        if (!fs.existsSync(file)) continue;

        const diskContent = fs.readFileSync(file, 'utf-8');
        const stagedObj = readObject(stagedHash);
        const stagedContent = stagedObj.content;

        if (diskContent === stagedContent) continue;

        anyDiff = true;
        console.log(chalk.bold(`\ndiff -- ${file}`));
        console.log(chalk.gray('--- staged'));
        console.log(chalk.gray('+++ working'));

        const changes = diffLines(stagedContent, diskContent);

        if (changes.length === 0) continue;

        // build line-by-line output with context
        const stagedLines = stagedContent.split('\n');
        const diskLines = diskContent.split('\n');
        const changedLineNums = new Set(changes.map(c => c.line));

        // print with 2 lines of context around each change
        let printed = new Set();
        for (const c of changes) {
            const start = Math.max(0, c.line - 2);
            const end = Math.min(diskLines.length - 1, c.line + 2);

            for (let i = start; i <= end; i++) {
                if (printed.has(i)) continue;
                printed.add(i);

                if (changedLineNums.has(i)) {
                    const change = changes.find(ch => ch.line === i);
                    if (change.type === 'add') {
                        console.log(chalk.green(`+ ${diskLines[i]}`));
                    } else if (change.type === 'remove') {
                        console.log(chalk.red(`- ${stagedLines[i]}`));
                    } else if (change.type === 'modify') {
                        console.log(chalk.red(`- ${change.base}`));
                        console.log(chalk.green(`+ ${change.content}`));
                    }
                } else {
                    console.log(chalk.gray(`  ${diskLines[i]}`));
                }
            }
        }
    }

    if (!anyDiff) {
        console.log('No unstaged changes.');
    }
}

module.exports = diff;