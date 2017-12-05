const fs = require('fs');
const S = require('my-little-schemer');
const sh = require('shelljs');

const cur = 0;
const dir = `./test/scratch/test_dirs/td${cur}`;
const files = sh.ls(dir).slice(); // slice gets rid of extra stuff returned by sh.ls()

// extracts the number from a numbered filename
function toNum(name) {
  const num = /^\d+/.exec(name)[0];
  return parseInt(num, 10);
}

// Filter out non-numbered names and sort them by number
const numFiles = files
  .filter(name => /^\d/.test(name))
  .sort((a, b) => toNum(a) - toNum(b));

// const mappedFiles = numFiles.map((name) => {
//   const num = toNum(name);
//   const rest = 
// })

console.log(numFiles);
