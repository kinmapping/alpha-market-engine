# ステージング分割の提案

現在の変更ファイルを確認し、論理的なグループに分割してステージングする方法を提案します。

## 処理フロー

1. **変更ファイルの確認**
   ```bash
   git status --short
   git diff --stat
   ```
   - 変更ファイルと統計情報を取得
   - ファイルの追加（A）、変更（M）、削除（D）、未追跡（??）を識別

2. **変更内容の分析**
   - ファイルパス、変更内容、関連性を分析
   - 論理的なグループに分類（例: Docker関連、実装コード、テスト、ドキュメントなど）

3. **ステージング分割の提案**
   - 各グループごとにステージングするコマンドを提示
   - グループの説明と推奨されるコミットメッセージの種類を提示
   - ユーザーが選択できるように番号付きで提示

4. **ユーザーによる選択・実行**
   - 提示されたグループを番号で選択
   - 選択されたグループをステージング
   - 必要に応じて次のグループもステージング可能

## グループ分類の基準

以下の基準でグループ化します：

- **Docker/インフラ関連**: Dockerfile, docker-compose.yml, env.example など
- **実装コード**: application/, infrastructure/ 配下のソースコード
- **テスト**: tests/ 配下のテストコード
- **ドキュメント**: README.md, docs/ 配下のドキュメント
- **設定ファイル**: pyproject.toml, package.json, tsconfig.json など
- **その他**: .vscode/, .cursor/ などの開発環境設定

## 実装の詳細

### ステップ1: 変更ファイルの確認
```bash
git status --short
git diff --stat
```

### ステップ2: 変更内容の分析とグループ化

変更ファイルを分析し、以下のようなグループに分類：

```
変更ファイルを分析しました。以下のグループに分割することを提案します：

[1] Docker/インフラ関連
    ファイル:
    - services/strategy/Dockerfile (新規)
    - docker-compose.local.yml (変更)
    - services/strategy/env.example (新規)

    説明: Docker コンテナの設定と環境変数管理
    推奨コミットタイプ: feat または chore

[2] 実装コード（コア機能）
    ファイル:
    - services/strategy/application/usecases/strategy/ohlcv_generator.py (変更)
    - services/strategy/application/usecases/strategy/indicator_calculator.py (変更)
    - services/strategy/application/usecases/strategy/signal_generator.py (変更)
    - services/strategy/infrastructure/strategies/base.py (変更)
    - services/strategy/infrastructure/strategies/moving_average_cross.py (変更)
    - services/strategy/main.py (変更)

    説明: OHLCV生成、指標計算、シグナル生成の実装
    推奨コミットタイプ: feat

[3] テスト
    ファイル:
    - services/strategy/tests/ (新規)

    説明: 統合テストの追加
    推奨コミットタイプ: test

[4] ドキュメント
    ファイル:
    - services/strategy/README.md (新規)

    説明: セットアップと使用方法のドキュメント
    推奨コミットタイプ: docs

[5] 設定ファイル
    ファイル:
    - services/strategy/pyproject.toml (変更)

    説明: 依存関係とパッケージ設定の更新
    推奨コミットタイプ: chore

[6] その他（開発環境設定）
    ファイル:
    - .vscode/settings.json (変更)
    - .cursor/plans/ (新規)

    説明: 開発環境の設定ファイル
    推奨コミットタイプ: chore

どのグループをステージングしますか？番号を指定してください（複数選択可、例: 1,2,3）。
```

### ステップ3: ステージングコマンドの実行

選択されたグループごとに以下のコマンドを実行：

```bash
# グループ1: Docker/インフラ関連
git add services/strategy/Dockerfile
git add docker-compose.local.yml
git add services/strategy/env.example

# グループ2: 実装コード
git add services/strategy/application/usecases/strategy/
git add services/strategy/infrastructure/strategies/
git add services/strategy/main.py

# グループ3: テスト
git add services/strategy/tests/

# グループ4: ドキュメント
git add services/strategy/README.md

# グループ5: 設定ファイル
git add services/strategy/pyproject.toml

# グループ6: その他
git add .vscode/settings.json
git add .cursor/plans/
```

### ステップ4: ステージング内容の確認

```bash
git status --short
git diff --cached --stat
```

## 使用例

```
ユーザー: このコマンドを実行してください

AI: 変更ファイルを確認中...
    - 14 files changed, 500 insertions(+), 20 deletions(-)

    変更ファイルを分析しました。以下のグループに分割することを提案します：

    [1] Docker/インフラ関連
        ファイル: Dockerfile, docker-compose.local.yml, env.example
        説明: Docker コンテナの設定と環境変数管理
        推奨コミットタイプ: feat

    [2] 実装コード（コア機能）
        ファイル: application/usecases/, infrastructure/strategies/, main.py
        説明: OHLCV生成、指標計算、シグナル生成の実装
        推奨コミットタイプ: feat

    [3] テスト
        ファイル: tests/
        説明: 統合テストの追加
        推奨コミットタイプ: test

    どのグループをステージングしますか？番号を指定してください（複数選択可、例: 1,2,3）。

ユーザー: 1,2

AI: [1] と [2] をステージングします...
    git add services/strategy/Dockerfile
    git add docker-compose.local.yml
    git add services/strategy/env.example
    git add services/strategy/application/usecases/strategy/
    git add services/strategy/infrastructure/strategies/
    git add services/strategy/main.py

    ステージングが完了しました。
    ステージング内容:
    - 9 files staged

    次のステップ: /create-commit-message でコミットメッセージを作成できます。
```

## 注意事項

- 未追跡ファイル（??）も含めて分析します
- グループは変更内容に応じて動的に生成されます
- 複数のグループを同時にステージング可能です
- ステージング後は `/create-commit-message` でコミットメッセージを作成することを推奨します
- 大きな変更は複数のコミットに分割することを推奨します（1つのコミットは1つの論理的な変更単位）

