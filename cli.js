#!/usr/bin/env node

const init     = require('./commands/init');
const add      = require('./commands/add');
const commit   = require('./commands/commit');
const log      = require('./commands/log');
const checkout = require('./commands/checkout');
const status   = require('./commands/status');
const branch   = require('./commands/branch');
const merge    = require('./commands/merge');
const diff     = require('./commands/diff');
const rm       = require('./commands/rm');

const [,, command, ...args] = process.argv;

switch (command) {
    case 'init':     init();          break;
    case 'add':      add(args);       break;
    case 'status':   status();        break;
    case 'log':      log();           break;
    case 'commit':   commit(args);    break;
    case 'checkout': checkout(args);  break;
    case 'branch':   branch(args);    break;
    case 'merge':    merge(args);     break;
    case 'diff':     diff(args);      break;
    case 'rm':       rm(args);        break;
    default:
        if (command) {
            console.error(`Unknown command: ${command}`);
        } else {
            console.log('Usage: vcs <command> [args]');
            console.log('Commands: init, add, commit, status, log, branch, checkout, merge, diff, rm');
        }
}