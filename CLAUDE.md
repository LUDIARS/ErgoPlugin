# ErgoPlugin — Claude Code ルール

Ergo のプラグイン置き場。仕様は `spec/SPEC.md`、設計の正本は Ergo `spec/plan/2026-11-23-ergo-plugin-registry.md`。

- 変更は feat / fix / docs ブランチ + Revisor の local PR。main へ直接コミットしない。
- 依存は入れない (Node の標準だけ)。テストは `node --test tests/*.test.mjs`、検査は `node scripts/check.mjs`。
- 秘密鍵を作らない・読まない・書かない・登録しない。`trust/root.pem` と `trust/signing.pem` の作成と、
  Actions の secret の登録は人の作業。テストの鍵はテストの中で作る。
- 署名済みの索引を main にコミットしない (Actions が Release に添付する)。
- 正規化 JSON の規則 (`scripts/lib/canonical.mjs`) を変えるときは、Ergo Studio の検証側も同じ PR の組で変える。
- 索引に載せる rev は 40 桁の sha。ブランチ名を書かない。
