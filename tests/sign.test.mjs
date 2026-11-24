import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createPublicKey, X509Certificate } from 'node:crypto';
import { signDocument, verifyDocument, keyMatchesCertificate } from '../scripts/lib/sign.mjs';
import { newKeyPair, hasOpenssl, issueSigningCertificate, sampleRegistry, writeRepo } from './helpers.mjs';

const opts = { serial: 3, signedAt: '2026-11-24T00:00:00.000Z' };

test('a signed index verifies with the signing key', () => {
  const key = newKeyPair();
  const signed = signDocument(sampleRegistry().index, key.privatePem, opts);
  assert.equal(signed.serial, 3);
  assert.equal(signed.signed_at, opts.signedAt);
  assert.ok(verifyDocument(signed, key.publicKey));
});

test('changing one byte, the serial or the date breaks the signature', () => {
  const key = newKeyPair();
  const signed = signDocument(sampleRegistry().index, key.privatePem, opts);
  const tampered = structuredClone(signed);
  tampered.plugins[0].source = tampered.plugins[0].source.replace(/a$/, 'b');
  assert.equal(verifyDocument(tampered, key.publicKey), false);
  assert.equal(verifyDocument({ ...signed, serial: 2 }, key.publicKey), false);
  assert.equal(verifyDocument({ ...signed, signed_at: '2020-01-01T00:00:00.000Z' }, key.publicKey), false);
});

test('another key does not verify', () => {
  const signed = signDocument(sampleRegistry().index, newKeyPair().privatePem, opts);
  assert.equal(verifyDocument(signed, newKeyPair().publicKey), false);
});

test('a missing signature does not verify and re-signing replaces it', () => {
  const key = newKeyPair();
  const signed = signDocument(sampleRegistry().index, key.privatePem, opts);
  const { signature, ...unsigned } = signed;
  assert.equal(verifyDocument(unsigned, key.publicKey), false);
  assert.ok(verifyDocument(signDocument(signed, key.privatePem, { ...opts, serial: 4 }), key.publicKey));
});

test('serials below 1 are refused', () => {
  assert.throws(() => signDocument({}, newKeyPair().privatePem, { ...opts, serial: 0 }));
});

test('certificate chain and sign-release end to end', { skip: !hasOpenssl() && 'openssl is not on PATH' }, () => {
  const root = newKeyPair();
  const signing = newKeyPair();
  const work = mkdtempSync(join(tmpdir(), 'ergo-plugin-cert-'));
  const { rootCertificate, signingCertificate } = issueSigningCertificate(work, root.privatePem, signing.privatePem);

  const signingCert = new X509Certificate(signingCertificate);
  assert.ok(signingCert.verify(new X509Certificate(rootCertificate).publicKey), 'signing certificate is issued by root');
  assert.equal(signingCert.verify(createPublicKey(newKeyPair().privatePem)), false, 'another root does not verify it');
  assert.ok(keyMatchesCertificate(signing.privatePem, signingCertificate));
  assert.equal(keyMatchesCertificate(newKeyPair().privatePem, signingCertificate), false);

  const repo = writeRepo(sampleRegistry(), signingCertificate);
  const out = join(work, 'dist');
  const script = new URL('../scripts/sign-release.mjs', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  execFileSync(process.execPath, [script, '--serial', '7', '--out', out, '--root', repo], {
    env: { ...process.env, ERGO_PLUGIN_SIGNING_KEY: signing.privatePem },
    stdio: 'pipe',
  });
  const index = JSON.parse(readFileSync(join(out, 'index.signed.json'), 'utf8'));
  const revoked = JSON.parse(readFileSync(join(out, 'revoked.signed.json'), 'utf8'));
  assert.equal(index.serial, 7);
  assert.ok(verifyDocument(index, signingCert.publicKey));
  assert.ok(verifyDocument(revoked, signingCert.publicKey));
  assert.equal(readFileSync(join(out, 'signing.pem'), 'utf8'), signingCertificate);

  const wrongKey = () => execFileSync(process.execPath, [script, '--serial', '8', '--out', join(work, 'x'), '--root', repo], {
    env: { ...process.env, ERGO_PLUGIN_SIGNING_KEY: newKeyPair().privatePem },
    stdio: 'pipe',
  });
  assert.throws(wrongKey, /does not match/);

  const bad = sampleRegistry();
  bad.index.plugins[0].id = 'other/x';
  const badRepo = writeRepo(bad, signingCertificate);
  const invalid = () => execFileSync(process.execPath, [script, '--serial', '9', '--out', join(work, 'y'), '--root', badRepo], {
    env: { ...process.env, ERGO_PLUGIN_SIGNING_KEY: signing.privatePem },
    stdio: 'pipe',
  });
  assert.throws(invalid, /nothing was signed/);
});
