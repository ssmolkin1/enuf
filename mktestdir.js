const sh = require('shelljs');

// create a unique new directory
const parent = `${__dirname}/test/scratch/test_dirs`;
const numExistDirs = sh.ls(parent).length;
const newDir = `${parent}/td${numExistDirs}`;

sh.mkdir('-p',newDir);

// Create randomly numbered files with randomized common files extensions
const exts = ['docx', 'xlsx', 'doc', 'pdf', 'PDF', 'DOCX'];
const files = [];
const numFiles = 20;

while (files.length < numFiles) {
  const rand = Math.floor(Math.random() * numFiles * 2) + 1;
  const ext = exts[rand % (exts.length - 1)];
  const file = `${newDir}/${rand}.${ext}`;

  if (files.indexOf(file) === -1) {
    files.push(file);
  }
}

// create some named files
const names = [
  'Beetlejuice - Articles - draft 20.10.17',
  'Archer - SHA - executed - 102115',
  'SPA',
  'IFL_thirdco_to_4co',
  'someradnomlongthings',
  'proj - Words and dated 11-17-2017',
];

names.forEach((name) => {
  const ext = exts[Math.floor(Math.random() * exts.length)];
  const file = `${newDir}/${name}.${ext}`;

  files.push(file);
});

sh.touch(files);
