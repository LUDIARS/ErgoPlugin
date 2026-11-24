// 署名の対象にする正規化 JSON (キーを辞書順に並べ、空白を入れない)。
// Studio (C++) も同じ規則で組み立てて検証するので、規則を変えるときは両方を同時に変える。

export function canonicalJson(value) {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`canonical JSON accepts only safe integers: ${value}`);
    }
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  }
  throw new Error(`canonical JSON cannot encode ${typeof value}`);
}
