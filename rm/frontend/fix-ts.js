const fs = require('fs');
const path = require('path');
function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        if (dirPath.includes('node_modules')) return;
        if (fs.statSync(dirPath).isDirectory()) {
            walkDir(dirPath, callback);
        } else if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts')) {
            callback(dirPath);
        }
    });
}
walkDir('c:/Users/Lenovo/Documents/dev/app/wms/frontend', (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    let prev = content;

    // Replace array implicit any types for basic react iteration
    content = content.replace(/\((\w+),\s*(\w+)\)\s*=>\s*\(/g, '($1: any, $2: any) => (');
    content = content.replace(/\.map\(\((\w+)\)\s*=>/g, '.map(($1: any) =>');
    content = content.replace(/\.map\(\s*(\w+)\s*=>/g, '.map(($1: any) =>');
    content = content.replace(/\.filter\(\s*(\w+)\s*=>/g, '.filter(($1: any) =>');
    content = content.replace(/\.find\(\s*(\w+)\s*=>/g, '.find(($1: any) =>');
    content = content.replace(/\.forEach\(\s*(\w+)\s*=>/g, '.forEach(($1: any) =>');
    // Ensure all state arrays have specific type
    content = content.replace(/useState\(\[\]\)/g, 'useState<any[]>([])');

    if (prev !== content) {
        fs.writeFileSync(filePath, content);
        console.log('Fixed', filePath);
    }
});
