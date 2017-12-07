#! /usr/bin/env node

const {
  isNull,
  car,
  cdr,
  cons,
} = require('my-little-schemer');
const sh = require('shelljs');

const cur = 0;
const dir = `./test/scratch/test_dirs/td${cur}`;
const files = sh.ls(dir).slice(); // slice gets rid of extra stuff returned by sh.ls()

// extract the extension from a filename
function getExt(name) {
  return /\.[^.]*$/.exec(name)[0];
}

// extracts the number from a numbered filename
function getNum(name) {
  const num = /^\d+/.exec(name)[0];
  return parseInt(num, 10);
}

// Filter out non-numbered names and sort them by number
const numFiles = files
  .filter(name => /^\d/.test(name))
  .sort((a, b) => getNum(a) - getNum(b));

// Split files into [num, body, ext]
const mappedFiles = numFiles.map((name) => {
  const nameL = name.length;

  const num = getNum(name);
  const numStr = num.toString();
  const numStrL = numStr.length;

  const ext = getExt(name);
  const extL = ext.length;

  let body;

  if (numStrL + extL === nameL) {
    body = '';
  } else {
    body = name.slice(numStrL, nameL - extL);
  }

  return [num, body, ext];
});

function add1File(name, index) {
  const ext = getExt(name);
  const addOrig = `${dir}/${name}`;
  const addDest = `${dir}/${index}${ext}`;

  function toPath(pieces) {
    const fileName = pieces.join('');

    return `${dir}/${fileName}`;
  }

  function reNum(fileMap = mappedFiles, prevN = index) {
    if (isNull(fileMap)) {
      return [];
    }

    const curr = car(fileMap);
    const currN = car(curr);
    const rest = cdr(fileMap);

    if (currN < prevN) {
      return cons(null, reNum(rest, prevN));
    }

    if (currN > prevN) {
      return [];
    }

    const nextN = currN + 1;

    return cons(toPath(cons(nextN + 1, cdr(curr))), reNum(rest, nextN + 1));
  }

  const destinations = reNum();
  const origins = [];

  // Stop when origin length matches destination length
  for (let i = 0; i < destinations.length; i += 1) {
    origins.push(toPath(mappedFiles[i]));
  }

  // mv needs to be executed in reverse to avoid collisions
  let revDest = destinations.reverse();
  let revOrig = origins.reverse();

  // Since the destination array was reversed, at a point there will just
  // be a series of null entries. These need to be removed.
  const end = revDest.indexOf(null);

  revDest = revDest.slice(0, end);
  revOrig = revOrig.slice(0, end);


  // Now push the added file onto the end of the stack, to be executed last
  revDest.push(addDest);
  revOrig.push(addOrig);

  revDest.forEach((dest, i) => {
    // sh.mv(revOrig[i], dest);
    console.log(revOrig[i], dest);
  });
}

// Get args from CLI
const args = process.argv.slice(2);

// add1File(args[0], args[1]);
// console.log(process.cwd());
