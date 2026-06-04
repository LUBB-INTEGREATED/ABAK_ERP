// Test preload: stub the ESM `shared-utils` package so the CJS swc-node require
// hook can load the api graph. nextEntityNumber feeds the revise/submit paths;
// the format/words helpers feed the DOC-3 document renderer. The renderer test
// asserts structure (labels/counts), not money formatting, so simple
// string-returning stubs suffice. Loaded via `-r` BEFORE @swc-node/register.
const Module = require('module');
const origLoad = Module._load;
let n = 0;
const stub = {
  nextEntityNumber: (prefix) => `${prefix}-T${process.pid}-${++n}`,
  formatNumber: (v) => Number(v).toLocaleString('en-US'),
  formatCurrency: (v) =>
    Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' SAR',
  amountInWords: (v) => `amount-in-words(${v})`,
};
Module._load = function (request, parent, isMain) {
  if (request === 'shared-utils') return stub;
  return origLoad.call(this, request, parent, isMain);
};
