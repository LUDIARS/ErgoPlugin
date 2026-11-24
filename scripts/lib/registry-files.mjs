// リポのファイル (index.json / publishers/*.json / trust/revoked.json) を読む。

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

export function readRegistry(root) {
  const publishers = new Map();
  const dir = join(root, 'publishers');
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
      publishers.set(basename(name, '.json'), readJson(join(dir, name)));
    }
  }
  return {
    index: readJson(join(root, 'index.json')),
    publishers,
    revoked: readJson(join(root, 'trust', 'revoked.json')),
  };
}
