const fs = require('fs');
const chalk = require('chalk');
const { readIndex, writeIndex } = require('../lib/index');

function rm(args) {
    if (!args || args.length === 0) {
        console.error(chalk.red('Usage: vcs rm <file>'));
        return;
    }

    const flag = args[0] === '--cached';
    const files = flag ? args.slice(1) : args;

    if (files.length === 0) {
        console.error(chalk.red('Usage: vcs rm [--cached] <file>'));
        return;
    }

    const index = readIndex();

    for (const file of files) {
        if (!index[file]) {
            console.error(chalk.yellow(`Not tracked: ${file}`));
            continue;
        }

        // remove from index
        delete index[file];

        if (!flag) {
            // also delete from disk
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log(chalk.red(`Removed ${file}`));
            }
        } else {
            console.log(chalk.yellow(`Unstaged ${file} (file kept on disk)`));
        }
    }

    writeIndex(index);
}

module.exports = rm;