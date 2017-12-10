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

/* Utilities */

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

// Get list of parsed numbered files
function getParsedNumFiles(dir) {
  return getParsedFiles(getNumFiles(getFiles(dir)));
}

// Get parsed file by index
function getParsedFileByIndex(dir, index) {
  const parsedNumFiles = getParsedNumFiles(dir);

  for (let i = 0; i < parsedNumFiles.length; i += 1) {
    const parsedFile = parsedNumFiles[i];
    if (car(parsedFile) === index) {
      return parsedFile;
    }
  }

  throw new Error(`File ${index} not found.`)
}

// Turn parsed filename into path
function toPath(dir, parsedFileName) {
  const fileName = parsedFileName.join('');

  return `${dir}/${fileName}`;
}

// move files from origin array to paths given in destination array
function move(origins, destinations) {
  origins.forEach((orig, i) => {
    // sh.mv(orig, destinations[i]);
    console.log([orig, destinations[i]]);
  });
}

function readFile(path) {
  return sh.cat(path)
    .slice()
    // get rid of trailing separator chars
    .replace(/\s*[\n;,]+\s*$/g, '')
    // split on newline, comma or semicolon (treat multiple as one
    // and ignore surrounding spaces)
    .split(/\s*[\n;,]+\s*/);
}

/* Commands */

const validCommands = [null, 'add', 'remove', 'rm', 'shift', 'degap', 'move', 'mv', 'swap'];
const {command, argv} = commandLineCommands(validCommands);

const globalOptionDefinitions = [
  {
    name: 'directory',
    alias: 'd',
    type: String,
    defaultValue: process.cwd(),
    description: 'Choose working directory. Defaults to current working directory.',
  },
  {
    name: 'file',
    alias: 'f',
    type: String,
    multiple: true,
    description: 'Import file names from file.',
  },
  {
    name: 'keep-body',
    alias: 'k',
    type: Boolean,
    defaultValue: false,
    description: 'Append numbers to current filenames instead of overriting filenames with numbers.',
  },
];

// Add one or more files to sequential indexes, starting from the given index.
// Then, renumber each colliding file
function addFiles(exportDir, workingDir, keepBody, index, ...names) {
  if (Number.isNaN(index)) {
    throw new SyntaxError('You did not indicate a file number.');
  }

  if (names.length === 0) {
    throw new SyntaxError('You did not select any files.');
  }

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

    // If currN is equal to prevN, then collect
    // the path to the origin file and collect a mv destination that is one number up
    return reNum(rest, startN, nextN, (orig, dest) => col(
      cons(toPath(workingDir, curr), orig),
      cons(toPath(workingDir, cons(nextN, cdr(curr))), dest),
    ));
  }

  const mappedFiles = getParsedNumFiles(workingDir);

  // Files must be moved in reverse to avoid collision
  const mvMap = reNum(mappedFiles, index, index + (names.length - 1), (orig, dest) => {
    const addOrig = names.map(name => `${exportDir}/${name}`);
    const addDest = names.map((name, i) => {
      if (keepBody) {
        return toPath(workingDir, parseFileName(name, index + i, ` - ${getBody(name)}`));
      }

      return toPath(workingDir, parseFileName(name, index + i, ''));
    });

    return [orig.reverse().concat(addOrig.reverse()), dest.reverse().concat(addDest.reverse())];
  });

  const origins = mvMap[0];
  const destinations = mvMap[1];

  move(origins, destinations);
}

// Remove files from start index to end index (either delete or denumber)
function rm(dir, del, startIndex, endIndex = startIndex) {
  const filesToRm = getParsedNumFiles(dir)
    .filter(parsedFile => car(parsedFile) >= startIndex && car(parsedFile) <= endIndex);

  const pathsToRm = filesToRm.map(parsedFile => toPath(dir, parsedFile));

  // Either delete or denumber the files to be removed.
  if (del) {
    // sh.rm(pathsToRm);
    console.log(pathsToRm);
  } else {
    // Create denumbered paths. Given them a body if the body is blank
    const denumberedPaths = filesToRm.map((parsedFile, i) => toPath(dir, cons(
      '',
      cons(
        car(cdr(parsedFile)) || `removed-file-${i + 1}`,
        cdr(cdr(parsedFile)),
      ),
    )));

    move(pathsToRm, denumberedPaths);
  }
}

// Remove gaps in file numbers
function degap(dir, startIndex, endIndex) {
  if (Number.isNaN(startIndex)) {
    throw new SyntaxError('Missing start number');
  }

  function gapReNum(fileMap, prevN, col) {
    if (isNull(fileMap)) {
      return col([], []);
    }

    const curr = car(fileMap);
    const currN = car(curr);
    const rest = cdr(fileMap);

    // startIndex is where degapping starts.
    // Any files numbered below that index should be skipped.
    if (currN < startIndex) {
      return gapReNum(rest, prevN, (orig, dest) => col(orig, dest));
    }

    // endIndex is where degapping ends. Function terminates
    // when past that index, if one is given
    if (endIndex && currN > endIndex) {
      return col([], []);
    }

    const nextN = prevN + 1;

    // Prevent renumbering if file already at correct index
    if (currN === prevN) {
      return gapReNum(rest, nextN, (orig, dest) => col(orig, dest));
    }

    // If currN is equal to prevN, then collect
    // the path to the origin file and collect a mv destination that is the next sequenced number
    return gapReNum(rest, nextN, (orig, dest) => col(
      cons(toPath(dir, curr), orig),
      cons(toPath(dir, cons(prevN, cdr(curr))), dest),
    ));
  }

  const mappedFiles = getParsedNumFiles(dir);

  // Files must be moved in order to avoid collision
  const mvMap = gapReNum(mappedFiles, startIndex, (orig, dest) => [orig, dest]);

  const origins = mvMap[0];
  const destinations = mvMap[1];

  move(origins, destinations);
}

function shift(dir, fromIndex, toIndex) {
  if (Number.isNaN(fromIndex)) {
    throw new SyntaxError('Missing from number');
  }

  if (Number.isNaN(toIndex)) {
    throw new SyntaxError('Missing to number');
  }

  function shiftReNum(fileMap, gap, col) {
    if (isNull(fileMap)) {
      return col([], []);
    }

    const curr = car(fileMap);
    const currN = car(curr);
    const rest = cdr(fileMap);

    // fromIndex is the number where shifting will start.
    // Any files numbered below that index should be skipped.
    if (currN < fromIndex) {
      return shiftReNum(rest, gap, (orig, dest) => col(orig, dest));
    }

    // the path to the origin file and collect a mv destination that
    // is one number up
    return shiftReNum(rest, gap, (orig, dest) => col(
      cons(toPath(dir, curr), orig),
      cons(toPath(dir, cons(currN + gap, cdr(curr))), dest),
    ));
  }

  const mappedFiles = getParsedNumFiles(dir);
  const gap = toIndex - fromIndex;
  const mvMap = shiftReNum(
    mappedFiles,
    gap,
    (orig, dest) => {
      // Files must be moved in reverse if gap is positive,
      // and in order if negative to avoid collision
      if (gap > 0) {
        orig.reverse();
        dest.reverse();
      }

      return [orig, dest];
    },
  );

  const origins = mvMap[0];
  const destinations = mvMap[1];

  move(origins, destinations);
}

function mv(dir, fromIndex, toIndex) {
  const fromFile = getParsedFileByIndex(dir, fromIndex).join('');

  addFiles(dir, dir, true, toIndex, fromFile);
}

function swap(dir, firstIndex, secondIndex) {
  const firstFilePath = toPath(dir, getParsedFileByIndex(dir, firstIndex));
  const secondFilePath = toPath(dir, getParsedFileByIndex(dir, secondIndex));
  const tmpPath = `${dir}/.swaptmp`;

  // Giving a tmp pointer is required to avoid collision
  sh.mv(firstFilePath, tmpPath);
  sh.mv(secondFilePath, firstFilePath);
  sh.mv(tmpPath, secondFilePath);
}

// Removes all bodies from numbered filenames, leaving numbers only
function clean(dir) {
  const parsedNumFiles = getParsedNumFiles(dir);
  const origins = parsedNumFiles.map(parsedFile => toPath(dir, parsedFile));
  const destinations = parsedNumFiles.map(parsedFile => toPath(dir, [parsedFile[0], '', parsedFile[2]]));

  move(origins, destinations);
}

// Removes all unnumbered files from directory
function purge(dir) {
  getFiles(dir).forEach((file) => {
    if (!isNumbered(file)) {
      sh.rm(`${dir}/file`);
    }
  });
}

// Get args from CLI
const args = process.argv.slice(2);

// console.log(getParsedFiles(getNumFiles(getFiles(process.cwd()))));
addFiles(process.cwd(), process.cwd(), false, parseInt(args[0], 10), ...args.slice(1));
// rm(process.cwd(), false, parseInt(args[0], 10), parseInt(args[1], 10));
// degap(process.cwd(), parseInt(args[0], 10), parseInt(args[1], 10));
// shift(process.cwd(), parseInt(args[0], 10), parseInt(args[1], 10));

