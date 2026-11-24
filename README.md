# ErgoPlugin

Ergo Studio が読むプラグインの置き場。どのプラグインを、どこから、どの版で取るか (索引) と、
それを信頼してよいかの情報 (発行者・証明書・失効リスト) を持つ。プラグインの実体は各発行者のリポにある。

- 索引: `index.json`
- 発行者: `publishers/*.json`
- 信頼: `trust/` (ルート証明書・署名用証明書・失効リスト)
- 署名: main への push で GitHub Actions (`.github/workflows/sign.yml`) が署名し、Release に添付する

```bash
node scripts/check.mjs          # 索引・発行者・失効リストの検査
node --test tests/*.test.mjs    # テスト
```

仕様は [spec/SPEC.md](spec/SPEC.md)。設計の正本は Ergo の `spec/plan/2026-11-23-ergo-plugin-registry.md`。
