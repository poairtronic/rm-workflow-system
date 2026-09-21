const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
    const fileList = fs.readdirSync(dir);
    for (const file of fileList) {
        const name = `${dir}/${file}`;
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files);
        } else {
            if (name.endsWith('.controller.ts')) {
                files.push(name);
            }
        }
    }
    return files;
}

const controllers = getFiles('backend/src');
let routeCount = 0;

for (const file of controllers) {
    const content = fs.readFileSync(file, 'utf-8');
    const matches = content.match(/@(Get|Post|Put|Patch|Delete)\(/g);
    if (matches) {
        routeCount += matches.length;
    }
}

console.log(`Total Routes: ${routeCount}`);
