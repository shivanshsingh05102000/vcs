'use strict';
 
const fs   = require('fs');
const path = require('path');
 
const CONFIG_PATH = path.join('.vcs', 'config');
 

function readConfig() {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    } catch {
        return {};
    }
}
 
function writeConfig(cfg) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
 

function addRemote(name, url) {
    if (!name || !url) {
        console.error('Usage: vcs remote add <name> <url>');
        return;
    }
    const cfg = readConfig();
    cfg.remotes = cfg.remotes || {};
 
    if (cfg.remotes[name]) {
        console.error(`Remote '${name}' already exists. Use 'vcs remote remove ${name}' first.`);
        return;
    }
 
    cfg.remotes[name] = url;
    writeConfig(cfg);
    console.log(`Remote '${name}' added → ${url}`);
}
 
function removeRemote(name) {
    if (!name) {
        console.error('Usage: vcs remote remove <name>');
        return;
    }
    const cfg = readConfig();
    if (!cfg.remotes || !cfg.remotes[name]) {
        console.error(`No remote named '${name}'`);
        return;
    }
    delete cfg.remotes[name];
    writeConfig(cfg);
    console.log(`Remote '${name}' removed`);
}
 
function listRemotes() {
    const cfg = readConfig();
    const remotes = cfg.remotes || {};
    const entries = Object.entries(remotes);
    if (entries.length === 0) {
        console.log('No remotes configured');
        return;
    }
    for (const [name, url] of entries) {
        console.log(`${name}\t${url}`);
    }
}

function remote(args) {
    const [sub, ...rest] = args || [];
 
    switch (sub) {
        case 'add':    return addRemote(rest[0], rest[1]);
        case 'remove': return removeRemote(rest[0]);
        case 'list':
        case undefined:
            return listRemotes();
        default:
            console.error(`Unknown remote subcommand: ${sub}`);
            console.error('Usage: vcs remote add|remove|list');
    }
}
 
module.exports = remote;
module.exports.readConfig  = readConfig;
module.exports.writeConfig = writeConfig;