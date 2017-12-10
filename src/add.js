function loadTo(G) {
  G.addFiles = (keepBody, dir, index, ...names) => {
    function reNum(fileMap, startN, prevN, col) {
      if (G.isNull(fileMap)) {
        return col([], []);
      }

      const curr = G.car(fileMap);
      const currN = G.car(curr);
      const rest = G.cdr(fileMap);

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
        G.cons(G.toPath(dir, curr), orig),
        G.cons(G.toPath(dir, G.cons(nextN, G.cdr(curr))), dest),
      ));
    }

    const mappedFiles = G.getParsedFiles(G.getNumFiles(G.getFiles(dir)));

    // Files must be moved in reverse to avoid collision
    const mvMap = reNum(mappedFiles, index, index + (names.length - 1), (orig, dest) => {
      const addOrig = names.map(name => `${dir}/${name}`);
      const addDest = names.map((name, i) => {
        if (keepBody) {
          return G.toPath(dir, G.parseFileName(name, index + i, ` - ${G.getBody(name)}`));
        }

        return G.toPath(dir, G.parseFileName(name, index + i, ''));
      });

      return [orig.reverse().concat(addOrig.reverse()), dest.reverse().concat(addDest.reverse())];
    });

    const origins = mvMap[0];
    const destinations = mvMap[1];

    origins.forEach((orig, i) => {
      // G.sh.mv(orig, destinations[i]);
      console.log([orig, destinations[i]]);
    });
  };
}

module.exports = { loadTo };
