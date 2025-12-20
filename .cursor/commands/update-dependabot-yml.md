# Dependabot 設定ファイルの更新

## 概要
`.github/dependabot.yml` の内容を現在の `package.json` の依存関係に合わせて更新する。パッケージの追加・削除・変更があった場合に、Dependabot のグループ化設定を同期させる。

## 手順

1. **package.json の依存関係を確認**
   - `services/collector/package.json` を読み込む
   - `dependencies` と `devDependencies` のパッケージ名を抽出
   - 現在の `.github/dependabot.yml` の `groups` セクションと比較

2. **dev-dependencies グループを更新**
   - `devDependencies` に含まれるパッケージを `patterns` に追加
   - `@types/*` のようなワイルドカードパターンは維持
   - 削除されたパッケージは `patterns` から削除
   - 現在の devDependencies: `@biomejs/biome`, `@types/node`, `husky`, `lint-staged`, `typescript`, `vitest`

3. **production-dependencies グループを更新**
   - `dependencies` に含まれるパッケージを `patterns` に追加
   - 削除されたパッケージは `patterns` から削除
   - 現在の dependencies: `dotenv`, `ioredis`, `tsx`, `winston`

4. **設定ファイルの検証**
   - YAML の構文が正しいか確認
   - パッケージ名のスペルミスがないか確認
   - `groups` の `patterns` が実際の `package.json` と一致しているか確認

5. **変更内容の確認**
   - 追加されたパッケージ
   - 削除されたパッケージ
   - 変更がない場合はその旨を報告

## 注意事項

- `@types/*` のようなワイルドカードパターンは維持する
- `overrides` セクションのパッケージ（例: `glob`）は `groups` に含めない
- Python サービス用の pip 設定は変更しない（コメントアウト状態を維持）
- パッケージ名は正確に記述する（大文字小文字を区別）

## チェックリスト

- [ ] `package.json` の `dependencies` と `devDependencies` を確認
- [ ] `dev-dependencies` グループの `patterns` を更新
- [ ] `production-dependencies` グループの `patterns` を更新
- [ ] YAML 構文が正しいか確認
- [ ] 変更内容を要約して報告