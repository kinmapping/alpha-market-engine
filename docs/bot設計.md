# bot 設計

## 責務
- WS で ticker/板/約定を購読し続ける（自動再接続あり）
- シグナルを判定し、REST で発注/取消する
- 約定イベントや発注結果を DB/標準出力へロギングする
- bot 稼働状態を DB に記録し、FastAPI が参照できる形にする

## メインループ（概略）
```python
ex = ExchangeClient(EXCHANGE, SYMBOL)
strategy = Strategy(...)
for tick in ex.ws_ticker():            # 再接続を内包
    signal = strategy.decide(tick)
    if signal is BUY:
        ex.rest_buy(size=TRADE_SIZE)
    elif signal is SELL:
        ex.rest_sell(size=TRADE_SIZE)
    logger.log_tick(tick, signal)
```

## コンポーネント
- `ExchangeClient`：GMO REST/WS ラッパー。署名付きリクエスト、サブスクライブ、再接続処理を内包
- `Strategy`：入出力を純粋なデータに限定し、交換可能にする（初期は単純な MA 判定）
- `Logger`：stdout と DB に二重出力。構造化 JSON を基本にする
- `StateStore`：`bot_status` テーブルへの心拍・最新価格・直近注文情報の記録

## 再接続・リトライ指針
- WS：例外→短い sleep(2)→再接続。`ping_interval=20` `ping_timeout=20`。subscribe は 1 秒 1 回以内
- REST：HTTP エラー/429/5xx は指数バックオフで数回リトライ。idempotency のため注文リクエストにはクライアント生成 UUID を付与

## ログ/テーブル案
- `trade_log`：timestamp, price, side, size, order_id, status, message
- `bot_status`：timestamp, is_running, last_ws_heartbeat, last_signal, last_order_id, error
ログは時系列で FastAPI が `limit` 指定で参照できるようにする。

## 設定
- .env：`API_KEY` `API_SECRET` `EXCHANGE` `SYMBOL` `TRADE_SIZE` など。Strategy 用パラメータ（MA 窓など）もここに置くか設定テーブル化する。
