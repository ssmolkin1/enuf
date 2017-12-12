/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 55);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// Ignore warning about 'new String()'
/* eslint no-new-wrappers: 0 */


var os = __webpack_require__(5);
var fs = __webpack_require__(1);
var glob = __webpack_require__(7);
var shell = __webpack_require__(19);

var shellMethods = Object.create(shell);

// objectAssign(target_obj, source_obj1 [, source_obj2 ...])
// "Ponyfill" for Object.assign
//    objectAssign({A:1}, {b:2}, {c:3}) returns {A:1, b:2, c:3}
var objectAssign = typeof Object.assign === 'function' ?
  Object.assign :
  function objectAssign(target) {
    var sources = [].slice.call(arguments, 1);
    sources.forEach(function (source) {
      Object.keys(source).forEach(function (key) {
        target[key] = source[key];
      });
    });

    return target;
  };
exports.extend = objectAssign;

// Check if we're running under electron
var isElectron = Boolean(process.versions.electron);

// Module globals (assume no execPath by default)
var DEFAULT_CONFIG = {
  fatal: false,
  globOptions: {},
  maxdepth: 255,
  noglob: false,
  silent: false,
  verbose: false,
  execPath: null,
  bufLength: 64 * 1024, // 64KB
};

var config = {
  reset: function () {
    objectAssign(this, DEFAULT_CONFIG);
    if (!isElectron) {
      this.execPath = process.execPath;
    }
  },
  resetForTesting: function () {
    this.reset();
    this.silent = true;
  },
};

config.reset();
exports.config = config;

var state = {
  error: null,
  errorCode: 0,
  currentCmd: 'shell.js',
  tempDir: null,
};
exports.state = state;

delete process.env.OLDPWD; // initially, there's no previous directory

// This is populated by calls to commonl.wrap()
var pipeMethods = [];

// Reliably test if something is any sort of javascript object
function isObject(a) {
  return typeof a === 'object' && a !== null;
}
exports.isObject = isObject;

function log() {
  /* istanbul ignore next */
  if (!config.silent) {
    console.error.apply(console, arguments);
  }
}
exports.log = log;

// Converts strings to be equivalent across all platforms. Primarily responsible
// for making sure we use '/' instead of '\' as path separators, but this may be
// expanded in the future if necessary
function convertErrorOutput(msg) {
  if (typeof msg !== 'string') {
    throw new TypeError('input must be a string');
  }
  return msg.replace(/\\/g, '/');
}
exports.convertErrorOutput = convertErrorOutput;

// Shows error message. Throws if config.fatal is true
function error(msg, _code, options) {
  // Validate input
  if (typeof msg !== 'string') throw new Error('msg must be a string');

  var DEFAULT_OPTIONS = {
    continue: false,
    code: 1,
    prefix: state.currentCmd + ': ',
    silent: false,
  };

  if (typeof _code === 'number' && isObject(options)) {
    options.code = _code;
  } else if (isObject(_code)) { // no 'code'
    options = _code;
  } else if (typeof _code === 'number') { // no 'options'
    options = { code: _code };
  } else if (typeof _code !== 'number') { // only 'msg'
    options = {};
  }
  options = objectAssign({}, DEFAULT_OPTIONS, options);

  if (!state.errorCode) state.errorCode = options.code;

  var logEntry = convertErrorOutput(options.prefix + msg);
  state.error = state.error ? state.error + '\n' : '';
  state.error += logEntry;

  // Throw an error, or log the entry
  if (config.fatal) throw new Error(logEntry);
  if (msg.length > 0 && !options.silent) log(logEntry);

  if (!options.continue) {
    throw {
      msg: 'earlyExit',
      retValue: (new ShellString('', state.error, state.errorCode)),
    };
  }
}
exports.error = error;

//@
//@ ### ShellString(str)
//@
//@ Examples:
//@
//@ ```javascript
//@ var foo = ShellString('hello world');
//@ ```
//@
//@ Turns a regular string into a string-like object similar to what each
//@ command returns. This has special methods, like `.to()` and `.toEnd()`
function ShellString(stdout, stderr, code) {
  var that;
  if (stdout instanceof Array) {
    that = stdout;
    that.stdout = stdout.join('\n');
    if (stdout.length > 0) that.stdout += '\n';
  } else {
    that = new String(stdout);
    that.stdout = stdout;
  }
  that.stderr = stderr;
  that.code = code;
  // A list of all commands that can appear on the right-hand side of a pipe
  // (populated by calls to common.wrap())
  pipeMethods.forEach(function (cmd) {
    that[cmd] = shellMethods[cmd].bind(that);
  });
  return that;
}

exports.ShellString = ShellString;

// Return the home directory in a platform-agnostic way, with consideration for
// older versions of node
function getUserHome() {
  var result;
  if (os.homedir) {
    result = os.homedir(); // node 3+
  } else {
    result = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];
  }
  return result;
}
exports.getUserHome = getUserHome;

// Returns {'alice': true, 'bob': false} when passed a string and dictionary as follows:
//   parseOptions('-a', {'a':'alice', 'b':'bob'});
// Returns {'reference': 'string-value', 'bob': false} when passed two dictionaries of the form:
//   parseOptions({'-r': 'string-value'}, {'r':'reference', 'b':'bob'});
function parseOptions(opt, map, errorOptions) {
  // Validate input
  if (typeof opt !== 'string' && !isObject(opt)) {
    throw new Error('options must be strings or key-value pairs');
  } else if (!isObject(map)) {
    throw new Error('parseOptions() internal error: map must be an object');
  } else if (errorOptions && !isObject(errorOptions)) {
    throw new Error('parseOptions() internal error: errorOptions must be object');
  }

  // All options are false by default
  var options = {};
  Object.keys(map).forEach(function (letter) {
    var optName = map[letter];
    if (optName[0] !== '!') {
      options[optName] = false;
    }
  });

  if (opt === '') return options; // defaults

  if (typeof opt === 'string') {
    if (opt[0] !== '-') {
      error("Options string must start with a '-'", errorOptions || {});
    }

    // e.g. chars = ['R', 'f']
    var chars = opt.slice(1).split('');

    chars.forEach(function (c) {
      if (c in map) {
        var optionName = map[c];
        if (optionName[0] === '!') {
          options[optionName.slice(1)] = false;
        } else {
          options[optionName] = true;
        }
      } else {
        error('option not recognized: ' + c, errorOptions || {});
      }
    });
  } else { // opt is an Object
    Object.keys(opt).forEach(function (key) {
      // key is a string of the form '-r', '-d', etc.
      var c = key[1];
      if (c in map) {
        var optionName = map[c];
        options[optionName] = opt[key]; // assign the given value
      } else {
        error('option not recognized: ' + c, errorOptions || {});
      }
    });
  }
  return options;
}
exports.parseOptions = parseOptions;

// Expands wildcards with matching (ie. existing) file names.
// For example:
//   expand(['file*.js']) = ['file1.js', 'file2.js', ...]
//   (if the files 'file1.js', 'file2.js', etc, exist in the current dir)
function expand(list) {
  if (!Array.isArray(list)) {
    throw new TypeError('must be an array');
  }
  var expanded = [];
  list.forEach(function (listEl) {
    // Don't expand non-strings
    if (typeof listEl !== 'string') {
      expanded.push(listEl);
    } else {
      var ret;
      try {
        ret = glob.sync(listEl, config.globOptions);
        // if nothing matched, interpret the string literally
        ret = ret.length > 0 ? ret : [listEl];
      } catch (e) {
        // if glob fails, interpret the string literally
        ret = [listEl];
      }
      expanded = expanded.concat(ret);
    }
  });
  return expanded;
}
exports.expand = expand;

// Normalizes Buffer creation, using Buffer.alloc if possible.
// Also provides a good default buffer length for most use cases.
var buffer = typeof Buffer.alloc === 'function' ?
  function (len) {
    return Buffer.alloc(len || config.bufLength);
  } :
  function (len) {
    return new Buffer(len || config.bufLength);
  };
exports.buffer = buffer;

// Normalizes _unlinkSync() across platforms to match Unix behavior, i.e.
// file can be unlinked even if it's read-only, see https://github.com/joyent/node/issues/3006
function unlinkSync(file) {
  try {
    fs.unlinkSync(file);
  } catch (e) {
    // Try to override file permission
    /* istanbul ignore next */
    if (e.code === 'EPERM') {
      fs.chmodSync(file, '0666');
      fs.unlinkSync(file);
    } else {
      throw e;
    }
  }
}
exports.unlinkSync = unlinkSync;

// e.g. 'shelljs_a5f185d0443ca...'
function randomFileName() {
  function randomHash(count) {
    if (count === 1) {
      return parseInt(16 * Math.random(), 10).toString(16);
    }
    var hash = '';
    for (var i = 0; i < count; i++) {
      hash += randomHash(1);
    }
    return hash;
  }

  return 'shelljs_' + randomHash(20);
}
exports.randomFileName = randomFileName;

// Common wrapper for all Unix-like commands that performs glob expansion,
// command-logging, and other nice things
function wrap(cmd, fn, options) {
  options = options || {};
  if (options.canReceivePipe) {
    pipeMethods.push(cmd);
  }
  return function () {
    var retValue = null;

    state.currentCmd = cmd;
    state.error = null;
    state.errorCode = 0;

    try {
      var args = [].slice.call(arguments, 0);

      // Log the command to stderr, if appropriate
      if (config.verbose) {
        console.error.apply(console, [cmd].concat(args));
      }

      // If this is coming from a pipe, let's set the pipedValue (otherwise, set
      // it to the empty string)
      state.pipedValue = (this && typeof this.stdout === 'string') ? this.stdout : '';

      if (options.unix === false) { // this branch is for exec()
        retValue = fn.apply(this, args);
      } else { // and this branch is for everything else
        if (isObject(args[0]) && args[0].constructor.name === 'Object') {
          // a no-op, allowing the syntax `touch({'-r': file}, ...)`
        } else if (args.length === 0 || typeof args[0] !== 'string' || args[0].length <= 1 || args[0][0] !== '-') {
          args.unshift(''); // only add dummy option if '-option' not already present
        }

        // flatten out arrays that are arguments, to make the syntax:
        //    `cp([file1, file2, file3], dest);`
        // equivalent to:
        //    `cp(file1, file2, file3, dest);`
        args = args.reduce(function (accum, cur) {
          if (Array.isArray(cur)) {
            return accum.concat(cur);
          }
          accum.push(cur);
          return accum;
        }, []);

        // Convert ShellStrings (basically just String objects) to regular strings
        args = args.map(function (arg) {
          if (isObject(arg) && arg.constructor.name === 'String') {
            return arg.toString();
          }
          return arg;
        });

        // Expand the '~' if appropriate
        var homeDir = getUserHome();
        args = args.map(function (arg) {
          if (typeof arg === 'string' && arg.slice(0, 2) === '~/' || arg === '~') {
            return arg.replace(/^~/, homeDir);
          }
          return arg;
        });

        // Perform glob-expansion on all arguments after globStart, but preserve
        // the arguments before it (like regexes for sed and grep)
        if (!config.noglob && options.allowGlobbing === true) {
          args = args.slice(0, options.globStart).concat(expand(args.slice(options.globStart)));
        }

        try {
          // parse options if options are provided
          if (isObject(options.cmdOptions)) {
            args[0] = parseOptions(args[0], options.cmdOptions);
          }

          retValue = fn.apply(this, args);
        } catch (e) {
          /* istanbul ignore else */
          if (e.msg === 'earlyExit') {
            retValue = e.retValue;
          } else {
            throw e; // this is probably a bug that should be thrown up the call stack
          }
        }
      }
    } catch (e) {
      /* istanbul ignore next */
      if (!state.error) {
        // If state.error hasn't been set it's an error thrown by Node, not us - probably a bug...
        console.error('ShellJS: internal error');
        console.error(e.stack || e);
        process.exit(1);
      }
      if (config.fatal) throw e;
    }

    if (options.wrapOutput &&
        (typeof retValue === 'string' || Array.isArray(retValue))) {
      retValue = new ShellString(retValue, state.error, state.errorCode);
    }

    state.currentCmd = 'shell.js';
    return retValue;
  };
} // wrap
exports.wrap = wrap;

// This returns all the input that is piped into the current command (or the
// empty string, if this isn't on the right-hand side of a pipe
function _readFromPipe() {
  return state.pipedValue;
}
exports.readFromPipe = _readFromPipe;

var DEFAULT_WRAP_OPTIONS = {
  allowGlobbing: true,
  canReceivePipe: false,
  cmdOptions: false,
  globStart: 1,
  pipeOnly: false,
  unix: true,
  wrapOutput: true,
  overWrite: false,
};

// Register a new ShellJS command
function _register(name, implementation, wrapOptions) {
  wrapOptions = wrapOptions || {};
  // If an option isn't specified, use the default
  wrapOptions = objectAssign({}, DEFAULT_WRAP_OPTIONS, wrapOptions);

  if (shell[name] && !wrapOptions.overWrite) {
    throw new Error('unable to overwrite `' + name + '` command');
  }

  if (wrapOptions.pipeOnly) {
    wrapOptions.canReceivePipe = true;
    shellMethods[name] = wrap(name, implementation, wrapOptions);
  } else {
    shell[name] = wrap(name, implementation, wrapOptions);
  }
}
exports.register = _register;


/***/ }),
/* 1 */
/***/ (function(module, exports) {

module.exports = require("fs");

/***/ }),
/* 2 */
/***/ (function(module, exports) {

module.exports = require("path");

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * For type-checking Javascript values.
 * @module typical
 * @typicalname t
 * @example
 * const t = require('typical')
 */
exports.isNumber = isNumber
exports.isString = isString
exports.isBoolean = isBoolean
exports.isPlainObject = isPlainObject
exports.isArrayLike = isArrayLike
exports.isObject = isObject
exports.isDefined = isDefined
exports.isFunction = isFunction
exports.isClass = isClass
exports.isPrimitive = isPrimitive
exports.isPromise = isPromise
exports.isIterable = isIterable

/**
 * Returns true if input is a number
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 * @example
 * > t.isNumber(0)
 * true
 * > t.isNumber(1)
 * true
 * > t.isNumber(1.1)
 * true
 * > t.isNumber(0xff)
 * true
 * > t.isNumber(0644)
 * true
 * > t.isNumber(6.2e5)
 * true
 * > t.isNumber(NaN)
 * false
 * > t.isNumber(Infinity)
 * false
 */
function isNumber (n) {
  return !isNaN(parseFloat(n)) && isFinite(n)
}

/**
 * A plain object is a simple object literal, it is not an instance of a class. Returns true if the input `typeof` is `object` and directly decends from `Object`.
 *
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 * @example
 * > t.isPlainObject({ clive: 'hater' })
 * true
 * > t.isPlainObject(new Date())
 * false
 * > t.isPlainObject([ 0, 1 ])
 * false
 * > t.isPlainObject(1)
 * false
 * > t.isPlainObject(/test/)
 * false
 */
function isPlainObject (input) {
  return input !== null && typeof input === 'object' && input.constructor === Object
}

/**
 * An array-like value has all the properties of an array, but is not an array instance. Examples in the `arguments` object. Returns true if the input value is an object, not null and has a `length` property with a numeric value.
 *
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 * @example
 * function sum(x, y){
 *     console.log(t.isArrayLike(arguments))
 *     // prints `true`
 * }
 */
function isArrayLike (input) {
  return isObject(input) && typeof input.length === 'number'
}

/**
 * returns true if the typeof input is `'object'`, but not null!
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 */
function isObject (input) {
  return typeof input === 'object' && input !== null
}

/**
 * Returns true if the input value is defined
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 */
function isDefined (input) {
  return typeof input !== 'undefined'
}

/**
 * Returns true if the input value is a string
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 */
function isString (input) {
  return typeof input === 'string'
}

/**
 * Returns true if the input value is a boolean
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 */
function isBoolean (input) {
  return typeof input === 'boolean'
}

/**
 * Returns true if the input value is a function
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 */
function isFunction (input) {
  return typeof input === 'function'
}

/**
 * Returns true if the input value is an es2015 `class`.
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 */
function isClass (input) {
  if (isFunction(input)) {
    return /^class /.test(Function.prototype.toString.call(input))
  } else {
    return false
  }
}

/**
 * Returns true if the input is a string, number, symbol, boolean, null or undefined value.
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 */
function isPrimitive (input) {
  if (input === null) return true
  switch (typeof input) {
    case "string":
    case "number":
    case "symbol":
    case "undefined":
    case "boolean":
      return true
    default:
      return false
  }
}

/**
 * Returns true if the input is a Promise.
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 */
function isPromise (input) {
  if (input) {
    var isPromise = isDefined(Promise) && input instanceof Promise
    var isThenable = input.then && typeof input.then === 'function'
    return isPromise || isThenable ? true : false
  } else {
    return false
  }
}

/**
 * Returns true if the input is an iterable (`Map`, `Set`, `Array` etc.).
 * @param {*} - the input to test
 * @returns {boolean}
 * @static
 */
function isIterable (input) {
  if (input === null || !isDefined(input)) {
    return false
  } else {
    return typeof input[Symbol.iterator] === 'function'
  }
}


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

/**
 * @module array-back
 * @example
 * const arrayify = require('array-back')
 */
module.exports = arrayify

/**
 * Takes any input and guarantees an array back.
 *
 * - converts array-like objects (e.g. `arguments`) to a real array
 * - converts `undefined` to an empty array
 * - converts any another other, singular value (including `null`) into an array containing that value
 * - ignores input which is already an array
 *
 * @param {*} - the input value to convert to an array
 * @returns {Array}
 * @alias module:array-back
 * @example
 * > a.arrayify(undefined)
 * []
 *
 * > a.arrayify(null)
 * [ null ]
 *
 * > a.arrayify(0)
 * [ 0 ]
 *
 * > a.arrayify([ 1, 2 ])
 * [ 1, 2 ]
 *
 * > function f(){ return a.arrayify(arguments); }
 * > f(1,2,3)
 * [ 1, 2, 3 ]
 */
function arrayify (input) {
  const t = __webpack_require__(3)
  if (Array.isArray(input)) {
    return input
  } else {
    if (input === undefined) {
      return []
    } else if (t.isArrayLike(input)) {
      return Array.prototype.slice.call(input)
    } else {
      return [ input ]
    }
  }
}


/***/ }),
/* 5 */
/***/ (function(module, exports) {

module.exports = require("os");

/***/ }),
/* 6 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


class ArgRegExp extends RegExp {
  name (arg) {
    return arg.match(this)[1]
  }
}

exports.short = new ArgRegExp('^-([^\\d-])$')
exports.long = new ArgRegExp('^--(\\S+)')
exports.combined = new ArgRegExp('^-([^\\d-]{2,})$')
exports.isOption = arg => exports.short.test(arg) || exports.long.test(arg)
exports.optEquals = new ArgRegExp('^(--\\S+?)=(.*)')
exports.VALUE_MARKER = '552f3a31-14cd-4ced-bd67-656a659e9efb' // must be unique


/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

// Approach:
//
// 1. Get the minimatch set
// 2. For each pattern in the set, PROCESS(pattern, false)
// 3. Store matches per-set, then uniq them
//
// PROCESS(pattern, inGlobStar)
// Get the first [n] items from pattern that are all strings
// Join these together.  This is PREFIX.
//   If there is no more remaining, then stat(PREFIX) and
//   add to matches if it succeeds.  END.
//
// If inGlobStar and PREFIX is symlink and points to dir
//   set ENTRIES = []
// else readdir(PREFIX) as ENTRIES
//   If fail, END
//
// with ENTRIES
//   If pattern[n] is GLOBSTAR
//     // handle the case where the globstar match is empty
//     // by pruning it out, and testing the resulting pattern
//     PROCESS(pattern[0..n] + pattern[n+1 .. $], false)
//     // handle other cases.
//     for ENTRY in ENTRIES (not dotfiles)
//       // attach globstar + tail onto the entry
//       // Mark that this entry is a globstar match
//       PROCESS(pattern[0..n] + ENTRY + pattern[n .. $], true)
//
//   else // not globstar
//     for ENTRY in ENTRIES (not dotfiles, unless pattern[n] is dot)
//       Test ENTRY against pattern[n]
//       If fails, continue
//       If passes, PROCESS(pattern[0..n] + item + pattern[n+1 .. $])
//
// Caveat:
//   Cache all stats and readdirs results to minimize syscall.  Since all
//   we ever care about is existence and directory-ness, we can just keep
//   `true` for files, and [children,...] for directories, or `false` for
//   things that don't exist.

module.exports = glob

var fs = __webpack_require__(1)
var rp = __webpack_require__(20)
var minimatch = __webpack_require__(8)
var Minimatch = minimatch.Minimatch
var inherits = __webpack_require__(70)
var EE = __webpack_require__(72).EventEmitter
var path = __webpack_require__(2)
var assert = __webpack_require__(21)
var isAbsolute = __webpack_require__(10)
var globSync = __webpack_require__(73)
var common = __webpack_require__(22)
var alphasort = common.alphasort
var alphasorti = common.alphasorti
var setopts = common.setopts
var ownProp = common.ownProp
var inflight = __webpack_require__(74)
var util = __webpack_require__(9)
var childrenIgnored = common.childrenIgnored
var isIgnored = common.isIgnored

var once = __webpack_require__(24)

function glob (pattern, options, cb) {
  if (typeof options === 'function') cb = options, options = {}
  if (!options) options = {}

  if (options.sync) {
    if (cb)
      throw new TypeError('callback provided to sync glob')
    return globSync(pattern, options)
  }

  return new Glob(pattern, options, cb)
}

glob.sync = globSync
var GlobSync = glob.GlobSync = globSync.GlobSync

// old api surface
glob.glob = glob

function extend (origin, add) {
  if (add === null || typeof add !== 'object') {
    return origin
  }

  var keys = Object.keys(add)
  var i = keys.length
  while (i--) {
    origin[keys[i]] = add[keys[i]]
  }
  return origin
}

glob.hasMagic = function (pattern, options_) {
  var options = extend({}, options_)
  options.noprocess = true

  var g = new Glob(pattern, options)
  var set = g.minimatch.set

  if (!pattern)
    return false

  if (set.length > 1)
    return true

  for (var j = 0; j < set[0].length; j++) {
    if (typeof set[0][j] !== 'string')
      return true
  }

  return false
}

glob.Glob = Glob
inherits(Glob, EE)
function Glob (pattern, options, cb) {
  if (typeof options === 'function') {
    cb = options
    options = null
  }

  if (options && options.sync) {
    if (cb)
      throw new TypeError('callback provided to sync glob')
    return new GlobSync(pattern, options)
  }

  if (!(this instanceof Glob))
    return new Glob(pattern, options, cb)

  setopts(this, pattern, options)
  this._didRealPath = false

  // process each pattern in the minimatch set
  var n = this.minimatch.set.length

  // The matches are stored as {<filename>: true,...} so that
  // duplicates are automagically pruned.
  // Later, we do an Object.keys() on these.
  // Keep them as a list so we can fill in when nonull is set.
  this.matches = new Array(n)

  if (typeof cb === 'function') {
    cb = once(cb)
    this.on('error', cb)
    this.on('end', function (matches) {
      cb(null, matches)
    })
  }

  var self = this
  this._processing = 0

  this._emitQueue = []
  this._processQueue = []
  this.paused = false

  if (this.noprocess)
    return this

  if (n === 0)
    return done()

  var sync = true
  for (var i = 0; i < n; i ++) {
    this._process(this.minimatch.set[i], i, false, done)
  }
  sync = false

  function done () {
    --self._processing
    if (self._processing <= 0) {
      if (sync) {
        process.nextTick(function () {
          self._finish()
        })
      } else {
        self._finish()
      }
    }
  }
}

Glob.prototype._finish = function () {
  assert(this instanceof Glob)
  if (this.aborted)
    return

  if (this.realpath && !this._didRealpath)
    return this._realpath()

  common.finish(this)
  this.emit('end', this.found)
}

Glob.prototype._realpath = function () {
  if (this._didRealpath)
    return

  this._didRealpath = true

  var n = this.matches.length
  if (n === 0)
    return this._finish()

  var self = this
  for (var i = 0; i < this.matches.length; i++)
    this._realpathSet(i, next)

  function next () {
    if (--n === 0)
      self._finish()
  }
}

Glob.prototype._realpathSet = function (index, cb) {
  var matchset = this.matches[index]
  if (!matchset)
    return cb()

  var found = Object.keys(matchset)
  var self = this
  var n = found.length

  if (n === 0)
    return cb()

  var set = this.matches[index] = Object.create(null)
  found.forEach(function (p, i) {
    // If there's a problem with the stat, then it means that
    // one or more of the links in the realpath couldn't be
    // resolved.  just return the abs value in that case.
    p = self._makeAbs(p)
    rp.realpath(p, self.realpathCache, function (er, real) {
      if (!er)
        set[real] = true
      else if (er.syscall === 'stat')
        set[p] = true
      else
        self.emit('error', er) // srsly wtf right here

      if (--n === 0) {
        self.matches[index] = set
        cb()
      }
    })
  })
}

Glob.prototype._mark = function (p) {
  return common.mark(this, p)
}

Glob.prototype._makeAbs = function (f) {
  return common.makeAbs(this, f)
}

Glob.prototype.abort = function () {
  this.aborted = true
  this.emit('abort')
}

Glob.prototype.pause = function () {
  if (!this.paused) {
    this.paused = true
    this.emit('pause')
  }
}

Glob.prototype.resume = function () {
  if (this.paused) {
    this.emit('resume')
    this.paused = false
    if (this._emitQueue.length) {
      var eq = this._emitQueue.slice(0)
      this._emitQueue.length = 0
      for (var i = 0; i < eq.length; i ++) {
        var e = eq[i]
        this._emitMatch(e[0], e[1])
      }
    }
    if (this._processQueue.length) {
      var pq = this._processQueue.slice(0)
      this._processQueue.length = 0
      for (var i = 0; i < pq.length; i ++) {
        var p = pq[i]
        this._processing--
        this._process(p[0], p[1], p[2], p[3])
      }
    }
  }
}

Glob.prototype._process = function (pattern, index, inGlobStar, cb) {
  assert(this instanceof Glob)
  assert(typeof cb === 'function')

  if (this.aborted)
    return

  this._processing++
  if (this.paused) {
    this._processQueue.push([pattern, index, inGlobStar, cb])
    return
  }

  //console.error('PROCESS %d', this._processing, pattern)

  // Get the first [n] parts of pattern that are all strings.
  var n = 0
  while (typeof pattern[n] === 'string') {
    n ++
  }
  // now n is the index of the first one that is *not* a string.

  // see if there's anything else
  var prefix
  switch (n) {
    // if not, then this is rather simple
    case pattern.length:
      this._processSimple(pattern.join('/'), index, cb)
      return

    case 0:
      // pattern *starts* with some non-trivial item.
      // going to readdir(cwd), but not include the prefix in matches.
      prefix = null
      break

    default:
      // pattern has some string bits in the front.
      // whatever it starts with, whether that's 'absolute' like /foo/bar,
      // or 'relative' like '../baz'
      prefix = pattern.slice(0, n).join('/')
      break
  }

  var remain = pattern.slice(n)

  // get the list of entries.
  var read
  if (prefix === null)
    read = '.'
  else if (isAbsolute(prefix) || isAbsolute(pattern.join('/'))) {
    if (!prefix || !isAbsolute(prefix))
      prefix = '/' + prefix
    read = prefix
  } else
    read = prefix

  var abs = this._makeAbs(read)

  //if ignored, skip _processing
  if (childrenIgnored(this, read))
    return cb()

  var isGlobStar = remain[0] === minimatch.GLOBSTAR
  if (isGlobStar)
    this._processGlobStar(prefix, read, abs, remain, index, inGlobStar, cb)
  else
    this._processReaddir(prefix, read, abs, remain, index, inGlobStar, cb)
}

Glob.prototype._processReaddir = function (prefix, read, abs, remain, index, inGlobStar, cb) {
  var self = this
  this._readdir(abs, inGlobStar, function (er, entries) {
    return self._processReaddir2(prefix, read, abs, remain, index, inGlobStar, entries, cb)
  })
}

Glob.prototype._processReaddir2 = function (prefix, read, abs, remain, index, inGlobStar, entries, cb) {

  // if the abs isn't a dir, then nothing can match!
  if (!entries)
    return cb()

  // It will only match dot entries if it starts with a dot, or if
  // dot is set.  Stuff like @(.foo|.bar) isn't allowed.
  var pn = remain[0]
  var negate = !!this.minimatch.negate
  var rawGlob = pn._glob
  var dotOk = this.dot || rawGlob.charAt(0) === '.'

  var matchedEntries = []
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i]
    if (e.charAt(0) !== '.' || dotOk) {
      var m
      if (negate && !prefix) {
        m = !e.match(pn)
      } else {
        m = e.match(pn)
      }
      if (m)
        matchedEntries.push(e)
    }
  }

  //console.error('prd2', prefix, entries, remain[0]._glob, matchedEntries)

  var len = matchedEntries.length
  // If there are no matched entries, then nothing matches.
  if (len === 0)
    return cb()

  // if this is the last remaining pattern bit, then no need for
  // an additional stat *unless* the user has specified mark or
  // stat explicitly.  We know they exist, since readdir returned
  // them.

  if (remain.length === 1 && !this.mark && !this.stat) {
    if (!this.matches[index])
      this.matches[index] = Object.create(null)

    for (var i = 0; i < len; i ++) {
      var e = matchedEntries[i]
      if (prefix) {
        if (prefix !== '/')
          e = prefix + '/' + e
        else
          e = prefix + e
      }

      if (e.charAt(0) === '/' && !this.nomount) {
        e = path.join(this.root, e)
      }
      this._emitMatch(index, e)
    }
    // This was the last one, and no stats were needed
    return cb()
  }

  // now test all matched entries as stand-ins for that part
  // of the pattern.
  remain.shift()
  for (var i = 0; i < len; i ++) {
    var e = matchedEntries[i]
    var newPattern
    if (prefix) {
      if (prefix !== '/')
        e = prefix + '/' + e
      else
        e = prefix + e
    }
    this._process([e].concat(remain), index, inGlobStar, cb)
  }
  cb()
}

Glob.prototype._emitMatch = function (index, e) {
  if (this.aborted)
    return

  if (isIgnored(this, e))
    return

  if (this.paused) {
    this._emitQueue.push([index, e])
    return
  }

  var abs = isAbsolute(e) ? e : this._makeAbs(e)

  if (this.mark)
    e = this._mark(e)

  if (this.absolute)
    e = abs

  if (this.matches[index][e])
    return

  if (this.nodir) {
    var c = this.cache[abs]
    if (c === 'DIR' || Array.isArray(c))
      return
  }

  this.matches[index][e] = true

  var st = this.statCache[abs]
  if (st)
    this.emit('stat', e, st)

  this.emit('match', e)
}

Glob.prototype._readdirInGlobStar = function (abs, cb) {
  if (this.aborted)
    return

  // follow all symlinked directories forever
  // just proceed as if this is a non-globstar situation
  if (this.follow)
    return this._readdir(abs, false, cb)

  var lstatkey = 'lstat\0' + abs
  var self = this
  var lstatcb = inflight(lstatkey, lstatcb_)

  if (lstatcb)
    fs.lstat(abs, lstatcb)

  function lstatcb_ (er, lstat) {
    if (er && er.code === 'ENOENT')
      return cb()

    var isSym = lstat && lstat.isSymbolicLink()
    self.symlinks[abs] = isSym

    // If it's not a symlink or a dir, then it's definitely a regular file.
    // don't bother doing a readdir in that case.
    if (!isSym && lstat && !lstat.isDirectory()) {
      self.cache[abs] = 'FILE'
      cb()
    } else
      self._readdir(abs, false, cb)
  }
}

Glob.prototype._readdir = function (abs, inGlobStar, cb) {
  if (this.aborted)
    return

  cb = inflight('readdir\0'+abs+'\0'+inGlobStar, cb)
  if (!cb)
    return

  //console.error('RD %j %j', +inGlobStar, abs)
  if (inGlobStar && !ownProp(this.symlinks, abs))
    return this._readdirInGlobStar(abs, cb)

  if (ownProp(this.cache, abs)) {
    var c = this.cache[abs]
    if (!c || c === 'FILE')
      return cb()

    if (Array.isArray(c))
      return cb(null, c)
  }

  var self = this
  fs.readdir(abs, readdirCb(this, abs, cb))
}

function readdirCb (self, abs, cb) {
  return function (er, entries) {
    if (er)
      self._readdirError(abs, er, cb)
    else
      self._readdirEntries(abs, entries, cb)
  }
}

Glob.prototype._readdirEntries = function (abs, entries, cb) {
  if (this.aborted)
    return

  // if we haven't asked to stat everything, then just
  // assume that everything in there exists, so we can avoid
  // having to stat it a second time.
  if (!this.mark && !this.stat) {
    for (var i = 0; i < entries.length; i ++) {
      var e = entries[i]
      if (abs === '/')
        e = abs + e
      else
        e = abs + '/' + e
      this.cache[e] = true
    }
  }

  this.cache[abs] = entries
  return cb(null, entries)
}

Glob.prototype._readdirError = function (f, er, cb) {
  if (this.aborted)
    return

  // handle errors, and cache the information
  switch (er.code) {
    case 'ENOTSUP': // https://github.com/isaacs/node-glob/issues/205
    case 'ENOTDIR': // totally normal. means it *does* exist.
      var abs = this._makeAbs(f)
      this.cache[abs] = 'FILE'
      if (abs === this.cwdAbs) {
        var error = new Error(er.code + ' invalid cwd ' + this.cwd)
        error.path = this.cwd
        error.code = er.code
        this.emit('error', error)
        this.abort()
      }
      break

    case 'ENOENT': // not terribly unusual
    case 'ELOOP':
    case 'ENAMETOOLONG':
    case 'UNKNOWN':
      this.cache[this._makeAbs(f)] = false
      break

    default: // some unusual error.  Treat as failure.
      this.cache[this._makeAbs(f)] = false
      if (this.strict) {
        this.emit('error', er)
        // If the error is handled, then we abort
        // if not, we threw out of here
        this.abort()
      }
      if (!this.silent)
        console.error('glob error', er)
      break
  }

  return cb()
}

Glob.prototype._processGlobStar = function (prefix, read, abs, remain, index, inGlobStar, cb) {
  var self = this
  this._readdir(abs, inGlobStar, function (er, entries) {
    self._processGlobStar2(prefix, read, abs, remain, index, inGlobStar, entries, cb)
  })
}


Glob.prototype._processGlobStar2 = function (prefix, read, abs, remain, index, inGlobStar, entries, cb) {
  //console.error('pgs2', prefix, remain[0], entries)

  // no entries means not a dir, so it can never have matches
  // foo.txt/** doesn't match foo.txt
  if (!entries)
    return cb()

  // test without the globstar, and with every child both below
  // and replacing the globstar.
  var remainWithoutGlobStar = remain.slice(1)
  var gspref = prefix ? [ prefix ] : []
  var noGlobStar = gspref.concat(remainWithoutGlobStar)

  // the noGlobStar pattern exits the inGlobStar state
  this._process(noGlobStar, index, false, cb)

  var isSym = this.symlinks[abs]
  var len = entries.length

  // If it's a symlink, and we're in a globstar, then stop
  if (isSym && inGlobStar)
    return cb()

  for (var i = 0; i < len; i++) {
    var e = entries[i]
    if (e.charAt(0) === '.' && !this.dot)
      continue

    // these two cases enter the inGlobStar state
    var instead = gspref.concat(entries[i], remainWithoutGlobStar)
    this._process(instead, index, true, cb)

    var below = gspref.concat(entries[i], remain)
    this._process(below, index, true, cb)
  }

  cb()
}

Glob.prototype._processSimple = function (prefix, index, cb) {
  // XXX review this.  Shouldn't it be doing the mounting etc
  // before doing stat?  kinda weird?
  var self = this
  this._stat(prefix, function (er, exists) {
    self._processSimple2(prefix, index, er, exists, cb)
  })
}
Glob.prototype._processSimple2 = function (prefix, index, er, exists, cb) {

  //console.error('ps2', prefix, exists)

  if (!this.matches[index])
    this.matches[index] = Object.create(null)

  // If it doesn't exist, then just mark the lack of results
  if (!exists)
    return cb()

  if (prefix && isAbsolute(prefix) && !this.nomount) {
    var trail = /[\/\\]$/.test(prefix)
    if (prefix.charAt(0) === '/') {
      prefix = path.join(this.root, prefix)
    } else {
      prefix = path.resolve(this.root, prefix)
      if (trail)
        prefix += '/'
    }
  }

  if (process.platform === 'win32')
    prefix = prefix.replace(/\\/g, '/')

  // Mark this as a match
  this._emitMatch(index, prefix)
  cb()
}

// Returns either 'DIR', 'FILE', or false
Glob.prototype._stat = function (f, cb) {
  var abs = this._makeAbs(f)
  var needDir = f.slice(-1) === '/'

  if (f.length > this.maxLength)
    return cb()

  if (!this.stat && ownProp(this.cache, abs)) {
    var c = this.cache[abs]

    if (Array.isArray(c))
      c = 'DIR'

    // It exists, but maybe not how we need it
    if (!needDir || c === 'DIR')
      return cb(null, c)

    if (needDir && c === 'FILE')
      return cb()

    // otherwise we have to stat, because maybe c=true
    // if we know it exists, but not what it is.
  }

  var exists
  var stat = this.statCache[abs]
  if (stat !== undefined) {
    if (stat === false)
      return cb(null, stat)
    else {
      var type = stat.isDirectory() ? 'DIR' : 'FILE'
      if (needDir && type === 'FILE')
        return cb()
      else
        return cb(null, type, stat)
    }
  }

  var self = this
  var statcb = inflight('stat\0' + abs, lstatcb_)
  if (statcb)
    fs.lstat(abs, statcb)

  function lstatcb_ (er, lstat) {
    if (lstat && lstat.isSymbolicLink()) {
      // If it's a symlink, then treat it as the target, unless
      // the target does not exist, then treat it as a file.
      return fs.stat(abs, function (er, stat) {
        if (er)
          self._stat2(f, abs, null, lstat, cb)
        else
          self._stat2(f, abs, er, stat, cb)
      })
    } else {
      self._stat2(f, abs, er, lstat, cb)
    }
  }
}

Glob.prototype._stat2 = function (f, abs, er, stat, cb) {
  if (er && (er.code === 'ENOENT' || er.code === 'ENOTDIR')) {
    this.statCache[abs] = false
    return cb()
  }

  var needDir = f.slice(-1) === '/'
  this.statCache[abs] = stat

  if (abs.slice(-1) === '/' && stat && !stat.isDirectory())
    return cb(null, false, stat)

  var c = true
  if (stat)
    c = stat.isDirectory() ? 'DIR' : 'FILE'
  this.cache[abs] = this.cache[abs] || c

  if (needDir && c === 'FILE')
    return cb()

  return cb(null, c, stat)
}


/***/ }),
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = minimatch
minimatch.Minimatch = Minimatch

var path = { sep: '/' }
try {
  path = __webpack_require__(2)
} catch (er) {}

var GLOBSTAR = minimatch.GLOBSTAR = Minimatch.GLOBSTAR = {}
var expand = __webpack_require__(67)

var plTypes = {
  '!': { open: '(?:(?!(?:', close: '))[^/]*?)'},
  '?': { open: '(?:', close: ')?' },
  '+': { open: '(?:', close: ')+' },
  '*': { open: '(?:', close: ')*' },
  '@': { open: '(?:', close: ')' }
}

// any single thing other than /
// don't need to escape / when using new RegExp()
var qmark = '[^/]'

// * => any number of characters
var star = qmark + '*?'

// ** when dots are allowed.  Anything goes, except .. and .
// not (^ or / followed by one or two dots followed by $ or /),
// followed by anything, any number of times.
var twoStarDot = '(?:(?!(?:\\\/|^)(?:\\.{1,2})($|\\\/)).)*?'

// not a ^ or / followed by a dot,
// followed by anything, any number of times.
var twoStarNoDot = '(?:(?!(?:\\\/|^)\\.).)*?'

// characters that need to be escaped in RegExp.
var reSpecials = charSet('().*{}+?[]^$\\!')

// "abc" -> { a:true, b:true, c:true }
function charSet (s) {
  return s.split('').reduce(function (set, c) {
    set[c] = true
    return set
  }, {})
}

// normalizes slashes.
var slashSplit = /\/+/

minimatch.filter = filter
function filter (pattern, options) {
  options = options || {}
  return function (p, i, list) {
    return minimatch(p, pattern, options)
  }
}

function ext (a, b) {
  a = a || {}
  b = b || {}
  var t = {}
  Object.keys(b).forEach(function (k) {
    t[k] = b[k]
  })
  Object.keys(a).forEach(function (k) {
    t[k] = a[k]
  })
  return t
}

minimatch.defaults = function (def) {
  if (!def || !Object.keys(def).length) return minimatch

  var orig = minimatch

  var m = function minimatch (p, pattern, options) {
    return orig.minimatch(p, pattern, ext(def, options))
  }

  m.Minimatch = function Minimatch (pattern, options) {
    return new orig.Minimatch(pattern, ext(def, options))
  }

  return m
}

Minimatch.defaults = function (def) {
  if (!def || !Object.keys(def).length) return Minimatch
  return minimatch.defaults(def).Minimatch
}

function minimatch (p, pattern, options) {
  if (typeof pattern !== 'string') {
    throw new TypeError('glob pattern string required')
  }

  if (!options) options = {}

  // shortcut: comments match nothing.
  if (!options.nocomment && pattern.charAt(0) === '#') {
    return false
  }

  // "" only matches ""
  if (pattern.trim() === '') return p === ''

  return new Minimatch(pattern, options).match(p)
}

function Minimatch (pattern, options) {
  if (!(this instanceof Minimatch)) {
    return new Minimatch(pattern, options)
  }

  if (typeof pattern !== 'string') {
    throw new TypeError('glob pattern string required')
  }

  if (!options) options = {}
  pattern = pattern.trim()

  // windows support: need to use /, not \
  if (path.sep !== '/') {
    pattern = pattern.split(path.sep).join('/')
  }

  this.options = options
  this.set = []
  this.pattern = pattern
  this.regexp = null
  this.negate = false
  this.comment = false
  this.empty = false

  // make the set of regexps etc.
  this.make()
}

Minimatch.prototype.debug = function () {}

Minimatch.prototype.make = make
function make () {
  // don't do it more than once.
  if (this._made) return

  var pattern = this.pattern
  var options = this.options

  // empty patterns and comments match nothing.
  if (!options.nocomment && pattern.charAt(0) === '#') {
    this.comment = true
    return
  }
  if (!pattern) {
    this.empty = true
    return
  }

  // step 1: figure out negation, etc.
  this.parseNegate()

  // step 2: expand braces
  var set = this.globSet = this.braceExpand()

  if (options.debug) this.debug = console.error

  this.debug(this.pattern, set)

  // step 3: now we have a set, so turn each one into a series of path-portion
  // matching patterns.
  // These will be regexps, except in the case of "**", which is
  // set to the GLOBSTAR object for globstar behavior,
  // and will not contain any / characters
  set = this.globParts = set.map(function (s) {
    return s.split(slashSplit)
  })

  this.debug(this.pattern, set)

  // glob --> regexps
  set = set.map(function (s, si, set) {
    return s.map(this.parse, this)
  }, this)

  this.debug(this.pattern, set)

  // filter out everything that didn't compile properly.
  set = set.filter(function (s) {
    return s.indexOf(false) === -1
  })

  this.debug(this.pattern, set)

  this.set = set
}

Minimatch.prototype.parseNegate = parseNegate
function parseNegate () {
  var pattern = this.pattern
  var negate = false
  var options = this.options
  var negateOffset = 0

  if (options.nonegate) return

  for (var i = 0, l = pattern.length
    ; i < l && pattern.charAt(i) === '!'
    ; i++) {
    negate = !negate
    negateOffset++
  }

  if (negateOffset) this.pattern = pattern.substr(negateOffset)
  this.negate = negate
}

// Brace expansion:
// a{b,c}d -> abd acd
// a{b,}c -> abc ac
// a{0..3}d -> a0d a1d a2d a3d
// a{b,c{d,e}f}g -> abg acdfg acefg
// a{b,c}d{e,f}g -> abdeg acdeg abdeg abdfg
//
// Invalid sets are not expanded.
// a{2..}b -> a{2..}b
// a{b}c -> a{b}c
minimatch.braceExpand = function (pattern, options) {
  return braceExpand(pattern, options)
}

Minimatch.prototype.braceExpand = braceExpand

function braceExpand (pattern, options) {
  if (!options) {
    if (this instanceof Minimatch) {
      options = this.options
    } else {
      options = {}
    }
  }

  pattern = typeof pattern === 'undefined'
    ? this.pattern : pattern

  if (typeof pattern === 'undefined') {
    throw new TypeError('undefined pattern')
  }

  if (options.nobrace ||
    !pattern.match(/\{.*\}/)) {
    // shortcut. no need to expand.
    return [pattern]
  }

  return expand(pattern)
}

// parse a component of the expanded set.
// At this point, no pattern may contain "/" in it
// so we're going to return a 2d array, where each entry is the full
// pattern, split on '/', and then turned into a regular expression.
// A regexp is made at the end which joins each array with an
// escaped /, and another full one which joins each regexp with |.
//
// Following the lead of Bash 4.1, note that "**" only has special meaning
// when it is the *only* thing in a path portion.  Otherwise, any series
// of * is equivalent to a single *.  Globstar behavior is enabled by
// default, and can be disabled by setting options.noglobstar.
Minimatch.prototype.parse = parse
var SUBPARSE = {}
function parse (pattern, isSub) {
  if (pattern.length > 1024 * 64) {
    throw new TypeError('pattern is too long')
  }

  var options = this.options

  // shortcuts
  if (!options.noglobstar && pattern === '**') return GLOBSTAR
  if (pattern === '') return ''

  var re = ''
  var hasMagic = !!options.nocase
  var escaping = false
  // ? => one single character
  var patternListStack = []
  var negativeLists = []
  var stateChar
  var inClass = false
  var reClassStart = -1
  var classStart = -1
  // . and .. never match anything that doesn't start with .,
  // even when options.dot is set.
  var patternStart = pattern.charAt(0) === '.' ? '' // anything
  // not (start or / followed by . or .. followed by / or end)
  : options.dot ? '(?!(?:^|\\\/)\\.{1,2}(?:$|\\\/))'
  : '(?!\\.)'
  var self = this

  function clearStateChar () {
    if (stateChar) {
      // we had some state-tracking character
      // that wasn't consumed by this pass.
      switch (stateChar) {
        case '*':
          re += star
          hasMagic = true
        break
        case '?':
          re += qmark
          hasMagic = true
        break
        default:
          re += '\\' + stateChar
        break
      }
      self.debug('clearStateChar %j %j', stateChar, re)
      stateChar = false
    }
  }

  for (var i = 0, len = pattern.length, c
    ; (i < len) && (c = pattern.charAt(i))
    ; i++) {
    this.debug('%s\t%s %s %j', pattern, i, re, c)

    // skip over any that are escaped.
    if (escaping && reSpecials[c]) {
      re += '\\' + c
      escaping = false
      continue
    }

    switch (c) {
      case '/':
        // completely not allowed, even escaped.
        // Should already be path-split by now.
        return false

      case '\\':
        clearStateChar()
        escaping = true
      continue

      // the various stateChar values
      // for the "extglob" stuff.
      case '?':
      case '*':
      case '+':
      case '@':
      case '!':
        this.debug('%s\t%s %s %j <-- stateChar', pattern, i, re, c)

        // all of those are literals inside a class, except that
        // the glob [!a] means [^a] in regexp
        if (inClass) {
          this.debug('  in class')
          if (c === '!' && i === classStart + 1) c = '^'
          re += c
          continue
        }

        // if we already have a stateChar, then it means
        // that there was something like ** or +? in there.
        // Handle the stateChar, then proceed with this one.
        self.debug('call clearStateChar %j', stateChar)
        clearStateChar()
        stateChar = c
        // if extglob is disabled, then +(asdf|foo) isn't a thing.
        // just clear the statechar *now*, rather than even diving into
        // the patternList stuff.
        if (options.noext) clearStateChar()
      continue

      case '(':
        if (inClass) {
          re += '('
          continue
        }

        if (!stateChar) {
          re += '\\('
          continue
        }

        patternListStack.push({
          type: stateChar,
          start: i - 1,
          reStart: re.length,
          open: plTypes[stateChar].open,
          close: plTypes[stateChar].close
        })
        // negation is (?:(?!js)[^/]*)
        re += stateChar === '!' ? '(?:(?!(?:' : '(?:'
        this.debug('plType %j %j', stateChar, re)
        stateChar = false
      continue

      case ')':
        if (inClass || !patternListStack.length) {
          re += '\\)'
          continue
        }

        clearStateChar()
        hasMagic = true
        var pl = patternListStack.pop()
        // negation is (?:(?!js)[^/]*)
        // The others are (?:<pattern>)<type>
        re += pl.close
        if (pl.type === '!') {
          negativeLists.push(pl)
        }
        pl.reEnd = re.length
      continue

      case '|':
        if (inClass || !patternListStack.length || escaping) {
          re += '\\|'
          escaping = false
          continue
        }

        clearStateChar()
        re += '|'
      continue

      // these are mostly the same in regexp and glob
      case '[':
        // swallow any state-tracking char before the [
        clearStateChar()

        if (inClass) {
          re += '\\' + c
          continue
        }

        inClass = true
        classStart = i
        reClassStart = re.length
        re += c
      continue

      case ']':
        //  a right bracket shall lose its special
        //  meaning and represent itself in
        //  a bracket expression if it occurs
        //  first in the list.  -- POSIX.2 2.8.3.2
        if (i === classStart + 1 || !inClass) {
          re += '\\' + c
          escaping = false
          continue
        }

        // handle the case where we left a class open.
        // "[z-a]" is valid, equivalent to "\[z-a\]"
        if (inClass) {
          // split where the last [ was, make sure we don't have
          // an invalid re. if so, re-walk the contents of the
          // would-be class to re-translate any characters that
          // were passed through as-is
          // TODO: It would probably be faster to determine this
          // without a try/catch and a new RegExp, but it's tricky
          // to do safely.  For now, this is safe and works.
          var cs = pattern.substring(classStart + 1, i)
          try {
            RegExp('[' + cs + ']')
          } catch (er) {
            // not a valid class!
            var sp = this.parse(cs, SUBPARSE)
            re = re.substr(0, reClassStart) + '\\[' + sp[0] + '\\]'
            hasMagic = hasMagic || sp[1]
            inClass = false
            continue
          }
        }

        // finish up the class.
        hasMagic = true
        inClass = false
        re += c
      continue

      default:
        // swallow any state char that wasn't consumed
        clearStateChar()

        if (escaping) {
          // no need
          escaping = false
        } else if (reSpecials[c]
          && !(c === '^' && inClass)) {
          re += '\\'
        }

        re += c

    } // switch
  } // for

  // handle the case where we left a class open.
  // "[abc" is valid, equivalent to "\[abc"
  if (inClass) {
    // split where the last [ was, and escape it
    // this is a huge pita.  We now have to re-walk
    // the contents of the would-be class to re-translate
    // any characters that were passed through as-is
    cs = pattern.substr(classStart + 1)
    sp = this.parse(cs, SUBPARSE)
    re = re.substr(0, reClassStart) + '\\[' + sp[0]
    hasMagic = hasMagic || sp[1]
  }

  // handle the case where we had a +( thing at the *end*
  // of the pattern.
  // each pattern list stack adds 3 chars, and we need to go through
  // and escape any | chars that were passed through as-is for the regexp.
  // Go through and escape them, taking care not to double-escape any
  // | chars that were already escaped.
  for (pl = patternListStack.pop(); pl; pl = patternListStack.pop()) {
    var tail = re.slice(pl.reStart + pl.open.length)
    this.debug('setting tail', re, pl)
    // maybe some even number of \, then maybe 1 \, followed by a |
    tail = tail.replace(/((?:\\{2}){0,64})(\\?)\|/g, function (_, $1, $2) {
      if (!$2) {
        // the | isn't already escaped, so escape it.
        $2 = '\\'
      }

      // need to escape all those slashes *again*, without escaping the
      // one that we need for escaping the | character.  As it works out,
      // escaping an even number of slashes can be done by simply repeating
      // it exactly after itself.  That's why this trick works.
      //
      // I am sorry that you have to see this.
      return $1 + $1 + $2 + '|'
    })

    this.debug('tail=%j\n   %s', tail, tail, pl, re)
    var t = pl.type === '*' ? star
      : pl.type === '?' ? qmark
      : '\\' + pl.type

    hasMagic = true
    re = re.slice(0, pl.reStart) + t + '\\(' + tail
  }

  // handle trailing things that only matter at the very end.
  clearStateChar()
  if (escaping) {
    // trailing \\
    re += '\\\\'
  }

  // only need to apply the nodot start if the re starts with
  // something that could conceivably capture a dot
  var addPatternStart = false
  switch (re.charAt(0)) {
    case '.':
    case '[':
    case '(': addPatternStart = true
  }

  // Hack to work around lack of negative lookbehind in JS
  // A pattern like: *.!(x).!(y|z) needs to ensure that a name
  // like 'a.xyz.yz' doesn't match.  So, the first negative
  // lookahead, has to look ALL the way ahead, to the end of
  // the pattern.
  for (var n = negativeLists.length - 1; n > -1; n--) {
    var nl = negativeLists[n]

    var nlBefore = re.slice(0, nl.reStart)
    var nlFirst = re.slice(nl.reStart, nl.reEnd - 8)
    var nlLast = re.slice(nl.reEnd - 8, nl.reEnd)
    var nlAfter = re.slice(nl.reEnd)

    nlLast += nlAfter

    // Handle nested stuff like *(*.js|!(*.json)), where open parens
    // mean that we should *not* include the ) in the bit that is considered
    // "after" the negated section.
    var openParensBefore = nlBefore.split('(').length - 1
    var cleanAfter = nlAfter
    for (i = 0; i < openParensBefore; i++) {
      cleanAfter = cleanAfter.replace(/\)[+*?]?/, '')
    }
    nlAfter = cleanAfter

    var dollar = ''
    if (nlAfter === '' && isSub !== SUBPARSE) {
      dollar = '$'
    }
    var newRe = nlBefore + nlFirst + nlAfter + dollar + nlLast
    re = newRe
  }

  // if the re is not "" at this point, then we need to make sure
  // it doesn't match against an empty path part.
  // Otherwise a/* will match a/, which it should not.
  if (re !== '' && hasMagic) {
    re = '(?=.)' + re
  }

  if (addPatternStart) {
    re = patternStart + re
  }

  // parsing just a piece of a larger pattern.
  if (isSub === SUBPARSE) {
    return [re, hasMagic]
  }

  // skip the regexp for non-magical patterns
  // unescape anything in it, though, so that it'll be
  // an exact match against a file etc.
  if (!hasMagic) {
    return globUnescape(pattern)
  }

  var flags = options.nocase ? 'i' : ''
  try {
    var regExp = new RegExp('^' + re + '$', flags)
  } catch (er) {
    // If it was an invalid regular expression, then it can't match
    // anything.  This trick looks for a character after the end of
    // the string, which is of course impossible, except in multi-line
    // mode, but it's not a /m regex.
    return new RegExp('$.')
  }

  regExp._glob = pattern
  regExp._src = re

  return regExp
}

minimatch.makeRe = function (pattern, options) {
  return new Minimatch(pattern, options || {}).makeRe()
}

Minimatch.prototype.makeRe = makeRe
function makeRe () {
  if (this.regexp || this.regexp === false) return this.regexp

  // at this point, this.set is a 2d array of partial
  // pattern strings, or "**".
  //
  // It's better to use .match().  This function shouldn't
  // be used, really, but it's pretty convenient sometimes,
  // when you just want to work with a regex.
  var set = this.set

  if (!set.length) {
    this.regexp = false
    return this.regexp
  }
  var options = this.options

  var twoStar = options.noglobstar ? star
    : options.dot ? twoStarDot
    : twoStarNoDot
  var flags = options.nocase ? 'i' : ''

  var re = set.map(function (pattern) {
    return pattern.map(function (p) {
      return (p === GLOBSTAR) ? twoStar
      : (typeof p === 'string') ? regExpEscape(p)
      : p._src
    }).join('\\\/')
  }).join('|')

  // must match entire pattern
  // ending in a * or ** will make it less strict.
  re = '^(?:' + re + ')$'

  // can match anything, as long as it's not this.
  if (this.negate) re = '^(?!' + re + ').*$'

  try {
    this.regexp = new RegExp(re, flags)
  } catch (ex) {
    this.regexp = false
  }
  return this.regexp
}

minimatch.match = function (list, pattern, options) {
  options = options || {}
  var mm = new Minimatch(pattern, options)
  list = list.filter(function (f) {
    return mm.match(f)
  })
  if (mm.options.nonull && !list.length) {
    list.push(pattern)
  }
  return list
}

Minimatch.prototype.match = match
function match (f, partial) {
  this.debug('match', f, this.pattern)
  // short-circuit in the case of busted things.
  // comments, etc.
  if (this.comment) return false
  if (this.empty) return f === ''

  if (f === '/' && partial) return true

  var options = this.options

  // windows: need to use /, not \
  if (path.sep !== '/') {
    f = f.split(path.sep).join('/')
  }

  // treat the test path as a set of pathparts.
  f = f.split(slashSplit)
  this.debug(this.pattern, 'split', f)

  // just ONE of the pattern sets in this.set needs to match
  // in order for it to be valid.  If negating, then just one
  // match means that we have failed.
  // Either way, return on the first hit.

  var set = this.set
  this.debug(this.pattern, 'set', set)

  // Find the basename of the path by looking for the last non-empty segment
  var filename
  var i
  for (i = f.length - 1; i >= 0; i--) {
    filename = f[i]
    if (filename) break
  }

  for (i = 0; i < set.length; i++) {
    var pattern = set[i]
    var file = f
    if (options.matchBase && pattern.length === 1) {
      file = [filename]
    }
    var hit = this.matchOne(file, pattern, partial)
    if (hit) {
      if (options.flipNegate) return true
      return !this.negate
    }
  }

  // didn't get any hits.  this is success if it's a negative
  // pattern, failure otherwise.
  if (options.flipNegate) return false
  return this.negate
}

// set partial to true to test if, for example,
// "/a/b" matches the start of "/*/b/*/d"
// Partial means, if you run out of file before you run
// out of pattern, then that's fine, as long as all
// the parts match.
Minimatch.prototype.matchOne = function (file, pattern, partial) {
  var options = this.options

  this.debug('matchOne',
    { 'this': this, file: file, pattern: pattern })

  this.debug('matchOne', file.length, pattern.length)

  for (var fi = 0,
      pi = 0,
      fl = file.length,
      pl = pattern.length
      ; (fi < fl) && (pi < pl)
      ; fi++, pi++) {
    this.debug('matchOne loop')
    var p = pattern[pi]
    var f = file[fi]

    this.debug(pattern, p, f)

    // should be impossible.
    // some invalid regexp stuff in the set.
    if (p === false) return false

    if (p === GLOBSTAR) {
      this.debug('GLOBSTAR', [pattern, p, f])

      // "**"
      // a/**/b/**/c would match the following:
      // a/b/x/y/z/c
      // a/x/y/z/b/c
      // a/b/x/b/x/c
      // a/b/c
      // To do this, take the rest of the pattern after
      // the **, and see if it would match the file remainder.
      // If so, return success.
      // If not, the ** "swallows" a segment, and try again.
      // This is recursively awful.
      //
      // a/**/b/**/c matching a/b/x/y/z/c
      // - a matches a
      // - doublestar
      //   - matchOne(b/x/y/z/c, b/**/c)
      //     - b matches b
      //     - doublestar
      //       - matchOne(x/y/z/c, c) -> no
      //       - matchOne(y/z/c, c) -> no
      //       - matchOne(z/c, c) -> no
      //       - matchOne(c, c) yes, hit
      var fr = fi
      var pr = pi + 1
      if (pr === pl) {
        this.debug('** at the end')
        // a ** at the end will just swallow the rest.
        // We have found a match.
        // however, it will not swallow /.x, unless
        // options.dot is set.
        // . and .. are *never* matched by **, for explosively
        // exponential reasons.
        for (; fi < fl; fi++) {
          if (file[fi] === '.' || file[fi] === '..' ||
            (!options.dot && file[fi].charAt(0) === '.')) return false
        }
        return true
      }

      // ok, let's see if we can swallow whatever we can.
      while (fr < fl) {
        var swallowee = file[fr]

        this.debug('\nglobstar while', file, fr, pattern, pr, swallowee)

        // XXX remove this slice.  Just pass the start index.
        if (this.matchOne(file.slice(fr), pattern.slice(pr), partial)) {
          this.debug('globstar found match!', fr, fl, swallowee)
          // found a match.
          return true
        } else {
          // can't swallow "." or ".." ever.
          // can only swallow ".foo" when explicitly asked.
          if (swallowee === '.' || swallowee === '..' ||
            (!options.dot && swallowee.charAt(0) === '.')) {
            this.debug('dot detected!', file, fr, pattern, pr)
            break
          }

          // ** swallows a segment, and continue.
          this.debug('globstar swallow a segment, and continue')
          fr++
        }
      }

      // no match was found.
      // However, in partial mode, we can't say this is necessarily over.
      // If there's more *pattern* left, then
      if (partial) {
        // ran out of file
        this.debug('\n>>> no match, partial?', file, fr, pattern, pr)
        if (fr === fl) return true
      }
      return false
    }

    // something other than **
    // non-magic patterns just have to match exactly
    // patterns with magic have been turned into regexps.
    var hit
    if (typeof p === 'string') {
      if (options.nocase) {
        hit = f.toLowerCase() === p.toLowerCase()
      } else {
        hit = f === p
      }
      this.debug('string match', p, f, hit)
    } else {
      hit = f.match(p)
      this.debug('pattern match', p, f, hit)
    }

    if (!hit) return false
  }

  // Note: ending in / means that we'll get a final ""
  // at the end of the pattern.  This can only match a
  // corresponding "" at the end of the file.
  // If the file ends in /, then it can only match a
  // a pattern that ends in /, unless the pattern just
  // doesn't have any more for it. But, a/b/ should *not*
  // match "a/b/*", even though "" matches against the
  // [^/]*? pattern, except in partial mode, where it might
  // simply not be reached yet.
  // However, a/b/ should still satisfy a/*

  // now either we fell off the end of the pattern, or we're done.
  if (fi === fl && pi === pl) {
    // ran out of pattern and filename at the same time.
    // an exact hit!
    return true
  } else if (fi === fl) {
    // ran out of file, but still had pattern left.
    // this is ok if we're doing the match as part of
    // a glob fs traversal.
    return partial
  } else if (pi === pl) {
    // ran out of pattern, still have file left.
    // this is only acceptable if we're on the very last
    // empty segment of a file with a trailing slash.
    // a/* should match a/b/
    var emptyFileEnd = (fi === fl - 1) && (file[fi] === '')
    return emptyFileEnd
  }

  // should be unreachable.
  throw new Error('wtf?')
}

// replace stuff like \* with *
function globUnescape (s) {
  return s.replace(/\\(.)/g, '$1')
}

function regExpEscape (s) {
  return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}


/***/ }),
/* 9 */
/***/ (function(module, exports) {

module.exports = require("util");

/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


function posix(path) {
	return path.charAt(0) === '/';
}

function win32(path) {
	// https://github.com/nodejs/node/blob/b3fcc245fb25539909ef1d5eaa01dbf92e168633/lib/path.js#L56
	var splitDeviceRe = /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/;
	var result = splitDeviceRe.exec(path);
	var device = result[1] || '';
	var isUnc = Boolean(device && device.charAt(1) !== ':');

	// UNC paths are always absolute
	return Boolean(result[2] || isUnc);
}

module.exports = process.platform === 'win32' ? win32 : posix;
module.exports.posix = posix;
module.exports.win32 = win32;


/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

var fs = __webpack_require__(1);
var common = __webpack_require__(0);

common.register('cd', _cd, {});

//@
//@ ### cd([dir])
//@ Changes to directory `dir` for the duration of the script. Changes to home
//@ directory if no argument is supplied.
function _cd(options, dir) {
  if (!dir) dir = common.getUserHome();

  if (dir === '-') {
    if (!process.env.OLDPWD) {
      common.error('could not find previous directory');
    } else {
      dir = process.env.OLDPWD;
    }
  }

  try {
    var curDir = process.cwd();
    process.chdir(dir);
    process.env.OLDPWD = curDir;
  } catch (e) {
    // something went wrong, let's figure out the error
    var err;
    try {
      fs.statSync(dir); // if this succeeds, it must be some sort of file
      err = 'not a directory: ' + dir;
    } catch (e2) {
      err = 'no such file or directory: ' + dir;
    }
    if (err) common.error(err);
  }
  return '';
}
module.exports = _cd;


/***/ }),
/* 12 */
/***/ (function(module, exports, __webpack_require__) {

var fs = __webpack_require__(1);
var path = __webpack_require__(2);
var common = __webpack_require__(0);

common.register('cp', _cp, {
  cmdOptions: {
    'f': '!no_force',
    'n': 'no_force',
    'u': 'update',
    'R': 'recursive',
    'r': 'recursive',
    'L': 'followsymlink',
    'P': 'noFollowsymlink',
  },
  wrapOutput: false,
});

// Buffered file copy, synchronous
// (Using readFileSync() + writeFileSync() could easily cause a memory overflow
//  with large files)
function copyFileSync(srcFile, destFile, options) {
  if (!fs.existsSync(srcFile)) {
    common.error('copyFileSync: no such file or directory: ' + srcFile);
  }

  var isWindows = process.platform === 'win32';

  // Check the mtimes of the files if the '-u' flag is provided
  try {
    if (options.update && fs.statSync(srcFile).mtime < fs.statSync(destFile).mtime) {
      return;
    }
  } catch (e) {
    // If we're here, destFile probably doesn't exist, so just do a normal copy
  }

  if (fs.lstatSync(srcFile).isSymbolicLink() && !options.followsymlink) {
    try {
      fs.lstatSync(destFile);
      common.unlinkSync(destFile); // re-link it
    } catch (e) {
      // it doesn't exist, so no work needs to be done
    }

    var symlinkFull = fs.readlinkSync(srcFile);
    fs.symlinkSync(symlinkFull, destFile, isWindows ? 'junction' : null);
  } else {
    var buf = common.buffer();
    var bufLength = buf.length;
    var bytesRead = bufLength;
    var pos = 0;
    var fdr = null;
    var fdw = null;

    try {
      fdr = fs.openSync(srcFile, 'r');
    } catch (e) {
      /* istanbul ignore next */
      common.error('copyFileSync: could not read src file (' + srcFile + ')');
    }

    try {
      fdw = fs.openSync(destFile, 'w');
    } catch (e) {
      /* istanbul ignore next */
      common.error('copyFileSync: could not write to dest file (code=' + e.code + '):' + destFile);
    }

    while (bytesRead === bufLength) {
      bytesRead = fs.readSync(fdr, buf, 0, bufLength, pos);
      fs.writeSync(fdw, buf, 0, bytesRead);
      pos += bytesRead;
    }

    fs.closeSync(fdr);
    fs.closeSync(fdw);

    fs.chmodSync(destFile, fs.statSync(srcFile).mode);
  }
}

// Recursively copies 'sourceDir' into 'destDir'
// Adapted from https://github.com/ryanmcgrath/wrench-js
//
// Copyright (c) 2010 Ryan McGrath
// Copyright (c) 2012 Artur Adib
//
// Licensed under the MIT License
// http://www.opensource.org/licenses/mit-license.php
function cpdirSyncRecursive(sourceDir, destDir, currentDepth, opts) {
  if (!opts) opts = {};

  // Ensure there is not a run away recursive copy
  if (currentDepth >= common.config.maxdepth) return;
  currentDepth++;

  var isWindows = process.platform === 'win32';

  // Create the directory where all our junk is moving to; read the mode of the
  // source directory and mirror it
  try {
    var checkDir = fs.statSync(sourceDir);
    fs.mkdirSync(destDir, checkDir.mode);
  } catch (e) {
    // if the directory already exists, that's okay
    if (e.code !== 'EEXIST') throw e;
  }

  var files = fs.readdirSync(sourceDir);

  for (var i = 0; i < files.length; i++) {
    var srcFile = sourceDir + '/' + files[i];
    var destFile = destDir + '/' + files[i];
    var srcFileStat = fs.lstatSync(srcFile);

    var symlinkFull;
    if (opts.followsymlink) {
      if (cpcheckcycle(sourceDir, srcFile)) {
        // Cycle link found.
        console.error('Cycle link found.');
        symlinkFull = fs.readlinkSync(srcFile);
        fs.symlinkSync(symlinkFull, destFile, isWindows ? 'junction' : null);
        continue;
      }
    }
    if (srcFileStat.isDirectory()) {
      /* recursion this thing right on back. */
      cpdirSyncRecursive(srcFile, destFile, currentDepth, opts);
    } else if (srcFileStat.isSymbolicLink() && !opts.followsymlink) {
      symlinkFull = fs.readlinkSync(srcFile);
      try {
        fs.lstatSync(destFile);
        common.unlinkSync(destFile); // re-link it
      } catch (e) {
        // it doesn't exist, so no work needs to be done
      }
      fs.symlinkSync(symlinkFull, destFile, isWindows ? 'junction' : null);
    } else if (srcFileStat.isSymbolicLink() && opts.followsymlink) {
      srcFileStat = fs.statSync(srcFile);
      if (srcFileStat.isDirectory()) {
        cpdirSyncRecursive(srcFile, destFile, currentDepth, opts);
      } else {
        copyFileSync(srcFile, destFile, opts);
      }
    } else {
      /* At this point, we've hit a file actually worth copying... so copy it on over. */
      if (fs.existsSync(destFile) && opts.no_force) {
        common.log('skipping existing file: ' + files[i]);
      } else {
        copyFileSync(srcFile, destFile, opts);
      }
    }
  } // for files
} // cpdirSyncRecursive

// Checks if cureent file was created recently
function checkRecentCreated(sources, index) {
  var lookedSource = sources[index];
  return sources.slice(0, index).some(function (src) {
    return path.basename(src) === path.basename(lookedSource);
  });
}

function cpcheckcycle(sourceDir, srcFile) {
  var srcFileStat = fs.lstatSync(srcFile);
  if (srcFileStat.isSymbolicLink()) {
    // Do cycle check. For example:
    //   $ mkdir -p 1/2/3/4
    //   $ cd  1/2/3/4
    //   $ ln -s ../../3 link
    //   $ cd ../../../..
    //   $ cp -RL 1 copy
    var cyclecheck = fs.statSync(srcFile);
    if (cyclecheck.isDirectory()) {
      var sourcerealpath = fs.realpathSync(sourceDir);
      var symlinkrealpath = fs.realpathSync(srcFile);
      var re = new RegExp(symlinkrealpath);
      if (re.test(sourcerealpath)) {
        return true;
      }
    }
  }
  return false;
}

//@
//@ ### cp([options,] source [, source ...], dest)
//@ ### cp([options,] source_array, dest)
//@ Available options:
//@
//@ + `-f`: force (default behavior)
//@ + `-n`: no-clobber
//@ + `-u`: only copy if source is newer than dest
//@ + `-r`, `-R`: recursive
//@ + `-L`: follow symlinks
//@ + `-P`: don't follow symlinks
//@
//@ Examples:
//@
//@ ```javascript
//@ cp('file1', 'dir1');
//@ cp('-R', 'path/to/dir/', '~/newCopy/');
//@ cp('-Rf', '/tmp/*', '/usr/local/*', '/home/tmp');
//@ cp('-Rf', ['/tmp/*', '/usr/local/*'], '/home/tmp'); // same as above
//@ ```
//@
//@ Copies files.
function _cp(options, sources, dest) {
  // If we're missing -R, it actually implies -L (unless -P is explicit)
  if (options.followsymlink) {
    options.noFollowsymlink = false;
  }
  if (!options.recursive && !options.noFollowsymlink) {
    options.followsymlink = true;
  }

  // Get sources, dest
  if (arguments.length < 3) {
    common.error('missing <source> and/or <dest>');
  } else {
    sources = [].slice.call(arguments, 1, arguments.length - 1);
    dest = arguments[arguments.length - 1];
  }

  var destExists = fs.existsSync(dest);
  var destStat = destExists && fs.statSync(dest);

  // Dest is not existing dir, but multiple sources given
  if ((!destExists || !destStat.isDirectory()) && sources.length > 1) {
    common.error('dest is not a directory (too many sources)');
  }

  // Dest is an existing file, but -n is given
  if (destExists && destStat.isFile() && options.no_force) {
    return new common.ShellString('', '', 0);
  }

  sources.forEach(function (src, srcIndex) {
    if (!fs.existsSync(src)) {
      if (src === '') src = "''"; // if src was empty string, display empty string
      common.error('no such file or directory: ' + src, { continue: true });
      return; // skip file
    }
    var srcStat = fs.statSync(src);
    if (!options.noFollowsymlink && srcStat.isDirectory()) {
      if (!options.recursive) {
        // Non-Recursive
        common.error("omitting directory '" + src + "'", { continue: true });
      } else {
        // Recursive
        // 'cp /a/source dest' should create 'source' in 'dest'
        var newDest = (destStat && destStat.isDirectory()) ?
            path.join(dest, path.basename(src)) :
            dest;

        try {
          fs.statSync(path.dirname(dest));
          cpdirSyncRecursive(src, newDest, 0, { no_force: options.no_force, followsymlink: options.followsymlink });
        } catch (e) {
          /* istanbul ignore next */
          common.error("cannot create directory '" + dest + "': No such file or directory");
        }
      }
    } else {
      // If here, src is a file

      // When copying to '/path/dir':
      //    thisDest = '/path/dir/file1'
      var thisDest = dest;
      if (destStat && destStat.isDirectory()) {
        thisDest = path.normalize(dest + '/' + path.basename(src));
      }

      var thisDestExists = fs.existsSync(thisDest);
      if (thisDestExists && checkRecentCreated(sources, srcIndex)) {
        // cannot overwrite file created recently in current execution, but we want to continue copying other files
        if (!options.no_force) {
          common.error("will not overwrite just-created '" + thisDest + "' with '" + src + "'", { continue: true });
        }
        return;
      }

      if (thisDestExists && options.no_force) {
        return; // skip file
      }

      if (path.relative(src, thisDest) === '') {
        // a file cannot be copied to itself, but we want to continue copying other files
        common.error("'" + thisDest + "' and '" + src + "' are the same file", { continue: true });
        return;
      }

      copyFileSync(src, thisDest, options);
    }
  }); // forEach(src)

  return new common.ShellString('', common.state.error, common.state.errorCode);
}
module.exports = _cp;


/***/ }),
/* 13 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);

//@
//@ ### error()
//@ Tests if error occurred in the last command. Returns a truthy value if an
//@ error returned and a falsy value otherwise.
//@
//@ **Note**: do not rely on the
//@ return value to be an error message. If you need the last error message, use
//@ the `.stderr` attribute from the last command's return value instead.
function error() {
  return common.state.error;
}
module.exports = error;


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var os = __webpack_require__(5);
var fs = __webpack_require__(1);

common.register('tempdir', _tempDir, {
  allowGlobbing: false,
  wrapOutput: false,
});

// Returns false if 'dir' is not a writeable directory, 'dir' otherwise
function writeableDir(dir) {
  if (!dir || !fs.existsSync(dir)) return false;

  if (!fs.statSync(dir).isDirectory()) return false;

  var testFile = dir + '/' + common.randomFileName();
  try {
    fs.writeFileSync(testFile, ' ');
    common.unlinkSync(testFile);
    return dir;
  } catch (e) {
    /* istanbul ignore next */
    return false;
  }
}


//@
//@ ### tempdir()
//@
//@ Examples:
//@
//@ ```javascript
//@ var tmp = tempdir(); // "/tmp" for most *nix platforms
//@ ```
//@
//@ Searches and returns string containing a writeable, platform-dependent temporary directory.
//@ Follows Python's [tempfile algorithm](http://docs.python.org/library/tempfile.html#tempfile.tempdir).
function _tempDir() {
  var state = common.state;
  if (state.tempDir) return state.tempDir; // from cache

  state.tempDir = writeableDir(os.tmpdir && os.tmpdir()) || // node 0.10+
                  writeableDir(os.tmpDir && os.tmpDir()) || // node 0.8+
                  writeableDir(process.env.TMPDIR) ||
                  writeableDir(process.env.TEMP) ||
                  writeableDir(process.env.TMP) ||
                  writeableDir(process.env.Wimp$ScrapDir) || // RiscOS
                  writeableDir('C:\\TEMP') || // Windows
                  writeableDir('C:\\TMP') || // Windows
                  writeableDir('\\TEMP') || // Windows
                  writeableDir('\\TMP') || // Windows
                  writeableDir('/tmp') ||
                  writeableDir('/var/tmp') ||
                  writeableDir('/usr/tmp') ||
                  writeableDir('.'); // last resort

  return state.tempDir;
}
module.exports = _tempDir;


/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

var path = __webpack_require__(2);
var common = __webpack_require__(0);

common.register('pwd', _pwd, {
  allowGlobbing: false,
});

//@
//@ ### pwd()
//@ Returns the current directory.
function _pwd() {
  var pwd = path.resolve(process.cwd());
  return pwd;
}
module.exports = _pwd;


/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

var path = __webpack_require__(2);
var fs = __webpack_require__(1);
var common = __webpack_require__(0);
var glob = __webpack_require__(7);

var globPatternRecursive = path.sep + '**';

common.register('ls', _ls, {
  cmdOptions: {
    'R': 'recursive',
    'A': 'all',
    'L': 'link',
    'a': 'all_deprecated',
    'd': 'directory',
    'l': 'long',
  },
});

//@
//@ ### ls([options,] [path, ...])
//@ ### ls([options,] path_array)
//@ Available options:
//@
//@ + `-R`: recursive
//@ + `-A`: all files (include files beginning with `.`, except for `.` and `..`)
//@ + `-L`: follow symlinks
//@ + `-d`: list directories themselves, not their contents
//@ + `-l`: list objects representing each file, each with fields containing `ls
//@         -l` output fields. See
//@         [fs.Stats](https://nodejs.org/api/fs.html#fs_class_fs_stats)
//@         for more info
//@
//@ Examples:
//@
//@ ```javascript
//@ ls('projs/*.js');
//@ ls('-R', '/users/me', '/tmp');
//@ ls('-R', ['/users/me', '/tmp']); // same as above
//@ ls('-l', 'file.txt'); // { name: 'file.txt', mode: 33188, nlink: 1, ...}
//@ ```
//@
//@ Returns array of files in the given path, or in current directory if no path provided.
function _ls(options, paths) {
  if (options.all_deprecated) {
    // We won't support the -a option as it's hard to image why it's useful
    // (it includes '.' and '..' in addition to '.*' files)
    // For backwards compatibility we'll dump a deprecated message and proceed as before
    common.log('ls: Option -a is deprecated. Use -A instead');
    options.all = true;
  }

  if (!paths) {
    paths = ['.'];
  } else {
    paths = [].slice.call(arguments, 1);
  }

  var list = [];

  function pushFile(abs, relName, stat) {
    if (process.platform === 'win32') {
      relName = relName.replace(/\\/g, '/');
    }
    if (options.long) {
      stat = stat || (options.link ? fs.statSync(abs) : fs.lstatSync(abs));
      list.push(addLsAttributes(relName, stat));
    } else {
      // list.push(path.relative(rel || '.', file));
      list.push(relName);
    }
  }

  paths.forEach(function (p) {
    var stat;

    try {
      stat = options.link ? fs.statSync(p) : fs.lstatSync(p);
    } catch (e) {
      common.error('no such file or directory: ' + p, 2, { continue: true });
      return;
    }

    // If the stat succeeded
    if (stat.isDirectory() && !options.directory) {
      if (options.recursive) {
        // use glob, because it's simple
        glob.sync(p + globPatternRecursive, { dot: options.all, follow: options.link })
          .forEach(function (item) {
            // Glob pattern returns the directory itself and needs to be filtered out.
            if (path.relative(p, item)) {
              pushFile(item, path.relative(p, item));
            }
          });
      } else if (options.all) {
        // use fs.readdirSync, because it's fast
        fs.readdirSync(p).forEach(function (item) {
          pushFile(path.join(p, item), item);
        });
      } else {
        // use fs.readdirSync and then filter out secret files
        fs.readdirSync(p).forEach(function (item) {
          if (item[0] !== '.') {
            pushFile(path.join(p, item), item);
          }
        });
      }
    } else {
      pushFile(p, p, stat);
    }
  });

  // Add methods, to make this more compatible with ShellStrings
  return list;
}

function addLsAttributes(pathName, stats) {
  // Note: this object will contain more information than .toString() returns
  stats.name = pathName;
  stats.toString = function () {
    // Return a string resembling unix's `ls -l` format
    return [this.mode, this.nlink, this.uid, this.gid, this.size, this.mtime, this.name].join(' ');
  };
  return stats;
}

module.exports = _ls;


/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);

common.register('rm', _rm, {
  cmdOptions: {
    'f': 'force',
    'r': 'recursive',
    'R': 'recursive',
  },
});

// Recursively removes 'dir'
// Adapted from https://github.com/ryanmcgrath/wrench-js
//
// Copyright (c) 2010 Ryan McGrath
// Copyright (c) 2012 Artur Adib
//
// Licensed under the MIT License
// http://www.opensource.org/licenses/mit-license.php
function rmdirSyncRecursive(dir, force, fromSymlink) {
  var files;

  files = fs.readdirSync(dir);

  // Loop through and delete everything in the sub-tree after checking it
  for (var i = 0; i < files.length; i++) {
    var file = dir + '/' + files[i];
    var currFile = fs.lstatSync(file);

    if (currFile.isDirectory()) { // Recursive function back to the beginning
      rmdirSyncRecursive(file, force);
    } else { // Assume it's a file - perhaps a try/catch belongs here?
      if (force || isWriteable(file)) {
        try {
          common.unlinkSync(file);
        } catch (e) {
          /* istanbul ignore next */
          common.error('could not remove file (code ' + e.code + '): ' + file, {
            continue: true,
          });
        }
      }
    }
  }

  // if was directory was referenced through a symbolic link,
  // the contents should be removed, but not the directory itself
  if (fromSymlink) return;

  // Now that we know everything in the sub-tree has been deleted, we can delete the main directory.
  // Huzzah for the shopkeep.

  var result;
  try {
    // Retry on windows, sometimes it takes a little time before all the files in the directory are gone
    var start = Date.now();

    // TODO: replace this with a finite loop
    for (;;) {
      try {
        result = fs.rmdirSync(dir);
        if (fs.existsSync(dir)) throw { code: 'EAGAIN' };
        break;
      } catch (er) {
        /* istanbul ignore next */
        // In addition to error codes, also check if the directory still exists and loop again if true
        if (process.platform === 'win32' && (er.code === 'ENOTEMPTY' || er.code === 'EBUSY' || er.code === 'EPERM' || er.code === 'EAGAIN')) {
          if (Date.now() - start > 1000) throw er;
        } else if (er.code === 'ENOENT') {
          // Directory did not exist, deletion was successful
          break;
        } else {
          throw er;
        }
      }
    }
  } catch (e) {
    common.error('could not remove directory (code ' + e.code + '): ' + dir, { continue: true });
  }

  return result;
} // rmdirSyncRecursive

// Hack to determine if file has write permissions for current user
// Avoids having to check user, group, etc, but it's probably slow
function isWriteable(file) {
  var writePermission = true;
  try {
    var __fd = fs.openSync(file, 'a');
    fs.closeSync(__fd);
  } catch (e) {
    writePermission = false;
  }

  return writePermission;
}

function handleFile(file, options) {
  if (options.force || isWriteable(file)) {
    // -f was passed, or file is writable, so it can be removed
    common.unlinkSync(file);
  } else {
    common.error('permission denied: ' + file, { continue: true });
  }
}

function handleDirectory(file, options) {
  if (options.recursive) {
    // -r was passed, so directory can be removed
    rmdirSyncRecursive(file, options.force);
  } else {
    common.error('path is a directory', { continue: true });
  }
}

function handleSymbolicLink(file, options) {
  var stats;
  try {
    stats = fs.statSync(file);
  } catch (e) {
    // symlink is broken, so remove the symlink itself
    common.unlinkSync(file);
    return;
  }

  if (stats.isFile()) {
    common.unlinkSync(file);
  } else if (stats.isDirectory()) {
    if (file[file.length - 1] === '/') {
      // trailing separator, so remove the contents, not the link
      if (options.recursive) {
        // -r was passed, so directory can be removed
        var fromSymlink = true;
        rmdirSyncRecursive(file, options.force, fromSymlink);
      } else {
        common.error('path is a directory', { continue: true });
      }
    } else {
      // no trailing separator, so remove the link
      common.unlinkSync(file);
    }
  }
}

function handleFIFO(file) {
  common.unlinkSync(file);
}

//@
//@ ### rm([options,] file [, file ...])
//@ ### rm([options,] file_array)
//@ Available options:
//@
//@ + `-f`: force
//@ + `-r, -R`: recursive
//@
//@ Examples:
//@
//@ ```javascript
//@ rm('-rf', '/tmp/*');
//@ rm('some_file.txt', 'another_file.txt');
//@ rm(['some_file.txt', 'another_file.txt']); // same as above
//@ ```
//@
//@ Removes files.
function _rm(options, files) {
  if (!files) common.error('no paths given');

  // Convert to array
  files = [].slice.call(arguments, 1);

  files.forEach(function (file) {
    var lstats;
    try {
      var filepath = (file[file.length - 1] === '/')
        ? file.slice(0, -1) // remove the '/' so lstatSync can detect symlinks
        : file;
      lstats = fs.lstatSync(filepath); // test for existence
    } catch (e) {
      // Path does not exist, no force flag given
      if (!options.force) {
        common.error('no such file or directory: ' + file, { continue: true });
      }
      return; // skip file
    }

    // If here, path exists
    if (lstats.isFile()) {
      handleFile(file, options);
    } else if (lstats.isDirectory()) {
      handleDirectory(file, options);
    } else if (lstats.isSymbolicLink()) {
      handleSymbolicLink(file, options);
    } else if (lstats.isFIFO()) {
      handleFIFO(file);
    }
  }); // forEach(file)
  return '';
} // rm
module.exports = _rm;


/***/ }),
/* 18 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const arrayify = __webpack_require__(4)

/* Control Sequence Initiator */
const csi = '\x1b['

/**
 * @exports ansi-escape-sequences
 * @typicalname ansi
 * @example
 * const ansi = require('ansi-escape-sequences')
 */
const ansi = {}

/**
 * Various formatting styles (aka Select Graphic Rendition codes).
 * @enum {string}
 * @example
 * console.log(ansi.style.red + 'this is red' + ansi.style.reset)
 */
ansi.style = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  fontDefault: '\x1b[10m',
  font2: '\x1b[11m',
  font3: '\x1b[12m',
  font4: '\x1b[13m',
  font5: '\x1b[14m',
  font6: '\x1b[15m',
  imageNegative: '\x1b[7m',
  imagePositive: '\x1b[27m',
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  grey: '\x1b[90m',
  gray: '\x1b[90m',
  'bg-black': '\x1b[40m',
  'bg-red': '\x1b[41m',
  'bg-green': '\x1b[42m',
  'bg-yellow': '\x1b[43m',
  'bg-blue': '\x1b[44m',
  'bg-magenta': '\x1b[45m',
  'bg-cyan': '\x1b[46m',
  'bg-white': '\x1b[47m',
  'bg-grey': '\x1b[100m',
  'bg-gray': '\x1b[100m'
}

/**
 * style enum - used by `ansi.styles()`.
 * @enum {number}
 * @private
 */
const eStyles = {
  reset: 0,
  bold: 1,
  italic: 3,
  underline: 4,
  imageNegative: 7,
  fontDefault: 10,
  font2: 11,
  font3: 12,
  font4: 13,
  font5: 14,
  font6: 15,
  imagePositive: 27,
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  grey: 90,
  gray: 90,
  'bg-black': 40,
  'bg-red': 41,
  'bg-green': 42,
  'bg-yellow': 43,
  'bg-blue': 44,
  'bg-magenta': 45,
  'bg-cyan': 46,
  'bg-white': 47,
  'bg-grey': 100,
  'bg-gray': 100
}

/**
 * Returns an ansi sequence setting one or more effects
 * @param {string | string[]} - a style, or list or styles
 * @returns {string}
 * @example
 * > ansi.styles('green')
 * '\u001b[32m'
 *
 * > ansi.styles([ 'green', 'underline' ])
 * '\u001b[32;4m'
 */
ansi.styles = function (effectArray) {
  effectArray = arrayify(effectArray)
  return csi + effectArray.map(function (effect) { return eStyles[effect] }).join(';') + 'm'
}

/**
 * A convenience function, applying the provided styles to the input string and then resetting.
 *
 * Inline styling can be applied using the syntax `[style-list]{text to format}`, where `style-list` is a space-separated list of styles from {@link module:ansi-escape-sequences.style ansi.style}. For example `[bold white bg-red]{bold white text on a red background}`.
 *
 * @param {string} - the string to format
 * @param [styleArray] {string[]} - a list of styles to add to the input string
 * @returns {string}
 * @example
 * > ansi.format('what?', 'green')
 * '\u001b[32mwhat?\u001b[0m'
 *
 * > ansi.format('what?', ['green', 'bold'])
 * '\u001b[32;1mwhat?\u001b[0m'
 *
 * > ansi.format('[green bold]{what?}')
 * '\u001b[32;1mwhat?\u001b[0m'
 */
ansi.format = function (str, styleArray) {
  const re = /\[([\w\s-]+)\]{([^]*?)}/
  let matches
  if (!str) return ''

  while (matches = str.match(re)) {
    const inlineStyles = matches[1].split(/\s+/)
    const inlineString = matches[2]
    str = str.replace(matches[0], ansi.format(inlineString, inlineStyles))
  }

  return (styleArray && styleArray.length)
    ? ansi.styles(styleArray) + str + ansi.style.reset
    : str
}

/**
 * cursor-related sequences
 */
ansi.cursor = {
  /**
   * Moves the cursor `lines` cells up. If the cursor is already at the edge of the screen, this has no effect
   * @param [lines=1] {number}
   * @return {string}
   */
  up: function (lines) { return csi + (lines || 1) + 'A' },

  /**
   * Moves the cursor `lines` cells down. If the cursor is already at the edge of the screen, this has no effect
   * @param [lines=1] {number}
   * @return {string}
   */
  down: function (lines) { return csi + (lines || 1) + 'B' },

  /**
   * Moves the cursor `lines` cells forward. If the cursor is already at the edge of the screen, this has no effect
   * @param [lines=1] {number}
   * @return {string}
   */
  forward: function (lines) { return csi + (lines || 1) + 'C' },

  /**
   * Moves the cursor `lines` cells back. If the cursor is already at the edge of the screen, this has no effect
   * @param [lines=1] {number}
   * @return {string}
   */
  back: function (lines) { return csi + (lines || 1) + 'D' },

  /**
   * Moves cursor to beginning of the line n lines down.
   * @param [lines=1] {number}
   * @return {string}
   */
  nextLine: function (lines) { return csi + (lines || 1) + 'E' },

  /**
   * Moves cursor to beginning of the line n lines up.
   * @param [lines=1] {number}
   * @return {string}
   */
  previousLine: function (lines) { return csi + (lines || 1) + 'F' },

  /**
   * Moves the cursor to column n.
   * @param n {number} - column number
   * @return {string}
   */
  horizontalAbsolute: function (n) { return csi + n + 'G' },

  /**
   * Moves the cursor to row n, column m. The values are 1-based, and default to 1 (top left corner) if omitted.
   * @param n {number} - row number
   * @param m {number} - column number
   * @return {string}
   */
  position: function (n, m) { return csi + (n || 1) + ';' + (m || 1) + 'H' },

  /**
   * Hides the cursor
   */
  hide: csi + '?25l',

  /**
   * Shows the cursor
   */
  show: csi + '?25h'
}

/**
 * erase sequences
 */
ansi.erase = {
  /**
   * Clears part of the screen. If n is 0 (or missing), clear from cursor to end of screen. If n is 1, clear from cursor to beginning of the screen. If n is 2, clear entire screen.
   * @param n {number}
   * @return {string}
   */
  display: function (n) { return csi + (n || 0) + 'J' },

  /**
   * Erases part of the line. If n is zero (or missing), clear from cursor to the end of the line. If n is one, clear from cursor to beginning of the line. If n is two, clear entire line. Cursor position does not change.
   * @param n {number}
   * @return {string}
   */
  inLine: function (n) { return csi + (n || 0) + 'K' }
}

module.exports = ansi


/***/ }),
/* 19 */
/***/ (function(module, exports, __webpack_require__) {

//
// ShellJS
// Unix shell commands on top of Node's API
//
// Copyright (c) 2012 Artur Adib
// http://github.com/shelljs/shelljs
//

var common = __webpack_require__(0);

//@
//@ All commands run synchronously, unless otherwise stated.
//@ All commands accept standard bash globbing characters (`*`, `?`, etc.),
//@ compatible with the [node glob module](https://github.com/isaacs/node-glob).
//@
//@ For less-commonly used commands and features, please check out our [wiki
//@ page](https://github.com/shelljs/shelljs/wiki).
//@

// Include the docs for all the default commands
//@commands

// Load all default commands
__webpack_require__(75).forEach(function (command) {
  __webpack_require__(76)("./" + command);
});

//@
//@ ### exit(code)
//@ Exits the current process with the given exit code.
exports.exit = process.exit;

//@include ./src/error
exports.error = __webpack_require__(13);

//@include ./src/common
exports.ShellString = common.ShellString;

//@
//@ ### env['VAR_NAME']
//@ Object containing environment variables (both getter and setter). Shortcut
//@ to process.env.
exports.env = process.env;

//@
//@ ### Pipes
//@
//@ Examples:
//@
//@ ```javascript
//@ grep('foo', 'file1.txt', 'file2.txt').sed(/o/g, 'a').to('output.txt');
//@ echo('files with o\'s in the name:\n' + ls().grep('o'));
//@ cat('test.js').exec('node'); // pipe to exec() call
//@ ```
//@
//@ Commands can send their output to another command in a pipe-like fashion.
//@ `sed`, `grep`, `cat`, `exec`, `to`, and `toEnd` can appear on the right-hand
//@ side of a pipe. Pipes can be chained.

//@
//@ ## Configuration
//@

exports.config = common.config;

//@
//@ ### config.silent
//@
//@ Example:
//@
//@ ```javascript
//@ var sh = require('shelljs');
//@ var silentState = sh.config.silent; // save old silent state
//@ sh.config.silent = true;
//@ /* ... */
//@ sh.config.silent = silentState; // restore old silent state
//@ ```
//@
//@ Suppresses all command output if `true`, except for `echo()` calls.
//@ Default is `false`.

//@
//@ ### config.fatal
//@
//@ Example:
//@
//@ ```javascript
//@ require('shelljs/global');
//@ config.fatal = true; // or set('-e');
//@ cp('this_file_does_not_exist', '/dev/null'); // throws Error here
//@ /* more commands... */
//@ ```
//@
//@ If `true` the script will throw a Javascript error when any shell.js
//@ command encounters an error. Default is `false`. This is analogous to
//@ Bash's `set -e`

//@
//@ ### config.verbose
//@
//@ Example:
//@
//@ ```javascript
//@ config.verbose = true; // or set('-v');
//@ cd('dir/');
//@ rm('-rf', 'foo.txt', 'bar.txt');
//@ exec('echo hello');
//@ ```
//@
//@ Will print each command as follows:
//@
//@ ```
//@ cd dir/
//@ rm -rf foo.txt bar.txt
//@ exec echo hello
//@ ```

//@
//@ ### config.globOptions
//@
//@ Example:
//@
//@ ```javascript
//@ config.globOptions = {nodir: true};
//@ ```
//@
//@ Use this value for calls to `glob.sync()` instead of the default options.

//@
//@ ### config.reset()
//@
//@ Example:
//@
//@ ```javascript
//@ var shell = require('shelljs');
//@ // Make changes to shell.config, and do stuff...
//@ /* ... */
//@ shell.config.reset(); // reset to original state
//@ // Do more stuff, but with original settings
//@ /* ... */
//@ ```
//@
//@ Reset shell.config to the defaults:
//@
//@ ```javascript
//@ {
//@   fatal: false,
//@   globOptions: {},
//@   maxdepth: 255,
//@   noglob: false,
//@   silent: false,
//@   verbose: false,
//@ }
//@ ```


/***/ }),
/* 20 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = realpath
realpath.realpath = realpath
realpath.sync = realpathSync
realpath.realpathSync = realpathSync
realpath.monkeypatch = monkeypatch
realpath.unmonkeypatch = unmonkeypatch

var fs = __webpack_require__(1)
var origRealpath = fs.realpath
var origRealpathSync = fs.realpathSync

var version = process.version
var ok = /^v[0-5]\./.test(version)
var old = __webpack_require__(66)

function newError (er) {
  return er && er.syscall === 'realpath' && (
    er.code === 'ELOOP' ||
    er.code === 'ENOMEM' ||
    er.code === 'ENAMETOOLONG'
  )
}

function realpath (p, cache, cb) {
  if (ok) {
    return origRealpath(p, cache, cb)
  }

  if (typeof cache === 'function') {
    cb = cache
    cache = null
  }
  origRealpath(p, cache, function (er, result) {
    if (newError(er)) {
      old.realpath(p, cache, cb)
    } else {
      cb(er, result)
    }
  })
}

function realpathSync (p, cache) {
  if (ok) {
    return origRealpathSync(p, cache)
  }

  try {
    return origRealpathSync(p, cache)
  } catch (er) {
    if (newError(er)) {
      return old.realpathSync(p, cache)
    } else {
      throw er
    }
  }
}

function monkeypatch () {
  fs.realpath = realpath
  fs.realpathSync = realpathSync
}

function unmonkeypatch () {
  fs.realpath = origRealpath
  fs.realpathSync = origRealpathSync
}


/***/ }),
/* 21 */
/***/ (function(module, exports) {

module.exports = require("assert");

/***/ }),
/* 22 */
/***/ (function(module, exports, __webpack_require__) {

exports.alphasort = alphasort
exports.alphasorti = alphasorti
exports.setopts = setopts
exports.ownProp = ownProp
exports.makeAbs = makeAbs
exports.finish = finish
exports.mark = mark
exports.isIgnored = isIgnored
exports.childrenIgnored = childrenIgnored

function ownProp (obj, field) {
  return Object.prototype.hasOwnProperty.call(obj, field)
}

var path = __webpack_require__(2)
var minimatch = __webpack_require__(8)
var isAbsolute = __webpack_require__(10)
var Minimatch = minimatch.Minimatch

function alphasorti (a, b) {
  return a.toLowerCase().localeCompare(b.toLowerCase())
}

function alphasort (a, b) {
  return a.localeCompare(b)
}

function setupIgnores (self, options) {
  self.ignore = options.ignore || []

  if (!Array.isArray(self.ignore))
    self.ignore = [self.ignore]

  if (self.ignore.length) {
    self.ignore = self.ignore.map(ignoreMap)
  }
}

// ignore patterns are always in dot:true mode.
function ignoreMap (pattern) {
  var gmatcher = null
  if (pattern.slice(-3) === '/**') {
    var gpattern = pattern.replace(/(\/\*\*)+$/, '')
    gmatcher = new Minimatch(gpattern, { dot: true })
  }

  return {
    matcher: new Minimatch(pattern, { dot: true }),
    gmatcher: gmatcher
  }
}

function setopts (self, pattern, options) {
  if (!options)
    options = {}

  // base-matching: just use globstar for that.
  if (options.matchBase && -1 === pattern.indexOf("/")) {
    if (options.noglobstar) {
      throw new Error("base matching requires globstar")
    }
    pattern = "**/" + pattern
  }

  self.silent = !!options.silent
  self.pattern = pattern
  self.strict = options.strict !== false
  self.realpath = !!options.realpath
  self.realpathCache = options.realpathCache || Object.create(null)
  self.follow = !!options.follow
  self.dot = !!options.dot
  self.mark = !!options.mark
  self.nodir = !!options.nodir
  if (self.nodir)
    self.mark = true
  self.sync = !!options.sync
  self.nounique = !!options.nounique
  self.nonull = !!options.nonull
  self.nosort = !!options.nosort
  self.nocase = !!options.nocase
  self.stat = !!options.stat
  self.noprocess = !!options.noprocess
  self.absolute = !!options.absolute

  self.maxLength = options.maxLength || Infinity
  self.cache = options.cache || Object.create(null)
  self.statCache = options.statCache || Object.create(null)
  self.symlinks = options.symlinks || Object.create(null)

  setupIgnores(self, options)

  self.changedCwd = false
  var cwd = process.cwd()
  if (!ownProp(options, "cwd"))
    self.cwd = cwd
  else {
    self.cwd = path.resolve(options.cwd)
    self.changedCwd = self.cwd !== cwd
  }

  self.root = options.root || path.resolve(self.cwd, "/")
  self.root = path.resolve(self.root)
  if (process.platform === "win32")
    self.root = self.root.replace(/\\/g, "/")

  // TODO: is an absolute `cwd` supposed to be resolved against `root`?
  // e.g. { cwd: '/test', root: __dirname } === path.join(__dirname, '/test')
  self.cwdAbs = isAbsolute(self.cwd) ? self.cwd : makeAbs(self, self.cwd)
  if (process.platform === "win32")
    self.cwdAbs = self.cwdAbs.replace(/\\/g, "/")
  self.nomount = !!options.nomount

  // disable comments and negation in Minimatch.
  // Note that they are not supported in Glob itself anyway.
  options.nonegate = true
  options.nocomment = true

  self.minimatch = new Minimatch(pattern, options)
  self.options = self.minimatch.options
}

function finish (self) {
  var nou = self.nounique
  var all = nou ? [] : Object.create(null)

  for (var i = 0, l = self.matches.length; i < l; i ++) {
    var matches = self.matches[i]
    if (!matches || Object.keys(matches).length === 0) {
      if (self.nonull) {
        // do like the shell, and spit out the literal glob
        var literal = self.minimatch.globSet[i]
        if (nou)
          all.push(literal)
        else
          all[literal] = true
      }
    } else {
      // had matches
      var m = Object.keys(matches)
      if (nou)
        all.push.apply(all, m)
      else
        m.forEach(function (m) {
          all[m] = true
        })
    }
  }

  if (!nou)
    all = Object.keys(all)

  if (!self.nosort)
    all = all.sort(self.nocase ? alphasorti : alphasort)

  // at *some* point we statted all of these
  if (self.mark) {
    for (var i = 0; i < all.length; i++) {
      all[i] = self._mark(all[i])
    }
    if (self.nodir) {
      all = all.filter(function (e) {
        var notDir = !(/\/$/.test(e))
        var c = self.cache[e] || self.cache[makeAbs(self, e)]
        if (notDir && c)
          notDir = c !== 'DIR' && !Array.isArray(c)
        return notDir
      })
    }
  }

  if (self.ignore.length)
    all = all.filter(function(m) {
      return !isIgnored(self, m)
    })

  self.found = all
}

function mark (self, p) {
  var abs = makeAbs(self, p)
  var c = self.cache[abs]
  var m = p
  if (c) {
    var isDir = c === 'DIR' || Array.isArray(c)
    var slash = p.slice(-1) === '/'

    if (isDir && !slash)
      m += '/'
    else if (!isDir && slash)
      m = m.slice(0, -1)

    if (m !== p) {
      var mabs = makeAbs(self, m)
      self.statCache[mabs] = self.statCache[abs]
      self.cache[mabs] = self.cache[abs]
    }
  }

  return m
}

// lotta situps...
function makeAbs (self, f) {
  var abs = f
  if (f.charAt(0) === '/') {
    abs = path.join(self.root, f)
  } else if (isAbsolute(f) || f === '') {
    abs = f
  } else if (self.changedCwd) {
    abs = path.resolve(self.cwd, f)
  } else {
    abs = path.resolve(f)
  }

  if (process.platform === 'win32')
    abs = abs.replace(/\\/g, '/')

  return abs
}


// Return true, if pattern ends with globstar '**', for the accompanying parent directory.
// Ex:- If node_modules/** is the pattern, add 'node_modules' to ignore list along with it's contents
function isIgnored (self, path) {
  if (!self.ignore.length)
    return false

  return self.ignore.some(function(item) {
    return item.matcher.match(path) || !!(item.gmatcher && item.gmatcher.match(path))
  })
}

function childrenIgnored (self, path) {
  if (!self.ignore.length)
    return false

  return self.ignore.some(function(item) {
    return !!(item.gmatcher && item.gmatcher.match(path))
  })
}


/***/ }),
/* 23 */
/***/ (function(module, exports) {

// Returns a wrapper function that returns a wrapped callback
// The wrapper function should do some stuff, and return a
// presumably different callback function.
// This makes sure that own properties are retained, so that
// decorations and such are not lost along the way.
module.exports = wrappy
function wrappy (fn, cb) {
  if (fn && cb) return wrappy(fn)(cb)

  if (typeof fn !== 'function')
    throw new TypeError('need wrapper function')

  Object.keys(fn).forEach(function (k) {
    wrapper[k] = fn[k]
  })

  return wrapper

  function wrapper() {
    var args = new Array(arguments.length)
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i]
    }
    var ret = fn.apply(this, args)
    var cb = args[args.length-1]
    if (typeof ret === 'function' && ret !== cb) {
      Object.keys(cb).forEach(function (k) {
        ret[k] = cb[k]
      })
    }
    return ret
  }
}


/***/ }),
/* 24 */
/***/ (function(module, exports, __webpack_require__) {

var wrappy = __webpack_require__(23)
module.exports = wrappy(once)
module.exports.strict = wrappy(onceStrict)

once.proto = once(function () {
  Object.defineProperty(Function.prototype, 'once', {
    value: function () {
      return once(this)
    },
    configurable: true
  })

  Object.defineProperty(Function.prototype, 'onceStrict', {
    value: function () {
      return onceStrict(this)
    },
    configurable: true
  })
})

function once (fn) {
  var f = function () {
    if (f.called) return f.value
    f.called = true
    return f.value = fn.apply(this, arguments)
  }
  f.called = false
  return f
}

function onceStrict (fn) {
  var f = function () {
    if (f.called)
      throw new Error(f.onceError)
    f.called = true
    return f.value = fn.apply(this, arguments)
  }
  var name = fn.name || 'Function wrapped with `once`'
  f.onceError = name + " shouldn't be called more than once"
  f.called = false
  return f
}


/***/ }),
/* 25 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);

common.register('cat', _cat, {
  canReceivePipe: true,
});

//@
//@ ### cat(file [, file ...])
//@ ### cat(file_array)
//@
//@ Examples:
//@
//@ ```javascript
//@ var str = cat('file*.txt');
//@ var str = cat('file1', 'file2');
//@ var str = cat(['file1', 'file2']); // same as above
//@ ```
//@
//@ Returns a string containing the given file, or a concatenated string
//@ containing the files if more than one file is given (a new line character is
//@ introduced between each file).
function _cat(options, files) {
  var cat = common.readFromPipe();

  if (!files && !cat) common.error('no paths given');

  files = [].slice.call(arguments, 1);

  files.forEach(function (file) {
    if (!fs.existsSync(file)) {
      common.error('no such file or directory: ' + file);
    } else if (fs.statSync(file).isDirectory()) {
      common.error(file + ': Is a directory');
    }

    cat += fs.readFileSync(file, 'utf8');
  });

  return cat;
}
module.exports = _cat;


/***/ }),
/* 26 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);
var path = __webpack_require__(2);

var PERMS = (function (base) {
  return {
    OTHER_EXEC: base.EXEC,
    OTHER_WRITE: base.WRITE,
    OTHER_READ: base.READ,

    GROUP_EXEC: base.EXEC << 3,
    GROUP_WRITE: base.WRITE << 3,
    GROUP_READ: base.READ << 3,

    OWNER_EXEC: base.EXEC << 6,
    OWNER_WRITE: base.WRITE << 6,
    OWNER_READ: base.READ << 6,

    // Literal octal numbers are apparently not allowed in "strict" javascript.
    STICKY: parseInt('01000', 8),
    SETGID: parseInt('02000', 8),
    SETUID: parseInt('04000', 8),

    TYPE_MASK: parseInt('0770000', 8),
  };
}({
  EXEC: 1,
  WRITE: 2,
  READ: 4,
}));

common.register('chmod', _chmod, {
});

//@
//@ ### chmod([options,] octal_mode || octal_string, file)
//@ ### chmod([options,] symbolic_mode, file)
//@
//@ Available options:
//@
//@ + `-v`: output a diagnostic for every file processed//@
//@ + `-c`: like verbose but report only when a change is made//@
//@ + `-R`: change files and directories recursively//@
//@
//@ Examples:
//@
//@ ```javascript
//@ chmod(755, '/Users/brandon');
//@ chmod('755', '/Users/brandon'); // same as above
//@ chmod('u+x', '/Users/brandon');
//@ chmod('-R', 'a-w', '/Users/brandon');
//@ ```
//@
//@ Alters the permissions of a file or directory by either specifying the
//@ absolute permissions in octal form or expressing the changes in symbols.
//@ This command tries to mimic the POSIX behavior as much as possible.
//@ Notable exceptions:
//@
//@ + In symbolic modes, 'a-r' and '-r' are identical.  No consideration is
//@   given to the umask.
//@ + There is no "quiet" option since default behavior is to run silent.
function _chmod(options, mode, filePattern) {
  if (!filePattern) {
    if (options.length > 0 && options.charAt(0) === '-') {
      // Special case where the specified file permissions started with - to subtract perms, which
      // get picked up by the option parser as command flags.
      // If we are down by one argument and options starts with -, shift everything over.
      [].unshift.call(arguments, '');
    } else {
      common.error('You must specify a file.');
    }
  }

  options = common.parseOptions(options, {
    'R': 'recursive',
    'c': 'changes',
    'v': 'verbose',
  });

  filePattern = [].slice.call(arguments, 2);

  var files;

  // TODO: replace this with a call to common.expand()
  if (options.recursive) {
    files = [];
    filePattern.forEach(function addFile(expandedFile) {
      var stat = fs.lstatSync(expandedFile);

      if (!stat.isSymbolicLink()) {
        files.push(expandedFile);

        if (stat.isDirectory()) {  // intentionally does not follow symlinks.
          fs.readdirSync(expandedFile).forEach(function (child) {
            addFile(expandedFile + '/' + child);
          });
        }
      }
    });
  } else {
    files = filePattern;
  }

  files.forEach(function innerChmod(file) {
    file = path.resolve(file);
    if (!fs.existsSync(file)) {
      common.error('File not found: ' + file);
    }

    // When recursing, don't follow symlinks.
    if (options.recursive && fs.lstatSync(file).isSymbolicLink()) {
      return;
    }

    var stat = fs.statSync(file);
    var isDir = stat.isDirectory();
    var perms = stat.mode;
    var type = perms & PERMS.TYPE_MASK;

    var newPerms = perms;

    if (isNaN(parseInt(mode, 8))) {
      // parse options
      mode.split(',').forEach(function (symbolicMode) {
        var pattern = /([ugoa]*)([=\+-])([rwxXst]*)/i;
        var matches = pattern.exec(symbolicMode);

        if (matches) {
          var applyTo = matches[1];
          var operator = matches[2];
          var change = matches[3];

          var changeOwner = applyTo.indexOf('u') !== -1 || applyTo === 'a' || applyTo === '';
          var changeGroup = applyTo.indexOf('g') !== -1 || applyTo === 'a' || applyTo === '';
          var changeOther = applyTo.indexOf('o') !== -1 || applyTo === 'a' || applyTo === '';

          var changeRead = change.indexOf('r') !== -1;
          var changeWrite = change.indexOf('w') !== -1;
          var changeExec = change.indexOf('x') !== -1;
          var changeExecDir = change.indexOf('X') !== -1;
          var changeSticky = change.indexOf('t') !== -1;
          var changeSetuid = change.indexOf('s') !== -1;

          if (changeExecDir && isDir) {
            changeExec = true;
          }

          var mask = 0;
          if (changeOwner) {
            mask |= (changeRead ? PERMS.OWNER_READ : 0) + (changeWrite ? PERMS.OWNER_WRITE : 0) + (changeExec ? PERMS.OWNER_EXEC : 0) + (changeSetuid ? PERMS.SETUID : 0);
          }
          if (changeGroup) {
            mask |= (changeRead ? PERMS.GROUP_READ : 0) + (changeWrite ? PERMS.GROUP_WRITE : 0) + (changeExec ? PERMS.GROUP_EXEC : 0) + (changeSetuid ? PERMS.SETGID : 0);
          }
          if (changeOther) {
            mask |= (changeRead ? PERMS.OTHER_READ : 0) + (changeWrite ? PERMS.OTHER_WRITE : 0) + (changeExec ? PERMS.OTHER_EXEC : 0);
          }

          // Sticky bit is special - it's not tied to user, group or other.
          if (changeSticky) {
            mask |= PERMS.STICKY;
          }

          switch (operator) {
            case '+':
              newPerms |= mask;
              break;

            case '-':
              newPerms &= ~mask;
              break;

            case '=':
              newPerms = type + mask;

              // According to POSIX, when using = to explicitly set the
              // permissions, setuid and setgid can never be cleared.
              if (fs.statSync(file).isDirectory()) {
                newPerms |= (PERMS.SETUID + PERMS.SETGID) & perms;
              }
              break;
            default:
              common.error('Could not recognize operator: `' + operator + '`');
          }

          if (options.verbose) {
            console.log(file + ' -> ' + newPerms.toString(8));
          }

          if (perms !== newPerms) {
            if (!options.verbose && options.changes) {
              console.log(file + ' -> ' + newPerms.toString(8));
            }
            fs.chmodSync(file, newPerms);
            perms = newPerms; // for the next round of changes!
          }
        } else {
          common.error('Invalid symbolic mode change: ' + symbolicMode);
        }
      });
    } else {
      // they gave us a full number
      newPerms = type + parseInt(mode, 8);

      // POSIX rules are that setuid and setgid can only be added using numeric
      // form, but not cleared.
      if (fs.statSync(file).isDirectory()) {
        newPerms |= (PERMS.SETUID + PERMS.SETGID) & perms;
      }

      fs.chmodSync(file, newPerms);
    }
  });
  return '';
}
module.exports = _chmod;


/***/ }),
/* 27 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var _cd = __webpack_require__(11);
var path = __webpack_require__(2);

common.register('dirs', _dirs, {
  wrapOutput: false,
});
common.register('pushd', _pushd, {
  wrapOutput: false,
});
common.register('popd', _popd, {
  wrapOutput: false,
});

// Pushd/popd/dirs internals
var _dirStack = [];

function _isStackIndex(index) {
  return (/^[\-+]\d+$/).test(index);
}

function _parseStackIndex(index) {
  if (_isStackIndex(index)) {
    if (Math.abs(index) < _dirStack.length + 1) { // +1 for pwd
      return (/^-/).test(index) ? Number(index) - 1 : Number(index);
    }
    common.error(index + ': directory stack index out of range');
  } else {
    common.error(index + ': invalid number');
  }
}

function _actualDirStack() {
  return [process.cwd()].concat(_dirStack);
}

//@
//@ ### pushd([options,] [dir | '-N' | '+N'])
//@
//@ Available options:
//@
//@ + `-n`: Suppresses the normal change of directory when adding directories to the stack, so that only the stack is manipulated.
//@
//@ Arguments:
//@
//@ + `dir`: Makes the current working directory be the top of the stack, and then executes the equivalent of `cd dir`.
//@ + `+N`: Brings the Nth directory (counting from the left of the list printed by dirs, starting with zero) to the top of the list by rotating the stack.
//@ + `-N`: Brings the Nth directory (counting from the right of the list printed by dirs, starting with zero) to the top of the list by rotating the stack.
//@
//@ Examples:
//@
//@ ```javascript
//@ // process.cwd() === '/usr'
//@ pushd('/etc'); // Returns /etc /usr
//@ pushd('+1');   // Returns /usr /etc
//@ ```
//@
//@ Save the current directory on the top of the directory stack and then cd to `dir`. With no arguments, pushd exchanges the top two directories. Returns an array of paths in the stack.
function _pushd(options, dir) {
  if (_isStackIndex(options)) {
    dir = options;
    options = '';
  }

  options = common.parseOptions(options, {
    'n': 'no-cd',
  });

  var dirs = _actualDirStack();

  if (dir === '+0') {
    return dirs; // +0 is a noop
  } else if (!dir) {
    if (dirs.length > 1) {
      dirs = dirs.splice(1, 1).concat(dirs);
    } else {
      return common.error('no other directory');
    }
  } else if (_isStackIndex(dir)) {
    var n = _parseStackIndex(dir);
    dirs = dirs.slice(n).concat(dirs.slice(0, n));
  } else {
    if (options['no-cd']) {
      dirs.splice(1, 0, dir);
    } else {
      dirs.unshift(dir);
    }
  }

  if (options['no-cd']) {
    dirs = dirs.slice(1);
  } else {
    dir = path.resolve(dirs.shift());
    _cd('', dir);
  }

  _dirStack = dirs;
  return _dirs('');
}
exports.pushd = _pushd;

//@
//@ ### popd([options,] ['-N' | '+N'])
//@
//@ Available options:
//@
//@ + `-n`: Suppresses the normal change of directory when removing directories from the stack, so that only the stack is manipulated.
//@
//@ Arguments:
//@
//@ + `+N`: Removes the Nth directory (counting from the left of the list printed by dirs), starting with zero.
//@ + `-N`: Removes the Nth directory (counting from the right of the list printed by dirs), starting with zero.
//@
//@ Examples:
//@
//@ ```javascript
//@ echo(process.cwd()); // '/usr'
//@ pushd('/etc');       // '/etc /usr'
//@ echo(process.cwd()); // '/etc'
//@ popd();              // '/usr'
//@ echo(process.cwd()); // '/usr'
//@ ```
//@
//@ When no arguments are given, popd removes the top directory from the stack and performs a cd to the new top directory. The elements are numbered from 0 starting at the first directory listed with dirs; i.e., popd is equivalent to popd +0. Returns an array of paths in the stack.
function _popd(options, index) {
  if (_isStackIndex(options)) {
    index = options;
    options = '';
  }

  options = common.parseOptions(options, {
    'n': 'no-cd',
  });

  if (!_dirStack.length) {
    return common.error('directory stack empty');
  }

  index = _parseStackIndex(index || '+0');

  if (options['no-cd'] || index > 0 || _dirStack.length + index === 0) {
    index = index > 0 ? index - 1 : index;
    _dirStack.splice(index, 1);
  } else {
    var dir = path.resolve(_dirStack.shift());
    _cd('', dir);
  }

  return _dirs('');
}
exports.popd = _popd;

//@
//@ ### dirs([options | '+N' | '-N'])
//@
//@ Available options:
//@
//@ + `-c`: Clears the directory stack by deleting all of the elements.
//@
//@ Arguments:
//@
//@ + `+N`: Displays the Nth directory (counting from the left of the list printed by dirs when invoked without options), starting with zero.
//@ + `-N`: Displays the Nth directory (counting from the right of the list printed by dirs when invoked without options), starting with zero.
//@
//@ Display the list of currently remembered directories. Returns an array of paths in the stack, or a single path if +N or -N was specified.
//@
//@ See also: pushd, popd
function _dirs(options, index) {
  if (_isStackIndex(options)) {
    index = options;
    options = '';
  }

  options = common.parseOptions(options, {
    'c': 'clear',
  });

  if (options.clear) {
    _dirStack = [];
    return _dirStack;
  }

  var stack = _actualDirStack();

  if (index) {
    index = _parseStackIndex(index);

    if (index < 0) {
      index = stack.length + index;
    }

    common.log(stack[index]);
    return stack[index];
  }

  common.log(stack.join(' '));

  return stack;
}
exports.dirs = _dirs;


/***/ }),
/* 28 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);

common.register('echo', _echo, {
  allowGlobbing: false,
});

//@
//@ ### echo([options,] string [, string ...])
//@ Available options:
//@
//@ + `-e`: interpret backslash escapes (default)
//@
//@ Examples:
//@
//@ ```javascript
//@ echo('hello world');
//@ var str = echo('hello world');
//@ ```
//@
//@ Prints string to stdout, and returns string with additional utility methods
//@ like `.to()`.
function _echo(opts, messages) {
  // allow strings starting with '-', see issue #20
  messages = [].slice.call(arguments, opts ? 0 : 1);

  if (messages[0] === '-e') {
    // ignore -e
    messages.shift();
  }

  console.log.apply(console, messages);
  return messages.join(' ');
}
module.exports = _echo;


/***/ }),
/* 29 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var _tempDir = __webpack_require__(14);
var _pwd = __webpack_require__(15);
var path = __webpack_require__(2);
var fs = __webpack_require__(1);
var child = __webpack_require__(77);

var DEFAULT_MAXBUFFER_SIZE = 20 * 1024 * 1024;

common.register('exec', _exec, {
  unix: false,
  canReceivePipe: true,
  wrapOutput: false,
});

// Hack to run child_process.exec() synchronously (sync avoids callback hell)
// Uses a custom wait loop that checks for a flag file, created when the child process is done.
// (Can't do a wait loop that checks for internal Node variables/messages as
// Node is single-threaded; callbacks and other internal state changes are done in the
// event loop).
function execSync(cmd, opts, pipe) {
  if (!common.config.execPath) {
    common.error('Unable to find a path to the node binary. Please manually set config.execPath');
  }

  var tempDir = _tempDir();
  var stdoutFile = path.resolve(tempDir + '/' + common.randomFileName());
  var stderrFile = path.resolve(tempDir + '/' + common.randomFileName());
  var codeFile = path.resolve(tempDir + '/' + common.randomFileName());
  var scriptFile = path.resolve(tempDir + '/' + common.randomFileName());
  var sleepFile = path.resolve(tempDir + '/' + common.randomFileName());

  opts = common.extend({
    silent: common.config.silent,
    cwd: _pwd().toString(),
    env: process.env,
    maxBuffer: DEFAULT_MAXBUFFER_SIZE,
  }, opts);

  var previousStdoutContent = '';
  var previousStderrContent = '';
  // Echoes stdout and stderr changes from running process, if not silent
  function updateStream(streamFile) {
    if (opts.silent || !fs.existsSync(streamFile)) {
      return;
    }

    var previousStreamContent;
    var procStream;
    if (streamFile === stdoutFile) {
      previousStreamContent = previousStdoutContent;
      procStream = process.stdout;
    } else { // assume stderr
      previousStreamContent = previousStderrContent;
      procStream = process.stderr;
    }

    var streamContent = fs.readFileSync(streamFile, 'utf8');
    // No changes since last time?
    if (streamContent.length <= previousStreamContent.length) {
      return;
    }

    procStream.write(streamContent.substr(previousStreamContent.length));
    previousStreamContent = streamContent;
  }

  if (fs.existsSync(scriptFile)) common.unlinkSync(scriptFile);
  if (fs.existsSync(stdoutFile)) common.unlinkSync(stdoutFile);
  if (fs.existsSync(stderrFile)) common.unlinkSync(stderrFile);
  if (fs.existsSync(codeFile)) common.unlinkSync(codeFile);

  var execCommand = JSON.stringify(common.config.execPath) + ' ' + JSON.stringify(scriptFile);
  var script;

  opts.cwd = path.resolve(opts.cwd);
  var optString = JSON.stringify(opts);

  if (typeof child.execSync === 'function') {
    script = [
      "var child = require('child_process')",
      "  , fs = require('fs');",
      'var childProcess = child.exec(' + JSON.stringify(cmd) + ', ' + optString + ', function(err) {',
      '  var fname = ' + JSON.stringify(codeFile) + ';',
      '  if (!err) {',
      '    fs.writeFileSync(fname, "0");',
      '  } else if (err.code === undefined) {',
      '    fs.writeFileSync(fname, "1");',
      '  } else {',
      '    fs.writeFileSync(fname, err.code.toString());',
      '  }',
      '});',
      'var stdoutStream = fs.createWriteStream(' + JSON.stringify(stdoutFile) + ');',
      'var stderrStream = fs.createWriteStream(' + JSON.stringify(stderrFile) + ');',
      'childProcess.stdout.pipe(stdoutStream, {end: false});',
      'childProcess.stderr.pipe(stderrStream, {end: false});',
      'childProcess.stdout.pipe(process.stdout);',
      'childProcess.stderr.pipe(process.stderr);',
    ].join('\n') +
      (pipe ? '\nchildProcess.stdin.end(' + JSON.stringify(pipe) + ');\n' : '\n') +
      [
        'var stdoutEnded = false, stderrEnded = false;',
        'function tryClosingStdout(){ if(stdoutEnded){ stdoutStream.end(); } }',
        'function tryClosingStderr(){ if(stderrEnded){ stderrStream.end(); } }',
        "childProcess.stdout.on('end', function(){ stdoutEnded = true; tryClosingStdout(); });",
        "childProcess.stderr.on('end', function(){ stderrEnded = true; tryClosingStderr(); });",
      ].join('\n');

    fs.writeFileSync(scriptFile, script);

    if (opts.silent) {
      opts.stdio = 'ignore';
    } else {
      opts.stdio = [0, 1, 2];
    }

    // Welcome to the future
    try {
      child.execSync(execCommand, opts);
    } catch (e) {
      // Clean up immediately if we have an exception
      try { common.unlinkSync(scriptFile); } catch (e2) {}
      try { common.unlinkSync(stdoutFile); } catch (e2) {}
      try { common.unlinkSync(stderrFile); } catch (e2) {}
      try { common.unlinkSync(codeFile); } catch (e2) {}
      throw e;
    }
  } else {
    cmd += ' > ' + stdoutFile + ' 2> ' + stderrFile; // works on both win/unix

    script = [
      "var child = require('child_process')",
      "  , fs = require('fs');",
      'var childProcess = child.exec(' + JSON.stringify(cmd) + ', ' + optString + ', function(err) {',
      '  var fname = ' + JSON.stringify(codeFile) + ';',
      '  if (!err) {',
      '    fs.writeFileSync(fname, "0");',
      '  } else if (err.code === undefined) {',
      '    fs.writeFileSync(fname, "1");',
      '  } else {',
      '    fs.writeFileSync(fname, err.code.toString());',
      '  }',
      '});',
    ].join('\n') +
      (pipe ? '\nchildProcess.stdin.end(' + JSON.stringify(pipe) + ');\n' : '\n');

    fs.writeFileSync(scriptFile, script);

    child.exec(execCommand, opts);

    // The wait loop
    // sleepFile is used as a dummy I/O op to mitigate unnecessary CPU usage
    // (tried many I/O sync ops, writeFileSync() seems to be only one that is effective in reducing
    // CPU usage, though apparently not so much on Windows)
    while (!fs.existsSync(codeFile)) { updateStream(stdoutFile); fs.writeFileSync(sleepFile, 'a'); }
    while (!fs.existsSync(stdoutFile)) { updateStream(stdoutFile); fs.writeFileSync(sleepFile, 'a'); }
    while (!fs.existsSync(stderrFile)) { updateStream(stderrFile); fs.writeFileSync(sleepFile, 'a'); }
    try { common.unlinkSync(sleepFile); } catch (e) {}
  }

  // At this point codeFile exists, but it's not necessarily flushed yet.
  // Keep reading it until it is.
  var code = parseInt('', 10);
  while (isNaN(code)) {
    code = parseInt(fs.readFileSync(codeFile, 'utf8'), 10);
  }

  var stdout = fs.readFileSync(stdoutFile, 'utf8');
  var stderr = fs.readFileSync(stderrFile, 'utf8');

  // No biggie if we can't erase the files now -- they're in a temp dir anyway
  try { common.unlinkSync(scriptFile); } catch (e) {}
  try { common.unlinkSync(stdoutFile); } catch (e) {}
  try { common.unlinkSync(stderrFile); } catch (e) {}
  try { common.unlinkSync(codeFile); } catch (e) {}

  if (code !== 0) {
    common.error('', code, { continue: true });
  }
  var obj = common.ShellString(stdout, stderr, code);
  return obj;
} // execSync()

// Wrapper around exec() to enable echoing output to console in real time
function execAsync(cmd, opts, pipe, callback) {
  var stdout = '';
  var stderr = '';

  opts = common.extend({
    silent: common.config.silent,
    cwd: _pwd().toString(),
    env: process.env,
    maxBuffer: DEFAULT_MAXBUFFER_SIZE,
  }, opts);

  var c = child.exec(cmd, opts, function (err) {
    if (callback) {
      if (!err) {
        callback(0, stdout, stderr);
      } else if (err.code === undefined) {
        // See issue #536
        callback(1, stdout, stderr);
      } else {
        callback(err.code, stdout, stderr);
      }
    }
  });

  if (pipe) c.stdin.end(pipe);

  c.stdout.on('data', function (data) {
    stdout += data;
    if (!opts.silent) process.stdout.write(data);
  });

  c.stderr.on('data', function (data) {
    stderr += data;
    if (!opts.silent) process.stderr.write(data);
  });

  return c;
}

//@
//@ ### exec(command [, options] [, callback])
//@ Available options (all `false` by default):
//@
//@ + `async`: Asynchronous execution. If a callback is provided, it will be set to
//@   `true`, regardless of the passed value.
//@ + `silent`: Do not echo program output to console.
//@ + and any option available to Node.js's
//@   [child_process.exec()](https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback)
//@
//@ Examples:
//@
//@ ```javascript
//@ var version = exec('node --version', {silent:true}).stdout;
//@
//@ var child = exec('some_long_running_process', {async:true});
//@ child.stdout.on('data', function(data) {
//@   /* ... do something with data ... */
//@ });
//@
//@ exec('some_long_running_process', function(code, stdout, stderr) {
//@   console.log('Exit code:', code);
//@   console.log('Program output:', stdout);
//@   console.log('Program stderr:', stderr);
//@ });
//@ ```
//@
//@ Executes the given `command` _synchronously_, unless otherwise specified.  When in synchronous
//@ mode, this returns a ShellString (compatible with ShellJS v0.6.x, which returns an object
//@ of the form `{ code:..., stdout:... , stderr:... }`). Otherwise, this returns the child process
//@ object, and the `callback` gets the arguments `(code, stdout, stderr)`.
//@
//@ Not seeing the behavior you want? `exec()` runs everything through `sh`
//@ by default (or `cmd.exe` on Windows), which differs from `bash`. If you
//@ need bash-specific behavior, try out the `{shell: 'path/to/bash'}` option.
//@
//@ **Note:** For long-lived processes, it's best to run `exec()` asynchronously as
//@ the current synchronous implementation uses a lot of CPU. This should be getting
//@ fixed soon.
function _exec(command, options, callback) {
  options = options || {};
  if (!command) common.error('must specify command');

  var pipe = common.readFromPipe();

  // Callback is defined instead of options.
  if (typeof options === 'function') {
    callback = options;
    options = { async: true };
  }

  // Callback is defined with options.
  if (typeof options === 'object' && typeof callback === 'function') {
    options.async = true;
  }

  options = common.extend({
    silent: common.config.silent,
    async: false,
  }, options);

  try {
    if (options.async) {
      return execAsync(command, options, pipe, callback);
    } else {
      return execSync(command, options, pipe);
    }
  } catch (e) {
    common.error('internal error');
  }
}
module.exports = _exec;


/***/ }),
/* 30 */
/***/ (function(module, exports, __webpack_require__) {

var fs = __webpack_require__(1);
var path = __webpack_require__(2);
var common = __webpack_require__(0);
var _ls = __webpack_require__(16);

common.register('find', _find, {});

//@
//@ ### find(path [, path ...])
//@ ### find(path_array)
//@ Examples:
//@
//@ ```javascript
//@ find('src', 'lib');
//@ find(['src', 'lib']); // same as above
//@ find('.').filter(function(file) { return file.match(/\.js$/); });
//@ ```
//@
//@ Returns array of all files (however deep) in the given paths.
//@
//@ The main difference from `ls('-R', path)` is that the resulting file names
//@ include the base directories, e.g. `lib/resources/file1` instead of just `file1`.
function _find(options, paths) {
  if (!paths) {
    common.error('no path specified');
  } else if (typeof paths === 'string') {
    paths = [].slice.call(arguments, 1);
  }

  var list = [];

  function pushFile(file) {
    if (process.platform === 'win32') {
      file = file.replace(/\\/g, '/');
    }
    list.push(file);
  }

  // why not simply do ls('-R', paths)? because the output wouldn't give the base dirs
  // to get the base dir in the output, we need instead ls('-R', 'dir/*') for every directory

  paths.forEach(function (file) {
    var stat;
    try {
      stat = fs.statSync(file);
    } catch (e) {
      common.error('no such file or directory: ' + file);
    }

    pushFile(file);

    if (stat.isDirectory()) {
      _ls({ recursive: true, all: true }, file).forEach(function (subfile) {
        pushFile(path.join(file, subfile));
      });
    }
  });

  return list;
}
module.exports = _find;


/***/ }),
/* 31 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);

common.register('grep', _grep, {
  globStart: 2, // don't glob-expand the regex
  canReceivePipe: true,
  cmdOptions: {
    'v': 'inverse',
    'l': 'nameOnly',
  },
});

//@
//@ ### grep([options,] regex_filter, file [, file ...])
//@ ### grep([options,] regex_filter, file_array)
//@ Available options:
//@
//@ + `-v`: Inverse the sense of the regex and print the lines not matching the criteria.
//@ + `-l`: Print only filenames of matching files
//@
//@ Examples:
//@
//@ ```javascript
//@ grep('-v', 'GLOBAL_VARIABLE', '*.js');
//@ grep('GLOBAL_VARIABLE', '*.js');
//@ ```
//@
//@ Reads input string from given files and returns a string containing all lines of the
//@ file that match the given `regex_filter`.
function _grep(options, regex, files) {
  // Check if this is coming from a pipe
  var pipe = common.readFromPipe();

  if (!files && !pipe) common.error('no paths given', 2);

  files = [].slice.call(arguments, 2);

  if (pipe) {
    files.unshift('-');
  }

  var grep = [];
  files.forEach(function (file) {
    if (!fs.existsSync(file) && file !== '-') {
      common.error('no such file or directory: ' + file, 2, { continue: true });
      return;
    }

    var contents = file === '-' ? pipe : fs.readFileSync(file, 'utf8');
    var lines = contents.split(/\r*\n/);
    if (options.nameOnly) {
      if (contents.match(regex)) {
        grep.push(file);
      }
    } else {
      lines.forEach(function (line) {
        var matched = line.match(regex);
        if ((options.inverse && !matched) || (!options.inverse && matched)) {
          grep.push(line);
        }
      });
    }
  });

  return grep.join('\n') + '\n';
}
module.exports = _grep;


/***/ }),
/* 32 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);

common.register('head', _head, {
  canReceivePipe: true,
  cmdOptions: {
    'n': 'numLines',
  },
});

// This reads n or more lines, or the entire file, whichever is less.
function readSomeLines(file, numLines) {
  var buf = common.buffer();
  var bufLength = buf.length;
  var bytesRead = bufLength;
  var pos = 0;
  var fdr = null;

  try {
    fdr = fs.openSync(file, 'r');
  } catch (e) {
    common.error('cannot read file: ' + file);
  }

  var numLinesRead = 0;
  var ret = '';
  while (bytesRead === bufLength && numLinesRead < numLines) {
    bytesRead = fs.readSync(fdr, buf, 0, bufLength, pos);
    var bufStr = buf.toString('utf8', 0, bytesRead);
    numLinesRead += bufStr.split('\n').length - 1;
    ret += bufStr;
    pos += bytesRead;
  }

  fs.closeSync(fdr);
  return ret;
}
//@
//@ ### head([{'-n': \<num\>},] file [, file ...])
//@ ### head([{'-n': \<num\>},] file_array)
//@ Available options:
//@
//@ + `-n <num>`: Show the first `<num>` lines of the files
//@
//@ Examples:
//@
//@ ```javascript
//@ var str = head({'-n': 1}, 'file*.txt');
//@ var str = head('file1', 'file2');
//@ var str = head(['file1', 'file2']); // same as above
//@ ```
//@
//@ Read the start of a file.
function _head(options, files) {
  var head = [];
  var pipe = common.readFromPipe();

  if (!files && !pipe) common.error('no paths given');

  var idx = 1;
  if (options.numLines === true) {
    idx = 2;
    options.numLines = Number(arguments[1]);
  } else if (options.numLines === false) {
    options.numLines = 10;
  }
  files = [].slice.call(arguments, idx);

  if (pipe) {
    files.unshift('-');
  }

  var shouldAppendNewline = false;
  files.forEach(function (file) {
    if (file !== '-') {
      if (!fs.existsSync(file)) {
        common.error('no such file or directory: ' + file, { continue: true });
        return;
      } else if (fs.statSync(file).isDirectory()) {
        common.error("error reading '" + file + "': Is a directory", {
          continue: true,
        });
        return;
      }
    }

    var contents;
    if (file === '-') {
      contents = pipe;
    } else if (options.numLines < 0) {
      contents = fs.readFileSync(file, 'utf8');
    } else {
      contents = readSomeLines(file, options.numLines);
    }

    var lines = contents.split('\n');
    var hasTrailingNewline = (lines[lines.length - 1] === '');
    if (hasTrailingNewline) {
      lines.pop();
    }
    shouldAppendNewline = (hasTrailingNewline || options.numLines < lines.length);

    head = head.concat(lines.slice(0, options.numLines));
  });

  if (shouldAppendNewline) {
    head.push(''); // to add a trailing newline once we join
  }
  return head.join('\n');
}
module.exports = _head;


/***/ }),
/* 33 */
/***/ (function(module, exports, __webpack_require__) {

var fs = __webpack_require__(1);
var path = __webpack_require__(2);
var common = __webpack_require__(0);

common.register('ln', _ln, {
  cmdOptions: {
    's': 'symlink',
    'f': 'force',
  },
});

//@
//@ ### ln([options,] source, dest)
//@ Available options:
//@
//@ + `-s`: symlink
//@ + `-f`: force
//@
//@ Examples:
//@
//@ ```javascript
//@ ln('file', 'newlink');
//@ ln('-sf', 'file', 'existing');
//@ ```
//@
//@ Links source to dest. Use -f to force the link, should dest already exist.
function _ln(options, source, dest) {
  if (!source || !dest) {
    common.error('Missing <source> and/or <dest>');
  }

  source = String(source);
  var sourcePath = path.normalize(source).replace(RegExp(path.sep + '$'), '');
  var isAbsolute = (path.resolve(source) === sourcePath);
  dest = path.resolve(process.cwd(), String(dest));

  if (fs.existsSync(dest)) {
    if (!options.force) {
      common.error('Destination file exists', { continue: true });
    }

    fs.unlinkSync(dest);
  }

  if (options.symlink) {
    var isWindows = process.platform === 'win32';
    var linkType = isWindows ? 'file' : null;
    var resolvedSourcePath = isAbsolute ? sourcePath : path.resolve(process.cwd(), path.dirname(dest), source);
    if (!fs.existsSync(resolvedSourcePath)) {
      common.error('Source file does not exist', { continue: true });
    } else if (isWindows && fs.statSync(resolvedSourcePath).isDirectory()) {
      linkType = 'junction';
    }

    try {
      fs.symlinkSync(linkType === 'junction' ? resolvedSourcePath : source, dest, linkType);
    } catch (err) {
      common.error(err.message);
    }
  } else {
    if (!fs.existsSync(source)) {
      common.error('Source file does not exist', { continue: true });
    }
    try {
      fs.linkSync(source, dest);
    } catch (err) {
      common.error(err.message);
    }
  }
  return '';
}
module.exports = _ln;


/***/ }),
/* 34 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);
var path = __webpack_require__(2);

common.register('mkdir', _mkdir, {
  cmdOptions: {
    'p': 'fullpath',
  },
});

// Recursively creates 'dir'
function mkdirSyncRecursive(dir) {
  var baseDir = path.dirname(dir);

  // Prevents some potential problems arising from malformed UNCs or
  // insufficient permissions.
  /* istanbul ignore next */
  if (baseDir === dir) {
    common.error('dirname() failed: [' + dir + ']');
  }

  // Base dir exists, no recursion necessary
  if (fs.existsSync(baseDir)) {
    fs.mkdirSync(dir, parseInt('0777', 8));
    return;
  }

  // Base dir does not exist, go recursive
  mkdirSyncRecursive(baseDir);

  // Base dir created, can create dir
  fs.mkdirSync(dir, parseInt('0777', 8));
}

//@
//@ ### mkdir([options,] dir [, dir ...])
//@ ### mkdir([options,] dir_array)
//@ Available options:
//@
//@ + `-p`: full path (will create intermediate dirs if necessary)
//@
//@ Examples:
//@
//@ ```javascript
//@ mkdir('-p', '/tmp/a/b/c/d', '/tmp/e/f/g');
//@ mkdir('-p', ['/tmp/a/b/c/d', '/tmp/e/f/g']); // same as above
//@ ```
//@
//@ Creates directories.
function _mkdir(options, dirs) {
  if (!dirs) common.error('no paths given');

  if (typeof dirs === 'string') {
    dirs = [].slice.call(arguments, 1);
  }
  // if it's array leave it as it is

  dirs.forEach(function (dir) {
    try {
      var stat = fs.lstatSync(dir);
      if (!options.fullpath) {
        common.error('path already exists: ' + dir, { continue: true });
      } else if (stat.isFile()) {
        common.error('cannot create directory ' + dir + ': File exists', { continue: true });
      }
      return; // skip dir
    } catch (e) {
      // do nothing
    }

    // Base dir does not exist, and no -p option given
    var baseDir = path.dirname(dir);
    if (!fs.existsSync(baseDir) && !options.fullpath) {
      common.error('no such file or directory: ' + baseDir, { continue: true });
      return; // skip dir
    }

    try {
      if (options.fullpath) {
        mkdirSyncRecursive(path.resolve(dir));
      } else {
        fs.mkdirSync(dir, parseInt('0777', 8));
      }
    } catch (e) {
      var reason;
      if (e.code === 'EACCES') {
        reason = 'Permission denied';
      } else if (e.code === 'ENOTDIR' || e.code === 'ENOENT') {
        reason = 'Not a directory';
      } else {
        /* istanbul ignore next */
        throw e;
      }
      common.error('cannot create directory ' + dir + ': ' + reason, { continue: true });
    }
  });
  return '';
} // mkdir
module.exports = _mkdir;


/***/ }),
/* 35 */
/***/ (function(module, exports, __webpack_require__) {

var fs = __webpack_require__(1);
var path = __webpack_require__(2);
var common = __webpack_require__(0);
var cp = __webpack_require__(12);
var rm = __webpack_require__(17);

common.register('mv', _mv, {
  cmdOptions: {
    'f': '!no_force',
    'n': 'no_force',
  },
});

// Checks if cureent file was created recently
function checkRecentCreated(sources, index) {
  var lookedSource = sources[index];
  return sources.slice(0, index).some(function (src) {
    return path.basename(src) === path.basename(lookedSource);
  });
}

//@
//@ ### mv([options ,] source [, source ...], dest')
//@ ### mv([options ,] source_array, dest')
//@ Available options:
//@
//@ + `-f`: force (default behavior)
//@ + `-n`: no-clobber
//@
//@ Examples:
//@
//@ ```javascript
//@ mv('-n', 'file', 'dir/');
//@ mv('file1', 'file2', 'dir/');
//@ mv(['file1', 'file2'], 'dir/'); // same as above
//@ ```
//@
//@ Moves files.
function _mv(options, sources, dest) {
  // Get sources, dest
  if (arguments.length < 3) {
    common.error('missing <source> and/or <dest>');
  } else if (arguments.length > 3) {
    sources = [].slice.call(arguments, 1, arguments.length - 1);
    dest = arguments[arguments.length - 1];
  } else if (typeof sources === 'string') {
    sources = [sources];
  } else {
    // TODO(nate): figure out if we actually need this line
    common.error('invalid arguments');
  }

  var exists = fs.existsSync(dest);
  var stats = exists && fs.statSync(dest);

  // Dest is not existing dir, but multiple sources given
  if ((!exists || !stats.isDirectory()) && sources.length > 1) {
    common.error('dest is not a directory (too many sources)');
  }

  // Dest is an existing file, but no -f given
  if (exists && stats.isFile() && options.no_force) {
    common.error('dest file already exists: ' + dest);
  }

  sources.forEach(function (src, srcIndex) {
    if (!fs.existsSync(src)) {
      common.error('no such file or directory: ' + src, { continue: true });
      return; // skip file
    }

    // If here, src exists

    // When copying to '/path/dir':
    //    thisDest = '/path/dir/file1'
    var thisDest = dest;
    if (fs.existsSync(dest) && fs.statSync(dest).isDirectory()) {
      thisDest = path.normalize(dest + '/' + path.basename(src));
    }

    var thisDestExists = fs.existsSync(thisDest);

    if (thisDestExists && checkRecentCreated(sources, srcIndex)) {
      // cannot overwrite file created recently in current execution, but we want to continue copying other files
      if (!options.no_force) {
        common.error("will not overwrite just-created '" + thisDest + "' with '" + src + "'", { continue: true });
      }
      return;
    }

    if (fs.existsSync(thisDest) && options.no_force) {
      common.error('dest file already exists: ' + thisDest, { continue: true });
      return; // skip file
    }

    if (path.resolve(src) === path.dirname(path.resolve(thisDest))) {
      common.error('cannot move to self: ' + src, { continue: true });
      return; // skip file
    }

    try {
      fs.renameSync(src, thisDest);
    } catch (e) {
      /* istanbul ignore next */
      if (e.code === 'EXDEV') {
        // If we're trying to `mv` to an external partition, we'll actually need
        // to perform a copy and then clean up the original file. If either the
        // copy or the rm fails with an exception, we should allow this
        // exception to pass up to the top level.
        cp('-r', src, thisDest);
        rm('-rf', src);
      }
    }
  }); // forEach(src)
  return '';
} // mv
module.exports = _mv;


/***/ }),
/* 36 */
/***/ (function(module, exports) {

// see dirs.js


/***/ }),
/* 37 */
/***/ (function(module, exports) {

// see dirs.js


/***/ }),
/* 38 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);

common.register('sed', _sed, {
  globStart: 3, // don't glob-expand regexes
  canReceivePipe: true,
  cmdOptions: {
    'i': 'inplace',
  },
});

//@
//@ ### sed([options,] search_regex, replacement, file [, file ...])
//@ ### sed([options,] search_regex, replacement, file_array)
//@ Available options:
//@
//@ + `-i`: Replace contents of 'file' in-place. _Note that no backups will be created!_
//@
//@ Examples:
//@
//@ ```javascript
//@ sed('-i', 'PROGRAM_VERSION', 'v0.1.3', 'source.js');
//@ sed(/.*DELETE_THIS_LINE.*\n/, '', 'source.js');
//@ ```
//@
//@ Reads an input string from `files` and performs a JavaScript `replace()` on the input
//@ using the given search regex and replacement string or function. Returns the new string after replacement.
//@
//@ Note:
//@
//@ Like unix `sed`, ShellJS `sed` supports capture groups. Capture groups are specified
//@ using the `$n` syntax:
//@
//@ ```javascript
//@ sed(/(\w+)\s(\w+)/, '$2, $1', 'file.txt');
//@ ```
function _sed(options, regex, replacement, files) {
  // Check if this is coming from a pipe
  var pipe = common.readFromPipe();

  if (typeof replacement !== 'string' && typeof replacement !== 'function') {
    if (typeof replacement === 'number') {
      replacement = replacement.toString(); // fallback
    } else {
      common.error('invalid replacement string');
    }
  }

  // Convert all search strings to RegExp
  if (typeof regex === 'string') {
    regex = RegExp(regex);
  }

  if (!files && !pipe) {
    common.error('no files given');
  }

  files = [].slice.call(arguments, 3);

  if (pipe) {
    files.unshift('-');
  }

  var sed = [];
  files.forEach(function (file) {
    if (!fs.existsSync(file) && file !== '-') {
      common.error('no such file or directory: ' + file, 2, { continue: true });
      return;
    }

    var contents = file === '-' ? pipe : fs.readFileSync(file, 'utf8');
    var lines = contents.split(/\r*\n/);
    var result = lines.map(function (line) {
      return line.replace(regex, replacement);
    }).join('\n');

    sed.push(result);

    if (options.inplace) {
      fs.writeFileSync(file, result, 'utf8');
    }
  });

  return sed.join('\n');
}
module.exports = _sed;


/***/ }),
/* 39 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);

common.register('set', _set, {
  allowGlobbing: false,
  wrapOutput: false,
});

//@
//@ ### set(options)
//@ Available options:
//@
//@ + `+/-e`: exit upon error (`config.fatal`)
//@ + `+/-v`: verbose: show all commands (`config.verbose`)
//@ + `+/-f`: disable filename expansion (globbing)
//@
//@ Examples:
//@
//@ ```javascript
//@ set('-e'); // exit upon first error
//@ set('+e'); // this undoes a "set('-e')"
//@ ```
//@
//@ Sets global configuration variables
function _set(options) {
  if (!options) {
    var args = [].slice.call(arguments, 0);
    if (args.length < 2) common.error('must provide an argument');
    options = args[1];
  }
  var negate = (options[0] === '+');
  if (negate) {
    options = '-' + options.slice(1); // parseOptions needs a '-' prefix
  }
  options = common.parseOptions(options, {
    'e': 'fatal',
    'v': 'verbose',
    'f': 'noglob',
  });

  if (negate) {
    Object.keys(options).forEach(function (key) {
      options[key] = !options[key];
    });
  }

  Object.keys(options).forEach(function (key) {
    // Only change the global config if `negate` is false and the option is true
    // or if `negate` is true and the option is false (aka negate !== option)
    if (negate !== options[key]) {
      common.config[key] = options[key];
    }
  });
  return;
}
module.exports = _set;


/***/ }),
/* 40 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);

common.register('sort', _sort, {
  canReceivePipe: true,
  cmdOptions: {
    'r': 'reverse',
    'n': 'numerical',
  },
});

// parse out the number prefix of a line
function parseNumber(str) {
  var match = str.match(/^\s*(\d*)\s*(.*)$/);
  return { num: Number(match[1]), value: match[2] };
}

// compare two strings case-insensitively, but examine case for strings that are
// case-insensitive equivalent
function unixCmp(a, b) {
  var aLower = a.toLowerCase();
  var bLower = b.toLowerCase();
  return (aLower === bLower ?
      -1 * a.localeCompare(b) : // unix sort treats case opposite how javascript does
      aLower.localeCompare(bLower));
}

// compare two strings in the fashion that unix sort's -n option works
function numericalCmp(a, b) {
  var objA = parseNumber(a);
  var objB = parseNumber(b);
  if (objA.hasOwnProperty('num') && objB.hasOwnProperty('num')) {
    return ((objA.num !== objB.num) ?
        (objA.num - objB.num) :
        unixCmp(objA.value, objB.value));
  } else {
    return unixCmp(objA.value, objB.value);
  }
}

//@
//@ ### sort([options,] file [, file ...])
//@ ### sort([options,] file_array)
//@ Available options:
//@
//@ + `-r`: Reverse the result of comparisons
//@ + `-n`: Compare according to numerical value
//@
//@ Examples:
//@
//@ ```javascript
//@ sort('foo.txt', 'bar.txt');
//@ sort('-r', 'foo.txt');
//@ ```
//@
//@ Return the contents of the files, sorted line-by-line. Sorting multiple
//@ files mixes their content, just like unix sort does.
function _sort(options, files) {
  // Check if this is coming from a pipe
  var pipe = common.readFromPipe();

  if (!files && !pipe) common.error('no files given');

  files = [].slice.call(arguments, 1);

  if (pipe) {
    files.unshift('-');
  }

  var lines = [];
  files.forEach(function (file) {
    if (file !== '-') {
      if (!fs.existsSync(file)) {
        common.error('no such file or directory: ' + file, { continue: true });
        return;
      } else if (fs.statSync(file).isDirectory()) {
        common.error('read failed: ' + file + ': Is a directory', {
          continue: true,
        });
        return;
      }
    }

    var contents = file === '-' ? pipe : fs.readFileSync(file, 'utf8');
    lines = lines.concat(contents.trimRight().split(/\r*\n/));
  });

  var sorted;
  sorted = lines.sort(options.numerical ? numericalCmp : unixCmp);

  if (options.reverse) {
    sorted = sorted.reverse();
  }

  return sorted.join('\n') + '\n';
}

module.exports = _sort;


/***/ }),
/* 41 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);

common.register('tail', _tail, {
  canReceivePipe: true,
  cmdOptions: {
    'n': 'numLines',
  },
});

//@
//@ ### tail([{'-n': \<num\>},] file [, file ...])
//@ ### tail([{'-n': \<num\>},] file_array)
//@ Available options:
//@
//@ + `-n <num>`: Show the last `<num>` lines of the files
//@
//@ Examples:
//@
//@ ```javascript
//@ var str = tail({'-n': 1}, 'file*.txt');
//@ var str = tail('file1', 'file2');
//@ var str = tail(['file1', 'file2']); // same as above
//@ ```
//@
//@ Read the end of a file.
function _tail(options, files) {
  var tail = [];
  var pipe = common.readFromPipe();

  if (!files && !pipe) common.error('no paths given');

  var idx = 1;
  if (options.numLines === true) {
    idx = 2;
    options.numLines = Number(arguments[1]);
  } else if (options.numLines === false) {
    options.numLines = 10;
  }
  options.numLines = -1 * Math.abs(options.numLines);
  files = [].slice.call(arguments, idx);

  if (pipe) {
    files.unshift('-');
  }

  var shouldAppendNewline = false;
  files.forEach(function (file) {
    if (file !== '-') {
      if (!fs.existsSync(file)) {
        common.error('no such file or directory: ' + file, { continue: true });
        return;
      } else if (fs.statSync(file).isDirectory()) {
        common.error("error reading '" + file + "': Is a directory", {
          continue: true,
        });
        return;
      }
    }

    var contents = file === '-' ? pipe : fs.readFileSync(file, 'utf8');

    var lines = contents.split('\n');
    if (lines[lines.length - 1] === '') {
      lines.pop();
      shouldAppendNewline = true;
    } else {
      shouldAppendNewline = false;
    }

    tail = tail.concat(lines.slice(options.numLines));
  });

  if (shouldAppendNewline) {
    tail.push(''); // to add a trailing newline once we join
  }
  return tail.join('\n');
}
module.exports = _tail;


/***/ }),
/* 42 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);

common.register('test', _test, {
  cmdOptions: {
    'b': 'block',
    'c': 'character',
    'd': 'directory',
    'e': 'exists',
    'f': 'file',
    'L': 'link',
    'p': 'pipe',
    'S': 'socket',
  },
  wrapOutput: false,
  allowGlobbing: false,
});


//@
//@ ### test(expression)
//@ Available expression primaries:
//@
//@ + `'-b', 'path'`: true if path is a block device
//@ + `'-c', 'path'`: true if path is a character device
//@ + `'-d', 'path'`: true if path is a directory
//@ + `'-e', 'path'`: true if path exists
//@ + `'-f', 'path'`: true if path is a regular file
//@ + `'-L', 'path'`: true if path is a symbolic link
//@ + `'-p', 'path'`: true if path is a pipe (FIFO)
//@ + `'-S', 'path'`: true if path is a socket
//@
//@ Examples:
//@
//@ ```javascript
//@ if (test('-d', path)) { /* do something with dir */ };
//@ if (!test('-f', path)) continue; // skip if it's a regular file
//@ ```
//@
//@ Evaluates expression using the available primaries and returns corresponding value.
function _test(options, path) {
  if (!path) common.error('no path given');

  var canInterpret = false;
  Object.keys(options).forEach(function (key) {
    if (options[key] === true) {
      canInterpret = true;
    }
  });

  if (!canInterpret) common.error('could not interpret expression');

  if (options.link) {
    try {
      return fs.lstatSync(path).isSymbolicLink();
    } catch (e) {
      return false;
    }
  }

  if (!fs.existsSync(path)) return false;

  if (options.exists) return true;

  var stats = fs.statSync(path);

  if (options.block) return stats.isBlockDevice();

  if (options.character) return stats.isCharacterDevice();

  if (options.directory) return stats.isDirectory();

  if (options.file) return stats.isFile();

  /* istanbul ignore next */
  if (options.pipe) return stats.isFIFO();

  /* istanbul ignore next */
  if (options.socket) return stats.isSocket();

  /* istanbul ignore next */
  return false; // fallback
} // test
module.exports = _test;


/***/ }),
/* 43 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);
var path = __webpack_require__(2);

common.register('to', _to, {
  pipeOnly: true,
  wrapOutput: false,
});

//@
//@ ### ShellString.prototype.to(file)
//@
//@ Examples:
//@
//@ ```javascript
//@ cat('input.txt').to('output.txt');
//@ ```
//@
//@ Analogous to the redirection operator `>` in Unix, but works with
//@ ShellStrings (such as those returned by `cat`, `grep`, etc). _Like Unix
//@ redirections, `to()` will overwrite any existing file!_
function _to(options, file) {
  if (!file) common.error('wrong arguments');

  if (!fs.existsSync(path.dirname(file))) {
    common.error('no such file or directory: ' + path.dirname(file));
  }

  try {
    fs.writeFileSync(file, this.stdout || this.toString(), 'utf8');
    return this;
  } catch (e) {
    /* istanbul ignore next */
    common.error('could not write to file (code ' + e.code + '): ' + file, { continue: true });
  }
}
module.exports = _to;


/***/ }),
/* 44 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);
var path = __webpack_require__(2);

common.register('toEnd', _toEnd, {
  pipeOnly: true,
  wrapOutput: false,
});

//@
//@ ### ShellString.prototype.toEnd(file)
//@
//@ Examples:
//@
//@ ```javascript
//@ cat('input.txt').toEnd('output.txt');
//@ ```
//@
//@ Analogous to the redirect-and-append operator `>>` in Unix, but works with
//@ ShellStrings (such as those returned by `cat`, `grep`, etc).
function _toEnd(options, file) {
  if (!file) common.error('wrong arguments');

  if (!fs.existsSync(path.dirname(file))) {
    common.error('no such file or directory: ' + path.dirname(file));
  }

  try {
    fs.appendFileSync(file, this.stdout || this.toString(), 'utf8');
    return this;
  } catch (e) {
    /* istanbul ignore next */
    common.error('could not append to file (code ' + e.code + '): ' + file, { continue: true });
  }
}
module.exports = _toEnd;


/***/ }),
/* 45 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);

common.register('touch', _touch, {
  cmdOptions: {
    'a': 'atime_only',
    'c': 'no_create',
    'd': 'date',
    'm': 'mtime_only',
    'r': 'reference',
  },
});

//@
//@ ### touch([options,] file [, file ...])
//@ ### touch([options,] file_array)
//@ Available options:
//@
//@ + `-a`: Change only the access time
//@ + `-c`: Do not create any files
//@ + `-m`: Change only the modification time
//@ + `-d DATE`: Parse DATE and use it instead of current time
//@ + `-r FILE`: Use FILE's times instead of current time
//@
//@ Examples:
//@
//@ ```javascript
//@ touch('source.js');
//@ touch('-c', '/path/to/some/dir/source.js');
//@ touch({ '-r': FILE }, '/path/to/some/dir/source.js');
//@ ```
//@
//@ Update the access and modification times of each FILE to the current time.
//@ A FILE argument that does not exist is created empty, unless -c is supplied.
//@ This is a partial implementation of *[touch(1)](http://linux.die.net/man/1/touch)*.
function _touch(opts, files) {
  if (!files) {
    common.error('no files given');
  } else if (typeof files === 'string') {
    files = [].slice.call(arguments, 1);
  } else {
    common.error('file arg should be a string file path or an Array of string file paths');
  }

  files.forEach(function (f) {
    touchFile(opts, f);
  });
  return '';
}

function touchFile(opts, file) {
  var stat = tryStatFile(file);

  if (stat && stat.isDirectory()) {
    // don't error just exit
    return;
  }

  // if the file doesn't already exist and the user has specified --no-create then
  // this script is finished
  if (!stat && opts.no_create) {
    return;
  }

  // open the file and then close it. this will create it if it doesn't exist but will
  // not truncate the file
  fs.closeSync(fs.openSync(file, 'a'));

  //
  // Set timestamps
  //

  // setup some defaults
  var now = new Date();
  var mtime = opts.date || now;
  var atime = opts.date || now;

  // use reference file
  if (opts.reference) {
    var refStat = tryStatFile(opts.reference);
    if (!refStat) {
      common.error('failed to get attributess of ' + opts.reference);
    }
    mtime = refStat.mtime;
    atime = refStat.atime;
  } else if (opts.date) {
    mtime = opts.date;
    atime = opts.date;
  }

  if (opts.atime_only && opts.mtime_only) {
    // keep the new values of mtime and atime like GNU
  } else if (opts.atime_only) {
    mtime = stat.mtime;
  } else if (opts.mtime_only) {
    atime = stat.atime;
  }

  fs.utimesSync(file, atime, mtime);
}

module.exports = _touch;

function tryStatFile(filePath) {
  try {
    return fs.statSync(filePath);
  } catch (e) {
    return null;
  }
}


/***/ }),
/* 46 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);

// add c spaces to the left of str
function lpad(c, str) {
  var res = '' + str;
  if (res.length < c) {
    res = Array((c - res.length) + 1).join(' ') + res;
  }
  return res;
}

common.register('uniq', _uniq, {
  canReceivePipe: true,
  cmdOptions: {
    'i': 'ignoreCase',
    'c': 'count',
    'd': 'duplicates',
  },
});

//@
//@ ### uniq([options,] [input, [output]])
//@ Available options:
//@
//@ + `-i`: Ignore case while comparing
//@ + `-c`: Prefix lines by the number of occurrences
//@ + `-d`: Only print duplicate lines, one for each group of identical lines
//@
//@ Examples:
//@
//@ ```javascript
//@ uniq('foo.txt');
//@ uniq('-i', 'foo.txt');
//@ uniq('-cd', 'foo.txt', 'bar.txt');
//@ ```
//@
//@ Filter adjacent matching lines from input
function _uniq(options, input, output) {
  // Check if this is coming from a pipe
  var pipe = common.readFromPipe();

  if (!pipe) {
    if (!input) common.error('no input given');

    if (!fs.existsSync(input)) {
      common.error(input + ': No such file or directory');
    } else if (fs.statSync(input).isDirectory()) {
      common.error("error reading '" + input + "'");
    }
  }
  if (output && fs.existsSync(output) && fs.statSync(output).isDirectory()) {
    common.error(output + ': Is a directory');
  }

  var lines = (input ? fs.readFileSync(input, 'utf8') : pipe).
              trimRight().
              split(/\r*\n/);

  var compare = function (a, b) {
    return options.ignoreCase ?
           a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase()) :
           a.localeCompare(b);
  };
  var uniqed = lines.reduceRight(function (res, e) {
    // Perform uniq -c on the input
    if (res.length === 0) {
      return [{ count: 1, ln: e }];
    } else if (compare(res[0].ln, e) === 0) {
      return [{ count: res[0].count + 1, ln: e }].concat(res.slice(1));
    } else {
      return [{ count: 1, ln: e }].concat(res);
    }
  }, []).filter(function (obj) {
                 // Do we want only duplicated objects?
    return options.duplicates ? obj.count > 1 : true;
  }).map(function (obj) {
                 // Are we tracking the counts of each line?
    return (options.count ? (lpad(7, obj.count) + ' ') : '') + obj.ln;
  }).join('\n') + '\n';

  if (output) {
    (new common.ShellString(uniqed)).to(output);
    // if uniq writes to output, nothing is passed to the next command in the pipeline (if any)
    return '';
  } else {
    return uniqed;
  }
}

module.exports = _uniq;


/***/ }),
/* 47 */
/***/ (function(module, exports, __webpack_require__) {

var common = __webpack_require__(0);
var fs = __webpack_require__(1);
var path = __webpack_require__(2);

common.register('which', _which, {
  allowGlobbing: false,
  cmdOptions: {
    'a': 'all',
  },
});

// XP's system default value for PATHEXT system variable, just in case it's not
// set on Windows.
var XP_DEFAULT_PATHEXT = '.com;.exe;.bat;.cmd;.vbs;.vbe;.js;.jse;.wsf;.wsh';

// Cross-platform method for splitting environment PATH variables
function splitPath(p) {
  return p ? p.split(path.delimiter) : [];
}

function checkPath(pathName) {
  return fs.existsSync(pathName) && !fs.statSync(pathName).isDirectory();
}

//@
//@ ### which(command)
//@
//@ Examples:
//@
//@ ```javascript
//@ var nodeExec = which('node');
//@ ```
//@
//@ Searches for `command` in the system's PATH. On Windows, this uses the
//@ `PATHEXT` variable to append the extension if it's not already executable.
//@ Returns string containing the absolute path to the command.
function _which(options, cmd) {
  if (!cmd) common.error('must specify command');

  var isWindows = process.platform === 'win32';
  var pathEnv = process.env.path || process.env.Path || process.env.PATH;
  var pathArray = splitPath(pathEnv);

  var queryMatches = [];

  // No relative/absolute paths provided?
  if (cmd.indexOf('/') === -1) {
    // Assume that there are no extensions to append to queries (this is the
    // case for unix)
    var pathExtArray = [''];
    if (isWindows) {
      // In case the PATHEXT variable is somehow not set (e.g.
      // child_process.spawn with an empty environment), use the XP default.
      var pathExtEnv = process.env.PATHEXT || XP_DEFAULT_PATHEXT;
      pathExtArray = splitPath(pathExtEnv.toUpperCase());
    }

    // Search for command in PATH
    for (var k = 0; k < pathArray.length; k++) {
      // already found it
      if (queryMatches.length > 0 && !options.all) break;

      var attempt = path.resolve(pathArray[k], cmd);

      if (isWindows) {
        attempt = attempt.toUpperCase();
      }

      var match = attempt.match(/\.[^<>:"/\|?*.]+$/);
      if (match && pathExtArray.indexOf(match[0]) >= 0) { // this is Windows-only
        // The user typed a query with the file extension, like
        // `which('node.exe')`
        if (checkPath(attempt)) {
          queryMatches.push(attempt);
          break;
        }
      } else { // All-platforms
        // Cycle through the PATHEXT array, and check each extension
        // Note: the array is always [''] on Unix
        for (var i = 0; i < pathExtArray.length; i++) {
          var ext = pathExtArray[i];
          var newAttempt = attempt + ext;
          if (checkPath(newAttempt)) {
            queryMatches.push(newAttempt);
            break;
          }
        }
      }
    }
  } else if (checkPath(cmd)) { // a valid absolute or relative path
    queryMatches.push(path.resolve(cmd));
  }

  if (queryMatches.length > 0) {
    return options.all ? queryMatches : queryMatches[0];
  }
  return options.all ? [] : null;
}
module.exports = _which;


/***/ }),
/* 48 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const t = __webpack_require__(3)
const arrayify = __webpack_require__(4)

class OutputValue {
  constructor (value) {
    this.value = value
    this.hasDefaultArrayValue = false
    this.valueSource = 'unknown'
  }

  isDefined () {
    return t.isDefined(this.value)
  }
}

class Output {
  constructor (definitions, options) {
    this.options = options || {}
    this.output = {}
    this.unknown = []
    this.definitions = definitions
    this._assignDefaultValues()
  }

  _assignDefaultValues () {
    this.definitions.forEach(def => {
      if (t.isDefined(def.defaultValue)) {
        if (def.multiple) {
          this.output[def.name] = new OutputValue(arrayify(def.defaultValue))
          this.output[def.name].hasDefaultArrayValue = true
        } else {
          this.output[def.name] = new OutputValue(def.defaultValue)
        }
        this.output[def.name].valueSource = 'default'
      }
    })
  }

  setFlag (optionArg) {
    const def = this.definitions.get(optionArg)

    if (def) {
      this.output[def.name] = this.output[def.name] || new OutputValue()
      const outputValue = this.output[def.name]

      if (def.multiple) outputValue.value = outputValue.value || []

      /* for boolean types, set value to `true`. For all other types run value through setter function. */
      if (def.isBoolean()) {
        if (Array.isArray(outputValue.value)) {
          outputValue.value.push(true)
        } else {
          outputValue.value = true
        }
        return true
      } else {
        if (!Array.isArray(outputValue.value) && outputValue.valueSource === 'unknown') outputValue.value = null
        return false
      }
    } else {
      this.unknown.push(optionArg)
      return true
    }
  }

  setOptionValue (optionArg, value) {
    const ValueArg = __webpack_require__(49)
    const valueArg = new ValueArg(value)

    const def = this.definitions.get(optionArg)

    this.output[def.name] = this.output[def.name] || new OutputValue()
    const outputValue = this.output[def.name]

    if (def.multiple) outputValue.value = outputValue.value || []

    /* run value through setter function. */
    valueArg.value = def.type(valueArg.value)
    outputValue.valueSource = 'argv'
    if (Array.isArray(outputValue.value)) {
      if (outputValue.hasDefaultArrayValue) {
        outputValue.value = [ valueArg.value ]
        outputValue.hasDefaultArrayValue = false
      } else {
        outputValue.value.push(valueArg.value)
      }
      return false
    } else {
      outputValue.value = valueArg.value
      return true
    }
  }

  /**
   * Return `true` when an option value was set and is not a multiple. Return `false` if option was a multiple or if a value was not yet set.
   */
  setValue (value) {
    const ValueArg = __webpack_require__(49)
    const valueArg = new ValueArg(value)

    /* use the defaultOption */
    const def = this.definitions.getDefault()

    /* handle unknown values in the case a value was already set on a defaultOption */
    if (def) {
      const currentValue = this.output[def.name]
      if (valueArg.isDefined() && currentValue && t.isDefined(currentValue.value)) {
        if (def.multiple) {
          /* in the case we're setting an --option=value value on a multiple defaultOption, tag the value onto the previous unknown */
          if (valueArg.isOptionValueNotationValue && this.unknown.length) {
            this.unknown[this.unknown.length - 1] += `=${valueArg.value}`
            return true
          }
        } else {
          /* currentValue has already been set by argv,log this value as unknown and move on */
          if (currentValue.valueSource === 'argv') {
            this.unknown.push(valueArg.value)
            return true
          }
        }
      }
      return this.setOptionValue(`--${def.name}`, value)
    } else {
      if (valueArg.isOptionValueNotationValue) {
        this.unknown[this.unknown.length - 1] += `=${valueArg.value}`
      } else {
        this.unknown.push(valueArg.value)
      }
      return true
    }
  }

  get (name) {
    return this.output[name] && this.output[name].value
  }

  toObject () {
    let output = Object.assign({}, this.output)
    if (this.options.partial && this.unknown.length) {
      output._unknown = this.unknown
    }
    for (const prop in output) {
      if (prop !== '_unknown') {
        output[prop] = output[prop].value
      }
    }
    return output
  }
}

module.exports = Output


/***/ }),
/* 49 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const t = __webpack_require__(3)
const option = __webpack_require__(6)
const reBeginsWithValueMarker = new RegExp('^' + option.VALUE_MARKER)

class ValueArg {
  constructor (value) {
    this.isOptionValueNotationValue = reBeginsWithValueMarker.test(value)
    /* if the value marker is present at the value beginning, strip it */
    this.value = value ? value.replace(reBeginsWithValueMarker, '') : value
  }

  isDefined () {
    return t.isDefined(this.value)
  }
}

module.exports = ValueArg


/***/ }),
/* 50 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const ansi = __webpack_require__(18)
const os = __webpack_require__(5)
const arrayify = __webpack_require__(4)

class Section {
  constructor () {
    this.list = []
  }
  add (content) {
    arrayify(content).forEach(line => this.list.push(ansi.format(line)))
  }
  emptyLine () {
    this.list.push('')
  }
  header (text) {
    if (text) {
      this.add(ansi.format(text, [ 'underline', 'bold' ]))
      this.emptyLine()
    }
  }
  toString () {
    return this.list.join(os.EOL)
  }
}

module.exports = Section


/***/ }),
/* 51 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const os = __webpack_require__(5)
const Rows = __webpack_require__(91)
const Columns = __webpack_require__(92)
const ansi = __webpack_require__(54)
const extend = __webpack_require__(96)
const padEnd = __webpack_require__(97)

/**
 * @module table-layout
 */

/**
 * Recordset data in (array of objects), text table out.
 * @alias module:table-layout
 */
class Table {

  /**
   * @param {object[]} - input data
   * @param [options] {object} - optional settings
   * @param [options.maxWidth] {number} - maximum width of layout
   * @param [options.noWrap] {boolean} - disable wrapping on all columns
   * @param [options.noTrim] {boolean} - disable line-trimming
   * @param [options.break] {boolean} - enable word-breaking on all columns
   * @param [options.columns] {module:table-layout~columnOption} - array of column-specific options
   * @param [options.ignoreEmptyColumns] {boolean} - if set, empty columns or columns containing only whitespace are not rendered.
   * @param [options.padding] {object} - Padding values to set on each column. Per-column overrides can be set in the `options.columns` array.
   * @param [options.padding.left] {string} - Defaults to a single space.
   * @param [options.padding.right] {string} - Defaults to a single space.
   * @alias module:table-layout
   * @example
   * > Table = require('table-layout')
   * > jsonData = [{
   *   col1: 'Some text you wish to read in table layout',
   *   col2: 'And some more text in column two. '
   * }]
   * > table = new Table(jsonData, { maxWidth: 30 })
   * > console.log(table.toString())
   *  Some text you  And some more
   *  wish to read   text in
   *  in table      column two.
   *  layout
   */
  constructor (data, options) {
    let ttyWidth = (process && (process.stdout.columns || process.stderr.columns)) || 0

    /* Windows quirk workaround  */
    if (ttyWidth && os.platform() === 'win32') ttyWidth--

    let defaults = {
      padding: {
        left: ' ',
        right: ' '
      },
      maxWidth: ttyWidth || 80,
      columns: []
    }

    this.options = extend(defaults, options)
    this.load(data)
  }

  load (data) {
    let options = this.options

    /* remove empty columns */
    if (options.ignoreEmptyColumns) {
      data = Rows.removeEmptyColumns(data)
    }

    this.columns = Columns.getColumns(data)
    this.rows = new Rows(data, this.columns)

    /* load default column properties from options */
    this.columns.maxWidth = options.maxWidth
    this.columns.list.forEach(column => {
      if (options.padding) column.padding = options.padding
      if (options.noWrap) column.noWrap = options.noWrap
      if (options.break) {
        column.break = options.break
        column.contentWrappable = true
      }
    })

    /* load column properties from options.columns */
    options.columns.forEach(optionColumn => {
      let column = this.columns.get(optionColumn.name)
      if (column) {
        if (optionColumn.padding) {
          column.padding.left = optionColumn.padding.left
          column.padding.right = optionColumn.padding.right
        }
        if (optionColumn.width) column.width = optionColumn.width
        if (optionColumn.maxWidth) column.maxWidth = optionColumn.maxWidth
        if (optionColumn.minWidth) column.minWidth = optionColumn.minWidth
        if (optionColumn.noWrap) column.noWrap = optionColumn.noWrap
        if (optionColumn.break) {
          column.break = optionColumn.break
          column.contentWrappable = true
        }
      }
    })

    this.columns.autoSize()
    return this
  }

  getWrapped () {
    const wrap = __webpack_require__(53)

    this.columns.autoSize()
    return this.rows.list.map(row => {
      let line = []
      row.forEach((cell, column) => {
        if (column.noWrap) {
          line.push(cell.value.split(/\r\n?|\n/))
        } else {
          line.push(wrap.lines(cell.value, {
            width: column.wrappedContentWidth,
            break: column.break,
            noTrim: this.options.noTrim
          }))
        }
      })
      return line
    })
  }

  getLines () {
    var wrappedLines = this.getWrapped()
    var lines = []
    wrappedLines.forEach(wrapped => {
      let mostLines = getLongestArray(wrapped)
      for (let i = 0; i < mostLines; i++) {
        let line = []
        wrapped.forEach(cell => {
          line.push(cell[i] || '')
        })
        lines.push(line)
      }
    })
    return lines
  }

  /**
   * Identical to `.toString()` with the exception that the result will be an array of lines, rather than a single, multi-line string.
   * @returns {string[]}
   */
  renderLines () {
    var lines = this.getLines()
    return lines.map(line => {
      return line.reduce((prev, cell, index) => {
        let column = this.columns.list[index]
        return prev + padCell(cell, column.padding, column.generatedWidth)
      }, '')
    })
  }

  /**
   * Returns the input data as a text table.
   * @returns {string}
   */
  toString () {
    return this.renderLines().join(os.EOL) + os.EOL
  }
}

/**
 * Array of arrays in.. Returns the length of the longest one
 * @returns {number}
 * @private
 */
function getLongestArray (arrays) {
  var lengths = arrays.map(array => array.length)
  return Math.max.apply(null, lengths)
}

function padCell (cellValue, padding, width) {
  var ansiLength = cellValue.length - ansi.remove(cellValue).length
  cellValue = cellValue || ''
  return (padding.left || '') +
  padEnd(cellValue, width - padding.length() + ansiLength) +
  (padding.right || '')
}

/**
 * @typedef module:table-layout~columnOption
 * @property name {string} - column name, must match a property name in the input
 * @property [width] {number} - A specific column width. Supply either this or a min and/or max width.
 * @property [minWidth] {number} - column min width
 * @property [maxWidth] {number} - column max width
 * @property [nowrap] {boolean} - disable wrapping for this column
 * @property [break] {boolean} - enable word-breaking for this columns
 * @property [padding] {object} - padding options
 * @property [padding.left] {string} - a string to pad the left of each cell (default: `' '`)
 * @property [padding.right] {string} - a string to pad the right of each cell (default: `' '`)
 */

module.exports = Table


/***/ }),
/* 52 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const t = __webpack_require__(3)

const _value = new WeakMap()
const _column = new WeakMap()

class Cell {
  constructor (value, column) {
    this.value = value
    _column.set(this, column)
  }

  set value (val) {
    _value.set(this, val)
  }

  get value () {
    let cellValue = _value.get(this)
    if (t.isFunction(cellValue)) cellValue = cellValue.call(_column.get(this))
    if (cellValue === undefined) {
      cellValue = ''
    } else {
      cellValue = String(cellValue)
    }
    return cellValue
  }
}

module.exports = Cell


/***/ }),
/* 53 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const os = __webpack_require__(5)
const t = __webpack_require__(3)

/**
 * @module wordwrapjs
 */

const re = {
  chunk: /[^\s-]+?-\b|\S+|\s+|\r\n?|\n/g,
  ansiEscapeSequence: /\u001b.*?m/g
}

/**
 * @alias module:wordwrapjs
 * @typicalname wordwrap
 */
class WordWrap {
  constructor (text, options) {
    options = options || {}
    if (!t.isDefined(text)) text = ''

    this._lines = String(text).split(/\r\n|\n/g)
    this.options = options
    this.options.width = options.width === undefined ? 30 : options.width
  }

  lines () {
    const flatten = __webpack_require__(95)

    /* trim each line of the supplied text */
    return this._lines.map(trimLine.bind(this))

      /* split each line into an array of chunks, else mark it empty */
      .map(line => line.match(re.chunk) || [ '~~empty~~' ])

      /* optionally, break each word on the line into pieces */
      .map(lineWords => {
        if (this.options.break) {
          return lineWords.map(breakWord.bind(this))
        } else {
          return lineWords
        }
      })
      .map(lineWords => lineWords.reduce(flatten, []))

      /* transforming the line of words to one or more new lines wrapped to size */
      .map(lineWords => {
        return lineWords
          .reduce((lines, word) => {
            let currentLine = lines[lines.length - 1]
            if (replaceAnsi(word).length + replaceAnsi(currentLine).length > this.options.width) {
              lines.push(word)
            } else {
              lines[lines.length - 1] += word
            }
            return lines
          }, [ '' ])
      })
      .reduce(flatten, [])

      /* trim the wrapped lines */
      .map(trimLine.bind(this))

      /* filter out empty lines */
      .filter(line => line.trim())

      /* restore the user's original empty lines */
      .map(line => line.replace('~~empty~~', ''))
  }

  wrap () {
    return this.lines().join(os.EOL)
  }

  toString () {
    return this.wrap()
  }

  /**
   * @param {string} - the input text to wrap
   * @param [options] {object} - optional configuration
   * @param [options.width] {number} - the max column width in characters (defaults to 30).
   * @param [options.break] {boolean} - if true, words exceeding the specified `width` will be forcefully broken
   * @param [options.noTrim] {boolean} - By default, each line output is trimmed. If `noTrim` is set, no line-trimming occurs - all whitespace from the input text is left in.
   * @return {string}
   */
  static wrap (text, options) {
    const block = new this(text, options)
    return block.wrap()
  }

  /**
   * Wraps the input text, returning an array of strings (lines).
   * @param {string} - input text
   * @param {object} - Accepts same options as constructor.
   */
  static lines (text, options) {
    const block = new this(text, options)
    return block.lines()
  }

  /**
   * Returns true if the input text would be wrapped if passed into `.wrap()`.
   * @param {string} - input text
   * @return {boolean}
   */
  static isWrappable (text) {
    if (t.isDefined(text)) {
      text = String(text)
      var matches = text.match(re.chunk)
      return matches ? matches.length > 1 : false
    }
  }

  /**
   * Splits the input text into an array of words and whitespace.
   * @param {string} - input text
   * @returns {string[]}
   */
  static getChunks (text) {
    return text.match(re.chunk) || []
  }
}

function trimLine (line) {
  return this.options.noTrim ? line : line.trim()
}

function replaceAnsi (string) {
  return string.replace(re.ansiEscapeSequence, '')
}

/* break a word into several pieces */
function breakWord (word) {
  if (replaceAnsi(word).length > this.options.width) {
    const letters = word.split('')
    let piece
    const pieces = []
    while ((piece = letters.splice(0, this.options.width)).length) {
      pieces.push(piece.join(''))
    }
    return pieces
  } else {
    return word
  }
}

module.exports = WordWrap


/***/ }),
/* 54 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


const ansiEscapeSequence = /\u001b.*?m/g

/**
 * @module ansi
 */
exports.remove = remove
exports.has = has

function remove (input) {
  return input.replace(ansiEscapeSequence, '')
}

function has (input) {
  return ansiEscapeSequence.test(input)
}


/***/ }),
/* 55 */
/***/ (function(module, exports, __webpack_require__) {

const { lstatSync } = __webpack_require__(1);
const path = __webpack_require__(2);
const {
  isNull,
  car,
  cdr,
  cons,
} = __webpack_require__(56);
const sh = __webpack_require__(19);
const commandLineArgs = __webpack_require__(78);
const commandLineCommands = __webpack_require__(87);
const getUsage = __webpack_require__(89);
const pkg = __webpack_require__(100);

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

// Extract the extension (with dot) from a filename. Doesn't use path becuase
// for other purposes, a dotfile needs to be treated as a debodied extension
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
    .filter(file => lstatSync(path.resolve(dir, file)).isFile() && !/^index\.[^.]*$/.test(file));
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

  return path.resolve(dir, fileName);
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

// Read file of filenames
function readFile(file) {
  return sh.cat(file)
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
function addFiles(exportDir, workingDir, keepBody, index, names) {
  if (Number.isNaN(index) || index === undefined) {
    throw new SyntaxError('You did not indicate a file number.');
  }

  if (names.length === 0) {
    throw new SyntaxError('You did not select any files.');
  }

  function reNum(fileMap, startN, prevN, col, lastN) {
    if (isNull(fileMap)) {
      return col([], []);
    }

    const curr = car(fileMap);
    const currN = car(curr);
    const rest = cdr(fileMap);

    // StartN is the number the first inserted file will be mapped to.
    // Any files numbered below that index should be skipped.
    if (currN < startN) {
      return reNum(rest, startN, prevN, (orig, dest) => col(orig, dest), currN);
    }

    // PrevN is the number the previous file will be mapped to. Initialized at
    // the number of the first inserted file + number of files inserted. Once a gap is hit,
    // the function should terminate.
    if (currN > prevN) {
      return col([], []);
    }

    // Preserve redundant numbering
    if (currN === lastN) {
      return reNum(rest, startN, prevN, (orig, dest) => col(
        cons(toPath(workingDir, curr), orig),
        cons(toPath(workingDir, cons(prevN, cdr(curr))), dest),
      ), currN);
    }

    const nextN = prevN + 1;

    // If currN is equal to prevN, then collect
    // the path to the origin file and collect a mv destination that is one number up
    return reNum(rest, startN, nextN, (orig, dest) => col(
      cons(toPath(workingDir, curr), orig),
      cons(toPath(workingDir, cons(nextN, cdr(curr))), dest),
    ), currN);
  }

  const mappedFiles = getParsedNumFiles(workingDir);

  // Files must be moved in reverse to avoid collision
  const mvMap = reNum(mappedFiles, index, index + (names.length - 1), (orig, dest) => {
    const relPathRegExp = /^(\.{0,2}(\/|\\))+/;

    const addOrig = names.map((name) => {
      // Handle a path being given rather than a filename
      if (path.isAbsolute(name)) {
        return name;
      }

      return path.resolve(exportDir, name);
    });

    const addDest = names.map((name, i) => {
      if (keepBody) {
        // Extract filename from path if path is given
        const fileName = name.replace(relPathRegExp, '');
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

  function gapReNum(fileMap, prevN, col, lastN) {
    if (isNull(fileMap)) {
      return col([], []);
    }

    const curr = car(fileMap);
    const currN = car(curr);
    const rest = cdr(fileMap);

    // startIndex is where degapping starts. Defaults to 0.
    // Any files numbered below that index should be skipped.
    if (currN < startIndex) {
      return gapReNum(rest, prevN, (orig, dest) => col(orig, dest), currN);
    }

    // endIndex is where degapping ends. Function terminates
    // when past that index, if one is given
    if (currN > endIndex) {
      return col([], []);
    }

    // Preserve redundant numbering
    if (currN === lastN) {
      return gapReNum(rest, prevN, (orig, dest) => col(
        cons(toPath(dir, curr), orig),
        cons(toPath(dir, cons(prevN - 1, cdr(curr))), dest),
      ), currN);
    }

    const nextN = prevN + 1;

    // Prevent renumbering if file already at correct index
    if (currN === prevN) {
      return gapReNum(rest, nextN, (orig, dest) => col(orig, dest), currN);
    }

    // If currN is equal to prevN, then collect
    // the path to the origin file and collect a mv destination that is the next sequenced number
    return gapReNum(rest, nextN, (orig, dest) => col(
      cons(toPath(dir, curr), orig),
      cons(toPath(dir, cons(prevN, cdr(curr))), dest),
    ), currN);
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

  // Get moved file out of the way to avoid collision on renumbering
  const origFromFileParsed = getParsedFileByIndex(dir, fromIndex);
  const newFromFileParsed = cons('', cdr(origFromFileParsed));

  sh.mv(toPath(dir, origFromFileParsed), toPath(dir, newFromFileParsed));

  addFiles(dir, dir, true, toIndex, [newFromFileParsed.join('')]);
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

  const tmpPath = path.resolve(dir, '.swaptmp');

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
        mv(dir, currN, currN + 1);
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
      sh.rm(path.resolve(dir, file));
    }
  });
}

function ls(dir, full) {
  if (full) {
    console.log(getNumFiles(getFiles(dir)));
  } else{
    console.log(getFileNumbers(dir).join(', '));
  }
}

/* ----- CLI ----- */

/* --- Generate Help Page --- */

// Helper function to generate help page
function printHelpPage(command, optionDefinitions) {
  const commandList = {
    list: {
      name: 'list, ls',
      description: 'Show all used indices.',
    },
    ls: {
      name: 'list, ls',
      description: 'Show all used indices.',
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
      content: `${commandList[command] ? `${commandList[command].summary} ` : ''} If the command takes indices, options declarations must always precede the indices. If the commend takes files, these should always come last, after the options and index.`,
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
      description: 'Prints the installed version of enuf.',
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
      name: 'export-directory',
      alias: 'e',
      type: String,
      description: 'Directory where files are being exported from. Default is the chosen working directory.',
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
    {
      name: 'all',
      alias: 'a',
      type: Boolean,
      description: `Works in conjunction with the --export-directory|-e option. Import all files in given export directory. No effect if an export directory is not provided. Non-recursive (won't look in sub-directories).`,
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

    if (options['export-directory'] && options.all) {
      files = getFiles(options['export-directory']);
    }

    addFiles(
      options['export-directory'] || options.directory,
      options.directory,
      options['keep-body'],
      number,
      files,
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

if (command === 'list' || command === 'ls') {
  const specificOptionDefitions = [
    {
      name: 'full',
      alias: 'f',
      type: Boolean,
      description: 'Displays names of numbered files, instead of just numbers.',
    },
  ];

  const optionDefinitions = globalOptionDefinitions.concat(specificOptionDefitions);

  const options = commandLineArgs(optionDefinitions, { argv });

  if (options.help) {
    printHelpPage(command, optionDefinitions);
  } else {
    ls(options.directory, options.full);
  }
}
if (
  command === 'degap' ||
  command === 'shift' ||
  command === 'move' ||
  command === 'mv' ||
  command === 'swap' ||
  command === 'clean' ||
  command === 'purge'
) {
  const options = commandLineArgs(globalOptionDefinitions, { argv });

  if (options.help) {
    printHelpPage(command, globalOptionDefinitions);
  } else if (
    command === 'purge'
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


/***/ }),
/* 56 */
/***/ (function(module, exports, __webpack_require__) {

const S = {};

// loadTo interface allows circular reference without using 'this'
__webpack_require__(57).loadTo(S);
__webpack_require__(58).loadTo(S);
__webpack_require__(59).loadTo(S);
__webpack_require__(60).loadTo(S);
__webpack_require__(61).loadTo(S);
__webpack_require__(62).loadTo(S);
__webpack_require__(63).loadTo(S);
__webpack_require__(64).loadTo(S);
__webpack_require__(65).loadTo(S);

module.exports = S;


/***/ }),
/* 57 */
/***/ (function(module, exports) {

function loadTo(S) {
  S.LIBS = {
    // Choose with libraries to use
    IN_USE: [],
    // Choose whether to use user definitions
    USE_DEFINED: true,
    defined: {},
  };

  S.getDefinition = (name) => {
    // User-defined terms take precedence over primitives and libraries
    if (S.LIBS.USE_DEFINED && Object.prototype.hasOwnProperty.call(S.LIBS.defined, name)) {
      return S.LIBS.defined[name];
    }

    const dfl = S.getDefFromLibs(S, S.LIBS, S.LIBS.IN_USE, name);

    return dfl !== '#NOT_DEFINED' ? dfl : name;
  };


  S.value = (exp) => {
    if (S.isObject(exp)) {
      const copy = Object.assign({}, exp);
      S.replaceObjVal(copy, S.value);
      return copy;
    }

    if (S.isAtom(exp) || S.isNull(exp)) {
      // NaN must be handled seperately, since it will create in infinite
      // loop if run through the ternary termination condition
      // below (since NaN !== NaN)
      if (Number.isNaN(exp)) {
        return exp;
      }
      const def = S.getDefinition(exp);
      return S.isEqual(exp, def) ? exp : S.value(def);
    }

    const first = S.getDefinition(S.car(exp));
    const rest = S.cdr(exp);

    if (S.isObject(first)) {
      const copy = Object.assign({}, first);
      S.replaceObjVal(copy, S.value);
      return S.cons(copy, S.value(rest));
    }

    if (S.isFunction(first)) {
      if (first === S.lambda || first === S.define || first === S.quote) {
        return first(...rest);
      }

      // Evaluation control needs to be handed off specially to these functions
      if (first === S.cond || first === S['||'] || first === S['&&']) {
        return first(rest);
      }

      return first(...S.value(rest));
    }

    return S.cons(S.value(first), S.value(rest));
  };

  S.evaluate = (scheme, js = false, final = false, convert = false) => {
    let input;

    // converts from scheme to JS if not already converted
    if (!js) {
      input = S.jSExpression(scheme);
    } else if (typeof scheme === 'number') {
      input = 0 + scheme;
    } else if (typeof scheme === 'boolean') {
      input = !!scheme;
    } else if (S.isObject(scheme)) {
      input = Object.assign({}, scheme);
    } else {
      input = scheme.slice();
    }

    // evaluates the input
    let output = S.value(input);

    // return only the final result if the option final is selected
    if (final && S.isList(output)) {
      output = output[output.length - 1];
    }

    // converts the output back to scheme if option convert is selected
    if (convert) {
      output = S.sExpression(output);
    }

    return output;
  };
}

module.exports = { loadTo };


/***/ }),
/* 58 */
/***/ (function(module, exports) {

function loadTo(S) {
  S.SPEC_SYM = {
    // Choose which symbol libraries to use
    IN_USE: [],
    // Choose whether to use user-defined symbols
    USE_DEFINED: true,
    primitive: {
      '#t': true,
      '#f': false,
      '#n': '\n',
      '#NaN': NaN,
      '#Infinity': Infinity,
      '#null': null,
      '#undefined': undefined,
    },

    defined: {},
  };

  // Deep replace objects
  S.replaceObjVal = (obj, replacer) => {
    Object.entries(obj).forEach((ent) => {
      const key = ent[0];
      const val = ent[1];

      if (S.isObject(val)) {
        S.replaceObjVal(val, replacer);
      }

      obj[key] = replacer(val);
    });
  };

  // Converts object (including all nested objects) into a rel
  S.toRel = (obj, stringify = false, toJSE = false) => {
    function relify(l) {
      if (S.isNull(l)) {
        return l;
      }

      const first = S.car(l);
      const rest = S.cdr(l);

      if (S.isObject(first)) {
        return S.cons(relify(Object.entries(first)), relify(rest));
      }

      if (S.isAtom(first)) {
        return S.cons(first, relify(rest));
      }

      return S.cons(relify(first), relify(rest));
    }

    let result = relify(Object.entries(obj));

    // Converts the result to a string for easy fit into an S-Expression
    if (stringify) {
      result = JSON.stringify(result);
    }

    // Converts to jS-Expression if standalone conversion is desired; @param stringify must
    // also be true for this to work
    if (toJSE) {
      result = S.jSExpression(result);
    }

    return result;
  };

  S.jSExpression = (input) => {
    function toJS(string) {
      if (typeof string !== 'string') {
        throw new Error('The argument must be a string');
      }

      function formatText(txt) {
        return txt.slice()
          .replace(/"/g, '#\\"#')
          .replace(/[{}[\],]/g, '#$&#');
      }

      let exp = `(${formatText(string.slice(0))})`; // clone string wrap string in outer parens (valid expressions must be wrapped in outer parens)

      exp = JSON.parse(exp
        // split string on spaces, parens and commas (the last one to avoid errors)
        .split(/([()\s,])/)
        // filter out empty strings, white space and newline
        .filter(a => (a !== '' && a !== ' ' && a !== '\n'))
        // handles backslash characters
        .map((a) => {
          if (a === '\\') {
            return '\\\\';
          }

          return a;
        })
        // create a string representation of an array
        .join(',')
        // wrap everything except parentheses in double quotes (required to parse JSON)
        .replace(/([^,()]+),/g, '"$1",')
        // unwrap numbers from double quotes, except those which are object keys
        .replace(/"(\d+\.?\d*|\.\d+)"([^:])/g, '$1$2')
        // handle double double quotes
        .replace(/""([^"]*)""/g, '"\\"$1\\""')
        // handles JSON objects
        .replace(/([\]}])"/g, '$1')
        .replace(/"([[{])/g, '$1')
        .replace(/"?,,,"?/g, ',')
        .replace(/\\,\\"/g, ',')
        // handle grammatical periods
        .replace(/,([.]+),/g, ',"$1",')
        // add leading zero to decimal numbers, like '.5' (required to parse JSON)
        .replace(/(,)(\.)/g, '$10$2')
        // remove unecessary decimal point from integers, like '5.' (required to parse  JSON)
        .replace(/\.(,)/g, '$1')
        // replace ( with [
        .replace(/\(,/g, '[')
        // replace ) with ]
        .replace(/,?\)/g, ']'));

      function specailSymbols(a) {
        const def = S.SPEC_SYM.defined;

        if (S.SPEC_SYM.USE_DEFINED && Object.prototype.hasOwnProperty.call(def, a)) {
          return def[a];
        }

        const prim = S.SPEC_SYM.primitive;
        const dfl = S.getDefFromLibs(prim, S.SPEC_SYM, S.SPEC_SYM.IN_USE, a);

        if (dfl !== '#NOT_DEFINED') {
          return dfl;
        }

        if (typeof a === 'string') {
          // handles commas, double quotes and brackets
          const reformatted = a.slice()
            .replace(/#([{}[\],])#/g, '$1')
            .replace(/#"#/g, '"');

          // turn to JSON
          if (/(^{.*}$)|(^\[.*\]$)/.test(reformatted)) {
            return replaceSpecialSymbols(JSON.parse(reformatted));
          }

          return reformatted;
        }

        return a;
      }

      function replaceSpecialSymbols(sExp) {
        if (S.isObject(sExp)) {
          S.replaceObjVal(sExp, replaceSpecialSymbols);
          return sExp;
        }

        if (S.isAtom(sExp)) {
          return specailSymbols(sExp);
        }

        if (S.isNull(sExp)) {
          return sExp;
        }

        const first = S.car(sExp);
        const rest = S.cdr(sExp);

        if (S.isObject(first)) {
          S.replaceObjVal(first, replaceSpecialSymbols);
          return S.cons(first, replaceSpecialSymbols(rest));
        }

        if (S.isAtom(first)) {
          return S.cons(specailSymbols(first), replaceSpecialSymbols(rest));
        }

        return S.cons(replaceSpecialSymbols(first), replaceSpecialSymbols(rest));
      }

      return S.car(replaceSpecialSymbols(exp));
    }

    // input can be an array of S-Expression strings...
    if (S.isList(input)) {
      return input.map(string => toJS(string));
    }

    // ... or a single string
    return toJS(input);
  };

  S.sExpression = (exp) => {
    const revSymEnts = {};
    const revSymVals = {};
    const symLib = S.SPEC_SYM;
    const usedSyms = symLib.IN_USE;
    const useDefs = symLib.USE_DEFINED;

    // delete overriden defined symbols ---
    const clonedSpecSym = Object.assign({}, symLib);
    const deleteList = usedSyms.slice();

    deleteList.push('primitive');

    function deleter(lib) {
      const keys = Object.keys(clonedSpecSym[lib]);

      deleteList.forEach((libName) => {
        keys.forEach((key) => {
          delete clonedSpecSym[libName][key];
        });
      });
    }

    if (useDefs) {
      deleter('defined');
    } else {
      // And delete unused symbol libraries
      delete clonedSpecSym.defined;
    }

    Object.keys(symLib).forEach((key) => {
      if (deleteList.indexOf(key) === -1 && key !== 'defined') {
        delete clonedSpecSym[key];
      }
    });
    // ... end of delete unused symbol libraries

    usedSyms.forEach((libName) => {
      deleteList.shift();
      deleter(libName);
    });
    //  --- end of delete overriden defined symbols

    const sse = Object.entries(clonedSpecSym);

    sse.forEach((ent) => {
      const libName = ent[0];
      const syms = ent[1];

      // create an object whose keys are library names and values are an array
      // of key-value pairs of symbol and defintion
      revSymEnts[libName] = Object.entries(syms);
      // create an object whose keys are library names and values are an array
      // of the defintions
      revSymVals[libName] = Object.values(syms);
    });

    function parens(a) {
      return S.cons(['('], S.cons(a, [')']));
    }

    function convert(input) {
      if (S.isAtom(input) || S.isNull(input)) {
        return input;
      }

      const first = S.car(input);
      const rest = S.cdr(input);

      if (S.isAtom(first)) {
        return S.cons(first, convert(rest));
      }

      return S.cons(parens(convert(first)), convert(rest));
    }

    function getSymFromRevLib(libNames, name) {
      if (S.isNull(libNames)) {
        const primI = revSymVals.primitive.indexOf(name);

        if (primI > -1) {
          return revSymEnts.primitive[primI][0];
        }

        // Returns special message if name is not defined
        // (cannot return undefined becuase undefined might be the definiton of name)
        return '#NOT_DEFINED';
      }

      const first = S.car(libNames);
      const rest = S.cdr(libNames);
      const firstLibI = revSymVals[first].indexOf(name);

      if (firstLibI > -1) {
        return revSymEnts[first][firstLibI][0];
      }

      return getSymFromRevLib(rest, name);
    }

    function specailSymbols(a) {
      // Indexing in getSymFromRevLid won't work for NaN (since NaN !== NaN),
      // so has to be hardcoded. Unfortunately this means you would have to
      // override NaN seperately to set the symbol...
      if (Number.isNaN(a)) {
        return '#NaN';
      }

      if (useDefs) {
        const defI = revSymVals.defined.indexOf(a);

        if (defI > -1) {
          return revSymEnts.defined[defI][0];
        }
      }

      const sfl = getSymFromRevLib(usedSyms, a);

      if (sfl !== '#NOT_DEFINED') {
        return sfl;
      }

      if (S.isObject(a)) {
        const copy = Object.assign({}, a);
        replaceSpecialSymbols(copy);
        return JSON.stringify(copy);
      }

      return a;
    }

    function replaceSpecialSymbols(jSExp) {
      if (S.isObject(jSExp)) {
        const copy = Object.assign({}, jSExp);
        S.replaceObjVal(copy, replaceSpecialSymbols);
        return JSON.stringify(copy);
      }

      if (S.isAtom(jSExp)) {
        return specailSymbols(jSExp);
      }

      if (S.isNull(jSExp)) {
        return jSExp;
      }

      const first = S.car(jSExp);
      const rest = S.cdr(jSExp);

      if (S.isObject(first)) {
        const copy = Object.assign({}, first);
        S.replaceObjVal(copy, replaceSpecialSymbols);
        return S.cons(JSON.stringify(copy), replaceSpecialSymbols(rest));
      }

      if (S.isAtom(first)) {
        return S.cons(specailSymbols(first), replaceSpecialSymbols(rest));
      }

      return S.cons(replaceSpecialSymbols(first), replaceSpecialSymbols(rest));
    }

    function format(output) {
      const replaced = replaceSpecialSymbols(output);

      if (S.isList(replaced)) {
        const closed = parens(replaced);
        return closed.join()
          .replace(/,/g, ' ');
      }

      return replaced.toString();
    }

    return format(convert(exp));
  };
}

module.exports = { loadTo };


/***/ }),
/* 59 */
/***/ (function(module, exports) {

function loadTo(S) {
  /**
   * Takes any expression as an argument and returns true if the argument is a list
   * and false otherwise. A JavaScript array is a list.
   * @param  {*} exp
   * @returns  {boolean}
   * @example
   * // returns true
   * isList(['hello', 'world']);
   */
  S.isList = exp => Array.isArray(exp);

  /**
   * Takes any expression as an argument and returns true if the argument is an
   * atom and false otherwise. Anything which is not a list is an atom!
   * @param  {*} exp
   * @returns  {boolean}
   * @example
   * // returns true
   * isAtom('hello');
   *
   * // returns true
   * isAtom({ hello: 'world' });
   */
  S.isAtom = exp => !S.isList(exp);

  /**
   * Takes any expression as an argument and returns true if the argument is an atom which is
   * a JavaScript object (i.e., typeof argument === 'object') other than null and false
   * otherwise. isObject returns false if the argument is a JavaScript array, because arrays
   * are lists.
   * @param  {*} exp
   * @returns  {boolean}
   * @example
   * // returns true
   * isObject({ hello: 'world' });
   *
   * // returns false
   * isObject(['hello', 'world']);
   */
  S.isObject = exp => S.isAtom(exp) && (typeof exp === 'object') && exp !== null;

  /**
   * Takes any expression as an argument and returns true if the argument is a number (i.e.,
   * typeof argument === 'number') other than NaN and false otherwise.
   * @param  {*} exp
   * @returns  {boolean}
   * @example
   * // returns true
   * isNumber(15);
   */
  S.isNumber = exp => !Number.isNaN(exp) && typeof exp === 'number';

  /**
   * Takes a list as an argument and returns true if the argument is the empty list and
   * false otherwise.
   * @param  {list} l
   * @returns  {boolean}
   * @example
   * // returns true
   * isNull([]);
   */
  S.isNull = (l) => {
    if (S.isAtom(l)) {
      throw new TypeError('The Law of isNull: You can only ask isNull of a list.');
    }
    return l.length === 0;
  };

  /**
   * Takes an expression as an argument and returns true if the argument evaluates to a
   * function (i.e., it is a function or a reference to a function) and false otherwise.
   * @param  {*} exp
   * @returns  {boolean}
   * @example
   * // returns true
   * isFunction('cdr');
   *
   * // returns true
   * isFunction(console.log);
   */
  S.isFunction = exp => typeof S.getDefinition(exp) === 'function';

  /**
   * Takes a number as an argument and returns true if the argument is 0 and false
   * otherwise.
   * @param  {number} n
   * @returns  {boolean}
   * @example
   * // returns true
   * isZero(0);
   */
  S.isZero = (n) => {
    if (!S.isNumber(n)) {
      throw new TypeError('The Law of isZero: The argument of isZero must be a number.');
    }

    return n === 0;
  };
}

module.exports = { loadTo };


/***/ }),
/* 60 */
/***/ (function(module, exports) {

function loadTo(S) {
  S.isEqobj = (o1, o2) => {
    if (!S.isObject(o1) || !S.isObject(o2)) {
      throw new TypeError('The Law of isEqobj: isEqobj can only be used to compare two objects.');
    }

    return S.isEqlist(Object.entries(o1), Object.entries(o2));
  };

  S.isEqan = (a1, a2) => {
    if (S.isList(a1) || S.isList(a2)) {
      throw new TypeError('The Law of isEqan: isEqan can only be used to compare two atoms.');
    }

    if (S.isObject(a1) && S.isObject(a2)) {
      return S.isEqobj(a1, a2);
    }

    if (S.isObject(a1) || S.isObject(a2)) {
      return false;
    }

    return a1 === a2;
  };

  S.isEqual = (s1, s2) => {
    if (S.isAtom(s1) && S.isAtom(s2)) {
      return S.isEqan(s1, s2);
    }

    if (S.isAtom(s1) || S.isAtom(s2)) {
      return false;
    }

    return S.isEqlist(s1, s2);
  };

  S.isEqlist = (l1, l2) => {
    if (S.isAtom(l1) || S.isAtom(l2)) {
      throw new TypeError('The Law of isEqlist: isEqlist can only be used to compare two lists.');
    }

    if (S.isNull(l1) && S.isNull(l2)) {
      return true;
    }

    if (S.isNull(l1) || S.isNull(l2)) {
      return false;
    }

    return S.isEqual(S.car(l1), S.car(l2)) && S.isEqual(S.cdr(l1), S.cdr(l2));
  };
}

module.exports = { loadTo };


/***/ }),
/* 61 */
/***/ (function(module, exports) {

/**
 * Inserts methods into namespace
 * @param  {object} S The namepsace into which the methods are inserted.
 * @returns  {void}
 */
function loadTo(S) {
  /**
   * Takes a non-empty list as its argument and return the first member of the argument.
   * @param  {list} l
   * @returns  {*}
   * @example
   * // returns 1
   * car([1, 2]);
   */
  S.car = (l) => {
    if (S.isAtom(l) || S.isNull(l)) {
      throw new TypeError('The Law of Car: You can only take the car of a non-empty list.');
    }

    let result = l[0];

    // Clone there result if it is a list or an object to keep the function pure
    if (S.isList(result)) {
      result = result.slice();
    }

    if (S.isObject(result)) {
      result = Object.assign({}, result);
    }

    return result;
  };

  /**
   * Takes a non-empty list as its argument and returns a new list contaiting the same members
   * as the argument, except for the car.
   * @param  {list} l
   * @return  {list}
   * @example
   * // returns [2]
   * cdr([1, 2]);
   */
  S.cdr = (l) => {
    if (S.isAtom(l) || S.isNull(l)) {
      throw new TypeError('The Law of Cdr: You can only take the cdr of a non-empty list.');
    }

    return l.slice(1);
  };

  /**
   * Takes two arguments, the second of which must be a list, and returns a new list comtaining
   * the first argument and the elements of the second argument.
   * @param  {*} exp
   * @param  {list} l
   * @returns {list}
   * @example
   * // returns ['cat', 'dog']
   * cons('cat', ['dog']);
   */
  S.cons = (exp, l) => {
    if (S.isAtom(l)) {
      throw new TypeError('The Law of Cons: The second argument must be a list.');
    }

    const n = l.slice(0);

    n.unshift(exp);

    return n;
  };

  /**
   * Takes any expression as its argument and returns the expression unevaluated. Should only
   * be used inside S-Expressions and jS-Expressions.
   * @param  {*} exp
   * @returns  {*}
   * @example
   * // returns ['cat', 'dog']
   * evaluate(`(cons cat (dog))`);
   *
   * // returns ['cons', 'cat', ['dog']]
   * evaluate(`(quote (cons cat (dog)))`);
   */
  S.quote = exp => exp;

  /**
   * Adds 1 to a number.
   * @param  {number} n
   * @returns {number}
   * @example
   * // returns 2
   * add1(1);
   */
  S.add1 = (n) => {
    if (!S.isNumber(n)) {
      throw new TypeError('Arithmetic operations can only be done on numbers.');
    }

    return n + 1;
  };

  /**
   * Subtracts 1 from a number.
   * @param  {number} n
   * @returns {number}
   * @example
   * // returns 1
   * sub1(2);
   */
  S.sub1 = (n) => {
    if (!S.isNumber(n)) {
      throw new TypeError('Arithmetic operations can only be done on numbers.');
    }

    return n - 1;
  };
}

module.exports = { loadTo };


/***/ }),
/* 62 */
/***/ (function(module, exports) {

function loadTo(S) {
  /**
   * Takes a list of question and answer pairs as its argument. If the question evaluates to
   * true, the answer is evaluated. Otherwise, the next question is evaluated. The final
   * question is always 'else', which is always true. This is similar, but not equivalent to,
   * a series of JavaScript if ( ... ) { ... } else if ( ... ) { ... } else { ... } statements.
   * The difference is that "truthiness" is not allowed. The result of the question must
   * strictly equal true in order for the answer to be evaluated. Should only be used inside of
   * S-Expressions and jS-Expressions to avoid confusion.
   * @param  {list} args
   * @returns {*}
   * @example
   * // returns [ 'We', 'have', 'a', 'mouse', 'problem!' ]
   * evaluate(`
   *  (cond
   *   ((isNull (mouse)) (quote (No more mice in the house!)))
   *   (else (quote (We have a mouse problem!))))
   * `);
   */
  S.cond = (args) => {
    const condition = S.car(args);
    const question = S.car(condition);
    const answer = S.car(S.cdr(condition));

    if (S.isNull(S.cdr(args)) && question !== 'else') {
      throw new SyntaxError('The Law of Cond: The last question must always be else!');
    }

    // Truthiness is not allowed
    if (S.value(question) === true || question === 'else') {
      return S.value(answer);
    }

    return S.cond(S.cdr(args));
  };

  /**
   * Takes a list containing two expressions as its argument. If the first expression evaluates
   * to false, the second expression is evaluated and its result is returned. If the first
   * expression evaluates to true, the function returns true and the second expression of the
   * argument is not evaluated. However, "truthiness" is not allowed. The result of the first
   * expression must strictly equal either true or false. Otherwise, an error is thrown. This is
   * not equivalent to the JavaScipt || operator, which returns the result of the first expression
   * if it is "truthy" and the result of the second expression if the result of the first expression
   * is "falsy". Should only be used inside of S-Expressions and jS-Expressions to avoid confusion.
   * @param {list} args
   * @returns {*}
   * @example
   * // returns [ 'There', 'is', 'a', 'bird', 'in', 'the', 'house.' ]
   * evaluate(`(|| (isNull (bird)) (quote (There is a bird in the house.)))`);
   *
   * // throws an error
   * evaluate(`(|| (quote bird) (quote house))`);
   */
  S['||'] = (args) => {
    if (S.value(S.car(args)) === false) {
      return S.value(S.car(S.cdr(args)));
    }

    if (S.value(S.car(args)) === true) {
      return true;
    }

    throw new Error(`The result of the first expression of the argument must strictly
      equal either true or false. "Truthiness" is not permitted.`);
  };

  /**
   * Takes a list containing two expressions as its argument. If the first expression evaluates
   * to true, the second expression is evaluated and its result is returned. If the first
   * expression evaluates to false, the function returns false and the second expression of the
   * argument is not evaluated. However, "truthiness" is not allowed. The result of the first
   * expression must strictly equal either true or false. Otherwise, an error is thrown. This is
   * not equivalent to the JavaScipt && operator, which returns the result of the first expression
   * if it is "falsy" and the result of the second expression if the result of the first expression
   * is "truthy". Should only be used inside of S-Expressions and jS-Expressions to avoid confusion.
   * @param {list} args
   * @returns {*}
   * @example
   * // returns [ 'There', 'are', 'no', 'birds', 'in', 'the', 'house.' ]
   * evaluate(`(&& (isNull ()) (quote (There are no birds in the house.)))`);
   *
   * // throws an error
   * evaluate(`(&& (quote bird) (quote house))`);
   */
  S['&&'] = (args) => {
    if (S.value(S.car(args)) === true) {
      return S.value(S.car(S.cdr(args)));
    }

    if (S.value(S.car(args)) === false) {
      return false;
    }

    throw new Error(`The result of the first expression of the argument must strictly
      equal either true or false. "Truthiness" is not permitted.`);
  };
}

module.exports = { loadTo };


/***/ }),
/* 63 */
/***/ (function(module, exports) {

function loadTo(S) {
  /**
   * Takes two list as arguments: a list of arguments and a function body. Returns a function.
   * Defining functions with lambda should only be done inside S-Expressions or jS-Expressions.
   * However, once defined, the functions are interoperable with JavaScript.
   * @param  {list} args
   * @param  {list} func
   * @returns  {function}
   * @example
   * evaluate(`(
   * (define isLat
   *  (lambda (l)
   *    (cond
   *      ((isNull l) #t)
   *      ((isAtom (car l)) (isLat (cdr l)))
   *      (else #f)))))`);
   *
   * // returns true
   * evaluate(`(isLat (cat dog)))`);
   *
   * const D = LIBS.defined;
   *
   * // returns true
   * D.isLat(['cat', 'dog']);
   */
  S.lambda = (args, func) => {
    function replace(list, matches, replacements) {
      if (S.isNull(list)) {
        return list;
      }

      const first = S.car(list);
      const rest = S.cdr(list);

      if (S.isAtom(first)) {
        const i = matches.indexOf(first);

        if (i > -1) {
          return S.cons(replacements[i], replace(rest, matches, replacements));
        }

        return S.cons(first, replace(rest, matches, replacements));
      }

      return S.cons(replace(first, matches, replacements), replace(rest, matches, replacements));
    }

    function result(...argValues) {
      return S.value(replace(func, args, argValues));
    }

    return result;
  };
}

module.exports = { loadTo };


/***/ }),
/* 64 */
/***/ (function(module, exports) {

function loadTo(S) {
  S.getDefFromLibs = (prim, lib, libNames, name) => {
    if (S.isNull(libNames)) {
      if (Object.prototype.hasOwnProperty.call(prim, name)) {
        return prim[name];
      }

      // Returns special message if name is not defined
      // (cannot return undefined becuase undefined might be the definiton of name)
      return '#NOT_DEFINED';
    }

    const first = S.car(libNames);
    const rest = S.cdr(libNames);

    if (Object.prototype.hasOwnProperty.call(lib[first], name)) {
      return lib[first][name];
    }

    return S.getDefFromLibs(prim, lib, rest, name);
  };

  // Get name from one or more library modules
  S.getLibName = (...libs) => libs.map(lib => lib.getName());

  // "Soft" unload def and sym libraries (removes names from "IN_USE", but does
  // not delete lib from s object)
  S._unloadLib = (base, ...libNames) => {
    const usedLibs = base.IN_USE;
    libNames.forEach((name) => {
      const i = usedLibs.indexOf(name);

      if (i !== -1) {
        usedLibs.splice(i, 1);
      }
    });
  };

  S.unloadDefLib = (...libNames) => S._unloadLib(S.LIBS, ...libNames);

  S.unloadSymLib = (...libNames) => S._unloadLib(S.SPEC_SYM, ...libNames);

  S.unloadLib = (...libNames) => {
    S.unloadDefLib(...libNames);
    S.unloadSymLib(...libNames);
  };

  // "Hard" unload by removing def and sym libs from s object (and also remove
  // names from "IN_USE")
  S._removeLib = (base, ...libNames) => {
    libNames.forEach(name => delete base[name]);
    S._unloadLib(base, ...libNames);
  };

  S.removeDefLib = (...libNames) => S._removeLib(S.LIBS, ...libNames);

  S.removeSymLib = (...libNames) => S._removeLib(S.SPEC_SYM, ...libNames);

  S.removeLib = (...libNames) => {
    S.removeDefLib(...libNames);
    S.removeSymLib(...libNames);
  };

  // Reload "soft" unloaded libs
  S._reloadLib = (base, ...libNames) => {
    const usedLibs = base.IN_USE;

    libNames.forEach((name) => {
      if (usedLibs.indexOf(name) !== -1) {
        console.warn(`The ${name} ${base === S.LIBS ? 'definition' : 'symbol'} library is already in use.`);
      } else {
        usedLibs.unshift(name);
      }
    });
  };

  S.reloadDefLib = (...libNames) => S._reloadLib(S.LIBS, ...libNames);

  S.reloadSymLib = (...libNames) => S._reloadLib(S.SPEC_SYM, ...libNames);

  S.reloadLib = (...libNames) => {
    S.reloadDefLib(...libNames);
    S.reloadSymLib(...libNames);
  };

  // Load def and sym library modules. Does a hard unload in case the library is already loaded;
  S.loadLib = (...libModules) => {
    libModules.forEach((mod) => {
      const name = mod.getName();
      S.removeLib(name);
      mod.loadTo(S);
    });
  };

  // Set and clear symbol and defintions
  S.define = (name, exp) => {
    if (typeof name !== 'string') {
      throw new Error('The Law of Define: The first argument must be a string.');
    }

    S.LIBS.defined[name] = S.value(exp);
  };

  S.undefine = (name) => {
    delete S.LIBS.defined[name];
  };

  S.setSym = (name, exp) => {
    if (typeof name !== 'string') {
      throw new Error('The Law of SetSym: The first argument must be a string.');
    }

    S.SPEC_SYM.defined[name] = exp;
  };

  S.remSym = (name) => {
    delete S.SPEC_SYM.defined[name];
  };

  // Hard and soft unload user definitions and symbols
  S.loadDefs = () => {
    S.LIBS.USE_DEFINED = true;
  };

  S.unloadDefs = () => {
    S.LIBS.USE_DEFINED = false;
  };

  S.clearDefs = () => {
    S.LIBS.defined = {};
  };

  S.loadSyms = () => {
    S.SPEC_SYM.USE_DEFINED = true;
  };

  S.unloadSyms = () => {
    S.SPEC_SYM.USE_DEFINED = false;
  };

  S.clearSyms = () => {
    S.SPEC_SYM.defined = {};
  };

  // Set used def and sym libs
  S._setUsedLibs = (base, array) => {
    base.IN_USE = array;
  };

  S.setUsedDefLibs = array => S._setUsedLibs(S.LIBS, array);

  S.setUsedSymLibs = array => S._setUsedLibs(S.SPEC_SYM, array);

  S.setUsedLibs = (array) => {
    S.setUsedDefLibs(array);
    S.setUsedSymLibs(array);
  };

  // Get used def and sym libs
  S._getUsedLibs = base => base.IN_USE.slice();

  S.getUsedDefLibs = () => S._getUsedLibs(S.LIBS);

  S.getUsedSymLibs = () => S._getUsedLibs(S.SPEC_SYM);

  S.getUsedLibs = () => {
    const result = {};

    result.defintions = S.getUsedDefLibs();
    result.symbols = S.getUsedSymLibs();

    return result;
  };

  // Get load order of sym and def libs: Load order is shown such that the rightmost item
  // is the last loaded and overrides anything to the left. This is the opposite of
  // how the IN_USE array works (lowest index (leftmost) overrides), although the IN_USE
  // array handles loading as you would expect (libs are loaded to front of array, so last loaded
  // lib overrides anything that came before it).
  S._getLoadOrder = (base) => {
    const result = S._getUsedLibs(base);
    result.push('primitive');

    if (base.USE_DEFINED) {
      result.unshift('defined');
    }

    return result.reverse();
  };

  S.getDefLoadOrder = () => S._getLoadOrder(S.LIBS);

  S.getSymLoadOrder = () => S._getLoadOrder(S.SPEC_SYM);

  S.getLoadOrder = () => {
    const result = {};

    result.defintions = S.getDefLoadOrder();
    result.symbols = S.getSymLoadOrder();

    return result;
  };
}

module.exports = { loadTo };


/***/ }),
/* 65 */
/***/ (function(module, exports) {

function loadTo(S) {
  S.valueAsync = async function (exp) {
    return S.value(exp);
  };

  S.evaluateAsync = async function (scheme, js = false, final = false, convert = false) {
    return S.evaluate(scheme, js, final, convert);
  };

  S.jSExpressionAsync = async function (input) {
    return S.jSExpression(input);
  };

  S.sExpressionAsync = async function (exp) {
    return S.sExpression(exp);
  };
}

module.exports = { loadTo };


/***/ }),
/* 66 */
/***/ (function(module, exports, __webpack_require__) {

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var pathModule = __webpack_require__(2);
var isWindows = process.platform === 'win32';
var fs = __webpack_require__(1);

// JavaScript implementation of realpath, ported from node pre-v6

var DEBUG = process.env.NODE_DEBUG && /fs/.test(process.env.NODE_DEBUG);

function rethrow() {
  // Only enable in debug mode. A backtrace uses ~1000 bytes of heap space and
  // is fairly slow to generate.
  var callback;
  if (DEBUG) {
    var backtrace = new Error;
    callback = debugCallback;
  } else
    callback = missingCallback;

  return callback;

  function debugCallback(err) {
    if (err) {
      backtrace.message = err.message;
      err = backtrace;
      missingCallback(err);
    }
  }

  function missingCallback(err) {
    if (err) {
      if (process.throwDeprecation)
        throw err;  // Forgot a callback but don't know where? Use NODE_DEBUG=fs
      else if (!process.noDeprecation) {
        var msg = 'fs: missing callback ' + (err.stack || err.message);
        if (process.traceDeprecation)
          console.trace(msg);
        else
          console.error(msg);
      }
    }
  }
}

function maybeCallback(cb) {
  return typeof cb === 'function' ? cb : rethrow();
}

var normalize = pathModule.normalize;

// Regexp that finds the next partion of a (partial) path
// result is [base_with_slash, base], e.g. ['somedir/', 'somedir']
if (isWindows) {
  var nextPartRe = /(.*?)(?:[\/\\]+|$)/g;
} else {
  var nextPartRe = /(.*?)(?:[\/]+|$)/g;
}

// Regex to find the device root, including trailing slash. E.g. 'c:\\'.
if (isWindows) {
  var splitRootRe = /^(?:[a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/][^\\\/]+)?[\\\/]*/;
} else {
  var splitRootRe = /^[\/]*/;
}

exports.realpathSync = function realpathSync(p, cache) {
  // make p is absolute
  p = pathModule.resolve(p);

  if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
    return cache[p];
  }

  var original = p,
      seenLinks = {},
      knownHard = {};

  // current character position in p
  var pos;
  // the partial path so far, including a trailing slash if any
  var current;
  // the partial path without a trailing slash (except when pointing at a root)
  var base;
  // the partial path scanned in the previous round, with slash
  var previous;

  start();

  function start() {
    // Skip over roots
    var m = splitRootRe.exec(p);
    pos = m[0].length;
    current = m[0];
    base = m[0];
    previous = '';

    // On windows, check that the root exists. On unix there is no need.
    if (isWindows && !knownHard[base]) {
      fs.lstatSync(base);
      knownHard[base] = true;
    }
  }

  // walk down the path, swapping out linked pathparts for their real
  // values
  // NB: p.length changes.
  while (pos < p.length) {
    // find the next part
    nextPartRe.lastIndex = pos;
    var result = nextPartRe.exec(p);
    previous = current;
    current += result[0];
    base = previous + result[1];
    pos = nextPartRe.lastIndex;

    // continue if not a symlink
    if (knownHard[base] || (cache && cache[base] === base)) {
      continue;
    }

    var resolvedLink;
    if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
      // some known symbolic link.  no need to stat again.
      resolvedLink = cache[base];
    } else {
      var stat = fs.lstatSync(base);
      if (!stat.isSymbolicLink()) {
        knownHard[base] = true;
        if (cache) cache[base] = base;
        continue;
      }

      // read the link if it wasn't read before
      // dev/ino always return 0 on windows, so skip the check.
      var linkTarget = null;
      if (!isWindows) {
        var id = stat.dev.toString(32) + ':' + stat.ino.toString(32);
        if (seenLinks.hasOwnProperty(id)) {
          linkTarget = seenLinks[id];
        }
      }
      if (linkTarget === null) {
        fs.statSync(base);
        linkTarget = fs.readlinkSync(base);
      }
      resolvedLink = pathModule.resolve(previous, linkTarget);
      // track this, if given a cache.
      if (cache) cache[base] = resolvedLink;
      if (!isWindows) seenLinks[id] = linkTarget;
    }

    // resolve the link, then start over
    p = pathModule.resolve(resolvedLink, p.slice(pos));
    start();
  }

  if (cache) cache[original] = p;

  return p;
};


exports.realpath = function realpath(p, cache, cb) {
  if (typeof cb !== 'function') {
    cb = maybeCallback(cache);
    cache = null;
  }

  // make p is absolute
  p = pathModule.resolve(p);

  if (cache && Object.prototype.hasOwnProperty.call(cache, p)) {
    return process.nextTick(cb.bind(null, null, cache[p]));
  }

  var original = p,
      seenLinks = {},
      knownHard = {};

  // current character position in p
  var pos;
  // the partial path so far, including a trailing slash if any
  var current;
  // the partial path without a trailing slash (except when pointing at a root)
  var base;
  // the partial path scanned in the previous round, with slash
  var previous;

  start();

  function start() {
    // Skip over roots
    var m = splitRootRe.exec(p);
    pos = m[0].length;
    current = m[0];
    base = m[0];
    previous = '';

    // On windows, check that the root exists. On unix there is no need.
    if (isWindows && !knownHard[base]) {
      fs.lstat(base, function(err) {
        if (err) return cb(err);
        knownHard[base] = true;
        LOOP();
      });
    } else {
      process.nextTick(LOOP);
    }
  }

  // walk down the path, swapping out linked pathparts for their real
  // values
  function LOOP() {
    // stop if scanned past end of path
    if (pos >= p.length) {
      if (cache) cache[original] = p;
      return cb(null, p);
    }

    // find the next part
    nextPartRe.lastIndex = pos;
    var result = nextPartRe.exec(p);
    previous = current;
    current += result[0];
    base = previous + result[1];
    pos = nextPartRe.lastIndex;

    // continue if not a symlink
    if (knownHard[base] || (cache && cache[base] === base)) {
      return process.nextTick(LOOP);
    }

    if (cache && Object.prototype.hasOwnProperty.call(cache, base)) {
      // known symbolic link.  no need to stat again.
      return gotResolvedLink(cache[base]);
    }

    return fs.lstat(base, gotStat);
  }

  function gotStat(err, stat) {
    if (err) return cb(err);

    // if not a symlink, skip to the next path part
    if (!stat.isSymbolicLink()) {
      knownHard[base] = true;
      if (cache) cache[base] = base;
      return process.nextTick(LOOP);
    }

    // stat & read the link if not read before
    // call gotTarget as soon as the link target is known
    // dev/ino always return 0 on windows, so skip the check.
    if (!isWindows) {
      var id = stat.dev.toString(32) + ':' + stat.ino.toString(32);
      if (seenLinks.hasOwnProperty(id)) {
        return gotTarget(null, seenLinks[id], base);
      }
    }
    fs.stat(base, function(err) {
      if (err) return cb(err);

      fs.readlink(base, function(err, target) {
        if (!isWindows) seenLinks[id] = target;
        gotTarget(err, target);
      });
    });
  }

  function gotTarget(err, target, base) {
    if (err) return cb(err);

    var resolvedLink = pathModule.resolve(previous, target);
    if (cache) cache[base] = resolvedLink;
    gotResolvedLink(resolvedLink);
  }

  function gotResolvedLink(resolvedLink) {
    // resolve the link, then start over
    p = pathModule.resolve(resolvedLink, p.slice(pos));
    start();
  }
};


/***/ }),
/* 67 */
/***/ (function(module, exports, __webpack_require__) {

var concatMap = __webpack_require__(68);
var balanced = __webpack_require__(69);

module.exports = expandTop;

var escSlash = '\0SLASH'+Math.random()+'\0';
var escOpen = '\0OPEN'+Math.random()+'\0';
var escClose = '\0CLOSE'+Math.random()+'\0';
var escComma = '\0COMMA'+Math.random()+'\0';
var escPeriod = '\0PERIOD'+Math.random()+'\0';

function numeric(str) {
  return parseInt(str, 10) == str
    ? parseInt(str, 10)
    : str.charCodeAt(0);
}

function escapeBraces(str) {
  return str.split('\\\\').join(escSlash)
            .split('\\{').join(escOpen)
            .split('\\}').join(escClose)
            .split('\\,').join(escComma)
            .split('\\.').join(escPeriod);
}

function unescapeBraces(str) {
  return str.split(escSlash).join('\\')
            .split(escOpen).join('{')
            .split(escClose).join('}')
            .split(escComma).join(',')
            .split(escPeriod).join('.');
}


// Basically just str.split(","), but handling cases
// where we have nested braced sections, which should be
// treated as individual members, like {a,{b,c},d}
function parseCommaParts(str) {
  if (!str)
    return [''];

  var parts = [];
  var m = balanced('{', '}', str);

  if (!m)
    return str.split(',');

  var pre = m.pre;
  var body = m.body;
  var post = m.post;
  var p = pre.split(',');

  p[p.length-1] += '{' + body + '}';
  var postParts = parseCommaParts(post);
  if (post.length) {
    p[p.length-1] += postParts.shift();
    p.push.apply(p, postParts);
  }

  parts.push.apply(parts, p);

  return parts;
}

function expandTop(str) {
  if (!str)
    return [];

  // I don't know why Bash 4.3 does this, but it does.
  // Anything starting with {} will have the first two bytes preserved
  // but *only* at the top level, so {},a}b will not expand to anything,
  // but a{},b}c will be expanded to [a}c,abc].
  // One could argue that this is a bug in Bash, but since the goal of
  // this module is to match Bash's rules, we escape a leading {}
  if (str.substr(0, 2) === '{}') {
    str = '\\{\\}' + str.substr(2);
  }

  return expand(escapeBraces(str), true).map(unescapeBraces);
}

function identity(e) {
  return e;
}

function embrace(str) {
  return '{' + str + '}';
}
function isPadded(el) {
  return /^-?0\d/.test(el);
}

function lte(i, y) {
  return i <= y;
}
function gte(i, y) {
  return i >= y;
}

function expand(str, isTop) {
  var expansions = [];

  var m = balanced('{', '}', str);
  if (!m || /\$$/.test(m.pre)) return [str];

  var isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
  var isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
  var isSequence = isNumericSequence || isAlphaSequence;
  var isOptions = m.body.indexOf(',') >= 0;
  if (!isSequence && !isOptions) {
    // {a},b}
    if (m.post.match(/,.*\}/)) {
      str = m.pre + '{' + m.body + escClose + m.post;
      return expand(str);
    }
    return [str];
  }

  var n;
  if (isSequence) {
    n = m.body.split(/\.\./);
  } else {
    n = parseCommaParts(m.body);
    if (n.length === 1) {
      // x{{a,b}}y ==> x{a}y x{b}y
      n = expand(n[0], false).map(embrace);
      if (n.length === 1) {
        var post = m.post.length
          ? expand(m.post, false)
          : [''];
        return post.map(function(p) {
          return m.pre + n[0] + p;
        });
      }
    }
  }

  // at this point, n is the parts, and we know it's not a comma set
  // with a single entry.

  // no need to expand pre, since it is guaranteed to be free of brace-sets
  var pre = m.pre;
  var post = m.post.length
    ? expand(m.post, false)
    : [''];

  var N;

  if (isSequence) {
    var x = numeric(n[0]);
    var y = numeric(n[1]);
    var width = Math.max(n[0].length, n[1].length)
    var incr = n.length == 3
      ? Math.abs(numeric(n[2]))
      : 1;
    var test = lte;
    var reverse = y < x;
    if (reverse) {
      incr *= -1;
      test = gte;
    }
    var pad = n.some(isPadded);

    N = [];

    for (var i = x; test(i, y); i += incr) {
      var c;
      if (isAlphaSequence) {
        c = String.fromCharCode(i);
        if (c === '\\')
          c = '';
      } else {
        c = String(i);
        if (pad) {
          var need = width - c.length;
          if (need > 0) {
            var z = new Array(need + 1).join('0');
            if (i < 0)
              c = '-' + z + c.slice(1);
            else
              c = z + c;
          }
        }
      }
      N.push(c);
    }
  } else {
    N = concatMap(n, function(el) { return expand(el, false) });
  }

  for (var j = 0; j < N.length; j++) {
    for (var k = 0; k < post.length; k++) {
      var expansion = pre + N[j] + post[k];
      if (!isTop || isSequence || expansion)
        expansions.push(expansion);
    }
  }

  return expansions;
}



/***/ }),
/* 68 */
/***/ (function(module, exports) {

module.exports = function (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        var x = fn(xs[i], i);
        if (isArray(x)) res.push.apply(res, x);
        else res.push(x);
    }
    return res;
};

var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};


/***/ }),
/* 69 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

module.exports = balanced;
function balanced(a, b, str) {
  if (a instanceof RegExp) a = maybeMatch(a, str);
  if (b instanceof RegExp) b = maybeMatch(b, str);

  var r = range(a, b, str);

  return r && {
    start: r[0],
    end: r[1],
    pre: str.slice(0, r[0]),
    body: str.slice(r[0] + a.length, r[1]),
    post: str.slice(r[1] + b.length)
  };
}

function maybeMatch(reg, str) {
  var m = str.match(reg);
  return m ? m[0] : null;
}

balanced.range = range;
function range(a, b, str) {
  var begs, beg, left, right, result;
  var ai = str.indexOf(a);
  var bi = str.indexOf(b, ai + 1);
  var i = ai;

  if (ai >= 0 && bi > 0) {
    begs = [];
    left = str.length;

    while (i >= 0 && !result) {
      if (i == ai) {
        begs.push(i);
        ai = str.indexOf(a, i + 1);
      } else if (begs.length == 1) {
        result = [ begs.pop(), bi ];
      } else {
        beg = begs.pop();
        if (beg < left) {
          left = beg;
          right = bi;
        }

        bi = str.indexOf(b, i + 1);
      }

      i = ai < bi && ai >= 0 ? ai : bi;
    }

    if (begs.length) {
      result = [ left, right ];
    }
  }

  return result;
}


/***/ }),
/* 70 */
/***/ (function(module, exports, __webpack_require__) {

try {
  var util = __webpack_require__(9);
  if (typeof util.inherits !== 'function') throw '';
  module.exports = util.inherits;
} catch (e) {
  module.exports = __webpack_require__(71);
}


/***/ }),
/* 71 */
/***/ (function(module, exports) {

if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}


/***/ }),
/* 72 */
/***/ (function(module, exports) {

module.exports = require("events");

/***/ }),
/* 73 */
/***/ (function(module, exports, __webpack_require__) {

module.exports = globSync
globSync.GlobSync = GlobSync

var fs = __webpack_require__(1)
var rp = __webpack_require__(20)
var minimatch = __webpack_require__(8)
var Minimatch = minimatch.Minimatch
var Glob = __webpack_require__(7).Glob
var util = __webpack_require__(9)
var path = __webpack_require__(2)
var assert = __webpack_require__(21)
var isAbsolute = __webpack_require__(10)
var common = __webpack_require__(22)
var alphasort = common.alphasort
var alphasorti = common.alphasorti
var setopts = common.setopts
var ownProp = common.ownProp
var childrenIgnored = common.childrenIgnored
var isIgnored = common.isIgnored

function globSync (pattern, options) {
  if (typeof options === 'function' || arguments.length === 3)
    throw new TypeError('callback provided to sync glob\n'+
                        'See: https://github.com/isaacs/node-glob/issues/167')

  return new GlobSync(pattern, options).found
}

function GlobSync (pattern, options) {
  if (!pattern)
    throw new Error('must provide pattern')

  if (typeof options === 'function' || arguments.length === 3)
    throw new TypeError('callback provided to sync glob\n'+
                        'See: https://github.com/isaacs/node-glob/issues/167')

  if (!(this instanceof GlobSync))
    return new GlobSync(pattern, options)

  setopts(this, pattern, options)

  if (this.noprocess)
    return this

  var n = this.minimatch.set.length
  this.matches = new Array(n)
  for (var i = 0; i < n; i ++) {
    this._process(this.minimatch.set[i], i, false)
  }
  this._finish()
}

GlobSync.prototype._finish = function () {
  assert(this instanceof GlobSync)
  if (this.realpath) {
    var self = this
    this.matches.forEach(function (matchset, index) {
      var set = self.matches[index] = Object.create(null)
      for (var p in matchset) {
        try {
          p = self._makeAbs(p)
          var real = rp.realpathSync(p, self.realpathCache)
          set[real] = true
        } catch (er) {
          if (er.syscall === 'stat')
            set[self._makeAbs(p)] = true
          else
            throw er
        }
      }
    })
  }
  common.finish(this)
}


GlobSync.prototype._process = function (pattern, index, inGlobStar) {
  assert(this instanceof GlobSync)

  // Get the first [n] parts of pattern that are all strings.
  var n = 0
  while (typeof pattern[n] === 'string') {
    n ++
  }
  // now n is the index of the first one that is *not* a string.

  // See if there's anything else
  var prefix
  switch (n) {
    // if not, then this is rather simple
    case pattern.length:
      this._processSimple(pattern.join('/'), index)
      return

    case 0:
      // pattern *starts* with some non-trivial item.
      // going to readdir(cwd), but not include the prefix in matches.
      prefix = null
      break

    default:
      // pattern has some string bits in the front.
      // whatever it starts with, whether that's 'absolute' like /foo/bar,
      // or 'relative' like '../baz'
      prefix = pattern.slice(0, n).join('/')
      break
  }

  var remain = pattern.slice(n)

  // get the list of entries.
  var read
  if (prefix === null)
    read = '.'
  else if (isAbsolute(prefix) || isAbsolute(pattern.join('/'))) {
    if (!prefix || !isAbsolute(prefix))
      prefix = '/' + prefix
    read = prefix
  } else
    read = prefix

  var abs = this._makeAbs(read)

  //if ignored, skip processing
  if (childrenIgnored(this, read))
    return

  var isGlobStar = remain[0] === minimatch.GLOBSTAR
  if (isGlobStar)
    this._processGlobStar(prefix, read, abs, remain, index, inGlobStar)
  else
    this._processReaddir(prefix, read, abs, remain, index, inGlobStar)
}


GlobSync.prototype._processReaddir = function (prefix, read, abs, remain, index, inGlobStar) {
  var entries = this._readdir(abs, inGlobStar)

  // if the abs isn't a dir, then nothing can match!
  if (!entries)
    return

  // It will only match dot entries if it starts with a dot, or if
  // dot is set.  Stuff like @(.foo|.bar) isn't allowed.
  var pn = remain[0]
  var negate = !!this.minimatch.negate
  var rawGlob = pn._glob
  var dotOk = this.dot || rawGlob.charAt(0) === '.'

  var matchedEntries = []
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i]
    if (e.charAt(0) !== '.' || dotOk) {
      var m
      if (negate && !prefix) {
        m = !e.match(pn)
      } else {
        m = e.match(pn)
      }
      if (m)
        matchedEntries.push(e)
    }
  }

  var len = matchedEntries.length
  // If there are no matched entries, then nothing matches.
  if (len === 0)
    return

  // if this is the last remaining pattern bit, then no need for
  // an additional stat *unless* the user has specified mark or
  // stat explicitly.  We know they exist, since readdir returned
  // them.

  if (remain.length === 1 && !this.mark && !this.stat) {
    if (!this.matches[index])
      this.matches[index] = Object.create(null)

    for (var i = 0; i < len; i ++) {
      var e = matchedEntries[i]
      if (prefix) {
        if (prefix.slice(-1) !== '/')
          e = prefix + '/' + e
        else
          e = prefix + e
      }

      if (e.charAt(0) === '/' && !this.nomount) {
        e = path.join(this.root, e)
      }
      this._emitMatch(index, e)
    }
    // This was the last one, and no stats were needed
    return
  }

  // now test all matched entries as stand-ins for that part
  // of the pattern.
  remain.shift()
  for (var i = 0; i < len; i ++) {
    var e = matchedEntries[i]
    var newPattern
    if (prefix)
      newPattern = [prefix, e]
    else
      newPattern = [e]
    this._process(newPattern.concat(remain), index, inGlobStar)
  }
}


GlobSync.prototype._emitMatch = function (index, e) {
  if (isIgnored(this, e))
    return

  var abs = this._makeAbs(e)

  if (this.mark)
    e = this._mark(e)

  if (this.absolute) {
    e = abs
  }

  if (this.matches[index][e])
    return

  if (this.nodir) {
    var c = this.cache[abs]
    if (c === 'DIR' || Array.isArray(c))
      return
  }

  this.matches[index][e] = true

  if (this.stat)
    this._stat(e)
}


GlobSync.prototype._readdirInGlobStar = function (abs) {
  // follow all symlinked directories forever
  // just proceed as if this is a non-globstar situation
  if (this.follow)
    return this._readdir(abs, false)

  var entries
  var lstat
  var stat
  try {
    lstat = fs.lstatSync(abs)
  } catch (er) {
    if (er.code === 'ENOENT') {
      // lstat failed, doesn't exist
      return null
    }
  }

  var isSym = lstat && lstat.isSymbolicLink()
  this.symlinks[abs] = isSym

  // If it's not a symlink or a dir, then it's definitely a regular file.
  // don't bother doing a readdir in that case.
  if (!isSym && lstat && !lstat.isDirectory())
    this.cache[abs] = 'FILE'
  else
    entries = this._readdir(abs, false)

  return entries
}

GlobSync.prototype._readdir = function (abs, inGlobStar) {
  var entries

  if (inGlobStar && !ownProp(this.symlinks, abs))
    return this._readdirInGlobStar(abs)

  if (ownProp(this.cache, abs)) {
    var c = this.cache[abs]
    if (!c || c === 'FILE')
      return null

    if (Array.isArray(c))
      return c
  }

  try {
    return this._readdirEntries(abs, fs.readdirSync(abs))
  } catch (er) {
    this._readdirError(abs, er)
    return null
  }
}

GlobSync.prototype._readdirEntries = function (abs, entries) {
  // if we haven't asked to stat everything, then just
  // assume that everything in there exists, so we can avoid
  // having to stat it a second time.
  if (!this.mark && !this.stat) {
    for (var i = 0; i < entries.length; i ++) {
      var e = entries[i]
      if (abs === '/')
        e = abs + e
      else
        e = abs + '/' + e
      this.cache[e] = true
    }
  }

  this.cache[abs] = entries

  // mark and cache dir-ness
  return entries
}

GlobSync.prototype._readdirError = function (f, er) {
  // handle errors, and cache the information
  switch (er.code) {
    case 'ENOTSUP': // https://github.com/isaacs/node-glob/issues/205
    case 'ENOTDIR': // totally normal. means it *does* exist.
      var abs = this._makeAbs(f)
      this.cache[abs] = 'FILE'
      if (abs === this.cwdAbs) {
        var error = new Error(er.code + ' invalid cwd ' + this.cwd)
        error.path = this.cwd
        error.code = er.code
        throw error
      }
      break

    case 'ENOENT': // not terribly unusual
    case 'ELOOP':
    case 'ENAMETOOLONG':
    case 'UNKNOWN':
      this.cache[this._makeAbs(f)] = false
      break

    default: // some unusual error.  Treat as failure.
      this.cache[this._makeAbs(f)] = false
      if (this.strict)
        throw er
      if (!this.silent)
        console.error('glob error', er)
      break
  }
}

GlobSync.prototype._processGlobStar = function (prefix, read, abs, remain, index, inGlobStar) {

  var entries = this._readdir(abs, inGlobStar)

  // no entries means not a dir, so it can never have matches
  // foo.txt/** doesn't match foo.txt
  if (!entries)
    return

  // test without the globstar, and with every child both below
  // and replacing the globstar.
  var remainWithoutGlobStar = remain.slice(1)
  var gspref = prefix ? [ prefix ] : []
  var noGlobStar = gspref.concat(remainWithoutGlobStar)

  // the noGlobStar pattern exits the inGlobStar state
  this._process(noGlobStar, index, false)

  var len = entries.length
  var isSym = this.symlinks[abs]

  // If it's a symlink, and we're in a globstar, then stop
  if (isSym && inGlobStar)
    return

  for (var i = 0; i < len; i++) {
    var e = entries[i]
    if (e.charAt(0) === '.' && !this.dot)
      continue

    // these two cases enter the inGlobStar state
    var instead = gspref.concat(entries[i], remainWithoutGlobStar)
    this._process(instead, index, true)

    var below = gspref.concat(entries[i], remain)
    this._process(below, index, true)
  }
}

GlobSync.prototype._processSimple = function (prefix, index) {
  // XXX review this.  Shouldn't it be doing the mounting etc
  // before doing stat?  kinda weird?
  var exists = this._stat(prefix)

  if (!this.matches[index])
    this.matches[index] = Object.create(null)

  // If it doesn't exist, then just mark the lack of results
  if (!exists)
    return

  if (prefix && isAbsolute(prefix) && !this.nomount) {
    var trail = /[\/\\]$/.test(prefix)
    if (prefix.charAt(0) === '/') {
      prefix = path.join(this.root, prefix)
    } else {
      prefix = path.resolve(this.root, prefix)
      if (trail)
        prefix += '/'
    }
  }

  if (process.platform === 'win32')
    prefix = prefix.replace(/\\/g, '/')

  // Mark this as a match
  this._emitMatch(index, prefix)
}

// Returns either 'DIR', 'FILE', or false
GlobSync.prototype._stat = function (f) {
  var abs = this._makeAbs(f)
  var needDir = f.slice(-1) === '/'

  if (f.length > this.maxLength)
    return false

  if (!this.stat && ownProp(this.cache, abs)) {
    var c = this.cache[abs]

    if (Array.isArray(c))
      c = 'DIR'

    // It exists, but maybe not how we need it
    if (!needDir || c === 'DIR')
      return c

    if (needDir && c === 'FILE')
      return false

    // otherwise we have to stat, because maybe c=true
    // if we know it exists, but not what it is.
  }

  var exists
  var stat = this.statCache[abs]
  if (!stat) {
    var lstat
    try {
      lstat = fs.lstatSync(abs)
    } catch (er) {
      if (er && (er.code === 'ENOENT' || er.code === 'ENOTDIR')) {
        this.statCache[abs] = false
        return false
      }
    }

    if (lstat && lstat.isSymbolicLink()) {
      try {
        stat = fs.statSync(abs)
      } catch (er) {
        stat = lstat
      }
    } else {
      stat = lstat
    }
  }

  this.statCache[abs] = stat

  var c = true
  if (stat)
    c = stat.isDirectory() ? 'DIR' : 'FILE'

  this.cache[abs] = this.cache[abs] || c

  if (needDir && c === 'FILE')
    return false

  return c
}

GlobSync.prototype._mark = function (p) {
  return common.mark(this, p)
}

GlobSync.prototype._makeAbs = function (f) {
  return common.makeAbs(this, f)
}


/***/ }),
/* 74 */
/***/ (function(module, exports, __webpack_require__) {

var wrappy = __webpack_require__(23)
var reqs = Object.create(null)
var once = __webpack_require__(24)

module.exports = wrappy(inflight)

function inflight (key, cb) {
  if (reqs[key]) {
    reqs[key].push(cb)
    return null
  } else {
    reqs[key] = [cb]
    return makeres(key)
  }
}

function makeres (key) {
  return once(function RES () {
    var cbs = reqs[key]
    var len = cbs.length
    var args = slice(arguments)

    // XXX It's somewhat ambiguous whether a new callback added in this
    // pass should be queued for later execution if something in the
    // list of callbacks throws, or if it should just be discarded.
    // However, it's such an edge case that it hardly matters, and either
    // choice is likely as surprising as the other.
    // As it happens, we do go ahead and schedule it for later execution.
    try {
      for (var i = 0; i < len; i++) {
        cbs[i].apply(null, args)
      }
    } finally {
      if (cbs.length > len) {
        // added more in the interim.
        // de-zalgo, just in case, but don't call again.
        cbs.splice(0, len)
        process.nextTick(function () {
          RES.apply(null, args)
        })
      } else {
        delete reqs[key]
      }
    }
  })
}

function slice (args) {
  var length = args.length
  var array = []

  for (var i = 0; i < length; i++) array[i] = args[i]
  return array
}


/***/ }),
/* 75 */
/***/ (function(module, exports) {

module.exports = [
  'cat',
  'cd',
  'chmod',
  'cp',
  'dirs',
  'echo',
  'exec',
  'find',
  'grep',
  'head',
  'ln',
  'ls',
  'mkdir',
  'mv',
  'pwd',
  'rm',
  'sed',
  'set',
  'sort',
  'tail',
  'tempdir',
  'test',
  'to',
  'toEnd',
  'touch',
  'uniq',
  'which',
];


/***/ }),
/* 76 */
/***/ (function(module, exports, __webpack_require__) {

var map = {
	"./cat": 25,
	"./cat.js": 25,
	"./cd": 11,
	"./cd.js": 11,
	"./chmod": 26,
	"./chmod.js": 26,
	"./common": 0,
	"./common.js": 0,
	"./cp": 12,
	"./cp.js": 12,
	"./dirs": 27,
	"./dirs.js": 27,
	"./echo": 28,
	"./echo.js": 28,
	"./error": 13,
	"./error.js": 13,
	"./exec": 29,
	"./exec.js": 29,
	"./find": 30,
	"./find.js": 30,
	"./grep": 31,
	"./grep.js": 31,
	"./head": 32,
	"./head.js": 32,
	"./ln": 33,
	"./ln.js": 33,
	"./ls": 16,
	"./ls.js": 16,
	"./mkdir": 34,
	"./mkdir.js": 34,
	"./mv": 35,
	"./mv.js": 35,
	"./popd": 36,
	"./popd.js": 36,
	"./pushd": 37,
	"./pushd.js": 37,
	"./pwd": 15,
	"./pwd.js": 15,
	"./rm": 17,
	"./rm.js": 17,
	"./sed": 38,
	"./sed.js": 38,
	"./set": 39,
	"./set.js": 39,
	"./sort": 40,
	"./sort.js": 40,
	"./tail": 41,
	"./tail.js": 41,
	"./tempdir": 14,
	"./tempdir.js": 14,
	"./test": 42,
	"./test.js": 42,
	"./to": 43,
	"./to.js": 43,
	"./toEnd": 44,
	"./toEnd.js": 44,
	"./touch": 45,
	"./touch.js": 45,
	"./uniq": 46,
	"./uniq.js": 46,
	"./which": 47,
	"./which.js": 47
};
function webpackContext(req) {
	return __webpack_require__(webpackContextResolve(req));
};
function webpackContextResolve(req) {
	var id = map[req];
	if(!(id + 1)) // check for number or string
		throw new Error("Cannot find module '" + req + "'.");
	return id;
};
webpackContext.keys = function webpackContextKeys() {
	return Object.keys(map);
};
webpackContext.resolve = webpackContextResolve;
module.exports = webpackContext;
webpackContext.id = 76;

/***/ }),
/* 77 */
/***/ (function(module, exports) {

module.exports = require("child_process");

/***/ }),
/* 78 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * @module command-line-args
 */
module.exports = commandLineArgs

/**
 * Returns an object containing all options set on the command line. By default it parses the global  [`process.argv`](https://nodejs.org/api/process.html#process_process_argv) array.
 *
 * By default, an exception is thrown if the user sets an unknown option (one without a valid [definition](#exp_module_definition--OptionDefinition)). To enable __partial parsing__, invoke `commandLineArgs` with the `partial` option - all unknown arguments will be returned in the `_unknown` property.
 *
 *
 * @param {module:definition[]} - An array of [OptionDefinition](#exp_module_definition--OptionDefinition) objects
 * @param [options] {object} - Options.
 * @param [options.argv] {string[]} - An array of strings, which if passed will be parsed instead  of `process.argv`.
 * @param [options.partial] {boolean} - If `true`, an array of unknown arguments is returned in the `_unknown` property of the output.
 * @returns {object}
 * @throws `UNKNOWN_OPTION` if `options.partial` is false and the user set an undefined option
 * @throws `NAME_MISSING` if an option definition is missing the required `name` property
 * @throws `INVALID_TYPE` if an option definition has a `type` value that's not a function
 * @throws `INVALID_ALIAS` if an alias is numeric, a hyphen or a length other than 1
 * @throws `DUPLICATE_NAME` if an option definition name was used more than once
 * @throws `DUPLICATE_ALIAS` if an option definition alias was used more than once
 * @throws `DUPLICATE_DEFAULT_OPTION` if more than one option definition has `defaultOption: true`
 * @alias module:command-line-args
 */
function commandLineArgs (optionDefinitions, options) {
  options = options || {}
  const Definitions = __webpack_require__(79)
  const Argv = __webpack_require__(81)
  const definitions = new Definitions()
  definitions.load(optionDefinitions)
  const argv = new Argv()
  argv.load(options.argv)
  argv.expandOptionEqualsNotation()
  argv.expandGetoptNotation()
  argv.validate(definitions, options)

  const OutputClass = definitions.isGrouped() ? __webpack_require__(86) : __webpack_require__(48)
  const output = new OutputClass(definitions, options)
  let optionName

  const option = __webpack_require__(6)
  for (const arg of argv) {
    if (option.isOption(arg)) {
      optionName = output.setFlag(arg) ? undefined : arg
    } else {
      if (optionName) {
        optionName = output.setOptionValue(optionName, arg) ? undefined : optionName
      } else {
        optionName = output.setValue(arg) ? undefined : optionName
      }
    }
  }

  return output.toObject()
}


/***/ }),
/* 79 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const arrayify = __webpack_require__(4)
const option = __webpack_require__(6)
const Definition = __webpack_require__(80)
const t = __webpack_require__(3)

/**
 * @module definitions
 * @private
 */

/**
 * @alias module:definitions
 */
class Definitions extends Array {
  load (definitions) {
    this.clear()
    arrayify(definitions).forEach(def => this.push(new Definition(def)))
    this.validate()
  }

  clear () {
    this.length = 0
  }

  /**
   * validate option definitions
   * @returns {string}
   */
  validate (argv) {
    const someHaveNoName = this.some(def => !def.name)
    if (someHaveNoName) {
      halt(
        'NAME_MISSING',
        'Invalid option definitions: the `name` property is required on each definition'
      )
    }

    const someDontHaveFunctionType = this.some(def => def.type && typeof def.type !== 'function')
    if (someDontHaveFunctionType) {
      halt(
        'INVALID_TYPE',
        'Invalid option definitions: the `type` property must be a setter fuction (default: `Boolean`)'
      )
    }

    let invalidOption

    const numericAlias = this.some(def => {
      invalidOption = def
      return t.isDefined(def.alias) && t.isNumber(def.alias)
    })
    if (numericAlias) {
      halt(
        'INVALID_ALIAS',
        'Invalid option definition: to avoid ambiguity an alias cannot be numeric [--' + invalidOption.name + ' alias is -' + invalidOption.alias + ']'
      )
    }

    const multiCharacterAlias = this.some(def => {
      invalidOption = def
      return t.isDefined(def.alias) && def.alias.length !== 1
    })
    if (multiCharacterAlias) {
      halt(
        'INVALID_ALIAS',
        'Invalid option definition: an alias must be a single character'
      )
    }

    const hypenAlias = this.some(def => {
      invalidOption = def
      return def.alias === '-'
    })
    if (hypenAlias) {
      halt(
        'INVALID_ALIAS',
        'Invalid option definition: an alias cannot be "-"'
      )
    }

    const duplicateName = hasDuplicates(this.map(def => def.name))
    if (duplicateName) {
      halt(
        'DUPLICATE_NAME',
        'Two or more option definitions have the same name'
      )
    }

    const duplicateAlias = hasDuplicates(this.map(def => def.alias))
    if (duplicateAlias) {
      halt(
        'DUPLICATE_ALIAS',
        'Two or more option definitions have the same alias'
      )
    }

    const duplicateDefaultOption = hasDuplicates(this.map(def => def.defaultOption))
    if (duplicateDefaultOption) {
      halt(
        'DUPLICATE_DEFAULT_OPTION',
        'Only one option definition can be the defaultOption'
      )
    }
  }

  /**
   * @param {string}
   * @returns {Definition}
   */
  get (arg) {
    return option.short.test(arg)
      ? this.find(def => def.alias === option.short.name(arg))
      : this.find(def => def.name === option.long.name(arg))
  }

  getDefault () {
    return this.find(def => def.defaultOption === true)
  }

  isGrouped () {
    return this.some(def => def.group)
  }

  whereGrouped () {
    return this.filter(containsValidGroup)
  }
  whereNotGrouped () {
    return this.filter(def => !containsValidGroup(def))
  }
}

function halt (name, message) {
  const err = new Error(message)
  err.name = name
  throw err
}

function containsValidGroup (def) {
  return arrayify(def.group).some(group => group)
}

function hasDuplicates (array) {
  const items = {}
  for (let i = 0; i < array.length; i++) {
    const value = array[i]
    if (items[value]) {
      return true
    } else {
      if (t.isDefined(value)) items[value] = true
    }
  }
}

module.exports = Definitions


/***/ }),
/* 80 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const t = __webpack_require__(3)

/**
 * @module definition
 */

/**
 * Describes a command-line option. Additionally, you can add `description` and `typeLabel` properties and make use of [command-line-usage](https://github.com/75lb/command-line-usage).
 * @alias module:definition
 * @typicalname option
 */
class OptionDefinition {
  constructor (definition) {
    /**
    * The only required definition property is `name`, so the simplest working example is
    * ```js
    * [
    *   { name: "file" },
    *   { name: "verbose" },
    *   { name: "depth"}
    * ]
    * ```
    *
    * In this case, the value of each option will be either a Boolean or string.
    *
    * | #   | Command line args | .parse() output |
    * | --- | -------------------- | ------------ |
    * | 1   | `--file` | `{ file: true }` |
    * | 2   | `--file lib.js --verbose` | `{ file: "lib.js", verbose: true }` |
    * | 3   | `--verbose very` | `{ verbose: "very" }` |
    * | 4   | `--depth 2` | `{ depth: "2" }` |
    *
    * Unicode option names and aliases are valid, for example:
    * ```js
    * [
    *   { name: 'один' },
    *   { name: '两' },
    *   { name: 'три', alias: 'т' }
    * ]
    * ```
    * @type {string}
    */
    this.name = definition.name

    /**
    * The `type` value is a setter function (you receive the output from this), enabling you to be specific about the type and value received.
    *
    * You can use a class, if you like:
    *
    * ```js
    * const fs = require('fs')
    *
    * function FileDetails(filename){
    *   if (!(this instanceof FileDetails)) return new FileDetails(filename)
    *   this.filename = filename
    *   this.exists = fs.existsSync(filename)
    * }
    *
    * const cli = commandLineArgs([
    *   { name: 'file', type: FileDetails },
    *   { name: 'depth', type: Number }
    * ])
    * ```
    *
    * | #   | Command line args| .parse() output |
    * | --- | ----------------- | ------------ |
    * | 1   | `--file asdf.txt` | `{ file: { filename: 'asdf.txt', exists: false } }` |
    *
    * The `--depth` option expects a `Number`. If no value was set, you will receive `null`.
    *
    * | #   | Command line args | .parse() output |
    * | --- | ----------------- | ------------ |
    * | 2   | `--depth` | `{ depth: null }` |
    * | 3   | `--depth 2` | `{ depth: 2 }` |
    *
    * @type {function}
    * @default String
    */
    this.type = definition.type || String

    /**
    * getopt-style short option names. Can be any single character (unicode included) except a digit or hypen.
    *
    * ```js
    * [
    *   { name: "hot", alias: "h", type: Boolean },
    *   { name: "discount", alias: "d", type: Boolean },
    *   { name: "courses", alias: "c" , type: Number }
    * ]
    * ```
    *
    * | #   | Command line | .parse() output |
    * | --- | ------------ | ------------ |
    * | 1   | `-hcd` | `{ hot: true, courses: null, discount: true }` |
    * | 2   | `-hdc 3` | `{ hot: true, discount: true, courses: 3 }` |
    *
    * @type {string}
    */
    this.alias = definition.alias

    /**
    * Set this flag if the option takes a list of values. You will receive an array of values, each passed through the `type` function (if specified).
    *
    * ```js
    * [
    *   { name: "files", type: String, multiple: true }
    * ]
    * ```
    *
    * | #   | Command line | .parse() output |
    * | --- | ------------ | ------------ |
    * | 1   | `--files one.js two.js` | `{ files: [ 'one.js', 'two.js' ] }` |
    * | 2   | `--files one.js --files two.js` | `{ files: [ 'one.js', 'two.js' ] }` |
    * | 3   | `--files *` | `{ files: [ 'one.js', 'two.js' ] }` |
    *
    * @type {boolean}
    */
    this.multiple = definition.multiple

    /**
    * Any unclaimed command-line args will be set on this option. This flag is typically set on the most commonly-used option to make for more concise usage (i.e. `$ myapp *.js` instead of `$ myapp --files *.js`).
    *
    * ```js
    * [
    *   { name: "files", type: String, multiple: true, defaultOption: true }
    * ]
    * ```
    *
    * | #   | Command line | .parse() output |
    * | --- | ------------ | ------------ |
    * | 1   | `--files one.js two.js` | `{ files: [ 'one.js', 'two.js' ] }` |
    * | 2   | `one.js two.js` | `{ files: [ 'one.js', 'two.js' ] }` |
    * | 3   | `*` | `{ files: [ 'one.js', 'two.js' ] }` |
    *
    * @type {boolean}
    */
    this.defaultOption = definition.defaultOption

    /**
    * An initial value for the option.
    *
    * ```js
    * [
    *   { name: "files", type: String, multiple: true, defaultValue: [ "one.js" ] },
    *   { name: "max", type: Number, defaultValue: 3 }
    * ]
    * ```
    *
    * | #   | Command line | .parse() output |
    * | --- | ------------ | ------------ |
    * | 1   |  | `{ files: [ 'one.js' ], max: 3 }` |
    * | 2   | `--files two.js` | `{ files: [ 'two.js' ], max: 3 }` |
    * | 3   | `--max 4` | `{ files: [ 'one.js' ], max: 4 }` |
    *
    * @type {*}
    */
    this.defaultValue = definition.defaultValue

    /**
    * When your app has a large amount of options it makes sense to organise them in groups.
    *
    * There are two automatic groups: `_all` (contains all options) and `_none` (contains options without a `group` specified in their definition).
    *
    * ```js
    * [
    *   { name: "verbose", group: "standard" },
    *   { name: "help", group: [ "standard", "main" ] },
    *   { name: "compress", group: [ "server", "main" ] },
    *   { name: "static", group: "server" },
    *   { name: "debug" }
    * ]
    * ```
    *
    *<table>
    *  <tr>
    *    <th>#</th><th>Command Line</th><th>.parse() output</th>
    *  </tr>
    *  <tr>
    *    <td>1</td><td><code>--verbose</code></td><td><pre><code>
    *{
    *  _all: { verbose: true },
    *  standard: { verbose: true }
    *}
    *</code></pre></td>
    *  </tr>
    *  <tr>
    *    <td>2</td><td><code>--debug</code></td><td><pre><code>
    *{
    *  _all: { debug: true },
    *  _none: { debug: true }
    *}
    *</code></pre></td>
    *  </tr>
    *  <tr>
    *    <td>3</td><td><code>--verbose --debug --compress</code></td><td><pre><code>
    *{
    *  _all: {
    *    verbose: true,
    *    debug: true,
    *    compress: true
    *  },
    *  standard: { verbose: true },
    *  server: { compress: true },
    *  main: { compress: true },
    *  _none: { debug: true }
    *}
    *</code></pre></td>
    *  </tr>
    *  <tr>
    *    <td>4</td><td><code>--compress</code></td><td><pre><code>
    *{
    *  _all: { compress: true },
    *  server: { compress: true },
    *  main: { compress: true }
    *}
    *</code></pre></td>
    *  </tr>
    *</table>
    *
    * @type {string|string[]}
    */
    this.group = definition.group

    /* pick up any remaining properties */
    for (let prop in definition) {
      if (!this[prop]) this[prop] = definition[prop]
    }
  }

  isBoolean (value) {
    return this.type === Boolean || (t.isFunction(this.type) && this.type.name === 'Boolean')
  }
}

module.exports = OptionDefinition


/***/ }),
/* 81 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const arrayify = __webpack_require__(4)
const option = __webpack_require__(6)

/**
 * Handles parsing different argv notations
 *
 * @module argv
 * @private
 */

class Argv extends Array {
  load (argv) {
    if (argv) {
      argv = arrayify(argv)
    } else {
      /* if no argv supplied, assume we are parsing process.argv */
      argv = process.argv.slice(0)
      argv.splice(0, 2)
    }
    argv.forEach(arg => this.push(String(arg)))
  }

  clear () {
    this.length = 0
  }

  /**
   * expand --option=value style args. The value is clearly marked to indicate it is definitely a value (which would otherwise be unclear if the value is `--value`, which would be parsed as an option). The special marker is removed in parsing phase.
   */
  expandOptionEqualsNotation () {
    const optEquals = option.optEquals
    if (this.some(optEquals.test.bind(optEquals))) {
      const expandedArgs = []
      this.forEach(arg => {
        const matches = arg.match(optEquals)
        if (matches) {
          expandedArgs.push(matches[1], option.VALUE_MARKER + matches[2])
        } else {
          expandedArgs.push(arg)
        }
      })
      this.clear()
      this.load(expandedArgs)
    }
  }

  /**
   * expand getopt-style combined options
   */
  expandGetoptNotation () {
    const findReplace = __webpack_require__(82)
    const combinedArg = option.combined
    const hasGetopt = this.some(combinedArg.test.bind(combinedArg))
    if (hasGetopt) {
      findReplace(this, combinedArg, arg => {
        arg = arg.slice(1)
        return arg.split('').map(letter => '-' + letter)
      })
    }
  }

  /**
   * Inspect the user-supplied options for validation issues.
   * @throws `UNKNOWN_OPTION`
   */
  validate (definitions, options) {
    options = options || {}
    let invalidOption

    if (!options.partial) {
      const optionWithoutDefinition = this
        .filter(arg => option.isOption(arg))
        .some(arg => {
          if (definitions.get(arg) === undefined) {
            invalidOption = arg
            return true
          }
        })
      if (optionWithoutDefinition) {
        halt(
          'UNKNOWN_OPTION',
          'Unknown option: ' + invalidOption
        )
      }
    }
  }
}

function halt (name, message) {
  const err = new Error(message)
  err.name = name
  throw err
}

module.exports = Argv


/***/ }),
/* 82 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var arrayify = __webpack_require__(83)
var testValue = __webpack_require__(84)

/**
 * Find and either replace or remove items from an array.
 *
 * @module find-replace
 * @example
 * > findReplace = require('find-replace')
 *
 * > findReplace([ 1, 2, 3], 2, 'two')
 * [ 1, 'two', 3 ]
 *
 * > findReplace([ 1, 2, 3], 2, [ 'two', 'zwei' ])
 * [ 1, [ 'two', 'zwei' ], 3 ]
 *
 * > findReplace([ 1, 2, 3], 2, 'two', 'zwei')
 * [ 1, 'two', 'zwei', 3 ]
 *
 * > findReplace([ 1, 2, 3], 2) // no replacement, so remove
 * [ 1, 3 ]
 */
module.exports = findReplace

/**
 * @param {array} - the input array
 * @param {valueTest} - a [test-value](https://github.com/75lb/test-value) query to match the value you're looking for
 * @param [replaceWith] {...any} - If specified, found values will be replaced with these values, else  removed.
 * @returns {array}
 * @alias module:find-replace
 */
function findReplace (array, valueTest) {
  var found = []
  var replaceWiths = arrayify(arguments)
  replaceWiths.splice(0, 2)

  arrayify(array).forEach(function (value, index) {
    var expanded = []
    replaceWiths.forEach(function (replaceWith) {
      if (typeof replaceWith === 'function') {
        expanded = expanded.concat(replaceWith(value))
      } else {
        expanded.push(replaceWith)
      }
    })

    if (testValue(value, valueTest)) {
      found.push({
        index: index,
        replaceWithValue: expanded
      })
    }
  })

  found.reverse().forEach(function (item) {
    var spliceArgs = [ item.index, 1 ].concat(item.replaceWithValue)
    array.splice.apply(array, spliceArgs)
  })

  return array
}


/***/ }),
/* 83 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var t = __webpack_require__(3)

/**
 * @module array-back
 * @example
 * var arrayify = require("array-back")
 */
module.exports = arrayify

/**
 * Takes any input and guarantees an array back.
 *
 * - converts array-like objects (e.g. `arguments`) to a real array
 * - converts `undefined` to an empty array
 * - converts any another other, singular value (including `null`) into an array containing that value
 * - ignores input which is already an array
 *
 * @param {*} - the input value to convert to an array
 * @returns {Array}
 * @alias module:array-back
 * @example
 * > a.arrayify(undefined)
 * []
 *
 * > a.arrayify(null)
 * [ null ]
 *
 * > a.arrayify(0)
 * [ 0 ]
 *
 * > a.arrayify([ 1, 2 ])
 * [ 1, 2 ]
 *
 * > function f(){ return a.arrayify(arguments); }
 * > f(1,2,3)
 * [ 1, 2, 3 ]
 */
function arrayify (input) {
  if (input === undefined) {
    return []
  } else if (t.isArrayLike(input)) {
    return Array.prototype.slice.call(input)
  } else {
    return Array.isArray(input) ? input : [ input ]
  }
}


/***/ }),
/* 84 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var arrayify = __webpack_require__(85)
var t = __webpack_require__(3)

/**
 * @module test-value
 * @example
 * var testValue = require('test-value')
 */
module.exports = testValue

/**
 * @alias module:test-value
 * @param {any} - a value to test
 * @param {any} - the test query
 * @param [options] {object}
 * @param [options.strict] {boolean} - Treat an object like a value not a query. 
 * @returns {boolean}
 */
function testValue (value, test, options) {
  options = options || {}
  if (test !== Object.prototype && t.isPlainObject(test) && t.isObject(value) && !options.strict) {
    return Object.keys(test).every(function (prop) {
      var queryValue = test[prop]

      /* get flags */
      var isNegated = false
      var isContains = false

      if (prop.charAt(0) === '!') {
        isNegated = true
      } else if (prop.charAt(0) === '+') {
        isContains = true
      }

      /* strip flag char */
      prop = (isNegated || isContains) ? prop.slice(1) : prop
      var objectValue = value[prop]

      if (isContains) {
        queryValue = arrayify(queryValue)
        objectValue = arrayify(objectValue)
      }

      var result = testValue(objectValue, queryValue, options)
      return isNegated ? !result : result
    })
  } else if (test !== Array.prototype && Array.isArray(test)) {
    var tests = test
    if (value === Array.prototype || !Array.isArray(value)) value = [ value ]
    return value.some(function (val) {
      return tests.some(function (test) {
        return testValue(val, test, options)
      })
    })

  /*
  regexes queries will always return `false` for `null`, `undefined`, `NaN`.
  This is to prevent a query like `/.+/` matching the string `undefined`.
  */
  } else if (test instanceof RegExp) {
    if ([ 'boolean', 'string', 'number' ].indexOf(typeof value) === -1) {
      return false
    } else {
      return test.test(value)
    }
  } else if (test !== Function.prototype && typeof test === 'function') {
    return test(value)
  } else {
    return test === value
  }
}

/**
 * Returns a callback suitable for use by `Array` methods like `some`, `filter`, `find` etc.
 * @param {any} - the test query
 * @returns {function}
 */
testValue.where = function (test) {
  return function (value) {
    return testValue(value, test)
  }
}


/***/ }),
/* 85 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var t = __webpack_require__(3)

/**
 * @module array-back
 * @example
 * var arrayify = require("array-back")
 */
module.exports = arrayify

/**
 * Takes any input and guarantees an array back.
 *
 * - converts array-like objects (e.g. `arguments`) to a real array
 * - converts `undefined` to an empty array
 * - converts any another other, singular value (including `null`) into an array containing that value
 * - ignores input which is already an array
 *
 * @param {*} - the input value to convert to an array
 * @returns {Array}
 * @alias module:array-back
 * @example
 * > a.arrayify(undefined)
 * []
 *
 * > a.arrayify(null)
 * [ null ]
 *
 * > a.arrayify(0)
 * [ 0 ]
 *
 * > a.arrayify([ 1, 2 ])
 * [ 1, 2 ]
 *
 * > function f(){ return a.arrayify(arguments); }
 * > f(1,2,3)
 * [ 1, 2, 3 ]
 */
function arrayify (input) {
  if (input === undefined) {
    return []
  } else if (t.isArrayLike(input)) {
    return Array.prototype.slice.call(input)
  } else {
    return Array.isArray(input) ? input : [ input ]
  }
}


/***/ }),
/* 86 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const arrayify = __webpack_require__(4)
const Output = __webpack_require__(48)

class GroupedOutput extends Output {
  toObject () {
    const superOutput = super.toObject()
    delete superOutput._unknown
    const grouped = {
      _all: superOutput
    }
    if (this.unknown.length) grouped._unknown = this.unknown

    this.definitions.whereGrouped().forEach(def => {
      const outputValue = this.output[def.name]
      for (const groupName of arrayify(def.group)) {
        grouped[groupName] = grouped[groupName] || {}
        if (outputValue && outputValue.isDefined()) {
          grouped[groupName][def.name] = outputValue.value
        }
      }
    })

    this.definitions.whereNotGrouped().forEach(def => {
      const outputValue = this.output[def.name]
      if (outputValue && outputValue.isDefined()) {
        if (!grouped._none) grouped._none = {}
        grouped._none[def.name] = outputValue.value
      }
    })
    return grouped
  }
}

module.exports = GroupedOutput


/***/ }),
/* 87 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * @module command-line-commands
 * @example
 * const commandLineCommands = require('command-line-commands')
 */
module.exports = commandLineCommands

/**
 * Parses the `argv` value supplied (or `process.argv` by default), extracting and returning the `command` and remainder of `argv`. The command will be the first value in the `argv` array unless it is an option (e.g. `--help`).
 *
 * @param {string|string[]} - One or more command strings, one of which the user must supply. Include `null` to represent "no command" (effectively making a command optional).
 * @param [argv] {string[]} - An argv array, defaults to the global `process.argv` if not supplied.
 * @returns {{ command: string, argv: string[] }}
 * @throws `INVALID_COMMAND` - user supplied a command not specified in `commands`.
 * @alias module:command-line-commands
 */
function commandLineCommands (commands, argv) {
  const arrayify = __webpack_require__(4)
  const option = __webpack_require__(88)

  if (!commands || (Array.isArray(commands) && !commands.length)) {
    throw new Error('Please supply one or more commands')
  }
  if (argv) {
    argv = arrayify(argv)
  } else {
    /* if no argv supplied, assume we are parsing process.argv. */
    /* never modify the global process.argv directly. */
    argv = process.argv.slice(0)
    argv.splice(0, 2)
  }

  /* the command is the first arg, unless it's an option (e.g. --help) */
  const command = (option.isOption(argv[0]) || !argv.length) ? null : argv.shift()

  if (arrayify(commands).indexOf(command) === -1) {
    const err = new Error('Command not recognised: ' + command)
    err.command = command
    err.name = 'INVALID_COMMAND'
    throw err
  }

  return { command: command, argv: argv }
}


/***/ }),
/* 88 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

/**
 * A module for testing for and extracting names from options (e.g. `--one`, `-o`)
 */

class Arg {
  constructor (re) {
    this.re = re
  }

  test (arg) {
    return this.re.test(arg)
  }
}

exports.isShort = new Arg(/^-([^\d-])$/)
exports.isLong = new Arg(/^--(\S+)/)
exports.isCombined = new Arg(/^-([^\d-]{2,})$/)
exports.isOption = function (arg) {
  return this.isShort.test(arg) || this.isLong.test(arg) || this.isCombined.test(arg)
}
exports.optEquals = new Arg(/^(--\S+)=(.*)/)


/***/ }),
/* 89 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const OptionList = __webpack_require__(90)
const ContentSection = __webpack_require__(98)
const arrayify = __webpack_require__(4)

/**
 * @module command-line-usage
 */
module.exports = commandLineUsage

/**
 * Generates a usage guide suitable for a command-line app.
 * @param {Section|Section[]} - One of more section objects ({@link module:command-line-usage~content} or {@link module:command-line-usage~optionList}).
 * @returns {string}
 * @alias module:command-line-usage
 */
function commandLineUsage (sections) {
  sections = arrayify(sections)
  if (sections.length) {
    const output = sections.map(section => {
      if (section.optionList) {
        return new OptionList(section)
      } else {
        return new ContentSection(section)
      }
    })
    return '\n' + output.join('\n')
  }
}

/**
 * A Content section comprises a header and one or more lines of content.
 * @typedef content
 * @property header {string} - The section header, always bold and underlined.
 * @property content {string|string[]|object[]} - Overloaded property, accepting data in one of four formats:
 *
 * 1. A single string (one line of text)
 * 2. An array of strings (multiple lines of text)
 * 3. An array of objects (recordset-style data). In this case, the data will be rendered in table format. The property names of each object are not important, so long as they are consistent throughout the array.
 * 4. An object with two properties - `data` and `options`. In this case, the data and options will be passed directly to the underlying [table layout](https://github.com/75lb/table-layout) module for rendering.
 *
 * @property raw {boolean} - Set to true to avoid indentation and wrapping. Useful for banners.
 * @example
 * Simple string of content. The syntax for ansi formatting is documented [here](https://github.com/75lb/ansi-escape-sequences#module_ansi-escape-sequences.format).
 * ```js
 * {
 *   header: 'A typical app',
 *   content: 'Generates something [italic]{very} important.'
 * }
 * ```
 *
 * An array of strings is interpreted as lines, to be joined by the system newline character.
 * ```js
 * {
 *   header: 'A typical app',
 *   content: [
 *     'First line.',
 *     'Second line.'
 *   ]
 * }
 * ```
 *
 * An array of recordset-style objects are rendered in table layout.
 * ```js
 * {
 *   header: 'A typical app',
 *   content: [
 *     { colA: 'First row, first column.', colB: 'First row, second column.'},
 *     { colA: 'Second row, first column.', colB: 'Second row, second column.'}
 *   ]
 * }
 * ```
 *
 * An object with `data` and `options` properties will be passed directly to the underlying [table layout](https://github.com/75lb/table-layout) module for rendering.
 * ```js
 * {
 *   header: 'A typical app',
 *   content: {
 *     data: [
 *      { colA: 'First row, first column.', colB: 'First row, second column.'},
 *      { colA: 'Second row, first column.', colB: 'Second row, second column.'}
 *     ],
 *     options: {
 *       maxWidth: 60
 *     }
 *   }
 * }
 * ```
 */

 /**
  * A OptionList section adds a table displaying details of the available options.
  * @typedef optionList
  * @property [header] {string} - The section header, always bold and underlined.
  * @property optionList {OptionDefinition[]} - an array of [option definition](https://github.com/75lb/command-line-args#optiondefinition-) objects. In addition to the regular definition properties, command-line-usage will look for:
  *
  * - `description` - a string describing the option.
  * - `typeLabel` - a string to replace the default type string (e.g. `<string>`). It's often more useful to set a more descriptive type label, like `<ms>`, `<files>`, `<command>` etc.
  * @property [group] {string|string[]} - If specified, only options from this particular group will be printed. [Example](https://github.com/75lb/command-line-usage/blob/master/example/groups.js).
  * @property [hide] {string|string[]} - The names of one of more option definitions to hide from the option list. [Example](https://github.com/75lb/command-line-usage/blob/master/example/hide.js).
  *
  * @example
  * {
  *   header: 'Options',
  *   optionList: [
  *     {
  *       name: 'help', alias: 'h', description: 'Display this usage guide.'
  *     },
  *     {
  *       name: 'src', description: 'The input files to process',
  *       multiple: true, defaultOption: true, typeLabel: '[underline]{file} ...'
  *     },
  *     {
  *       name: 'timeout', description: 'Timeout value in ms. This description is needlessly long unless you count testing of the description column maxWidth useful.',
  *       alias: 't', typeLabel: '[underline]{ms}'
  *     }
  *   ]
  * }
  */


/***/ }),
/* 90 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const Section = __webpack_require__(50)
const Table = __webpack_require__(51)
const ansi = __webpack_require__(18)
const t = __webpack_require__(3)
const arrayify = __webpack_require__(4)

class OptionList extends Section {
  constructor (data) {
    super()
    let definitions = arrayify(data.optionList)
    const hide = arrayify(data.hide)
    const groups = arrayify(data.group)

    /* filter out hidden definitions */
    if (hide.length) {
      definitions = definitions.filter(definition => {
        return hide.indexOf(definition.name) === -1
      })
    }

    if (data.header) this.header(data.header)

    if (groups.length) {
      definitions = definitions.filter(def => {
        const noGroupMatch = groups.indexOf('_none') > -1 && !t.isDefined(def.group)
        const groupMatch = intersect(arrayify(def.group), groups)
        if (noGroupMatch || groupMatch) return def
      })
    }

    const columns = definitions.map(def => {
      return {
        option: getOptionNames(def, 'bold'),
        description: ansi.format(def.description)
      }
    })

    const table = new Table(columns, {
      padding: { left: '  ', right: ' ' },
      columns: [{ name: 'option', noWrap: true }, { name: 'description', maxWidth: 80 }]
    })
    this.add(table.renderLines())

    this.emptyLine()
  }
}

function getOptionNames (definition, optionNameStyles) {
  const names = []
  let type = definition.type
    ? definition.type.name.toLowerCase()
    : ''
  const multiple = definition.multiple ? '[]' : ''
  if (type) {
    type = type === 'boolean'
      ? ''
      : `[underline]{${type}${multiple}}`
  }
  type = ansi.format(definition.typeLabel || type)

  if (definition.alias) {
    names.push(ansi.format('-' + definition.alias, optionNameStyles))
  }
  names.push(ansi.format(`--${definition.name}`, optionNameStyles) + ' ' + type)
  return names.join(', ')
}

function intersect (arr1, arr2) {
  return arr1.some(function (item1) {
    return arr2.some(function (item2) {
      return item1 === item2
    })
  })
}

module.exports = OptionList


/***/ }),
/* 91 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const arrayify = __webpack_require__(4)
const Cell = __webpack_require__(52)
const t = __webpack_require__(3)

/**
 *
 */
class Rows {
  constructor (rows, columns) {
    this.list = []
    this.load(rows, columns)
  }

  load (rows, columns) {
    arrayify(rows).forEach(row => {
      this.list.push(new Map(objectToIterable(row, columns)))
    })
  }

  static removeEmptyColumns (data) {
    const distinctColumnNames = data.reduce((columnNames, row) => {
      Object.keys(row).forEach(key => {
        if (columnNames.indexOf(key) === -1) columnNames.push(key)
      })
      return columnNames
    }, [])

    const emptyColumns = distinctColumnNames.filter(columnName => {
      const hasValue = data.some(row => {
        const value = row[columnName]
        return (t.isDefined(value) && !t.isString(value)) || (t.isString(value) && /\S+/.test(value))
      })
      return !hasValue
    })

    return data.map(row => {
      emptyColumns.forEach(emptyCol => delete row[emptyCol])
      return row
    })
  }
}

function objectToIterable (row, columns) {
  return columns.list.map(column => {
    return [ column, new Cell(row[column.name], column) ]
  })
}

/**
 * @module rows
 */
module.exports = Rows


/***/ }),
/* 92 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const t = __webpack_require__(3)
const arrayify = __webpack_require__(4)
const Column = __webpack_require__(93)
const wrap = __webpack_require__(53)
const Cell = __webpack_require__(52)
const ansi = __webpack_require__(54)

const _maxWidth = new WeakMap()

/**
 * @module columns
 */

class Columns {
  constructor (columns) {
    this.list = []
    arrayify(columns).forEach(this.add.bind(this))
  }

  /**
   * sum of all generatedWidth fields
   * @return {number}
   */
  totalWidth () {
    return this.list.length
      ? this.list.map(col => col.generatedWidth).reduce((a, b) => a + b)
      : 0
  }

  totalFixedWidth () {
    return this.getFixed()
      .map(col => col.generatedWidth)
      .reduce((a, b) => a + b, 0)
  }

  get (columnName) {
    return this.list.find(column => column.name === columnName)
  }

  getResizable () {
    return this.list.filter(column => column.isResizable())
  }

  getFixed () {
    return this.list.filter(column => column.isFixed())
  }

  add (column) {
    const col = column instanceof Column ? column : new Column(column)
    this.list.push(col)
    return col
  }

  set maxWidth (val) {
    _maxWidth.set(this, val)
  }

  /**
   * sets `generatedWidth` for each column
   * @chainable
   */
  autoSize () {
    const maxWidth = _maxWidth.get(this)

    /* size */
    this.list.forEach(column => {
      column.generateWidth()
      column.generateMinWidth()
    })

    /* adjust if user set a min or maxWidth */
    this.list.forEach(column => {
      if (t.isDefined(column.maxWidth) && column.generatedWidth > column.maxWidth) {
        column.generatedWidth = column.maxWidth
      }

      if (t.isDefined(column.minWidth) && column.generatedWidth < column.minWidth) {
        column.generatedWidth = column.minWidth
      }
    })

    const width = {
      total: this.totalWidth(),
      view: maxWidth,
      diff: this.totalWidth() - maxWidth,
      totalFixed: this.totalFixedWidth(),
      totalResizable: Math.max(maxWidth - this.totalFixedWidth(), 0)
    }

    /* adjust if short of space */
    if (width.diff > 0) {
      /* share the available space between resizeable columns */
      let resizableColumns = this.getResizable()
      resizableColumns.forEach(column => {
        column.generatedWidth = Math.floor(width.totalResizable / resizableColumns.length)
      })

      /* at this point, the generatedWidth should never end up bigger than the contentWidth */
      const grownColumns = this.list.filter(column => column.generatedWidth > column.contentWidth)
      const shrunkenColumns = this.list.filter(column => column.generatedWidth < column.contentWidth)
      let salvagedSpace = 0
      grownColumns.forEach(column => {
        const currentGeneratedWidth = column.generatedWidth
        column.generateWidth()
        salvagedSpace += currentGeneratedWidth - column.generatedWidth
      })
      shrunkenColumns.forEach(column => {
        column.generatedWidth += Math.floor(salvagedSpace / shrunkenColumns.length)
      })

    /* if, after autosizing, we still don't fit within maxWidth then give up */
    }

    return this
  }

  /**
   * Factory method returning all distinct columns from input
   * @param  {object[]} - input recordset
   * @return {module:columns}
   */
  static getColumns (rows) {
    var columns = new Columns()
    arrayify(rows).forEach(row => {
      for (let columnName in row) {
        let column = columns.get(columnName)
        if (!column) {
          column = columns.add({ name: columnName, contentWidth: 0, minContentWidth: 0 })
        }
        let cell = new Cell(row[columnName], column)
        let cellValue = cell.value
        if (ansi.has(cellValue)) {
          cellValue = ansi.remove(cellValue)
        }

        if (cellValue.length > column.contentWidth) column.contentWidth = cellValue.length

        let longestWord = getLongestWord(cellValue)
        if (longestWord > column.minContentWidth) {
          column.minContentWidth = longestWord
        }
        if (!column.contentWrappable) column.contentWrappable = wrap.isWrappable(cellValue)
      }
    })
    return columns
  }
}

function getLongestWord (line) {
  const words = wrap.getChunks(line)
  return words.reduce((max, word) => {
    return Math.max(word.length, max)
  }, 0)
}

module.exports = Columns


/***/ }),
/* 93 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const t = __webpack_require__(3)
const Padding = __webpack_require__(94)

/**
 * @module column
 */

const _padding = new WeakMap()

// setting any column property which is a factor of the width should trigger autoSize()

/**
 * Represents a table column
 */
class Column {
  constructor (column) {
    /**
     * @type {string}
     */
    if (t.isDefined(column.name)) this.name = column.name
    /**
     * @type {number}
     */
    if (t.isDefined(column.width)) this.width = column.width
    if (t.isDefined(column.maxWidth)) this.maxWidth = column.maxWidth
    if (t.isDefined(column.minWidth)) this.minWidth = column.minWidth
    if (t.isDefined(column.noWrap)) this.noWrap = column.noWrap
    if (t.isDefined(column.break)) this.break = column.break
    if (t.isDefined(column.contentWrappable)) this.contentWrappable = column.contentWrappable
    if (t.isDefined(column.contentWidth)) this.contentWidth = column.contentWidth
    if (t.isDefined(column.minContentWidth)) this.minContentWidth = column.minContentWidth
    this.padding = column.padding || { left: ' ', right: ' ' }
    this.generatedWidth = null
  }

  set padding (padding) {
    _padding.set(this, new Padding(padding))
  }
  get padding () {
    return _padding.get(this)
  }

  /**
   * the width of the content (excluding padding) after being wrapped
   */
  get wrappedContentWidth () {
    return Math.max(this.generatedWidth - this.padding.length(), 0)
  }

  isResizable () {
    return !this.isFixed()
  }

  isFixed () {
    return t.isDefined(this.width) || this.noWrap || !this.contentWrappable
  }

  generateWidth () {
    this.generatedWidth = this.width || (this.contentWidth + this.padding.length())
  }

  generateMinWidth () {
    this.minWidth = this.minContentWidth + this.padding.length()
  }
}

module.exports = Column


/***/ }),
/* 94 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


class Padding {
  constructor (padding) {
    this.left = padding.left
    this.right = padding.right
  }
  length () {
    return this.left.length + this.right.length
  }
}

/**
@module padding
*/
module.exports = Padding


/***/ }),
/* 95 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


/**
 * Flatten an array into the supplied array.
 *
 * @module reduce-flatten
 * @example
 * var flatten = require('reduce-flatten')
 */
module.exports = flatten

/**
 * @alias module:reduce-flatten
 * @example
 * > numbers = [ 1, 2, [ 3, 4 ], 5 ]
 * > numbers.reduce(flatten, [])
 * [ 1, 2, 3, 4, 5 ]
 */
function flatten (prev, curr) {
  return prev.concat(curr)
}


/***/ }),
/* 96 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
/*!
 * @description Recursive object extending
 * @author Viacheslav Lotsmanov <lotsmanov89@gmail.com>
 * @license MIT
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-2015 Viacheslav Lotsmanov
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */



function isSpecificValue(val) {
	return (
		val instanceof Buffer
		|| val instanceof Date
		|| val instanceof RegExp
	) ? true : false;
}

function cloneSpecificValue(val) {
	if (val instanceof Buffer) {
		var x = new Buffer(val.length);
		val.copy(x);
		return x;
	} else if (val instanceof Date) {
		return new Date(val.getTime());
	} else if (val instanceof RegExp) {
		return new RegExp(val);
	} else {
		throw new Error('Unexpected situation');
	}
}

/**
 * Recursive cloning array.
 */
function deepCloneArray(arr) {
	var clone = [];
	arr.forEach(function (item, index) {
		if (typeof item === 'object' && item !== null) {
			if (Array.isArray(item)) {
				clone[index] = deepCloneArray(item);
			} else if (isSpecificValue(item)) {
				clone[index] = cloneSpecificValue(item);
			} else {
				clone[index] = deepExtend({}, item);
			}
		} else {
			clone[index] = item;
		}
	});
	return clone;
}

/**
 * Extening object that entered in first argument.
 *
 * Returns extended object or false if have no target object or incorrect type.
 *
 * If you wish to clone source object (without modify it), just use empty new
 * object as first argument, like this:
 *   deepExtend({}, yourObj_1, [yourObj_N]);
 */
var deepExtend = module.exports = function (/*obj_1, [obj_2], [obj_N]*/) {
	if (arguments.length < 1 || typeof arguments[0] !== 'object') {
		return false;
	}

	if (arguments.length < 2) {
		return arguments[0];
	}

	var target = arguments[0];

	// convert arguments to array and cut off target object
	var args = Array.prototype.slice.call(arguments, 1);

	var val, src, clone;

	args.forEach(function (obj) {
		// skip argument if isn't an object, is null, or is an array
		if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
			return;
		}

		Object.keys(obj).forEach(function (key) {
			src = target[key]; // source value
			val = obj[key]; // new value

			// recursion prevention
			if (val === target) {
				return;

			/**
			 * if new value isn't object then just overwrite by new value
			 * instead of extending.
			 */
			} else if (typeof val !== 'object' || val === null) {
				target[key] = val;
				return;

			// just clone arrays (and recursive clone objects inside)
			} else if (Array.isArray(val)) {
				target[key] = deepCloneArray(val);
				return;

			// custom cloning and overwrite for specific objects
			} else if (isSpecificValue(val)) {
				target[key] = cloneSpecificValue(val);
				return;

			// overwrite by new value if source isn't object or array
			} else if (typeof src !== 'object' || src === null || Array.isArray(src)) {
				target[key] = deepExtend({}, val);
				return;

			// source value and new value is objects both, extending...
			} else {
				target[key] = deepExtend(src, val);
				return;
			}
		});
	});

	return target;
}


/***/ }),
/* 97 */
/***/ (function(module, exports) {

/**
 * lodash (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright jQuery Foundation and other contributors <https://jquery.org/>
 * Released under MIT license <https://lodash.com/license>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 */

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Used to compose unicode character classes. */
var rsAstralRange = '\\ud800-\\udfff',
    rsComboMarksRange = '\\u0300-\\u036f\\ufe20-\\ufe23',
    rsComboSymbolsRange = '\\u20d0-\\u20f0',
    rsVarRange = '\\ufe0e\\ufe0f';

/** Used to compose unicode capture groups. */
var rsAstral = '[' + rsAstralRange + ']',
    rsCombo = '[' + rsComboMarksRange + rsComboSymbolsRange + ']',
    rsFitz = '\\ud83c[\\udffb-\\udfff]',
    rsModifier = '(?:' + rsCombo + '|' + rsFitz + ')',
    rsNonAstral = '[^' + rsAstralRange + ']',
    rsRegional = '(?:\\ud83c[\\udde6-\\uddff]){2}',
    rsSurrPair = '[\\ud800-\\udbff][\\udc00-\\udfff]',
    rsZWJ = '\\u200d';

/** Used to compose unicode regexes. */
var reOptMod = rsModifier + '?',
    rsOptVar = '[' + rsVarRange + ']?',
    rsOptJoin = '(?:' + rsZWJ + '(?:' + [rsNonAstral, rsRegional, rsSurrPair].join('|') + ')' + rsOptVar + reOptMod + ')*',
    rsSeq = rsOptVar + reOptMod + rsOptJoin,
    rsSymbol = '(?:' + [rsNonAstral + rsCombo + '?', rsCombo, rsRegional, rsSurrPair, rsAstral].join('|') + ')';

/** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */
var reUnicode = RegExp(rsFitz + '(?=' + rsFitz + ')|' + rsSymbol + rsSeq, 'g');

/** Used to detect strings with [zero-width joiners or code points from the astral planes](http://eev.ee/blog/2015/09/12/dark-corners-of-unicode/). */
var reHasUnicode = RegExp('[' + rsZWJ + rsAstralRange  + rsComboMarksRange + rsComboSymbolsRange + rsVarRange + ']');

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/** Detect free variable `global` from Node.js. */
var freeGlobal = typeof global == 'object' && global && global.Object === Object && global;

/** Detect free variable `self`. */
var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

/** Used as a reference to the global object. */
var root = freeGlobal || freeSelf || Function('return this')();

/**
 * Gets the size of an ASCII `string`.
 *
 * @private
 * @param {string} string The string inspect.
 * @returns {number} Returns the string size.
 */
var asciiSize = baseProperty('length');

/**
 * Converts an ASCII `string` to an array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the converted array.
 */
function asciiToArray(string) {
  return string.split('');
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new accessor function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Checks if `string` contains Unicode symbols.
 *
 * @private
 * @param {string} string The string to inspect.
 * @returns {boolean} Returns `true` if a symbol is found, else `false`.
 */
function hasUnicode(string) {
  return reHasUnicode.test(string);
}

/**
 * Gets the number of symbols in `string`.
 *
 * @private
 * @param {string} string The string to inspect.
 * @returns {number} Returns the string size.
 */
function stringSize(string) {
  return hasUnicode(string)
    ? unicodeSize(string)
    : asciiSize(string);
}

/**
 * Converts `string` to an array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the converted array.
 */
function stringToArray(string) {
  return hasUnicode(string)
    ? unicodeToArray(string)
    : asciiToArray(string);
}

/**
 * Gets the size of a Unicode `string`.
 *
 * @private
 * @param {string} string The string inspect.
 * @returns {number} Returns the string size.
 */
function unicodeSize(string) {
  var result = reUnicode.lastIndex = 0;
  while (reUnicode.test(string)) {
    result++;
  }
  return result;
}

/**
 * Converts a Unicode `string` to an array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the converted array.
 */
function unicodeToArray(string) {
  return string.match(reUnicode) || [];
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the
 * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var Symbol = root.Symbol;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeCeil = Math.ceil,
    nativeFloor = Math.floor;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = symbolProto ? symbolProto.toString : undefined;

/**
 * The base implementation of `_.repeat` which doesn't coerce arguments.
 *
 * @private
 * @param {string} string The string to repeat.
 * @param {number} n The number of times to repeat the string.
 * @returns {string} Returns the repeated string.
 */
function baseRepeat(string, n) {
  var result = '';
  if (!string || n < 1 || n > MAX_SAFE_INTEGER) {
    return result;
  }
  // Leverage the exponentiation by squaring algorithm for a faster repeat.
  // See https://en.wikipedia.org/wiki/Exponentiation_by_squaring for more details.
  do {
    if (n % 2) {
      result += string;
    }
    n = nativeFloor(n / 2);
    if (n) {
      string += string;
    }
  } while (n);

  return result;
}

/**
 * The base implementation of `_.slice` without an iteratee call guard.
 *
 * @private
 * @param {Array} array The array to slice.
 * @param {number} [start=0] The start position.
 * @param {number} [end=array.length] The end position.
 * @returns {Array} Returns the slice of `array`.
 */
function baseSlice(array, start, end) {
  var index = -1,
      length = array.length;

  if (start < 0) {
    start = -start > length ? 0 : (length + start);
  }
  end = end > length ? length : end;
  if (end < 0) {
    end += length;
  }
  length = start > end ? 0 : ((end - start) >>> 0);
  start >>>= 0;

  var result = Array(length);
  while (++index < length) {
    result[index] = array[index + start];
  }
  return result;
}

/**
 * The base implementation of `_.toString` which doesn't convert nullish
 * values to empty strings.
 *
 * @private
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 */
function baseToString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (isSymbol(value)) {
    return symbolToString ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

/**
 * Casts `array` to a slice if it's needed.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {number} start The start position.
 * @param {number} [end=array.length] The end position.
 * @returns {Array} Returns the cast slice.
 */
function castSlice(array, start, end) {
  var length = array.length;
  end = end === undefined ? length : end;
  return (!start && end >= length) ? array : baseSlice(array, start, end);
}

/**
 * Creates the padding for `string` based on `length`. The `chars` string
 * is truncated if the number of characters exceeds `length`.
 *
 * @private
 * @param {number} length The padding length.
 * @param {string} [chars=' '] The string used as padding.
 * @returns {string} Returns the padding for `string`.
 */
function createPadding(length, chars) {
  chars = chars === undefined ? ' ' : baseToString(chars);

  var charsLength = chars.length;
  if (charsLength < 2) {
    return charsLength ? baseRepeat(chars, length) : chars;
  }
  var result = baseRepeat(chars, nativeCeil(length / stringSize(chars)));
  return hasUnicode(chars)
    ? castSlice(stringToArray(result), 0, length).join('')
    : result.slice(0, length);
}

/**
 * Checks if `value` is the
 * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
 * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @since 0.1.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Converts `value` to a finite number.
 *
 * @static
 * @memberOf _
 * @since 4.12.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted number.
 * @example
 *
 * _.toFinite(3.2);
 * // => 3.2
 *
 * _.toFinite(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toFinite(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toFinite('3.2');
 * // => 3.2
 */
function toFinite(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  return value === value ? value : 0;
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This method is loosely based on
 * [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3.2);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3.2');
 * // => 3
 */
function toInteger(value) {
  var result = toFinite(value),
      remainder = result % 1;

  return result === result ? (remainder ? result - remainder : result) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3.2);
 * // => 3.2
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3.2');
 * // => 3.2
 */
function toNumber(value) {
  if (typeof value == 'number') {
    return value;
  }
  if (isSymbol(value)) {
    return NAN;
  }
  if (isObject(value)) {
    var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

/**
 * Converts `value` to a string. An empty string is returned for `null`
 * and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category Lang
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  return value == null ? '' : baseToString(value);
}

/**
 * Pads `string` on the right side if it's shorter than `length`. Padding
 * characters are truncated if they exceed `length`.
 *
 * @static
 * @memberOf _
 * @since 4.0.0
 * @category String
 * @param {string} [string=''] The string to pad.
 * @param {number} [length=0] The padding length.
 * @param {string} [chars=' '] The string used as padding.
 * @returns {string} Returns the padded string.
 * @example
 *
 * _.padEnd('abc', 6);
 * // => 'abc   '
 *
 * _.padEnd('abc', 6, '_-');
 * // => 'abc_-_'
 *
 * _.padEnd('abc', 3);
 * // => 'abc'
 */
function padEnd(string, length, chars) {
  string = toString(string);
  length = toInteger(length);

  var strLength = length ? stringSize(string) : 0;
  return (length && strLength < length)
    ? (string + createPadding(length - strLength, chars))
    : string;
}

module.exports = padEnd;


/***/ }),
/* 98 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const Section = __webpack_require__(50)
const Content = __webpack_require__(99)

class ContentSection extends Section {
  constructor (section) {
    super()
    this.header(section.header)

    if (section.content) {
      /* add content without indentation or wrapping */
      if (section.raw) {
        this.add(section.content)
      } else {
        const content = new Content(section.content)
        this.add(content.lines())
      }

      this.emptyLine()
    }
  }
}

module.exports = ContentSection


/***/ }),
/* 99 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

const Table = __webpack_require__(51)
const ansi = __webpack_require__(18)
const t = __webpack_require__(3)

class Content {
  constructor (content) {
    this._content = content
  }

  lines () {
    const content = this._content
    const defaultPadding = { left: '  ', right: ' ' }

    if (content) {
      /* string content */
      if (t.isString(content)) {
        const table = new Table({ column: ansi.format(content) }, {
          padding: defaultPadding,
          maxWidth: 80
        })
        return table.renderLines()

      /* array of strings */
      } else if (Array.isArray(content) && content.every(t.isString)) {
        const rows = content.map(string => ({ column: ansi.format(string) }))
        const table = new Table(rows, {
          padding: defaultPadding,
          maxWidth: 80
        })
        return table.renderLines()

      /* array of objects (use table-layout) */
      } else if (Array.isArray(content) && content.every(t.isPlainObject)) {
        const table = new Table(content.map(row => ansiFormatRow(row)), {
          padding: defaultPadding
        })
        return table.renderLines()

      /* { options: object, data: object[] } */
      } else if (t.isPlainObject(content)) {
        if (!content.options || !content.data) {
          throw new Error('must have an "options" or "data" property\n' + JSON.stringify(content))
        }
        const options = Object.assign(
          { padding: defaultPadding },
          content.options
        )

        /* convert nowrap to noWrap to avoid breaking compatibility */
        if (options.columns) {
          options.columns = options.columns.map(column => {
            if (column.nowrap) {
              column.noWrap = column.nowrap
              delete column.nowrap
            }
            return column
          })
        }

        const table = new Table(
          content.data.map(row => ansiFormatRow(row)),
          options
        )
        return table.renderLines()
      } else {
        const message = `invalid input - 'content' must be a string, array of strings, or array of plain objects:\n\n${JSON.stringify(content)}`
        throw new Error(message)
      }
    }
  }
}

function ansiFormatRow (row) {
  for (const key in row) {
    row[key] = ansi.format(row[key])
  }
  return row
}

module.exports = Content


/***/ }),
/* 100 */
/***/ (function(module, exports) {

module.exports = {"name":"enuf","version":"1.1.0","description":"The quicker, easier way to deal with numbered files. The bibling lawyer's dream come true.","main":"index.js","scripts":{"test":"mocha test/","lint":"eslint index.js src/","mtd":"node mktestdir.js","webpack":"webpack"},"bin":{"enuf":"./index.js"},"repository":{"type":"git","url":"git+https://github.com/ssmolkin1/enuf.git"},"keywords":["number","files","folder","renumber","re-number","law","lawyer","bible","binder","closing"],"author":"Samuel Smolkin <sam@future-precedent.org>","license":"MIT","bugs":{"url":"https://github.com/ssmolkin1/enuf/issues"},"homepage":"https://github.com/ssmolkin1/enuf#readme","dependencies":{"command-line-args":"^4.0.7","command-line-commands":"^2.0.1","command-line-usage":"^4.0.2","my-little-schemer":"^1.0.0","shelljs":"^0.7.8"},"devDependencies":{"chai":"^4.1.2","eslint":"^4.12.1","eslint-config-airbnb-base":"^12.1.0","eslint-plugin-import":"^2.8.0","mocha":"^4.0.1","webpack":"^3.10.0"}}

/***/ })
/******/ ]);