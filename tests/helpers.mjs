// テスト用の鍵・証明書・リポの組み立て。鍵は毎回ここで作り、固定の鍵の文字列は置かない。

import { generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function newKeyPair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey,
    publicKey,
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

export function hasOpenssl() {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// ルートが署名した署名用証明書を openssl で作る (Node には証明書を作る API が無い)。
export function issueSigningCertificate(dir, rootPrivatePem, signingPrivatePem) {
  const rootKey = join(dir, 'root.key');
  const rootCert = join(dir, 'root.pem');
  const signKey = join(dir, 'signing.key');
  const csr = join(dir, 'signing.csr');
  const cert = join(dir, 'signing.pem');
  writeFileSync(rootKey, rootPrivatePem);
  writeFileSync(signKey, signingPrivatePem);
  execFileSync('openssl', ['req', '-x509', '-new', '-key', rootKey, '-subj', '/CN=test-root', '-days', '1', '-out', rootCert], { stdio: 'ignore' });
  execFileSync('openssl', ['req', '-new', '-key', signKey, '-subj', '/CN=test-signing', '-out', csr], { stdio: 'ignore' });
  execFileSync('openssl', ['x509', '-req', '-in', csr, '-CA', rootCert, '-CAkey', rootKey, '-CAcreateserial', '-days', '1', '-out', cert], { stdio: 'ignore' });
  return { rootCertificate: readFileSync(rootCert, 'utf8'), signingCertificate: readFileSync(cert, 'utf8') };
}

export const SHA = 'a'.repeat(40);

export function samplePublisher() {
  return { id: 'ludiars', prefixes: ['ludiars/'], owners: ['LUDIARS'] };
}

export function samplePlugin(overrides = {}) {
  return {
    id: 'ludiars/particle',
    title: 'パーティクル',
    publisher: 'ludiars',
    domains: ['game'],
    styles: ['cpp-ludiars'],
    kind: 'pack',
    source: `LUDIARS/Ergo:tools/studio/plugins/particle@${SHA}`,
    abi: 1,
    ...overrides,
  };
}

export function sampleRegistry({ plugins = [samplePlugin()], publisher = samplePublisher() } = {}) {
  return {
    index: { version: 1, plugins },
    publishers: new Map([[publisher.id, publisher]]),
    revoked: { version: 1, certificates: [], plugins: [] },
  };
}

export function writeRepo(registry, signingCertificate) {
  const root = mkdtempSync(join(tmpdir(), 'ergo-plugin-test-'));
  mkdirSync(join(root, 'publishers'));
  mkdirSync(join(root, 'trust'));
  writeFileSync(join(root, 'index.json'), JSON.stringify(registry.index));
  for (const [id, p] of registry.publishers) writeFileSync(join(root, 'publishers', `${id}.json`), JSON.stringify(p));
  writeFileSync(join(root, 'trust', 'revoked.json'), JSON.stringify(registry.revoked));
  if (signingCertificate) writeFileSync(join(root, 'trust', 'signing.pem'), signingCertificate);
  return root;
}
