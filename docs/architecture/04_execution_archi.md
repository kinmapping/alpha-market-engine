# FastAPI 設計

bot を止めずに監視・参照機能を提供するシンプルな API。将来の設定変更 API を追加しても bot と疎結合を維持する。

## 責務
- 健全性チェック（health）
- bot 稼働状態と簡易メトリクスの提供
- ログ参照（最新 N 件）
- 将来：bot 設定値の読み書き

## エンドポイント設計
- `GET /health`：200 OK 固定。起動確認のみ
- `GET /bot/status`：
  - 返却：`{"is_running": bool, "uptime_sec": int, "last_ws_heartbeat": ISO8601, "last_order": {...}}`
  - 参照：PostgreSQL のステータステーブル（例 `bot_status`）または最新ログ
- `GET /logs?limit=100&side=BUY|SELL`：
  - 返却：直近ログのリスト（時系列 desc）
  - 参照：`trade_log` テーブル

## 実装構成
```
api/
  app.py       # FastAPI 本体/DI セットアップ
  routes.py    # ルーティング
  schemas.py   # レスポンス用 Pydantic モデル
  deps.py      # DB 接続依存性
  requirements.txt
```

## データ連携
- DB 共有：bot→insert、API→select
- bot を直接停止/再起動する RPC は持たない。設定変更を行う場合も DB か設定テーブル経由で行い、bot はポーリングで反映

## エラー/運用
- 予期しない例外は 500、スタックトレースはログのみ（レスポンスには出さない）
- API 再起動は bot に影響しない。コンテナとプロセスを完全分離
- レート制限は不要だが、ログ取得は `limit` 上限を設けて負荷を抑える
