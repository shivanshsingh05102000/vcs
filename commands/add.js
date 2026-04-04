const fs = require('fs');
const { writeObject } = require('../lib/objects');
const { readIndex, writeIndex } = require('../lib/index');

function add(args) {
    const filename = args[0];
    if(!filename){
        console.error('usage: add <filename>');
        return;
    }
    if(!fs.existsSync(filename)){
        console.error(`file ${filename} does not exist`);
        return;
    }
    const content = fs.readFileSync(filename);
    const hash = writeObject('blob', content);

    const index = readIndex();
    index[filename] = hash;
    writeIndex(index);

    console.log(`Added ${filename} → ${hash.slice(0, 7)}`);
}

module.exports = add;