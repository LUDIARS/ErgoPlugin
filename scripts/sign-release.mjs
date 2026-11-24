// GitHub Actions が main への push で呼ぶ署名の手順。
// 使い方: node scripts/sign-release.mjs --serial <n> --out <フォルダ> [--root <リポ>]
// 鍵は環境変数 ERGO_PLUGIN_SIGNING_KEY (PEM) だけから読む。ファイルにもログにも書かない。

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readRegistry } from './lib/registry-files.mjs';
import { validateRegistry } from './lib/validate.mjs';
import { signDocument, keyMatchesCertificate } from './lib/sign.mjs';

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    serial: { type: 'string' },
    out: { type: 'string' },
    root: { type: 'string', default: '.' },
  },
});

const root = resolve(values.root);
const serial = Number(values.serial);
if (!Number.isSafeInteger(serial) || serial < 1) fail('--serial must be a positive integer');
if (!values.out) fail('--out is required');

const key = process.env.ERGO_PLUGIN_SIGNING_KEY;
if (!key) fail('ERGO_PLUGIN_SIGNING_KEY is not set');

const certificatePath = join(root, 'trust', 'signing.pem');
if (!existsSync(certificatePath)) fail('trust/signing.pem is missing');
const certificate = readFileSync(certificatePath, 'utf8');
if (!keyMatchesCertificate(key, certificate)) fail('the signing key does not match trust/signing.pem');

const registry = readRegistry(root);
const errors = validateRegistry(registry);
if (errors.length > 0) {
  for (const e of errors) console.error(`error: ${e}`);
  fail('registry is invalid; nothing was signed');
}

const signedAt = new Date().toISOString();
const out = resolve(values.out);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'index.signed.json'), `${JSON.stringify(signDocument(registry.index, key, { serial, signedAt }), null, 2)}\n`);
writeFileSync(join(out, 'revoked.signed.json'), `${JSON.stringify(signDocument(registry.revoked, key, { serial, signedAt }), null, 2)}\n`);
writeFileSync(join(out, 'signing.pem'), certificate);
console.log(`signed serial ${serial} at ${signedAt}`);
