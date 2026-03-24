const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.js') || file.endsWith('.jsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const dirs = ['d:\\Project\\TestGEN AI\\src', 'd:\\Project\\TestGEN AI\\backend\\src'];
let files = [];
dirs.forEach(dir => files = files.concat(walk(dir)));

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('TestGEN') || content.includes('testgen')) {
        content = content.replace(/TestGEN/g, 'TestNexa').replace(/testgen/g, 'testnexa');
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated ' + file);
    }
});
