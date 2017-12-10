#! /usr/bin/env node

const {
  isNull,
  car,
  cdr,
  cons,
} = require('my-little-schemer');
const sh = require('shelljs');
const commandLineArgs = require('command-line-args');
const commandLineCommands = require('command-line-commands');
const getUsage = require('command-line-usage');

// const validCommands = [null, 'fill', 'f'];
// const {command, argv} = commandLineCommands(validCommands);

// Determines whether the file is a numbered file
function isNumbered(name) {
  return /^\d/.test(name);
}

// Extracts the number from a numbered filename
function getNum(name) {
  if (isNumbered(name)) {
    const num = /^\d+/.exec(name)[0];
    return parseInt(num, 10);
  }

  return '';
}

// Extract the extension (with dot) from a filename
function getExt(name) {
  return /\.[^.]*$/.exec(name)[0];
}

// Extracts body of filename (i.e., what is between number and extension)
function getBody(name) {
  const nameL = name.length;

  const num = getNum(name);
  const numStr = num.toString();
  const numStrL = numStr.length;

  const ext = getExt(name);
  const extL = ext.length;

  if (numStrL + extL === nameL) {
    return '';
  }

  return name.slice(numStrL, nameL - extL);
}

// Parses filename into [number, body, ext] array, with option to override number
// and body (needed for naming new files)
function parseFileName(name, num = getNum(name), body = getBody(name)) {
  return [num, body, getExt(name)];
}

// Get list of files in directory
function getFiles(dir) {
  return sh.ls(dir).slice(); // slice gets rid of extra stuff returned by sh.ls()
}

// Get sorted list of numbered files
function getNumFiles(files) {
  return files
    .filter(name => isNumbered(name))
    .sort((a, b) => getNum(a) - getNum(b));
}

// Get list of parsed filnames from list of files
function getParsedFiles(files) {
  return files.map(name => parseFileName(name));
}

// Turn parsed filename into path
function toPath(dir, parsedFileName) {
  const fileName = parsedFileName.join('');

  return `${dir}/${fileName}`;
}

function addFiles(keepBody, dir, index, ...names) {
  function reNum(fileMap, startN, prevN, col) {
    if (isNull(fileMap)) {
      return col([], []);
    }

    const curr = car(fileMap);
    const currN = car(curr);
    const rest = cdr(fileMap);

    // StartN is the number the first inserted file will be mapped to.
    // Any files numbered below that index should be skipped.
    if (currN < startN) {
      return reNum(rest, startN, prevN, (orig, dest) => col(orig, dest));
    }

    // PrevN is the number the previous file will be mapped to. Initialized at
    // the number of the first inserted file + number of files inserted. Once a gap is hit,
    // the function should terminate.
    if (currN > prevN) {
      return col([], []);
    }

    const nextN = prevN + 1;

    // If currN is equal (or greater than, if you want to preserve gaps) prevN, then collect
    // the path to the origin file and collect a mv destination that is one number up
    return reNum(rest, startN, nextN, (orig, dest) => col(
      cons(toPath(dir, curr), orig),
      cons(toPath(dir, cons(nextN, cdr(curr))), dest),
    ));
  }

  const mappedFiles = getParsedFiles(getNumFiles(getFiles(dir)));

  // Files must be moved in reverse to avoid collision
  const mvMap = reNum(mappedFiles, index, index + (names.length - 1), (orig, dest) => {
    const addOrig = names.map(name => `${dir}/${name}`);
    const addDest = names.map((name, i) => {
      if (keepBody) {
        return toPath(dir, parseFileName(name, index + i, ` - ${getBody(name)}`));
      }

      return toPath(dir, parseFileName(name, index + i, ''));
    });

    return [orig.reverse().concat(addOrig.reverse()), dest.reverse().concat(addDest.reverse())];
  });

  const origins = mvMap[0];
  const destinations = mvMap[1];

  origins.forEach((orig, i) => {
    // sh.mv(orig, destinations[i]);
    console.log([orig, destinations[i]]);
  });
}

// Get args from CLI
const args = process.argv.slice(2);

// console.log(getParsedFiles(getNumFiles(getFiles(process.cwd()))));
addFiles(false, process.cwd(), parseInt(args[0], 10), ...args.slice(1));
