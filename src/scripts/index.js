const fs = require('fs');
const path = require('path');

const scripts = {};
const scriptNamePattern = /^script\.(\w+)\.js$/;

// Get the list of script files in the current directory
const files = fs.readdirSync(__dirname);

for (let file of files) {
    const match = scriptNamePattern.exec(file);
    if (match) {
        const scriptName = match[1];
        // Here we store the import promise directly under the module name
        scripts[scriptName] = import(path.join(__dirname, file));
    }
}

module.exports = scripts;
