// Test preload: stub the ESM `shared-utils` package so the CJS swc-node require
// hook can load the api graph. Only nextEntityNumber is exercised by the
// revise/submit paths, and the DM-8/DM-9 assertions don't depend on the number
// format. Loaded via `-r` BEFORE @swc-node/register so the cache is primed.
const Module = require('module');
const origLoad = Module._load;
let n = 0;
const stub = {
  nextEntityNumber: (prefix) => `${prefix}-T${process.pid}-${++n}`,
};
Module._load = function (request, parent, isMain) {
  if (request === 'shared-utils') return stub;
  return origLoad.call(this, request, parent, isMain);
};
