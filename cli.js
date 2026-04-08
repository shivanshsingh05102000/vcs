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
const remote   = require('./commands/remote');
const push     = require('./commands/push');
const fetch    = require('./commands/fetch');
const pull     = require('./commands/pull');
const clone = require('./commands/clone');

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
    case 'remote':   remote(args);    break;
    case 'push':     push(args).catch(e => console.error(e.message));    break;
    case 'fetch':    fetch(args).catch(e => console.error(e.message));   break;
    case 'pull':     pull(args).catch(e => console.error(e.message));    break;
    case 'clone':    clone(args).catch(e => console.error(e.message));   break;
    default:
        if (command) {
            console.error(`Unknown command: ${command}`);
        } else {
            console.log('Usage: vcs <command> [args]');
            console.log('Commands: init, add, commit, status, log, branch, checkout, merge, diff, rm, remote, push, fetch, pull');
        }
}