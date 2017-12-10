function loadTo(G) {
  // Determines whether the file is a numbered file
  G.isNumbered = name => /^\d/.test(name);

  // Extracts the number from a numbered filename
  G.getNum = (name) => {
    if (G.isNumbered(name)) {
      const num = /^\d+/.exec(name)[0];
      return parseInt(num, 10);
    }

    return '';
  };

  // Extract the extension (with dot) from a filename
  G.getExt = name => /\.[^.]*$/.exec(name)[0];

  // Extracts body of filename (i.e., what is between number and extension)
  G.getBody = (name) => {
    const nameL = name.length;

    const num = G.getNum(name);
    const numStr = num.toString();
    const numStrL = numStr.length;

    const ext = G.getExt(name);
    const extL = ext.length;

    if (numStrL + extL === nameL) {
      return '';
    }

    return name.slice(numStrL, nameL - extL);
  };

  // Parses filename into [number, body, ext] array, with option to override number
  // and body (needed for naming new files)
  G.parseFileName = (
    name,
    num = G.getNum(name),
    body = G.getBody(name),
  ) => [num, body, G.getExt(name)];

  // Get list of files in directory. Slice gets rid of extra stuff returned by sh.ls()
  G.getFiles = dir => G.sh.ls(dir).slice();

  // Get sorted list of numbered files
  G.getNumFiles = files => files
    .filter(name => G.isNumbered(name))
    .sort((a, b) => G.getNum(a) - G.getNum(b));

  // Get list of parsed filnames from list of files
  G.getParsedFiles = files => files.map(name => G.parseFileName(name));

  // Turn parsed filename into path
  G.toPath = (dir, parsedFileName) => {
    const fileName = parsedFileName.join('');

    return `${dir}/${fileName}`;
  };
}

module.exports = { loadTo };
