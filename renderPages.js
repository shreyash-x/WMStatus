const fs = require('fs');
const path = require('path');
const {JSDOM} = require("jsdom");
const shell = require('shelljs');

const getAllHTMLFiles = (dirPath) => {

    // Get all files in the directory
    const files = fs.readdirSync(dirPath);
    // Filter out all the files that are not HTML
    let htmlFiles = files.filter((file) => {
        return path.extname(file) === '.html';
    });
    // remove index.html
    const index = htmlFiles.indexOf('index.html');
    if (index > -1) {
        htmlFiles.splice(index, 1);
    }

    // Return the HTML files
    const sortedHTMLFiles = sortFiles(htmlFiles);
    return sortedHTMLFiles;
}

const sortFiles = (files) => {
    return files.sort((a, b) => {
        let dateA = a.split('.')[0];
        dateA = dateA.split('-');
        dateA = dateA[1] + '-' + dateA[0] + '-' + dateA[2];
        let dateB = b.split('.')[0];
        dateB = dateB.split('-');
        dateB = dateB[1] + '-' + dateB[0] + '-' + dateB[2];
        dateA = new Date(dateA);
        dateB = new Date(dateB);
        return dateB - dateA;
    });
}

const updateIndex = async () => {
    const dirPath = path.join(__dirname, 'pages');
    const htmlFiles = getAllHTMLFiles(dirPath);
    const dom = await JSDOM.fromFile(path.join(dirPath, 'index.html'));
    const div = dom.window.document.getElementById('main');
    // Remove all children
    while (div.firstChild) {
        div.removeChild(div.firstChild);
    }
    // Add new children
    htmlFiles.forEach((file) => {
        const date = dom.window.document.createElement('h3');
        date.textContent = file.split('.')[0];
        const link = dom.window.document.createElement('p');
        const a = dom.window.document.createElement('a');
        const p = dom.window.document.createElement('p');
        a.href = `${file}`;
        a.textContent = 'View';
        link.appendChild(a);
        div.appendChild(date);
        div.appendChild(link);
        div.appendChild(p);
    });
    const html = dom.serialize();
    fs.writeFileSync(path.join(dirPath, 'index.html'), html);
}

const hostPages = async () => {
    await updateIndex();
    // shell.cd(path.join(__dirname, 'pages'));
    // shell.exec('git add .');
    // shell.exec('git commit -m "Update index"');
    // shell.exec('git push origin main');
    shell.exec("npx netlify deploy --prod --dir=./pages", {silent: true, cwd: __dirname});
}



module.exports = {
    hostPages
}