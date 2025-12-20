# Alembic Migrations

このディレクトリには、データベースマイグレーションスクリプトが含まれています。

## 使用方法

### マイグレーションの作成

```bash
# 自動生成（推奨）
alembic revision --autogenerate -m "description"

# 手動作成
alembic revision -m "description"
```

### マイグレーションの適用

```bash
# 最新バージョンにアップグレード
alembic upgrade head

# 特定のリビジョンにアップグレード
alembic upgrade <revision>

# 1つ前のバージョンにダウングレード
alembic downgrade -1
```

### マイグレーション履歴の確認

```bash
# 現在のバージョンを確認
alembic current

# 履歴を確認
alembic history
```

## 注意事項

- マイグレーションは `shared/infrastructure/database/schema.py` の `metadata` を参照して生成されます
- すべてのテーブル（strategy-module と execution-module の両方）が同じ metadata で管理されます
- 外部キー制約があるため、マイグレーションの順序に注意してください

