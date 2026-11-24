// PR の審査で回す検査。署名はしない (鍵を使わない)。
// 使い方: node scripts/check.mjs [リポのフォルダ]

import { resolve } from 'node:path';
import { readRegistry } from './lib/registry-files.mjs';
import { validateRegistry } from './lib/validate.mjs';

const root = resolve(process.argv[2] ?? '.');
const errors = validateRegistry(readRegistry(root));
if (errors.length > 0) {
  for (const e of errors) console.error(`error: ${e}`);
  process.exit(1);
}
console.log('ok: index, publishers and revocation list are valid');
