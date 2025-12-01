# Strategy Engine アーキテクチャ

strategy-engine の設計と実装方針。Redis Stream から市場データを購読し、OHLCV 生成、テクニカル指標計算、シグナル生成を行い、Redis Stream に配信する。

## 目次

1. [責務と基本方針](#責務と基本方針)
2. [データフロー](#データフロー)
3. [コンポーネント設計](#コンポーネント設計)
4. [戦略の実装](#戦略の実装)
5. [データベース設計](#データベース設計)
6. [設定管理](#設定管理)
7. [参考資料](#参考資料)

---

## 責務と基本方針

### 責務

strategy-engine は以下の責務を持つ:

- **Redis Stream 購読**: `md:trade`, `md:orderbook`, `md:ticker` を Consumer Group で購読
- **OHLCV 生成**: 市場データから OHLCV（1秒/1分など）を生成
- **テクニカル指標計算**: ta-lib / pandas-ta を使用して指標を計算
- **シグナル生成**: 戦略ロジックで売買シグナルを生成
- **シグナル配信**: 生成したシグナルを Redis Stream（`signal:*`）に配信
- **データ永続化**: OHLCV とシグナルを PostgreSQL に保存

### 基本方針

- **イベント駆動**: Redis Stream から市場データを購読し、リアルタイムで処理
- **取りこぼしゼロ**: Consumer Group を使用して、再起動時もデータを取りこぼさない
- **戦略の交換可能性**: 戦略ロジックを独立したコンポーネントとして実装し、交換可能にする
- **段階的な発展**: 初期はルールベース、将来的に AI/ML モデルに置き換え可能

---

## データフロー

### メインループ（概略）

```python
redis_client = Redis(REDIS_URL)
strategy = Strategy(...)
ohlcv_generator = OHLCVGenerator(...)
logger = Logger()

# Consumer Group で市場データを購読
for message in redis_client.xreadgroup(
    group="strategy-engine",
    consumer="strategy-1",
    streams={"md:ticker": ">", "md:orderbook": ">", "md:trade": ">"},
    block=1000
):
    # OHLCV を更新
    ohlcv = ohlcv_generator.update(message)

    # テクニカル指標を計算
    indicators = strategy.calculate_indicators(ohlcv)

    # シグナルを生成
    signal = strategy.decide(ohlcv, indicators)

    if signal:
        # Redis Stream にシグナルを配信
        redis_client.xadd("signal:gmo", {
            "type": signal.type,
            "symbol": signal.symbol,
            "action": signal.action,
            "confidence": signal.confidence,
            "ts": signal.ts
        })

        # PostgreSQL に保存
        logger.log_signal(signal)
        logger.log_ohlcv(ohlcv)
```

### データフロー

1. **Redis Stream 購読**: `md:trade`, `md:orderbook`, `md:ticker` を Consumer Group で購読
2. **OHLCV 生成**: 受信した市場データから OHLCV（1秒/1分など）を生成
3. **指標計算**: テクニカル指標（MA、RSI、ボリンジャーバンドなど）を計算
4. **シグナル生成**: 戦略ロジックで売買シグナルを生成
5. **シグナル配信**: 生成したシグナルを Redis Stream（`signal:*`）に配信
6. **データ永続化**: OHLCV とシグナルを PostgreSQL に保存

詳細は [architecture.md](./01_architecture.md) の「データフロー」セクションを参照。

---

## コンポーネント設計

### MarketDataConsumer

Redis Stream から市場データを購読するコンポーネント。

**責務**:
- Consumer Group で `md:*` Stream を購読
- メッセージのパースと正規化
- エラーハンドリングとリトライ

**主要メソッド**:
- `consume()`: 市場データを購読するジェネレータ
- `ack(message_id)`: メッセージを ACK（処理完了を通知）
- `recover()`: 未処理メッセージを再取得

### OHLCVGenerator

市場データから OHLCV を生成するコンポーネント。

**責務**:
- ticker/trade データから OHLCV を生成
- 複数の時間足（1秒、1分、5分など）を管理
- データの整合性を保証

**主要メソッド**:
- `update(message)`: 市場データを受け取り、OHLCV を更新
- `get_ohlcv(symbol, timeframe)`: 指定した時間足の OHLCV を取得
- `reset(symbol)`: 指定したシンボルの OHLCV をリセット

**実装例**:
```python
class OHLCVGenerator:
    def __init__(self, timeframes=['1s', '1m', '5m']):
        self.timeframes = timeframes
        self.ohlcv_data = {}  # {symbol: {timeframe: OHLCV}}

    def update(self, message: dict):
        symbol = message['symbol']
        price = float(message['data']['price'])
        ts = int(message['ts'])

        for timeframe in self.timeframes:
            if symbol not in self.ohlcv_data:
                self.ohlcv_data[symbol] = {}

            if timeframe not in self.ohlcv_data[symbol]:
                self.ohlcv_data[symbol][timeframe] = {
                    'open': price,
                    'high': price,
                    'low': price,
                    'close': price,
                    'volume': 0,
                    'timestamp': ts
                }

            ohlcv = self.ohlcv_data[symbol][timeframe]
            ohlcv['high'] = max(ohlcv['high'], price)
            ohlcv['low'] = min(ohlcv['low'], price)
            ohlcv['close'] = price
            ohlcv['volume'] += float(message['data'].get('size', 0))

        return self.ohlcv_data[symbol]
```

### Strategy

売買ロジックを実装するクラス。入出力を純粋なデータに限定し、交換可能にする。

**責務**:
- OHLCV とテクニカル指標を受け取り、シグナルを生成
- 初期は単純なルールベース、後から AI/ML モデルに置き換え可能

**インターフェース**:
```python
class Strategy:
    def calculate_indicators(self, ohlcv: dict) -> dict:
        """
        OHLCV からテクニカル指標を計算

        Returns:
            dict: 指標の辞書（例: {'ma_20': 100.5, 'rsi': 65.2}）
        """
        pass

    def decide(self, ohlcv: dict, indicators: dict) -> Optional[Signal]:
        """
        OHLCV と指標から売買シグナルを生成

        Returns:
            Signal: シグナルオブジェクト（action: 'enter_long', 'exit', 'enter_short', 'hold'）
            None: シグナルなし
        """
        pass
```

**実装例（移動平均クロス）**:
```python
class MovingAverageCrossStrategy(Strategy):
    def __init__(self, fast_window=5, slow_window=20):
        self.fast_window = fast_window
        self.slow_window = slow_window
        self.price_history = []

    def calculate_indicators(self, ohlcv: dict):
        close_prices = [c['close'] for c in ohlcv['1m']]

        if len(close_prices) < self.slow_window:
            return {}

        ma_fast = sum(close_prices[-self.fast_window:]) / self.fast_window
        ma_slow = sum(close_prices[-self.slow_window:]) / self.slow_window

        return {
            'ma_fast': ma_fast,
            'ma_slow': ma_slow
        }

    def decide(self, ohlcv: dict, indicators: dict):
        if not indicators:
            return None

        ma_fast = indicators['ma_fast']
        ma_slow = indicators['ma_slow']
        current_price = ohlcv['1m'][-1]['close']

        # ゴールデンクロス（短期線が長期線を上抜け）
        if ma_fast > ma_slow and current_price > ma_fast:
            return Signal(
                action='enter_long',
                confidence=0.7,
                price_ref=current_price
            )
        # デッドクロス（短期線が長期線を下抜け）
        elif ma_fast < ma_slow and current_price < ma_fast:
            return Signal(
                action='exit',
                confidence=0.7,
                price_ref=current_price
            )

        return None
```

### SignalPublisher

生成したシグナルを Redis Stream に配信するコンポーネント。

**責務**:
- シグナルを Redis Stream（`signal:*`）に配信
- シグナルの形式を統一

**主要メソッド**:
- `publish(signal)`: シグナルを Redis Stream に配信
- `format_signal(signal)`: シグナルを Redis Stream 形式に変換

### Logger

構造化ログを stdout と DB に二重出力する。

**責務**:
- OHLCV、シグナル、指標を JSON 形式でログ出力
- DB への書き込み（`ohlcv` テーブル、`signals` テーブル）
- stdout への出力（docker logs で確認可能）

**主要メソッド**:
- `log_ohlcv(ohlcv)`: OHLCV をログ
- `log_signal(signal)`: シグナルをログ
- `log_indicators(indicators)`: 指標をログ
- `log_error(error, context)`: エラー情報をログ

---

## 戦略の実装

### 初期実装（ルールベース）

**移動平均（MA）クロス**:
- 短期移動平均と長期移動平均のクロスでシグナル生成
- ゴールデンクロス（買い）、デッドクロス（売り）

**RSI の閾値判定**:
- RSI が 30 以下で買いシグナル
- RSI が 70 以上で売りシグナル

**ボリンジャーバンドの上下タッチ**:
- 価格が下バンドにタッチしたら買いシグナル
- 価格が上バンドにタッチしたら売りシグナル

**特徴**:
- 実装が単純
- トレンド相場では有効
- 横ばい相場では損失が積み上がりやすい

### 将来の発展（AI/ML）

**機械学習モデル**:
- **scikit-learn**: リッジ回帰、ランダムフォレストなど
- **PyTorch**: LSTM（時系列モデル）、Transformer 系の埋め込み
- **重要なポイント**:
  - 予測精度そのものより「どの市場状態で機能するか」が重要
  - モデル選びは環境選びと言える

**LLM を使った戦略**:
- 市場ニュースやソーシャルメディアの感情分析
- マクロ経済指標の解釈と戦略への反映
- 複数戦略の組み合わせ最適化

**バックテスト**:
- pandas ベース自作 or backtrader
- イベント駆動シミュレータ: 実運用と同じループ構造で過去WS相当を流す → "本番との差分バグ"が激減する

詳細は [architecture.md](./01_architecture.md) の「Python側の責務と実装ポイント」セクションを参照。

---

## データベース設計

### ohlcv テーブル

OHLCV データを記録するテーブル。

**スキーマ**:
```sql
CREATE TABLE ohlcv (
    id SERIAL PRIMARY KEY,
    exchange VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    timeframe VARCHAR(10) NOT NULL,  -- '1s', '1m', '5m', etc.
    timestamp TIMESTAMP NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ohlcv_exchange_symbol_timeframe ON ohlcv(exchange, symbol, timeframe, timestamp DESC);
CREATE INDEX idx_ohlcv_timestamp ON ohlcv(timestamp DESC);
```

**用途**:
- OHLCV データの永続化
- バックテスト用のデータ取得
- 指標計算の履歴管理

### signals テーブル

生成したシグナルを記録するテーブル。

**スキーマ**:
```sql
CREATE TABLE signals (
    id SERIAL PRIMARY KEY,
    exchange VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    strategy VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL,  -- 'enter_long', 'exit', 'enter_short', 'hold'
    confidence DECIMAL(5, 2) NOT NULL,  -- 0.00 - 1.00
    price_ref DECIMAL(20, 8) NOT NULL,
    indicators JSONB,  -- 指標データ（JSON形式）
    meta JSONB,  -- メタデータ（理由、パラメータなど）
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_signals_exchange_symbol_strategy ON signals(exchange, symbol, strategy, timestamp DESC);
CREATE INDEX idx_signals_timestamp ON signals(timestamp DESC);
CREATE INDEX idx_signals_action ON signals(action, timestamp DESC);
```

**用途**:
- シグナルの履歴管理
- 戦略のパフォーマンス分析
- デバッグとトラブルシューティング

---

## 設定管理

### 環境変数（.env）

strategy-engine の設定は環境変数で管理する。

**必須設定**:
```env
# Redis 設定
REDIS_URL=redis://redis:6379/0

# PostgreSQL 設定
DATABASE_URL=postgresql://bot:password@db:5432/bot_db

# 購読設定
SYMBOLS=BTC_JPY,ETH_JPY
STRATEGY_NAME=moving_average_cross

# ログ設定
LOG_LEVEL=INFO
```

**戦略パラメータ**:
Strategy 用パラメータも環境変数で設定可能。

```env
# 移動平均クロス戦略のパラメータ
MA_FAST_WINDOW=5
MA_SLOW_WINDOW=20
RSI_PERIOD=14
RSI_OVERSOLD=30
RSI_OVERBOUGHT=70
```

**OHLCV 設定**:
```env
# OHLCV の時間足
OHLCV_TIMEFRAMES=1s,1m,5m,15m,1h
```

### 設定の読み込み

`config.py` で環境変数を読み込む。

```python
import os
from typing import List

class Config:
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    SYMBOLS: List[str] = os.getenv("SYMBOLS", "BTC_JPY").split(",")
    STRATEGY_NAME: str = os.getenv("STRATEGY_NAME", "moving_average_cross")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # 戦略パラメータ
    MA_FAST_WINDOW: int = int(os.getenv("MA_FAST_WINDOW", "5"))
    MA_SLOW_WINDOW: int = int(os.getenv("MA_SLOW_WINDOW", "20"))
    RSI_PERIOD: int = int(os.getenv("RSI_PERIOD", "14"))
    RSI_OVERSOLD: int = int(os.getenv("RSI_OVERSOLD", "30"))
    RSI_OVERBOUGHT: int = int(os.getenv("RSI_OVERBOUGHT", "70"))

    # OHLCV 設定
    OHLCV_TIMEFRAMES: List[str] = os.getenv("OHLCV_TIMEFRAMES", "1s,1m,5m").split(",")
```

---

## 参考資料

- [GMOコイン API Documentation](https://api.coin.z.com/docs/)
- [architecture.md](./01_architecture.md) - システム全体のアーキテクチャ
- [ws_collector_node.md](./02_ws_collector_node.md) - WebSocket データコレクターの設計
- [trading_domain.md](../domain/trading_domain.md) - 取引ドメインのルール
- [coding_standards.md](../coding_standards.md) - コード規約

