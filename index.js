#! /usr/bin/env node

const { lstatSync } = require('fs');
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
const pkg = require('./package.json');

/* ----- Utilities ----- */

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
  const extMatches = /\.[^.]*$/.exec(name);

  if (extMatches) {
    return extMatches[0];
  }

  return '';
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
  return sh.ls(dir)
    // slice gets rid of extra stuff returned by sh.ls()
    .slice()
    // Filter out directories and 'index.[ext]' files.
    .filter(file => lstatSync(`${dir}/${file}`).isFile() && !/^index\.[^.]*$/.test(file));
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

// Get file numbers of all numbered files
function getFileNumbers(dir) {
  return getParsedNumFiles(dir).map(parsedFile => car(parsedFile));
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

  throw new Error(`File ${index} not found.`);
}

// Turn parsed filename into path
function toPath(dir, parsedFileName) {
  const fileName = parsedFileName.join('');

  return `${dir}/${fileName}`;
}

// move files from origin array to paths given in destination array
function move(origins, destinations) {
  origins.forEach((orig, i) => {
    sh.mv(orig, destinations[i]);
  });
}

function getIndicesFromArgs(args) {
  const indices = [];

  for (let i = 0; i < args.length; i += 1) {
    if (!Number.isNaN(Number(args[i]))) {
      indices.push(Number(args[i]));
    }
  }

  return indices;
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

/* ----- Operations ----- */

// Add one or more files to sequential indexes, starting from the given index.
// Then, renumber each colliding file
function addFiles(exportDir, workingDir, keepBody, index, ...names) {
  if (Number.isNaN(index) || index === undefined) {
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
    const PathRegExp = /^(\.{0,2}\/)+/;

    const addOrig = names.map((name) => {
      // Handle a path being given rather than a filename
      if (PathRegExp.test(name)) {
        return name;
      }

      return `${exportDir}/${name}`;
    });

    const addDest = names.map((name, i) => {
      if (keepBody) {
        // Extract filename from path if path is given
        const fileName = name.replace(PathRegExp, '');
        const body = getBody(fileName);

        if (body) {
          return toPath(workingDir, parseFileName(
            fileName,
            index + i,
            /^\s*-/.test(body) ? body : ` - ${body}`,
          ));
        }
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
    sh.rm(pathsToRm);
  } else {
    // Create denumbered paths. Given them a body if the body is blank
    const denumberedPaths = filesToRm.map((parsedFile, i) => toPath(dir, cons(
      '',
      cons(
        car(cdr(parsedFile)).replace(/^[\s-]+/, '') || `removed-file-${i + 1}-${Math.random()}`,
        cdr(cdr(parsedFile)),
      ),
    )));

    move(pathsToRm, denumberedPaths);
  }
}

// Remove gaps in file numbers
function degap(dir, startIndex = 0, endIndex) {
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

    // startIndex is where degapping starts. Defaults to 0.
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
  if (Number.isNaN(fromIndex) || fromIndex === undefined) {
    throw new SyntaxError('Missing from number');
  }

  if (Number.isNaN(toIndex || toIndex === undefined)) {
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
  if (Number.isNaN(fromIndex) || fromIndex === undefined) {
    throw new SyntaxError('Missing from number');
  }

  if (Number.isNaN(toIndex || toIndex === undefined)) {
    throw new SyntaxError('Missing to number');
  }

  const fromFile = getParsedFileByIndex(dir, fromIndex).join('');

  addFiles(dir, dir, true, toIndex, fromFile);
}

function swap(dir, firstIndex, secondIndex) {
  if (Number.isNaN(firstIndex) || firstIndex === undefined) {
    throw new SyntaxError('No files chosen.');
  }

  if (Number.isNaN(secondIndex || secondIndex === undefined)) {
    throw new SyntaxError('Only one file chosen.');
  }

  const firstFile = getParsedFileByIndex(dir, firstIndex);
  const secondFile = getParsedFileByIndex(dir, secondIndex);

  const newFirstFile = secondFile.slice(1);
  newFirstFile.unshift(firstFile[0]);

  const newSecondFile = firstFile.slice(1);
  newSecondFile.unshift(secondFile[0]);

  const firstFilePath = toPath(dir, firstFile);
  const secondFilePath = toPath(dir, secondFile);

  const newFirstFilePath = toPath(dir, newFirstFile);
  const newSecondFilePath = toPath(dir, newSecondFile);

  const tmpPath = `${dir}/.swaptmp`;

  // Giving a tmp pointer is required to avoid collision if exts are same
  sh.mv(firstFilePath, tmpPath);
  sh.mv(secondFilePath, newFirstFilePath);
  sh.mv(tmpPath, newSecondFilePath);
}

// Removes all bodies from numbered filenames, leaving numbers only
function clean(dir, startIndex = 0, endIndex) {
  if (Number.isNaN(startIndex)) {
    throw new SyntaxError('Missing start number');
  }

  function rmBod(fileMap, col) {
    if (isNull(fileMap)) {
      return col([], []);
    }

    const curr = car(fileMap);
    const currN = car(curr);
    const currB = car(cdr(curr));
    const rest = cdr(fileMap);

    // startIndex is where cleaning starts. Defaults to 0.
    // Any files numbered below that index should be skipped.
    // Filenames without bodies should also be skipped.
    if (currN < startIndex || !currB) {
      return rmBod(rest, (orig, dest) => col(orig, dest));
    }

    // endIndex is where cleaning ends. Function terminates
    // when past that index, if one is given
    if (endIndex && currN > endIndex) {
      return col([], []);
    }

    // If file num is between startIndex and endIndex, collect the path to the origin file and
    // collect a mv destination that is the filename without the body
    return rmBod(rest, (orig, dest) => col(
      cons(toPath(dir, curr), orig),
      cons(toPath(dir, cons(currN, cons('', cdr(cdr(curr))))), dest),
    ));
  }

  const mappedFiles = getParsedNumFiles(dir);

  // Since no renumbering, mv order doesn't matter.
  const mvMap = rmBod(mappedFiles, (orig, dest) => [orig, dest]);

  const origins = mvMap[0];
  const destinations = mvMap[1];

  move(origins, destinations);
}

// Reconciles all files with colliding numbers
function reconcile(dir, infoOnly, startN = 0, endN) {
  if (Number.isNaN(startN)) {
    throw new SyntaxError('Missing start number');
  }

  const parsedNumFiles = getParsedNumFiles(dir);
  const collisions = [];

  for (let i = 1; i < parsedNumFiles.length; i += 1) {
    const curr = parsedNumFiles[i];
    const currN = curr[0];

    if (
      currN >= startN &&
      (endN ? currN <= endN : true) &&
      currN === parsedNumFiles[i - 1][0]
    ) {
      if (infoOnly) {
        collisions.push(currN);
      } else {
        addFiles(dir, dir, true, currN + 1, curr.join(''));
        reconcile(dir, infoOnly, currN, endN);
        break;
      }
    }
  }

  if (infoOnly) {
    console.log(collisions.length ?
      `The following files need reconciliation: ${collisions.join(', ')}` :
      'All files are reconciled.');
  }
}

// Removes all unnumbered files from directory
function purge(dir) {
  getFiles(dir).forEach((file) => {
    if (!isNumbered(file)) {
      sh.rm(`${dir}/${file}`);
    }
  });
}

function ls(dir) {
  console.log(getFileNumbers(dir).join(', '));
}

/* ----- CLI ----- */

/* --- Generate Help Page --- */

// Helper function to generate help page
function printHelpPage(command, optionDefinitions) {
  const commandList = {
    list: {
      name: 'list, ls',
      description: 'Show all used indicies.',
    },
    ls: {
      name: 'list, ls',
      description: 'Show all used indicies.',
    },
    add: {
      name: 'add',
      summary: 'Insert one or more files into a numbered file directory, starting from the given index.',
    },
    remove: {
      name: 'remove, rm',
      summary: 'Remove one or more files by index.',
    },
    rm: {
      name: 'remove, rm',
      summary: 'Remove one or more files by index.',
    },
    shift: {
      name: 'shift',
      description: 'Move a numbered file to a new index, move all subsequent files to subsequnet indices.',
    },
    degap: {
      name: 'degap',
      description: 'Remove gaps in numbering.',
    },
    move: {
      name: 'move, mv',
      description: 'Move file from one index to a new index.',
    },
    mv: {
      name: 'move, mv',
      description: 'Move file from one index to a new index.',
    },
    swap: {
      name: 'swap',
      description: 'Swap the indices of two files.',
    },
    reconcile: {
      name: 'reconcile, r',
      description: `Where multiple files share an index (possible if files have different bodies or extensions)
        renumber files so that each file has a unique index.`,
    },
    r: {
      name: 'reconcile, r',
      description: `Where multiple files share an index (possible if files have different bodies or extensions)
        renumber files so that each file has a unique index.`,
    },
    clean: {
      name: 'clean',
      description: 'Remove bodies from filenames, leaving only the index and extension.',
    },
    purge: {
      name: 'purge',
      description: `Delete all non-numbered files in the working directory, other than the file titled
      'index.<ext>'.`,
    },
  };

  const sections = [ // Universal template
    {
      header: `Usage: enuf ${command ? `${command}` : '<command>'}  <options>  ${(command !== null &&
          command !== 'purge' &&
          command !== 'list' &&
          command !== 'ls') ? '<index>' : ''} ${(command !== null &&
              command !== 'purge' &&
              command !== 'list' &&
              command !== 'ls' &&
              command !== 'add') ? ' <index2>' : ''} ${command === 'add' ? '<files>' : ''}`,
      content: `${commandList[command] ? `${commandList[command].summary} ` : ''} If the command takes indiceis, options declarations must always precede the indicies. If the commend takes files, these should always come last, after the options and index.`,
    },
    {
      header: 'Options',
      optionList: optionDefinitions,
    },
    {
      content: `See 'enuf <command> -h' for help with ${command ? 'another command or \'enuf -h\' for a full list of commands.' : 'a specific command.'}`,
    },
  ];

  if (!command) { // Show title and command list only for 'enuf -h'
    sections.unshift({
      header: pkg.name,
      content: pkg.description,
    });

    const commandDescriptions = Object.values(commandList).filter((a, i, arr) => {
      if (i > 0) {
        return a.name !== arr[i - 1].name;
      }

      return true;
    });

    sections.splice(sections.length - 1, 0, {
      header: 'Command List',
      content: commandDescriptions,
    });
  }

  console.log(getUsage(sections));
}

/* ----- Commands ----- */

const validCommands = [
  null,
  'add',
  'remove',
  'rm',
  'shift',
  'degap',
  'move',
  'mv',
  'swap',
  'reconcile',
  'r',
  'clean',
  'purge',
  'list',
  'ls',
];

const { command, argv } = commandLineCommands(validCommands);

const globalOptionDefinitions = [
  {
    name: 'directory',
    alias: 'd',
    type: String,
    defaultValue: process.cwd(),
    description: 'Choose working directory. Default is current working directory.',
  },
  {
    name: 'help',
    alias: 'h',
    type: Boolean,
    description: 'Prints this help page.',
  },
];

if (command === null) {
  const specificOptionDefitions = [
    {
      name: 'version',
      alias: 'v',
      type: Boolean,
      description: 'Prints the version of gal.',
    },
  ];

  const optionDefinitions = globalOptionDefinitions
    .slice(1)
    .concat(specificOptionDefitions);

  const options = commandLineArgs(optionDefinitions, { argv });

  if (options.help) {
    printHelpPage(command, optionDefinitions);
  } else if (options.version) {
    console.log(pkg.version);
  }
}

if (command === 'add') {
  const specificOptionDefitions = [
    {
      name: 'from-directory',
      alias: 'e',
      type: String,
      description: 'Directory where files are being imported from. Default is the chosen working directory.',
    },
    {
      name: 'keep-body',
      alias: 'k',
      type: Boolean,
      description: 'Append numbers to current filenames instead of overriting filenames with numbers.',
    },
    {
      name: 'file',
      alias: 'f',
      type: Boolean,
      description: 'Import file names from file.',
    },
  ];

  const optionDefinitions = globalOptionDefinitions.concat(specificOptionDefitions);

  const options = commandLineArgs(optionDefinitions, { argv });

  if (options.help) {
    printHelpPage(command, optionDefinitions);
  } else {
    let number;
    let index;

    for (let i = 0; i < argv.length; i += 1) {
      if (!Number.isNaN(Number(argv[i]))) {
        number = Number(argv[i]);
        index = i;
        break;
      }
    }

    if (number === undefined) {
      throw new SyntaxError('You did not indicate a file number.');
    }

    let files = argv.slice(index + 1);

    if (options.file) {
      files = readFile(files);
    }

    addFiles(
      options['from-directory'] || options.directory,
      options.directory,
      options['keep-body'],
      number,
      ...files,
    );
  }
}

if (command === 'remove' || command === 'rm') {
  const specificOptionDefitions = [
    {
      name: 'delete',
      alias: 'D',
      type: Boolean,
      description: 'Delete removed files instead of just de-numbering them.',
    },
  ];

  const optionDefinitions = globalOptionDefinitions.concat(specificOptionDefitions);

  const options = commandLineArgs(optionDefinitions, { argv });

  if (options.help) {
    printHelpPage(command, optionDefinitions);
  } else {
    rm(options.directory, options.delete, ...getIndicesFromArgs(argv));
  }
}

if (command === 'reconcile' || command === 'r') {
  const specificOptionDefitions = [
    {
      name: 'info-only',
      alias: 'i',
      type: Boolean,
      description: 'Displays file numbers which need reconciliation, but does not re-number files.',
    },
  ];

  const optionDefinitions = globalOptionDefinitions.concat(specificOptionDefitions);

  const options = commandLineArgs(optionDefinitions, { argv });

  if (options.help) {
    printHelpPage(command, optionDefinitions);
  } else {
    reconcile(options.directory, options['info-only'], ...getIndicesFromArgs(argv));
  }
}

if (
  command === 'degap' ||
  command === 'shift' ||
  command === 'move' ||
  command === 'mv' ||
  command === 'swap' ||
  command === 'clean' ||
  command === 'purge' ||
  command === 'list' ||
  command === 'ls'
) {
  const options = commandLineArgs(globalOptionDefinitions, { argv });

  if (options.help) {
    printHelpPage(command, globalOptionDefinitions);
  } else if (
    command === 'purge' ||
    command === 'list' ||
    command === 'ls'
  ) {
    const functions = {
      purge,
      ls,
      list: ls,
    };

    functions[command](options.directory);
  } else {
    const functions = {
      degap,
      shift,
      mv,
      move: mv,
      swap,
      clean,
    };

    functions[command](options.directory, ...getIndicesFromArgs(argv));
  }
}
