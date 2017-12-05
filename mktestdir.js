const sh = require('shelljs');

// create a unique new directory
const parent = `${__dirname}/test/scratch/test_dirs`;
const numExistDirs = sh.ls(parent).length;
const newDir = `${parent}/td${numExistDirs}`;

sh.mkdir(newDir);

// Create randomly numbered files with randomized common suffixes
const suffs = ['docx', 'xlsx', 'doc', 'pdf', 'PDF', 'DOCX'];
const files = [];
const numFiles = 20;

while (files.length < numFiles) {
  const rand = Math.floor(Math.random() * numFiles * 2) + 1;
  const suff = suffs[rand % (suffs.length - 1)];
  const file = `${newDir}/${rand}.${suff}`;

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
  const suff = suffs[Math.floor(Math.random() * suffs.length)];
  const file = `${newDir}/${name}.${suff}`;

  files.push(file);
});

sh.touch(files);
