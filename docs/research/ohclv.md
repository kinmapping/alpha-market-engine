まず結論からいきます。

* WebSocket から流れてくるのは「約定の1件1件（tick）」なので
  **それを時間でグルーピングして OHLCV に“集計”すればOK** です。
* その集計をやる **CandleAggregator クラス** と、
  複数本のローソク足を管理する **OhlcvStore（シリーズ管理）クラス** を用意するときれいに設計できます。

順番に説明します。

---

## 1. WebSocket → OHLCV を作る考え方

取引所の WebSocket からだいたいこんなデータが飛んできます（例：trades / executions）:

```jsonc
{
  "timestamp": 1733558400,  // 秒 or ミリ秒
  "price": 5060000,
  "size": 0.01,
  "side": "BUY"
}
```

これを「1分足 OHLCV」に変換したいなら、こんなイメージです。

* 2025-12-07 10:00:00〜10:00:59 の約定を全部集計 → 1本のローソク足
* 次の1分（10:01〜10:01:59）も同じく集計 → 次の1本

中でやることはシンプル：

* **O**: その時間帯で最初に出てきた価格
* **H**: その時間帯で一番高い価格
* **L**: その時間帯で一番安い価格
* **C**: その時間帯で最後に出てきた価格
* **V**: その時間帯の size 合計

これを WebSocket のイベントを読みながらリアルタイムで更新していく、という構造です。

---

## 2. 時間枠を決めるロジック

「これはどの足に属するか？」を決めるには、
timestamp を「足の開始時刻」に丸めればOKです。

例：1分足なら

```python
bucket_ts = timestamp // 60 * 60  # 秒ならこれで“分”の先頭にそろう
```

* 10:00:05 → 10:00:00
* 10:00:59 → 10:00:00
* 10:01:01 → 10:01:00

この「bucket_ts ごとに OHLCV を1本持つ」という構造を作ります。

---

## 3. CandleAggregator クラス設計（1シンボル・1タイムフレーム用）

まずは最小構成で。

```python
from dataclasses import dataclass
from typing import Optional
import math
import time


@dataclass
class Ohlcv:
    open_time: int   # 足の開始時刻（epoch秒）
    open: float
    high: float
    low: float
    close: float
    volume: float


class CandleAggregator:
    """
    1シンボル・1タイムフレームの OHLCV を
    WebSocketの trade/exec stream から生成するクラス。
    """
    def __init__(self, timeframe_sec: int = 60):
        self.timeframe_sec = timeframe_sec
        self.current: Optional[Ohlcv] = None
        self.last_closed: Optional[Ohlcv] = None

    def _bucket_start(self, ts: float) -> int:
        """
        ts（epoch秒）から、この足の開始時刻を計算。
        """
        return int(ts) // self.timeframe_sec * self.timeframe_sec

    def on_trade(self, ts: float, price: float, size: float) -> Optional[Ohlcv]:
        """
        WebSocketから約定を1件受け取るたびに呼ぶ。
        必要に応じて足を更新し、足が確定したタイミングでその足を返す。
        
        戻り値:
          - 新しく確定した足があれば Ohlcv
          - まだ同じ足の中なら None
        """
        bucket = self._bucket_start(ts)

        # まだ足がない or 次の足に移るタイミング
        if self.current is None or bucket > self.current.open_time:
            # 前の足を last_closed に退避
            closed = self.current
            # 新しい足を開始
            self.current = Ohlcv(
                open_time=bucket,
                open=price,
                high=price,
                low=price,
                close=price,
                volume=size,
            )
            if closed:
                self.last_closed = closed
                return closed  # 1本確定
            return None

        # 同じ足の中なので OHLCV を更新
        c = self.current
        c.close = price
        c.high = max(c.high, price)
        c.low = min(c.low, price)
        c.volume += size
        return None

    def get_current_candle(self) -> Optional[Ohlcv]:
        """
        まだ確定していない進行中の足を返す。
        """
        return self.current

    def get_last_closed_candle(self) -> Optional[Ohlcv]:
        """
        直近で確定した足を返す。
        """
        return self.last_closed
```

### ポイント

* WebSocketループ側からは **毎トレードで `on_trade()` を叩くだけ**。
* 足が切り替わった瞬間に `Ohlcv` が返ってくるので、
  そこで DB に保存したり戦略ロジックに渡したりできる。

---

## 4. WebSocketと組み合わせた疑似コード

GMO / BitFlyer / Binance どれでも概念は同じです。

```python
import asyncio
import json
import websockets

from ohlcv import CandleAggregator  # 上で作ったやつをimport

async def run_ws_and_aggregate():
    agg = CandleAggregator(timeframe_sec=60)  # 1分足

    async with websockets.connect("wss://example.com/ws/trades") as ws:
        # 取引所ごとの subscribe メッセージを送る
        await ws.send(json.dumps({
            "type": "subscribe",
            "channel": "trades",
            "symbol": "BTC_JPY",
        }))

        async for raw in ws:
            msg = json.loads(raw)

            # 取引所に合わせてフィールド名を合わせる
            ts = msg["timestamp"]      # epoch秒 or ミリ秒換算して秒に
            price = float(msg["price"])
            size = float(msg["size"])

            closed = agg.on_trade(ts, price, size)
            if closed is not None:
                print("closed candle:", closed)
                # ここでDB保存や戦略ロジック呼び出しを行う

            # 現在進行中の足を見たいとき
            current = agg.get_current_candle()
            # 必要ならここでリアルタイム描画なども可能

asyncio.run(run_ws_and_aggregate())
```

実際には取引所ごとに `msg` の形が違うので、
**WSメッセージ → 共通の trade イベント形式** にマッピングする層を1つ作るときれいです。

---

## 5. 複数タイムフレーム・複数シンボル対応の OHLCV 管理クラス

alpha-market-engine のような設計だと、

* シンボル: `BTC_JPY`, `ETH_JPY` など複数
* タイムフレーム: 1分足 / 5分足 / 1時間足 など複数

これをまとめて管理するクラスが欲しくなります。

### OhlcvStore のイメージ

```python
from collections import defaultdict
from typing import Dict, Tuple, List

class OhlcvStore:
    """
    symbol x timeframe ごとに CandleAggregator を持って、
    WebSocketのtradeを受け取って OHLCVを管理するクラス。
    """
    def __init__(self, timeframes_sec: List[int]):
        self.timeframes = timeframes_sec
        # key: (symbol, timeframe_sec) -> CandleAggregator
        self.aggregators: Dict[Tuple[str, int], CandleAggregator] = {}
        # 簡易的に最近N本だけ保持しておく場合
        self.history: Dict[Tuple[str, int], List[Ohlcv]] = defaultdict(list)
        self.max_history = 500  # 保持本数

    def ensure_aggregator(self, symbol: str, timeframe_sec: int) -> CandleAggregator:
        key = (symbol, timeframe_sec)
        if key not in self.aggregators:
            self.aggregators[key] = CandleAggregator(timeframe_sec=timeframe_sec)
        return self.aggregators[key]

    def on_trade(self, symbol: str, ts: float, price: float, size: float):
        for tf in self.timeframes:
            agg = self.ensure_aggregator(symbol, tf)
            closed = agg.on_trade(ts, price, size)
            if closed is not None:
                key = (symbol, tf)
                self.history[key].append(closed)
                if len(self.history[key]) > self.max_history:
                    self.history[key].pop(0)

    def get_latest(self, symbol: str, timeframe_sec: int) -> Optional[Ohlcv]:
        key = (symbol, timeframe_sec)
        if key not in self.history or not self.history[key]:
            return None
        return self.history[key][-1]

    def get_series(self, symbol: str, timeframe_sec: int) -> List[Ohlcv]:
        """
        バックテストやインジケータ計算用に OHLCV シリーズを返す。
        """
        key = (symbol, timeframe_sec)
        return list(self.history.get(key, []))
```

### WebSocket側からはこう扱う

```python
store = OhlcvStore(timeframes_sec=[60, 300])  # 1分足 & 5分足

# WSでtradeを受信するたびに：
store.on_trade("BTC_JPY", ts, price, size)

# 指標計算や戦略で使うとき
last_1m = store.get_latest("BTC_JPY", 60)
series_1m = store.get_series("BTC_JPY", 60)
```

これで、

* `exchange` モジュール → WSからtradeイベントを整形して `store.on_trade` に投げる
* `strategy` モジュール → `store.get_series` でOHLCVをもらってインジケータ計算

という **綺麗な責務分離** ができます。

---

## 6. alpha-market-engine での配置イメージ

ディレクトリ構成的にはこんな感じが自然です：

```txt
alpha-market-engine/
  bot/
    main.py
    exchange/
      gmo.py
      bitflyer.py
      binance.py
    data/
      ohlcv.py      # Ohlcv, CandleAggregator, OhlcvStore
    strategy/
      base.py
      ma_cross.py
      ...
```

* `exchange/*` → WebSocketから trade イベントを受け取るところ
* `data/ohlcv.py` → それを OHLCV に変換・保持するところ
* `strategy/*` → OHLCV を前提に戦略計算・シグナル生成するところ

この三層に分けると、
取引所を増やしても、戦略を増やしても壊れにくい構成になります。

---

## まとめ

* WebSocket → OHLCV は「約定を時間バケットごとに集計する」だけ。
* 1シンボル・1タイムフレームには `CandleAggregator` を用意。
* 複数シンボル・複数タイムフレームは `OhlcvStore` で一括管理。
* `exchange`（WS受信）と `strategy`（ロジック）の間に「OHLCV変換レイヤ」を挟むと設計がきれい。

このあたりを alpha-market-engine 用にきっちりファイル分割した「docs/data-architecture.md」みたいな形でまとめることもできますし、
実際に `data/ohlcv.py` 完全版を出してもいいです。
