// 索引・発行者・失効リストの形と、発行者の許す範囲の検査。
// 1 つでも誤りがあれば署名しない (呼び出し側が errors の有無で止める)。

const PLUGIN_ID = /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*$/;
const PUBLISHER_ID = /^[a-z0-9][a-z0-9-]*$/;
const SOURCE = /^([A-Za-z0-9][A-Za-z0-9-]*)\/([A-Za-z0-9._-]+):([^@]+)@([0-9a-f]{40})$/;
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const KINDS = new Set(['builtin', 'pack']);

const isStringArray = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string' && s.length > 0);

export function parseSource(source) {
  const m = SOURCE.exec(source);
  if (!m) return null;
  const subpath = m[3];
  const bad = subpath.startsWith('/') || subpath.includes('\\') || /^[A-Za-z]:/.test(subpath)
    || subpath.split('/').some((part) => part === '..' || part === '');
  if (bad) return null;
  return { owner: m[1], repo: m[2], subpath, rev: m[4] };
}

export function validatePublisher(fileId, publisher) {
  const errors = [];
  const where = `publishers/${fileId}.json`;
  if (!publisher || typeof publisher !== 'object') return [`${where}: object expected`];
  if (publisher.id !== fileId || !PUBLISHER_ID.test(publisher.id ?? '')) {
    errors.push(`${where}: id must equal the file name and match ${PUBLISHER_ID}`);
  }
  if (!isStringArray(publisher.prefixes) || publisher.prefixes.length === 0
      || !publisher.prefixes.every((p) => p.endsWith('/'))) {
    errors.push(`${where}: prefixes must be a non-empty list ending with "/"`);
  }
  if (!isStringArray(publisher.owners) || publisher.owners.length === 0) {
    errors.push(`${where}: owners must be a non-empty list`);
  }
  return errors;
}

function validateArtifacts(where, artifacts) {
  if (artifacts === undefined) return [];
  if (!Array.isArray(artifacts)) return [`${where}: artifacts must be a list`];
  const errors = [];
  artifacts.forEach((a, i) => {
    if (!a || typeof a.platform !== 'string' || !a.platform) errors.push(`${where}: artifacts[${i}].platform missing`);
    if (typeof a?.url !== 'string' || !a.url.startsWith('https://')) errors.push(`${where}: artifacts[${i}].url must be https`);
    if (!SHA256.test(a?.sha256 ?? '')) errors.push(`${where}: artifacts[${i}].sha256 must be 64 hex`);
  });
  return errors;
}

function validatePlugin(plugin, i, publishers) {
  const where = `index.json plugins[${i}]`;
  const errors = [];
  if (!plugin || typeof plugin !== 'object') return [`${where}: object expected`];
  if (!PLUGIN_ID.test(plugin.id ?? '')) errors.push(`${where}: id must match ${PLUGIN_ID}`);
  if (typeof plugin.title !== 'string' || !plugin.title) errors.push(`${where}: title missing`);
  if (plugin.summary !== undefined && typeof plugin.summary !== 'string') errors.push(`${where}: summary must be a string`);
  if (!isStringArray(plugin.domains ?? [])) errors.push(`${where}: domains must be a list of strings`);
  if (!isStringArray(plugin.styles ?? [])) errors.push(`${where}: styles must be a list of strings`);
  if (!isStringArray(plugin.tables ?? [])) errors.push(`${where}: tables must be a list of strings`);
  if (!Number.isSafeInteger(plugin.abi) || plugin.abi < 1) errors.push(`${where}: abi must be a positive integer`);
  if (!KINDS.has(plugin.kind)) errors.push(`${where}: kind must be builtin or pack`);
  errors.push(...validateArtifacts(where, plugin.artifacts));

  const publisher = publishers.get(plugin.publisher);
  if (!publisher) {
    errors.push(`${where}: unknown publisher ${JSON.stringify(plugin.publisher)}`);
    return errors;
  }
  if (typeof plugin.id === 'string' && !publisher.prefixes.some((p) => plugin.id.startsWith(p))) {
    errors.push(`${where}: id ${plugin.id} is outside the prefixes of ${publisher.id}`);
  }
  if (plugin.kind === 'pack') {
    const source = typeof plugin.source === 'string' ? parseSource(plugin.source) : null;
    if (!source) {
      errors.push(`${where}: source must be owner/repo:subpath@<40 hex sha>`);
    } else if (!publisher.owners.includes(source.owner)) {
      errors.push(`${where}: source owner ${source.owner} is not allowed for ${publisher.id}`);
    }
  } else if (plugin.source !== undefined) {
    errors.push(`${where}: builtin plugins have no source`);
  }
  return errors;
}

export function validateIndex(index, publishers) {
  if (!index || index.version !== 1 || !Array.isArray(index.plugins)) {
    return ['index.json: {"version":1,"plugins":[...]} expected'];
  }
  const errors = [];
  const seen = new Set();
  index.plugins.forEach((plugin, i) => {
    errors.push(...validatePlugin(plugin, i, publishers));
    if (plugin?.id && seen.has(plugin.id)) errors.push(`index.json plugins[${i}]: duplicate id ${plugin.id}`);
    seen.add(plugin?.id);
  });
  return errors;
}

export function validateRevoked(revoked) {
  if (!revoked || revoked.version !== 1 || !Array.isArray(revoked.certificates) || !Array.isArray(revoked.plugins)) {
    return ['trust/revoked.json: {"version":1,"certificates":[...],"plugins":[...]} expected'];
  }
  const errors = [];
  revoked.certificates.forEach((c, i) => {
    if (!SHA256.test(c?.fingerprint ?? '')) errors.push(`trust/revoked.json certificates[${i}]: fingerprint must be sha256 hex`);
  });
  revoked.plugins.forEach((p, i) => {
    if (!PLUGIN_ID.test(p?.id ?? '')) errors.push(`trust/revoked.json plugins[${i}]: id invalid`);
    if (!SHA40.test(p?.rev ?? '')) errors.push(`trust/revoked.json plugins[${i}]: rev must be 40 hex`);
  });
  return errors;
}

export function validateRegistry({ index, publishers, revoked }) {
  const errors = [];
  const accepted = new Map();
  for (const [fileId, publisher] of publishers) {
    const e = validatePublisher(fileId, publisher);
    errors.push(...e);
    if (e.length === 0) accepted.set(fileId, publisher);
  }
  errors.push(...validateIndex(index, accepted));
  errors.push(...validateRevoked(revoked));
  return errors;
}
