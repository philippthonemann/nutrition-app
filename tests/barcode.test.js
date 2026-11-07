import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validBarcode } from '../lib/barcode.js';

test('barcode lookup accepts GTIN checksums and rejects invalid or unsafe input', () => {
  for (const value of ['4006381333931','3017620422003','96385074','036000291452']) assert.equal(validBarcode(value),true,value);
  for (const value of ['4006381333932','123','https://example.com','4006381333931/foo','']) assert.equal(validBarcode(value),false,value);
});
