import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistry, parseSource } from '../scripts/lib/validate.mjs';
import { sampleRegistry, samplePlugin, samplePublisher, SHA } from './helpers.mjs';

const errorsFor = (plugin) => validateRegistry(sampleRegistry({ plugins: [plugin] }));

test('a well-formed registry has no errors', () => {
  assert.deepEqual(validateRegistry(sampleRegistry()), []);
});

test('an empty index is valid', () => {
  assert.deepEqual(validateRegistry(sampleRegistry({ plugins: [] })), []);
});

test('an id outside the publisher prefixes is refused', () => {
  assert.match(errorsFor(samplePlugin({ id: 'other/particle' })).join('\n'), /outside the prefixes/);
});

test('a source owner the publisher does not own is refused', () => {
  assert.match(errorsFor(samplePlugin({ source: `Someone/Repo:plugins@${SHA}` })).join('\n'), /not allowed/);
});

test('a branch name instead of a 40 hex sha is refused', () => {
  assert.match(errorsFor(samplePlugin({ source: 'LUDIARS/Ergo:plugins@main' })).join('\n'), /source must be/);
});

test('subpaths that climb or are absolute are refused', () => {
  for (const sub of ['../x', 'a/../b', '/abs', 'a\\b', 'C:/x', 'a//b']) {
    assert.equal(parseSource(`LUDIARS/Ergo:${sub}@${SHA}`), null, sub);
  }
  assert.deepEqual(parseSource(`LUDIARS/Ergo:tools/plugins@${SHA}`), { owner: 'LUDIARS', repo: 'Ergo', subpath: 'tools/plugins', rev: SHA });
});

test('an unknown publisher is refused', () => {
  assert.match(errorsFor(samplePlugin({ publisher: 'nobody' })).join('\n'), /unknown publisher/);
});

test('duplicate ids are refused', () => {
  const errors = validateRegistry(sampleRegistry({ plugins: [samplePlugin(), samplePlugin()] }));
  assert.match(errors.join('\n'), /duplicate id/);
});

test('builtin plugins carry no source, packs need one', () => {
  assert.deepEqual(errorsFor(samplePlugin({ kind: 'builtin', source: undefined })), []);
  assert.match(errorsFor(samplePlugin({ kind: 'builtin' })).join('\n'), /no source/);
  assert.match(errorsFor(samplePlugin({ source: undefined })).join('\n'), /source must be/);
});

test('bad abi, kind and artifacts are refused', () => {
  assert.match(errorsFor(samplePlugin({ abi: 0 })).join('\n'), /abi/);
  assert.match(errorsFor(samplePlugin({ kind: 'script' })).join('\n'), /kind/);
  const art = { platform: 'windows-x64', url: 'http://x', sha256: 'z' };
  const joined = errorsFor(samplePlugin({ artifacts: [art] })).join('\n');
  assert.match(joined, /https/);
  assert.match(joined, /sha256/);
});

test('a publisher whose id does not match its file is refused and its plugins too', () => {
  const registry = sampleRegistry();
  registry.publishers = new Map([['ludiars', { ...samplePublisher(), id: 'other' }]]);
  const joined = validateRegistry(registry).join('\n');
  assert.match(joined, /id must equal the file name/);
  assert.match(joined, /unknown publisher/);
});

test('publisher prefixes must end with a slash', () => {
  const registry = sampleRegistry({ publisher: { ...samplePublisher(), prefixes: ['ludiars'] } });
  assert.match(validateRegistry(registry).join('\n'), /prefixes/);
});

test('the revocation list is checked', () => {
  const registry = sampleRegistry();
  registry.revoked = { version: 1, certificates: [{ fingerprint: 'x' }], plugins: [{ id: 'ludiars/a', rev: 'main' }] };
  const joined = validateRegistry(registry).join('\n');
  assert.match(joined, /fingerprint/);
  assert.match(joined, /rev must be 40 hex/);
});
