const chalk = require('chalk');
const { readObject } = require('../lib/objects');
const { readRef, readHEAD } = require('../lib/refs');

function log() {
    const head = readHEAD();
    const branch = head.startsWith('ref:')
        ? head.replace('ref: refs/heads/', '')
        : null;
    let currentHash = branch ? readRef(branch) : head;

    if (!currentHash) {
        console.log(chalk.yellow('No commits yet'));
        return;
    }

    while (currentHash) {
        const commit = readObject(currentHash);
        const lines = commit.content.split('\n');

        const author    = lines.find(l => l.startsWith('author'));
        const timestamp = lines.find(l => l.startsWith('timestamp'));
        const message   = lines[lines.length - 1];

        console.log(chalk.yellow(`\ncommit ${currentHash}`));
        console.log(chalk.cyan(author));
        console.log(chalk.gray(timestamp));
        console.log(`\n    ${chalk.bold(message)}`);

        const parentLine = lines.find(l => l.startsWith('parent'));
        currentHash = parentLine ? parentLine.split(' ')[1] : null;
    }
}

module.exports = log;