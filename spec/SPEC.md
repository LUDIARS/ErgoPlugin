# ErgoPlugin — Ergo のプラグイン置き場

設計の正本: Ergo `spec/plan/2026-11-23-ergo-plugin-registry.md` (neco 2026-11-23・2026-11-24 の決定)。
ここには ErgoPlugin リポの中身と署名の手順だけを書く。

## 決まっていること

- 置き場に別の名前は付けない。リポは `LUDIARS/ErgoPlugin`、プラグインサーバは GitHub (専用サーバは立てない)。
- 署名は GitHub Actions が行う。人も AI も手元で署名しない。AI は秘密鍵を作らない・読まない・登録しない。
- プラグインの実体は今どおり各発行者のリポ。ここは「どのプラグインを、どこから、どの版で取るか」と信頼情報だけを持つ。

## ファイル

| 場所 | 中身 | 更新 |
|---|---|---|
| `index.json` | 索引 (署名前)。`{"version":1,"plugins":[...]}` | PR (Revisor の審査) |
| `publishers/<id>.json` | 発行者。`id`・許す plugin id の接頭辞 `prefixes` (`/` で終わる)・許す GitHub owner `owners` | PR |
| `trust/revoked.json` | 失効リスト (署名前)。失効した署名用証明書の指紋 (sha256) と、失効したプラグインの版 (id + 40 桁 rev) | PR |
| `trust/root.pem` | LUDIARS ルート証明書 (Ed25519 の X.509)。Studio に同梱する方が信頼の起点 | 人 |
| `trust/signing.pem` | 署名用証明書 (ルートが署名、1 年程度)。秘密鍵は Actions の secret `ERGO_PLUGIN_SIGNING_KEY` | 人 |

索引の項目:

```json
{"id":"ludiars/particle","title":"パーティクル","summary":"...","publisher":"ludiars",
 "domains":["game","cglive"],"styles":["cpp-ludiars"],"kind":"pack",
 "source":"LUDIARS/Xxx:studio_pack@<40 桁 sha>","tables":["particle.emitter"],"abi":1,
 "artifacts":[{"platform":"windows-x64","url":"https://...","sha256":"<64 桁>"}]}
```

- `kind` が `builtin` (Ergo 内蔵、有効化だけ) のときは `source` を持たない。`pack` は必須。
- `source` は Ergo の取得元の書式 (`plugin_source.h`)。subpath に `..`・絶対パス・`\`・空の段は書けない。

## 検査 (`node scripts/check.mjs`)

PR の審査でも Actions でも同じものを回す。1 つでも外れたら署名しない。

- 索引・発行者・失効リストの形。plugin id の重複。
- 項目の `publisher` が `publishers/` にあり、id がその `prefixes` に入り、`source` の owner がその `owners` に入る。
- rev は 40 桁の sha (ブランチ名は不可)。`artifacts` は https と 64 桁の sha256。

## 署名 (`.github/workflows/sign.yml` → `scripts/sign-release.mjs`)

1. main への push (Revisor の審査を通って公開された変更) だけで動く。PR・フォークからは動かない。
   job は GitHub の environment `signing` に置き、secret はそこにだけ登録する。
2. 検査とテストを回す。秘密鍵と `trust/signing.pem` の公開鍵が対でなければ止まる。
3. 索引と失効リストのそれぞれに `serial` (= Actions の run 番号、単調増加) と `signed_at` を入れ、`signature` を除いた
   正規化 JSON (キーを辞書順・空白なし・UTF-8・整数だけ) を Ed25519 で署名する。
4. Release `index-<serial>` に `index.signed.json`・`revoked.signed.json`・`signing.pem` を添付し、latest にする。
   main には書き戻さない (main は Revisor が公開する系列)。

Studio は `https://github.com/LUDIARS/ErgoPlugin/releases/latest/download/` の 3 ファイルを取り、同梱のルートで
署名用証明書を、署名用証明書で索引と失効リストを検証する。`serial` が前に受け取った値より小さければ断る。

## 人の作業

1. ルート鍵とルート証明書を作り、ルート鍵はオフラインで保管する。`trust/root.pem` を PR で入れる。
2. 署名用の鍵を作り、ルートで署名用証明書を発行して `trust/signing.pem` を PR で入れる。
3. 署名用の鍵を GitHub の environment `signing` の secret `ERGO_PLUGIN_SIGNING_KEY` に登録する。
4. 更新・失効: 新しい署名用証明書を PR で差し替え、古い方の指紋を `trust/revoked.json` に足す。

2 と 3 が済むまでは、main への push の Actions は「trust/signing.pem が無い」「鍵が無い」で失敗する (署名しないので安全側)。

## テスト

`node --test tests/*.test.mjs`。鍵はテストの中で毎回作る (固定の鍵の文字列を置かない)。証明書は openssl で作る
(openssl が無い環境では連鎖と署名手順のテストだけ飛ばす。Actions の ubuntu には入っている)。
