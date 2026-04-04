#!/usr/bin/env node

const init = require('./commands/init');
const add = require('./commands/add');
const commit = require('./commands/commit');
const log = require('./commands/log');
const ckeckout = require('./commands/checkout');
const status = require('./commands/status');
const branch = require('./commands/branch');
const merge = require('./commands/merge');


const [,, command, ...args] = process.argv;

if (command === 'init') init();
if (command === 'add') add(args);
if (command === 'status') status();
if (command === 'log') log();
if (command === 'commit') commit(args);
if (command === 'checkout') ckeckout(args);
if (command === 'branch') branch(args);
if (command === 'merge') require('./commands/merge')(args);
