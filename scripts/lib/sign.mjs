// Ed25519 の署名と検証。署名の対象は signature を除いた文書全体の正規化 JSON
// (serial と signed_at も含むので、版の巻き戻しや日付の書き換えも検出できる)。

import { createPrivateKey, createPublicKey, sign, verify, X509Certificate } from 'node:crypto';
import { canonicalJson } from './canonical.mjs';

function payloadOf(document) {
  const { signature, ...rest } = document;
  return Buffer.from(canonicalJson(rest), 'utf8');
}

export function signDocument(document, privateKeyPem, { serial, signedAt }) {
  if (!Number.isSafeInteger(serial) || serial < 1) throw new Error('serial must be a positive integer');
  const key = createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('signing key must be Ed25519');
  const unsigned = { ...document, serial, signed_at: signedAt };
  delete unsigned.signature;
  const signature = sign(null, payloadOf(unsigned), key).toString('base64');
  return { ...unsigned, signature };
}

export function verifyDocument(signed, publicKey) {
  if (typeof signed?.signature !== 'string') return false;
  return verify(null, payloadOf(signed), publicKey, Buffer.from(signed.signature, 'base64'));
}

// 署名用証明書の公開鍵と、渡された秘密鍵が対になっているか (取り違えた鍵で署名しない)。
export function keyMatchesCertificate(privateKeyPem, certificatePem) {
  const certificate = new X509Certificate(certificatePem);
  const fromKey = createPublicKey(createPrivateKey(privateKeyPem)).export({ type: 'spki', format: 'der' });
  const fromCert = certificate.publicKey.export({ type: 'spki', format: 'der' });
  return Buffer.compare(fromKey, fromCert) === 0;
}
