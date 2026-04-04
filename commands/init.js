const fs = require('fs');
const { writeHEAD } = require('../lib/refs');

function init (){
    fs.mkdirSync('.vcs/objects', { recursive: true });
    fs.mkdirSync('.vcs/refs/heads', { recursive: true });
    writeHEAD('ref: refs/heads/main');
    console.log('Initialized empty VCS repository in .vcs');
}

module.exports = init;