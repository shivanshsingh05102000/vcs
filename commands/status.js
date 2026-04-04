const fs = require('fs');
const chalk = require('chalk');
const { readObject, writeObject } = require('../lib/objects');
const { readIndex } = require('../lib/index');
const { readRef, readHEAD } = require('../lib/refs');

const IGNORE = ['cli.js', 'commands', 'lib', 'node_modules', 'package.json', 'package-lock.json', 'test', '.git'];

function status() {
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

    const staged = [];
    for (const [file, hash] of Object.entries(index)) {
        if (!headTree[file]) staged.push(chalk.green(`  new file:  ${file}`));
        else if (headTree[file] !== hash) staged.push(chalk.green(`  modified:  ${file}`));
    }

    const unstaged = [];
    for (const [file, hash] of Object.entries(index)) {
        if (!fs.existsSync(file)) {
            unstaged.push(chalk.red(`  deleted:   ${file}`));
        } else {
            const diskHash = writeObject('blob', fs.readFileSync(file));
            if (diskHash !== hash) unstaged.push(chalk.red(`  modified:  ${file}`));
        }
    }

    const untracked = fs.readdirSync('.')
        .filter(f => !f.startsWith('.') && !index[f] && !IGNORE.includes(f))
        .map(f => chalk.gray(`  ${f}`));

    const onBranch = branch
        ? chalk.bold(`On branch ${chalk.cyan(branch)}`)
        : chalk.yellow(`HEAD detached at ${head.slice(0, 7)}`);

    console.log(`\n${onBranch}`);

    console.log('\nChanges to be committed:');
    staged.length ? staged.forEach(l => console.log(l)) : console.log(chalk.gray('  nothing'));

    console.log('\nChanges not staged for commit:');
    unstaged.length ? unstaged.forEach(l => console.log(l)) : console.log(chalk.gray('  nothing'));

    console.log('\nUntracked files:');
    untracked.length ? untracked.forEach(f => console.log(f)) : console.log(chalk.gray('  nothing'));
}

module.exports = status;