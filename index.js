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

function add1File(name, index, preserveGaps = true) {
  const ext = getExt(name);
  const addOrig = `${dir}/${name}`;
  const addDest = `${dir}/${index}${ext}`;

  function toPath(pieces) {
    const fileName = pieces.join('');

    return `${dir}/${fileName}`;
  }

  function reNum(fileMap, prevN, col) {
    if (isNull(fileMap)) {
      return col([], []);
    }

    const curr = car(fileMap);
    const currN = car(curr);
    const rest = cdr(fileMap);

    // PrevN is the number the last files was mapped to. It will be initilized to
    // the index of the new file. Any files numbered below that index should be
    // skipped.
    if (currN < prevN) {
      return reNum(rest, prevN, (orig, dest) => col(orig, dest));
    }

    // If you do not want to preserve gaps in existing numbering, then if currN is greater than
    // prevN, the function should terminate.
    if (!preserveGaps && currN > prevN) {
      return col([], []);
    }

    const nextN = currN + 1;

    // If currN is equal (or greater than, if you want to preserve gaps) prevN, then collect
    // the path to the origin file and collect a mv destination that is one number up
    return reNum(rest, nextN, (orig, dest) => col(
      cons(toPath(curr), orig),
      cons(toPath(cons(nextN, cdr(curr))), dest),
    ));
  }

  const mvMap = reNum(mappedFiles, index, (orig, dest) => {
    orig.reverse().push(addOrig);
    dest.reverse().push(addDest);

    return [orig, dest];
  });
  const origins = mvMap[0];
  const destinations = mvMap[1];

  origins.forEach((orig, i) => {
    // sh.mv(orig, destinations[i]);
    console.log(orig, destinations[i]);
  });
}

// Get args from CLI
const args = process.argv.slice(2);



console.log(numFiles);
add1File(args[0], args[1], false);
