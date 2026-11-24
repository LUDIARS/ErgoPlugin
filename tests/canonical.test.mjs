import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson } from '../scripts/lib/canonical.mjs';

test('keys are sorted at every level and no whitespace is added', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: [1, 'x'], c: null } }), '{"a":{"c":null,"d":[1,"x"]},"b":1}');
});

test('non-ASCII strings are kept as UTF-8 text', () => {
  assert.equal(canonicalJson({ title: 'パーティクル' }), '{"title":"パーティクル"}');
});

test('undefined members are dropped', () => {
  assert.equal(canonicalJson({ a: undefined, b: true }), '{"b":true}');
});

test('fractions and unsafe integers are refused', () => {
  assert.throws(() => canonicalJson({ a: 1.5 }));
  assert.throws(() => canonicalJson({ a: 2 ** 60 }));
});
